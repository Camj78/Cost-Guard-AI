/**
 * CostGuardAI — Risk Driver Explanation Catalog
 * Vendored copy for self-contained CLI distribution.
 * Source of truth: packages/core/src/explanations.ts
 */

export interface Explanation {
  summary: string;
  top_risk_drivers: string[];
  contributing_factors: string[];
  mitigation_suggestions: string[];
}

export interface DriverExplanationMeta {
  description: string;
  contributing_factors: string[];
  base_mitigations: string[];
}

export const DRIVER_EXPLANATIONS: Record<string, DriverExplanationMeta> = {
  "Length Risk": {
    description:
      "Prompt length consumes a high proportion of the available context window.",
    contributing_factors: [
      "Input token count is elevated relative to context window size",
      "Insufficient remaining context for the expected model output",
    ],
    base_mitigations: [
      "Shorten the prompt by removing redundant background context",
      "Break large prompts into smaller, focused requests",
      "Summarize background information before sending to the model",
    ],
  },

  "Context Saturation Risk": {
    description:
      "Combined input and expected output tokens approach the model's context limit.",
    contributing_factors: [
      "Input tokens plus expected output tokens exceed a safe context threshold",
      "Risk of response truncation at the context window boundary",
    ],
    base_mitigations: [
      "Reduce expected output token count by scoping the request",
      "Shorten the input prompt to leave more room for output",
      "Use a model with a larger context window for this use case",
    ],
  },

  "Ambiguity Risk": {
    description:
      "Vague or subjective language in the prompt produces unpredictable model outputs.",
    contributing_factors: [
      "Presence of subjective qualifiers such as 'better', 'optimize', or 'high quality'",
      "High density of terms without measurable success criteria",
    ],
    base_mitigations: [
      "Replace vague terms with specific, measurable requirements",
      "Define explicit success criteria and acceptance conditions in the prompt",
      "Use concrete examples to anchor the model's expected behavior",
    ],
  },

  "Structural Risk": {
    description:
      "Prompt lacks structural cues that guide model behavior and output format.",
    contributing_factors: [
      "Missing explicit output format specification",
      "Absence of section headers or logical delimiters",
      "No explicit constraints on output length or scope",
    ],
    base_mitigations: [
      "Add explicit output format instructions (e.g., 'Return JSON with fields: ...')",
      "Use section headers and delimiters to separate prompt components",
      "Add constraints using 'max', 'limit', or 'exactly' to bound the output",
    ],
  },

  "Output Volatility Risk": {
    description:
      "Open-ended output directives cause unpredictable token consumption and cost spikes.",
    contributing_factors: [
      "Use of expansive directives such as 'comprehensive', 'in depth', or 'as much as possible'",
      "Expected output token count significantly exceeds the input token count",
    ],
    base_mitigations: [
      "Replace open-ended directives with scoped, specific requests",
      "Set a maximum output token cap in the model API call",
      "Define the exact number of items, steps, or words expected",
    ],
  },
};
