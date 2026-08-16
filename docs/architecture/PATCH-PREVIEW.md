# Patch Preview: Live and Preview Data

> **Status:** Implementation contract.

## Goal

The repository must expose the live Guild Wars 2 data and, when one is
authored, exactly one upcoming patch preview. A developer selects either data
set in the simulator and can compare the same build and rotation against both.

Live profession source remains the source of truth. The preview is a sparse
overlay; it must not fork a profession catalog or duplicate a build/rotation.

When the patch ships:

1. apply the preview's `to` values to live source;
2. remove the active preview manifest;
3. run the same validation suite; and
4. commit the promotion as one reviewable change.

There is no preview history and there are no concurrent previews.

## Patch-note intake

Patch-note prose is not the simulator data model. Before authoring an overlay,
classify every note in a small ledger so nothing disappears silently.

| Classification                                        | Handling                                                                                                                   |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| PvE numeric skill/effect change                       | Apply through the catalog overlay.                                                                                         |
| PvE trait or runtime-computed change                  | Apply through a named patchable constant after the code path exposes one.                                                  |
| PvP/WvW-only change                                   | Record as `not-applicable`; this simulator models PvE.                                                                     |
| `unchanged` or a later note that supersedes a preview | Remove/cancel the earlier edit and record the resolution.                                                                  |
| Bug fix or behavior change                            | Implement ordinary code behind the preview selector when it changes simulated output; otherwise record it as out of model. |
| Description-only or unsupported system                | Record it as `tracked` with a reason. Do not pretend it affects comparison results.                                        |

The supplied notes demonstrate cases the original design did not cover:

- one entry can contain multiple edits or game modes;
- named packets matter (`initial hit`, `projectile`, and bounce/tick position);
- boon durations are effects too (quickness/alacrity), not conditions;
- global relics, traits, and resolver constants do not live in skill effects;
- `unchanged` entries cancel earlier preview edits;
- additions can supersede, rather than supplement, an earlier preview value;
- fixes can change behavior without containing an old/new number.

The manifest therefore stores authoritative structured edits and human-readable
notes/statuses. It does not attempt to parse ArenaNet prose at runtime.

## Authoring surface

The one optional manifest lives at `js/patches/active-preview.ts` and has:

- stable `id`, display `label`, optional source URL, and publication date;
- optional global patchable constants and General-note ledger entries;
- per-profession skill edits and patchable constants; and
- a per-profession note ledger with `applied`, `tracked`, `not-applicable`,
  `unchanged`, or `superseded` status.

The checked-in export is `null` when no upcoming preview exists. To author one,
replace only that value with a typed manifest:

```ts
export const activePatchPreview: PatchPreview | null = {
  id: "next-balance-preview",
  label: "Next Balance Preview",
  professions: {
    professionId: {
      skills: {
        "12345": {
          effects: [
            {
              effectIndex: 0,
              type: "strike",
              coefficient: { from: 1.2, to: 1.1 },
            },
          ],
        },
      },
      notes: [
        {
          subject: "Example Skill",
          text: "Reduced its first strike coefficient.",
          status: "applied",
        },
      ],
    },
  },
};
```

The identifiers and numbers above are deliberately fictional. Historical patch
notes must not be copied into the active manifest.

Numeric edits support four forms:

```ts
type NumEdit =
  | number
  | { readonly from: number; readonly to: number }
  | { readonly multiply: number }
  | { readonly add: number };
```

Use `{ from, to }` for published balance changes. Preview construction throws
when `from` no longer matches live source, preventing a stale overlay from
quietly changing the wrong baseline. `multiply` and `add` are available for
derived changes and tests.

### Skill authoring examples

The following are illustrative entries inside a profession's `skills` object.
The names and values are fictional; use a numeric skill ID and the actual live
value when authoring a real preview.

Condition duration and stacks use seconds and stack counts. The `conditions`
shorthand updates every matching aggregate effect or matching tick in a
timeline:

```ts
skills: {
  "Condition Adjustment Example": {
    conditions: {
      Burning: {
        duration: { from: 3, to: 6 }, // duration increase
        stacks: { from: 2, to: 1 }, // stack decrease
      },
      Torment: {
        duration: { from: 5, to: 4 }, // duration decrease
        stacks: { from: 1, to: 2 }, // stack increase
      },
    },
  },
},
```

Use an explicit selector when only one condition packet or timeline tick
changes. `effectIndex` is the zero-based index in the skill's complete live
`effects` array; the additional guards make a stale or incorrect index fail:

```ts
skills: {
  "Selected Packet Example": {
    effects: [
      {
        effectIndex: 2,
        type: "condition",
        condition: "Bleeding",
        tickIndex: 1,
        duration: { from: 4, to: 6 },
        stacks: { from: 1, to: 2 },
      },
    ],
  },
},
```

A newly introduced condition is a complete effect appended to the preview
skill. Supply timing fields such as `atMs`, `timingAnchor`, or `timingScale`
when it should not resolve at the effect system's default time:

```ts
skills: {
  "New Condition Example": {
    addEffects: [
      {
        type: "condition",
        condition: "Bleeding",
        stacks: 2,
        duration: 6,
        atMs: 500,
        timingAnchor: "castStart",
      },
    ],
  },
},
```

Remove a condition entirely with a guarded complete-effect selector. This is
different from changing its stacks or duration to zero: the preview catalog no
longer contains the selected effect.

```ts
skills: {
  "Removed Condition Example": {
    removeEffects: [
      {
        effectIndex: 1,
        type: "condition",
        condition: "Poison",
      },
    ],
  },
},
```

Structural selectors are resolved against the live effect array. Existing
numeric edits run first, complete effects are removed second, and new effects
are appended last. Set `all: true` only when a patch note intentionally removes
every effect matching the selector.

Cast times use milliseconds. `castTimeMs` is a convenience field; both
increases and decreases use the same stale-value guard:

```ts
skills: {
  "Slower Cast Example": {
    castTimeMs: { from: 750, to: 1000 },
  },
  "Faster Cast Example": {
    castTimeMs: { from: 1000, to: 600 },
  },
},
```

Resource costs are ordinary numeric skill fields. Use the property owned by
the live skill: `initiativeCost` for thief initiative, `energyCost` for
revenant energy, or `resourceCost` for a generic profession resource.

```ts
skills: {
  "Thief Initiative Example": {
    fields: {
      initiativeCost: { from: 5, to: 4 },
    },
  },
  "Revenant Energy Example": {
    fields: {
      energyCost: { from: 30, to: 35 },
    },
  },
  "Generic Resource Example": {
    fields: {
      resourceCost: { from: 10, to: 8 },
    },
  },
},
```

Cooldowns use seconds. `cooldown` is a convenience field; ammo skills should
instead patch their live `ammoRecharge` field through `fields`.

```ts
skills: {
  "Shorter Cooldown Example": {
    cooldown: { from: 20, to: 15 },
  },
  "Longer Cooldown Example": {
    cooldown: { from: 12, to: 18 },
  },
  "Ammo Recharge Example": {
    fields: {
      ammoRecharge: { from: 25, to: 20 },
    },
  },
},
```

Skill edits are keyed by numeric skill ID where practical, with an exact-name
fallback. They can edit skill fields such as cooldown/cast time and target one
or more effects by raw effect index plus optional type/name/condition/boon
guards. Tick-based strike and condition timelines can target one tick or all
ticks. Complete effects can also be appended or removed. Ambiguous selectors
throw unless the author explicitly opts into all matches.

Named patchable constants cover numbers computed outside catalog effects. Code
reads them through the shared helper using the simulation config. A constant
key is part of the authoring API and must be stable and specific, for example
`warrior.traits.burst-mastery.factor`. Static attribute calculations that occur
before simulation need an explicit preview-aware seam before such a note can be
marked `applied`.

```ts
patchRuntimeValue(
  context.config.patchValues,
  "profession.traits.example.factor",
  liveFactor,
);
```

## Data flow

All native professions already converge at the assembled canonical catalog:

```text
profession skill fragments
  -> assembled live CanonicalCatalog
  -> lazy sparse preview overlay
  -> current or preview runtime selected by config.patchId
```

`defineNativeProfession` accepts the singular optional preview manifest and
exposes:

- `catalog` as the backward-compatible live alias;
- `preview` as metadata or `null`;
- `catalogFor("current" | preview.id)`; and
- `patchValuesFor("current" | preview.id)` for runtime constants.

Preview application catalogs and specialization runtime catalogs are built
lazily. Untouched skills remain referentially identical to live skills. A
touched skill is cloned before editing because canonical data is frozen.

Runtime selection wraps the family resolver. This avoids the existing native
assembly cache collision and ensures scheduler, resolver, and UI lookup all use
the selected catalog without rebuilding raw module fragments.

## Application behavior

`patchId` is application state and simulation config, defaulting to
`"current"`. It is intentionally not part of an exported build: a saved build
describes player choices, while patch selection describes the data version used
to evaluate those choices.

When a preview exists, every profession page renders:

- a Live/Preview selector;
- the selected data set's normal detailed analysis;
- live and preview total DPS from the same build/rotation/assumptions;
- total and percentage delta plus per-skill deltas; and
- the authored note ledger/diff summary for that profession.

Random distributions and modifier-contribution jobs use the selected patch.
The automatic A/B result stays deterministic so comparison noise cannot be
mistaken for a patch effect.

## Scope and invariants

- The simulator is PvE-only. Competitive-only notes are visible in the ledger
  but never mutate PvE data.
- Preview edits change numbers/behavior, not IDs or names. Existing rotations
  therefore run unchanged on both catalogs.
- Adding/removing skills or changing loadout topology requires ordinary code,
  guarded by the patch selector if it must be previewable.
- Unknown patch IDs, skills, effects, fields, stale `from` values, and ambiguous
  selectors fail fast. Runtime constant `from` values are checked when their
  consuming code requests them.
- Catalog application never mutates live data.
- Only one preview manifest may be active.
- A note is marked `applied` only when the selected preview actually changes
  simulation behavior.

## Promotion

Promotion is deliberately explicit rather than a blind source codemod. Catalog
overlays may target generated metadata, handwritten fragments, or packetized
effects, while constants name arbitrary runtime locations. The promotion
command validates the manifest and prints a checklist of every applied edit and
source owner. The developer folds each value into live source, removes the
manifest, and tests the resulting identity (`current` now equals the former
preview). This keeps generated data ownership and hand-authored mechanics
reviewable.

Run `npm run patch-preview:report` before promotion. It builds the typed
manifest, constructs every affected preview catalog to catch stale selectors,
and prints the review checklist. After folding the values into live source,
set `activePatchPreview` back to `null` and run the full check again.

## Validation

Tests must prove:

1. no preview leaves every existing catalog and benchmark unchanged;
2. absolute, `{ from, to }`, multiply, and add edits work;
3. aggregate effects, selected packets, and tick timelines are targetable;
4. complete condition effects can be added and removed without mutating live;
5. live objects are never mutated and untouched skills retain identity;
6. invalid/stale/ambiguous authoring fails at preview construction;
7. live and preview runtime catalogs coexist without cache collisions;
8. `patchId` reaches scheduler/resolver patchable constants;
9. the same build and rotation produce both deterministic comparison results;
10. UI controls disappear cleanly when no preview is authored; and
11. build, typecheck, site checks, and relevant profession benchmarks pass.
