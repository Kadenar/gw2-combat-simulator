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
compose automatically. Snapshot item IDs must be unique across profession slices; also avoid shared IDs such as
`critical-chance` and `relic:<name>`.

### Profession item example

Berserker's `specializations/berserker/presentation.ts` reads its existing public state:

```ts
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';

rotationStateSnapshot: (context: WarriorUiContext) => {
  const state = warriorUiState(context);
  const remaining = (state[STATE.BERSERK_UNTIL] || 0) - warriorSnapshotAt(context);
  if (remaining <= 0) return [];
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
normally use seconds; derived duration fields and report records such as `procSteps` may use milliseconds. Preserve the
owning field's units and expiry policy. For exclusive expiry windows:

```ts
const activeStacks = expirations.filter((expiresAt) => expiresAt > context.atSeconds).length;
const currentWindow = windows.find(
  (window) => window.startedAt <= context.atSeconds && context.atSeconds < window.expiresAt
);
```

### Exposing runtime state

Each Core or elite module owns an explicit public projector. Runtime fields keep their local property names; public
observations use stable IDs from `PROFESSION_STATE_IDS`, conventionally imported as `STATE`. For example, Berserker's
owner publishes its mode deadline:

```ts
/** Publish the visible mode window without exposing private activation bookkeeping. */
export function projectBerserkerPlanningState(input: Gw2PlanningStateInput) {
  const state = berserkerState.from(input);
  return structuredClone({ [STATE.BERSERK_UNTIL]: state.berserkUntil });
}
```

Register the projector in `module.ts`, with all imports at the top:

```ts
state: { create: berserkerState.create, project: projectBerserkerPlanningState }
```

Declare profession-specific identities in `professions/<profession>/state-ids.ts`; the aggregate registry is
`professions/state-ids.ts`. Shared identities such as endurance and available flips live in
`platform/results/state-ids.ts`. IDs are namespaced strings such as `gw2.berserker.berserk-until`; they are independent
of runtime property names, display labels, build settings, skill IDs, and snapshot item IDs. Use the exported constants
in consumers and fixtures. Do not add old-name aliases or infer IDs from runtime keys.

Only Core and the active elite contribute observations. Each projector reads its actual owner, selects visible facts,
and detaches mutable values. Composition rejects duplicate IDs instead of letting module order overwrite a value. A
field owned by Core must be read from Core even if an elite is responsible for exposing it. Derive public types from
`ReturnType<typeof projector>` so a renamed ID or omitted field is checked in presentation code.

Clone the selected record once rather than cloning every scalar or the entire runtime. Projectors that normalize mutable
observations may use `cloneStateFields` to copy selected owner fields before filtering or deriving values. Never
traverse private cast histories, task queues, or pet internals to build a public observation. The result boundary also
detaches the composed observation; this protects generic extension projectors. See
[CLONE-PERFORMANCE.md](./CLONE-PERFORMANCE.md#planning-state-projections) for the copying contract.

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
