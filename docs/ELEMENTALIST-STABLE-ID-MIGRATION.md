# Handoff: Migrate `ids.ts` files to GW2 stable ids

## TL;DR for the next agent

The task "upgrade all `ids.ts` files to the GW2 stable id structure" is, in
practice, **migrate elementalist only**. 8 of 9 professions already key their
skill catalog on real GW2 API ids. **Elementalist** is the lone holdout: it uses
a hand-authored synthetic `1100xxx` id space (~284 ids). Engineer is the
reference pattern to converge on.

Do not start editing until you have re-verified the "Current state" section
below against the live tree — this doc is a snapshot (authored 2026-08-18).

---

## Current state — three patterns exist

Run this to confirm before you begin:

```sh
for p in elementalist engineer guardian mesmer necromancer ranger revenant thief warrior; do
  echo "$p:"; grep -oE ": *[0-9]{4,}" "js/professions/$p/data/ids.ts" | sort -u | head -3
done
```

1. **Generated from API metadata (target pattern) — engineer only.**
   `js/professions/engineer/data/ids.ts` builds the map programmatically:
   `stableNameIndex(SKILLS.map(s => [s.name, s.id]))` over the API metadata,
   plus negative sentinels for non-API actions (`SWAP_WEAPONS: -3`,
   `DODGE: -5`, `STOW_ELITE_MORTAR_KIT: -301`) and an
   `engineer-supplemental-skills.js` file for genuinely missing skills.
   Collisions are auto-suffixed `${BASE}_ID_${id}`. Ids are real GW2 ids.

2. **Hardcoded real ids — guardian, mesmer, necromancer, ranger, revenant,
   thief, warrior.** Manual `NAME: <realGw2Id>` pairs (e.g. guardian
   `GREAT_SWORD_STRIKE: 9137`). Real ids, but hand-maintained. Acceptable as-is;
   optionally converge to the engineer generated pattern as a stretch goal, but
   that is NOT required for this task and carries its own risk — treat as
   separate work.

3. **Hardcoded synthetic ids — elementalist (THE JOB).**
   `js/professions/elementalist/data/ids.ts` — ~284 ids in the `1100001+`
   block, sequential, hand-authored. This is what must change.

---

## Why elementalist went synthetic (root cause — respect it)

Synthetic ids are **not laziness**; they exist because the current data pipeline
cannot key elementalist on real ids by name:

- **API names collide.** Four real skills are all named `"Glyph of Elementals"`
  (base `5666`; per-attunement subskills `25488`/`25489`/`25490`/`25491` for
  Fire/Earth/Air/Water). Two different real skills are both named
  `"Flame Burst"` (weapon `5679`, trait-proc `5794`). The catalog joins API
  metadata to mechanics **by name** (`apiSkill(skill.name)` in
  `js/professions/elementalist/catalog-data.ts` ~L285), so name is not a unique
  key here.
- **The snapshot pipeline drops the ids that would disambiguate.**
  `scripts/data/lib/gw2-profession-snapshot.mjs` only follows `next_chain` and
  `flip_skill` (`linkedSkillIds`, ~L217). It does **not** expand `subskills`, so
  `25488-25491`, `5794`, etc. never enter `elementalist-api-metadata.js`. Verify:
  `node -e 'import("./js/professions/elementalist/data/elementalist-api-metadata.js").then(m=>console.log([5794,25488,25489,25490,25491].map(id=>[id,m.SKILLS.some(s=>s.id===id)])))'`
  — all currently `false`.
- **The sim needs entities the game merges/omits at that granularity.**
  Attunement variants (`Glyph of Elementals (Fire/Earth)`), weaver dual-attune
  skills, pistol bullet variants, trait procs, and `Dodge` (not a real API skill
  at all — closest sim analog is `DODGE: 1100277`).

**Consequence:** you cannot just find-and-replace `1100xxx` with real ids. You
must first make the data pipeline capture the real ids that disambiguate, then
choose the identity strategy for entities that have no unique name/id.

---

## What is already SAFE (do not over-scope)

- **User data is name-keyed, not id-keyed.** `Builds/**/*.json` store skills as
  names (`selectedSkills.Elite: "Glyph of Elementals"`); `Rotations/**/*.json`
  store rotation entries as `{ "name": "..." }`. Confirmed — grep for numeric
  skill ids in those dirs returns nothing meaningful. **No user-data migration
  is required.** This is the single biggest de-risker; keep it true (do not
  introduce id-keyed persistence).
- **Mechanics reference symbolic constants, not raw numbers.** Files like
  `js/professions/elementalist/core/skills.ts` key off `[ID.FIRE_ATTUNEMENT]`,
  not `[1100001]`. So changing the numeric value behind a symbol in `ids.ts`
  propagates automatically — **as long as the symbol name is preserved.** Prefer
  keeping symbol names identical and only changing their numeric values.

---

## Consumers that DO reference raw synthetic numbers (must update)

These are the blast radius. Re-run the grep to get the current set:

```sh
grep -rn "1100[0-9]\{3\}" js Builds Rotations tests --include=*.ts --include=*.js --include=*.json | grep -v "data/ids.ts"
```

Known at authoring time:

- **EVTC analyzer** (`js/evtc-analyzer/rotation/professions/elementalist/*.ts`
  and `js/evtc-analyzer/rotation/professions/elementalist.ts`). This layer maps
  **real EVTC-log skill ids → sim ids**, e.g. `5736: 1100122`,
  `5737: 1100124` (Glyph of Storms Fire/Air), `dodgeId: 1100277`,
  `{ name: "Fire Attunement", skillId: 1100001 }`. **This is also a gift:** it is
  a partial, hand-verified dictionary of `realId → synthetic`. Mine it to build
  the migration map. After migration, many of these translation entries collapse
  to identity (`5736: 5736`) or are deletable.
- **Tests** (`tests/evtc/elementalist-rotation-reconstruction.test.js` and any
  other) that call `catalogSkill(1100001, "Fire Attunement")` etc. Update ids to
  match the new scheme (or better, reference `ID.*` symbols).
- **In-profession collision keys** already present, e.g.
  `ID.STATIC_FIELD_ID_1100117` in `core/skills.ts` — these hardcode the
  synthetic number into the symbol name; rename when the id changes.

---

## Target end-state

Elementalist keyed on **real GW2 ids**, ideally via the engineer generated
pattern:

- `ELEMENTALIST_SKILL_IDS` derived from `elementalist-api-metadata.js` by name
  (`stableNameIndex`), yielding real ids.
- Negative sentinels for non-API pseudo-skills (`DODGE`, attunement swaps if not
  real skills, etc.), matching engineer's convention.
- An `elementalist-supplemental-skills.js` (mirror engineer) for entities the
  API/pipeline still cannot supply uniquely — attunement subskill variants,
  weaver dual-attune, pistol bullets, trait procs. Give these **real ids where
  the API has them** (e.g. Glyph subskills `25488-25491`); reserve synthetic
  ids ONLY for entities with genuinely no game id (`Dodge`, sim-only splits).
- No `1100xxx` literals remain outside a clearly documented synthetic-reserve
  block (if any survive).

---

## Migration steps (suggested order)

1. **Extend the snapshot pipeline to capture disambiguating ids.**
   In `scripts/data/lib/gw2-profession-snapshot.mjs`, expand `subskills`
   (and keep name + `attunement`) so metadata carries `25488-25491`, `5794`,
   etc. Add an `attunement`/`parentId` field to the emitted skill records so the
   catalog can join a variant to its attunement instead of by bare name.
   Re-run `scripts/data/update-profession-api-data.mjs --profession Elementalist`
   and confirm the previously-missing ids now appear.

2. **Build the `synthetic → real` id map.** Seed it from the EVTC analyzer
   dictionaries (`5736 ↔ 1100122`, ...) and from `apiSkill(name)` resolution in
   `catalog-data.ts`. For each of the ~284 synthetic ids, record the intended
   real id, or mark it "no game id — keep synthetic/sentinel." Write this map
   down (a scratch JSON) before touching code; it is the spec for the change.

3. **Rewrite `js/professions/elementalist/data/ids.ts`** to the engineer pattern:
   generated real ids by name + supplemental file + sentinels. **Preserve every
   existing symbol name** (`FIRE_ATTUNEMENT`, `GLYPH_OF_ELEMENTALS`, ...) so the
   mechanics/handlers keep resolving. Only the numeric values change.

4. **Handle the join in `catalog-data.ts`.** Where variants currently rely on
   the synthetic split, join by `(name, attunement)` or by explicit variant id
   from the supplemental file. Keep the self-authored `displayName`
   `"Glyph of Elementals (Fire)"` logic — that is a UI concern, independent of id.

5. **Update raw-number consumers** (EVTC analyzer, tests) to the new ids, or
   better, switch them to import `ID.*` symbols so future id changes don't touch
   them.

6. **Delete dead synthetic scaffolding** once nothing references it.

---

## Acceptance criteria / verification

- `grep -rn "1100[0-9]\{3\}" js tests` returns only intentionally-reserved
  synthetic ids (ideally zero), each documented.
- Existing elementalist tests pass, especially
  `tests/evtc/elementalist-rotation-reconstruction.test.js` and the benchmark
  suite (`tests/app/benchmarks/`).
- Load each elementalist build under `Builds/elementalist/` and each rotation
  under `Rotations/elementalist/` — skills/traits still resolve by name, no
  "unknown skill" gaps introduced (name-keyed, so should be unaffected, but
  confirm).
- The four `Glyph of Elementals` attunement variants and both `Flame Burst`
  skills remain distinct entities with correct behavior after the change.
- `npm run` typecheck/build passes (`tsconfig.build.json`); no dangling
  references to removed symbols.

## Risk register

- **Highest risk:** attunement/subskill variants and duplicate-name skills. If
  the pipeline change (step 1) is skipped, you cannot key these on real ids and
  the migration is impossible without still-synthetic ids for them. Do step 1
  first or the rest is blocked.
- **Symbol renames** ripple into every `core/` and `specializations/*/` mechanics
  file. Keep symbol names stable to avoid a wide diff.
- **EVTC reconstruction** correctness depends on the real→sim id map; a wrong
  entry silently mislabels logged skills. Cross-check against the existing EVTC
  dictionaries rather than inventing ids.
- Scope creep into converging the other 7 hardcoded-real professions onto the
  generated pattern — valuable but separate; do not bundle.

## Key files

- `js/professions/elementalist/data/ids.ts` — the file to rewrite.
- `js/professions/engineer/data/ids.ts` — reference pattern (`stableNameIndex`,
  sentinels, supplemental).
- `js/professions/engineer/data/engineer-supplemental-skills.js` — supplemental
  pattern to mirror.
- `js/professions/elementalist/catalog-data.ts` — name→api join, variant/display
  handling (~L260-320).
- `js/professions/elementalist/data/elementalist-api-metadata.js` — generated
  API data (real ids + names); regenerated by the script below.
- `scripts/data/lib/gw2-profession-snapshot.mjs` — snapshot builder; add
  `subskills` expansion here.
- `scripts/data/update-profession-api-data.mjs` — regen entry point.
- `js/evtc-analyzer/rotation/professions/elementalist/` — real↔synthetic
  dictionary + a raw-number consumer.
- `tests/evtc/elementalist-rotation-reconstruction.test.js` — raw-number
  consumer to update.
