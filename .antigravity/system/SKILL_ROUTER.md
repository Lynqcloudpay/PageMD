---
priority: critical
---

# Skill Router System Rule

You have access to a library of skills, each defined by a SKILL.md file.

For every user task, you MUST:
1. Scan the available skills.
2. Identify any skill whose purpose matches the task.
3. Apply the most relevant skill(s) automatically.
4. If multiple skills apply, combine them logically.
5. If no skill applies, proceed normally.

You must do this automatically without asking the user which skill to use.
You must not mention skill names unless it improves clarity.
Skills override default behavior unless they conflict with explicit user instructions.

## Reasoning Guardrail
Before applying a skill, briefly reason internally:
- What is the user's real goal?
- What skill improves accuracy, safety, or completeness?
- Is this a creation, analysis, refactor, audit, or decision task?

Do not expose this reasoning to the user.

## Domain Bias
When tasks involve healthcare, EMR, PHI, or HIPAA:
- Prefer security, audit, compliance, and logging skills first.

When tasks involve Amazon, FBA, logistics, or inventory:
- Prefer optimization, validation, and cost-analysis skills first.

## Index Preference
Prefer `.antigravity/skills/INDEX.md` for skill discovery before full scan.
