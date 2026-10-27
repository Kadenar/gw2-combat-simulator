# Patchable field registry cleanup

Status: implemented October 27, 2026. The original measurements and proposal below are retained as historical context;
they do not describe outstanding work.

## Fixed attribute grants

Skills and traits now use maps keyed by canonical attribute names for every fixed grant. Ordinary grants use
`attributeBonuses`; alternative or additional conditional amounts use `conditionalAttributeBonuses` with the same
shape. Warrior's active signet uses `activeAttributeBonuses`, and Bolstered Bonds has one map per legend. Eligibility,
recipient selection, conversion participation, and whether a conditional grant replaces or adds to the base remain
owned by the existing behavior. Per-stack amounts, conversion ratios, and multipliers remain formula inputs.

Combat reads scalar tuning through `balanceProfileNumber` and named grants through `attributeBonusNumber` or
`attributeBonusFromContext`. These readers use direct property access. Dotted paths are patch/editor identifiers;
profile tooltips interpret those identifiers at the presentation boundary.

Repository consumers and tests use the new paths. External patch payloads must replace `attributeBonus` with the
owner's `attributeBonuses.<attribute>` leaves, and `weaponAttributeBonus` with
`conditionalAttributeBonuses.<attribute>`. When one old amount supplied multiple attributes, author each leaf to keep
them equal. Fang and Claw's old weapon amount becomes `attributeBonuses.ferocity`. Legend-specific amounts become
`<legend>AttributeBonuses.<attribute>`; Signet of Fury's active amount becomes `activeAttributeBonuses.precision` and
`activeAttributeBonuses.ferocity`. Signet Mastery, Furious, and Pinnacle of Strength now name their actual formula input
`attributePerStack`. Fatal Frenzy's condition damage, Revealed Training's additional Power, and Second Opinion's scepter
bonus now use named grant maps instead of the misleading `attributePerStack`. Retired paths are rejected; no aliases
or migration fallbacks are retained.

The following implementation notes and historical proposal predate this completed migration.

## Implemented: balance-profile declarations and attribute grants

- Shared profile vocabulary lives in [`profile-fields.ts`](../../js/games/gw2/platform/skills/profile-fields.ts). Each
  profession module keeps its skill and profile tables together in `catalog-fields.ts`, grouped by purpose. The tables
  remain distinct because a field's acceptance and patchability depend on its owner.
- [`field-specs.ts`](../../js/games/gw2/platform/skills/field-specs.ts) now supplies common `FieldSpecs`,
  `defineFields`, `combineFields`, `validateFieldValues`, and `patchableNumericFields` primitives. Numeric skill
  interfaces continue to derive their properties with `NumericSkillFields`; there are no compatibility aliases for the
  old helper names.
- `data.profileFields` flows through assembly and runtime fragments into `CanonicalCatalog.profileFields`. Duplicate
  declarations and orphaned dotted leaves fail assembly. Authored profiles reject undeclared fields, and authored and
  patched numeric values must satisfy their declaration's bounds.
- Profile patch controls, editor tiers, labels, and units come from the selected catalog's descriptors. The handwritten
  profile allowlist, advanced-field list, and seconds list are removed. Reference JSON preserves nested attribute maps
  while patch controls use dotted paths. Newly encountered tuning (`maximumDuration`, `additionalStacks`,
  `stackThreshold`, and `enduranceRegenerationBonus`) is declared and editable; trait identity selectors remain data.
- All profession signet passives already use skill `attributeBonuses`; no profile-based `passiveAttribute` remains.
  Chaotic Persistence and Sharpening Sorrow now use profile `attributeBonuses` too. `ownerAttributeEffects` constructs
  grants for either owner, preserving Chaotic Persistence's conversion participation and both traits' boon gates.
- Static `traitAttributeEffects` declarations supply attribute-specific labels to the editor and generated notes. For
  example, Compounding Chemicals shows ?Concentration bonus.? Runtime-selected attributes keep generic labels.
- The optional `weaponAttributeBonus` rename is intentionally omitted. Static declarations can label it as a conditional
  attribute bonus without renaming the saved patch target. Generic amounts and legend-keyed bonuses remain valid where
  their selection logic requires them.

Validation: all 6,345 Node tests pass, including profile ownership/bounds, patch-editor round trips, and Mesmer
preview/live/tooltip grants. All eight existing tooltip and worker browser checks pass. Type checking and repository
lint pass. Touched source files and this document are formatted with Prettier.

External Mesmer patch payloads must update these profile field paths:

| Profile             | Old field            | Canonical field                  |
| ------------------- | -------------------- | -------------------------------- |
| Chaotic Persistence | `expertiseBonus`     | `attributeBonuses.expertise`     |
| Chaotic Persistence | `concentrationBonus` | `attributeBonuses.concentration` |
| Sharpening Sorrow   | `expertiseBonus`     | `attributeBonuses.expertise`     |

The old paths fail validation. Repository-owned consumers and tests use the canonical paths; the active preview contains
no affected paths. Saved builds and rotations need no migration.

## Implemented: one declaration per skill field

Every field a skill may carry is declared once, with its kind, bounds, label, unit, and patchability. The rest of this
document is the measured proposal that led here; its counts and lists describe the code before this change.

- **Declarations.** [`field-specs.ts`](../../js/games/gw2/platform/skills/field-specs.ts) defines the descriptor:
  `numberField({ label, unit, minimum, maximum, patch, runtimeOnly })` for numeric tuning and timing, `dataField` for
  identities, flags, and structured declarations whose owner validates their shape.
- **Ownership rule.** A field is shared when platform, application, or integration code reads it, or when the shared
  `Skill` type declares it. Those 101 fields live in
  [`shared-fields.ts`](../../js/games/gw2/platform/skills/shared-fields.ts). The other 92 are read only by one
  profession and are declared by the module whose skills author them, in that module's `catalog-fields.ts` and its
  `data.skillFields`. Rework variants that replace a module declare the same table.
- **One owner.** Assembly combines module tables and rejects a field declared by two modules, or by a module and the
  shared table. A dotted patch leaf such as `upkeepPulse.duration` requires its group to be declared.
- **Catalog carrier.** `CanonicalCatalog.skillFields` holds the shared and profession tables. Every module fragment
  carries the whole profession table, because elite-authored weapon skills can resolve to the Core fragment of a runtime
  without that elite.
- **Consumers.** Catalog normalization rejects undeclared keys; validation checks every declared number against its
  bounds, on authored and patched catalogs alike; cost `skillAmount` and recharge `{ skillField }` references must name
  a declared numeric field; skill patches accept only declared patchable fields; authoring metadata carries their labels
  and units; the editor and generated notes label profession fields from it.
- **Types.** Profession skill interfaces derive their numeric fields from the tables with
  `NumericSkillFields<typeof ...>`, so a numeric field's name and type are written once. Holosmith fields stay on
  `HolosmithSkill`.
- **Removed registries.** `SKILL_FIELDS`, the hand-written skill tuning checks, `PATCHABLE_SKILL_NUMERIC_FIELDS`, and
  the skill entries of `SECOND_FIELDS`, `FIELD_LABELS`, and the runtime-only list. The balance-profile allowlist is now
  an explicit list of the fields profiles declare, unchanged except for the dead `boonStacks` and `boonDuration`. The
  unused skill field `blightGain` is no longer accepted.

Saved patches are unaffected: no field was renamed. A skill edit naming a profile-only field, such as
`durationMultiplier`, now fails as an unsupported patch field instead of "does not expose". A profession field set on
another profession's skill now fails instead of being silently ignored.

The remaining profile and attribute work from this earlier implementation is completed above.

## Historical proposal

Patch authoring decides which numeric fields a skill or balance profile may edit from hand-maintained lists in
[`authoring/fields.ts`](../../js/games/gw2/integrations/patches/authoring/fields.ts). The lists no longer describe what
they allow. The "skill" list is mostly profile vocabulary, one skill-owned value is not editable, and the facts about a
single field (owner, unit, label, editor tier, runtime-only) are split across six registries in three files. Attribute
grants also use three unrelated naming styles.

Fix this in order: split the lists by owner, close the gaps, describe each field once and derive the rest, then make
attribute grants consistent. The first two steps change no behavior. Later steps can follow the profession migrations.

## Findings before the cleanup

Counts cover the nine assembled profession catalogs: 1,834 skills and 912 balance profiles.

**The skill list is shared vocabulary, not a skill list.** `PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS` begins by
spreading `PATCHABLE_SKILL_NUMERIC_FIELDS`, so any field both owners might use was placed in the skill list.

| `PATCHABLE_SKILL_NUMERIC_FIELDS` (91 entries) | Count | Examples                                                                                           |
| --------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------- |
| Present only on skills                        |    17 | `ammo`, `ammoRecharge`, `upkeepCost`, `heatLoss`, `arrowCost`, `attributeBonuses.precision`        |
| Present on skills and profiles                |    15 | `cooldown`, `duration`, `flipDuration`, `rechargeMultiplier`, `resourceGain`, `pulseInterval`      |
| Present only on profiles                      |    54 | `attributeBonus`, `weaponAttributeBonus`, `procChance`, `internalCooldown`, `threshold`, `charges` |
| Present on neither                            |     5 | `attributeBonuses.toughness` and four other generated attribute keys; harmless                     |

The 54 profile-only names on the skill list are inert for skills, because no skill declares them; the skill validator
rejects several outright, including `attributeBonus` and `weaponAttributeBonus`. They make the list misleading, and a
misplaced skill edit reports "does not expose" instead of "unsupported patch field".

**Gaps and dead entries.**

- `maximumConditions` is authored on two skills, Necromancer's scepter and Ranger's Fanged Iboga, but appears only in
  the profile list. Those skill values cannot be patched.
- `boonStacks` and `boonDuration` are in the profile list, but no profile has either field.
- `SECOND_FIELDS` gives `ammoCastLockout` a seconds label, but the field is runtime-only and never editable.

**One field, six registries.** Adding or changing a patchable field means editing each of these by hand:

| Registry                                                             | File                                                                                                           | Records                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `PATCHABLE_SKILL_NUMERIC_FIELDS`, `PATCHABLE_BALANCE_PROFILE_*`      | [`authoring/fields.ts`](../../js/games/gw2/integrations/patches/authoring/fields.ts)                           | which owner may edit it                    |
| `AUTHORING_RUNTIME_ONLY_NUMERIC_FIELDS`                              | same                                                                                                           | known but hidden from editor JSON          |
| `ADVANCED_BALANCE_PROFILE_NUMERIC_FIELDS`                            | same                                                                                                           | editor tier                                |
| `SECOND_FIELDS` (17 entries)                                         | [`app/model.ts`](../../js/games/gw2/integrations/patches/app/model.ts)                                         | unit suffix `(s)`                          |
| `FIELD_LABELS` (17 entries)                                          | [`authoring/overview-generation.ts`](../../js/games/gw2/integrations/patches/authoring/overview-generation.ts) | label; others fall back to the split name  |
| `SKILL_FIELDS` and per-field checks such as `validateDurationFields` | [`platform/skills/validation.ts`](../../js/games/gw2/platform/skills/validation.ts)                            | whether a skill may declare it, and bounds |

The lists already drift, as the `ammoCastLockout` entry shows. Units are also implicit: only 16 patchable fields are
labelled as seconds, and fractions, factors, and attribute points have no unit at all.

**Three styles of attribute grant.**

| Style                                         | Fields (profiles using them)                                                                                                 | Attribute chosen by                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Generic amount name                           | `attributeBonus` (89, 8 professions), `weaponAttributeBonus` (17), `attributePerStack` (16), `attributeConversion` (26)      | code (`to: 'Power'`) or a trait declaration |
| Attribute or legend in the profile field name | `conditionDamageBonus`, `concentrationBonus`, `expertiseBonus` (Mesmer); `assassinAttributeBonus` and four others (Revenant) | the field name                              |
| Attribute as key                              | `attributeBonuses.<attribute>` on skills (Signet of Fire, both conjures)                                                     | the data                                    |

The generic style has two costs. The patch editor and overview show "attribute bonus" without naming the attribute, and
`weaponAttributeBonus` is also used for conditions that have nothing to do with weapons: Fire attunement, a pet family
(spider or devourer), Pack Alpha's pet bonus, and Soulbeast archetypes.

The generic style is still needed in one case: one owner with two alternative amounts for the same attribute, such as
120 Power normally and 240 while wielding a sword. A map keyed by attribute holds only one amount per attribute.

## Goals

- Each list allows exactly what its owner can declare.
- Each field's owner, unit, label, tier, and authoring visibility are declared once.
- Attribute grants name their attribute wherever the amount is fixed per attribute.
- Profession-specific vocabulary stops growing the shared lists.
- No compatibility aliases. Renamed or removed patch targets fail validation, and the migration is documented, per the
  repository rules.

## Proposed changes

### 1. Split the lists by owner

Replace the spread with three explicit groups and derive the two public lists:

```ts
// Fields both skills and balance profiles declare, such as cooldown, duration, and resourceGain.
const SHARED_NUMERIC_FIELDS = [...];
// Fields only skills declare, such as ammo, upkeepCost, and attributeBonuses.<attribute>.
const SKILL_ONLY_NUMERIC_FIELDS = [...];
// Fields only profiles declare, such as attributeBonus, procChance, and internalCooldown.
const PROFILE_ONLY_NUMERIC_FIELDS = [...];

export const PATCHABLE_SKILL_NUMERIC_FIELDS = [...SHARED_NUMERIC_FIELDS, ...SKILL_ONLY_NUMERIC_FIELDS];
export const PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS = [...SHARED_NUMERIC_FIELDS, ...PROFILE_ONLY_NUMERIC_FIELDS];
```

Classify each field by where it is actually declared, using the counts above. This changes no behavior for existing
data: no skill declares a profile-only field, and no profile declares a skill-only one. Only the error for a misplaced
edit changes, from "does not expose" to "unsupported patch field".

### 2. Close the gaps

- Add `maximumConditions` to the shared group so both skills that declare it become patchable. This is a new editable
  value, so confirm it is wanted.
- Delete `boonStacks` and `boonDuration` from the profile list.
- Delete `ammoCastLockout` from `SECOND_FIELDS`.

Both steps fit one small change with Node tests only.

### 3. Describe each field once

Replace the six parallel lists with one descriptor table in authoring and derive the lists from it:

```ts
// Each patchable or known-but-hidden numeric field, described once.
export const NUMERIC_FIELD_SPECS = defineNumericFieldSpecs({
  cooldown: { owners: ['skill', 'profile'], unit: 'seconds' },
  flipDuration: { owners: ['skill', 'profile'], unit: 'seconds', label: 'follow-up window' },
  procChance: { owners: ['profile'], unit: 'fraction' },
  packetCount: { owners: ['skill', 'profile'], tier: 'advanced' },
  rechargeProgress: { owners: ['skill'], unit: 'fraction', authoring: 'runtime-only' },
  // Generated keys share one descriptor; labels name the attribute.
  'attributeBonuses.*': {
    owners: ['skill'],
    unit: 'attribute',
    label: (attribute) => `${ATTRIBUTE_NAMES[attribute]} bonus`
  }
});
```

Derive `PATCHABLE_SKILL_NUMERIC_FIELDS`, `PATCHABLE_BALANCE_PROFILE_NUMERIC_FIELDS`,
`AUTHORING_RUNTIME_ONLY_NUMERIC_FIELDS`, `ADVANCED_BALANCE_PROFILE_NUMERIC_FIELDS`, `SECOND_FIELDS`, and `FIELD_LABELS`
from this table, then delete the hand-written lists. The unit drives the editor suffix and can give every unit a
consistent rendering (seconds, fraction, factor, attribute points). Provisional preview controls already declare a
label, unit, range, and step ([Patch preview](PATCH-PREVIEW.md)), so this follows an existing pattern.

Keep platform validation (`SKILL_FIELDS` and per-field bounds) where it is for now. Platform code must not import from
integrations. If shared bounds checks are wanted later, move the unit-bearing part of the table into the platform and
have authoring extend it. Effect fields (`PATCHABLE_EFFECT_NUMERIC_FIELDS`) target effects rather than owners, so keep
them separate unless the table gains an `effect` owner naturally.

### 4. Make attribute grants consistent

Use one rule:

- **Fixed amount per named attribute:** `attributeBonuses.<attribute>`, keyed by
  [`ATTRIBUTE_NAMES`](../../js/games/gw2/platform/attributes/inputs.ts).
- **Alternative amounts for the same attribute, or an attribute chosen at runtime:** a generic amount field read by a
  declaration that names the attribute.

Apply it in this order:

1. **Signet passives** on the remaining professions (Guardian, Mesmer, Necromancer, Ranger, Thief, Warrior) move to
   skill `attributeBonuses` with [`passiveSkillAttributes`](../../js/games/gw2/platform/attributes/passives.ts), as the
   ownership audit already plans. Delete the profile-based `passiveAttribute` when its last caller moves.
2. **Mesmer `conditionDamageBonus`, `concentrationBonus`, `expertiseBonus`:** Signet of Domination and Signet of
   Midnight are covered by the signet move above. The traits Chaotic Persistence and Sharpening Sorrow grant fixed
   amounts per named attribute, so their `balance` becomes `attributeBonuses.<attribute>`. That needs `attributeBonuses`
   accepted and validated on balance profiles, and `skillAttributeEffects` generalized to take either owner.
3. **Labels for generic fields:** when a trait declaration names its target statically, as Compounding Chemicals does
   with `to: 'Concentration'` for `attributeBonus`, let the editor label the control "Concentration bonus". Traits that
   pick the attribute in code keep the generic label.
4. **Optional rename:** `weaponAttributeBonus` describes a conditional alternative amount, not a weapon. A name such as
   `conditionalAttributeBonus` would be accurate across its 17 profiles, but it renames a patch target. Do it only with
   the migration in [Patch payload impact](#patch-payload-impact), or not at all.

Revenant legend bonuses (`assassinAttributeBonus` and similar) are keyed by legend, not attribute, so they keep their
names.

### 5. Let professions own their vocabulary (later)

71 of the profile-only fields belong to a single profession: for example `bladeswornResourceGain`, `lifeForceDrain`, the
Revenant legend bonuses, and the Antiquary artifact factors. The skill list also carries `arrowCost`, `heatLoss`, and
the `windForce*` fields. With step 3 in place, each profession module can contribute its own descriptors through catalog
assembly. Authoring then reads the selected profession's merged table, and the shared table keeps only cross-profession
fields. This matches destination 4 of the audit amendments, which puts profession-specific skill fields on the
profession's skill type. It is worth doing only after step 3, and only if the shared table keeps growing.

## Patch payload impact

- Steps 1–3 rename nothing. Saved patches keep working, apart from targets that were never valid for their owner.
- Step 4.2 and the optional 4.4 rename patch targets. Update repository-owned data directly, including
  [`active-preview.ts`](../../js/games/gw2/integrations/patches/active-preview.ts), and document the field mapping for
  external saved payloads, as the audit's Elementalist section does. Old names must fail validation; do not add aliases
  or fallback reads.
- Ordinary saved builds and rotations are unaffected.

## Validation

Follow the repository testing policy:

- Steps 1–2: Node tests for patch authoring and validation, `npm run build:modules`, and `npm run typecheck`. Cover one
  misplaced edit (a profile-only field on a skill is rejected as unsupported), the newly patchable `maximumConditions`
  on a skill, and rejection of a deleted field.
- Step 3: the same tests, plus label and unit checks for one field of each unit. Run the existing patch-editor browser
  specs only if editor rendering changes. Do not add new browser tests without approval.
- Step 4: per-migration Node tests, as in
  [`skill-tuning-ownership.test.js`](../../tests/games/gw2/professions/elementalist/skill-tuning-ownership.test.js): a
  patched grant changes the attribute preview, the live attributes, and the tooltip. Read expected values from the
  catalog; do not pin balance numbers.
- Optionally, add a check that fails when a patchable field is declared by no skill or profile of its owner. The
  measurements in this document came from such a scan, and it would have caught the dead entries above.

## Out of scope

- Platform `SKILL_FIELDS` cleanup and moving profession fields onto profession skill types. These belong to the
  ownership audit migrations.
- Effect-level fields and selectors.
- Proc-rate overrides and provisional preview controls, which already have their own descriptors.
