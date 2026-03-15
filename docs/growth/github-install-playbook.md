# CostGuardAI — GitHub Search Acquisition Playbook

**Version:** 1.0
**Goal:** First 1,000 installs. Zero paid marketing. Zero spam.
**Operator:** Founder-led. Every outreach must be technically credible.

---

## Table of Contents

1. [Goal](#1-goal)
2. [Ideal Repo Profile](#2-ideal-repo-profile)
3. [Ideal Developer Signals](#3-ideal-developer-signals)
4. [GitHub Search Queries](#4-github-search-queries)
5. [Target Keywords](#5-target-keywords)
6. [README Phrases to Target](#6-readme-phrases-to-target)
7. [File and Folder Patterns to Target](#7-file-and-folder-patterns-to-target)
8. [Signs a Repo Needs CostGuardAI Now](#8-signs-a-repo-needs-costguardai-now)
9. [Prioritization Rubric](#9-prioritization-rubric)
10. [Opportunity Scoring Framework](#10-opportunity-scoring-framework)
11. [Manual Outreach Workflow](#11-manual-outreach-workflow)
12. [Message Templates](#12-message-templates)
13. [Non-Spam Contribution Strategy](#13-non-spam-contribution-strategy)
14. [Badge Adoption as Discovery Signal](#14-badge-adoption-as-discovery-signal)
15. [Daily Workflow](#15-daily-workflow)
16. [Tracking Schema](#16-tracking-schema)

---

## 1. Goal

Find 10–20 high-quality GitHub repositories per day where developers are:
- building real LLM-powered products
- visibly struggling with cost, reliability, or prompt quality
- already using CI/GitHub Actions (adoption path exists)
- likely to try a CLI tool or GitHub Action that takes under 5 minutes to install

The goal is not volume. The goal is precision.
One genuine install from a well-matched repo beats 100 cold messages to random repos.

**Primary acquisition metric:** Repos with `costguard.yml` or CostGuardAI badge in README.
**Secondary metric:** CLI runs in CI pipelines (verifiable via badge or PR comments).

---

## 2. Ideal Repo Profile

A high-value target has most of these properties:

| Property | Why it matters |
|---|---|
| Active commits in last 30 days | Project is alive and being shipped |
| 50–5,000 stars | Real project, but founder is still accessible |
| LLM API calls in source code | Direct cost exposure |
| Prompts stored as files or constants | Testable artifact |
| Existing `.github/workflows/` | CI adoption path already open |
| Issue tracker active | Maintainer is responsive |
| README mentions production use | Real deployment risk |
| Uses OpenAI, Anthropic, Gemini, or Cohere | Direct cost surface |
| Agent or multi-step LLM workflow | Higher failure risk, higher CostGuardAI value |
| Eval or testing infrastructure | Signals quality-conscious developer |

**Anti-targets (skip):**

- Archived or stale repos (no commits in 90+ days)
- Pure research papers with no usable code
- Tutorial/demo repos with no production intent
- Enterprise repos with no accessible maintainer
- Repos already using a competing prompt analysis tool

---

## 3. Ideal Developer Signals

Search for developers who exhibit these behaviors in their commit history, issues, or README:

**Cost signals:**
- Mentions "token limits", "context window", "cost per request", or "rate limits"
- Has a `models.ts`, `config.py`, or similar file with model names and pricing comments
- Open issues about "unexpected API costs" or "billing surprise"

**Quality signals:**
- Has a `prompts/` or `evals/` directory
- Has a `system_prompt.txt` or `prompt_template.md`
- Writes about hallucination, reliability, or output consistency
- Has tried to write their own prompt linting or validation

**Workflow signals:**
- Already has `.github/workflows/` (CI path is ready)
- Uses `pre-commit` hooks
- Has a `Makefile` or `justfile` with test commands
- Issues labeled `bug`, `reliability`, or `ai-quality`

**Safety signals:**
- Mentions prompt injection or jailbreak in README or issues
- References safety, guardrails, or moderation
- References output validation or structured output enforcement

---

## 4. GitHub Search Queries

All queries are usable directly in GitHub's code search (`github.com/search`).
Use `Sort: Recently indexed` or `Sort: Best match` depending on context.

### 4.1 — Prompt File Searches

```
filename:system_prompt.txt
filename:system_prompt.md
filename:prompt_template.txt
filename:prompt_template.md
filename:prompts.ts openai OR anthropic
filename:prompts.py openai OR anthropic
path:prompts/ extension:txt openai
path:prompts/ extension:md anthropic
path:prompts/ extension:json model
```

### 4.2 — LLM SDK Usage Searches

```
"openai.chat.completions.create" language:Python stars:>20
"anthropic.messages.create" language:TypeScript stars:>10
"ChatOpenAI" langchain language:Python stars:>50
"ChatAnthropic" langchain stars:>10
"useChat" vercel ai sdk language:TypeScript
"createOpenAI" "ai" language:TypeScript
"VertexAI" OR "genai" language:Python
"AzureOpenAI" language:Python OR language:TypeScript
```

### 4.3 — Agent and Workflow Searches

```
"LangChain" "AgentExecutor" language:Python stars:>30
"langgraph" language:Python stars:>20
"autogen" "openai" language:Python stars:>50
"crewai" language:Python
"phidata" language:Python
"llama_index" OR "llama-index" language:Python stars:>30
"semantic_kernel" language:Python OR language:CSharp
"toolcalling" OR "tool_calling" openai language:Python
"function_calling" anthropic language:Python
"chain" langchain "prompt" language:Python stars:>20
```

### 4.4 — RAG and Embedding Searches

```
"retrieval augmented generation" language:Python
"chromadb" OR "pinecone" "openai" language:Python stars:>20
"weaviate" "embeddings" language:Python
"pgvector" "openai" language:TypeScript OR language:Python
"qdrant" "embeddings" language:Python
"faiss" "openai" language:Python stars:>30
"vector_store" OR "vectorstore" openai language:Python
```

### 4.5 — Eval and Testing Searches

```
"promptfoo" language:YAML OR language:TypeScript
path:.github/workflows/ "llm" OR "openai" OR "anthropic"
"evals" "openai" language:Python stars:>30
"pytest" "mock_openai" language:Python
"braintrust" "openai" language:TypeScript
filename:evals.yaml
path:evals/ extension:json
"assert_output" OR "assert_response" llm language:Python
```

### 4.6 — Prompt Injection and Safety Searches

```
"prompt injection" language:Python OR language:TypeScript
"jailbreak" "llm" language:Python
"guardrails" "openai" language:Python
"output validation" llm language:Python
"nemo guardrails" language:Python
"rebuff" language:Python
"llm-guard" language:Python
```

### 4.7 — Cost and Token Searches

```
"token_count" openai language:Python
"tiktoken" language:Python OR language:TypeScript
"count_tokens" anthropic language:Python
"max_tokens" openai language:Python OR language:TypeScript stars:>20
"cost_per_token" language:Python
"usage.total_tokens" language:Python
"context_window" language:Python OR language:TypeScript
```

### 4.8 — GitHub Actions / CI Integration Searches

```
path:.github/workflows/ "openai" language:YAML
path:.github/workflows/ "anthropic" language:YAML
path:.github/workflows/ "langchain" language:YAML
path:.github/workflows/ "llm" language:YAML
filename:costguard.yml (track adoption)
```

### 4.9 — README Text Searches

```
"powered by OpenAI" in:readme stars:>30
"uses GPT-4" in:readme stars:>20
"Anthropic Claude" in:readme stars:>20
"LLM-powered" in:readme stars:>30
"RAG pipeline" in:readme stars:>20
"prompt engineering" in:readme stars:>50
"AI agent" in:readme stars:>50
"production LLM" in:readme
"fine-tuned" openai in:readme stars:>30
"context window" in:readme stars:>20
"token budget" in:readme
"prompt template" in:readme stars:>20
```

### 4.10 — Framework-Specific Searches

```
"from langchain" "ChatOpenAI" language:Python stars:>30 pushed:>2025-01-01
"import anthropic" language:Python pushed:>2025-01-01 stars:>20
"from openai import" "system" "user" language:Python pushed:>2025-06-01
"@ai-sdk/openai" language:TypeScript pushed:>2025-01-01
"openrouter" language:Python OR language:TypeScript
"together_ai" language:Python
"replicate" "run" language:Python OR language:TypeScript stars:>30
```

---

## 5. Target Keywords

These terms in repo names, descriptions, topics, or READMEs indicate a high-value match:

**Tier 1 — Strongest signals:**
- `llm-app`, `llm-agent`, `llm-pipeline`
- `ai-assistant`, `ai-agent`, `ai-workflow`
- `prompt-engineering`, `prompt-testing`
- `rag-pipeline`, `rag-app`
- `openai-wrapper`, `anthropic-wrapper`
- `langchain-app`, `langchain-agent`
- `evals`, `llm-evals`, `prompt-evals`

**Tier 2 — Strong signals:**
- `chatbot`, `copilot`, `ai-search`
- `document-qa`, `pdf-chat`, `chat-with-docs`
- `code-generation`, `ai-coder`
- `voice-ai`, `speech-to-text` (if LLM post-processing)
- `structured-output`, `function-calling`

**Tier 3 — Moderate signals (confirm LLM usage):**
- `automation`, `workflow` (check for LLM usage inside)
- `search`, `semantic-search`
- `summarization`, `document-processing`
- `customer-support`, `helpdesk` (often LLM-backed)

---

## 6. README Phrases to Target

These phrases in a README are strong indicators the repo would benefit from CostGuardAI:

**Cost risk phrases:**
- "API costs can be high"
- "watch your token usage"
- "expensive if used heavily"
- "keep an eye on your OpenAI bill"
- "context window limitations"
- "token budget"
- "truncat" (truncation mention)

**Quality risk phrases:**
- "sometimes hallucinates"
- "prompt quality matters"
- "results may vary"
- "not guaranteed to be accurate"
- "prompt injection is a known risk"
- "validate the output before"
- "may produce unexpected results"

**Safety awareness phrases:**
- "jailbreak"
- "adversarial"
- "system prompt leakage"
- "prompt injection"
- "red teaming"
- "responsible AI"

**Production intent phrases:**
- "in production"
- "deployed at"
- "serving X users"
- "production-ready"
- "battle-tested"

---

## 7. File and Folder Patterns to Target

Search for these file/folder patterns as confirmation of high-value repos:

```
prompts/
├── system_prompt.txt       ← Testable with costguard CLI
├── user_templates/
├── few_shot_examples.json
└── chains/

evals/
├── test_cases.json
├── golden.json             ← Already doing eval discipline
└── fixtures/

.github/
├── workflows/
│   ├── test.yml            ← CI adoption path open
│   └── lint.yml

config/
├── models.py               ← Model config = cost consciousness
├── llm_config.ts
└── ai_settings.json

src/
├── agents/                 ← Agent complexity = higher risk
├── chains/
├── tools/
└── memory/
```

**Single-file signals:**
- `system_prompt.txt` at repo root
- `PROMPTS.md`
- `prompts.yaml`
- `llm_config.py`
- `.env.example` with `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

---

## 8. Signs a Repo Needs CostGuardAI Now

These are real, observable conditions that mean immediate value:

**Immediate pain:**
1. README says "prompts are stored in `/prompts`" but no validation exists
2. Open issue: "AI costs are unpredictable" or "got a big OpenAI bill"
3. CI pipeline exists but no prompt quality step
4. Repo uses multiple LLM models with no comparative cost analysis
5. System prompts are longer than 2,000 tokens (visible in source files)
6. Prompts concatenate user input without sanitization
7. Codebase builds prompts dynamically with string interpolation
8. No token counting anywhere in codebase (`tiktoken` absent)
9. Prompts change frequently (high commit velocity on prompt files)
10. Repo mentions "we kept hitting context limits" in issues or commits

**Structural risks:**
1. Agent loops with no token budget enforcement
2. Retrieval-augmented prompts with no length cap
3. User-supplied content injected into system prompts
4. No output validation before storing or displaying LLM responses
5. Model hardcoded to GPT-4/Claude 3 Opus for every request (cost blowup risk)

---

## 9. Prioritization Rubric

Use this to rank repos for outreach time investment.

| Criterion | 1 (Low) | 3 (Medium) | 5 (High) |
|---|---|---|---|
| **Project activity** | No commits in 60+ days | Commits within 30 days | Commits within 7 days |
| **LLM evidence** | Keyword mention only | SDK imported, calls exist | Prompts in repo + API calls in CI |
| **Production intent** | Tutorial/demo | Staged/beta deployment | Explicitly in production |
| **Safety/cost pain** | No signal | Mild awareness in README | Open issue, PR, or commit about it |
| **Tooling openness** | No existing dev tools | Some linting or testing | Active CI, pre-commit hooks, evals |

**Score interpretation:**
- **21–25:** Priority 1 — Reach out within 24 hours
- **16–20:** Priority 2 — Reach out within 48 hours
- **11–15:** Priority 3 — Queue for next week
- **6–10:** Priority 4 — Monitor; revisit in 30 days
- **1–5:** Skip

---

## 10. Opportunity Scoring Framework

Rate each repo 1–5 on these five dimensions. Total = opportunity score out of 25.

### Dimension A — Active Project

| Score | Definition |
|---|---|
| 5 | Commit in last 7 days, active issues/PRs |
| 4 | Commit in last 30 days |
| 3 | Commit in last 60 days |
| 2 | Commit in last 90 days |
| 1 | Stale or archived |

### Dimension B — Public LLM Evidence

| Score | Definition |
|---|---|
| 5 | Prompt files, SDK calls, model config all visible |
| 4 | SDK imported + API calls in source |
| 3 | API key in `.env.example`, SDK in dependencies |
| 2 | LLM mentioned in README only |
| 1 | Indirect inference only |

### Dimension C — Production Intent

| Score | Definition |
|---|---|
| 5 | Explicitly says "in production", has users/customers |
| 4 | Has deploy config (`Dockerfile`, `railway.toml`, `vercel.json`) |
| 3 | Beta or staging environment visible |
| 2 | Working demo, no deployment signal |
| 1 | Prototype/tutorial/sandbox |

### Dimension D — Safety or Cost Pain Signal

| Score | Definition |
|---|---|
| 5 | Open issue about cost, truncation, or prompt failure |
| 4 | README warns about cost/quality; no active issue |
| 3 | Prompts are complex but no explicit mention |
| 2 | LLM usage is simple, low risk |
| 1 | No pain signal visible |

### Dimension E — Openness to Tooling

| Score | Definition |
|---|---|
| 5 | Active CI, evals, pre-commit hooks, existing linting |
| 4 | Has `.github/workflows/` with tests |
| 3 | Has a `Makefile` or test suite |
| 2 | No CI but maintainer seems quality-focused |
| 1 | Appears to resist external tooling |

---

## 11. Manual Outreach Workflow

### Step 1 — Qualify (5 min per repo)

Before any outreach:
1. Confirm repo is active (last commit date)
2. Confirm LLM usage is real (find the API calls)
3. Read README for context and maintainer voice
4. Check issues for existing pain
5. Score using Dimension A–E above
6. Only proceed if total score ≥ 14

### Step 2 — Test the repo (10 min per repo)

Run CostGuardAI on their actual prompts:
```bash
costguard analyze --file path/to/their/system_prompt.txt
```

Screenshot or save the output. If the report shows:
- Risk score ≥ 50, or
- Token count near their model's context window, or
- Any structural risk flag

...you have a genuine, specific, credible reason to reach out.

**Do not reach out without running an actual analysis.** This is the core of your credibility.

### Step 3 — Draft outreach

Pick the appropriate template (Section 12) based on context:
- Found a specific risk → Template C (value-first)
- Maintainer is active on issues → Template A (issue/comment)
- Smaller repo, maintainer email visible → Template B (DM/email)

Customize. Never copy-paste without editing.

### Step 4 — Send

- For issues: Only comment on issues where your contribution is directly relevant
- For DMs: Keep it under 150 words
- For emails: Subject line must contain the repo name

### Step 5 — Log and track

Record in the tracking sheet (Section 16).
Follow up once if no response after 7 days.
Never follow up more than once.

---

## 12. Message Templates

### Template A — Issue/Comment Style

Use when: There is an open issue about cost, quality, or prompt reliability.

```
Hey — I was looking at this issue and ran your system prompt through
CostGuardAI, a preflight tool that scores LLM prompts for risk before
they hit production.

Relevant finding: [specific result — e.g., "your prompt uses ~3,800 tokens
with GPT-4, which puts context usage at 47%. If retrieved docs are appended,
truncation risk is high."]

If it's useful, the CLI is free to try: https://costguardai.io/docs/getting-started

Happy to share the full report if helpful.
```

**Rules:**
- Only comment on issues where you have a specific, relevant finding.
- Do not open a new issue to promote the tool.
- Do not comment on closed issues.

---

### Template B — Maintainer DM or Email Style

Use when: Smaller repo (< 500 stars), maintainer email or Twitter/X visible.

**Subject:** `CostGuardAI report for [repo-name]`

```
Hi [name],

I ran a quick preflight analysis on [repo-name] using CostGuardAI —
a CLI tool that scores prompts for jailbreak risk, truncation, and cost
efficiency before deployment.

Your [system_prompt.txt / main prompt] scored [X]/100 Safety Score.
The main flag was [specific finding — e.g., "ambiguous instruction boundary
creates medium jailbreak risk"].

Thought it might be worth a look: [link to shareable report or docs]

No obligation — just thought it might be useful given the work you're doing.

[Your name]
```

**Rules:**
- Reference the specific prompt file you analyzed.
- Include the actual score.
- Keep total length under 150 words.
- Never CC anyone else.

---

### Template C — Value-First: "I Found a Risk" Style

Use when: You found a specific, concrete risk in their public prompt files.

```
Hi [name],

I was working through some public LLM repos and ran [repo-name]'s prompts
through CostGuardAI. Found something worth flagging:

**Risk:** [Specific risk — e.g., "User input is interpolated directly into
the system role with no sanitization. This creates a medium-severity prompt
injection surface."]

**Safety Score:** [X]/100 ([band — e.g., Needs Hardening])

Full report: [share link from costguardai.io/report/...]

This is genuinely free to check — no pitch here. Just thought a flag like
this is worth knowing before it reaches production.

[Your name]
```

**Rules:**
- The risk must be real and specific.
- Include a shareable report link — not a marketing page.
- Do not follow up if they don't respond.
- Never exaggerate risk severity to create urgency.

---

### Anti-patterns — Never Do These

- "Hey, I built a tool you might love!" (no value, no credibility)
- Opening a new GitHub issue titled "Have you tried CostGuardAI?"
- Commenting on random issues unrelated to cost/quality
- Copy-pasting the same message to 50 repos
- Claiming a fake identity or fake usage
- Following up more than once
- Using urgency or fear language without a real finding

---

## 13. Non-Spam Contribution Strategy

Instead of cold outreach, earn install intent through genuine contribution.

### 13.1 — Contribute a `.github/workflows/costguard.yml` example

For repos that already have `.github/workflows/` and use LLMs:
1. Fork the repo
2. Add a non-breaking `costguard.yml` workflow in `.github/workflows/`
3. Open a PR titled: `Add CostGuardAI preflight step for LLM prompts`
4. PR description must explain what it does and what it found during testing

Only do this if:
- The repo already has CI (non-intrusive addition)
- You have tested the workflow and it produces a relevant result
- The PR adds real value independent of any promotion

### 13.2 — Add to `awesome-*` lists

Find curated lists:
- `awesome-langchain`
- `awesome-llm-tools`
- `awesome-prompt-engineering`
- `awesome-ai-safety`
- `awesome-llmops`

Open a PR adding CostGuardAI under the relevant category with a factual, concise description. Do not over-sell. Let the category speak.

### 13.3 — Answer real questions on issues

Search GitHub Issues for:
```
"how do I reduce token costs" is:open
"prompt injection" is:open "how to prevent"
"context window" is:open "exceeds" OR "too long"
"llm cost" is:open "expensive"
```

Answer the question directly. Mention CostGuardAI only if it is the most direct answer and only after solving the question.

### 13.4 — Publish benchmark reports

When CostGuardAI's Safety Score catches a real-world risk pattern:
- Write a short technical post (Twitter/X, dev.to, or HN)
- Reference the pattern hash (never the prompt)
- Link to the methodology: `costguardai.io/methodology`

This pulls developers to you rather than pushing outreach.

---

## 14. Badge Adoption as Discovery Signal

Once repos start adding the CostGuardAI badge to their README:

```markdown
[![CostGuardAI](https://costguardai.io/badge.svg)](https://costguardai.io)
```

Use the badge as a discovery mechanism:

### 14.1 — Track badge adopters

Search weekly:
```
"costguardai.io/badge" in:readme
```

When a new repo appears:
1. Star the repo
2. Thank the maintainer with a brief, genuine note
3. Ask if they'd share feedback on what made them install

### 14.2 — Referral expansion

When you find a badge adopter:
1. Check their GitHub followers and repos they contribute to
2. Look for forks and dependent repos
3. Those developers are warm — reach out with Template B referencing the mutual connection

### 14.3 — Public leaderboard or showcase

Maintain a `ADOPTERS.md` or showcase page listing projects using CostGuardAI (with permission).
This creates social proof for future outreach: "Here are 20 projects already running preflight checks."

---

## 15. Daily Workflow

**Time budget: 45–60 minutes per day**

### Morning — Discovery (20 min)

Run 3–5 GitHub searches from Section 4 (rotate through query groups daily).
For each result page, scan the first 10–15 repos.
Qualify quickly (Section 11, Step 1): active? LLM usage confirmed?
Add qualified repos to tracking sheet with initial score.

**Target:** 10–20 qualified candidates in tracking sheet.

### Midday — Analysis (15 min)

Pick the 3–5 highest-scoring repos from your queue.
Run `costguard analyze` on their prompt files.
Generate shareable reports.
Note specific findings in tracking sheet.

**Target:** 3–5 repos with real analysis results.

### Afternoon — Outreach (15 min)

Send 1–3 outreach messages to highest-value repos with specific findings.
Use the appropriate template.
Log outreach in tracking sheet.

**Target:** 1–3 outreach messages sent, each with a specific finding attached.

### Weekly Review (30 min on Fridays)

- Review responses: what worked, what didn't
- Rotate search query groups to avoid pattern fatigue
- Update scoring rubric if new signal types emerge
- Check for badge adopters (`"costguardai.io/badge" in:readme`)
- Remove dead repos from queue

**Weekly targets:**
- 5–15 outreach messages sent
- 2–5 responses received
- 1–3 installs or expressed interest

---

## 16. Tracking Schema

Use a spreadsheet, Notion database, Airtable, or plain CSV. Columns:

| Column | Type | Notes |
|---|---|---|
| `repo` | Text | `owner/repo-name` |
| `owner` | Text | GitHub username |
| `stars` | Number | At time of discovery |
| `last_commit` | Date | From GitHub repo page |
| `commit_recency_days` | Number | Days since last commit |
| `llm_signal` | 1–5 | Dimension B score |
| `pain_signal` | 1–5 | Dimension D score |
| `total_score` | Number | Sum of all 5 dimensions (out of 25) |
| `contact_path` | Select | Issue / DM / Email / PR |
| `contact_handle` | Text | GitHub handle or email |
| `outreach_date` | Date | When message was sent |
| `outreach_type` | Select | Template A / B / C |
| `specific_finding` | Text | The actual risk found |
| `safety_score` | Number | CostGuardAI score for their prompt |
| `report_link` | URL | Shareable costguardai.io/report/... |
| `outreach_status` | Select | Not started / Sent / Responded / Installed / Declined / No response |
| `response` | Text | Summary of their response |
| `install_likelihood` | 1–5 | Your estimate after interaction |
| `follow_up_date` | Date | One follow-up max, 7 days after first |
| `notes` | Text | Any relevant context |

**CSV Header:**
```
repo,owner,stars,last_commit,commit_recency_days,llm_signal,pain_signal,total_score,contact_path,contact_handle,outreach_date,outreach_type,specific_finding,safety_score,report_link,outreach_status,response,install_likelihood,follow_up_date,notes
```

---

## Appendix A — Top 10 Highest-Value Search Queries

Ranked by signal strength, specificity, and actionability:

1. `filename:system_prompt.txt` — Direct prompt file; immediately testable with CLI
2. `"openai.chat.completions.create" language:Python stars:>20 pushed:>2025-01-01` — Active Python LLM apps
3. `path:.github/workflows/ "openai" language:YAML` — CI-ready repos with LLM usage
4. `"tiktoken" language:Python OR language:TypeScript pushed:>2025-01-01` — Token-aware devs; already cost-conscious
5. `"langchain" "AgentExecutor" language:Python stars:>30` — Agent complexity = highest failure risk
6. `"prompt injection" language:Python OR language:TypeScript` — Safety-aware; most likely to value Safety Score
7. `"max_tokens" openai language:TypeScript stars:>20` — Explicit token management = cost pain awareness
8. `"evals" "openai" language:Python stars:>30` — Eval discipline = quality-conscious; high tool adoption
9. `"RAG pipeline" in:readme stars:>20` — Production RAG = retrieval prompt risk + context overflow risk
10. `"context window" is:open` (Issues search) — Active pain point; outreach timing is perfect

---

## Appendix B — Query Rotation Schedule

Avoid running the same queries daily (GitHub rate limits + diminishing returns).

| Day | Query Group |
|---|---|
| Monday | Prompt file searches (4.1) + README text searches (4.9) |
| Tuesday | LLM SDK searches (4.2) + Cost/token searches (4.7) |
| Wednesday | Agent/workflow searches (4.3) + GitHub Actions searches (4.8) |
| Thursday | RAG searches (4.4) + Prompt injection/safety searches (4.6) |
| Friday | Eval searches (4.5) + Framework-specific searches (4.10) + badge check |

---

## Appendix C — Tracking Health Metrics

Check these weekly to know if the playbook is working:

| Metric | Target (Week 1–4) | Target (Week 5–12) |
|---|---|---|
| Repos qualified per day | 10–20 | 15–25 |
| Outreach sent per week | 5–10 | 10–20 |
| Response rate | ≥ 20% | ≥ 25% |
| Install rate (of responses) | ≥ 15% | ≥ 20% |
| Badge adopters | 1–3 | 5–15 |
| CLI runs visible in CI | 0–2 | 5–20 |

If response rate drops below 15%, the findings are not specific enough. Improve analysis depth before sending more outreach.

If install rate drops below 10%, the onboarding path is too long. Review the CLI getting-started experience.

---

*Last updated: 2026-03-13*
*Owner: Founder*
*Review cadence: Monthly*
