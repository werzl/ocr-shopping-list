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

## Capture screenshots

- For every PR, identify the UI areas and user flows affected by the full diff and take screenshots of their final behavior before publishing. For changes with no visible UI impact, keep the Screenshots section and explain why screenshots are not applicable.
- Start the app with `npm run dev` from the repository root and use the URL Vite reports. Assume the OpenAI API key is supplied by the existing env file (normally `.env.development`, variable `VITE_OpenAI_Api_Key`). Let Vite load it; do not print, copy, commit, or expose the key in logs, images, or PR content. If configuration is missing, report the missing variable name without requesting the secret in chat.
- Use available browser automation or screenshot tooling; check what is already installed before selecting it. Do not install dependencies or run an npx command that would download packages without the explicit approval required by AGENTS.md.
- Exercise the affected flows with non-sensitive sample data. When OCR is affected, submit a sample shopping-list image using the configured API and capture the rendered result. Capture relevant loading, success, error, and interaction states as appropriate to the change. Use desktop and mobile viewports for layout changes; include matching before/after views when they help explain the change.
- Inspect every captured image for correct rendering, useful framing, and exposed secrets or personal information. Save artifacts outside ignored build output and env files. Stop any server started for this capture after finishing.
- Embed actual images with descriptive captions in the template's Screenshots section. Use image attachments supported by the available GitHub tooling, or commit only the reviewed screenshot files under `docs/screenshots/` and embed links that resolve from the PR head commit. Local filesystem paths are not valid PR image links. Check that each image is accessible to reviewers.
- If capture or upload is blocked, report the specific blocker and leave Screenshots explicitly marked incomplete. Do not silently omit screenshots, substitute generated mockups, claim a capture succeeded, or claim a real API flow passed when only a mock was used.

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
