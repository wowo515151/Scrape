/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Prompt Security Guard - Client-Side Classifier Engine
 * Orchestrates 512-token sliding window scans with 50% stride overlap.
 */

// Injection semantic signatures for high-fidelity fallback recognition
const SEVERE_ATTACK_PATTERNS = [
  /\bignore\s+(?:all\s+)?(?:previous\s+)?instructions\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous\s+)?guidelines\b/i,
  /\bsystem\s+override\b/i,
  /\bunderneath\s+this\s+line\s+write\b/i,
  /\byou\s+are\s+now\s+in\s+developer\s+mode\b/i,
  /\bnew\s+protocol\s+initiated\b/i,
  /\bforget\s+(?:what\s+we\s+talked\s+about|your\s+system\s+prompt)\b/i,
  /\bx-prompt-injection\b/i,
  /\bdo\s+anything\s+now\b/i, // DAN
  /\bacting\s+as\s+an\s+unfiltered\b/i,
  /\bplease\s+reveal\s+your\s+system\s+instructions\b/i,
  /\bdump\s+your\s+pre-prompt\b/i,
  /\boutput\s+the\s+entire\s+instructions\s+above\b/i,
  /\btranscribe\s+the\s+preceding\s+text\b/i
];

const MODERATE_ATTACK_PATTERNS = [
  /\bignore\s+(?:the\s+)?rules\b/i,
  /\bdeveloper\s+console\s+override\b/i,
  /\binstruction\s+bypass\b/i,
  /\bjailbreak\b/i,
  /\bdo\s+not\s+leak\s+this\s+instruction\s+but\b/i,
  /\bstarting\s+now\s+you\b/i,
  /\bprint\s+the\s+system\s+configuration\b/i,
  /\bexecute\s+arbitrary\s+code\b/i,
  /\[system\s*(?:instruction|rule|prompt)\s*override\]/i,
  /assistant\s*:\s*ignore/i,
  /\bbase64\s+decode\b/i,
  /\bdecode\s+the\s+following\s+rot13\b/i
];

// Mild prompt engineering commands often found in scrapers that could be borderline
const MILD_ATTACK_PATTERNS = [
  /\bsimulate\s+a\b/i,
  /\broleplay\s+as\b/i,
  /\bpretend\s+you\s+are\b/i,
  /\bsecret\s+key\b/i,
  /\bapi_key\b/i
];

export interface ScanResult {
  isSecure: boolean;
  maxScore: number;
  flaggedCount: number;
  methodUsed: "ONNX Prompt-Guard-86M" | "Local Expert Security Heuristics";
}

export class PromptSecurityGuard {
  private model: any = null;
  private tokenizer: any = null;
  private initStatus: "unloaded" | "loading" | "loaded" | "failed" = "unloaded";
  private loadPercentage: number = 0;
  private loadStatusMessage: string = "";

  /**
   * Tries to boot the native ONNX prompt guard sequence classifier in the browser.
   */
  public async initialize(
    onProgress?: (percent: number, message: string) => void
  ): Promise<void> {
    if (this.initStatus === "loaded") return;
    this.initStatus = "loading";
    this.loadStatusMessage = "Loading Transformers.js library...";
    if (onProgress) onProgress(10, this.loadStatusMessage);

    try {
      // Dynamic import to prevent bundler failures if packages are uncooperative
      const { pipeline, AutoTokenizer, env } = await import("@huggingface/transformers");

      // Configure local caching and allow loading of models dynamically
      env.allowLocalModels = false;

      this.loadStatusMessage = "Loading onnx-community/Prompt-Guard-86M (~170MB Compressed)...";
      if (onProgress) onProgress(30, this.loadStatusMessage);

      // Initialize the text classification pipeline
      this.model = await pipeline(
        "text-classification",
        "onnx-community/Prompt-Guard-86M",
        {
          progress_callback: (info: any) => {
            if (info.status === "downloading" && info.progress) {
              const loadedMb = (info.loaded / (1024 * 1024)).toFixed(1);
              const totalMb = info.total ? (info.total / (1024 * 1024)).toFixed(1) : "?";
              this.loadPercentage = Math.min(30 + Math.floor(info.progress * 60), 90);
              this.loadStatusMessage = `Downloading weights: ${loadedMb}MB / ${totalMb}MB (${Math.round(info.progress * 100)}%)`;
              if (onProgress) onProgress(this.loadPercentage, this.loadStatusMessage);
            } else if (info.status === "done") {
              this.loadStatusMessage = `Initializing WebAssembly ONNX inference runtime...`;
              if (onProgress) onProgress(92, this.loadStatusMessage);
            }
          }
        }
      );

      // Grab tokenizer in case we want strict custom token counting
      this.tokenizer = await AutoTokenizer.from_pretrained("onnx-community/Prompt-Guard-86M");

      this.initStatus = "loaded";
      this.loadStatusMessage = "ONNX Prompt Guard active (Hardware WebGPU/WASM accelerated).";
      if (onProgress) onProgress(100, this.loadStatusMessage);
    } catch (err: any) {
      console.warn("ONNX Prompt-Guard loading failed (likely blocked by iframe sandbox or network constraints). Graceful Expert System heuristic fallback active.", err.message);
      this.initStatus = "failed";
      this.loadStatusMessage = `Using Local Expert Security Heuristics (ONNX bypassed: ${err.message})`;
      if (onProgress) onProgress(100, this.loadStatusMessage);
    }
  }

  public getStatus() {
    return {
      status: this.initStatus,
      message: this.loadStatusMessage,
      percent: this.loadPercentage
    };
  }

  /**
   * Orchestrates the 512-token rolling window inference execution loop with 50% stride overlap.
   * Ensures complete inspection of the text.
   */
  public async scanPromptSecurity(
    text: string, 
    safetyThreshold: number = 0.5
  ): Promise<ScanResult> {
    if (!text || text.trim().length === 0) {
      return { isSecure: true, maxScore: 0, flaggedCount: 0, methodUsed: "Local Expert Security Heuristics" };
    }

    if (this.initStatus === "loaded" && this.model) {
      try {
        // --- ONNX MODEL PIPELINE ACTIVE ---
        // Tokenize text into continuous IDs
        const tokenized = await this.tokenizer(text, { return_tensor: false });
        const tokenIds = tokenized.input_ids;

        const maxWindow = 512;
        const overlap = 256; // 50% stride
        let maxScore = 0.0;
        let flaggedCount = 0;

        // If fits in single window, run once
        if (tokenIds.length <= maxWindow) {
          const result = await this.model(text);
          // Prompt Guard output labels typically include: 'benign', 'injection', 'jailbreak'
          // We look for any threat class scores
          const score = this.extractThreatScore(result);
          maxScore = score;
          if (score >= safetyThreshold) flaggedCount++;
        } else {
          // Sliding loop across token continuous arrays
          let startIdx = 0;
          while (startIdx < tokenIds.length) {
            const endIdx = Math.min(startIdx + maxWindow, tokenIds.length);
            const sliceIds = tokenIds.slice(startIdx, endIdx);
            
            // Re-decode token slice back to string for input
            const sliceText = this.tokenizer.decode(sliceIds, { skip_special_tokens: true });
            const result = await this.model(sliceText);
            const score = this.extractThreatScore(result);

            if (score > maxScore) {
              maxScore = score;
            }
            if (score >= safetyThreshold) {
              flaggedCount++;
            }

            // Move by 50% stride
            if (endIdx === tokenIds.length) break;
            startIdx += overlap;
          }
        }

        return {
          isSecure: maxScore < safetyThreshold,
          maxScore: parseFloat(maxScore.toFixed(4)),
          flaggedCount,
          methodUsed: "ONNX Prompt-Guard-86M"
        };
      } catch (err) {
        console.error("Inference runtime error, resorting to Local Expert Fallback:", err);
        return this.scanLocalHeuristics(text, safetyThreshold);
      }
    } else {
      // --- GRACEFUL LOCAL EXPERT FALLBACK ---
      return this.scanLocalHeuristics(text, safetyThreshold);
    }
  }

  /**
   * Decodes output threat scores from model pipeline predictions.
   */
  private extractThreatScore(predictions: any[]): number {
    if (!predictions || !Array.isArray(predictions)) return 0;
    
    // For sequence classifiers, prediction is often an array e.g. [{ label: 'benign', score: 0.99 }]
    // or key-value pairs depending on structure
    // Let's inspect the top score or specific target label scores
    let threatScore = 0.0;
    for (const pred of predictions) {
      const label = String(pred.label).toLowerCase();
      // 'injection' or 'jailbreak' are the primary threat categories in Prompt-Guard-86M
      if (label.includes("injection") || label.includes("jailbreak") || label.includes("label_1") || label.includes("label_2")) {
        if (pred.score > threatScore) {
          threatScore = pred.score;
        }
      }
    }
    return threatScore;
  }

  /**
   * Local heuristic rules matching rolling window over words to align with 512-token 50% stride spec.
   */
  private scanLocalHeuristics(text: string, safetyThreshold: number): ScanResult {
    const words = text.split(/\s+/);
    // 512 tokens is approximately 380 words.
    // 256 tokens is approximately 190 words.
    const maxWordsWindow = 380;
    const wordStride = 190;

    let maxScore = 0.0;
    let flaggedCount = 0;

    const evaluateStringSlice = (sliceStr: string): number => {
      let score = 0.0;
      
      // Calculate matches
      let severeCount = 0;
      for (const pattern of SEVERE_ATTACK_PATTERNS) {
        if (pattern.test(sliceStr)) severeCount++;
      }

      let moderateCount = 0;
      for (const pattern of MODERATE_ATTACK_PATTERNS) {
        if (pattern.test(sliceStr)) moderateCount++;
      }

      let mildCount = 0;
      for (const pattern of MILD_ATTACK_PATTERNS) {
        if (pattern.test(sliceStr)) mildCount++;
      }

      // Compute weight combinations
      if (severeCount >= 1) {
        // Severe match automatically flags the slice well above safety thresholds
        score = 0.85 + (severeCount * 0.04);
      } else if (moderateCount >= 2) {
        score = 0.65 + (moderateCount * 0.05);
      } else if (moderateCount === 1) {
        score = 0.45 + (mildCount * 0.08);
      } else if (mildCount >= 2) {
        score = 0.25 + (mildCount * 0.05);
      } else if (mildCount === 1) {
        score = 0.12;
      }

      // Cap at 0.99
      return Math.min(score, 0.99);
    };

    if (words.length <= maxWordsWindow) {
      const score = evaluateStringSlice(text);
      maxScore = score;
      if (score >= safetyThreshold) flaggedCount++;
    } else {
      let startWord = 0;
      while (startWord < words.length) {
        const endWord = Math.min(startWord + maxWordsWindow, words.length);
        const sliceStr = words.slice(startWord, endWord).join(" ");
        const score = evaluateStringSlice(sliceStr);

        if (score > maxScore) {
          maxScore = score;
        }
        if (score >= safetyThreshold) {
          flaggedCount++;
        }

        if (endWord === words.length) break;
        startWord += wordStride;
      }
    }

    return {
      isSecure: maxScore < safetyThreshold,
      maxScore,
      flaggedCount,
      methodUsed: "Local Expert Security Heuristics"
    };
  }
}
