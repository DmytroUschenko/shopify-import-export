# Brainstorm Skill

Meta-skill for designing features before coding. Produces a 7-section decision document.

## What It Produces

A filled decision document with:
1. Problem Statement
2. Constraints (hard vs soft)
3. Option Space (min 3 options, including "do nothing")
4. Decision and Rationale
5. Risks and Mitigations
6. Implementation Checklist (file-level steps)
7. Open Questions

## What It Does NOT Produce

Code. This skill ends when the user approves §4 (Decision). Implementation begins in a separate skill.

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | 7-section template with instructions |
| `AGENTS.md` | Worked example + session guidance |

## Trigger Phrases

"let's add", "should we", "design a", "how should we approach", any feature spanning >1 module
