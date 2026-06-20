import React, { useState } from "react";
import { Play, FileText, Settings2, Sparkles, HelpCircle, AlertCircle } from "lucide-react";
import { SearchNode } from "../utils/ScrapeEngine";

interface ControlCenterProps {
  onRunEngine: (input: string | SearchNode[]) => void;
  isLoading: boolean;
  poolLimit: number;
  onPoolLimitChange: (limit: number) => void;
  onnxStatus: { status: string; message: string; percent: number };
  onWarmUpModel: () => void;
  engineMode: "fullstack" | "github-pages";
  onEngineModeChange: (mode: "fullstack" | "github-pages") => void;
  corsProxy: string;
  onCorsProxyChange: (proxy: string) => void;
  pacingDelayMs: number;
  onPacingDelayMsChange: (delay: number) => void;
  honestUserAgent: boolean;
  onHonestUserAgentChange: (honest: boolean) => void;
  isBackendAvailable: boolean | null;
}

const PLAIN_SAMPLE = `alphabet artificial intelligence growth revenue
nvidia hardware infrastructure pipeline chips
microsoft open ai cloud partnership revenue
anthropic claude enterprise scaling expansion`;

const JSON_SAMPLE = `[
  { "keywords": ["nvidia AI market share forecast quarterly"], "maxResults": 3 },
  { "keywords": ["alphabet cloud computing AI growth figures"], "maxResults": 2 }
]`;

export default function ControlCenter({
  onRunEngine,
  isLoading,
  poolLimit,
  onPoolLimitChange,
  onnxStatus,
  onWarmUpModel,
  engineMode,
  onEngineModeChange,
  corsProxy,
  onCorsProxyChange,
  pacingDelayMs,
  onPacingDelayMsChange,
  honestUserAgent,
  onHonestUserAgentChange,
  isBackendAvailable
}: ControlCenterProps) {
  const [inputType, setInputType] = useState<"text" | "json">("text");
  const [inputValue, setInputValue] = useState<string>(PLAIN_SAMPLE);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleTypeChange = (type: "text" | "json") => {
    setInputType(type);
    setInputValue(type === "text" ? PLAIN_SAMPLE : JSON_SAMPLE);
    setValidationError(null);
  };

  const handleValidateAndSubmit = () => {
    setValidationError(null);

    if (!inputValue.trim()) {
      setValidationError("Input value is empty. Please enter queries or JSON nodes.");
      return;
    }

    if (inputType === "json") {
      try {
        const parsed = JSON.parse(inputValue);
        if (!Array.isArray(parsed)) {
          throw new Error("JSON root element must be a list/array of nodes.");
        }
        for (const item of parsed) {
          if (!item.keywords || !Array.isArray(item.keywords)) {
            throw new Error("Each search node must have a 'keywords' list/string array.");
          }
          if (typeof item.maxResults !== "number") {
            throw new Error("Each search node must define 'maxResults' as a positive number.");
          }
        }
        onRunEngine(parsed as SearchNode[]);
      } catch (err: any) {
        setValidationError(`Invalid SearchNode JSON Block: ${err.message}`);
      }
    } else {
      onRunEngine(inputValue);
    }
  };

  return (
    <div className="flex flex-col gap-5 border border-neutral-200 bg-white p-5 rounded-xl shadow-xs">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-neutral-600" />
          <h2 className="font-display font-semibold text-neutral-800 text-sm tracking-tight uppercase">
            Ingestion & Engine Tuning
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 cursor-help" title="Configures input queue feeds and thread limits" />
        </div>
      </div>

      {/* Model status bar indicator */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-3.5 text-xs">
        <div className="flex items-center justify-between font-mono mb-2">
          <div className="flex items-center gap-1.5 font-sans font-medium text-neutral-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI Detector (Prompt Guard 86M)</span>
          </div>
          <div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
              onnxStatus.status === "loaded" 
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : onnxStatus.status === "loading"
                ? "bg-amber-100 text-amber-800 border border-amber-200 animate-pulse"
                : onnxStatus.status === "failed"
                ? "bg-neutral-200 text-neutral-700 border border-neutral-300"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}>
              {onnxStatus.status}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-neutral-500 leading-normal font-mono mb-2.5">
          {onnxStatus.message}
        </p>

        {onnxStatus.status === "loading" && (
          <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1.5 transition-all duration-300" style={{ width: `${onnxStatus.percent}%` }}></div>
          </div>
        )}

        {onnxStatus.status === "unloaded" && (
          <button
            onClick={onWarmUpModel}
            className="w-full py-1.5 px-3 rounded-md bg-neutral-950 hover:bg-neutral-850 text-white font-medium text-[11px] transition-colors focus:outline-none"
            id="warm_up_model_btn"
          >
            Warm Up Native Transformers.js Model (~170MB)
          </button>
        )}
      </div>

      {/* Dynamic concurrency slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-neutral-500">Concurrency Pool limit (P_max)</span>
          <span className="font-bold text-neutral-800">{poolLimit} workers</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="12"
            value={poolLimit}
            onChange={(e) => onPoolLimitChange(parseInt(e.target.value))}
            className="flex-1 accent-neutral-900 cursor-ew-resize h-1 bg-neutral-100 rounded-lg appearance-none"
            disabled={isLoading}
            id="pool_limit_range"
          />
          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded select-none">
            MAX_BOUND
          </span>
        </div>
        <p className="text-[10.5px] text-neutral-400 leading-normal">
          Protects socket allocations and prevents DDG search blockades. Let $W \le P_{'{max}'}$.
        </p>
      </div>

      {/* Ethical & Deployment Settings Section */}
      <div className="border-t border-b border-neutral-100 py-4 space-y-4">
        <label className="block text-xs font-mono text-neutral-500 uppercase tracking-wider font-semibold">
          🛡️ Deployment & Ethical Policies
        </label>
            {/* Toggle between Full-Stack Express and GitHub Pages Mode */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="block text-[11px] font-medium text-neutral-700">Deployment Hosting Target</span>
            {isBackendAvailable === false && (
              <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 uppercase animate-pulse">
                Offline (Static Forced)
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-md bg-neutral-100 text-[11px]">
            <button
              type="button"
              disabled={isBackendAvailable === false}
              onClick={() => onEngineModeChange("fullstack")}
              className={`py-1 rounded font-mono transition-all focus:outline-none ${
                isBackendAvailable === false
                  ? "bg-neutral-200/50 text-neutral-400 cursor-not-allowed"
                  : engineMode === "fullstack"
                  ? "bg-white text-neutral-900 shadow-3xs font-medium cursor-pointer"
                  : "text-neutral-500 hover:text-neutral-900 cursor-pointer"
              }`}
              id="mode_fullstack_btn"
              title={isBackendAvailable === false ? "Full-Stack Express backend is not available on this static domain." : "Express backend routing proxy"}
            >
              Express (Full-Stack)
            </button>
            <button
              type="button"
              onClick={() => onEngineModeChange("github-pages")}
              className={`py-1 rounded font-mono transition-all focus:outline-none ${
                engineMode === "github-pages"
                  ? "bg-white text-neutral-900 shadow-3xs font-medium cursor-pointer"
                  : "text-neutral-500 hover:text-neutral-900 cursor-pointer"
              }`}
              id="mode_ghpages_btn"
            >
              GitHub Pages (Static)
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 leading-normal">
            {isBackendAvailable === false 
              ? "100% serverless static client forced because the custom Express backend is unreachable on this deployment domain."
              : engineMode === "fullstack" 
              ? "Routes queries and fetch requests safely through standard backend proxies."
              : "100% serverless/static client. Fallbacks search queries directly on Wikipedia, fetches html via a CORS-anywhere proxy."}
          </p>
        </div>

        {/* CORS Proxy input (Only shown when static/github pages option is selected) */}
        {engineMode === "github-pages" && (
          <div className="space-y-1.5">
            <span className="block text-[11px] font-medium text-neutral-700">Client-Side CORS Proxy Prefix</span>
            <div className="flex gap-2">
              <input
                type="text"
                value={corsProxy}
                onChange={(e) => onCorsProxyChange(e.target.value)}
                className="flex-1 p-1.5 bg-neutral-50 font-mono text-[10px] border border-neutral-200 rounded-md focus:outline-none focus:bg-white"
                placeholder="https://api.allorigins.win/raw?url="
                id="cors_proxy_input"
              />
              <select
                value={corsProxy}
                onChange={(e) => onCorsProxyChange(e.target.value)}
                className="p-1 px-1.5 font-sans text-[10px] border border-neutral-200 rounded-md bg-white focus:outline-none"
              >
                <option value="https://api.allorigins.win/raw?url=">AllOrigins</option>
                <option value="https://corsproxy.io/?url=">CorsProxy.io</option>
                <option value="https://api.codetabs.com/v1/proxy?quest=">CodeTabs</option>
                <option value="">(None - Direct)</option>
              </select>
            </div>
            <p className="text-[9.5px] text-neutral-400 leading-normal">
              Bypasses CORS cross-origin blocks directly in the user browser when hosted on a static domain.
            </p>
          </div>
        )}

        {/* Honest Bot Identity / User Agent Option */}
        <div className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
          <div className="space-y-0.5">
            <span className="block text-[11px] font-medium text-neutral-800">Honest ScrapeEngine Identity</span>
            <p className="text-[9.5px] text-neutral-400 leading-normal">
              Politely identifies the crawler as <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-600 text-[9px]">ScrapeEngine/1.0</code> with contact email, rather than fake user-agents.
            </p>
          </div>
          <input
            type="checkbox"
            checked={honestUserAgent}
            onChange={(e) => onHonestUserAgentChange(e.target.checked)}
            className="w-4 h-4 accent-neutral-950 rounded cursor-pointer mt-1"
            id="honest_ua_checkbox"
          />
        </div>

        {/* Ethical pacing delay throttle */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-neutral-500 font-medium">Crawl Pacing Delay</span>
            <span className="font-bold text-neutral-800">{pacingDelayMs} ms</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5000"
              step="250"
              value={pacingDelayMs}
              onChange={(e) => onPacingDelayMsChange(parseInt(e.target.value))}
              className="flex-1 accent-neutral-900 cursor-ew-resize h-1 bg-neutral-100 rounded appearance-none"
              id="pacing_delay_range"
            />
          </div>
          <p className="text-[10px] text-neutral-400 leading-normal">
            Sequentially paces target downloads to avoid overloading hosts. Standard polite spider pacing.
          </p>
        </div>
      </div>

      {/* Input format selectors */}
      <div className="space-y-3">
        <label className="block text-xs font-mono text-neutral-500">
          Source Ingestion Feed Format
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-neutral-100 text-xs">
          <button
            onClick={() => handleTypeChange("text")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors focus:outline-none ${
              inputType === "text"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
            id="input_type_text_btn"
          >
            <FileText className="w-3.5 h-3.5" />
            Plain Phrases
          </button>
          <button
            onClick={() => handleTypeChange("json")}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-colors focus:outline-none ${
              inputType === "json"
                ? "bg-white text-neutral-900 shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
            id="input_type_json_btn"
          >
            <span>{"{ }"}</span>
            SearchNode JSON
          </button>
        </div>

        <div className="relative">
          <textarea
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setValidationError(null);
            }}
            placeholder={
              inputType === "text"
                ? "Enter keywords (one phrased query per line)..."
                : "Enter structured JSON Search Nodes list..."
            }
            className="w-full h-44 p-3 bg-neutral-50 font-mono text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 focus:bg-white resize-none"
            disabled={isLoading}
            id="raw_queries_input"
          />
          
          <div className="absolute right-2 bottom-3 flex gap-1.5 select-none text-[10px]">
            <button
              onClick={() => {
                setInputValue(inputType === "text" ? PLAIN_SAMPLE : JSON_SAMPLE);
                setValidationError(null);
              }}
              className="px-2 py-1 border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 rounded transition-colors shadow-2xs focus:outline-none"
              title="Reset input with template"
              id="reset_input_btn"
            >
              Reset Sample
            </button>
          </div>
        </div>

        {validationError && (
          <div className="flex gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[11px] text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="font-mono">{validationError}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleValidateAndSubmit}
        disabled={isLoading}
        className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-neutral-950 hover:bg-neutral-850 text-white font-medium text-xs transition-colors shadow-md disabled:bg-neutral-200 disabled:text-neutral-400 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-neutral-950 focus:ring-offset-2 cursor-pointer"
        id="run_pass_sequence_btn"
      >
        <Play className={`w-4 h-4 fill-current ${isLoading ? "animate-ping" : ""}`} />
        <span className="font-display uppercase tracking-wider font-semibold">
          {isLoading ? "Running Pass Sequence..." : "Run Pass Sequence"}
        </span>
      </button>
    </div>
  );
}
