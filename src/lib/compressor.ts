/**
 * Rule-based prompt compression. No API calls.
 * Conservative: will not destroy meaning or restructure sentences.
 */

export interface CompressionResult {
  compressed: string;
  techniques: string[];
}

export function compressPrompt(text: string): CompressionResult {
  const techniques: string[] = [];
  let result = text;

  // 1. Collapse excess whitespace
  const beforeWs = result;
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/^\s+$/gm, "");
  if (result !== beforeWs) techniques.push("Collapsed excess whitespace");

  // 2. Remove filler phrases
  const beforeFillers = result;

  // Phrases that can be removed entirely
  const removable = [
    /\b(?:please|kindly)\s+(?:note\s+that|be\s+aware\s+that|ensure\s+that)\s*/gi,
    /\b(?:I would like you to|I want you to|I need you to|Can you please)\s*/gi,
    /\b(?:basically|essentially|actually|literally|simply)\s+/gi,
    /\b(?:it is important to note that|it should be noted that)\s*/gi,
    /\b(?:as you know|as we know|as you may know),?\s*/gi,
    /\b(?:in my opinion|from my perspective),?\s*/gi,
  ];

  for (const pattern of removable) {
    result = result.replace(pattern, "");
  }

  // Phrases that have shorter replacements
  result = result.replace(/\bin order to\b/gi, "to");
  result = result.replace(/\bat this point in time\b/gi, "now");
  result = result.replace(/\bdue to the fact that\b/gi, "because");
  result = result.replace(/\bin the event that\b/gi, "if");
  result = result.replace(/\bfor the purpose of\b/gi, "to");
  result = result.replace(/\bin spite of the fact that\b/gi, "although");
  result = result.replace(/\bwith regard to\b/gi, "about");
  result = result.replace(/\bwith respect to\b/gi, "about");
  result = result.replace(/\ba large number of\b/gi, "many");
  result = result.replace(/\ba majority of\b/gi, "most");

  if (result !== beforeFillers) techniques.push("Removed filler phrases");

  // 3. Strip markdown formatting markers
  const beforeMd = result;
  result = result.replace(/^#{1,6}\s*/gm, "");
  result = result.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  result = result.replace(/__([^_]+)__/g, "$1");
  result = result.replace(/_([^_]+)_/g, "$1");
  if (result !== beforeMd) techniques.push("Stripped formatting markers");

  // 4. Remove redundant punctuation and qualifiers
  const beforePunct = result;
  result = result.replace(/\.{2,}/g, ".");
  result = result.replace(/!{2,}/g, "!");
  result = result.replace(/\?{2,}/g, "?");
  result = result.replace(/,\s*,/g, ",");
  if (result !== beforePunct) techniques.push("Cleaned up redundant punctuation");

  // 5. Final cleanup
  result = result.replace(/  +/g, " ");
  result = result.replace(/\n +/g, "\n");
  result = result.trim();

  if (techniques.length === 0) {
    techniques.push("Prompt is already concise");
  }

  return { compressed: result, techniques };
}
