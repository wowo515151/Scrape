import React, { useEffect, useRef } from "react";
import { Terminal, Shield, RefreshCw, Trash2, Code } from "lucide-react";

interface TerminalLoggerProps {
  logs: string[];
  onClear: () => void;
  activeCount: number;
  poolLimit: number;
}

export default function TerminalLogger({
  logs,
  onClear,
  activeCount,
  poolLimit
}: TerminalLoggerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Automatically scroll terminal to the bottom on new receipt of trace items
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col border border-neutral-300 rounded-lg bg-neutral-900 text-neutral-100 shadow-sm overflow-hidden h-64 md:h-[320px]">
      {/* Logger Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-neutral-300">
            SYSTEM_EXECUTION_TRACE_LOGS
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Active worker load metrics badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-neutral-900 border border-neutral-850 font-mono text-[10px]">
            <Code className="w-3 h-3 text-cyan-400" />
            <span className="text-neutral-400">Queue Load: </span>
            <span className={activeCount > 0 ? "text-cyan-400 font-bold" : "text-neutral-500"}>
              {activeCount} / {poolLimit}
            </span>
          </div>
          
          <button
            onClick={onClear}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Clear Terminal Logs"
            id="clear_terminal_btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Logger Feed Area */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1.5 scroll-smooth select-text"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-neutral-500 h-full text-center space-y-1">
            <p className="animate-pulse">_ IDLE - Awaiting Pass Sequence trigger</p>
            <p className="text-[10px] text-neutral-600">Select input nodes and press "Run Pass Sequence"</p>
          </div>
        ) : (
          <>
            {logs.map((log, index) => {
              // Context-specific coloring patterns
              let lineClass = "text-neutral-300";
              if (log.includes("SECURE") || log.includes("resolved") || log.includes("completed")) {
                lineClass = "text-emerald-400";
              } else if (log.includes("Exception") || log.includes("failed") || log.includes("Warning")) {
                lineClass = "text-rose-400 font-medium";
              } else if (log.includes("WARNING - THREAT")) {
                lineClass = "text-amber-400 font-semibold underline decoration-wavy";
              } else if (log.includes("Semaphore Invariant")) {
                lineClass = "text-cyan-400";
              } else if (log.includes("<<<")) {
                lineClass = "text-yellow-400 font-bold tracking-tight";
              }

              return (
                <div key={index} className={`${lineClass} border-l-2 border-transparent hover:border-neutral-700 pl-1.5 transition-all duration-75`}>
                  <span className="text-neutral-600 mr-2 select-none">[{index + 1}]</span>
                  <span>{log}</span>
                </div>
              );
            })}
            
            {/* Blinking system active cursor */}
            <div className="flex items-center text-neutral-400 animate-pulse pt-1">
              <span>_</span>
              <span className="w-1.5 h-3 bg-neutral-400 ml-1 block animate-[ping_1.2s_infinite]"></span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
