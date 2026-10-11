# Rotation active-state snapshot

The **Active state** bar above the rotation timeline shows resources, modes, buffs, and other combat-dependent values at
the inspected rotation position. It defaults to rotation end. Insertion index `0` means before the first command; index
`n` means after the first `n` commands; the rotation length selects the final state.

The shared profession page template includes the `rotation-active-buffs` host. The application model lives in
`js/games/gw2/app/rotation/state-snapshot/model.ts`; `view.ts` renders its prepared items.

## State and observation time

`palettePlanningState(app)` supplies a detached `planningState` at the selected position. Insertion points use a cached
prefix simulation through `rotationPlanningStateAt()`. Rotation end reuses the current result unless an observation tail
requires a separate rotation-end observation. Prefix and append previews use the same runtime without a tail.

After target death, authored commands continue for editor planning while hostile effects and hit-dependent grants are
suppressed. Combat reports stop at `combatEndTime`; planning state describes the observation boundary. It is not a
resumable checkpoint. Snapshot hooks consume the provided state and time; they must not run simulations themselves.

The profession's `rotationStateSnapshot(context)` receives:

| Field             | Meaning                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `specialization`  | Active elite or `Core`                                            |
| `professionState` | Public projected profession state at the inspected point          |
| `planningState`   | Generic planning observation, including resources and cooldowns   |
| `atSeconds`       | Inspection time in simulation seconds                             |
| `build`           | Current application build                                         |
| `result`          | Full result for event-derived state; filter it by inspection time |
| `balanceContext`  | Selected Live/Preview balance declarations                        |

It returns items with this contract:

```ts
interface RotationStateSnapshotItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly active?: boolean;
  readonly title?: string;
}
```

Values are displayed as supplied. Keep them short (`4.2s`, `3/5`, `62%`) and put explanations in `title`. The renderer
escapes labels, values, and tooltips. Return `[]` for an irrelevant value; items with `active: false` are also hidden.
To display a meaningful zero, return its formatted value without marking the item inactive.

## Adding a state value

Choose the existing simulation owner before adding presentation:

| Source                                         | Change                                             |
| ---------------------------------------------- | -------------------------------------------------- |
| Already in projected profession state          | Add an item in the owning `presentation.ts`        |
| Runtime state omitted from public projection   | Extend that module's projection, then add the item |
| Generic planning state or shared result events | Extend `state-snapshot/model.ts`                   |
| Not modeled by the simulation                  | Implement and test the mechanic first              |

Do not create UI-only timers or duplicate simulation state. Core UI owns shared profession mechanics; elite UI owns
elite-specific mechanics; the shared model owns profession-neutral state. Core, active elite, and family list callbacks
compose automatically. IDs must be unique across profession slices; also avoid shared IDs such as `critical-chance` and
`relic:<name>`.

### Profession item example

Berserker's `specializations/berserker/presentation.ts` reads its existing public state:

```ts
rotationStateSnapshot: (context: WarriorUiContext) => {
  const state = warriorUiState(context);
  const remaining = (state.berserkUntil || 0) - warriorSnapshotAt(context);
  if (!state.berserkActive || remaining <= 0) return [];
  return [
    {
      id: 'berserk',
      label: 'Berserk',
      value: formatSecondsRemaining(remaining),
      title: 'Time remaining in Berserk mode'
    }
  ];
};
```

Use `context.atSeconds`, or a profession helper that reads it, for every timer and window. Timers in profession state
use seconds; some report records such as `procSteps` use milliseconds. Expiry windows are half-open:

```ts
const activeStacks = expirations.filter((expiresAt) => expiresAt > context.atSeconds).length;
const currentWindow = windows.find(
  (window) => window.startedAt <= context.atSeconds && context.atSeconds < window.expiresAt
);
```

### Exposing runtime state

Each Core or elite module owns its public projection. For example, Berserker declares
`BERSERKER_PUBLIC_STATE_PROJECTION` in `specializations/berserker/state.ts` using `definePublicStateDefaults()` and
registers it in `module.ts`:

```ts
state: {
  create: berserkerState.create,
  project: createPublicStateProjector(BERSERKER_PUBLIC_STATE_PROJECTION)
}
```

These helpers come from `#gw2/platform/profession-definition/state.js`. The projector selects and deeply clones declared
fields, using display defaults only for missing fields. Add an existing runtime field to its owning projection rather
than a family-wide list. Only Core and the selected elite contribute public state; inactive elites contribute no
defaults.

### Shared and event-derived items

Add generic values once in `state-snapshot/model.ts`. It already owns critical chance and relic buffs:

- Critical chance comes from the next eligible resolved strike at or after the cursor, falling back to the last earlier
  strike. It is that strike's value, not a recalculated attribute snapshot.
- Relic items inspect `result.procSteps`, ignore activations after the cursor, and use expiry timestamps and the latest
  applicable stack count.

Filter full-result events by inspection time so a later activation cannot appear at an earlier cursor position.

## Validation

Use focused Node tests for snapshot callbacks: inactive/active state, exact expiry, stack caps, selection gates, and
specialization composition as relevant. For new projected fields, verify they appear in `planningState.profession` and
remain detached from runtime state. Use browser tests only for changed rendering or cursor integration; each profession
need not retest shared insertion infrastructure. An item returned by the hook needs no additional HTML or timeline
wiring.
