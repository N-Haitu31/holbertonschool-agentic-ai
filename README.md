# Agentic Ops — 9 Projects

Nine projects on Agentic Ops: understanding how LLMs actually work, engineering context for GitHub Copilot, forging a specialized agent with persistent memory, connecting Copilot to a real system via MCP, building an autonomous agent end to end, orchestrating a full team of specialized agent personas, instrumenting an agent with real observability (Langfuse) and governance hooks, evaluating agentic work in terms of ROI and architecture, and finally a capstone that combines all of it into an auditable software factory. Each folder is self-contained with its own deliverables and, where relevant, its own `package.json`/`node_modules`.

## 01_llm_finops — Fondations LLM & FinOps

Not a coding project — understanding how a LLM actually works (tokenization, statistical prediction, context window) and why a vague prompt is expensive, in tokens as much as in technical debt.

- **Task 0** (`REPORT.md`): the same deliberately vague prompt sent to two different AIs (Claude and GitHub Copilot Chat), comparing how each fills the gaps of an imprecise request differently.
- **Task 1** (`FINOPS.md`): the real dollar cost of an agent loop failing to fix a test 10 times in a row, modeling the "infinite loop syndrome" and why context truncation changes the math.

## 02_context_engineering — Ingénierie de Contexte & Copilot

Hands-on with FIM, RAG local, Copilot's interaction modes, and the R-C-T-C-F prompt framework.

- **Task 0** (`CONTEXT.md`): generated a new service from an existing repository/service pair by attaching the real files as context instead of describing them, then compared what pattern Copilot actually reused vs. what it filled in on its own.
- **Task 1** (`SECURITY_REVIEW.md`): used Copilot's Agent mode to find and fix a SQL injection vulnerability in `legacy_auth.js` via parameterized queries, with a full before/after test run as proof.

## 03_specialized_agent — Agent Spécialisé, Skills & Mémoire

Forging a specialized "QA Engineer" agent with the PRRF framework (Persona/Rôle/Règles/Format), a company Skill (AAA test pattern), and an external memory file.

- **Task 0** (`REPORT.md`): `.github/copilot-instructions.md` configuring a strict QA persona, verified by asking the agent to summarize what it understood from `MEMORY.md`.
- **Task 1** (`TEST_REPORT.md`): generated a full Jest test suite for `cart_calculator.js` following the team's testing standard, with the "never touch `/src`" guardrail verified via `git diff`.
- **Task 2** (`CONTEXT_TEST.md`): a deliberate "Crash Test" — flooding the chat with off-topic noise to try to break the persistent instructions. Result: they held up, with the reasoning and the test's own limitations both documented.

## 04_mcp — Model Context Protocol & Copilot en Action

Building and connecting a local MCP server to Copilot Chat, with the Resources/Prompts/Tools primitives and Human-in-the-Loop approval in practice.

- **Task 0** (`MCP_SETUP.md`): deployed the CRM mock MCP server (`crm-server`), verified end to end that Copilot Chat detects and uses its `get_customer_status` tool.
- **Task 1** (`CUSTOMER_SUPPORT.md`): a support-agent prompt that explicitly triggers the read-only tool and drafts a customer email grounded in the real data it returned.
- **Task 2** (`UPDATE_TOOL.md`): added a new `update_customer_status` write tool to the server, with the HITL approval step explicitly checked (tool name + parameters) before authorizing the call.

## 05_sentinel — Opération Sentinel (final project)

The capstone: zero starter kit, autonomous agent built from scratch. "Sentinel" queries the live GitHub REST API and generates a dashboard, synthesizing every concept from the previous four projects.

- **Task 0**: `.github/copilot-instructions.md` — Sentinel's identity, the rule to always check GitHub issues before coding, and a hard Vanilla JS/HTML/CSS-only constraint (no frameworks).
- **Task 1**: `mcp_server.js` built from an empty folder — a `fetch_github_issues` tool making a real authenticated `fetch()` call to the GitHub API, token passed via `.vscode/mcp.json` environment variables, never hardcoded.
- **Task 2**: deliberately sabotaged the token to test error handling — distinct, actionable messages for 401 (invalid token) vs. 404 (repo not found), verified the server never crashes.
- **Task 3**: full autonomous run — one prompt, and the agent fetched live issues from `microsoft/vscode` and generated `index.html` / `app.js` / `style.css` from that real data, respecting every rule set in Task 0.

## 06_agent_workflows — L'Équipe d'Agents & Workflows de Travail

Recreating a traditional Product Owner / Dev / QA-DevSecOps team split as three separate, deliberately isolated Copilot personas, chained via a single source of truth instead of one mega-prompt doing everything.

- **Task 0** (PO agent, `specifications.md`): `.github/PO-instructions.md` configures a persona forbidden from writing executable code; produces the SSOT specification (user stories + Gherkin acceptance criteria) for a `tasks.json` polling script, later consumed as-is by the Dev agent.
- **Task 1** (Dev agent, `index.js` / `Dockerfile` / `docker-compose.yml`): `.github/DEV-instructions.md` configures a pure executor persona bound to `specifications.md` as its only source of truth (must stop and flag rather than invent on ambiguity). Verified end to end with a real `docker compose up --build` run.
- **Task 2** (QA/DevSecOps agent, hardened `Dockerfile` / `docker-compose.yml`): `.github/QA-instructions.md` configures an adversarial security-auditor persona, explicitly barred from touching functional behavior. Found and patched 4 issues (root execution, unrestricted Linux capabilities/filesystem, unneeded network access, missing `.dockerignore`). **See `QA_REPORT.md`** for the live proof of this audit: a verbatim capture of the agent's own Faille/Risque/Correctif findings, the `git diff` proving `index.js` was never touched (non-regression), the runtime verification (`docker exec`/`docker inspect` confirming non-root/no-network/read-only in practice, not just declared in YAML), and a 3-state resilience test (`tasks.json` valid/missing/corrupted) confirming the process never crashes.

## 07_langfuse — Agentic Ops, FinOps & Langfuse (La Tour de Contrôle)

Instrumenting a raw Node.js SysAdmin agent script with real LLM observability (Langfuse) and governance hooks — the difference between an agent that just runs and one that can be audited, cost-tracked, and stopped before it does something destructive.

- **Task 0**: created a dedicated Langfuse Cloud project (`Agentic-Ops-TP7`) and generated its API keys.
- **Task 1** (`agent.js`, `package.json`, `.gitignore`): wrapped the OpenAI client with Langfuse's `observeOpenAI`, with an explicit `traceId` and `await openai.flushAsync()` before exit (a short-lived script would otherwise terminate before the batched trace is actually sent — verified independently via the Langfuse public API, since the dashboard has a ~10 minute display lag on this SDK version).
- **Task 2** (`agent.js`): Post-Hook — a FinOps console alert when `total_tokens` exceeds 150, and a `langfuse.score()` call (`securite_commande`, 0 or 1) rating whether the model's proposed command contains `rm -rf`, confirmed attached to the correct trace via the API.
- **Task 3** (`agent.js`): Pre-Hook Human-in-the-Loop — a `readline/promises`-based prompt asking explicit authorization before considering the AI's proposed command "executed"; refusal exits via `process.exit(1)`, acceptance logs confirmation — both branches flush pending Langfuse telemetry *before* exiting, verified on both paths.

**See `LANGFUSE_PROOF.md`** for the full evidence trail across all three tasks: terminal transcripts, matching Langfuse trace screenshots (prompt/response/token usage/cost/score), and the API-based verification used to work around the dashboard's ingestion delay.

## 08_strategy_roi — Stratégie de Valeur, Écosystème & ROI

A change of pace from coding: costing agentic work (TCO/ROI), mapping the orchestration ecosystem (CrewAI / AutoGen / LangGraph / BMAD), and using an LLM as a system-design sounding board rather than a code generator.

- **Task 0** (`roi-simulator.csv`, `ROI_ANALYSIS.md`): filled the TCO table for three tasks from a formula reconstructed from the course's own worked example, then wrote an executive argument whose every figure traces back to a CSV row.
- **Task 1** (`.github/ARCHITECT-instructions.md`, `architecture.md`, `ADR-001-databases.md`): a "Solution Architect" persona that never writes code, producing a Mermaid architecture (Redis hot path + Postgres source of truth, append-only audit log, asynchronous payment queue) and an ADR with at least one rejected alternative per component.
- **Task 2** (`STRATEGY_REVIEW.md`): a decision-oriented synthesis with one AI choice kept, one corrected (a diagram label that contradicted its own ADR), the trade-offs, and a conditional recommendation.

## 09_megashop_backend — L'Usine Logicielle Auditable (capstone)

A payment backend for MegaShop-B2B built through three sprints run as a Product Owner → Developer → QA chain, with strict TDD, exact dependency pinning, secrets kept out of git, and Langfuse tracing of every LLM call and human decision.

- **Task 0** (`.github/PO|DEV|QA-instructions.md`, `.gitignore`, `.env.example`): the three persona files, improved from project 06 (per-feature scope and a Definition of Done for the PO, red/green TDD and pinned versions for the Dev, dependency/TDD/secret audits for the QA); `.env` is git-ignored and only variable names are published.
- **Task 1** (`server.js`, `Dockerfile`, `specifications.md`): an Express webhook that logs a bank payment notification and answers `200 OK` immediately. Tests were written first (verified red, then green). The QA audit found the container ran as root (`uid=0`) and fixed it (`USER node`, `uid=1000`).
- **Task 2** (`worker.js`, `queue.js`, `docker-compose.yml`): the webhook now pushes to a Redis queue and a separate Worker consumes it and runs an LLM analysis traced with `observeOpenAI`. The QA reproduced the crash when Redis is not ready at startup, and fixed it with a retry loop plus a Redis healthcheck and `depends_on: condition: service_healthy`.
- **Task 3** (`worker.js`, `docker-compose.yml`): a Human-in-the-Loop Pre-Hook — a refund (`status: "refund"`) suspends the Worker until an operator answers `o`/`n` in the terminal (`readline/promises`, `stdin_open` + `tty` in Compose). The decision is scored in Langfuse (`1` authorized, `0` refused) on the same trace as the analysis.
- **Task 4** (`FINOPS_REVIEW.md`, `langfuse_*_export.*`): FinOps closing review — measured LLM cost, and exports of traces and scores that let each refund decision be traced back to its LLM call.

**Run it**: copy `.env.example` to `.env` and fill in the keys, then `docker compose up -d redis app`. HITL needs an attached terminal: `docker compose run --rm worker` (a detached `up -d` cannot take keyboard input). Tests: `npm test`.

**See `PROOF.md`** (terminal transcripts, Langfuse screenshots, API verification), **`QA_REPORT.md`** (each audit finding as fault / risk / fix, with non-regression evidence) and **`FINOPS_REVIEW.md`** (cost review).

## Concepts covered

Tokenization & LLM economics · Intent-Driven Development & semantic debt · Context window & Lost in the Middle · FIM & RAG local · R-C-T-C-F prompting · PRRF specialized agents · Company Skills standardization · External memory (MEMORY.md) · Model Context Protocol (Resources/Prompts/Tools) · Human-in-the-Loop · Zero Trust tool security · autonomous agent orchestration · LLM observability & tracing · FinOps/tokenomics · Pre-Hook/Post-Hook governance · TCO/ROI · Architecture Decision Records · TDD (red/green) · dependency pinning · message queue / async worker · startup resilience (retry + healthcheck).

## Status

All 9 projects complete, manual QA review requested.
