# Installed Plugins Index

Total: 83 plugins from marketplace `claude-code-skills` (alirezarezvani/claude-skills), installed at user scope (available in all projects).

Used by the tool-selection workflow in CLAUDE.md: after requirements are clarified, pick the relevant plugin(s) by category below, invoke only those, ignore the rest.

## Engineering / Development (35)

- **a11y-audit** — WCAG 2.2 accessibility audit and fix for React, Next.js, Vue, Angular, Svelte, and HTML.
- **agent-harness** — Turn any domain folder of skills into a bounded agentic loop: a manifest builder inventories a domain's skills/tools/checks, a goal compiler turns a goal into a verifiable task plan (refusing vague goals with forcing questions), and a JSON-backed loop controller drives execute->verify->close with retry caps, controller-run verification (no verification theater), human escalation on exhausted budgets, and a close gate that refuses while any task is unverified or unwaived.
- **agenthub** — Multi-agent collaboration — spawn N parallel subagents that compete on code optimization, content drafts, research approaches, or any task that benefits from diverse solutions.
- **autoresearch-agent** — Autonomous experiment loop — optimize any file by a measurable metric.
- **behuman** — Self-Mirror consciousness loop for human-like AI responses.
- **caveman** — Ultra-compressed communication mode.
- **chaos-engineering** — End-to-end chaos engineering discipline: design experiments with hypothesis + steady-state metric + blast radius + abort criteria, calculate risk score against error budget, and generate blameless postmortems.
- **claude-coach** — Personal Claude power-user coach.
- **code-tour** — Create CodeTour .tour files — persona-targeted, step-by-step walkthroughs that link to real files and line numbers.
- **data-quality-auditor** — Audit datasets for completeness, consistency, accuracy, and validity.
- **demo-video** — Create polished demo videos from screenshots and scene descriptions.
- **docker-development** — Docker and container development — Dockerfile optimization, docker-compose orchestration, multi-stage builds, security hardening, and CI/CD container pipelines.
- **engineering-advanced-skills** — 37 advanced engineering skills: agent designer, agent workflow designer, RAG architect, database designer + schema designer + SQL assistant, migration architect, observability designer, dependency auditor, changelog generator (with semantic version bumper and hotfix/rollback procedures), API design reviewer, API test suite builder, CI/CD pipeline builder, MCP server builder, skill security auditor, skill tester, performance profiler, focused-fix, browser-automation, full-page-screenshot, git-worktree-manager, monorepo-navigator, codebase-onboarding, interview-system-designer, runbook-generator, spec-driven-workflow, secrets-vault-manager, env-secrets-manager, pr-review-expert, self-eval, tc-tracker (task context tracker with lifecycle and handoff format), feature-flags-architect, kubernetes-operator, chaos-engineering, ship-gate (pre-production 8-category audit with deploy-intent intercept), slo-architect (SLO designer, error-budget calculator with multi-window burn-rate alerts, SLO reviewer per Google SRE Workbook), and tech-debt-tracker.
- **engineering-skills** — 32 engineering skills: architecture, frontend, backend, fullstack, QA, DevOps, security, AI/ML, data engineering, Playwright (9 sub-skills), self-improving agent, Stripe integration, TDD guide, tech stack evaluator, Google Workspace CLI, a11y audit (WCAG 2.2), Azure cloud architect, GCP cloud architect, security pen testing, Snowflake development, adversarial-reviewer, ai-security, cloud-security, incident-response, red-team, threat-detection.
- **feature-flags-architect** — End-to-end feature-flag discipline: classify, ship, ramp, retire.
- **google-workspace-cli** — Google Workspace administration via the gws CLI.
- **grill-me** — Relentless plan-and-design interrogator.
- **grill-with-docs** — Docs-anchored grilling session — interrogates a plan against the project's existing language (CONTEXT.md) and recorded decisions (docs/adr/), updating those files inline as terminology and decisions crystallise.
- **handoff-engineering** — Conversation-handoff document generator.
- **helm-chart-builder** — Helm chart development — chart scaffolding, values design, template patterns, dependency management, and Kubernetes deployment strategies.
- **karpathy-coder** — Active coding discipline enforcer based on Karpathy's 4 principles: surface assumptions, simplify, make surgical changes, define verifiable goals.
- **kubernetes-operator** — End-to-end Kubernetes Operator discipline: CRD design, reconcile-loop patterns, and OperatorHub Capability Levels.
- **llm-cost-optimizer** — Cut LLM API spend via model routing, prompt caching, prompt compression, and per-feature cost observability.
- **prompt-governance** — Manage prompts in production at scale: prompt versioning, A/B testing, prompt registries, regression prevention, and eval pipelines for production AI features.
- **pw** — Production-grade Playwright testing toolkit.
- **security-guidance** — PreToolUse security reminder hook for Claude Code.
- **self-improving-agent** — Curate auto-memory, promote learnings to CLAUDE.md and rules, extract patterns into skills.
- **slo-architect** — End-to-end SLO/SLI/error-budget discipline per Google SRE Workbook.
- **snowflake-development** — Snowflake SQL, data pipelines (Dynamic Tables, Streams+Tasks), Cortex AI functions, Snowpark Python, and dbt integration.
- **statistical-analyst** — Hypothesis testing, A/B experiment analysis, sample size calculation, and confidence intervals.
- **terraform-patterns** — Terraform infrastructure-as-code — module design patterns, state management, provider configuration, CI/CD integration, and multi-environment strategies.
- **universal-scraping-architect** — A universal scraping skill with intelligent routing, token budget tracking, and quota awareness.
- **workflow-builder** — Workflow-builder skill: design and write deterministic multi-agent workflow scripts (.js files in .claude/workflows/) for Claude Code's Workflow tool (CLAUDE_CODE_WORKFLOWS=1, /workflows).
- **write-a-skill** — Skill-author skill: create new agent skills with proper structure, progressive disclosure, and bundled resources.
- **zero-hallucination-coder** — A disciplined coding pipeline that grounds code in verified structure before a line is written: Discuss -> Map -> Decompose -> Execute -> Verify, with a lazy-senior-dev YAGNI ladder that deletes unnecessary code first.

## Engineering (misc) (1)

- **collab-proof** — Assisted retrospective: after a session, calibrates what Claude contributed vs what the developer drove.

## Product (4)

- **agile-product-owner** — Agile product ownership for backlog management and sprint execution.
- **code-to-prd** — Reverse-engineer any codebase into a complete PRD.
- **product-skills** — 13 bundled product skills with 22 Python tools: product-skills fork-orchestrator with continuous-discovery loop (deterministic 16-lane router, Torres cadence tracker, OST linter, /cs:product + /cs:grill-product + /cs:product-loop), product manager toolkit (RICE, PRDs), product strategist, UX researcher, UI design system, competitive teardown, landing page generator, SaaS scaffolder, product analytics, experiment designer, product discovery, roadmap communicator, spec-to-repo.
- **research-summarizer** — Structured research summarization — summarize academic papers, market research, user interviews, and competitive analysis into actionable insights.

## Project Management (1)

- **pm-skills** — 9 project management skills with 15 Python tools: pm-skills fork-orchestrator with agentic delivery loop (deterministic 8-lane router, Jira MCP snapshot bridge to Kanban flow metrics + Monte Carlo forecasts, delegation-governance gate, /cs:pm + /cs:grill-pm + /cs:pm-loop), senior PM, scrum master, Jira expert, Confluence expert, Atlassian admin, template creator, meeting analyzer, team communications.

## Design (1)

- **apple-hig-expert** — Master Apple's Human Interface Guidelines (HIG) with focus on 2026 Liquid Glass aesthetics.

## Documentation (1)

- **markdown-html-skills** — Convert long markdown files into world-class single-file interactive HTML — DOMAIN COMPLETE at v2.10.3 (5 skills).

## Marketing (5)

- **aeo** — Answer Engine Optimization (AEO) skill — optimize content to be cited by AI language models (ChatGPT, Perplexity, Claude, Gemini, Mistral) as authoritative sources.
- **landing** — Single-file HTML landing-page generator with 4 design styles, brand palette validation, GSAP animation patterns, kebab-slug URL hygiene.
- **marketing-skills** — 47 marketing skills across 8 pods: Content, SEO & AEO, CRO, Channels, Growth, Intelligence, Sales enablement, and X/Twitter growth.
- **video-content-strategist** — Video content strategy: video scripts, YouTube channel optimization and SEO, short-form video pipelines (Reels, TikTok, Shorts), and repurposing long-form content into video.
- **youtube-full** — YouTube transcripts, video search, channel browsing, playlist extraction, and upload monitoring via TranscriptAPI.

## C-Level / Leadership Advisory (9)

- **arquiteto-de-empresa** — Arquiteto de Empresa (PT-BR): constrói um negócio do zero como um bundle OKF (Open Knowledge Format) — árvore de arquivos .md versionáveis com frontmatter type, links formando grafo, e index.md/log.md reservados, legível por humanos e por agentes.
- **c-level-agents** — Founder-mode executive team plugin: 13 cs-* C-suite agents (CFO, CMO, CRO, CPO, COO, CHRO, CISO, Chief of Staff, General Counsel, Chief Data Officer, Chief AI Officer, Chief Customer Officer, VP of Engineering) with distinct cognitive voices, plus 21 /cs:* slash commands — forcing-question office hours (CFO/CMO/CPO/CRO/CTO/CISO/GC/CDO/CAIO/CCO/VPE reviews), strategic sprint pipeline (brief → boardroom → decide → execute → post-mortem), and meta routing (/cs:founder-mode auto-router, /cs:onboard, /cs:cross-eval multi-model consensus, /cs:freeze cooldown lock).
- **c-level-skills** — 33 C-level advisory skills + c-level-agents plugin layer: virtual board of directors (CEO, CTO, COO, CPO, CMO, CFO, CRO, CISO, CHRO) plus General Counsel, CDO, CAIO, CCO, and VP of Engineering (DORA delivery throughput analyzer, engineering hiring funnel calculator with conversion + pipeline gap, eng team structure designer with squad/tribe + manager-trigger), executive mentor, founder coach, orchestration (Chief of Staff, board meetings, decision logger), strategic capabilities (board deck builder, scenario war room, competitive intel, M&A playbook), culture frameworks, and 13 cs-* persona agents + 21 /cs:* slash commands (founder-mode router, office-hours intake, multi-role boardroom, strategic sprint pipeline, cross-model consensus, cooldown freeze).
- **chief-ai-officer-advisor** — Chief AI Officer advisory for startups: model build-vs-buy calculator (API vs fine-tune vs build with 3-year TCO across 6 paths + breakeven that balances economics with practical feasibility), AI risk classifier (EU AI Act tier with 7 Article citations + US state patchwork: NYC LL 144, CO AI Act, IL HB 53, CA SB 1001, IL BIPA + industry overlays for FDA AI/ML, CFPB Circular 2023-03, NYDFS Reg 23, NAIC, ECOA, Fed SR 11-7), AI cost economics (API vs self-hosted breakeven with 2026 pricing across A100/H100, utilization reality, hidden costs).
- **chief-customer-officer-advisor** — Chief Customer Officer advisory: retention decomposition analyzer (honest GRR vs NRR; 7-category churn taxonomy with preventable% scoring), customer segmentation designer (4-tier framework, ICP fit scoring across 7 weighted signals, kill list + upgrade candidates), CS coverage calculator (pooled vs named CSM ratio math + 12-month hiring plan with quarterly sequencing).
- **chief-data-officer-advisor** — Chief Data Officer advisory for startups: AI training data audit (origin × class × use-case matrix with GDPR Art.
- **executive-mentor** — Adversarial thinking partner for founders and executives.
- **general-counsel-advisor** — General Counsel advisory for startups: contract risk scanner (12 founder-killer patterns: auto-renew traps, uncapped indemnity, vague IP, MFN pricing, missing DPA, one-sided venue, broad non-solicit, perpetual license-back, etc.) and term sheet analyzer (0-100 founder-friendliness across 12 dimensions).
- **vpe-advisor** — VP of Engineering advisory: delivery throughput analyzer (DORA 4 metrics + cycle-time bottleneck identification with typical fixes per stage), engineering hiring funnel calculator (7-stage conversion + pipeline gap + weakest-stage fixes from sourcing to offer-accept), engineering team structure designer (squad/tribe model + manager-trigger + director-trigger + span-of-control).

## Finance (2)

- **business-investment-advisor** — Business investment analysis and capital allocation advisor.
- **finance-skills** — 3 finance skills: financial analyst (ratio analysis, DCF valuation, budgeting, forecasting), SaaS metrics coach (ARR, MRR, churn, CAC, LTV, NRR, Quick Ratio, projections), and business investment advisor.

## Business Growth (1)

- **business-growth-skills** — 5 business & growth skills: customer success manager, sales engineer, revenue operations, contract & proposal writer.

## Business Operations (1)

- **business-operations-skills** — Internal BizOps domain.

## Commercial (1)

- **commercial-skills** — Per-deal-and-packaging Commercial domain.

## Compliance / Regulatory (4)

- **compliance-os** — Compliance OS — meta-orchestrator for multi-framework compliance programs spanning 9 frameworks (ISO 27001, ISO 13485, ISO 42001, ISO 14971, EU AI Act, MDR 745, GDPR, SOC 2, FDA QSR).
- **compliance-team-eu-ai-act** — EU AI Act (Regulation (EU) 2024/1689) operational compliance specialist: AI system risk classifier (Articles 5/6/50 + Annex III), conformity assessment planner (Article 43 + Annex IV checklist), and obligation tracker (provider/deployer/importer/distributor + GPAI Articles 51-55).
- **compliance-team-iso42001** — ISO/IEC 42001:2023 AI Management System (AIMS) specialist: AIMS gap analyzer (Clauses 4-10 coverage + remediation priority), AI risk register builder (Annex A 38 controls per ISO 23894), and AIMS audit scheduler (Clause 9.2 cadence + auditor independence).
- **ra-qm-skills** — 14 regulatory affairs & quality management skills for HealthTech/MedTech: ISO 13485 QMS, MDR 2017/745, FDA 510(k)/PMA, GDPR/DSGVO, ISO 27001 ISMS, CAPA management, risk management, clinical evaluation, SOC 2 compliance.

## Research (9)

- **deep-research** — Disciplined multi-source meta-research for high-stakes questions — the heavyweight alternative to the fast research router.
- **dossier** — Decision-grade entity research.
- **grants** — NIH grant-funding intelligence skill.
- **litreview** — Academic literature orientation skill.
- **notebooklm** — Google NotebookLM browser-automation skill.
- **patent** — Patent prior-art + IP landscape skill.
- **pulse** — Multi-source recency research.
- **research-orchestrator** — Research orchestrator (hybrid router + fallback).
- **syllabus** — Course supplementary-reading skill.

## Research Operations (1)

- **research-ops-skills** — Enterprise / cross-functional Research Operations domain — the managed counterpart to the academic research/ domain.

## Productivity (6)

- **andreessen** — Marc Andreessen-mode decision and productivity skill.
- **capture-skill** — Brain-dump-to-action workspace skill.
- **email-pair** — Email-workflow skill pair: inbox-setup builds your taxonomy/KB; inbox-triage classifies + drafts (drafts-only, never auto-send).
- **handoff-productivity** — Compact the current conversation into a handoff document for another agent to pick up.
- **reflect-skill** — Light-prompt reflection skill.
- **roast** — Pressure-test a business idea before you build it.

## Knowledge Management (1)

- **llm-wiki** — A second brain for Claude Code + Obsidian inspired by Karpathy's LLM Wiki gist.

