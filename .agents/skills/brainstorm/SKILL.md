---
name: brainstorm
description: Structured feature ideation skill. Produces a 7-section decision document before any code is written. Use when the user says "let's add", "should we", "design a", "how should we approach", or for any feature spanning more than one module.
license: MIT
metadata:
  author: project
  version: "1.0.0"
---

# Brainstorm

Meta-skill for designing features before coding. Produces a decision document, not code.

## When to Apply

Invoke this skill when:

- The user says "let's add", "should we", "design a", or "how should we approach"
- A feature touches more than one module or package
- The approach is unclear and at least 3 viable options exist
- There is a meaningful trade-off between complexity, correctness, and effort

**Do not write code during a brainstorm session. Produce the decision document and wait for the user to approve the Decision section before switching to an implementation skill.**

## Session Template (7 Sections)

Fill in all 7 sections. Do not skip any.

### 1. Problem Statement
What breaks or is missing without this feature? State it in one paragraph.

### 2. Constraints
| Type | Constraint |
|------|-----------|
| Hard | UNIQUE constraints, 5 s webhook SLA, `packages/shared` must remain framework-free |
| Hard | _(add project-specific hard constraints here)_ |
| Soft | _(performance targets, team conventions, deployment window)_ |

### 3. Option Space
Minimum 3 options. Always include "do nothing" as an option.

| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| Do nothing | Zero cost | Problem persists | — |
| Option A | … | … | S/M/L |
| Option B | … | … | S/M/L |

### 4. Decision and Rationale
State the chosen option and explain what was ruled out and why.

### 5. Risks and Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| … | Low/Med/High | Low/Med/High | … |

### 6. Implementation Checklist
Ordered steps. Each step names the files it touches.

1. Step one — `packages/shared/src/enums.ts`
2. Step two — `apps/api/src/modules/export/…`
3. …

### 7. Open Questions
Items requiring product, security, or infra decisions before coding can begin.

- [ ] Question one
- [ ] Question two

---

See `AGENTS.md` for a worked example and guidance on running an effective brainstorm session.
