# Misc/Backlog File Catalog

## FB2 e-books (3 files)

**4403e840-281347.fb2** — *Сарафанный маркетинг* (Word-of-Mouth Marketing) by Andy Sernovitz (Энди Серновиц), trans. Т. Мамедова, publisher МИФ, 2012.
- Genre: marketing. Practical guide on generating word-of-mouth buzz for brands/products.
- Business how-to book, not fiction.
- **Flag: business-relevant** (marketing strategy reference)

**e1600ed6-468775.fb2** — *Вы или хаос* (You or Chaos) by Александр Фридман, publisher Добрая книга, 2015.
- Genre: management. Guide to building organization-wide managerial planning systems, eliminating operational chaos.
- Sequel to author's "You or Your Subordinates"; regular-management/corporate governance theory.
- **Flag: business-relevant** (management/operations reference)

**f23f1f7a-196056.fb2** — *СПИН-продажи* (SPIN Selling) by Neil Rackham (Нил Рекхэм), publisher МИФ, 2008.
- Genre: popular_business. Classic sales methodology bestseller on large-scale B2B sales techniques.
- For sales managers/reps; well-known sales training book.
- **Flag: business-relevant** (sales methodology reference)

All three FB2s are legitimate business/management non-fiction — none is personal fiction. Safe to catalog into a "business reading / reference" shelf rather than treat as unrelated personal material.

## JSON files (3 files) — all n8n workflow exports

**2d9b137f-AI_____.json** ("AI-...") — n8n automation workflow (untitled "My workflow").
- Publishes media (video) to Instagram, Facebook, LinkedIn, and other platforms via the Blotato API.
- Structure: HTTP Request nodes per platform, driven by a "Prepare for Publish" upstream step.
- **Flag: AI-tooling-relevant / business-relevant** (social-media publishing automation)

**4698b3c5-...9....json** (filename references "9 platforms") — n8n workflow, "My workflow".
- Schedule Trigger → reads a Google Sheet ("Publish to 9 Social Platforms") filtered by Status="Ready to Post" → extracts Drive video URL → uploads/publishes via Blotato to multiple socials.
- Same automation family as file #4, broader (9-platform) version.
- **Flag: AI-tooling-relevant / business-relevant**

**7bef9556-...LinkedIn.json** — n8n workflow titled "Автоматизация LinkedIn" (LinkedIn Automation).
- Airtable-sourced content queue → LLM (gpt-4o-mini) query-generator and research agents (OpenAI web-search) → builds LinkedIn posts from news research.
- Multi-agent content pipeline (search query gen → research summarization → posting).
- **Security note:** this file contains a **live-looking OpenAI API key hardcoded in plaintext** (`Authorization: Bearer sk-proj-...`). Recommend the owner rotate/redact this key before storing the file anywhere shared.
- **Flag: AI-tooling-relevant / business-relevant** (also needs remediation)

## HTML file

**c4e34087-forgemobiledevstation.html** — "Forge — мобильная дев-станция · ReveluxAI" (Forge — Mobile Dev Station, ReveluxAI brand).
- Landing-page/guide describing a system for coding from a phone: Claude Code runs headless on a VPS, works in an isolated git branch, opens a PR; files sync to desktop via Syncthing without manual `git pull`.
- Includes a spec meant to be loaded into Claude Code to let a reader build the same setup themselves.
- Styled as a polished marketing/guide page under the "Revelux OS" brand.
- **Flag: AI-tooling-relevant / business-relevant** (own product/process documentation)

## Summary
7/7 files are business or AI-tooling relevant — no personal/unrelated fiction found. The three FB2s are legitimate business books (marketing, management, sales) suitable for a "business reference" shelf. The JSON/HTML files are all part of a social-media-automation and dev-workflow toolset (n8n + Blotato + Claude Code/Revelux), consistent with the account's business/AI-work focus. One action item: rotate the exposed OpenAI key in the LinkedIn automation JSON.
