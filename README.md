# Agentic - Fondations LLM & FinOps

First project of the Agentic track. The point here isn't to write code, it's to understand how a LLM actually works (tokenization, statistical prediction, context window) and why a vague prompt is expensive — in tokens as much as in technical debt.

## What I did

- **Task 0 — La Confrontation des Modèles** (`REPORT.md`): I sent the same deliberately vague prompt to two different AIs (Claude and GitHub Copilot Chat) to see how each one fills in the gaps of an imprecise request. Spoiler: they don't fill the same gaps the same way, and neither one asks for clarification.
- **Task 1 — FinOps 101** (`FINOPS.md`): I computed the real cost of an agent loop that fails to fix a test 10 times in a row, to see concretely what the "infinite loop syndrome" actually costs in dollars, and why context truncation changes the picture.

## Concepts covered

- Intent-Driven Development & semantic debt
- LLM architecture (tokenization & probabilities)
- Physical limits (context window & amnesia)
- AI economic model (FinOps 101)

## Tools used

Claude and GitHub Copilot Chat, as required by the prerequisites. No repo access on the Copilot side, to keep the comparison neutral.

## Status

Manual QA to be requested once reviewed.