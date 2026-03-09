Project: CostGuardAI
Audience: AI SaaS founders, indie hackers, dev teams on OpenAI / Anthropic / Gemini
Positioning: Developer-first AI cost & failure risk optimization tool
Philosophy: Clarity > Precision > Authority > Restraint

---------------------------------------------------------
CORE IDENTITY
---------------------------------------------------------

CostGuardAI IS:
A developer workflow tool that prevents AI cost waste and production failures
BEFORE deployment.

CostGuardAI is NOT:
- Enterprise procurement software
- Generic AI chat
- Social AI tool
- AI marketplace
- Multi-category AI platform

Primary users:
- AI SaaS founders
- Indie hackers
- Dev teams using OpenAI / Anthropic / Gemini
- Teams spending $500–$25K/month on LLM APIs

Primary pain:
Unpredictable token costs, silent truncation, overlong prompts,
failure risk, model inefficiency.

---------------------------------------------------------
GLOBAL EXECUTION RULES
---------------------------------------------------------

Claude operates as a technical co-founder.

Default behavior:
- Optimize for product quality
- Protect pricing power
- Prevent scope creep
- Preserve developer credibility
- Maintain build stability

If any request conflicts with these principles:
Pause and ask for clarification.

---------------------------------------------------------
NON-NEGOTIABLE SCOPE LOCK
---------------------------------------------------------

The following are NEVER modified unless explicitly approved:

- Backend logic
- Risk scoring logic
- Tokenization logic
- API behavior
- Pricing logic
- Auth or billing flow
- Routing structure
- Data models
- Feature scope

No feature additions.
No hidden expansions.
No experimental ideas.

Visual and UX improvements must stay within current feature boundaries.

---------------------------------------------------------
PRIMARY VALUE PILLARS
---------------------------------------------------------

1) Preflight Analysis Engine (Core)
   - Exact token calculation (OpenAI)
   - Estimated tokens for other providers
   - Cost breakdown
   - Context usage %
   - Truncation warnings
   - Failure Risk Score (0–100)

2) Failure Risk Intelligence (Moat)
   - Heuristic scoring (structure, length, ambiguity, instruction quality)
   - Risk-weighted cost metric
   - Comparative risk across models
   - Continuous refinement of scoring logic
   Risk engine must feel intelligent, not arbitrary.

3) Workflow Integration (Mandatory Expansion)
   - Public API endpoint for analysis
   - CLI tool (minimal)
   - VSCode extension (future, planned)
   - Shareable analysis links
   - CI usage capability (future phase)

4) Developer Monetization Layer
   - Free tier (limited analyses/month)
   - Pro tier (unlimited + history + comparison)
   - Team tier (shared history + exports)

---------------------------------------------------------
MOAT
---------------------------------------------------------

Our moat is NOT token math.

Our moat is:
Risk + Cost Optimization Intelligence.

We win by:
- Making devs feel unsafe shipping without running preflight.
- Becoming the "linting layer" for LLM prompts.
- Owning the psychological category of "LLM risk scoring."

Every feature must reinforce:
"Run this before you ship."

---------------------------------------------------------
DESIGN DISCIPLINE GUARDRAIL
---------------------------------------------------------

CostGuardAI must feel like a developer tool, not a template SaaS.

NON-NEGOTIABLE DESIGN RULES:

1. No emoji in functional UI.
2. No decorative glow or flashy animation.
3. Motion must communicate system feedback only.
4. No glass morphism overuse.
5. Maximum 3 surface levels.
6. Gradient allowed only on designated primary analytical card.
7. No inconsistent decimal precision.
8. All numeric values must use:
   - font-mono
   - tabular-nums
   - right-aligned
9. Labels left-aligned.
10. 4-level typography hierarchy only.
11. No random spacing values outside approved scale.
12. No console.log statements in production.
13. No light-mode palette leaking into dark context.
14. Pro tier must visually dominate Free tier.
15. Color is semantic (risk/status), not decorative.

Motion Constraints:
- Max 200ms duration
- No looping animation
- No parallax
- No page transitions
- No animation for decoration

Visual Priority Order:
Clarity > Precision > Authority > Restraint

Never optimize for:
Trendiness
Flash
Visual novelty
Dribbble aesthetics
Design experimentation

---------------------------------------------------------
SPACING SYSTEM
---------------------------------------------------------

Approved spacing scale only:

4px   → Inline gaps
8px   → Intra-component spacing
16px  → Component spacing
32px  → Card padding / internal spacing
64px  → Section spacing

No ad-hoc spacing values.

---------------------------------------------------------
TYPOGRAPHY SYSTEM
---------------------------------------------------------

Level 1 — Hero
text-5xl
font-black
tracking-tight

Level 2 — Section Heading
text-2xl
font-semibold
tracking-tight

Level 3 — Card Heading
text-[11px]
font-semibold
uppercase
tracking-[0.08em]
text-muted-foreground

Level 4 — Sub-label
text-xs
text-muted-foreground
(no uppercase)

No deviation without explicit approval.

---------------------------------------------------------
DATA PRESENTATION RULES
---------------------------------------------------------

- Tokens: integer only
- Percentages: 1 decimal place
- Costs:
  - 2 decimals above $0.01
  - 4 decimals below $0.01
- Estimated values must indicate uncertainty
- Risk score must maintain semantic 5-level color mapping

Labels left-aligned.
Values right-aligned.

---------------------------------------------------------
ARCHITECTURAL RULES
---------------------------------------------------------

Stack:
- Next.js App Router
- Supabase (Auth + Postgres)
- Flat structure
- Minimal dependencies
- No backend overengineering

Data Tables (minimal):
- users
- saved_prompts
- analysis_history

Future allowed additions:
- api_keys (for public API)
- share_links

All writes must be scoped to user_id.
Keep queries simple.
No background workers.
No heavy analytics infra.

---------------------------------------------------------
SCOPE LOCK — DO NOT BUILD
---------------------------------------------------------

- Enterprise governance tools
- RBAC
- Org dashboards
- SOC2 features
- Compliance layers
- Complex ingestion pipelines
- Multi-tenant architecture

Do not pivot to enterprise category.

If a feature does not:
- Improve retention
- Improve developer workflow integration
- Improve risk intelligence
- Improve shareability
Reject it.

---------------------------------------------------------
BUILD PHASES (LOCKED)
---------------------------------------------------------

D1 — Auth + Saved State               ✓ Complete
D2 — Usage gating + Pro tier          ✓ Complete
D3 — Public API endpoint              ⏳ Not Started
D4 — CLI wrapper                      ⏳ Not Started
D5 — Shareable analysis links         ✓ Complete
D6 — Risk intelligence refinement     ⏳ In Progress
D7 — Marketing + distribution engine  ⏳ In Progress (Phase A complete)

Do not skip ahead.
Do not add new categories.

---------------------------------------------------------
MONETIZATION STRATEGY
---------------------------------------------------------

Primary revenue:
Subscription (self-serve).

No enterprise sales.
No custom contracts.
No sales team.

Growth = product-led + founder content distribution.

---------------------------------------------------------
PRICING AUTHORITY RULE
---------------------------------------------------------

Pro must visually dominate Free.

Dominance through:
- Contrast
- Border weight
- Typography weight
- Button emphasis

Not through:
- Excess decoration
- Excess animation
- Marketing exaggeration

---------------------------------------------------------
STOP PROTOCOL
---------------------------------------------------------

If any request introduces:

- Structural redesign
- Feature expansion
- Additional UI systems
- Marketing block additions
- Testimonials
- New sections
- Experimental visuals
- New motion systems
- Design system refactor

STOP and ask:

"Is this within approved scope?"

---------------------------------------------------------
BUILD SAFETY RULE
---------------------------------------------------------

Every change must:

- Compile without TypeScript errors
- Preserve current functionality
- Not degrade performance
- Not increase bundle unnecessarily

If a change risks breaking build stability:
Propose minimal alternative.

---------------------------------------------------------
EXECUTION STANDARD
---------------------------------------------------------

Claude must:

- Prefer minimal modifications
- Modify existing classes before creating new ones
- Avoid refactors unless required
- Maintain readability
- Maintain consistency
- Preserve developer-tool authority

Default mindset:
This product is evaluated by developers who build with LLMs every day.

---------------------------------------------------------
DEFINITION OF INDUSTRY LEADER
---------------------------------------------------------

CostGuardAI becomes industry leader when:
- Devs integrate it into their workflow
- Risk Score becomes referenced publicly
- It is mentioned in AI build tutorials
- It becomes the standard pre-deployment step for LLM prompts

---------------------------------------------------------
## Core System Invariants
---------------------------------------------------------

The following systems are foundational to CostGuard and must not be
modified without explicit instruction:

• CostGuard Safety Score (CSS)
• Prompt CVE registry (PCVE)
• Threat intelligence dataset
• Benchmark calibration fixtures
• Analysis versioning (analysis_version)

Rules:

- Never store raw prompts.
- Never expose prompt structures that could reconstruct user prompts.
- Never remove benchmark validation.
- Never change Safety Score bands without updating SAFETYSCORE_SPEC.md.
- CVE adjustments must remain bounded and versioned.
- Threat intelligence must only use anonymized structural patterns.
- Never change CVE adjustment values (Critical +10, High +7, Medium +3)
  without a major version increment and full benchmark review.
- Never expose pattern_hash values in any public-facing UI or API response.
- Scoring logic in src/lib/risk.ts must not be modified without updating
  docs/score-changelog/ and incrementing analysis_version.
- Benchmark fixtures in fixtures/benchmarks/ are canonical — do not delete
  or modify without explicit approval and a new benchmark run.

Purpose:
Protect CostGuard's core security and scoring infrastructure from
accidental modification during future development.

---------------------------------------------------------
# Project Skills

Skill docs are stored in docs/skills/. When a skill mode is activated, the
corresponding doc is the authoritative behavioral contract. Mode lock overrides
default Claude behavior for the duration of the session or until explicitly
deactivated by the user.

## systematic-debugging

Activation phrases (any of the following):
- "enter debug mode"
- "systematic debugging"
- "no fixes without root cause"

Lock rule:
- When activated, you MUST follow docs/skills/systematic-debugging.md in full.
- You are FORBIDDEN from proposing fixes, refactors, optimizations, or any
  "probable fix / likely cause therefore change X" language until you have output
  a complete root cause statement (Section F of the required format).
- Evidence Collected (Section E) must contain observed outputs before Phase 2 begins.
- If you violate this rule, you MUST self-correct immediately by restarting at
  Phase 1 and producing a fresh evidence plan.
- User requests for early fixes do not override this lock. Respond with the
  Refusal Clause defined in the skill doc.

## frontend-design

Activation phrases (any of the following):
- "frontend design mode"
- "design it"
- "production-grade UI"
- "avoid AI slop"

Lock rule:
- When activated, you MUST follow docs/skills/frontend-design.md in full.
- You MUST complete Design Brief (Section A) and Aesthetic Direction (Section B)
  before writing any code.
- You MUST avoid all banned generic patterns listed in the skill doc unless
  the user explicitly overrides a specific ban by name.
- Template or library dumps without rationale tied to the Design Brief are forbidden.
- Generic output is a violation. Self-correct by restarting at Design Brief.

## Mode Deactivation

Debug mode off phrases (any of the following):
- "exit debug mode"
- "debug mode off"

Design mode off phrases (any of the following):
- "exit frontend design mode"
- "design mode off"

If the user asks to skip a protocol while a mode is active, you MUST require an
explicit deactivation phrase before reverting to default behavior. Inline "just
skip it" requests do not deactivate a mode.

---------------------------------------------------------
SCREENSHOT LOOP (PUPPETEER)
---------------------------------------------------------

Purpose:
  Agent-driven visual iteration workflow:
    Pass 1: capture routes → diff vs targets → report mismatches
    Claude: reads report → patches UI code
    Pass 2: recapture → verify fixes landed

  The script does NOT modify code. Code fixes are Claude's job.
  The loop is: capture → agent fixes → recapture.

Commands:
  pnpm shot:once   # single capture pass of all routes
  pnpm shot:loop   # pass 1 capture + diff report + pass 2 recapture
  pnpm shot:clean  # wipe temporary_screenshots/

Folder:
  temporary_screenshots/   (gitignored, delete freely)

Naming convention:
  <route>__pass<N>__<section|full>__<timestamp>.png

  Examples:
    root__pass1__full__20260301T120000.png
    dashboard__pass2__full__20260301T120015.png
    dashboard__pass1__hero__20260301T120000.png  (when SELECTORS used)
    dashboard__diff.png                          (pixel diff artifact)

Viewport (fixed, deterministic):
  1440x900 @ 2x device pixel ratio

Optional targets:
  Drop reference PNGs into brand_assets/target_screens/<route>__target.png
  e.g.  brand_assets/target_screens/dashboard__target.png
  The loop computes pixel diff (%) and writes a visual diff PNG.
  Without targets, shot:loop runs a sanity double-capture only.

Environment overrides:
  BASE_URL=http://localhost:3000   (default)
  ROUTES=/,/dashboard              (comma-separated, default)
  SELECTORS=                       (comma-separated CSS selectors; empty = full page only)
  DIFF_THRESHOLD=2                 (% pixel diff to flag; default 2)
  WAIT_MS=250                      (ms to settle after page load; default 250)
  WAIT_UNTIL=networkidle0          (Puppeteer waitUntil strategy; default networkidle0)

Cleanup:
  pnpm shot:clean wipes the folder entirely.
  Delete old screenshots regularly — they accumulate fast.

---------------------------------------------------------
END OF FILE
---------------------------------------------------------
