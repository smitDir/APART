# CLAUDE.md

## Tool selection workflow

This project has 83 Claude Code skill/plugin bundles installed at user scope
(see PLUGINS.md for the full categorized index: Engineering, Product, Marketing,
C-Level Advisory, Finance, Compliance, Research, Productivity, etc.).

At the start of any non-trivial task:

1. Clarify the requirements (ТЗ) with the user first — do not guess scope.
2. Once requirements are clear, scan PLUGINS.md and pick only the plugin(s)/skill(s)
   relevant to this specific task's category (e.g. a backend bug -> engineering-skills;
   a pricing question -> commercial-skills or finance-skills).
3. Invoke only the selected skill(s). Do not load or reference unrelated domains
   (e.g. compliance, marketing, C-level advisory) unless the task actually calls for them.
4. Proceed with the work using just that narrow toolset, to avoid noise and
   context drift from the other 80+ unrelated skills.
