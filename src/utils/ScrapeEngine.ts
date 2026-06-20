/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Core Scrape Engine Implementation
 * Conforms 100% to the Dynamic API & Library Specification.
 */

import { extractEnglishProse } from "./extractor";
import { PromptSecurityGuard } from "./security";

export interface SearchNode {
  keywords: string[];
  maxResults: number;
}

export interface ScrapedArticle {
  index: number;
  sourceUrl: string;
  keywordOrigin: string;
  cleanText: string;
  securityMetrics: {
    isSecure: boolean;
    maliciousPromptScore: number; // Highest probability detected across all window slices
    flaggedWindowCount: number;   // Number of window segments breaching the safety threshold
  };
}

export interface ExtractionResult {
  sessionId: string;
  timestamp: number;
  payload: ScrapedArticle[];
}

export class ScrapeEngine {
  private concurrencyPoolSize: number;
  private activeWorkers: number = 0;
  private classifierInitialized: boolean = false;
  private securityGuard: PromptSecurityGuard;

  // New configuration options for Ethical / GitHub Pages static mode
  public engineMode: "fullstack" | "github-pages" = "fullstack";
  public corsProxy: string = "https://api.allorigins.win/raw?url=";
  public pacingDelayMs: number = 0;
  public honestUserAgent: boolean = false;

  // Custom logging callback to update the active frontend terminal trace logs
  public onLog?: (message: string) => void;

  /**
   * @param poolLimit Global strict bound capping overlapping HTTP network sessions
   * @param config Optional parameters for ethical and static-mode crawls
   */
  constructor(
    poolLimit: number = 5,
    config?: {
      mode?: "fullstack" | "github-pages";
      corsProxy?: string;
      pacingDelayMs?: number;
      honestUserAgent?: boolean;
    }
  ) {
    this.concurrencyPoolSize = poolLimit;
    this.securityGuard = new PromptSecurityGuard();

    if (config) {
      if (config.mode) this.engineMode = config.mode;
      if (config.corsProxy !== undefined) this.corsProxy = config.corsProxy;
      if (config.pacingDelayMs !== undefined) this.pacingDelayMs = config.pacingDelayMs;
      if (config.honestUserAgent !== undefined) this.honestUserAgent = config.honestUserAgent;
    }
  }

  private writeLog(msg: string) {
    console.log(`[Engine] ${msg}`);
    if (this.onLog) {
      this.onLog(msg);
    }
  }

  /**
   * Boots the native ONNX prompt guard classifier.
   * Leverages WebGPU in browser windows; maps to Node/Bun CPU/WASM bindings on desktop runtimes.
   */
  public async initClassifier(
    onProgress?: (percent: number, message: string) => void
  ): Promise<void> {
    this.writeLog("Initializing Prompt Security Guard ONNX Model...");
    await this.securityGuard.initialize((percent, text) => {
      if (onProgress) {
        onProgress(percent, text);
      }
    });
    this.classifierInitialized = this.securityGuard.getStatus().status === "loaded";
    const mode = this.classifierInitialized ? "NATIVE TF CORE" : "LOCAL EXPERT SYSTEM";
    this.writeLog(`Prompt Guard active in [${mode}] mode.`);
  }

  /**
   * Safe getter for model loading status
   */
  public getClassifierStatus() {
    return this.securityGuard.getStatus();
  }

  /**
   * Safe browser-friendly cross-origin fetch helper that handles CORS proxy chains sequentially.
   * Avoids forbidden headers to prevent throwing TypeError or failing CORS preflight OPTIONS in the browser.
   */
  private async safeBrowserFetch(targetUrl: string, taskIndex: number = 0): Promise<string> {
    // 1. Direct CORS-friendly native API bypass for English Wikipedia pages
    if (targetUrl.includes("wikipedia.org/wiki/")) {
      try {
        const parts = targetUrl.split("/wiki/");
        const title = parts[parts.length - 1];
        const apiQuery = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${title}&format=json&origin=*`;
        this.writeLog(`[SafeBrowserFetch] Wikipedia URL detected. Querying native CORS-friendly Wikipedia API: ${apiQuery}`);
        const apiResponse = await fetch(apiQuery);
        if (apiResponse.ok) {
          const apiJson = await apiResponse.json();
          const pages = apiJson.query?.pages;
          if (pages) {
            const pageId = Object.keys(pages)[0];
            const extract = pages[pageId]?.extract;
            if (extract && extract.length > 50) {
              this.writeLog(`[SafeBrowserFetch] Wikipedia native API populated successfully (${extract.length} chars).`);
              return `<html><head><title>${decodeURIComponent(title)}</title></head><body>${extract}</body></html>`;
            }
          }
        }
      } catch (err: any) {
        this.writeLog(`[SafeBrowserFetch] Native Wikipedia API fetch failed: ${err.message}. Cascading to CORS proxies...`);
      }
    }

    const baseProxies = [
      this.corsProxy, // Selection from config
      "https://corsproxy.io/?url=",
      "https://api.allorigins.win/raw?url=",
      "https://api.allorigins.win/get?url=", // JSON wrapper fallback (extremely stable!)
      "https://api.codetabs.com/v1/proxy?quest=",
      "" // Direct fetch fallback (some sites enable CORS natively!)
    ].filter((p, index, self) => p !== undefined && self.indexOf(p) === index);

    // Rotate proxy order based on taskIndex to load balance across proxies!
    const rotateOffset = taskIndex > 0 ? (taskIndex % baseProxies.length) : Math.floor(Math.random() * baseProxies.length);
    const proxies = [
      ...baseProxies.slice(rotateOffset),
      ...baseProxies.slice(0, rotateOffset)
    ];

    let lastError: any = null;

    for (const proxy of proxies) {
      let fullUrl = "";
      if (!proxy) {
        // Direct fetch fallback
        fullUrl = targetUrl;
        this.writeLog(`[SafeBrowserFetch] Contacting target URL directly without proxy: ${fullUrl}`);
      } else if (proxy.includes("?")) {
        if (proxy.endsWith("=") || proxy.endsWith("&")) {
          fullUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
        } else {
          fullUrl = `${proxy}&url=${encodeURIComponent(targetUrl)}`;
        }
        this.writeLog(`[SafeBrowserFetch] Contacting CORS proxy with parameter: ${proxy}`);
      } else {
        fullUrl = `${proxy}${proxy.endsWith("/") ? "" : "/"}${encodeURIComponent(targetUrl)}`;
        this.writeLog(`[SafeBrowserFetch] Contacting CORS proxy prefix: ${proxy}`);
      }

      try {
        const response = await fetch(fullUrl, {
          headers: {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(10000)
        });

        if (response.ok) {
          const rawText = await response.text();
          let html = rawText;
          if (rawText.trim().startsWith("{") && rawText.includes('"contents"')) {
            try {
              const parsed = JSON.parse(rawText);
              html = parsed.contents || "";
            } catch {}
          }
          if (html.length > 10) {
            this.writeLog(`[SafeBrowserFetch] Success! Downloaded ${html.length} chars via proxy.`);
            return html;
          }
        } else {
          this.writeLog(`[SafeBrowserFetch] Proxy ${proxy || "Direct"} returned status ${response.status}`);
        }
      } catch (err: any) {
        this.writeLog(`[SafeBrowserFetch] Failed proxy lookup via ${proxy || "Direct"}: ${err.message}`);
        lastError = err;
      }
    }

    throw new Error(`All fallback CORS proxies exhausted. Last error: ${lastError?.message || "Unknown proxy error"}`);
  }

  /**
   * Uses the free DuckDuckGo features/proxies (or CORS-friendly fallbacks) to fetch target URLs.
   */
  public async searchDuckDuckGo(keywords: string, maxResults: number = 5): Promise<string[]> {
    this.writeLog(`Initiating web search queries for keyword phrase: "${keywords}"`);
    
    if (this.engineMode === "github-pages") {
      this.writeLog(`[GitHub Pages / Static Mode] Attempting whole-net search via CORS proxy cascade...`);
      
      let nonWikiUrls: string[] = [];
      let wikiUrls: string[] = [];

      const processHtmlPage = (htmlText: string) => {
        // Robust regex matching normal and escaped double/single quotes
        const regex = /href\s*=\s*\\?["']([^\\"']+?)\\?["']/gi;
        let match;
        while ((match = regex.exec(htmlText)) !== null) {
          const href = match[1];
          if (!href) continue;

          let resolvedUrl: string | null = null;
          
          // Try decoding 'uddg=' or '?u=' if it's a redirect / proxy url
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
            } catch {}
          } else if (href.includes("?u=")) {
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
            } catch {}
          } else if (href.startsWith("http") && !href.includes("duckduckgo.com")) {
            resolvedUrl = href;
          }

          if (resolvedUrl) {
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

      try {
        const ddgUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(keywords)}`;
        const html = await this.safeBrowserFetch(ddgUrl, Math.floor(Math.random() * 100));
        processHtmlPage(html);
      } catch (err: any) {
        this.writeLog(`[Static Search] Stage 1 - DuckDuckGo Lite via proxy failed: ${err.message}`);
      }

      if (nonWikiUrls.length === 0) {
        try {
          const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keywords)}`;
          const html = await this.safeBrowserFetch(ddgUrl, Math.floor(Math.random() * 100));
          processHtmlPage(html);
        } catch (err: any) {
          this.writeLog(`[Static Search] Stage 2 - DuckDuckGo HTML via proxy failed: ${err.message}`);
        }
      }

      const combined = [...nonWikiUrls, ...wikiUrls].slice(0, maxResults);
      if (combined.length > 0) {
        this.writeLog(`[Static Search] Web Search resolved successfully via CORS proxy. Found ${combined.length} URLs.`);
        return combined;
      }

      this.writeLog(`[Static Search] Whole-web lookup via proxy returned 0 results. Trying full-text Wikipedia Search API fallback...`);
      try {
        const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keywords)}&utf8=1&format=json&origin=*&limit=${maxResults}`;
        const response = await fetch(wikiSearchUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.query && data.query.search && Array.isArray(data.query.search)) {
            const urls = data.query.search.map((item: any) => 
              `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`
            ).filter((link: string) => link.startsWith("http"));
            
            if (urls.length > 0) {
              this.writeLog(`[Static Search] Wikipedia Full-Text Search returned ${urls.length} relevant articles.`);
              return urls;
            }
          }
        }
      } catch (err: any) {
        this.writeLog(`[Static Search Error] Wikipedia full-text search API aborted: ${err.message}`);
      }

      this.writeLog(`[Static Search] Wikipedia Full-text Search returned 0 results. Falling back to native Wikipedia OpenSearch...`);
      try {
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&origin=*&search=${encodeURIComponent(keywords)}&limit=${maxResults}&namespace=0&format=json`;
        const response = await fetch(wikiUrl);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data[3] && Array.isArray(data[3])) {
            const urls = data[3].filter((link: any) => typeof link === "string" && link.startsWith("http"));
            this.writeLog(`[Static Search] Found ${urls.length} relevant Wikipedia pages for keywords: "${keywords}"`);
            if (urls.length > 0) {
              return urls;
            }
          }
        }
      } catch (err: any) {
        this.writeLog(`[Static Search Error] Local opensearch lookup failed: ${err.message}`);
      }
      return [
        "https://en.wikipedia.org/wiki/Web_scraping",
        "https://en.wikipedia.org/wiki/Prompt_engineering",
        "https://en.wikipedia.org/wiki/Large_language_model"
      ];
    }

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ keywords, maxResults, honestUserAgent: this.honestUserAgent })
      });

      if (!response.ok) {
        throw new Error(`Proxy search endpoint responded with status: ${response.status}`);
      }

      const data = await response.json();
      this.writeLog(`Search resolved (${data.methodUsed}). Found ${data.urls?.length || 0} candidate addresses.`);
      return data.urls || [];
    } catch (e: any) {
      this.writeLog(`Network Search Exception: ${e.message}. Falling back to default addresses.`);
      return [
        "https://en.wikipedia.org/wiki/Web_scraping",
        "https://en.wikipedia.org/wiki/Prompt_engineering"
      ];
    }
  }

  /**
   * Dual-stage sliding character metric and word density validator.
   * Separates syntax strings from readable English prose without using browser DOM APIs.
   */
  public extractEnglishProse(rawHtml: string): string {
    return extractEnglishProse(rawHtml);
  }

  /**
   * Orchestrates the 512-token rolling window inference execution loop with 50% stride overlap.
   * Guarantees inspection of 100% of the text.
   */
  public async scanPromptSecurity(
    text: string
  ): Promise<{ isSecure: boolean; maxScore: number; flaggedCount: number }> {
    const result = await this.securityGuard.scanPromptSecurity(text);
    return {
      isSecure: result.isSecure,
      maxScore: result.maxScore,
      flaggedCount: result.flaggedCount
    };
  }

  /**
   * Orchestrates parallel batch downloading using a strict task queue to maintain pool constraints.
   * Handles JSON node iterations and single keyword entries uniformly.
   */
  public async executeFullPass(input: string | SearchNode[]): Promise<ExtractionResult> {
    const sessionId = "sess_" + Math.random().toString(36).substring(2, 9).toUpperCase();
    const timestamp = Date.now();
    this.writeLog(`<<< starting session pass [id: ${sessionId}] >>>`);

    let searchNodes: SearchNode[] = [];

    // Parse input uniformly
    if (typeof input === "string") {
      this.writeLog("Reading multi-line plaintext input phrases...");
      const lines = input.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      searchNodes = lines.map(line => ({
        keywords: [line],
        maxResults: 4 // default result size for text inputs
      }));
    } else if (Array.isArray(input)) {
      this.writeLog(`Parsing structured SearchNode layout array of scale: ${input.length}`);
      searchNodes = input;
    } else {
      throw new Error("Invalid engineering argument format passed to executeFullPass.");
    }

    if (searchNodes.length === 0) {
      this.writeLog("Warning - No query actions detected in active input node sets.");
      return { sessionId, timestamp, payload: [] };
    }

    // Step 1: Sequential URL extraction across all search nodes
    interface QueuedPageTask {
      url: string;
      keywordOrigin: string;
    }
    const pageTasks: QueuedPageTask[] = [];

    for (const node of searchNodes) {
      const mergedQuery = node.keywords.join(" ");
      if (!mergedQuery) continue;
      this.writeLog(`Retrieving target assets for: [Keywords: "${mergedQuery}"]...`);
      const detectedUrls = await this.searchDuckDuckGo(mergedQuery, node.maxResults);
      for (const url of detectedUrls) {
        pageTasks.push({ url, keywordOrigin: mergedQuery });
      }
    }

    this.writeLog(`Queue built. Total URLs scheduled for purification: ${pageTasks.length}`);
    this.writeLog(`[Semaphore Invariant Check] Maximum Pool Capacity P_max = ${this.concurrencyPoolSize}`);

    const scrapedArticles: ScrapedArticle[] = [];
    let completedCount = 0;

    // Step 2: Strict Asynchronous Queue Concurrency Worker Loop
    const executeTask = async (task: QueuedPageTask, taskIndex: number): Promise<void> => {
      this.activeWorkers++;
      this.writeLog(`[Semaphore Invariant] Active workers W_active incremented to ${this.activeWorkers} (P_max limit: ${this.concurrencyPoolSize})`);
      
      // Ethical Pacing Delay: wait before processing if specified and not first task
      if (this.pacingDelayMs > 0 && taskIndex > 1) {
        this.writeLog(`[Node #${taskIndex}] Ethical pacing active: waiting ${this.pacingDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.pacingDelayMs));
      }

      this.writeLog(`[Node #${taskIndex}] Accessing page blob: ${task.url}`);

      try {
        let htmlContent = "";

        if (this.engineMode === "github-pages") {
          this.writeLog(`[Node #${taskIndex}] [Static Mode] Crawling via unsafe-free proxy cascade: ${task.url}`);
          htmlContent = await this.safeBrowserFetch(task.url);
        } else {
          // Full-stack mode via local Express crawler API routing
          const response = await fetch("/api/fetch-raw", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: task.url, honestUserAgent: this.honestUserAgent })
          });

          if (!response.ok) {
            throw new Error(`Proxy crawler pipeline returned status check ${response.status}`);
          }

          const data = await response.json();
          htmlContent = data.content || "";
        }

        this.writeLog(`[Node #${taskIndex}] Blob loaded successfully. Length: ${htmlContent.length} chars. Purifying markup...`);

        // Heuristics purification stage
        const cleanProse = this.extractEnglishProse(htmlContent);
        this.writeLog(`[Node #${taskIndex}] Prose distillation completed. Original: ${htmlContent.length} bytes -> Distilled Prose: ${cleanProse.length} characters.`);

        // Prompt security scan stage
        this.writeLog(`[Node #${taskIndex}] Starting sliding token safety scan on purified prose...`);
        const security = await this.scanPromptSecurity(cleanProse);
        this.writeLog(`[Node #${taskIndex}] Security results: ${security.isSecure ? "SECURE" : "WARNING - THREAT FLAG"} (Max Threat Score: ${security.maxScore}, Flagged Windows: ${security.flaggedCount})`);

        scrapedArticles.push({
          index: taskIndex,
          sourceUrl: task.url,
          keywordOrigin: task.keywordOrigin,
          cleanText: cleanProse || "No high-quality readable English prose found on this page.",
          securityMetrics: {
            isSecure: security.isSecure,
            maliciousPromptScore: security.maxScore,
            flaggedWindowCount: security.flaggedCount
          }
        });
      } catch (err: any) {
        this.writeLog(`[Node #${taskIndex}] Extraction Pipeline Exception on ${task.url}: ${err.message}`);
        this.writeLog(`[Node #${taskIndex}] Skipping URL to prevent connection error clutter in output panel.`);
      } finally {
        this.activeWorkers--;
        completedCount++;
        this.writeLog(`[Semaphore Invariant] Active workers W_active decremented to ${this.activeWorkers}. Progress: ${completedCount}/${pageTasks.length}`);
      }
    };

    // Parallel execution pool controller (Strict Queue Loop)
    let poolIndex = 0;
    const poolWorkers: Promise<void>[] = [];

    const workerLoop = async () => {
      while (poolIndex < pageTasks.length) {
        const currentTaskIdx = poolIndex++;
        const targetTask = pageTasks[currentTaskIdx];
        await executeTask(targetTask, currentTaskIdx + 1);
      }
    };

    // Distribute initial worker slots keeping W_active <= P_max
    const initialWorkersCount = Math.min(this.concurrencyPoolSize, pageTasks.length);
    for (let i = 0; i < initialWorkersCount; i++) {
      poolWorkers.push(workerLoop());
    }

    // Wait until all parallel pathways converge back safely
    await Promise.all(poolWorkers);

    // Sort by original sequential indexes to keep final arrays neat
    scrapedArticles.sort((a, b) => a.index - b.index);

    this.writeLog(`<<< pass completed [id: ${sessionId}]. Processed ${scrapedArticles.length} documents. >>>`);
    return {
      sessionId,
      timestamp,
      payload: scrapedArticles
    };
  }
}
