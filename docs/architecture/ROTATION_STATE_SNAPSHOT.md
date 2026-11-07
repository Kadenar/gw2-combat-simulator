# Rotation state snapshot navigation

The Active state bar displays combat state at the rotation cursor. Its inputs come from a simulation observation and
result queries. This guide follows those inputs to their owners.

## From cursor to display

1. [rotation/context.ts](../../js/games/gw2/app/rotation/context.ts) connects the editor to its accepted analysis
   inputs.
2. [CursorPreview](../../js/games/gw2/app/rotation/cursor-preview.ts) reuses or simulates the selected prefix. It owns
   revision checks and candidate queries.
3. [results/planning-state.ts](../../js/games/gw2/platform/results/planning-state.ts) projects execution state and
   profession observations.
4. [state-snapshot/model.ts](../../js/games/gw2/app/rotation/state-snapshot/model.ts) combines the observation with
   shared result-derived items and profession presentation.
5. [state-snapshot/view.ts](../../js/games/gw2/app/rotation/state-snapshot/view.ts) renders the prepared items.

Planning state is an observation, not a checkpoint for resuming execution. The current shape and units live in
[results/types.ts](../../js/games/gw2/platform/results/types.ts).

## Finding a profession value

A Core or elite `state.ts` owns its public projector, registered through `module.ts`. Its `presentation.ts` builds
display items from that observation. For a small example, read Berserker's
[state projector](../../js/games/gw2/professions/warrior/specializations/berserker/state.ts) and
[presentation callback](../../js/games/gw2/professions/warrior/specializations/berserker/presentation.ts).

Public identities live in each family's `state-ids.ts` and the
[aggregate registry](../../js/games/gw2/professions/state-ids.ts). Shared identities live in
[platform/results/state-ids.ts](../../js/games/gw2/platform/results/state-ids.ts).

[Presentation types](../../js/games/gw2/platform/profession-presentation/types.ts) define callback inputs and display
items. [Presentation composition](../../js/games/gw2/platform/profession-presentation/compose.ts) combines
contributions; [state composition](../../js/games/gw2/platform/profession-definition/state.ts) combines public
projections.

## Focused tests

[Cursor preview tests](../../tests/games/gw2/app/cursor-preview.test.js) cover prefix reuse and revision handling.
[State snapshot tests](../../tests/games/gw2/app/state-snapshot.test.js) cover the shared display model.
Profession-specific projection tests live under the [owning family](../../tests/games/gw2/professions/).
