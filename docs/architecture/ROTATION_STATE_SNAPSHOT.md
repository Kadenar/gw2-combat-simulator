# Rotation active-state snapshot

The **Active state** bar above the rotation timeline shows combat state at the point in the rotation currently being
inspected.

By default, it represents the end of the rotation. When an insertion cursor is selected, it represents the state
**between those rotation entries**.

For example:

```text
Rotation:

[A]  [B]  [C]
 ^    ^    ^    ^
 0    1    2    3
```

- insertion index `0` = before `A`
- insertion index `1` = after `A`, before `B`
- insertion index `2` = after `B`, before `C`
- insertion index `3` = after `C`, equivalent to the final rotation state

The bar is intended for values that change during combat and therefore cannot be represented accurately by the static
Attributes panel, such as:

- profession resources;
- active profession modes;
- temporary damage buffs;
- trait stacks;
- transformation timers;
- target debuffs;
- critical strike chance;
- other state that depends on the current rotation position.

The relevant UI container is:

```html
<div id="rotation-active-buffs" class="rotation-active-buffs" hidden></div>
```

All current native profession pages already include it.

---

## How the snapshot gets its state

The snapshot model and renderer live in:

```text
js/games/gw2/app/rotation/state-snapshot/model.ts
js/games/gw2/app/rotation/state-snapshot/view.ts
```

The model uses `paletteEndState(app)` to obtain the state associated with the current rotation position. The view only
renders that prepared snapshot.

At the end of the rotation, the existing simulation result is reused.

At an insertion point, the application evaluates the rotation prefix up to that insertion index through
`rotationEndStateAt()`. That checkpoint is cached and shared with other insertion-aware UI such as cooldown and
profession-resource displays.

**Snapshot hooks should never run their own simulation.** The application provides the state and inspection time to the
hook.

The profession hook receives:

```ts
rotationStateSnapshot(context);
```

with the following useful fields:

| Field             | Meaning                                                    |
| ----------------- | ---------------------------------------------------------- |
| `specialization`  | Active elite specialization, or `Core`                     |
| `professionState` | Projected profession state at the inspected rotation point |
| `atSeconds`       | Simulation time of that point, in seconds                  |
| `build`           | Current application build                                  |
| `result`          | Full simulation result, useful for event-derived state     |

The hook returns:

```ts
interface RotationStateSnapshotItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly active?: boolean;
  readonly title?: string;
}
```

Example:

```ts
{
  id: "berserk",
  label: "Berserk",
  value: "4.2s",
  title: "Time remaining in Berserk mode",
}
```

`value` is rendered exactly as supplied.

Return no item when a value is not currently meaningful:

```ts
if (!active) return [];
```

or mark an individual item inactive:

```ts
{
  id: "example",
  label: "Example",
  value: "0",
  active: false,
}
```

---

# Adding a new state value

The implementation depends on **where the information already lives**.

Use this decision tree:

```text
Do you want to display a new value?
        |
        +-- Is it already in professionState?
        |       |
        |       +-- YES → Add rotationStateSnapshot item
        |
        +-- Is it tracked in runtime profession state,
        |   but missing from professionState?
        |       |
        |       +-- YES → Project it into endState.profession
        |                 → Add rotationStateSnapshot item
        |
        +-- Is it represented by simulation events/buffs?
        |       |
        |       +-- YES → Read context.result at context.atSeconds
        |                 → Add rotationStateSnapshot item
        |
        +-- Is it generic state shared by every profession?
        |       |
        |       +-- YES → Add it in state-snapshot/model.ts
        |
        +-- Is the value not tracked anywhere?
                |
                +-- Implement the simulation state/event first
                    → expose it using one of the paths above
```

The important distinction is that **not every snapshot value belongs in `endState.profession`**.

Use the simulator's existing source of truth whenever possible.

---

## Case 1: the value is already in profession state

This is the simplest case.

Suppose a specialization already tracks:

```ts
berserkActive;
berserkUntil;
```

and those fields are available through `context.professionState`.

Add the value to that specialization's `ui.ts`:

```ts
rotationStateSnapshot: (context: WarriorUiContext) => {
  const state = warriorUiState(context);
  const at = warriorSnapshotAt(context);

  const remaining =
    Number(state.berserkUntil || 0) - at;

  if (!state.berserkActive || remaining <= 0) {
    return [];
  }

  return [
    {
      id: "berserk",
      label: "Berserk",
      value: formatSecondsRemaining(remaining),
      title: "Time remaining in Berserk mode",
    },
  ];
},
```

No application-layer wiring or HTML changes are needed.

The active-state bar automatically calls the hook again for the selected rotation position.

### Timer units

Profession timers use simulation **seconds**.

`context.atSeconds` is also in seconds.

For an absolute expiry:

```ts
remaining = expiresAt - context.atSeconds;
```

For example:

```ts
const remaining = Number(state.someBuffUntil || 0) - Number(context.atSeconds || 0);
```

Hide expired values:

```ts
if (remaining <= 0) return [];
```

---

# Case 2: the simulator tracks the value, but it is not projected

Runtime profession state and the public `endState.profession` projection are not necessarily the same object.

A profession may intentionally expose only selected state fields.

For example, Warrior projects a whitelist through:

```text
js/games/gw2/content/professions/warrior/core/state.ts
```

using:

```ts
WARRIOR_PUBLIC_END_STATE_KEYS;
```

If a runtime field exists but the snapshot cannot see it, first determine whether it is missing from the profession's
public end-state projection.

For a hypothetical timer:

```ts
battleFocusUntil;
```

the complete flow would be:

### 1. Make sure the simulator actually owns the field

The relevant profession or specialization state should define and initialize it:

```ts
{
  battleFocusUntil: 0,
}
```

The simulation mechanics must update it when appropriate:

```ts
state.battleFocusUntil = context.time + 5;
```

Do not add a snapshot-only shadow copy of state that the simulator does not use.

### 2. Expose it through the end-state projection

For a whitelist-style projection:

```ts
export const WARRIOR_PUBLIC_END_STATE_KEYS = Object.freeze([
  // ...
  'battleFocusUntil'
]);
```

If the projection requires inactive defaults, add one:

```ts
const INACTIVE_DEFAULTS = Object.freeze({
  // ...
  battleFocusUntil: 0
});
```

Now the value can reach:

```ts
context.professionState;
```

at both the end of the rotation and an insertion checkpoint.

### 3. Render it through the UI hook

```ts
rotationStateSnapshot: (context) => {
  const state = warriorUiState(context);

  const remaining =
    Number(state.battleFocusUntil || 0) -
    warriorSnapshotAt(context);

  if (remaining <= 0) return [];

  return [
    {
      id: "battle-focus",
      label: "Battle Focus",
      value: formatSecondsRemaining(remaining),
    },
  ];
},
```

The full flow is therefore:

```text
runtime state
    ↓
profession mechanics update it
    ↓
projectEndState()
    ↓
endState.profession
    ↓
context.professionState
    ↓
rotationStateSnapshot()
    ↓
Active state bar
```

---

# Case 3: the value already exists in simulation events

Not every temporary effect should be duplicated into profession state.

If the simulator already emits the effect into its event timeline, derive the snapshot from the event timeline instead.

This is the preferred approach for many temporary buffs because it keeps the display tied to the same data that combat
calculations use.

Two shared helpers are available in:

```text
js/games/gw2/app/rotation/state-snapshot/model.ts
```

## Timed buff

Use:

```ts
timedBuffAt(result, kind, atSeconds);
```

to find an active timed buff and its remaining duration.

Example:

```ts
import { timedBuffAt } from '../../../app/rotation/state-snapshot/model.js';
```

Then:

```ts
rotationStateSnapshot: (context) => {
  const buff = timedBuffAt(
    context.result,
    "peak-performance",
    context.atSeconds,
  );

  if (!buff) return [];

  return [
    {
      id: "peak-performance",
      label: "Peak Performance",
      value: formatSecondsRemaining(buff.remaining),
    },
  ];
},
```

This does **not** require:

- a new profession-state field;
- a public end-state projection;
- a second timer maintained only for the UI.

The event timeline remains the source of truth.

---

## Stacking timed buff

For effects where each application contributes stacks independently, use:

```ts
timedBuffStacksAt(result, kind, atSeconds);
```

For example:

```ts
const stacks = Math.min(5, timedBuffStacksAt(context.result, 'signet-mastery', context.atSeconds));

if (stacks <= 0) return [];

return [
  {
    id: 'signet-mastery',
    label: 'Signet Mastery',
    value: `${stacks}/5`,
    title: `+${stacks * 100} ferocity`
  }
];
```

This is the pattern used by Warrior's Signet Mastery snapshot.

Use event-derived state when the event timeline already represents the mechanic accurately.

---

# Case 4: arrays of expirations or active windows

Some mechanics store several expiration times rather than one `*Until` value.

For example:

```ts
attackerInsightExpiries: number[]
```

Count entries that are still active at the inspected time:

```ts
const at = warriorSnapshotAt(context);

const stacks = (state.attackerInsightExpiries || []).filter((expiresAt) => Number(expiresAt) > at).length;
```

Then:

```ts
if (!stacks) return [];

return [
  {
    id: 'attackers-insight',
    label: "Attacker's Insight",
    value: String(stacks)
  }
];
```

For structured windows:

```ts
[
  {
    startedAt: 12,
    expiresAt: 17
  }
];
```

find the window containing the inspection point:

```ts
const current = windows.find((window) => window.startedAt <= at && window.expiresAt > at);
```

The important rule is:

> Always evaluate the collection against `context.atSeconds`, not against the final simulation time.

---

# Case 5: add a generic value for every profession

Values that are not profession-specific belong in:

```text
js/games/gw2/app/rotation/state-snapshot/model.ts
```

The shared `rotationStateSnapshot()` function already receives the insertion-aware generic end state:

```ts
const state = paletteEndState(app);
const timeMs = Number(state?.time || 0);
```

For example, to expose the currently active weapon set globally:

```ts
const activeWeaponSet = Number(state?.activeWeaponSet || 1);

items.push({
  id: 'active-weapon-set',
  label: 'Weapon set',
  value: String(activeWeaponSet)
});
```

This automatically works at:

- rotation start;
- any insertion point;
- rotation end;
- every profession.

Generic state should be added here rather than copied into every profession UI module.

Critical strike chance is currently implemented using this shared path.

---

# Case 6: the simulator does not track the value yet

The snapshot system is a **view of simulation state**, not a second state-management system.

If the value you want is not available in:

- `endState`;
- profession state;
- `result.events`;
- `result.resolvedEvents`;
- or another existing simulation result;

then the simulation needs to model it first.

Do not calculate an independent approximation solely inside:

```ts
rotationStateSnapshot();
```

Instead:

1. decide what owns the mechanic;
2. add the runtime state or simulation event;
3. update that state from the normal simulation hooks;
4. verify the simulation behavior;
5. expose the value through the appropriate snapshot path.

This keeps the Active state bar consistent with the actual damage and availability logic.

---

# Core vs specialization snapshots

`rotationStateSnapshot` is a list-style profession UI callback.

A profession can contribute items from several UI slices.

For example:

```text
Warrior Core
    +
Berserker
    +
family UI
```

The active slices are combined automatically.

This means a Core hook can display state common to every specialization:

```ts
export const warriorCoreUi = {
  rotationStateSnapshot: warriorCoreStateSnapshot
};
```

while Berserker can add:

```ts
export const berserkerUi = {
  rotationStateSnapshot: berserkerStateSnapshot
};
```

Both lists appear in the same Active state bar.

Use:

- **Core UI** for mechanics shared by the profession;
- **specialization UI** for mechanics that only exist on one elite specialization;
- **shared application code** for profession-neutral state.

Snapshot item IDs must be unique among the composed profession UI slices. Duplicate IDs are treated as an error rather
than silently replacing one another.

Also avoid IDs owned by generic shell items, such as:

```text
critical-chance
```

Use stable descriptive IDs for new entries.

---

# Formatting snapshot values

Snapshot values are presentation strings.

Examples:

```ts
value: '4.2s';
value: '3';
value: '3/5';
value: '62%';
value: 'Fire/Air';
```

For timers, use an existing profession helper such as:

```ts
formatSecondsRemaining(remaining);
```

when available.

The renderer escapes labels, values, and tooltips before inserting them into the page.

Keep the primary value short. Put additional explanation in `title`:

```ts
{
  id: "signet-mastery",
  label: "Signet Mastery",
  value: "3/5",
  title: "+300 ferocity (+100 per stack)",
}
```

---

# Testing a new snapshot item

Snapshot logic should normally have a focused unit test.

A snapshot callback can be tested without rendering the browser UI.

Example:

```js
const RESULT = {
  events: [
    {
      type: 'buff',
      kind: 'example-buff',
      at: 1,
      duration: 5
    }
  ]
};

const items = professionUi.rotationStateSnapshot({
  result: RESULT,
  atSeconds: 3
});

assert.equal(items[0].id, 'example-buff');
assert.equal(items[0].value, '3.0s');
```

Useful cases to cover are:

- before the effect begins;
- while the effect is active;
- exactly around expiration;
- after expiration;
- stack caps;
- trait/build gating;
- specialization gating.

For projected profession state, also verify that the field exists in the simulation's `endState.profession`.

Insertion behavior itself is shared infrastructure and does not need to be reimplemented by each profession.

---

# Extension checklist

When adding a new Active state value:

- [ ] Decide whether the value comes from profession state, generic state, or simulation events.
- [ ] If it is new simulation state, implement and test the mechanic first.
- [ ] If it exists only in runtime profession state, expose it through the profession's public end-state projection.
- [ ] Add `rotationStateSnapshot` to the appropriate Core or specialization UI slice.
- [ ] Evaluate timers and windows against `context.atSeconds`.
- [ ] Prefer existing simulation events over duplicate UI-only state.
- [ ] Return nothing when the value is inactive unless showing zero is meaningful.
- [ ] Use a stable snapshot `id`.
- [ ] Keep the displayed `value` concise.
- [ ] Add a focused snapshot test.

No additional rendering, insertion-cursor, or timeline wiring is required for an existing native profession.

Once the item is returned by `rotationStateSnapshot`, it participates in the Active state bar automatically.
