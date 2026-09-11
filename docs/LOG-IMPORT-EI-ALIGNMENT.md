# Log import cleanup: follow Elite Insights and leave opener repair to the user

Status: cleanup implemented and validated within the coverage limits below.

Validation: 236 focused import/Guardian tests and 57 browser tests pass. Type checking, production build and output
checks pass; the local development site was rebuilt afterward. The full Node suite passes 2,452 of 2,460 tests. All
eight failures reproduce on an isolated unchanged HEAD copy: Thief patch-authoring visibility, Mesmer event-log
presentation, and six Revenant timing/Impossible Odds checks. Repository-wide formatting still flags the unchanged Thief
pistol file; lint flags the pre-existing temporary Revenant analysis script. Touched source and documentation files were
formatted separately.

Follow-up Guardian fixes set Gleaming Disc's commit to 520 ms and Dazzling Hammer's to 400 ms. Guardian flips and
Luminary weapon/trait state now use the scheduler's commitment decision, so a committed Hammer cancel arms Shining Spin
while an uncommitted attempt does not.

## Implemented coverage and remaining limits

The adapters now leave missing setup unrecorded, share represented-action normalization, preserve source actions
separately, and return the generic opener notice once. Animation decoding follows the pinned EI recording boundary,
per-actor/per-skill pairing, 10 ms tolerance, unknown casts, status and acceleration semantics.

The ordinary finder table contains explicit descriptors. Custom animated finders, Ranger/Reaper spawn detection,
Engineer kit swaps and Chronomancer shatter checks are implemented separately. This is not a complete EI parity
certification. Extension healing/barrier and unported custom predicates are omitted; no generic catalog or damage guess
replaces them. Mechanist summon/recall skills are intentionally outside simulator scope. Time-aware ownership changes
and reused instance IDs are conservatively rejected. ArcDPS encoding selection currently uses the header build, and
encounter start/end use the documented adapter boundaries rather than EI encounter-specific logic.

Holosmith Blade Burst and Particle Accelerator now use the pinned
[MissileCastFinder](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/InstantCastFinders/MissileCastFinder/MissileCastFinder.cs):
player-owned missile creation events, original timestamps, a sliding 50 ms duplicate window and accurate skill-origin
metadata. These declarations have no extra build gate or minion attribution. The pinned
[HolosmithHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Engineer/HolosmithHelper.cs)
also declares an ambiguous effect fallback with a secondary same-source check and `UsingDisableWithMissileData`. That
fallback remains excluded; damage is not used to guess either skill. The EI pin is unchanged.

The following pinned ordinary-finder declarations were excluded because their finder/checker family was unsupported by
the ordinary table. Some have a separately implemented custom path described above; listing a declaration here does not
mean all evidence for its skill is absent. These are coverage exclusions, not replacement heuristics:

- **Elementalist:** `Elementalist.HealingRipple`, `Elementalist.HealingRippleWvW`, `Elementalist.FlowLikeWaterHealing`,
  `Elementalist.FlameWheelSkill`, `Elementalist.IcyCoilSkill`, `Elementalist.CrescentWindSkill`,
  `Elementalist.RockyLoopSkill`, `Elementalist.Hurl`, `Weaver.FlameWheelSkill`, `Weaver.DualOrbitFireAndWater`,
  `Weaver.DualOrbitFireAndAir`, `Weaver.DualOrbitFireAndEarth`, `Weaver.IcyCoilSkill`, `Weaver.DualOrbitFireAndWater`,
  `Weaver.DualOrbitWaterAndAir`, `Weaver.DualOrbitWaterAndEarth`, `Weaver.CrescentWindSkill`,
  `Weaver.DualOrbitFireAndAir`, `Weaver.DualOrbitWaterAndAir`, `Weaver.DualOrbitAirAndEarth`, `Weaver.RockyLoopSkill`,
  `Weaver.DualOrbitFireAndEarth`, `Weaver.DualOrbitWaterAndEarth`, `Weaver.DualOrbitAirAndEarth`,
  `Catalyst.FlameWheelSkill`, `Catalyst.IcyCoilSkill`, `Catalyst.CrescentWindSkill`, `Catalyst.RockyLoopSkill`.
- **Engineer:** `Engineer.MagneticInversion`, `Engineer.EngineerKitFinder(BombKit),`,
  `Engineer.EngineerKitFinder(ElixirGun),`, `Engineer.EngineerKitFinder(Flamethrower),`,
  `Engineer.EngineerKitFinder(GrenadeKit),`, `Engineer.EngineerKitFinder(MedKitSkill),`,
  `Engineer.EngineerKitFinder(ToolKit),`, `Engineer.EngineerKitFinder(EliteMortarKit),`,
  `Engineer.DetonateThrowMineOrMineField`, `Engineer.DetonateMineField`, `Engineer.DetonateThrowMine`,
  `Engineer.AimAssistedRocket`, `Engineer.SurpriseShot`, `Holosmith.BladeBurstOrParticleAccelerator`,
  `Mechanist.CrisisZone`, `Mechanist.RocketPunchMech`, `Mechanist.ExigencyProtocol`.
- **Guardian:** `Guardian.JudgesIntervention`, `Guardian.MercifulInterventionSkill`, `Guardian.Advance`,
  `Guardian.StandYourGround`, `Guardian.LesserSymbolOfBlades`, `Guardian.LesserSymbolOfBlades`,
  `Guardian.LesserSymbolOfResolution`, `Guardian.LesserSymbolOfResolution`, `Guardian.LesserSymbolOfProtection`,
  `Guardian.LesserSymbolOfProtection`, `Guardian.GlacialHeartHeal`, `Guardian.SelflessDaring`,
  `Firebrand.MantraOfSolace`, `Firebrand.FlameRush`, `Firebrand.FlameSurge`, `Firebrand.FlameRushOrFlameSurge`,
  `Firebrand.EchoOfTruth`, `Firebrand.VoiceOfTruth`, `Firebrand.EchoOfTruthOrVoiceOfTruth`.
- **Mesmer:** `Mesmer.SignetOfMidnightSkill`, `Mesmer.Swap`, `Mesmer.PhaseRetreat`, `Mesmer.BlinkOrPhaseRetreat`,
  `Mesmer.MindWrackOrMindWrackAmmo`, `Mesmer.MindWrack`, `Mesmer.MindWrackAmmo`, `Mesmer.CryOfFrustration`,
  `Mesmer.Diversion`, `Mesmer.DistortionSkill`, `Mesmer.DistortionSkill`, `Mesmer.MantraOfRecovery`,
  `Mesmer.PowerCleanse`, `Virtuoso.BladesongDistortion`.
- **Necromancer:** `Necromancer.SpitefulSpirit`, `Necromancer.SpectralRecallSkill`, `Necromancer.SpitefulRenewal`,
  `Necromancer.DistressSkill`, `Reaper.MinionSpawnCastFinder(Rise, (int)MinionID.ShamblingHorror)  `,
  `Scourge.SandCascadeSkill`, `Scourge.DesertShroud`, `Scourge.SandstormShroudSkill`,
  `Scourge.SadisticSearingActivation`.
- **Ranger:** `Ranger.SignetOfStone`, `Ranger.LesserSignetOfStone`, `Ranger.WindborneNotes`, `Ranger.InvigoratingBond`,
  `Ranger.EvasivePurity`, `Ranger.ProtectMe`, `Ranger.GuardSkill`, `Ranger.LesserGuardSkill`, `Ranger.RangerPetSpawned`,
  `Galeshot.SummonCycloneBow`.
- **Revenant:** `Revenant.CallOfTheCentaur`, `Revenant.ProjectTranquility`, `Revenant.VentarisWill`,
  `Revenant.NaturalHarmony`, `Revenant.NaturalHarmony`, `Revenant.PurifyingEssence`, `Revenant.EnergyExpulsion`,
  `Revenant.ProtectiveSolaceSkill`, `Renegade.BandTogetherCastFinder(BreakrazorsBastionSkill, BreakrazorsB`,
  `Renegade.BandTogetherCastFinder(RazorclawsRageSkill, RazorclawsRageSk`,
  `Renegade.BandTogetherCastFinder(DarkrazorsDaringSkill, DarkrazorsDari`,
  `Renegade.BandTogetherCastFinder(IcerazorsIreSkill, IcerazorsIreSkillE`, `Conduit.CosmicWisdomSkill`,
  `Conduit.FormOfTheDervishDamage`, `Conduit.FormOfTheDervishDamageElite`.
- **Thief:** `Thief.ShadowReturn`, `Thief.SpiderVenomSkill`, `Thief.ThousandNeedles`.
- **Warrior:** `Warrior.MendingMight`, `Bladesworn.FlowStabilizer`.

Shared normalization now lives in `lib/rotation/professions/`. Obsolete report recovery helpers and EVTC preparation
builders were removed. Source durations remain diagnostic evidence; commands still use catalog timing, scheduler
quantization, observed cancellation and ordinary waits. Reports with missing opening Forge entries require manual
completion even when every supplied entry imports correctly.

## Objective

Remove automatic reconstruction of unrecorded precasts and preparation sequences. Align EVTC cast detection with Elite
Insights (EI), and use the rotation exported by dps.report as the authoritative cast timeline for report imports. Users
can repair incomplete openers after importing.

An import is successful when it faithfully converts the available cast evidence. It does not need to produce a complete
benchmark opener or a rotation that immediately simulates without missing-state or availability warnings.

The reference for EVTC behavior is EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. This report builds on source
analysis of that commit and the current import implementation; it is not a completed parity certification.

## Required behavior

| Concern                               | Contract after cleanup                                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| EVTC casts                            | Decode recorded casts and apply the explicit EI inference rules applicable to the log version.                                         |
| dps.report casts                      | Import the selected player's exported rotation, filtered to the selected phase. Do not infer additional inputs.                        |
| Precombat casts present in the source | Preserve them, including negative starts and casts crossing the combat boundary.                                                       |
| Missing precasts                      | Leave them missing. Do not derive preparation sequences from damage, initial state, later casts, or build requirements.                |
| Initial state                         | Do not turn an initial buff, existing minion, or dependent skill into an invented player input.                                        |
| Timing                                | Preserve source timestamps and durations as evidence. Keep necessary simulator command conversion separate from source interpretation. |
| Unsupported inputs                    | Report unsupported mappings and preserve timing where possible. Do not substitute a guessed cast.                                      |
| User-authored preparation             | Keep the rotation editor, manual precasts, and existing saved rotations working.                                                       |

“Remove precast determination” does not mean deleting every cast before combat or disabling all EI inference. EI can
legitimately identify a pre-log cast from a surviving stop record, and it detects some instant skills through specific
effect or buff rules. Preserve those results; remove the additional reconstruction of a plausible opener.

## EI behavior to reproduce

### Recorded animations and incomplete casts

EI selects modern animation state changes or legacy activation records using the EVTC build. It groups records by actor
and skill ID, then pairs starts and stops within those groups. A stop must not consume another skill's start. [Source:
CombatItem][ei-combat-item], [CombatEventFactory][ei-cast-factory].

For an unmatched stop, EI derives `start = stop.Time - stop.Value` and uses the reported duration. It accepts the cast
only when that start is strictly before `logData.EvtcLogStart`. The recording boundary is distinct from the player's
first event, player enter-combat time, and encounter/phase start. Preserve the distinction when applying time offsets.
[Source: AnimatedCastEvent][ei-animated-cast], [CreateCastEvents][ei-cast-factory].

Port the associated behavior as well: missing-end duration handling, unknown-cast truncation, activation status and
acceleration interpretation, and removal of player animation casts lasting at most 1 ms. At the pinned commit,
`ServerDelayConstant` is 10 ms; do not retain our existing 150 ms duration tolerance as though it were EI behavior.
[Source: AnimatedCastEvent][ei-animated-cast], [ParserHelper][ei-parser-helper].

The current dispatcher chooses modern parsing by finding a modern start. Review logs containing only modern stops:
format selection must follow the supported EVTC version rather than depend on whether a start survived clipping.

### Explicit inference rules

Retain or implement EI-equivalent cast finders with their actual evidence requirements, version gates, time offsets,
duplicate suppression, and origin/accuracy metadata. A generic simulator-catalog heuristic is not an equivalent rule.
Document the corresponding EI method beside retained nontrivial inference logic. [Source: EICastParse][ei-combat-data],
[InstantCastFinder][ei-instant-finder].

Examples that constrain the cleanup:

- The standard `BuffGainCastFinder` rejects initial applications through `!bae.Initial`. An initial shroud snapshot
  alone must not become an entry cast through this rule. Individual custom EI rules must still be examined separately.
- Engineer kit detection uses an actual kit weapon swap and subsequent bundle casts to identify the kit. Merely needing
  a kit for the next skill does not establish an equip cast at that timestamp.
- EI's `MinionSpawnCastFinder` consumes spawn events; an already-present minion does not establish a timed summon chain.
- EI has specific custom animated-cast rules as well as instant finders. Do not delete them merely because they infer a
  cast from a non-animation event.

[Sources: BuffGainCastFinder][ei-buff-gain], [EngineerHelper][ei-engineer], [MinionSpawnCastFinder][ei-minion-spawn],
[EICastParse][ei-combat-data].

### Report export boundary

EI exports casts intersecting its report window, retaining their cast timestamps and durations. It does not rebuild an
opener during JSON export. A cast ending before that window can be absent even when its lingering damage is present.
Damage without a rotation entry is therefore not sufficient grounds to add a cast. [Sources:
JsonActorBuilder][ei-json-actor], [Actor intersection filtering][ei-actor], [JsonRotationBuilder][ei-json-rotation].

Use the actual imported report as the authority, even when an older EI version produced it. Exact comparison with an
EVTC import requires matching parser version, player, time origin, and report/phase window. Do not promise identical
outputs across different EI versions or different observation windows.

## Cleanup inventory

Paths below are relative to `js/games/gw2/integrations/logs/` unless otherwise stated. These are starting points;
inspect every profession adapter and caller before deleting a shared helper.

| Area                                                                        | Required cleanup                                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evtc/rotation/animations.ts`                                               | Replace custom unmatched-stop recovery and cross-skill pairing with EI semantics. Remove damage/transformation gates that substitute for EI's recording-boundary check.                                               |
| `evtc/rotation/reconstruct.ts`                                              | Remove initial-summon chains and initial-state transition backdating. Align buff transitions and generic instant detection with explicit EI rules. Fix version-based animation dispatch.                              |
| `evtc/rotation/professions/`                                                | Remove opener construction based on initial buffs, packet patterns, later cooldowns, existing summons, or replay prerequisites unless the exact corresponding EI rule supports the emitted cast and timestamp.        |
| `dps-report/rotation/reconstruct.ts`                                        | Preserve exported cast timing; remove `alignOpeningStrike` and source-boundary overrides introduced to make simulator opener damage line up. Audit duplicate filtering and simultaneous ordering for source fidelity. |
| `dps-report/rotation/professions/`                                          | Remove all missing-input recovery, including mid-rotation dependency insertion. Retain justified identity mapping, proc filtering, and conversion of represented actions.                                             |
| `dps-report/rotation/target-damage.ts`                                      | Remove cast-invention consumers. Delete the helper only if no legitimate diagnostic consumers remain.                                                                                                                 |
| `dps-report/rotation/create-inferred-action.ts`, adapter types and profiles | Remove helpers, inference tags, options, configuration, and imports made unused by the cleanup.                                                                                                                       |
| `lib/rotation/timeline.ts` and timing helpers                               | Remove compensation or controls used only by fabricated setup. Preserve ordinary waits, observed overlap, and necessary command encoding.                                                                             |

Concrete recovery behavior to remove includes:

- Core Engineer EVTC setup that adds Throw Mine, two dodges, Mine Field, kit/bombs, and a 12-second mine lead-in.
- EVTC summon chains positioned backward using simulator cast durations, and opening Mimic derived from later Mimics.
- Report Virtuoso and Dragonhunter precasts derived from aggregate connected-hit totals.
- Report Troubadour Mimic recovery, Harbinger entry from dependent shroud casts, and missing kit equips/stows.
- Report Throw Mine recovery with a fixed 5-second wait.
- Report Renegade warband recovery from a later legend cycle and extra Darkrazor used to satisfy energy requirements.
- Equivalent opener/dependency recovery in Elementalist, Ranger, Guardian, Revenant, Thief, Warrior, and other adapters.

Setting `inferInstantCasts: false` is insufficient: EVTC profession reconstruction and initial-summon insertion run
before that option gates the generic instant-inference pass. Remove the prohibited behavior at its owners.

## Preserve necessary import behavior

- Keep input validation, archive safety, player selection, phase selection, and skill/catalog resolution.
- Keep EI-originated inferred casts supplied by a report. `isNotAccurate` alone is not grounds to discard a cast.
- Keep automatic proc filtering where the simulator already generates the effect; EI rotation rows are not all
  independent player inputs. Audit fixed-ID exceptions against the applicable EI classification.
- Preserve observed interruptions and supported composite/variant mappings, but audit transformations that change the
  number or timing of inputs. A normalization rule must not manufacture a missing prerequisite.
- EI groups JSON casts by skill, so sorting recovers chronology but cannot recover original cross-skill ordering for
  exact timestamp ties. Use a stable documented tie policy; do not claim that order was recorded.
- Keep read-only proc observations and diagnostics that do not inject casts or mutate simulator state.
- Keep normal simulator mechanics, manual opener editing, and existing saved-preset content. Do not repair fresh imports
  by changing engine resource defaults, granting opening buffs, resetting cooldowns, or bypassing availability.

Source timestamps may need a common offset when encoded as simulator commands. That is distinct from individually moving
an opening cast, fabricating a wait, or moving combat start to improve replay DPS. Preserve the source origin and audit
encounter-start handling against EI; do not replace it with a blanket “first player hit” rule.

## Import warning

Show this once for each successful EVTC or dps.report import, including report JSON and report URLs:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Use the existing returned `warnings` list and import-dialog rendering. This is informational and must not require
acknowledgment or block importing. Do not run a new completeness detector just to decide whether to show it.

Replace the existing report opener disclaimer and obsolete “Recovered setup” notices. Keep actionable warnings for
unsupported skills, malformed/incomplete evidence, and other independent problems. Avoid duplicating the generic opener
warning across application and adapter layers. Native saved-rotation imports should not receive this notice.

Application entry points are `js/games/gw2/app/build/io/evtc-rotation-import.ts`, `dps-report-rotation-import.ts`, and
`rotation-import-dialog.ts`.

## Implementation sequence

1. Trace adapter entry points, profession rules, shared helpers, and existing tests. Record which retained EVTC
   inference rules correspond to which methods in the pinned EI source; separate legitimate normalization from recovery.
2. Remove report-side missing-input reconstruction and opener retiming. Preserve supplied casts and their metadata.
3. Align EVTC animation decoding, recording boundaries, and explicit cast finders with EI. Remove additional setup
   reconstruction across every profession. Do not replace unsupported EI coverage with generic guesses.
4. Remove unused reconstruction helpers, tags, controls, options, and configuration dependencies. Avoid adding a “legacy
   reconstruction” toggle or replacement opener framework.
5. Add the shared warning behavior and revise adapter documentation to describe the new boundary.
6. Update focused tests, run relevant checks, and investigate remaining mismatches without reintroducing opener guesses.

Update `docs/EVTC-ROTATION-RECONSTRUCTION.md`, the three log-adapter READMEs, and any affected profession-specific
documentation. Existing claims that missing setup must be reconstructed should be removed.

## Verification and acceptance criteria

Use small synthetic scenarios that test parsing, ordering, validation, and observation-window contracts:

- Modern and legacy casts pair within actor/skill groups. A stop cannot complete another skill's start.
- A stop at `+200 ms` with `800 ms` duration recovers a `-600 ms` start when the recording boundary is `0`. An unmatched
  stop whose derived start is at or after the recording boundary is not recovered by this rule.
- Modern stop-only evidence uses the modern parser. Missing-end and short-cast handling follows EI.
- An initial buff alone does not trigger the standard buff-gain finder; an ordinary qualifying application does.
- Existing minions and dependent skills do not generate an invented setup chain. Retained EI finders still work from
  their required events, with their version and duplicate-suppression conditions.
- Report casts crossing phase start retain their source start/duration. Aggregate damage or a later repetition does not
  add a missing input. An EI-supplied inferred cast remains available for import.
- An incomplete opener imports successfully and receives exactly one generic notice. Unsupported-action and validation
  warnings remain visible. Native saved rotations are unaffected.
- CLI and UI imports use the same adapter behavior; there is no hidden recovery in the application wrappers.

Replace tests that require fabricated openers with focused source-fidelity cases. Follow the repository testing policy:
do not add saved-rotation length/order assertions, per-skill cast/hit/damage totals, entire-result snapshots, or exact
benchmark-DPS checks. Minimal exact assertions are appropriate for the parser or timing contract under test.

For implementation validation, build modules and run the affected EVTC, dps.report, shared log-analyzer, and import UI
tests, then complete the repository's required checks. Format only touched supported files with
`npx prettier --write <touched-files>`. Use comparisons with the pinned EI parser as diagnostic evidence, with matching
versions/windows, rather than broad saved-report snapshots.

Expected consequences include fewer imported actions, shorter preparation timelines, and changed simulated DPS. Those
are acceptable when fabricated setup was removed. Do not modify benchmark expectations or saved presets merely to hide
the effect. If an existing preset emits warnings, identify it and fix or explicitly document the issue rather than
silencing warnings.

The cleanup is complete when every imported player input is traceable to a supplied report cast or an applicable EI EVTC
rule, necessary simulator conversions are explicit, missing opener setup remains editable, and no additional precast
reconstruction survives in shared or profession-specific paths.

## Pinned EI references

[ei-combat-item]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/CombatItem.cs#L402
[ei-cast-factory]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/ParsedData/CombatEvents/CombatEventFactory.cs#L735
[ei-animated-cast]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/ParsedData/CombatEvents/CastEvents/AnimatedCastEvent.cs
[ei-parser-helper]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/ParserHelpers/ParserHelper.cs#L30
[ei-combat-data]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/ParsedData/CombatData.cs#L217
[ei-instant-finder]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/InstantCastFinders/InstantCastFinder.cs
[ei-buff-gain]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/InstantCastFinders/BuffInstantCastFinder/BuffGainCastFinder.cs
[ei-engineer]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Engineer/EngineerHelper.cs#L16
[ei-minion-spawn]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/InstantCastFinders/MinionCastFinder/MinionSpawnCastFinder.cs
[ei-json-actor]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIBuilders/JsonModels/JsonActors/JsonActorBuilder.cs#L57
[ei-actor]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/Actors/Actor.cs#L439
[ei-json-rotation]:
  https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIBuilders/JsonModels/JsonActorUtilities/JsonRotationBuilder.cs
