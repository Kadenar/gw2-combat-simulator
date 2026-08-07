# Test ownership

Tests follow the same ownership boundaries as the source tree:

- `app/` covers application composition and user-facing workflows.
- `platform/engine/`, `platform/gw2/`, and `platform/ui/` cover shared platform contracts.
- `professions/` covers cross-profession contracts, while each profession owns its specific suite in `professions/<profession>/`.
- `browser/`, `fixtures/`, `helpers/`, and `typecheck/` contain shared test support.

Place new tests under the narrowest directory that owns the behavior. Keep shared support in the existing support directories instead of duplicating it under an owner.
