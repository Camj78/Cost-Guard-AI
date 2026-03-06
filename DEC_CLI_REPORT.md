# DEC_CLI_REPORT — SP-DEC 02 (CostGuard CLI)

## 1. Files Created

```
packages/cli/
  package.json              # @costguard/cli@0.2.0, bin entry, tsup/ts devDeps
  tsconfig.json             # CJS target, node moduleResolution
  tsup.config.ts            # tsup bundle config, js-tiktoken external
  src/bin.ts                # CLI entry: analyze | init | version | --help
  src/commands/analyze.ts   # analyze command, file walker, formatters, exit codes
  src/commands/init.ts      # init command, writes costguard.config.json
  src/core/models.ts        # vendored model catalog (no @/ alias)
  src/core/risk.ts          # vendored risk engine + AMBIGUOUS_TERMS/VOLATILITY_PHRASES exported
  src/core/tokenizer.ts     # vendored tokenizer (js-tiktoken external)
  scripts/test-golden.mjs   # golden fixture test runner
  dist/bin.js               # built artifact (26.9 KB CJS bundle)
  costguard-cli-0.2.0.tgz   # packed tarball

fixtures/cli/
  minimal.txt               # low-risk fixture (structured prompt)
  risky.txt                 # high-risk fixture (vague, open-ended)
  minimal.expected.json     # golden output for minimal
  risky.expected.json       # golden output for risky

costguard.config.example.json   # example config file
```

## 2. Files Modified

- `eslint.config.mjs` — added `packages/cli/**` to globalIgnores
- `package.json` — added `build:cli` and `test:cli` scripts

## 3. Commands Run + Results

### Gate A — Build
```
cd packages/cli && npm install
→ 50 packages added, 0 vulnerabilities

npm run build
→ CJS dist/bin.js 26.26 KB — Build success in 33ms
```

### Gate B — Command parsing
```
node packages/cli/dist/bin.js --help        → help text, exit 0
node packages/cli/dist/bin.js version       → 0.2.0, exit 0
node packages/cli/dist/bin.js init          → writes costguard.config.json, exit 0
node packages/cli/dist/bin.js unknown       → error + usage hint, exit 1
```

### Gate C — Deterministic file traversal
```
node packages/cli/dist/bin.js analyze fixtures/cli/ --json
→ FILES: ['fixtures/cli/minimal.txt', 'fixtures/cli/risky.txt']
→ COUNT: 2

Determinism check (2× same input):
→ DETERMINISM: PASS
```

### Gate D — Analyzer integration
```
node packages/cli/dist/bin.js analyze fixtures/cli/minimal.txt --json
{
  "score_version": "1",
  "ruleset_hash": "486cf68fa2ae6ac8",
  "files": [{
    "file": "fixtures/cli/minimal.txt",
    "input_hash": "8ed0cbd31f40b02a9e5cd1ea9e26987bc9c126b91e9112c621f78398b132efde",
    "model_id": "gpt-4o-mini",
    "input_tokens": 43,
    "is_estimated": false,
    "risk_score": 8,
    "risk_level": "SAFE",
    ...
  }]
}

node packages/cli/dist/bin.js analyze fixtures/cli/risky.txt --json
{
  "risk_score": 51,
  "risk_level": "WARNING",
  "risk_drivers": [
    { "name": "Output Volatility Risk", "impact": 100 },
    { "name": "Ambiguity Risk",         "impact": 90  },
    { "name": "Structural Risk",        "impact": 80  }
  ]
}
```

### Gate E — CI behavior
```
# Exit code 0 (safe, no threshold)
node packages/cli/dist/bin.js analyze fixtures/cli/minimal.txt --json
→ EXIT: 0

# Exit code 2 (above threshold)
node packages/cli/dist/bin.js analyze fixtures/cli/risky.txt --json --threshold 50
→ risk_score: 51, above_threshold: true
→ EXIT: 2

# Exit code 1 (runtime error)
node packages/cli/dist/bin.js analyze /nonexistent/path --json
→ Error: path does not exist
→ EXIT: 1

# --json emits only JSON to stdout; errors go to stderr
```

### Gate F — Golden fixtures
```
pnpm test:cli
→ PASS  minimal
→ PASS  risky
→ 2 passed, 0 failed, 0 skipped
```

### Gate G — Pack test
```
npm pack --dry-run
→ name: @costguard/cli
→ version: 0.2.0
→ Tarball: costguard-cli-0.2.0.tgz
→ Contents: dist/bin.js (26.9 kB) + package.json
→ unpacked size: 27.4 kB

node dist/bin.js --help   → OK
node dist/bin.js version  → 0.2.0
```

## 4. Golden Fixture Evidence

### fixtures/cli/minimal.txt
```
### Task

Summarize the following article in exactly 3 bullet points.

- Focus on the main argument
- Keep each point under 20 words
- Return as a JSON array with field "points"
```
**Result:** risk_score=8, SAFE, 43 tokens, cost=$0.0003/req

### fixtures/cli/risky.txt
```
Write a detailed comprehensive analysis of the competitive landscape for AI companies.
Include everything about market dynamics, technology trends, pricing strategies...
...provide as much as possible...high quality, modern and scalable...Optimize...
```
**Result:** risk_score=51, WARNING, 70 tokens
Top drivers: Output Volatility (100), Ambiguity (90), Structural (80)

### Ruleset identity
- `score_version`: `"1"` — tied to current weight table (25/20/20/20/15)
- `ruleset_hash`: `"486cf68fa2ae6ac8"` — SHA-256 of sorted AMBIGUOUS_TERMS + VOLATILITY_PHRASES + weights

## 5. Remaining Risks

| Risk | Severity | Notes |
|---|---|---|
| vendored core drift | Low | `packages/cli/src/core/` must be kept in sync with `src/lib/` when weights or term lists change. Bump `score_version` on any change. |
| js-tiktoken WASM | Low | Marked external; works from node_modules. npx installs deps automatically. WASM cache warm-up ~100ms on first call. |
| Binary file false positives | Low | walkDir skips non-matching extensions. Single-file mode accepts any file directly. |
| Windows path separators | Low | `path.relative()` uses OS separator. JSON output will show backslashes on Windows. Acceptable for CI. |
