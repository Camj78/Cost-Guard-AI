# CostGuard — GitHub Growth Engine

Distribution strategy for organic developer installs via GitHub-native surfaces.

---

## 1. GitHub Topic List

Add these topics to the `costguardai/costguard` repository
(Settings → Topics):

```
ai-devtools
llm-security
prompt-engineering
ai-cost-optimization
devops-ai
llm-infrastructure
prompt-safety
developer-tools
openai
langchain
rag
llm-ops
github-actions
ci-cd
```

Topics drive discovery from GitHub search and the "Topics" explore page.
`prompt-safety` and `llm-security` have low competition — own them early.

---

## 2. PR Comment Template

Posted by `costguardai/prompt-scan@v1` when risk threshold is exceeded.
The `<!-- costguard-prompt-scan -->` marker makes it idempotent (updates in place).

```markdown
<!-- costguard-prompt-scan -->
## CostGuard Prompt Safety Report

> Preflight analysis by [CostGuard](https://costguardai.io) — run before you ship.

| File | Safety Score | Risk Band | Est. Cost / 1k calls |
|------|-------------|-----------|----------------------|
| `prompts/system.prompt` | **41 / 100** | Needs Hardening | $0.0082 |

**Build blocked** — safety score below threshold (75).

### Top Risk Drivers

- Instruction ambiguity `+18 pts`
- Token concentration `+12 pts`
- Output length unspecified `+9 pts`

### Recommendation

Add explicit output constraints and reduce prompt length.

```bash
costguard analyze prompts/system.prompt
```

→ [View full report](https://costguardai.io/s/abc123) · [Docs](https://costguardai.io/docs/github-action)

---
*Powered by [CostGuard](https://costguardai.io) · [Add to your repo in 60 seconds](https://costguardai.io/docs/github-action)*
```

---

## 3. Repo Discovery Search Queries

Use these GitHub search queries to find repositories likely to need CostGuard.
Target repos with prompt files, LLM integrations, or active AI engineering.

### High-signal queries

```
language:TypeScript "openai" path:**/*.prompt
language:Python "langchain" path:**/prompts/**
language:Python "from openai import" stars:>50
"rag pipeline" language:Python stars:>20
"prompt engineering" language:TypeScript
"gpt-4o" language:Python pushed:>2025-01-01
"anthropic" "system_prompt" language:Python
"ChatOpenAI" path:*.py stars:>30
"openai.chat.completions" stars:>10
"langchain" "PromptTemplate" stars:>50
"llm" "system" "user" path:**/*.ts
topic:llm-ops stars:>10
topic:rag stars:>5
topic:prompt-engineering pushed:>2025-01-01
```

### Filtering criteria

Prioritize repos that:
- Have `.prompt` files or a `prompts/` directory
- Import `openai`, `anthropic`, or `langchain`
- Have CI already (`.github/workflows/`) — easier adoption
- Are actively maintained (`pushed:` within 3 months)
- Have 10–500 stars (early adopters, not enterprises)

---

## 4. Outreach Playbook

Safe, high-signal outreach that adds value without spamming.

### When to open an issue

Open an issue when a repo:
- Has prompt files without a CI safety check
- Uses LLM APIs directly in production code
- Has no existing prompt linting or cost monitoring

**Issue title:**
```
Suggestion: add CostGuard prompt safety checks to CI
```

**Issue body template:**

```markdown
Hi — I noticed this project uses [OpenAI / LangChain / Anthropic] prompts
in production. Thought this might be useful:

**CostGuard** is a free CI tool that scans prompt files on every PR and
flags cost spikes, token overflow, and safety risks before they hit prod.

Takes ~60 seconds to add:

```yaml
# .github/workflows/costguard.yml
- uses: costguardai/prompt-scan@v1
  with:
    api_key: ${{ secrets.COSTGUARD_API_KEY }}
    risk_threshold: 75
```

→ [Docs](https://costguardai.io/docs/github-action) · [Get API key (free)](https://costguardai.io)

Feel free to close if not relevant. Happy to answer questions.
```

### Rules

- One issue per repo. Never re-open if closed.
- No automated mass-posting. Manual, targeted outreach only.
- Only open issues on repos with clear LLM usage evidence.
- Do not post on repos with `>1000 stars` without a warm intro — go through
  the maintainer's social presence instead.
- Always be specific: mention the file or pattern you noticed.

### When to open a PR instead

Open a PR (not an issue) when:
- The repo has no existing CI at all
- You can add `costguard.yml` with zero breaking changes
- The PR description follows the issue template above

---

## 5. Viral Loop Mechanic

The badge spreads CostGuard organically:

```markdown
[![CostGuard Safety Score](https://costguardai.io/badge/prompt-scan)](https://costguardai.io)
```

Every repo that adds the badge becomes a distribution node.
Badge clicks → landing page → install loop.

Reinforce the loop:
- Mention the badge in PR comment footer (already in template above)
- Add badge to example repos
- Reference it in the getting-started docs

---

## 6. Example Repository Structure

Reference: `github-action/examples/` in this repo.

```
github-action/examples/
  openai/
    system.prompt           ← example prompt file
    costguard-report.json   ← sample analysis output
    costguard.yml           ← CI workflow
  langchain/
    chain.prompt
    costguard.yml
  rag/
    retrieval.prompt
    costguard.yml
  agents/
    agent.prompt
    costguard.yml
  blocking.yml              ← threshold-blocking template
  soft-mode.yml             ← report-only template
```

Each example demonstrates:
- A realistic prompt file for that use case
- The recommended `risk_threshold` for that prompt category
- How to wire up CI in that context

Thresholds by category:

| Category | Recommended threshold | Rationale |
|----------|----------------------|-----------|
| Simple system prompts | 75 | Low complexity, strict standard |
| LangChain chains | 70 | Variable injection increases risk |
| RAG prompts | 65 | Retrieved chunks can cause token explosion |
| Agent prompts | 60 | Tool access amplifies failure cost |
