import React, { useState } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Globe, 
  Hash, 
  FileCheck2, 
  BookOpen, 
  Info,
  ExternalLink
} from "lucide-react";
import { ScrapedArticle } from "../utils/ScrapeEngine";
// Complete synchronous compression bundle via fflate
import { zipSync, strToU8 } from "fflate";

interface IntelligenceViewerProps {
  articles: ScrapedArticle[];
  sessionId: string;
}

export default function IntelligenceViewer({ articles, sessionId }: IntelligenceViewerProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [autoExclude, setAutoExclude] = useState<boolean>(true);

  const totalCount = articles.length;
  const currentArticle = totalCount > 0 ? articles[activeIndex] : null;
  const threatArticlesCount = articles.filter(a => !a.securityMetrics.isSecure).length;

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex < totalCount - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  /**
   * Safe browser-side ZIP compilation of purified articles using the fflate package.
   */
  const handleZipDownload = () => {
    if (totalCount === 0) return;

    try {
      const zipArchiveData: Record<string, Uint8Array> = {};

      const exportableArticles = autoExclude
        ? articles.filter(art => art.securityMetrics.isSecure)
        : articles;

      if (exportableArticles.length === 0) {
        alert("Cannot compile ZIP: All downloaded files are flagged as high-threat, and the Auto-Exclusion Filter is currently active.");
        return;
      }

      exportableArticles.forEach((art, idx) => {
        const fileIndex = idx + 1;
        // Escape special chars from keyword for filename safety
        const safeKeyword = art.keywordOrigin
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .substring(0, 25);
        
        const fileName = `${fileIndex}_${safeKeyword}_Purified.txt`;

        // Output raw, clean purified text directly to minimize downstream token footprint
        const content = art.cleanText;

        // Convert string to bytes
        zipArchiveData[fileName] = strToU8(content);
      });

      // Synchronously compile standard ZIP buffer
      const archiveBytes = zipSync(zipArchiveData);
      
      // Package into Blob
      const zipBlob = new Blob([archiveBytes], { type: "application/zip" });
      
      // Trigger download
      const downloadAnchor = document.createElement("a");
      downloadAnchor.href = URL.createObjectURL(zipBlob);
      downloadAnchor.download = `Scrape_Engine_Pass_${sessionId || "001"}.zip`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(downloadAnchor.href);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full border border-neutral-200 bg-white rounded-xl shadow-xs overflow-hidden">
      {/* Viewer Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-neutral-600" />
          <h2 className="font-display font-semibold text-neutral-800 text-sm tracking-tight uppercase">
            Intelligence Console
          </h2>
        </div>
        
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Auto-Exclusion Filter Toggle */}
            <label className="inline-flex items-center gap-2 bg-neutral-100/80 hover:bg-neutral-200/50 border border-neutral-200/60 rounded px-2.5 py-1.5 text-[11px] font-mono text-neutral-600 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                checked={autoExclude}
                onChange={(e) => setAutoExclude(e.target.checked)}
                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                id="auto_exclusion_filter_checkbox"
              />
              <span className="font-semibold">Option A: Auto-Exclusion Filter</span>
            </label>

            <button
              onClick={handleZipDownload}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-2xs"
              id="download_verified_bundle_btn"
            >
              <Download className="w-3.5 h-3.5 animate-[bounce_1.5s_infinite]" />
              Download Verified Bundle (.ZIP)
            </button>
          </div>
        )}
      </div>

      {/* Prominent Scan Limitation Disclaimer */}
      {totalCount > 0 && (
        <div className="bg-amber-50/20 px-5 py-2.5 border-b border-neutral-200/50 flex flex-col md:flex-row md:items-center justify-between text-[11px] text-neutral-600 font-sans gap-3">
          <div className="flex items-start md:items-center gap-2 leading-relaxed">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 md:mt-0" />
            <span>
              <strong className="font-semibold text-neutral-800">Security Guard Disclaimer:</strong> Although harvested text is thoroughly scanned for prompt injection threats, these automated scans are <strong className="text-amber-800 underline">not 100% foolproof</strong>. There are <strong className="text-amber-800 underline">no guarantees</strong> of absolute safety. Always review extracted files before importing them into downstream LLM pipelines.
            </span>
          </div>
          <span className="shrink-0 text-amber-700 font-mono text-[9px] uppercase tracking-wider font-semibold select-none bg-amber-100/50 px-2 py-0.5 rounded border border-amber-200/40 self-start md:self-auto">
            Scans Not 100% Foolproof
          </span>
        </div>
      )}

      {/* Global Auto-Exclusion Notice Ribbon */}
      {totalCount > 0 && threatArticlesCount > 0 && (
        <div className={`px-5 py-2.5 text-xs font-mono border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${
          autoExclude 
            ? "bg-amber-50 text-amber-900 border-amber-100/70" 
            : "bg-rose-50 text-rose-900 border-rose-100"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm shrink-0">⚠️</span>
            <span>
              {autoExclude 
                ? `Auto-Exclusion active: ${threatArticlesCount} high-threat files will be automatically REMOVED before compiling the ZIP.`
                : `Security warning: ${threatArticlesCount} high-threat files are currently INCLUDED in the active ZIP compilation.`
              }
            </span>
          </div>
          <button 
            type="button"
            onClick={() => setAutoExclude(!autoExclude)}
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border transition-colors self-start sm:self-auto cursor-pointer ${
              autoExclude
                ? "bg-white hover:bg-amber-100 text-amber-800 border-amber-200"
                : "bg-white hover:bg-rose-100 text-rose-800 border-rose-200"
            }`}
            id="toggle_exclusion_policy_bttn"
          >
            {autoExclude ? "Disable Exclusion" : "Enable Auto-Exclusion"}
          </button>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-neutral-400 bg-neutral-50/20 h-[500px]">
          <FileCheck2 className="w-12 h-12 text-neutral-300 stroke-[1.25] mb-3" />
          <h3 className="font-sans font-medium text-neutral-800 text-sm mb-1">
            No Harvester Pass Active
          </h3>
          <p className="text-xs max-w-sm text-neutral-500 leading-normal">
            Adjust your thread pool limit, list target keywords, and click run on the ingestion panel to harvest distilled text.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Navigation Control Console (Status bar + navigation controls) */}
          <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-100 bg-neutral-100/30 text-xs font-mono text-neutral-500">
            <div className="flex items-center gap-1">
              <Hash className="w-3 text-neutral-400" />
              <span>Session UUID: </span>
              <span className="text-neutral-700">{sessionId}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <span>
                Page <strong className="text-neutral-800">{activeIndex + 1}</strong> of <strong className="text-neutral-800">{totalCount}</strong>
              </span>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  disabled={activeIndex === 0}
                  className="p-1 rounded bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Reverse page pointer"
                  id="reverse_document_ptr_btn"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={activeIndex === totalCount - 1}
                  className="p-1 rounded bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Forward page pointer"
                  id="forward_document_ptr_btn"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {currentArticle && (
            <>
              {/* Extraction Security Ribbon Check */}
              <div className={`px-5 py-3.5 border-b flex items-start gap-3 transition-colors duration-200 ${
                currentArticle.securityMetrics.isSecure 
                  ? "bg-emerald-50/40 border-emerald-100 text-emerald-900" 
                  : "bg-rose-50/60 border-rose-100 text-rose-950"
              }`}>
                {currentArticle.securityMetrics.isSecure ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold uppercase tracking-wider text-[10px]">
                      Security Scanning Verdict:
                    </span>
                    <span className={`px-1.5 py-0.2 rounded font-semibold text-[9px] uppercase ${
                      currentArticle.securityMetrics.isSecure ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                    }`}>
                      {currentArticle.securityMetrics.isSecure ? "purified and safe" : "threat detected"}
                    </span>
                  </div>

                  <div className="leading-relaxed">
                    {currentArticle.securityMetrics.isSecure ? (
                      <p>
                        This article is clean. Max overlapping token-slide adversarial score of{" "}
                        <strong className="font-mono text-emerald-700">{currentArticle.securityMetrics.maliciousPromptScore}</strong>.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="font-medium text-rose-900">
                          High prompt injection threat detected! Max overlapping token window score reached{" "}
                          <strong className="font-mono bg-rose-100 px-1 py-0.2 rounded text-rose-700">{currentArticle.securityMetrics.maliciousPromptScore}</strong>{" "}
                          across <strong className="underline">{currentArticle.securityMetrics.flaggedWindowCount}</strong> breached segment window scans. Do NOT process unchecked.
                        </p>
                        <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono font-medium border ${
                          autoExclude
                            ? "bg-amber-100/60 text-amber-900 border-amber-200"
                            : "bg-rose-100/60 text-rose-900 border-rose-200"
                        }`}>
                          <span className="shrink-0">{autoExclude ? "🛡️ Auto-Exclusion Alert:" : "⚠️ Security Warning:"}</span>
                          <span>{autoExclude ? "Excluded from the .ZIP package to protect downstream LLM loaders." : "This threat WILL be zipped because Auto-Exclusion is disabled."}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Document metadata info panel */}
              <div className="px-5 py-3 bg-neutral-50/50 border-b border-neutral-100 grid md:grid-cols-2 gap-2 text-xs text-neutral-500 font-mono">
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-400">URL:</span>
                  <a 
                    href={currentArticle.sourceUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-neutral-600 hover:text-indigo-600 truncate underline flex items-center gap-0.5"
                  >
                    {currentArticle.sourceUrl}
                    <ExternalLink className="w-2.5 h-2.5 inline shrink-0" />
                  </a>
                </div>
                <div className="flex items-center gap-2 overflow-hidden truncate">
                  <Hash className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-400">Node keywords:</span>
                  <span className="text-neutral-700 font-semibold truncate bg-neutral-200/55 px-1.5 py-0.5 rounded text-[11px]">
                    "{currentArticle.keywordOrigin}"
                  </span>
                </div>
              </div>

              {/* Main text pane workspace */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-neutral-50/20">
                <article className="max-w-2xl mx-auto prose prose-neutral">
                  <h1 className="font-display font-bold text-neutral-800 text-lg md:text-xl leading-snug tracking-tight mb-4 border-b border-neutral-100 pb-3">
                    Purified Content Distillation
                  </h1>

                  {/* Distinguished flowing text */}
                  <div className="font-sans text-neutral-700 text-sm leading-relaxed whitespace-pre-wrap selection:bg-indigo-100 select-text">
                    {currentArticle.cleanText}
                  </div>
                </article>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
