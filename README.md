# Agentic Ops — 5 Projects, Week 1

Five projects on Agentic Ops: understanding how LLMs actually work, engineering context for GitHub Copilot, forging a specialized agent with persistent memory, connecting Copilot to a real system via MCP, and finally building an autonomous agent end to end. Each folder is self-contained with its own deliverables and, where relevant, its own `package.json`/`node_modules`.

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

## Concepts covered

Tokenization & LLM economics · Intent-Driven Development & semantic debt · Context window & Lost in the Middle · FIM & RAG local · R-C-T-C-F prompting · PRRF specialized agents · Company Skills standardization · External memory (MEMORY.md) · Model Context Protocol (Resources/Prompts/Tools) · Human-in-the-Loop · Zero Trust tool security · autonomous agent orchestration.

## Status

All 5 projects complete, manual QA review requested.
