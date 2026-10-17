---
name: create-pull-request
description: Create or update a pull request for this repository using its PR template, with a focused summary and an accurate test plan. Use when asked to open, draft, or prepare a PR.
---

# Create a pull request

Read the root AGENTS.md and `.github/PULL_REQUEST_TEMPLATE.md` before preparing the PR. Use the current template as the source of truth; do not maintain a separate copy here.

## Prepare the change

- Inspect the current branch, worktree, remotes, and existing PRs for the branch. Preserve unrelated user changes and include only the intended files in any commit.
- Use the requested base branch, or `master` by default. Review the full branch diff and commits against that base, including intended changes awaiting a commit.
- For an existing change, use its existing branch. Follow AGENTS.md's branch workflow when starting implementation of a new change.
- Before creating a commit, use the repository's `pre-commit-checks` skill at `.agents/skills/pre-commit-checks/SKILL.md`. Do not commit if its quality gate fails. Follow the dependency approval policy if a check requires a package change.

## Optional screenshots

Screenshots are optional and do not block PR creation. Capture them only when requested or useful to explain a visual change. If included, inspect them for secrets and personal information, embed reviewer-accessible images with captions, and accurately describe what was verified. Remove the template's Screenshots section when no images are included.

## Write the PR

- Choose a concise title describing the final change.
- Preserve the template's headings and applicable checkboxes. Replace instructional comments with concrete content and remove unused optional summary bullets.
- In **Summary**, explain the problem and resulting behavior from the full diff. Include relevant developer documentation changes and material limitations.
- In **Test plan**, mark a checkbox complete only when that check actually passed for the final change. Leave unrun or failed checks unchecked and explain why. Replace the manual-check placeholder with a relevant check, or remove it when none applies.
- Keep the description understandable without the chat history. Never include secrets or claim validation that was not performed.

## Publish and report

- Preparing a PR description alone does not authorize committing, pushing, or opening a PR. When the user asks to create or open a PR, complete the necessary commit and branch push within that scope; never force-push without explicit authorization.
- Prefer the existing GitHub tooling. With GitHub CLI, check authentication, push the intended branch with its upstream, and use `gh pr create --base <base> --head <branch> --title <title> --body-file <file>`. Write the exact Markdown body to a temporary UTF-8 file with real newlines before invoking the command.
- Honor a request for a draft by adding `--draft`. If a PR already exists for the branch, update it rather than creating a duplicate.
- Verify the resulting PR's base, head, title, and body. Return its URL and summarize validation results. If publishing is blocked, provide the prepared title/body and specific blocker without claiming the PR exists.
