# Reviews and CI

Config files in the repo do nothing until the matching service is switched on. This page lists what runs automatically and exactly what the owner has to click.

## Runs automatically on GitHub

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` check | Push to `main`, every PR | typecheck, lint, unit tests, repo-check tests, contrast, dependency-direction, token, sound-manifest checks, build, bundle budget |
| `ci.yml` e2e | Push to `main`, every PR | Playwright on Chromium (required) plus Firefox, WebKit, Pixel 7 and iPhone 14 emulation (informational until green once; then set `experimental: false`) |
| `codeql.yml` | Push, PR, weekly | CodeQL `security-and-quality` for JavaScript/TypeScript |
| `dependency-review.yml` | PRs | Blocks PRs that add a dependency with a high-severity known vulnerability |
| `pages.yml` | Push to `main` | Builds the app under the Pages sub-path; deploys it once Pages is enabled |
| Dependabot | Weekly | Grouped dependency and Actions update PRs |

## Reviewers

Reviewers comment on **pull requests**, not on direct pushes to `main`. So that they see the work, substantial changes should arrive as a PR from a branch.

| Reviewer | Config in repo | Switch it on | Best at |
| --- | --- | --- | --- |
| **CodeRabbit** | `.coderabbit.yaml` | Install the CodeRabbit GitHub App and add this repository. It reviews new PRs automatically. | Summaries, path-aware review of audio and UI rules, bundled linters |
| **Qodo Merge** | `.pr_agent.toml` (read from the default branch) | Install the Qodo Merge GitHub App for this repository. Comment `/review`, `/improve` or `/describe` on a PR. Check Qodo's current plan for public repositories. | Test-gap and security-minded review, suggested patches |
| **OpenAI Codex** | `AGENTS.md` (section "Review guidelines") | In Codex settings enable Code review for this repository, then comment `@codex review` on a PR (or turn on automatic reviews). | Cross-file reasoning and runtime-bug hunting |
| **GitHub Copilot review** | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` | Needs a Copilot plan. Add Copilot as a reviewer on a PR, or enable automatic Copilot review in a repository ruleset. | Quick first pass inside GitHub |

All four read the same rules (`CLAUDE.md` is the source; the others point to it or restate the review priorities). Do not edit rule text in four places: change `CLAUDE.md`, then adjust the pointers.

### Avoiding noise

Four overlapping reviewers will repeat each other. Start with CodeRabbit and Codex on every PR, use Qodo and Copilot on demand, and after two weeks keep the ones whose comments you acted on. Lockfile, `prototype/`, build output and formatting are excluded everywhere.

## GitHub settings only the owner can change

The assistant's access to the GitHub settings API is blocked, so these are manual:

1. **Phone preview link.** Settings > Pages > Source: **GitHub Actions**. Then Settings > Secrets and variables > Actions > Variables > New repository variable `PAGES_ENABLED` = `true`. Re-run the **Pages preview** workflow. The app appears at `https://richid-stack.github.io/Pro-Studio-/`.
2. **Dependabot security updates.** Settings > Advanced Security > enable Dependabot alerts and security updates (secret scanning and push protection are already on).
3. **Private vulnerability reporting.** Settings > Advanced Security > enable, so `SECURITY.md` works.
4. **Codespaces (optional).** The repo has a dev container: Code > Codespaces > Create. Port 5173 opens the app in a cloud browser.
5. **Branch ruleset (when you are ready).** Recommended, not enabled: require a pull request, require the status checks `Typecheck, lint, tests, repo checks, build` and `e2e (chromium)`, require conversation resolution, block force pushes. Enabling it stops direct pushes to `main`, so turn it on only once work flows through PRs.

## Not verified yet

- The review-bot config files follow each tool's published options, but each bot validates them on its first PR; read that first review for config warnings.
- Firefox, WebKit and the two phone profiles run only on GitHub. Their first results decide whether they stay informational.
- First runs of CodeQL, dependency review and Pages are unobserved until they run on GitHub.
- Action versions are major tags (`@v4`); Dependabot will propose bumps. SHA pinning is a follow-up.
