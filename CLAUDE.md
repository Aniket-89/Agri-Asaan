@AGENTS.md

# Claude Code notes

- AGENTS.md is the source of truth for project rules. Do not duplicate them here.
- Work on a feature branch, never on `main`. Propose a short plan before touching migrations, RLS, auth or more than three files.
- Run the tests and linters that apply and report the real results before calling work done.
- Use fake data only. Never print or commit secrets, `.env` files, or real farmer details.
