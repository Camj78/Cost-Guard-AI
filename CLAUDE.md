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

D1 — Auth + Saved State          ✓ Complete
D2 — Usage gating + Pro tier     ✓ Complete
D3 — Public API endpoint
D4 — CLI wrapper
D5 — Shareable analysis links
D6 — Risk intelligence refinement
D7 — Marketing + distribution engine

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
END OF FILE
---------------------------------------------------------
