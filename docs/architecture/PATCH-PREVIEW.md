# Patch preview

The simulator supports one upcoming PvE balance patch alongside Live data. A preview is a sparse overlay on existing
skills, balance profiles, and modifier rules; it does not duplicate catalogs, builds, or rotations. Untouched values
remain live, and constructing a preview does not mutate live declarations.

## Authoring workflow

1. Run `npm run author:patch-preview` and open `http://127.0.0.1:4174` (the default local authoring address).
2. Enter an ID, label, optional publication date, and official patch-notes URL.
3. Select affected professions and edit their skills, balance profiles, or modifier rules.
4. Review the generated **Overview & source**, save, and inspect the source diff.
5. Rebuild the simulator, then compare Live and Preview using the same build and rotation.

The authoring server binds to `127.0.0.1`. Its `PUT /api/patch-preview` endpoint validates the complete draft against
live catalogs and rules before writing `js/games/gw2/integrations/patches/active-preview.ts`. A successful save changes
source on disk; it does not rebuild the simulator. `npm start` rebuilds through `prestart` and serves the simulator on
`http://127.0.0.1:4173`. Restarting `vite preview` directly does not compile changed source. The normal simulator server
does not expose the authoring write API.

When no preview is active, the manifest exports:

```ts
export const activePatchPreview: PatchPreview | null = null;
```

## Choose the owning declaration

| Change                                                                 | Author through                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Skill coefficient, condition/boon stacks or duration                   | Skills: effect or tick                                    |
| Skill cooldown, resource cost, published activation duration           | Skills: numeric field (`castTimeMs` for duration)         |
| Added or removed effect                                                | Skills: add/remove effect                                 |
| Existing cast/effect resource grant                                    | Its stable resource-grant ID                              |
| Shared mechanic tuning                                                 | Balance profiles                                          |
| Static trait modifier                                                  | Traits & modifiers: stable modifier-rule ID               |
| Runtime modifier scaling                                               | Modifier parameter                                        |
| Internal packet offsets, interrupt commitment, summon cast calibration | Owning runtime source                                     |
| Changed trigger, state transition, ownership, or new mechanic          | Ordinary implementation, explicitly patch-aware if needed |

Patch values where the simulator already owns them. Do not duplicate profile values onto skills or create inert numeric
entries to represent behavior that needs code. PvP/WvW-only, description-only, unsupported-system, unchanged, and
superseded patch-note entries do not belong in the manifest.

### Guarded numeric edits

Every numeric edit records the expected live value and replacement:

```ts
skills: {
  '12345': {
    fields: {
      cooldown: { from: 20, to: 15 }
    },
    effects: [
      {
        effectIndex: 0,
        type: 'strike',
        coefficient: { from: 1.2, to: 1.35 }
      }
    ]
  }
}
```

Prefer numeric skill IDs. `effectIndex` is zero-based; identity fields such as `type`, `condition`, or `boon` guard
against editing a different effect after data changes. Add `tickIndex` to target an individual entry in an effect's
`ticks` array. A stale `from`, unknown target/field, or invalid selector fails validation. Review the new live value
instead of bypassing the guard.

The supported numeric fields come from
[`authoring/fields.ts`](../../js/games/gw2/integrations/patches/authoring/fields.ts), and only fields present on the
live declaration are exposed. `castTimeMs` is patchable. Internal fields such as `quicknessCastTimeMs`,
`interruptCommitMs`, `ammoCastLockout`, `rechargeOffsetMs`, and existing packet offsets (`atMs`) remain runtime-only.
Flat strike formulas expose their own fields rather than an ineffective coefficient control.

### Added and removed effects

An added effect must provide its complete simulator representation, including timing when it differs from the default:

```ts
{
  type: 'condition',
  condition: 'Bleeding',
  stacks: 2,
  duration: 6,
  atMs: 500,
  timingAnchor: 'castStart',
  timingScale: 'fixed'
}
```

Removal uses a guarded selector and removes the effect from the preview catalog, rather than setting its values to zero:

```ts
removeEffects: [{ effectIndex: 1, type: 'condition', condition: 'Poisoned' }];
```

### Balance profiles and modifier rules

`balanceProfiles` uses profile IDs with the same `fields` and `effects` grammar as skills. Trait definitions expand at
native module registration; preview reconstruction consumes those expanded declarations without registering them again.
Callbacks, build calculations, and tooltips use the selected balance context.

A trait may contribute several rules. Target the stable modifier-rule ID, not the trait ID:

```ts
modifierRules: {
  'profession.example-strike-bonus': {
    factor: { from: 1.1, to: 1.15 }
  },
  'profession.example-stacking-bonus': {
    parameters: {
      perStack: { from: 0.01, to: 0.015 }
    }
  }
}
```

Runtime resolver functions are not patched. Expose changing numeric inputs as named parameters first, then patch those
parameters with the same stale-value guards. Behavioral changes belong in the owning implementation. If Live and Preview
behavior must coexist, use an explicit patch-aware branch there. New skills, changed IDs, loadout topology, and new
profession mechanics generally require implementation work beyond the sparse overlay.

## Overview and comparison

**Overview & source** is generated from structured skill, profile, and modifier diffs when displayed. Saved previews
contain only structured edits; `overview` fields are rejected by validation. Build-specific notes filter edits for
relevance before generating their text. Code-only behavior changes are not automatically summarized; the official source
link and code review provide their context.

With an active preview, **Game data** selects Live or the preview for the detailed result. This is application state,
not saved-build identity. Build exports remain usable with either data set.

The automatic comparison runs the same build and rotation against both catalogs and shows total and per-skill DPS
differences. It uses deterministic mode and the same seed, midpoint weapon strength, and the selected critical-damage
policy (averaged by default). Proc outcomes still use seeded draws. Changes to eligibility or event order can change
which rolls are consumed, so a single-seed difference can include proc variation and, with rolled damage selected,
critical-damage variation.

## Validation and promotion

Before committing, inspect `active-preview.ts` for intended profession/target IDs, `from` and `to` values, effect/tick
selectors, added/removed effects, and the official source URL. Rebuild and run `npm run check`; run the relevant browser
tests if authoring or simulator browser behavior changed.

When the patch becomes live:

1. Run `npm run patch-preview:report`. It builds and resolves affected preview catalogs/runtimes, rejecting stale
   selectors and invalid declarations, and prints a promotion checklist. Also inspect balance-profile manifest entries.
2. Apply preview values to their live owning sources and update generated data where appropriate.
3. Restore `activePatchPreview` to `null`.
4. Rebuild and run release validation (`npm run check:all`).
5. Verify the new Live result matches the former Preview result for the same scenario and seed.

Promotion is a reviewed source change. Remove the overlay when it ships instead of retaining historical preview data.
