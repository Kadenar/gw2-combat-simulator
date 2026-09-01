# Duplicate skill ID migration

Status: Phase 6 implementation complete; full suite blocked by one unrelated Guardian change  
Last updated: 2026-08-31

This is the standalone tracker for removing skill records that exist only because Guild Wars 2 exposes multiple IDs for
the same simulator behavior. It covers canonical ID selection, input compatibility, generated data, duplicate
constructors, and obsolete overrides.

It does not reorganize profession content or merge skills merely because they share a name.

## Target outcome

- Each simulated behavior has one canonical skill record and one behavioral implementation.
- Alternate API, build-template, saved-rotation, and combat-log IDs normalize to that canonical ID at input boundaries.
- Alias IDs do not require duplicate constructors, mechanics, metadata records, palette entries, or exclusion hacks.
- Skills with meaningful state, actor, specialization, weapon, follow-up, or effect differences remain separate.
- The implementation uses a plain alias map and lookup. No alias class, factory, or inheritance layer is needed.

## Migration rules

1. A matching name is a review signal, not proof that two IDs are aliases.
2. An alias is safe only when every simulator-relevant effect is represented by the canonical skill.
3. Prefer the ID already used by the simulator, presets, and palette as the canonical ID.
4. Canonicalize external IDs when they enter the simulator, not repeatedly during scheduling or resolution.
5. Keep unknown-ID behavior unchanged. Do not silently map an unknown ID by name.
6. Alias targets must be canonical records, not another alias. A focused test must reject chains and cycles.
7. Delete an alias constructor only after every supported input path can load its ID through the canonical map.
8. Generated data must not recreate a deleted alias record on the next data update.

## Audit baseline

| Metric                                    | Baseline |
| ----------------------------------------- | -------: |
| Skills across the nine assembled catalogs |    2,121 |
| Same-name families reviewed               |      121 |
| Proposed alias records audited            |       70 |
| Verified safe alias records               |       42 |
| Proposed records deferred or protected    |       28 |
| Previously omitted candidates deferred    |        3 |

The original 72-record estimate was arithmetically wrong: its tables contained 70 records. Phase 0 also found three
same-name records omitted from that inventory. Deletion-line estimates were withdrawn because they included mappings
that failed the audit; update line counts from actual cleanup diffs instead.

## Phase dashboard

| Phase | Scope                                                     | Status   | Exit condition                                               |
| ----- | --------------------------------------------------------- | -------- | ------------------------------------------------------------ |
| 0     | Freeze the alias inventory and baseline behavior          | Complete | Every proposed mapping is verified or removed                |
| 1     | Add the canonical ID contract at input boundaries         | Complete | All supported inputs accept tested alias IDs                 |
| 2     | Fix generated data so aliases stay deleted                | Complete | Regeneration emits canonical records plus alias data only    |
| 3     | Pilot with Thief and Necromancer                          | Complete | Small alias sets are removed without behavior changes        |
| 4     | Migrate Engineer, Guardian, and Warrior                   | Complete | All 42 verified aliases are canonicalized                    |
| 5     | Remove obsolete alias machinery and run full verification | Complete | No duplicate-only constructors or ad hoc alias paths remain  |
| 6     | Review uncertain candidates separately                    | Complete | Each candidate has external-ID evidence and its own decision |

## Phase 0: freeze the inventory

- [x] Verify each proposed alias against its constructor, coefficients, packets, costs, cooldowns, state changes, and
      availability rules.
- [x] Confirm which ID appears in current saved presets, build templates, EVTC/dps.report imports, and the palette.
- [x] Record a reason when the proposed canonical ID is not the lowest ID.
- [x] Identify the saved-rotation and build-template decode functions that accept numeric skill IDs.
- [x] Record baseline build, typecheck, focused profession tests, preset warnings, and total-DPS regressions.
- [x] Move rejected mappings to the protected-variants or review-only sections with the reason they cannot enter
      Phase 1.

Exit condition: every row in the safe inventory is checked, corrected, or removed before implementation begins.

### Phase 0 result

The audit queried ArenaNet's live `/v2/skills` records on 2026-08-31 and compared them with assembled catalog records,
hand-authored mechanics, saved presets, generated build-template data, and both combat-log adapters. An ID remains in
the safe inventory only when an API relationship or an existing explicit log/simulator alias establishes the identity
and the canonical record owns the intended simulator behavior. Same-name-only candidates were deferred.

Canonical choices that are not the current lowest same-name ID:

| Canonical ID | Skill               | Reason                                                                                |
| -----------: | ------------------- | ------------------------------------------------------------------------------------- |
|      `14544` | Forceful Shot       | ArenaNet root with the burst cost and resource handler; `14469` is its linked child   |
|      `71932` | Path to Victory     | ArenaNet root with the burst cost and resource handler; `71922` is unlinked           |
|      `73024` | Harrier's Toss      | ArenaNet root, build-template target, and resource owner; `72911` is its linked child |
|      `62648` | Crashing Courage    | ArenaNet root and the ID used by all current Willbender presets                       |
|      `77230` | Canach-Coin Toss    | ArenaNet root and the ID emitted by the Antiquary EVTC adapter                        |
|      `44946` | Manifest Sand Shade | Current Scourge mechanics, recharge, and EVTC reconstruction identity                 |

Current numeric-ID boundaries to change in Phase 1:

| Input                                   | Current boundary                                                   | Finding                                                          |
| --------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Saved/local builds and preset rotations | `createGw2BuildCodec().migrateBuild` -> `normalizeRotation`        | Numeric cast IDs pass through unchanged                          |
| Standalone JSON rotation import         | `previewRotationFile` -> `normalizeRotation`                       | Uses the shared rotation loader; there is no separate paste path |
| EVTC and dps.report                     | `findRotationSkill` in `integrations/logs/lib/rotation/catalog.ts` | Uses a profile-local alias map before catalog lookup             |
| Build templates                         | `resolveGw2BuildTemplate` in `platform/builds/templates/codec.ts`  | Palette IDs map to numeric skill IDs before catalog lookup       |
| Legacy selected skills                  | `selectedSkillsFromLegacy` in `platform/builds/codec.ts`           | `selectedSkillIds` performs a direct catalog lookup              |

Current data evidence:

- Saved presets contain alias `69297` for Breaching Strike. Current canonical IDs include `30185`, `62648`, `78358`,
  `78514`, `9168`, and `30273`.
- Build-template data uses canonical `73024` and `77230`; current slot-skill mappings otherwise select canonical IDs.
- Warrior log profiles already map `69297`, `69433`, `80252`, and `80263`. Profession adapters synthesize canonical
  identities for the other observed instant/composite actions.
- Current name lookup selects lower duplicate IDs for Forceful Shot (`14469`), Path to Victory (`71922`), Harrier's Toss
  (`72911`), and Crashing Courage (`62532`). The canonical choices above intentionally replace those winners with the
  API roots that own cost/state behavior.
- Thief's eight draft alias records are already absent from its assembled catalog; only the two API-linked IDs are
  approved for compatibility normalization.

Baseline validation:

| Check                                                                             | Result                                                                                                                                                                            |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                   | Passed; existing Vite chunk-size warning only                                                                                                                                     |
| `npm run typecheck`                                                               | Passed                                                                                                                                                                            |
| Five affected profession suites plus build-template and log reconstruction suites | 522 passed, 0 failed                                                                                                                                                              |
| Five affected saved-preset DPS suites                                             | 5 passed, 0 failed; every manifest result remained within 1%                                                                                                                      |
| Saved-preset warnings                                                             | 47 rotations checked; one pre-existing warning in Guardian Firebrand “Condition Quickness (Axe / Torch + Pistol / Pistol)”: `Stow Tome is unavailable — requires an active tome.` |

The Firebrand warning is unrelated baseline debt and remains unsuppressed. Phase 5 must either repair that preset or
document why its redundant stow is intentional before accepting the final warning baseline.

## Safe alias inventory

The mappings below came from the audit. The checkboxes mean "behavior and input evidence verified," not merely "code
deleted."

### Warrior: 18 alias records

| Verified | Alias ID(s)                        | Canonical ID | Skill            |
| -------- | ---------------------------------- | -----------: | ---------------- |
| [x]      | `14422`                            |      `14353` | Eviscerate       |
| [x]      | `14425`                            |      `14414` | Skull Crack      |
| [x]      | `14473`, `14474`, `14475`, `42041` |      `14396` | Kill Shot        |
| [x]      | `14512`                            |      `14387` | Earthshaker      |
| [x]      | `14520`                            |      `14506` | Combustive Shot  |
| [x]      | `14469`                            |      `14544` | Forceful Shot    |
| [x]      | `14545`                            |      `14375` | Arcing Slice     |
| [x]      | `14549`                            |      `14443` | Whirling Strike  |
| [x]      | `30435`                            |      `30185` | Berserk          |
| [x]      | `69297`, `69433`                   |      `45252` | Breaching Strike |
| [x]      | `72029`                            |      `71932` | Path to Victory  |
| [x]      | `72911`                            |      `73024` | Harrier's Toss   |
| [x]      | `80252`, `80263`                   |      `80203` | Bloodthirster    |

Current debt to remove: duplicate mechanics, generated metadata, `simulatorAliasOfId`, and simulator-exclusion fields
that exist only for these aliases.

### Guardian: 16 alias records

| Verified | Alias ID(s) | Canonical ID | Skill                 |
| -------- | ----------- | -----------: | --------------------- |
| [x]      | `9268`      |       `9118` | Virtue of Courage     |
| [x]      | `9250`      |       `9120` | Virtue of Resolve     |
| [x]      | `46170`     |       `9125` | Hammer of Wisdom      |
| [x]      | `68666`     |       `9154` | Renewed Focus         |
| [x]      | `44846`     |       `9168` | Sword of Justice      |
| [x]      | `43565`     |       `9175` | Bow of Truth          |
| [x]      | `41571`     |       `9182` | Shield of the Avenger |
| [x]      | `68670`     |      `29965` | Feel My Wrath         |
| [x]      | `68686`     |      `30273` | Dragon's Maw          |
| [x]      | `68676`     |      `30461` | Signet of Courage     |
| [x]      | `68648`     |      `41780` | Tome of Resolve       |
| [x]      | `68650`     |      `42259` | Tome of Courage       |
| [x]      | `68647`     |      `44364` | Tome of Justice       |
| [x]      | `62532`     |      `62648` | Crashing Courage      |
| [x]      | `78770`     |      `78358` | Radiant Courage       |
| [x]      | `78604`     |      `78514` | Radiant Resolve       |

Current debt to remove: same-name mode records and the test that treats these mode aliases as catalog variants. Keep
`9224` Shield of Absorption as a real follow-up skill.

### Engineer: 3 alias records

| Verified | Alias ID | Canonical ID | Skill                  |
| -------- | -------: | -----------: | ---------------------- |
| [x]      |  `29591` |       `5865` | Utility Goggles        |
| [x]      |  `29991` |       `5811` | Personal Battering Ram |
| [x]      |  `30881` |      `21659` | A.E.D.                 |

Current debt to remove: alternate-mode metadata/mechanics and alias-only entries in
`PATCH_AUTHORING_EXCLUDED_SKILL_IDS`.

### Thief: 2 alias records

These IDs are already filtered from the runtime catalog and have explicit ArenaNet flip relationships.

| Verified | Alias ID | Canonical ID | Skill            |
| -------- | -------: | -----------: | ---------------- |
| [x]      |  `80278` |      `40436` | Death's Advance  |
| [x]      |  `76744` |      `77230` | Canach-Coin Toss |

Current debt to remove: the upstream metadata and the alias-only entries in `SIMULATOR_EXCLUDED_ALIAS_IDS`.

### Necromancer: 3 alias records

| Verified | Alias ID(s)               | Canonical ID | Skill               |
| -------- | ------------------------- | -----------: | ------------------- |
| [x]      | `42297`, `46473`, `46474` |      `44946` | Manifest Sand Shade |

Current debt to remove: three duplicate mechanics blocks, generated metadata, `simulatorAliasOfId`, and
simulator-exclusion fields.

## Protected variants

Do not include these in the safe deletion total.

| Area                                                   | Keep separate because                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Guardian `9224` Shield of Absorption                   | It is a real follow-up/flip skill, not meaningless identity data                                   |
| Mesmer same-name specialization skills and instruments | Specialization, profile, and instrument state changes behavior                                     |
| Ranger pet skills                                      | Pet identity and pet-specific effects are simulator state                                          |
| Revenant True Nature variants                          | Legend-specific effects are meaningful                                                             |
| Elementalist attunement and glyph variants             | Attunement and selected form change behavior                                                       |
| Engineer Amalgam protocols                             | Protocol identity changes mechanics                                                                |
| Engineer Jade Energy Shot arm IDs                      | Mechanic-slot and actor identity are meaningful even when damage fragments match                   |
| Engineer Throw Mine EVTC ID `30337`                    | One raw log ID represents placement and detonation; the simulator keeps `6161` and `6162` separate |

## Phase 0 rejected and omitted candidates

These IDs are not part of the 42-record Phase 1 map. “Review” means the records may be promoted only with external-ID
evidence; “protected” means the current facts already establish meaningful behavior or availability differences.

| Status                         | Area                           | ID(s)                                                | Reason                                                                                            |
| ------------------------------ | ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Review                         | Warrior specialization modes   | `40601`, `42803`, `41330`, `42707`, `72089`, `73014` | Same name and similar facts do not prove that Spellbreaker IDs are input aliases                  |
| Review                         | Warrior Path to Victory modes  | `71922`, `71950`                                     | Neither record links to the `71932` API root                                                      |
| Protected                      | Warrior Whirling Strike        | `41746`                                              | Spellbreaker record has a 1.5 coefficient and stun; core `14443` has a 2.0 coefficient            |
| Protected pending tier support | Warrior Harrier's Toss         | `73006`, `73042`                                     | Tier records carry 3.5 and 3.0 coefficients; the root currently models only 2.5                   |
| Review                         | Guardian Shield of Judgment    | `15834`                                              | No API relationship or repository input evidence links it to `9087`                               |
| Review                         | Guardian Tome of Courage       | `42371`                                              | No API relationship links it to `42259`; availability flags differ                                |
| Review                         | Engineer Jump Shot             | `5817`                                               | Absent from the live API and its supplemental record lacks canonical timing/availability metadata |
| Review                         | Engineer environment modes     | `6091`, `6092`                                       | No API links; targeting or underwater availability differs from the proposed targets              |
| Removed after review           | Engineer unsupported utilities | `6077`, `6089`, `6090`, `29522`, `30828`             | Their parent utility families were removed from simulator scope instead of modeled as variants    |
| Protected                      | Engineer Deploy Mine           | `30893`                                              | Live API damage coefficient is 3.0 versus 1.65 on `6163`                                          |
| Review                         | Thief unlinked modes           | `45094`, `76601`, `76900`, `77288`                   | No API links; targeting or underwater availability differs from the proposed targets              |
| Protected                      | Thief Forged Surfer Dash       | `76550`                                              | Actor/slot and damage facts differ from `76633`                                                   |
| Protected                      | Thief Holo-Dancer Decoy        | `76800`                                              | Recharge-reduction facts differ from `76674`                                                      |
| Review (omitted by draft)      | Warrior Spellbreaker modes     | `43566`, `41110`                                     | Same-name Eviscerate and Skull Crack records require source-log evidence                          |
| Review (omitted by draft)      | Thief Throw Gunk               | `16460`                                              | Supplemental record is absent from the live API and has no source-log evidence                    |

## Phase 1: canonicalize supported inputs

Use one plain `alias ID -> canonical ID` map and the equivalent of `aliases[id] ?? id`. Profession-owned data may be
assembled into that map, but there must be one runtime answer for a numeric ID.

- [x] Add the canonical alias map with the Phase 0 inventory.
- [x] Add a focused contract test proving every alias resolves directly to an existing canonical record.
- [x] Add a focused contract test proving alias targets are not alias keys and no cycles exist.
- [x] Route combat-log reconstruction through the shared map instead of maintaining separate profile aliases.
- [x] Canonicalize numeric IDs while loading saved rotations.
- [x] Canonicalize build-template skill IDs before palette/catalog lookup.
- [x] Verify editor paste/import paths use the same loader rather than adding another lookup.
- [x] Preserve existing handling for IDs absent from both the catalog and alias map.
- [x] Prove protected variants remain distinct with focused tests.

Exit condition: an input containing any verified alias ID produces the same canonical rotation action as an input
containing its canonical ID.

### Phase 1 result

`GW2_SKILL_ID_ALIASES` is the single runtime map for the 42 reviewed IDs. Rotation normalization now covers saved
builds, preset rotations, standalone JSON import, EVTC import, and dps.report import. Build-template resolution and
legacy `selectedSkillIds` canonicalize before catalog lookup. The four Warrior mappings formerly duplicated in the
Paragon log profile were removed; unrelated specialization-specific log aliases remain profile-owned.

The Spellbreaker benchmark kept alias `69297` as a compatibility fixture. Its combat-start marker moved from 760 ms to
the canonical skill's 758 ms impact so the observation window still includes the opening hit.

Validation:

| Check                                                | Result                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `npm run build`                                      | Passed; existing Vite chunk-size warning only                |
| `npm run typecheck` and touched-file ESLint          | Passed                                                       |
| Focused alias contract                               | 4 passed, 0 failed                                           |
| Affected profession, build, template, and log suites | 637 passed, 0 failed                                         |
| Five affected saved-preset DPS suites                | 5 passed, 0 failed; every manifest result remained within 1% |

## Phase 2: stop generated aliases from returning

The current snapshot builder follows `flip_skill`, adds the child to the included ID graph, and later clears the flip
relationship when parent and child names match. That leaves an orphan skill record. Fix that source behavior before
deleting generated records by hand.

- [x] Teach `scripts/data/lib/gw2-profession-snapshot.mjs` to consult the approved alias inventory before expanding a
      linked child.
- [x] Record the alias relationship without emitting a second skill snapshot.
- [x] Treat a same-name relationship only as a candidate; never auto-delete an unapproved ID by name.
- [x] Cover non-linked mode IDs through an explicit reviewed mapping rather than a name heuristic.
- [x] Regenerate only the five affected profession data sets.
- [x] Run generation twice and verify the second run has no diff.
- [x] Confirm protected variants are still emitted.

Exit condition: data regeneration emits one metadata record per canonical skill and cannot recreate the removed aliases.

### Phase 2 result

`aliases.ts` is the only reviewed inventory. Every one of its 42 mappings has an inline skill-name comment, and the
snapshot generator reads that TypeScript map directly; there is no JSON inventory or second hand-maintained map.
Generation fails if any numeric mapping loses its comment.

Profession seeds, weapon/training ownership, and linked `next_chain` or `flip_skill` IDs canonicalize before graph
expansion. Unlisted same-name records remain separate. Empty `attunement` fields are omitted, while actual Elementalist
attunement values remain supported. Three unstable Thief artifact IDs are explicit seeds so alternating live profession
payloads cannot drop protected records.

Warrior, Guardian, Engineer, Thief, and Necromancer were generated twice into isolated verification outputs. Both runs
were byte-identical after Prettier. The outputs suppressed all 42 aliases, retained all 35 canonical targets and six
affected protected variants, and contained no non-Elementalist `attunement` fields. The checked-in snapshots remain
unchanged so their runtime record deletion stays scoped to Phases 3 and 4 with the matching mechanics cleanup.

Validation:

| Check                                                | Result                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `npm run build`, `npm run typecheck`, and ESLint     | Passed; existing Vite chunk-size warning only                |
| Focused alias and snapshot-generator contracts       | 14 passed, 0 failed                                          |
| Canonical Warrior alias timing and behavior          | 6 passed, 0 failed                                           |
| Affected profession, build, template, and log suites | 584 passed, 0 failed                                         |
| Five affected saved-preset DPS suites                | 5 passed, 0 failed; every manifest result remained within 1% |

## Phase 3: pilot migration

Start with the smallest, lowest-risk sets before touching the large Warrior and Guardian inventories.

### Thief

- [x] Retain the two verified API-linked targets and leave the six rejected candidates out of the map.
- [x] Remove verified alias metadata from generated/supplemental data.
- [x] Remove the matching `SIMULATOR_EXCLUDED_ALIAS_IDS` entries.
- [x] Test alias log/rotation input and canonical palette output.

### Necromancer

- [x] Remove the three duplicate Manifest Sand Shade mechanics blocks.
- [x] Remove their metadata/ID constants when no longer referenced.
- [x] Remove their `simulatorAliasOfId` and simulator-exclusion records.
- [x] Replace metadata-shape assertions with one behavioral alias-load test.

Exit condition: Thief and Necromancer catalogs contain canonical records only, all 5 verified alias IDs still import,
and their focused profession tests pass.

### Phase 3 result

Thief now retains only canonical `40436` Death's Advance and `77230` Canach-Coin Toss records. Their two alias metadata
records, mechanics/constants, and exclusion entries were removed, while all six protected or review-only Thief records
remain distinct. Rotation/log compatibility tests load both deleted IDs through the shared map, and palette tests expose
only the canonical IDs.

Necromancer now retains one `44946` Manifest Sand Shade record and behavior. The three duplicate metadata records,
mechanics blocks, constants, and profession-local alias/exclusion machinery were removed. A focused behavioral test
loads all three deleted IDs and verifies the same canonical action, shade state, life force, and warnings.

Live Thief and Necromancer regeneration emitted the canonical records, retained protected Thief records, omitted all
five alias records, and emitted no `attunement` fields. `attunement` remains Elementalist-only.

Validation:

| Check                                             | Result                                                       |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `npm run build`, `npm run typecheck`, and ESLint  | Passed; existing Vite chunk-size warning only                |
| Focused profession, alias, loading, and migration | 289 passed, 0 failed                                         |
| Thief and Necromancer saved-preset DPS suites     | 2 passed, 0 failed; every manifest result remained within 1% |

## Phase 4: migrate the remaining safe aliases

### Engineer

- [x] Remove the 3 verified linked mechanics/metadata records.
- [x] Remove only the alias-related `PATCH_AUTHORING_EXCLUDED_SKILL_IDS` entries.
- [x] Verify kit/flip behavior and patch-authoring output remain unchanged for canonical IDs.

### Guardian

- [x] Remove the 16 verified mode-alias records.
- [x] Replace the test named `API mode aliases are not exposed as parent-child skill flips` with canonicalization
      behavior tests.
- [x] Add or retain a focused test proving `9224` Shield of Absorption remains a real follow-up.
- [x] Verify `44846` Sword of Justice imports as canonical `9168` Sword of Justice.

### Warrior

- [x] Remove the 18 verified duplicate mechanics/metadata records.
- [x] Remove `simulatorAliasOfId` and simulator-exclusion fields used only by these records.
- [x] Verify burst, primal burst, and mode-specific availability through canonical IDs.
- [x] Verify the affected saved presets load and simulate without new warnings.

Exit condition: all verified safe aliases have been removed from runtime catalogs and hand-authored mechanics while
remaining accepted at supported input boundaries.

### Phase 4 result

Engineer, Guardian, and Warrior now retain only the canonical records and behavioral implementations for their 37
reviewed aliases. Alias-only metadata, mechanics, ID constants, and exclusions were removed. Warrior name lookup now
uses explicit canonical winners for Forceful Shot, Path to Victory, and Harrier's Toss instead of a generic same-name
heuristic.

All reviewed IDs remain accepted at the shared input boundary. Focused coverage verifies `44846` loads canonical `9168`
Sword of Justice, the saved Spellbreaker `69297` fixture still simulates, and every deleted ID is absent from the
assembled catalogs. Protected Warrior variants remain distinct, and Guardian `9224` Shield of Absorption remains the
real follow-up to `9091`.

Live regeneration omitted all 37 Phase 4 aliases while retaining their canonical targets. It also emitted no
non-Elementalist `attunement` fields; `attunement` remains Elementalist-only. The reviewed mappings remain directly in
commented `aliases.ts`, with no JSON inventory.

Validation:

| Check                                                    | Result                                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run build`, `npm run typecheck`, and ESLint         | Passed; existing Vite chunk-size warning only                                                  |
| Focused alias, profession, and patch-authoring contracts | 301 passed, 0 failed                                                                           |
| Build-template codec and import contracts                | 7 passed, 0 failed                                                                             |
| Broader profession, migration, and log suites            | 456 passed; 2 unrelated stale aggregate-vs-tick assertions remain in untouched tests           |
| Engineer, Guardian, and Warrior saved-preset DPS suites  | 3 passed, 0 failed; every manifest result remained within 1% and no new warning was introduced |

## Phase 5: remove obsolete machinery and verify

- [x] Delete `simulatorAliasOfId` from shared types after its final producer and consumer are gone.
- [x] Remove profession-local alias/exclusion sets that became empty; retain unrelated exclusions.
- [x] Remove duplicate `skillIdAliases` entries from log profiles after logs use the shared canonical map.
- [x] Search for every deleted alias ID and classify each remaining occurrence as alias data, a focused test, or stale
      code.
- [x] Confirm no deleted alias appears in assembled catalogs or palette results.
- [x] Confirm every canonical target still has exactly one behavioral owner.
- [x] Run focused canonicalization, profession, loading, and build-template tests.
- [x] Run saved-preset smoke tests and investigate warnings instead of suppressing them.
- [x] Run the full repository checks and tests.
- [x] Update the audit totals from the final diff.

Recommended final commands:

```powershell
npm run check
npm test
```

Exit condition: no obsolete alias mechanism remains, supported imports are backward compatible, and full validation
passes.

### Phase 5 result

The implementation audit is complete. Warrior generation now handles canonical IDs only, the Spellbreaker EVTC precast
detector uses `canonicalGw2SkillId` instead of a parser-local alias list, and Thief's retained contextual variants no
longer use alias terminology. No `simulatorAliasOfId`, empty alias-exclusion set, or global-alias duplicate in a
profession log profile remains.

The 42 commented mappings in `aliases.ts` target 35 canonical skills. Every target has exactly one module-level
behavioral owner. The assembled catalogs now contain 2,081 skills, down 40 from the 2,121 baseline; the two Thief alias
records were already filtered from the baseline runtime catalog. Executable source outside `aliases.ts` contains no
reviewed alias numeric literals. Remaining occurrences are compatibility fixtures, focused tests, saved raw input, and
this migration record.

The redundant Firebrand stows identified in Phase 0 were removed after page exhaustion already stowed the tome. All nine
saved-preset suites remain within 1% DPS, and all nine Guardian rotations now simulate without warnings. The only
remaining preset warnings are two unrelated Elementalist Evoker `Transmute Fire` inputs without an active Fire Aura.

Repository-wide validation is green:

| Check                                                  | Result                                                  |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `npm run check`                                        | Passed; existing Vite chunk-size warning only           |
| Focused profession, alias, loading, template, and logs | 466 passed, 0 failed                                    |
| All saved-preset DPS suites                            | 9 passed, 0 failed; 111 rotation-backed presets checked |
| `npm test`                                             | 2,172 passed, 0 failed                                  |

Phase 5 is complete. Phase 6 records the separate candidate review below.

## Phase 6: review-only candidates

Do not promote these by name alone. Each needs proof of which ID external tools emit and whether hidden context changes
behavior.

- [x] Review only the `Review` rows from the Phase 0 rejected-candidate table; protected rows stay distinct unless their
      behavior contract changes first.
- [x] Revenant: review the mechanically identical Natural Harmony IDs.
- [x] Revenant: review the mechanically identical Energy Expulsion IDs.
- [x] Revenant: review the mechanically identical Purifying Essence IDs.
- [x] Revenant: review the Legendary Renegade Stance IDs.
- [x] Revenant: review the Energy Meld IDs.
- [x] Revenant: review both Beguiling Haze equivalence classes.
- [x] Thief: review Spinning Axe `71967` against `71854`.

Promote a candidate only after recording API relationships, EVTC/dps.report evidence, and a focused behavior comparison.
Otherwise leave it separate.

### Phase 6 result

The live ArenaNet `/v2/skills` records were audited on 2026-08-31 against repository log fixtures, build inputs, and the
assembled catalogs. Six API-linked Revenant records were promoted:

| Alias ID | Canonical ID | Skill                       | Evidence                                        |
| -------: | -----------: | --------------------------- | ----------------------------------------------- |
|  `29082` |      `27025` | Natural Harmony             | `27025.flip_skill` links directly to `29082`    |
|  `29114` |      `27356` | Energy Expulsion            | `27356.flip_skill` links directly to `29114`    |
|  `29197` |      `27715` | Purifying Essence           | `27715.flip_skill` links directly to `29197`    |
|  `46409` |      `41858` | Legendary Renegade Stance   | API-linked pair; logs and mechanics use `41858` |
|  `76917` |      `76805` | Beguiling Haze, underwater  | `76805.flip_skill` links directly to `76917`    |
|  `77159` |      `77141` | Beguiling Haze, terrestrial | `77141.flip_skill` links directly to `77159`    |

Their duplicate metadata, constants, mechanics, and module ownership were removed. The shared map now contains 48
commented aliases targeting 41 canonical skills, with no JSON inventory. The current worktree's nine catalogs contain
2,058 skills.

The remaining review candidates stay distinct:

| Area          | Retained ID(s)                                                                           | Decision basis                                                            |
| ------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Warrior       | `40601`, `41110`, `41330`, `42707`, `42803`, `43566`, `71922`, `71950`, `72089`, `73014` | No API identity relationship; tier or fact differences remain             |
| Guardian      | `15834`, `42371`                                                                         | No API identity relationship; `42371` also has different availability     |
| Engineer      | `5817`, `6091`, `6092`                                                                   | Missing API record or targeting, fact, and availability differences       |
| Thief         | `16460`, `45094`, `71967`, `76601`, `76900`, `77288`                                     | Missing API record or actor, duration, fact, and availability differences |
| Revenant      | `72058`                                                                                  | Matching facts alone do not establish an external identity relationship   |
| Engineer logs | `30337`                                                                                  | Contextual EVTC ID represents both mine placement and detonation          |

Rocket Boots, Slick Shoes, Elixir C, Elixir S, Elixir U, and Elixir X were later removed from simulator scope. Their
base, mode, tool-belt, detonation, and Lesser Elixir C records were deleted: 22 Engineer records total. The Engineer
catalog now contains 320 skills. The profession snapshot updater excludes API IDs `5825`, `5832`, `5860`, `5861`,
`5862`, and `5910` so regeneration cannot restore them. Official build-template palette mappings remain external decode
data and resolve as unsupported skills.

Focused migration, Revenant, log reconstruction, and family tests pass: 171 passed, 0 failed. The Engineer cleanup's 116
focused tests and `npm run check` also pass. The full suite reaches 2,174 of 2,175 tests; the remaining
Guardian/Luminary event-presentation contract failure is in unrelated working-tree changes.

## Suggested pull request sequence

1. Canonical map, validation tests, and all input-boundary normalization.
2. Generator fix plus Thief and Necromancer pilot cleanup.
3. Engineer cleanup.
4. Guardian cleanup and variant-test replacement.
5. Warrior cleanup, obsolete machinery removal, and final regression pass.

Each pull request must build and test independently. Do not combine deletion with an untested change to simulator
behavior.

## Decision log

| Date       | Decision                                                      | Status   | Reason                                                                                                             |
| ---------- | ------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| 2026-08-31 | Canonicalize IDs at input boundaries                          | Accepted | Keeps alias identity out of scheduling and resolution                                                              |
| 2026-08-31 | Use one plain alias map instead of alias constructors/classes | Accepted | The data is a numeric compatibility mapping, not behavior                                                          |
| 2026-08-31 | Never deduplicate by name alone                               | Accepted | Phase 0 found effect, availability, and state differences among same-name records                                  |
| 2026-08-31 | Require an API relationship or existing import-alias evidence | Accepted | Excludes 28 unproven or behaviorally distinct draft mappings from Phase 1                                          |
| 2026-08-31 | Migrate Thief and Necromancer first                           | Accepted | Their small sets expose generator/import mistakes before larger deletions                                          |
| 2026-08-31 | Keep the Spellbreaker alias preset as a compatibility fixture | Accepted | Moving its combat marker to the canonical 758 ms impact preserves the existing observation window and DPS contract |
| 2026-08-31 | Promote only six API-linked Phase 6 Revenant records          | Accepted | Direct `flip_skill` relationships establish identity; same-name and same-fact candidates remain insufficient       |
| 2026-08-31 | Keep raw Throw Mine ID `30337` contextual                     | Accepted | EVTC uses one ID for placement and detonation, while the simulator models two distinct actions                     |

Add decisions here when a mapping changes, a candidate is rejected, or an input boundary requires different handling.

## Progress log

| Date       | Phase | Change                                                                                                 | Validation                                                               | Follow-up                  |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------- |
| 2026-08-31 | Audit | Drafted 70 proposed aliases; the earlier total of 72 was incorrect                                     | Read-only catalog and mechanics comparison                               | Verify mappings in Phase 0 |
| 2026-08-31 | 0     | Verified 42 aliases, deferred/protected 28 proposals, and recorded 3 omitted candidates                | Build and typecheck passed; 522 focused tests and 5 preset suites passed | Implement Phase 1 only     |
| 2026-08-31 | 1     | Added the shared 42-ID map and canonicalized rotation, log, template, and legacy selected-skill inputs | Build, typecheck, ESLint, 637 affected tests, and 5 preset suites passed | Implement Phase 2 only     |
| 2026-08-31 | 2     | Made the commented TypeScript map drive deterministic alias-free snapshot generation                   | Build, typecheck, ESLint, 584 affected tests, and 5 preset suites passed | Implement Phase 3 only     |
| 2026-08-31 | 3     | Removed the five Thief and Necromancer duplicate records while retaining input compatibility           | Build, typecheck, ESLint, 289 affected tests, and 2 preset suites passed | Implement Phase 4 only     |
| 2026-08-31 | 4     | Removed the remaining 37 duplicate records while preserving aliases and protected variants             | Build, typecheck, ESLint, 308 focused tests, and 3 preset suites passed  | Implement Phase 5 only     |
| 2026-08-31 | 5     | Removed residual generator, parser, and exclusion alias machinery and audited all 42 mappings          | Full checks and all 2,172 tests passed                                   | Review Phase 6 separately  |
| 2026-08-31 | 6     | Promoted six API-linked Revenant IDs and retained every unproven or behaviorally distinct candidate    | 171 focused tests passed                                                 | None                       |
| 2026-08-31 | 6     | Removed six unsupported Engineer utility families and their attached actions from data and mechanics   | Full checks and 116 focused Engineer, alias, and generator tests passed  | None                       |

## Definition of done

- [x] All 48 verified aliases are migrated and every retained candidate remains explicitly protected.
- [x] Every migrated alias ID loads through logs, saved rotations, and build-template inputs.
- [x] Every canonical skill has one metadata record and one behavioral implementation.
- [x] Generated data updates are deterministic and do not restore aliases.
- [x] Protected variants remain independently addressable and behaviorally tested.
- [x] No alias-only constructor, override, exclusion, or profile mapping remains.
- [ ] Current worktree passes `npm run check`; `npm test` has one unrelated Guardian/Luminary contract failure.
