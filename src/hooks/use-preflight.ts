"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { countTokens } from "@/lib/tokenizer";
import { compressPrompt, type CompressionResult } from "@/lib/compressor";
import { assessRisk, type RiskAssessment } from "@/lib/risk";
import {
  MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_EXPECTED_OUTPUT,
  MIN_EXPECTED_OUTPUT,
  type ModelConfig,
} from "@/config/models";

// Prompts > 200K chars pause realtime analysis — user must click "Analyze"
const PERF_GUARD_CHAR_LIMIT = 200_000;
const DEBOUNCE_MS = 300;

export interface PreflightState {
  // Inputs
  prompt: string;
  modelId: string;
  expectedOutputTokens: number;

  // Analysis results
  analysis: RiskAssessment | null;
  isAnalyzing: boolean;

  // Compression
  compressionPreview: CompressionResult | null;
  compressionDelta: number; // (1 - compressedTokens / inputTokens) * 100
  compressedTokens: number;
  compressedCostTotal: number;
  tokenDelta: number; // inputTokens - compressedTokens (positive = savings)
  costDelta: number; // estimatedCostTotal - compressedCostTotal (positive = savings)

  // Perf guard
  isLargePrompt: boolean; // prompt > 200K chars
  needsManualAnalyze: boolean; // large + not yet analyzed

  // Derived from model
  model: ModelConfig;
  sliderMax: number;

  // Actions
  setPrompt: (v: string) => void;
  setModelId: (id: string) => void;
  setExpectedOutputTokens: (n: number) => void;
  applyCompression: () => void;
  triggerManualAnalyze: () => void;
}

// Fire-and-forget: record analysis to server (only when user is signed in)
async function recordAnalysis(
  result: RiskAssessment,
  promptText: string,
  mdlId: string
) {
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(promptText)
    );
    const prompt_hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt_hash,
        model_id: mdlId,
        input_tokens: result.inputTokens,
        output_tokens: result.expectedOutputTokens,
        cost_total: result.estimatedCostTotal,
        risk_score: result.riskScore,
      }),
    });
  } catch {
    // Silent — never surface errors to the user
  }
}

export function usePreflight(): PreflightState {
  // Pre-fill from dashboard "Load" if sessionStorage key is set
  const [prompt, setPromptRaw] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const loaded = sessionStorage.getItem("cg_load_prompt");
      if (loaded) {
        sessionStorage.removeItem("cg_load_prompt");
        return loaded;
      }
    } catch {
      // sessionStorage unavailable
    }
    return "";
  });
  const [modelId, setModelIdRaw] = useState(DEFAULT_MODEL_ID);
  const [expectedOutputTokens, setExpectedRaw] = useState(DEFAULT_EXPECTED_OUTPUT);
  const [analysis, setAnalysis] = useState<RiskAssessment | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [compressionPreview, setCompressionPreview] =
    useState<CompressionResult | null>(null);
  const [compressionDelta, setCompressionDelta] = useState(0);
  const [compressedTokens, setCompressedTokens] = useState(0);
  const [compressedCostTotal, setCompressedCostTotal] = useState(0);
  const [tokenDelta, setTokenDelta] = useState(0);
  const [costDelta, setCostDelta] = useState(0);
  const [needsManualAnalyze, setNeedsManualAnalyze] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve model from id
  const model = useMemo(
    () => MODELS.find((m) => m.id === modelId) ?? MODELS[0],
    [modelId]
  );

  const sliderMax = model.maxOutputTokens;
  const isLargePrompt = prompt.length > PERF_GUARD_CHAR_LIMIT;

  // Core analysis function
  const runAnalysis = useCallback(
    (text: string, mdl: ModelConfig, expected: number) => {
      if (!text.trim()) {
        setAnalysis(null);
        setCompressionPreview(null);
        setCompressionDelta(0);
        setCompressedTokens(0);
        setCompressedCostTotal(0);
        setTokenDelta(0);
        setCostDelta(0);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);

      // Token count
      const inputTokens = countTokens(text, mdl);

      // Compression preview (used for compressionDelta in risk score)
      const preview = compressPrompt(text);
      const compressedTokens = countTokens(preview.compressed, mdl);

      // compressionDelta = (1 - compressedTokens / inputTokens) * 100
      const delta =
        inputTokens > 0
          ? Math.max(0, (1 - compressedTokens / inputTokens) * 100)
          : 0;

      setCompressionPreview(preview);
      setCompressionDelta(delta);

      // Risk assessment
      const result = assessRisk({
        inputTokens,
        contextWindow: mdl.contextWindow,
        expectedOutputTokens: expected,
        maxOutputTokens: mdl.maxOutputTokens,
        compressionDelta: delta,
        tokenStrategy: mdl.tokenStrategy,
        inputPricePer1M: mdl.inputPricePer1M,
        outputPricePer1M: mdl.outputPricePer1M,
      });

      setAnalysis(result);

      // Record to server (fire-and-forget, silently no-ops if not signed in)
      recordAnalysis(result, text, mdl.id);

      // Compression metrics (precomputed here for ResultsPanel diff card)
      const compCostTotal =
        (compressedTokens / 1_000_000) * mdl.inputPricePer1M +
        (result.expectedOutputTokens / 1_000_000) * mdl.outputPricePer1M;
      setCompressedTokens(compressedTokens);
      setCompressedCostTotal(compCostTotal);
      setTokenDelta(inputTokens - compressedTokens);
      setCostDelta(result.estimatedCostTotal - compCostTotal);

      setIsAnalyzing(false);
    },
    []
  );

  // Prompt setter — gates large prompt realtime analysis
  const setPrompt = useCallback(
    (v: string) => {
      setPromptRaw(v);

      if (v.length > PERF_GUARD_CHAR_LIMIT) {
        // Large prompt: cancel any pending debounce, require manual trigger
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setNeedsManualAnalyze(true);
        setIsAnalyzing(false);
        return;
      }

      setNeedsManualAnalyze(false);

      // Debounced realtime analysis
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!v.trim()) {
        setAnalysis(null);
        setCompressionPreview(null);
        setCompressionDelta(0);
        setCompressedTokens(0);
        setCompressedCostTotal(0);
        setTokenDelta(0);
        setCostDelta(0);
        setIsAnalyzing(false);
        return;
      }

      setIsAnalyzing(true);
      debounceRef.current = setTimeout(() => {
        runAnalysis(v, model, expectedOutputTokens);
      }, DEBOUNCE_MS);
    },
    [model, expectedOutputTokens, runAnalysis]
  );

  // Model setter — clamps expected output, re-runs analysis immediately
  const setModelId = useCallback(
    (id: string) => {
      const newModel = MODELS.find((m) => m.id === id) ?? MODELS[0];
      setModelIdRaw(id);

      // Clamp expectedOutputTokens to new model's maxOutputTokens
      const clamped = Math.min(
        Math.max(expectedOutputTokens, MIN_EXPECTED_OUTPUT),
        newModel.maxOutputTokens
      );
      if (clamped !== expectedOutputTokens) {
        setExpectedRaw(clamped);
      }

      // Re-run immediately if prompt exists and not a large prompt
      if (prompt.trim() && prompt.length <= PERF_GUARD_CHAR_LIMIT) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        runAnalysis(prompt, newModel, clamped);
      }
    },
    [prompt, expectedOutputTokens, runAnalysis]
  );

  // Expected output setter — clamp + immediate re-run
  const setExpectedOutputTokens = useCallback(
    (n: number) => {
      const clamped = Math.min(
        Math.max(n, MIN_EXPECTED_OUTPUT),
        model.maxOutputTokens
      );
      setExpectedRaw(clamped);

      // Re-run immediately (slider feedback must be instant)
      if (prompt.trim() && prompt.length <= PERF_GUARD_CHAR_LIMIT) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        runAnalysis(prompt, model, clamped);
      }
    },
    [prompt, model, runAnalysis]
  );

  // Apply compression — replaces prompt with compressed version, re-analyzes
  const applyCompression = useCallback(() => {
    if (!compressionPreview) return;
    const compressed = compressionPreview.compressed;
    setPromptRaw(compressed);
    setNeedsManualAnalyze(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runAnalysis(compressed, model, expectedOutputTokens);
  }, [compressionPreview, model, expectedOutputTokens, runAnalysis]);

  // Manual analyze trigger (for large prompts)
  const triggerManualAnalyze = useCallback(() => {
    setNeedsManualAnalyze(false);
    runAnalysis(prompt, model, expectedOutputTokens);
  }, [prompt, model, expectedOutputTokens, runAnalysis]);

  // If prompt was pre-filled from sessionStorage, run initial analysis
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    if (prompt.trim() && prompt.length <= PERF_GUARD_CHAR_LIMIT) {
      runAnalysis(prompt, model, expectedOutputTokens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    prompt,
    modelId,
    expectedOutputTokens,
    analysis,
    isAnalyzing,
    compressionPreview,
    compressionDelta,
    compressedTokens,
    compressedCostTotal,
    tokenDelta,
    costDelta,
    isLargePrompt,
    needsManualAnalyze,
    model,
    sliderMax,
    setPrompt,
    setModelId,
    setExpectedOutputTokens,
    applyCompression,
    triggerManualAnalyze,
  };
}
