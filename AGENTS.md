# Repository instructions for Codex

# Branch before changes

When Adam asks for a code or config change, start on a fresh branch from latest `master`. Do this before you edit files.

## Steps

1. Check `git status`. If the worktree is dirty in a way that would block checkout or pull, stop and tell Adam. Do not discard his work.
2. Fetch and update `master`:

```bash
git fetch origin
git checkout master
git pull origin master
```

3. Create and check out a new branch from that tip. Name it from the change (short, kebab-case), for example `fix-list-cutoff` or `add-ste100-rule`:

```bash
git checkout -b <branch-name>
```

4. Only then make the requested edits on that branch.

## Exceptions

- Skip this flow if Adam says to stay on the current branch, amend, or work on an existing named branch.
- Skip if he only asks a question, review, or explanation with no repo change.
- Do not force-push, hard-reset, or delete branches unless he explicitly asks.

# Update docs on DevEx changes

When a change affects how a developer sets up, runs, tests, lints, builds, or debugs this repo, update the docs in the same change. Do not leave setup knowledge only in chat or commit messages.

## What counts as DevEx

Treat these as DevEx (non-exhaustive):

- npm scripts (`dev`, `build`, `lint`, `test`, `preview`, and new scripts)
- Package manager or Node/tooling requirements
- Env vars and `.env*` files (names and where to put them — never real secrets)
- Vite, ESLint, TypeScript, or other config that changes local workflow
- Local mock/test server under `tests/`
- CI/CD workflows that change how contributors verify work
- Ngrok, hosts, ports, or other local networking setup
- New or renamed entrypoints, folder layout, or required install steps

## What to update

1. Prefer `README.md` (especially **Local Dev** and related sections).
2. If a dedicated doc already covers the topic, update that file instead or as well.
3. Keep docs accurate: add new steps, change outdated paths/commands, and remove dead instructions.
4. Match the existing README tone and structure. Keep examples copy-pasteable.

## Done check

Before you finish a DevEx change, confirm a reader who only has the docs can still set up and run the affected workflow. If the docs and the tools disagree, fix the docs (or say what is still unknown).

# Pre-commit verification

Before creating a git commit in this repo, run the full local quality gate from the repository root and only commit if every step succeeds.

## Required checks (in order)

```bash
npm run lint
npm run test:run
npm run build
npm run dev
```

1. **Lint** — `npm run lint` (ESLint). Fix all reported issues; do not commit with lint failures.
2. **Test** — `npm run test:run` (Vitest, single run). All tests must pass. Do not commit with failing or skipped suites that should run. Use `test:run`, not `test` (watch mode).
3. **Build** — `npm run build` must complete with no TypeScript or Vite errors.
4. **Start** — `npm run dev` must start the Vite app successfully (server comes up without crash). Stop the process after confirming it started.

## Rules

- Do not commit if any of lint, test, build, or start fail.
- Fix failures first, then re-run the full sequence before committing.
- Prefer fixing root causes over disabling lint rules, skipping tests, or skipping checks.
- These checks are mandatory even for small or “docs-only” commits that touch app code or config in the repository root.

# Warn before package installs

Before installing, updating, or removing any dependency, **stop and warn the user first** — even when auto-approve / YOLO mode is enabled.

## Applies to

Any command or action that changes `package.json`, lockfiles, or installs packages, including but not limited to:

- `npm install` / `npm i` / `npm add` / `npm uninstall` / `npm update`
- `npx` when it would install a package
- `yarn add` / `yarn remove` / `pnpm add` / `pnpm remove` / `bun add`
- Editing `package.json` or lockfiles to add or change dependencies
- Global installs (`npm i -g`, etc.)

## Required behavior

1. Tell the user **what** you want to install/remove and **why**.
2. Wait for explicit user confirmation before proceeding.
3. Do **not** treat auto-approve, agent autonomy, or “just fixing the build” as permission to install packages.
4. If the user declines, continue without adding the dependency (suggest alternatives if useful).

## Repository skill

Use the `pre-commit-checks` skill in `.agents/skills/pre-commit-checks/SKILL.md` when preparing a commit or running the full local quality gate.

# Test location

Put all test suites, test setup, fixtures and test-only helpers under the repository-root `tests/` directory. Mirror source subdirectories where useful (for example, `tests/openai/OpenAiWrapper.test.ts`). Use `*.test.ts` / `*.test.tsx` or `*.spec.ts` / `*.spec.tsx` for suites; import application code from `src/`. Do not colocate tests with production code. ESLint rejects suites outside `tests/`, and Vitest discovers suites inside `tests/` only. Shared setup lives in `tests/setup.ts`.

# Browser tests

Put real browser tests under `tests/browser/`. Keep mocked unit tests elsewhere under `tests/`. Run `npm run test:browser:install` after installing dependencies or changing Playwright. The required `npm run test:run` command runs both unit and headless Chromium tests. Do not replace browser compression and persistence checks with mocks.
