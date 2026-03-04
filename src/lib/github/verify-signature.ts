import { createHmac, timingSafeEqual } from "crypto";

export interface VerifyParams {
  secret: string;
  rawBody: string;
  signature256Header: string | null;
}

/**
 * Verify a GitHub webhook X-Hub-Signature-256 header.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyGithubSignature({
  secret,
  rawBody,
  signature256Header,
}: VerifyParams): boolean {
  if (!signature256Header) return false;

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature256Header, "utf8");
    // Lengths must match before timingSafeEqual to avoid exception
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
