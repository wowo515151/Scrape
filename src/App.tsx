/**
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Scrape Engine Client Dashboard
 */

import React, { useState, useEffect, useRef } from "react";
import { Shield, Compass, Sparkles, Cpu, Layers, Linkedin } from "lucide-react";
import { ScrapeEngine, SearchNode, ScrapedArticle } from "./utils/ScrapeEngine";
import ControlCenter from "./components/ControlCenter";
import IntelligenceViewer from "./components/IntelligenceViewer";
import TerminalLogger from "./components/TerminalLogger";

export default function App() {
  const [poolLimit, setPoolLimit] = useState<number>(5);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [articles, setArticles] = useState<ScrapedArticle[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [activeWorkers, setActiveWorkers] = useState<number>(0);

  // New deployment target configuration (Support 100% Client-side/GitHub Pages)
  const [engineMode, setEngineMode] = useState<"fullstack" | "github-pages">("fullstack");
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean | null>(null);
  const [corsProxy, setCorsProxy] = useState<string>("https://api.allorigins.win/raw?url=");
  const [pacingDelayMs, setPacingDelayMs] = useState<number>(0);
  const [honestUserAgent, setHonestUserAgent] = useState<boolean>(true); // default to honest & ethical identification!

  // Keep a persistent single instance of ScrapeEngine
  const engineRef = useRef<ScrapeEngine | null>(null);

  // Poll backend availability on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          if (data && data.status === "healthy") {
            setIsBackendAvailable(true);
            setLogs((prev) => [
              ...prev,
              "[System] Connected: Secure Full-Stack Express backend detected at /api/health."
            ]);
            return;
          }
        }
        throw new Error("Invalid or offline response");
      } catch (err: any) {
        setIsBackendAvailable(false);
        setEngineMode("github-pages");
        setLogs((prev) => [
          ...prev,
          "[System Alert] Custom Express backend proxy is unreachable or offline. Defaulted to Client-Side Static mode in compliance with GitHub Pages hosting limits."
        ]);
      }
    };
    checkBackend();
  }, []);

  const [onnxStatus, setOnnxStatus] = useState({
    status: "unloaded",
    message: "ONNX ML Model awaiting initialization.",
    percent: 0
  });

  // Setup ScrapeEngine and listen to log events on mount
  useEffect(() => {
    const engine = new ScrapeEngine(poolLimit, {
      mode: engineMode,
      corsProxy,
      pacingDelayMs,
      honestUserAgent
    });
    engineRef.current = engine;

    // Connect logging channels to UI console feed
    engine.onLog = (msg) => {
      setLogs((prev) => [...prev, msg]);
    };

    setLogs([
      "System initialized.",
      "Dual-use Browser/Desktop Scrape Engine loaded.",
      "Input buffer is idle. Safe Expert heuristic matrix configured (Offline default)."
    ]);
  }, []);

  // Update engine concurrency cap when state slider updates
  useEffect(() => {
    if (engineRef.current) {
      // Re-initialize engine internal pool sizes and configurations
      const engine = new ScrapeEngine(poolLimit, {
        mode: engineMode,
        corsProxy,
        pacingDelayMs,
        honestUserAgent
      });
      engine.onLog = (msg) => {
        setLogs((prev) => [...prev, msg]);
      };
      
      // Keep model reference if loaded already
      if (onnxStatus.status === "loaded") {
        // Carry forward loaded classifier
        const oldEngine = engineRef.current as any;
        (engine as any).securityGuard = oldEngine.securityGuard;
        (engine as any).classifierInitialized = true;
      }
      
      engineRef.current = engine;
    }
  }, [poolLimit, engineMode, corsProxy, pacingDelayMs, honestUserAgent, onnxStatus.status]);

  // Warm-up callback for ONNX transformers model download
  const handleWarmUpModel = async () => {
    if (!engineRef.current) return;
    
    setLogs((prev) => [...prev, "Initiating ONNX pipeline download sequence..."]);
    setOnnxStatus({ status: "loading", message: "Loading Libraries...", percent: 10 });

    try {
      await engineRef.current.initClassifier((percent, message) => {
        setOnnxStatus({
          status: percent === 100 ? "loaded" : "loading",
          message,
          percent
        });
      });
    } catch (err: any) {
      setOnnxStatus({
        status: "failed",
        message: `ONNX bypass fallback: ${err.message}`,
        percent: 100
      });
    }
  };

  // Run the full execution pass inside a managed pool block
  const handleRunPassSequence = async (input: string | SearchNode[]) => {
    if (!engineRef.current) return;
    setIsLoading(true);
    setArticles([]);

    // Clear previous execution trace logs
    setLogs((prev) => [
      ...prev,
      "--- CLEARING CONSOLE TRACE FOR CURRENT HARVEST SEQUENCE PASS ---"
    ]);

    try {
      // Poll active workers to drive dynamic UI metrics
      const interval = setInterval(() => {
        if (engineRef.current) {
          const workers = (engineRef.current as any).activeWorkers || 0;
          setActiveWorkers(workers);
        }
      }, 150);

      const result = await engineRef.current.executeFullPass(input);
      
      clearInterval(interval);
      setActiveWorkers(0);
      setArticles(result.payload);
      setSessionId(result.sessionId);
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        `[Fatal Exception] Scrape Engine execution loop failed: ${err.message}`
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = () => {
    setLogs(["Console logs flushed. System ready."]);
  };

  return (
    <div className="min-h-screen bg-neutral-50/50 flex flex-col font-sans text-neutral-850">
      {/* Platform Branding Header */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-50 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 text-white shadow-sm flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400 stroke-[1.75]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-neutral-900 text-lg tracking-tight leading-none bg-linear-to-r from-neutral-900 to-neutral-700 bg-clip-text">
                  Scrape <span className="font-medium text-neutral-500">Engine</span>
                </h1>
                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-mono text-[9px] border border-amber-200 uppercase font-semibold">
                  v1.2 // Edge
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono mt-1">
                Zero-Server Textual Harvester & Client-Side Prompt Attack Guard
              </p>
            </div>
          </div>

          {/* Connected Engine Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-200 bg-white shadow-3xs text-[11px] font-mono text-neutral-600">
              <span className={`w-2 h-2 rounded-full ${isLoading ? "bg-cyan-500 animate-ping" : "bg-neutral-300"}`}></span>
              <span>Workers: <strong className="text-neutral-900">{activeWorkers} active</strong></span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-200 bg-white shadow-3xs text-[11px] font-mono text-neutral-600">
              {onnxStatus.status === "loaded" ? (
                <>
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Guard: <strong className="text-indigo-600">WebGPU/ONNX</strong></span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Guard: <strong className="text-neutral-500">Expert Rules</strong></span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* Two Pane Structural Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Pane: Parameter entry controls & output console trace logs */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <ControlCenter
              onRunEngine={handleRunPassSequence}
              isLoading={isLoading}
              poolLimit={poolLimit}
              onPoolLimitChange={setPoolLimit}
              onnxStatus={onnxStatus}
              onWarmUpModel={handleWarmUpModel}
              engineMode={engineMode}
              onEngineModeChange={setEngineMode}
              corsProxy={corsProxy}
              onCorsProxyChange={setCorsProxy}
              pacingDelayMs={pacingDelayMs}
              onPacingDelayMsChange={setPacingDelayMs}
              honestUserAgent={honestUserAgent}
              onHonestUserAgentChange={setHonestUserAgent}
              isBackendAvailable={isBackendAvailable}
            />

            <TerminalLogger
              logs={logs}
              onClear={handleClearLogs}
              activeCount={activeWorkers}
              poolLimit={poolLimit}
            />
          </div>

          {/* Right Pane: Process display workspace & safe bundle compilation exporter */}
          <div className="lg:col-span-7 h-full">
            <IntelligenceViewer
              articles={articles}
              sessionId={sessionId}
            />
          </div>

        </div>
      </main>

      {/* Humble Footer */}
      <footer className="border-t border-neutral-200 bg-white text-neutral-400 px-4 sm:px-6 py-4 text-xs font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <span>Scrape Engine Dual-Use Native Specification — Zero-Server Harvest Blueprint</span>
            <div className="flex items-center gap-1.5 text-neutral-500 mt-1">
              <span>Developer:</span>
              <a 
                href="https://linkedin.com/in/warren-harding-29a0a673" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline font-medium transition-colors"
                id="developer-linkedin-link"
              >
                <Linkedin className="w-3.5 h-3.5" />
                <span>Warren Harding</span>
              </a>
            </div>
          </div>
          <div className="text-neutral-400 text-[11px] sm:text-right">
            <span>Active Worker Load Cap (P_max) = {poolLimit} // System Status: healthy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
