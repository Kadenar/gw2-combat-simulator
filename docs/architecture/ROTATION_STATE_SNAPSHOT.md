# Rotation "Active State" Snapshot — Extension Contract

The sticky bar above the rotation timeline (`#rotation-active-buffs`) reports
inspectable values **at a single point in the rotation**: the insertion cursor
when one is set (click between skills), otherwise the current end of the
rotation. It is time-based — the label reads `Active state @ <time>` using the
same clock as the timeline.

It exists to surface things the static Attributes panel cannot, because they
change *during* the fight: critical strike chance under dynamic buffs,
profession/spec timers (Berserk, Overcharged Cartridges), and target debuffs
(Magebane Tether).

There are two kinds of items:

- **Generic** (profession-neutral) — computed in the app layer. Today: critical
  strike chance. See [state-snapshot-view.ts](../../js/app/rotation/state-snapshot-view.ts).
- **Profession-specific** — contributed by the active specialization through the
  `ui.rotationStateSnapshot` hook.

Everything is **insertion-aware for free**: the bar reuses `paletteEndState(app)`
(the same insertion-cursor-aware end state the palette cooldown display uses), so
no extra simulation is run.

---

## The hook

```ts
// js/platform/engine/types.d.ts
interface RotationStateSnapshotItem {
  readonly id: string;      // unique across the merged set for the active spec
  readonly label: string;   // e.g. "Berserk"
  readonly value: string;   // pre-formatted text, e.g. "4.2s", "3", "62%"
  readonly active?: boolean; // when false the item is dropped; default shown
  readonly title?: string;   // optional tooltip
}

interface ProfessionUiContract {
  readonly rotationStateSnapshot: (
    context: SchedulerRecord,
  ) => RotationStateSnapshotItem[];
}
```

The app calls the hook with this context (see `snapshotItems` in
[state-snapshot-view.ts](../../js/app/rotation/state-snapshot-view.ts)):

| field            | meaning                                                        |
| ---------------- | ------------------------------------------------------------- |
| `specialization` | active elite name — **required** so the right spec slice runs |
| `professionState`| `endState.profession` at the snapshot point                    |
| `atSeconds`      | snapshot time in **seconds** (timers are compared against this)|
| `build`          | the application build                                          |
| `result`         | the full simulation result (for event-derived values)         |

Composition is automatic. `rotationStateSnapshot` is registered in both
`UI_CALLBACK_NAMES` and `UI_LIST_CALLBACK_NAMES` in
[profession.ts](../../js/platform/engine/profession.ts), so for a given build the
engine **concatenates** the items from `[core, activeSpecialization, family]`
and de-duplicates by `id`. A profession that never implements the hook simply
shows the generic items.

---

## Add a new item to an existing profession

Example: add a spec timer to a warrior specialization.

1. **Make sure the value is exposed in `endState.profession`.**
   The projected end state is a **whitelist**, not the whole state object. For
   warrior that is `WARRIOR_PUBLIC_END_STATE_KEYS` in
   [core/state.ts](../../js/professions/warrior/core/state.ts) — add the field name
   (and a sane entry in `INACTIVE_DEFAULTS`). Other professions have the same
   pattern (e.g. `REVENANT_PUBLIC_END_STATE_KEYS`). Skip this step only if the
   value is already listed.

2. **Emit the item from the spec's UI slice.** Add/extend `rotationStateSnapshot`
   in the spec `ui.ts` (e.g.
   [berserker/ui.ts](../../js/professions/warrior/specializations/berserker/ui.ts)):

   ```ts
   rotationStateSnapshot: (context: WarriorUiContext) => {
     const state = warriorUiState(context);
     const remaining = Number(state.berserkUntil || 0) - warriorSnapshotAt(context);
     if (!state.berserkActive || remaining <= 0) return []; // hide when inactive
     return [{
       id: "berserk",
       label: "Berserk",
       value: formatSecondsRemaining(remaining),
       title: "Time remaining in Berserk mode",
     }];
   },
   ```

That's it — no HTML/CSS changes, no wiring. The bar picks it up.

### Rules of thumb

- **Timers are seconds.** Scheduler/profession timers (`*Until`, expiry arrays,
  windows) are simulation seconds. `context.atSeconds` is too. Compute
  `remaining = until - atSeconds`; return `[]` (or `active: false`) when `<= 0`
  so inactive timers don't clutter the bar.
- **Format the value yourself.** `value` is rendered as-is. Use the shared
  `formatSecondsRemaining` for durations; plain strings for counts/percents.
- **Unique `id`.** Duplicate ids across the merged set throw at compose time.
- **Stacks/windows** — count array entries with `expiry > atSeconds` (Attacker's
  Insight), or find the window containing `atSeconds` (Overcharged Cartridges).
  See [spellbreaker/ui.ts](../../js/professions/warrior/specializations/spellbreaker/ui.ts)
  and [bladesworn/ui.ts](../../js/professions/warrior/specializations/bladesworn/ui.ts).

---

## Enable it for a new profession

1. Add the HTML container above the timeline in the profession's page:
   `<div id="rotation-active-buffs" class="rotation-active-buffs" hidden></div>`
   (all native pages already have it; the render no-ops if it is missing).
2. Implement `rotationStateSnapshot` on the relevant spec/core UI slices, per the
   steps above. Nothing else is needed — the generic crit-chance item and the
   render/wiring are shared. If a profession contributes nothing, only the
   generic items appear.

---

## Data-source cheat-sheet

Pick the tier that matches the value you want:

| Want to show                     | Source                                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| Spec resource / timer / window   | `endState.profession` (whitelist) → spec `rotationStateSnapshot`       |
| Target debuff tracked as a timer | Same as above (e.g. `magebaneTetherUntil`)                            |
| Critical strike chance           | Nearest resolved strike's `criticalChance` — generic, already handled  |
| Target conditions (Vuln, etc.)   | `result.resolvedEvents` (type `condition`) intervals containing `at`   |
| Timed self-buffs / boon stacks   | `result.events` (type `buff`) intervals — not yet surfaced             |

The last two rows are the natural next extensions: add a generic helper in
[state-snapshot-view.ts](../../js/app/rotation/state-snapshot-view.ts) that reads
`result` at `timeMs`, mirroring `criticalChanceAt`.
