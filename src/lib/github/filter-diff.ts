/**
 * Unified diff filtering + stable sorting for CostGuardAI PR analysis.
 *
 * filterAndSortDiff(rawDiff):
 *   1. Splits unified diff into per-file sections.
 *   2. Removes sections for ignored paths (lockfiles, dist, generated, etc.).
 *   3. Sorts remaining sections alphabetically by filename — deterministic ordering.
 */

/** Predicates for paths to exclude from analysis. */
const IGNORE_PREDICATES: Array<(p: string) => boolean> = [
  // Lockfiles
  (p) => /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(p),
  (p) => /\.lock$/.test(p),
  // Build / dist output
  (p) => /^(dist|build|out|\.next|\.nuxt|coverage)\//.test(p),
  // Vendored dependencies
  (p) => /^node_modules\//.test(p),
  // Minified assets
  (p) => /\.min\.(js|css)$/.test(p),
  // Code-generated files
  (p) =>
    /\.(generated\.|pb\.go|pb_grpc\.go|g\.ts|g\.tsx)/.test(p) ||
    /\.generated\.(ts|tsx|js)$/.test(p),
  // Snapshot files
  (p) => /\.snap$/.test(p),
];

function isIgnored(filename: string): boolean {
  return IGNORE_PREDICATES.some((fn) => fn(filename));
}

/**
 * Extract the canonical 'a/' filename from a "diff --git a/... b/..." header.
 * Returns empty string if the header cannot be parsed.
 */
function extractFilename(section: string): string {
  const match = section.match(/^diff --git a\/(.+?) b\/.+/m);
  return match ? match[1] : "";
}

/**
 * Filter and deterministically sort a unified diff string.
 *
 * - Empty / non-diff input returns as-is.
 * - Sections for ignored files are dropped entirely.
 * - Remaining sections are sorted A→Z by filename.
 */
export function filterAndSortDiff(rawDiff: string): string {
  if (!rawDiff.trimStart().startsWith("diff --git")) return rawDiff;

  // Split at each "diff --git" boundary (positive lookahead keeps the header)
  const sections = rawDiff.split(/(?=^diff --git )/m).filter(Boolean);

  const kept = sections
    .filter((section) => {
      const filename = extractFilename(section);
      return filename !== "" && !isIgnored(filename);
    })
    .sort((a, b) => {
      const fa = extractFilename(a);
      const fb = extractFilename(b);
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });

  return kept.join("");
}
