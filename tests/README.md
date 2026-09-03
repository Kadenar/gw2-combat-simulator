# Test ownership

Tests follow the same ownership boundaries as the source tree:

- `app/` covers application composition and user-facing workflows.
- `architecture/` covers import aliases and cross-package dependency boundaries.
- `kernel/` and `ui/` cover game-neutral runtime and presentation contracts.
- `platform/engine/`, `platform/gw2/`, and `platform/ui/` cover shared GW2 and platform contracts.
- `professions/` covers cross-profession contracts, while `professions/<profession>/` owns profession behavior.
- `evtc/`, `dps-report/`, and `log-analyzer/` cover source-specific and shared combat-log reconstruction.
- `browser/` covers the built application's browser and layout behavior.
- `scripts/` covers command-line and authoring tools.
- `fixtures/`, `helpers/`, and `typecheck/` contain shared test support and compile-time contracts.

Place new tests under the narrowest directory that owns the behavior. Keep shared support in the existing support
directories instead of duplicating it under an owner.
