# Repository audit — 2026-10-07

Status: all five initial reports complete and frozen; five fresh independent reviewers are running concurrently. This
file will be reconciled after review.

## Evidence baseline

- Repository: `Kadenar/gw2-combat-simulator`.
- Intended PR base: `main`.
- Audited source commit: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (`Improvements to simulation comparison`). All
  auditors and reviewers use this commit, regardless of later changes to `main`.
- Isolated audit branch: `audit/2026-10-07-repository-review`. Fresh clone; working tree was clean before audit
  documentation. No unrelated local edits were present.
- Budget began 2026-10-07 04:40:39 UTC (00:40:39 America/New_York); maximum deadline 12:40:39 UTC. Eight hours is a
  ceiling, not a minimum duration.
- GitHub connector authenticated as `Kadenar`; repository metadata reports push permission. Local configured Git
  identity is `Codex <codex@openai.com>`; no identity or credentials were fabricated or overridden.
- Runtime: Node `v24.19.0`, npm `11.9.0`. `npm ci` succeeded (109 packages).
- No applicable `AGENTS.md` or `CONTRIBUTING` files were found in the repository or parent workspace paths. Contribution
  conventions read in `scripts/README.md`, `tests/README.md`, architecture documents, platform README, and CI validation
  workflows.
- Known-issue check: 36 issue descriptions and 100 recently updated issue/PR records retrieved. This is not a complete
  historical PR audit. At retrieval, #66 (Impossible Odds) and #70 (Untamed ambush attacks) were open; many other
  descriptions were closed and require source verification before alleging a regression.

## Actual source owners

| Area                 | Baseline locations                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Professions          | `js/games/gw2/professions/`, registered in `js/games/gw2/profession-registry.ts`; nine professions, Core plus four elites each                       |
| Frontend             | `js/browser/`, `js/ui/`, `js/games/gw2/app/`, profession `app/` and presentation files, `css/`, root HTML, `templates/`                              |
| Game-neutral kernel  | Nine modules under `js/kernel/`                                                                                                                      |
| GW2 runtime/platform | `js/games/gw2/platform/`; simulation, execution, resolver, combat, effects, skills, builds, equipment, profession contracts, results and measurement |
| Integrations         | `js/games/gw2/integrations/`; logs, keybinds, patch previews                                                                                         |
| Validation           | `tests/`, npm scripts, `.github/actions/validate/action.yml`, build artifact validators                                                              |

Architecture and contract references include `docs/architecture/ARCHITECTURE.md`, `MODULES.md`, event-clock/ordering
documents, programmatic simulation documentation, profession documents, and `js/games/gw2/platform/README.md`. Current
source uses one simulation queue and clock. Constant player Quickness/Alacrity assumptions, full player health, and
omitted incoming damage are documented scope choices. Summon recharge is distinct:
`js/games/gw2/platform/combat/recharge.ts` integrates received Alacrity grants and expiry; the architecture document's
blanket statement about summons is stale.

## Validation

`npm run check` passed (exit 0): formatting, lint, production build, 4,876 Node tests (7 suites; 0 failures, skips,
cancellations or todos), typecheck, compiled-module and site validation. Node test duration was 59,680.748964 ms.
Artifact checks verified 1,599 TypeScript outputs with no source duplicates, 11 bundled pages, and two runtime asset
roots. Vite emitted its existing large-chunk advisory; no performance benchmark is inferred from it. npm warned about
the environment's `http-proxy` configuration.

Chrome was absent from inspected system locations. `npx playwright install chrome` failed (exit 1) because `apt-get`
could not change groups/users in this environment (`setgroups: Operation not permitted`). This is an environment
limitation, not a repository failure. Browser tests were not included in `npm run check`; any subsequent browser
diagnostics will be recorded separately.

A user-space fallback, `npx playwright install chromium`, also failed (exit 1): the downloaded Chrome for Testing
archives were empty/truncated or otherwise not valid ZIP files. No browser suite pass is claimed. Source traces and
Node/DOM fixtures can validate logic but cannot establish computed layout or real browser interactions.

## Agent execution

All five initial agents were explicitly spawned concurrently with model `gpt-6-astra` and reasoning effort `high`:
`audit_professions`, `audit_frontend`, `audit_kernel`, `audit_platform`, and `audit_bugs`. Each owns only its assigned
report. Agents were prohibited from spawning other agents or making Git mutations. The coordinator owns this summary and
Git operations. After all five originals were complete, five fresh agents were explicitly spawned with the same model
and effort: `review_professions`, `review_frontend`, `review_kernel`, `review_platform`, and `review_bugs`. No
additional agents were spawned. The eight-hour budget is a maximum; phases advance when their substantive work is
complete.

## Frozen initial reports

All five originals completed before any reviewer was spawned. They were frozen on 2026-10-07 at 05:07:57 UTC with **21
stable finding IDs**. Initial source-path/range checks and explicit touched-Markdown formatting checks passed. Initial
reports remain unchanged during review; corrections and rejections belong in the corresponding review and final
register.

| Initial report                                               | SHA-256 at freeze                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| [01-profession-consistency.md](01-profession-consistency.md) | `ddd9945dd039ea0fc04eba6ba60c56f225f59215b9a0c2ea9ece44be0dbfc25b` |
| [02-frontend-cleanup.md](02-frontend-cleanup.md)             | `c338d28650728e398a6618bd62de52ff3cb866b8b76db0328d12fd5cd73c571c` |
| [03-kernel-audit.md](03-kernel-audit.md)                     | `44f50c48c27bc5e7e68b25ebe0854a8ac8d6afab00fbcdc7091271bbe9548d52` |
| [04-platform-audit.md](04-platform-audit.md)                 | `950f423ddb6ab2b3eef379b8aa49070c0bd5c8563abefe90bf04564936c41f69` |
| [05-general-bugs.md](05-general-bugs.md)                     | `8e2434f8ef713066002ce171577482a92e7aa8bae89000034b28de450820afca` |

## Reports and reconciliation

The five corresponding review reports are in progress. The final register will preserve every original finding,
including rejected and unresolved findings, and clearly distinguish any independently validated reviewer discoveries.
