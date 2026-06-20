import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Medium parsing limits to support text/json payloads
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // API status endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: Date.now() });
  });

  // DuckDuckGo Search API Proxy with Wikipedia fallback & domain diversification
  app.post("/api/search", async (req, res) => {
    const { keywords, maxResults = 5, honestUserAgent = false } = req.body;
    if (!keywords || typeof keywords !== "string") {
      res.status(400).json({ error: "Missing or invalid keywords parameter." });
      return;
    }

    console.log(`[Proxy] Searching for keywords: "${keywords}" (maxResults: ${maxResults}, honest: ${honestUserAgent})`);
    
    const userAgent = honestUserAgent 
      ? "ScrapeEngine/1.0 (+https://github.com/wowo515151/Scrape; open-source-education-research; contact: wowo515151@gmail.com)"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    let nonWikiUrls: string[] = [];
    let wikiUrls: string[] = [];
    let methodUsed = "DuckDuckGo Lite POST";

    // Helper to extract clean links and avoid duplicates
    const processHtmlPage = (htmlText: string) => {
      const regex = /href\s*=\s*\\?["']([^\\"']+?)\\?["']/gi;
      let match;
      while ((match = regex.exec(htmlText)) !== null) {
        const href = match[1];
        if (!href) continue;

        let resolvedUrl: string | null = null;

        // Try decoding 'uddg='
        if (href.includes("uddg=")) {
          try {
            const idx = href.indexOf("uddg=");
            let sub = href.substring(idx + 5);
            const ampIdx = sub.indexOf("&");
            if (ampIdx !== -1) {
              sub = sub.substring(0, ampIdx);
            }
            const decoded = decodeURIComponent(sub);
            if (decoded.startsWith("http") && !decoded.includes("duckduckgo.com")) {
              resolvedUrl = decoded;
            }
          } catch {
            // ignore
          }
        }
        // Try decoding '?u='
        else if (href.includes("?u=")) {
          try {
            const idx = href.indexOf("?u=");
            let sub = href.substring(idx + 3);
            const ampIdx = sub.indexOf("&");
            if (ampIdx !== -1) {
              sub = sub.substring(0, ampIdx);
            }
            const decoded = decodeURIComponent(sub);
            if (decoded.startsWith("http") && !decoded.includes("duckduckgo.com")) {
              resolvedUrl = decoded;
            }
          } catch {
            // ignore
          }
        }
        // Direct http/https URL
        else if (href.startsWith("http") && !href.includes("duckduckgo.com")) {
          resolvedUrl = href;
        }

        if (resolvedUrl) {
          // Exclude typical static assets or common useless routes
          const lower = resolvedUrl.toLowerCase();
          if (
            lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") ||
            lower.endsWith(".gif") || lower.endsWith(".svg") || lower.endsWith(".css") ||
            lower.endsWith(".js")
          ) {
            continue;
          }

          if (resolvedUrl.includes("wikipedia.org")) {
            if (!wikiUrls.includes(resolvedUrl)) {
              wikiUrls.push(resolvedUrl);
            }
          } else {
            if (!nonWikiUrls.includes(resolvedUrl)) {
              nonWikiUrls.push(resolvedUrl);
            }
          }
        }
      }
    };

    // Stage 1: Try posting to DuckDuckGo Lite (Highly resilient, forms-based POST bypasses common bots checks)
    try {
      console.log(`[Proxy Search] Stage 1 - Attempting DuckDuckGo Lite POST...`);
      const response = await fetch("https://lite.duckduckgo.com/lite/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5"
        },
        body: `q=${encodeURIComponent(keywords)}`,
        signal: AbortSignal.timeout(6000)
      });

      if (response.ok) {
        const html = await response.text();
        processHtmlPage(html);
        console.log(`[Proxy Search] Stage 1 search returned ${nonWikiUrls.length} non-Wikipedia and ${wikiUrls.length} Wikipedia URLs.`);
      }
    } catch (err: any) {
      console.warn(`[Proxy Search] Stage 1 (DDG Lite POST) failed/timeout: ${err.message}`);
    }

    // Stage 2: Fallback to DuckDuckGo HTML GET (if Stage 1 returned no non-wiki URLs)
    if (nonWikiUrls.length === 0) {
      methodUsed = "DuckDuckGo HTML GET";
      try {
        console.log(`[Proxy Search] Stage 2 - Attempting DuckDuckGo HTML GET...`);
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keywords)}`;
        const response = await fetch(ddgUrl, {
          headers: {
            "User-Agent": honestUserAgent ? userAgent : "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const html = await response.text();
          processHtmlPage(html);
          console.log(`[Proxy Search] Stage 2 search returned ${nonWikiUrls.length} non-Wikipedia and ${wikiUrls.length} Wikipedia URLs.`);
        }
      } catch (err: any) {
        console.warn(`[Proxy Search] Stage 2 (DDG HTML GET) failed/timeout: ${err.message}`);
      }
    }

    // Stage 3: Fallback to DuckDuckGo Lite GET (if still no non-wiki URLs)
    if (nonWikiUrls.length === 0) {
      methodUsed = "DuckDuckGo Lite GET";
      try {
        console.log(`[Proxy Search] Stage 3 - Attempting DuckDuckGo Lite GET...`);
        const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(keywords)}`;
        const response = await fetch(ddgUrl, {
          headers: {
            "User-Agent": honestUserAgent ? userAgent : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9"
          },
          signal: AbortSignal.timeout(6000)
        });

        if (response.ok) {
          const html = await response.text();
          processHtmlPage(html);
          console.log(`[Proxy Search] Stage 3 search returned ${nonWikiUrls.length} non-Wikipedia and ${wikiUrls.length} Wikipedia URLs.`);
        }
      } catch (err: any) {
        console.warn(`[Proxy Search] Stage 3 (DDG Lite GET) failed/timeout: ${err.message}`);
      }
    }

    // Gather final candidate list (always routing non-Wikipedia first to satisfy diversify instruction)
    let urls = [...nonWikiUrls, ...wikiUrls];

    // Stage 4: Wikipedia Search API (only if absolutely no URLs harvested from any DDG fallback tier)
    if (urls.length === 0) {
      methodUsed = "Wikipedia OpenSearch API";
      try {
        console.log(`[Proxy Search] Stage 4 - Querying Wikipedia OpenSearch fallback...`);
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(keywords)}&limit=${maxResults + 5}&namespace=0&format=json`;
        const wikiRes = await fetch(wikiUrl, {
          headers: { "User-Agent": "ScrapeEngine/1.0 (wowo515151@gmail.com)" },
          signal: AbortSignal.timeout(5000)
        });
        
        if (wikiRes.ok) {
          const data = await wikiRes.json();
          if (Array.isArray(data) && data[3] && Array.isArray(data[3])) {
            urls = data[3].filter((link: any) => typeof link === "string" && link.startsWith("http"));
          }
        }
      } catch (err: any) {
        console.error(`[Proxy Search] Stage 4 (Wikipedia Fallback) failed:`, err.message);
      }
    }

    // Stage 5: Ultimate Fallback (high quality static assets) if still completely blank
    if (urls.length === 0) {
      methodUsed = "System Reference Static Maps";
      urls = [
        "https://www.bloomberg.com",
        "https://www.reuters.com",
        "https://www.cnbc.com",
        "https://www.ft.com",
        "https://www.economist.com"
      ];
    }

    // Limit returned array count 
    const selectedUrls = urls.slice(0, maxResults);
    console.log(`[Proxy Search] Successfully retrieved ${selectedUrls.length} links using method: [${methodUsed}].`);
    res.json({
      keywords,
      methodUsed,
      urls: selectedUrls
    });
  });

  // Web Crawler Proxy Endpoint to grab RAW HTML blobs
  app.post("/api/fetch-raw", async (req, res) => {
    const { url, honestUserAgent = false } = req.body;
    if (!url || typeof url !== "string" || !url.startsWith("http")) {
      res.status(400).json({ error: "Missing or invalid url parameter." });
      return;
    }

    console.log(`[Proxy] Fetching HTML blob for: "${url}" (honest: ${honestUserAgent})`);

    const userAgent = honestUserAgent
      ? "ScrapeEngine/1.0 (+https://github.com/wowo515151/Scrape; open-source-education-research; contact: wowo515151@gmail.com)"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

    let response: Response | null = null;
    let fetchError: any = null;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "max-age=0",
          "sec-ch-ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1"
        },
        signal: AbortSignal.timeout(8000) // 8 second strict network window
      });
    } catch (err: any) {
      fetchError = err;
    }

    // If live fetch succeeded and returned an acceptable status, serve it
    if (response && response.ok) {
      try {
        const html = await response.text();
        res.json({
          url,
          content: html,
          bytes: html.length,
          status: response.status
        });
        return;
      } catch (err: any) {
        fetchError = err;
      }
    }

    // Determine failure motive
    const statusText = response ? `HTTP ${response.status}` : (fetchError?.message || "Unknown error");
    console.warn(`[Proxy] Live fetch failed for "${url}" (${statusText}). Initiating Wayback Machine fallback...`);

    // Wayback Machine Fallback: Zero-auth, rates-tolerant Wayback availability lookup
    try {
      const waybackApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
      const waybackApiResponse = await fetch(waybackApiUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" },
        signal: AbortSignal.timeout(5000)
      });

      if (waybackApiResponse.ok) {
        const data = await waybackApiResponse.json() as any;
        const closest = data?.archived_snapshots?.closest;
        if (closest && closest.available && closest.url) {
          let archiveUrl = closest.url;
          // Subsitute /web/ for /web/id_/, stripping Waybacks visual rewrite overlay frame injection
          if (archiveUrl.includes("/web/")) {
            archiveUrl = archiveUrl.replace("/web/", "/web/id_/");
          }
          console.log(`[Proxy] Found archived snapshot on Wayback Machine: ${archiveUrl}`);

          const archiveResponse = await fetch(archiveUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" },
            signal: AbortSignal.timeout(8000)
          });

          if (archiveResponse.ok) {
            const archiveHtml = await archiveResponse.text();
            console.log(`[Proxy] Successfully retrieved archived HTML content of size ${archiveHtml.length} bytes.`);
            res.json({
              url,
              content: archiveHtml,
              bytes: archiveHtml.length,
              status: 200,
              info: "Wayback Machine Archive Fallback"
            });
            return;
          }
        }
      }
    } catch (waybackErr: any) {
      console.error(`[Proxy] Wayback Machine fallback failed also:`, waybackErr.message);
    }

    // If both live retrieval and Archive fallback have exhausted, notify caller of termination
    const errorMsg = fetchError ? fetchError.message : (response ? `HTTP status ${response.status}` : "Access Denied");
    res.status(502).json({
      error: `Could not reach target website or archived snapshot: ${errorMsg}`,
      url
    });
  });

  // Vite middleware for development or Static Assets for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Scrape Engine] Server running on http://0.0.0.0:${PORT} under NODE_ENV=${process.env.NODE_ENV}`);
  });
}

startServer().catch((err) => {
  console.error("Critical error starting Scrape Engine server:", err);
});
