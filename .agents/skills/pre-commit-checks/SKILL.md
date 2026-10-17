---
name: pre-commit-checks
description: Run the OCR shopping list repository's lint, tests, production build, and development startup checks before a commit or when asked to verify the full local quality gate.
---

# Pre-commit checks

Follow the repository policies in the root AGENTS.md, including dependency approval requirements. Run these commands in order from the repository root:

```bash
npm run lint
npm run test:run
npm run build
npm run dev
```

Confirm that Vite starts without crashing, then stop the development server started for this check. Use test:run rather than the test watch command.

If a check fails, fix the root cause within the requested scope and rerun the full sequence before committing. Do not bypass failures by disabling lint rules, skipping tests, or skipping checks. If a failure cannot be resolved within scope, report it and do not commit.

Report the result of each check and any remaining blockers. Running this skill does not itself authorize creating a commit.
