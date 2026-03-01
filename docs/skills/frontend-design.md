# Frontend Design Skill

## Mode Contract
When Frontend Design Mode is active:
- You MUST state aesthetic direction BEFORE writing any code.
- You MAY NOT output generic UI patterns as default.
- You MUST complete the Design Brief and Aesthetic Direction sections before the component plan.
- Code output must be production-ready; no placeholders unless explicitly requested.

---

## Hard Bans

The following are FORBIDDEN as defaults:
- Inter / Roboto / Arial / system-ui as the primary typeface (unless user explicitly requests)
- Generic "AI SaaS" gradient hero cards with blur blobs
- Bento grid layouts used as default structure
- Glass morphism cards as default treatment
- Vague direction like "clean" or "minimal" without a concrete visual rationale
- Placeholder copy (Lorem ipsum, "Title here", "Description goes here")
- Template or library dump without explicit rationale tied to Design Brief

---

## Required Output Format

Every frontend design task MUST produce sections in this order:

**A) Design Brief**
- Purpose: what this UI does functionally
- Audience: who uses it and in what context
- Tone: 2–3 adjectives (e.g., precise, authoritative, utilitarian)
- Constraints: technical or brand constraints (dark mode only, no animation, etc.)
- Differentiation: what makes this NOT generic AI SaaS UI

**B) Aesthetic Direction**
5 bullets covering:
1. Typography approach (typeface choice + rationale)
2. Color approach (palette intent, not hex values)
3. Spacing philosophy (dense vs. airy, and why)
4. Motion / interaction stance (what moves, what doesn't)
5. Background / surface texture or detail approach

**C) Component Plan**
- Page sections listed in hierarchy
- Component breakdown per section
- Interaction states noted

**D) Production-Grade Code Output**
- Working code, no placeholders
- Tailwind classes consistent with project spacing/type scale
- Follows CLAUDE.md design discipline rules

**E) QA Checklist**
- [ ] Responsive at mobile / tablet / desktop
- [ ] No placeholder text in output
- [ ] Keyboard navigable interactive elements
- [ ] Focus states visible
- [ ] Hover/active states implemented
- [ ] Color contrast meets AA minimum
- [ ] No banned patterns used

---

## Delivery Standard

- Output must work as written.
- No "you can customize this later" hedges.
- No generic component libraries dropped in without rationale.
- Every visual decision must connect to the Design Brief.
- If constraints require a library, justify it in Design Brief.
