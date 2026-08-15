# Patch Preview: Dual Number Sets (Current vs Preview)

> **Status:** Design / not yet implemented. This document is an implementation
> brief for the agent picking up the work.

## Goal

Let the simulator hold **two active versions of the numbers simultaneously** —
`current` (the live patch) and one or more `preview` patches — and let a run pick
which set it uses. GW2 balance patches are overwhelmingly small numeric tweaks:
strike damage coefficients, condition stacks/durations, cooldowns, cast times.

The payoff feature: run the _same_ build + rotation through both number sets and
show the DPS delta.

**Do not fork the data.** Model a patch as a sparse **overlay/diff** applied on
top of the base numbers. Base data files always represent the live patch; a
preview is only the diff.

## Scope

**In scope:** every native profession registered by the application. All use
Core and specialization-owned `skillMechanics` fragments and converge at the
same assembled-catalog boundary. Do not add profession-specific patch paths.

## Current architecture (validated)

Per-profession data flow (`js/professions/<prof>/`):

```
raw skill numbers ──► createNativeModuleData({ generatedSkills, skillMechanics, ... })
                      (js/platform/gw2/native-profession.js)
   └─► modules.ts ──► defineNativeProfession({ modules, catalog })   [family.ts]
                      └─► getNativeCatalogAssembly(modules, options)  [native-catalog-assembly.ts]
                          └─► assembly.catalog  (frozen CanonicalCatalog, built ONCE at import)
                              └─► xProfession singleton (frozen), exported from family.ts
```

App side: `js/app/profession/registry.ts` lazy-loads each profession;
`create-runtime.ts` and `create-adapter.ts` read `profession.catalog`
(e.g. `js/app/profession/create-runtime.ts:98` → `catalog: profession.catalog`).
Simulations resolve damage from that catalog's skill `effects[]`.

### Where the numbers live

All native professions store coefficients in `skillMechanics` fragments
(`Record<SkillId, SkillFragment>`) spread across `core/skills.ts`,
`core/weapons.ts`, and `specializations/*/skills.ts`. Example:
`js/professions/necromancer/core/skills.ts:19-34`. These fragments merge into
each assembled-catalog skill's `effects[]`, typed by the platform union in
`js/platform/engine/types.d.ts:176-232`:

- `StrikeEffect`: `coefficient?`, `hits?`, **or** `ticks?: StrikeTick[]` (each tick
  has its own `coefficient`) — **handle both flat and tick forms**.
- `ConditionEffect`: `condition?`, `stacks?`, `duration?`, **or**
  `ticks?: ConditionTick[]`.
- Skill-level `cooldown`, `quicknessCastTimeMs` / `castTimeMs`.

**Apply the overlay at the assembled-catalog boundary**, keyed by skill id,
walking the merged `effects[]`. This is the single convergence point: numbers are
fully merged there (base + spec overrides + defaults), so you don't chase them
across `core/` and `specializations/*/` source. **Do not patch raw fragment
source.**

## Required design

### 1. Overlay type + apply function (platform layer)

New file `js/platform/gw2/skill-patch.ts`:

```ts
export type NumEdit = number | { multiply: number } | { add: number };

export interface SkillPatch {
  readonly id: string; // "2026-09-preview"  (stable; used as catalog/cache key)
  readonly label: string; // "Sept 2026 Preview"
  readonly skills: Readonly<
    Record<
      string /* skill id or exact name */,
      {
        coefficient?: NumEdit; // applies to flat coefficient AND every strike tick
        conditions?: Record<
          string /*condition*/,
          { stacks?: NumEdit; duration?: NumEdit }
        >;
        cooldown?: NumEdit;
        castTimeMs?: NumEdit; // maps to quicknessCastTimeMs / castTimeMs
      }
    >
  >;
}
```

- `NumEdit` MUST support `multiply` and `add`, not just absolute — balance notes
  are usually "-10% coefficient".
- Apply operates on assembled catalog skills. Source is `Object.freeze`d
  everywhere — **deep-clone (`structuredClone`) before editing; never mutate**.
  Only clone skills the patch touches; pass others through by reference.
- Prefer keying by numeric skill **id** (stable); allow name as a fallback for
  authoring convenience.

### 2. Variant catalogs keyed by patch id

Extend native profession assembly so a profession can expose more than one
catalog:

- `defineNativeProfession` (`js/platform/gw2/native-profession.ts:255`) gains
  optional `patches?: readonly SkillPatch[]`.
- Produce a base catalog (`"current"`, identity) plus one derived catalog per
  patch (base → `applyPatch`). Expose `profession.catalogFor(patchId)` (default
  `"current"`); keep `profession.catalog` as the `current` alias for back-compat.
- **Assembly cache gotcha:** `getNativeCatalogAssembly` caches by
  `(first module, options)` identity
  (`js/platform/gw2/native-catalog-assembly.ts:461`). Variant catalogs from the
  same modules will collide and return the base. Incorporate the patch id into
  the cache identity, **or** build the preview by cloning + patching the
  already-assembled base rather than re-running assembly.
- Build preview catalogs **lazily** (on first select) so import-time cost stays
  flat.

### 3. Thread the selector through the app

- Add `patchId: string` (default `"current"`) to the sim/app config
  (`js/app/simulation/config.ts`; profession app contract in
  `js/app/profession/types.d.ts`).
- Where the runtime/adapter reads `profession.catalog`, read
  `profession.catalogFor(config.patchId)` instead.
- UI: a patch dropdown/toggle in the profession app header, populated from the
  profession's registered `patches`.

### 4. The payoff — automatic A/B + diff view

- Rotations and builds reference **skill ids/names**, which patches never change
  (only numbers change). The same rotation runs unchanged on both catalogs. Wire
  a "compare" path: run the configured rotation through `current` and the selected
  `preview`, show per-skill and total DPS delta.
- A **diff view** (base → preview per edited field) renders straight from the
  overlay object — cheap and high value for previewing patch notes.

## Scope boundaries — call these out, don't silently miss them

**In-scope (phase 1):** anything expressed in an assembled skill's `effects[]`
plus skill-level cooldown/cast time. This is the majority of balance changes and
matches the stated use cases.

**Out-of-scope for the effect overlay** (flag explicitly, propose follow-ups):

- **Runtime-computed coefficients** baked into resolver/mechanics code, e.g.
  necro `js/professions/necromancer/core/resolver.ts:291`
  (`const coefficient = [0.6, 0.9, 1.5, 2.1][boons];`) and harbinger
  `js/professions/necromancer/specializations/harbinger/blight.ts` multipliers.
  Not in `effects[]`; an effect overlay can't reach them. Follow-up: a separate
  patchable-constants table, or refactor those literals to data.
- **Trait / global % damage modifiers**
  (`js/platform/gw2/damage-modifier-buckets.ts`, `modifier-rules.ts`). Different
  subsystem; patches do tune these ("trait X 15%→10%"). Future overlay target,
  not phase 1.

## Gotchas / invariants

- **Frozen data** everywhere (`Object.freeze`). Clone before edit.
- **Assembly cache** collision (see §2).
- **Singleton import cost** — each profession builds its catalog at import; keep
  preview builds lazy.
- **Rotation/build stability** — patches change numbers, not ids; A/B relies on
  this. Adding/removing a skill is out of overlay scope.
- **Promote step** — when a preview goes live, fold its numbers into the base
  source and delete the patch. Provide a scripted promote (overlay → codemod/edits
  on base) so base source stays the single source of truth.

## Validation instructions

- Build and test against a stable native profession such as Necromancer or
  Guardian. This exercises the same `skillMechanics`-fragment path shared by
  every native profession.
- Prove:
  1. base catalog numbers unchanged with no patch;
  2. a preview with `multiply` / `add` / absolute edits changes exactly the
     targeted skills' resolved damage and nothing else;
  3. the same rotation runs on both catalogs and produces a sensible DPS delta;
  4. both catalogs are live in memory at once (no cache collision).
- Run the existing per-profession benchmark tests
  (`tests/app/benchmarks/<prof>.test.js`) for the in-scope professions with
  `patchId: "current"` and confirm no regression.

## Elementalist

Elementalist uses Core and specialization-owned `skills.ts` fragments and
converges at the same assembled-catalog `effects[]` boundary as every other
native profession. Patch preview must use that shared boundary; it does not
need an Elementalist-specific path.

## Suggested phasing

1. `skill-patch.ts` (type + `applyPatch` over assembled skills) + unit tests.
2. Variant-catalog support in `defineNativeProfession` / assembly, cache-key fix,
   `catalogFor`.
3. Wire `patchId` through config → runtime/adapter; header toggle.
4. A/B compare + diff view.
5. Promote script + docs.
