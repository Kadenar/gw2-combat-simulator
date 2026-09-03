# dps.report Analyzer

The dps.report adapter reconstructs simulator rotations from the Elite Insights JSON data exposed by
[dps.report](https://dps.report).

It provides the simulator with a convenient way to import an existing benchmark or combat log without requiring the
original EVTC file. A report can be loaded directly from a dps.report permalink or from previously downloaded Elite
Insights JSON.

## Supported Inputs

The analyzer accepts:

- A public `dps.report` permalink or report ID
- Raw Elite Insights JSON downloaded from a report

When a permalink is provided, `url.ts` resolves the report ID and retrieves the report through the public
`dps.report/getJson` endpoint.

## Rotation Reconstruction

Elite Insights provides a summarized view of the original EVTC log. The analyzer converts that data into a chronological
sequence of simulator actions by:

1. Validating the report, players, phases, skill metadata, and recorded casts.
2. Identifying players and their profession/specialization.
3. Selecting the player that matches the simulator's active build.
4. Converting Elite Insights cast groups into a chronological action timeline.
5. Resolving recorded skills against the simulator's active skill catalog.
6. Applying profession- and specialization-specific reconstruction rules.
7. Converting the reconstructed timeline into simulator rotation commands.
8. Reporting anything that could not be reconstructed confidently as an import warning.

The profession-specific reconstruction layer sits beside the EVTC adapter, while both use `../lib` for source-neutral
scheduling, profiles, catalogs, contracts, and reusable rules.

## Why Reconstruction Is Necessary

Elite Insights rotation data is a summary of the original combat log rather than a complete event stream.

It does not expose every:

- Effect packet
- Buff transition
- Initial combat state
- Weapon or profession state transition
- Instant action
- Precast action
- Generated or automatic effect

Because of this, the analyzer occasionally has to infer actions from surrounding casts, build state, or repeated
rotation patterns.

These inferences are intentionally conservative. An action is only reconstructed when the available report contains
enough evidence to support it. Otherwise, the import is left incomplete and a warning is presented for review.

## Profession-Specific Reconstruction

Some professions require additional handling to turn Elite Insights cast data into simulator actions.

Examples include:

- **Engineer** — reconstructing kit transitions and actions implied by dependent kit skills.
- **Elementalist** — normalizing attunement-dependent skills, chained movement skills, shortened channels, and certain
  omitted instant actions.
- **Luminary** — reconstructing initial Radiant Courage and Radiant Forge state from Forge-dependent actions and later
  activation patterns.
- **Herald** — reconstructing opening facet consumes and certain precasts from dependent actions and repeated weapon
  cycles.
- **Conduit** — reconstructing omitted weapon or legend precasts and normalizing composite animations.
- **Renegade** — reconstructing opening warband summons, legend-cycle precasts, composite weapon animations, and
  enhanced skill signals.

Automatic effects that are already modeled by the simulator are not added to the imported rotation.

## Project Structure

```text
js/games/gw2/integrations/logs/dps-report/
├── parser.ts
├── url.ts
├── errors.ts
├── types.ts
└── rotation/
    ├── index.ts
    ├── registry.ts
    ├── reconstruct.ts
    ├── profiles.ts
    ├── target-damage.ts
    ├── types.ts
    └── professions/
```

### `url.ts`

Validates dps.report links and report IDs and retrieves their public Elite Insights JSON.

### `parser.ts`

Validates the portions of the Elite Insights schema required for rotation reconstruction, including players, phases,
skill metadata, rotation groups, and casts.

### `rotation/registry.ts`

Identifies supported players and dispatches reconstruction to the appropriate profession/specialization profile.

### `rotation/reconstruct.ts`

Builds the chronological action timeline, resolves skills against the simulator catalog, applies reconstruction rules,
and produces simulator rotation commands.

### `rotation/professions/`

Contains profession-wide and specialization-specific corrections for mechanics that cannot be reconstructed reliably
from generic Elite Insights cast data alone.

## Limitations

A reconstructed rotation should not be treated as a byte-for-byte replay of the original EVTC log.

Information unavailable in Elite Insights JSON cannot always be recovered. In particular, opening state, instant skills,
automatic effects, and actions occurring before the visible rotation may be ambiguous.

When the analyzer cannot establish an action with sufficient confidence, it prefers to omit the action and surface a
warning rather than manufacture a potentially incorrect rotation.

For the most complete reconstruction, use the original EVTC log with the EVTC adapter when it is available.

## Related Tools

The application can import both dps.report data and raw EVTC logs through the rotation import interface.

`scripts/analysis/analyze-dps-report.mjs` is separate from the application import path. It is intended as a
forensic/development tool for inspecting additional data embedded in rendered dps.report pages.
