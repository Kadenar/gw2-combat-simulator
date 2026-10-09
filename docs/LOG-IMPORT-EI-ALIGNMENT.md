# Log import: follow Elite Insights, leave opener repair to the user

For day-to-day maintenance (reviewing a new EI release, fixing a mismatch), start at
[EI-PARSER-MAINTENANCE.md](../js/games/gw2/integrations/logs/EI-PARSER-MAINTENANCE.md). This document is the contract
that guide maintains: what an import must and must not do, and which EI finders are currently supported.

The reference for EVTC behavior is EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`
([GW2-Elite-Insights-Parser](https://github.com/baaron4/GW2-Elite-Insights-Parser)). This is a source behavior baseline,
not a claim of complete parity.

## Objective

Do not automatically reconstruct unrecorded precasts or preparation sequences. Align EVTC cast detection with Elite
Insights (EI), and use the rotation exported by dps.report as the authoritative cast timeline for report imports.
Untamed pet commands use the selected player's owned pet rotations when present, including F2; the player-side inferred
command marker can occur after the pet animation starts. Soulbeast continues to use the player rotation. Users repair
incomplete openers themselves after importing.

An import is successful when it faithfully converts the available cast evidence. It does not need to produce a complete
benchmark opener or a rotation that immediately simulates without missing-state or availability warnings.

Core Steal has an explicitly local EVTC inference rule outside the EI baseline. It requires a target-attached effect
corroborated by same-owner Serpent's Touch and Deadly Ambush condition bursts; see the
[EVTC evidence contract](../js/games/gw2/integrations/logs/evtc/README.md#cast-evidence) for its limits. It does not
infer missing setup or alter dps.report timelines. Thousand Needles now uses the pinned EI finder with both delayed
secondary visuals, rather than remaining in the unsupported checker list.

Distress also uses the pinned EI finder: its caster-owned spear effect must coincide with a Distress buff remove-all
event within the strict 10 ms server tolerance. The removal check spans all actors, matching EI; the visual supplies
caster identity. It is no longer excluded as an unsupported custom checker.

## Required behavior

| Concern                               | Contract                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| EVTC casts                            | Decode recorded casts and apply the explicit EI inference rules applicable to the log version.                                         |
| dps.report casts                      | Import the selected player's exported rotation, filtered to the selected phase. Do not infer additional inputs.                        |
| Precombat casts present in the source | Preserve them, including negative starts and casts crossing the combat boundary.                                                       |
| Missing precasts                      | Leave them missing. Do not derive preparation sequences from damage, initial state, later casts, or build requirements.                |
| Initial state                         | Do not turn an initial buff, existing minion, or dependent skill into an invented player input.                                        |
| Timing                                | Preserve source timestamps and durations as evidence. Keep necessary simulator command conversion separate from source interpretation. |
| Unsupported inputs                    | Report unsupported mappings and preserve timing where possible. Do not substitute a guessed cast.                                      |
| User-authored preparation             | Keep the rotation editor, manual precasts, and existing saved rotations working.                                                       |

"Remove precast determination" does not mean deleting every cast before combat or disabling all EI inference. EI can
legitimately identify a pre-log cast from a surviving stop record, and it detects some instant skills through specific
effect or buff rules. Preserve those results; do not add reconstruction of a plausible opener on top of them.

## EI behavior to reproduce

### Recorded animations and incomplete casts

EI selects modern animation state changes or legacy activation records using the EVTC build. It groups records by actor
and skill ID, then pairs starts and stops within those groups. A stop must not consume another skill's start. [Source:
CombatItem][ei-combat-item], [CombatEventFactory][ei-cast-factory].

For an unmatched stop, EI derives `start = stop.Time - stop.Value` and uses the reported duration. It accepts the cast
only when that start is strictly before `logData.EvtcLogStart`. The recording boundary is distinct from the player's
first event, player enter-combat time, and encounter/phase start. Preserve the distinction when applying time offsets.
[Source: AnimatedCastEvent][ei-animated-cast], [CreateCastEvents][ei-cast-factory].

The decoder also handles missing-end durations, unknown-cast truncation, activation status and acceleration, and removal
of player animation casts lasting at most 1 ms. At the pinned commit, `ServerDelayConstant` is 10 ms. [Source:
AnimatedCastEvent][ei-animated-cast], [ParserHelper][ei-parser-helper].

The dispatcher selects format by the ArcDPS header build via `evtc/recording.ts`: builds from `20260430` use modern
animation state changes, including stop-only logs. It does not select the format by searching for a modern start.

### Explicit inference rules

Retain or implement EI-equivalent cast finders with their actual evidence requirements, version gates, time offsets,
duplicate suppression, and origin/accuracy metadata. A generic simulator-catalog heuristic is not an equivalent rule.
Document the corresponding EI method beside retained nontrivial inference logic. [Source: EICastParse][ei-combat-data],
[InstantCastFinder][ei-instant-finder].

Examples that constrain the design:

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

## Implemented coverage and remaining limits

The adapters leave missing setup unrecorded, share represented-action normalization, preserve source actions separately,
and return the generic opener notice once. Animation decoding follows the pinned EI recording boundary,
per-actor/per-skill pairing, 10 ms tolerance, unknown casts, status and acceleration semantics.

The ordinary finder table (`evtc/rotation/ei-rules.ts`) contains explicit descriptors. Custom animated finders,
Ranger/Reaper spawn detection, Engineer kit swaps and Chronomancer shatter checks are implemented separately beside it —
this is not a complete EI parity certification. Extension healing/barrier and unported custom predicates are omitted; no
generic catalog or damage guess replaces them. Mechanist summon/recall skills are intentionally outside simulator scope.
Time-aware ownership changes and reused instance IDs are conservatively rejected. ArcDPS encoding selection currently
uses the header build. Training golems with `LogNPCUpdate` use the target's first nonzero damage for combat start,
following the pinned EI
[Golem.GetLogOffset](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/LogLogic/Golem/Golem.cs#L183).
Without target damage, the existing player/recording boundary remains the fallback. Other encounter start/end boundaries
remain the documented adapter heuristics rather than full EI encounter-specific logic.

Pet-command inference retains the pinned EI behavior: some species have multiple skill registrations for the same
command buff. For example,
[RangerHelper's Carrion Devourer registrations](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Ranger/RangerHelper.cs#L333)
produce both Poisonous Cloud and Regenerate. `MinionCommandCastFinder` checks species and ownership, and the shared buff
finder and dispatcher preserve both outputs without disambiguating build gates. This is an upstream ambiguity, not a
local parity defect; removing either registration would change the reference behavior. For Untamed skills with recorded
owned-pet animations, those animations replace the player-side command markers in imported source actions and replay.
This deliberate source-selection exception preserves pet start, duration, and interruption evidence without adding a
second command or applying a guessed time offset. Skills without pet animation evidence retain their existing source.

Weaver attunement inference ports the application-evidence portion of
[WeaverHelper.TransformWeaverAttunements](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Elementalist/WeaverHelper.cs#L458).
The selected player's basic/major/minor/dual buffs are grouped within a strict, anchored 10 ms window; component
evidence is suppressed before the existing finders consume synthetic applications. Dual and lone-basic transitions,
initial snapshots, and incomplete-pair rejection follow the pinned transformation. Removal/extension evidence can anchor
a group but cannot supply an attunement. Raw events remain unchanged; synthetic previous-state removals are not needed
by supported cast finders. Canonical identities separate EI Fire Water -5 from simulator Dodge -5, and shared
normalization handles attunement-dependent skills and Unravel's generated dual transition for both log adapters.

The following skill-specific behaviors follow the pinned EI source directly:

- **Holosmith Blade Burst / Particle Accelerator** use the pinned
  [MissileCastFinder](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/InstantCastFinders/MissileCastFinder/MissileCastFinder.cs):
  player-owned missile creation events, original timestamps, a sliding 50 ms duplicate window, and skill-origin
  metadata. The pinned
  [HolosmithHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Engineer/HolosmithHelper.cs)
  also declares an ambiguous effect fallback with `UsingDisableWithMissileData`; that fallback stays excluded, and
  damage is never used to guess between the two skills.
- **Hurl** (all Elementalist specializations) follows the pinned
  [ElementalistHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Elementalist/ElementalistHelper.cs)
  missile rule: player-owned missile creations with a sliding 900 ms duplicate window group the five rocks into one cast
  at the first creation timestamp.
- **Firebrand's Flame Rush, Flame Surge**, and their combined ambiguous finder follow the pinned EI effect rules.
- **Distortion** follows the pinned
  [MesmerHelper](https://github.com/baaron4/GW2-Elite-Insights-Parser/blob/d7f186c8579a5cab4ed362f0703e49e4a81b9a2a/GW2EI.Library/GW2EI.Services/GW2EIEvtcParser/EIData/ProfHelpers/Mesmer/MesmerHelper.cs)
  effect rule and `HasGainedBuff` checker: its shared visual requires a Distortion buff application on the same caster
  within 10 ms. Core and Mirage are eligible on all builds; Chronomancer requires build 135242 or later. Other unported
  shatter finders remain excluded.
- **Jurisdiction** charge/release: both import paths collapse recorded level-one charge/release segments into the
  existing single activation, retaining their combined duration. The accompanying detonation is already represented by
  that activation. Unpaired releases remain unsupported rather than creating an absent charge. Tome entry/stow
  bundle-swap signals are removed from replay; the tome actions themselves stay concurrent and never truncate an ongoing
  skill.
- **Solace (`-20`) / Potence (`-22`)**: both import paths resolve EI's combined casts from isolated three-charge bursts.
  A subsequent use before final-charge recharge completes identifies a normal charge even in a sparse rotation. The
  remaining normal-charge count uses conservative base-rate ammo recovery (assumes no recharge-slowing effects). Final
  charges outside tight bursts are identified only when even maximum Alacrity recovery leaves a single charge.
  Unresolved or contradictory histories remain ambiguous; source records and inference metadata are preserved.

Shared normalization lives in `shared/rotation/professions/`. Source durations remain diagnostic evidence; simulator
commands still use catalog timing, scheduler quantization, observed cancellation and ordinary waits. Reports with
missing opening Forge entries require manual completion even when every supplied entry imports correctly.

The following pinned ordinary-finder declarations are not currently implemented, because their finder/checker family is
unsupported by the ordinary table. Some have a separately implemented custom path described above — listing a
declaration here does not mean all evidence for its skill is absent. The current ordinary table is
`evtc/rotation/ei-rules.ts`, and custom paths live beside it; read this list together with the coverage notes above, not
as a generated diff of the current table:

- **Elementalist:** `Elementalist.HealingRipple`, `Elementalist.HealingRippleWvW`, `Elementalist.FlowLikeWaterHealing`,
  `Elementalist.FlameWheelSkill`, `Elementalist.IcyCoilSkill`, `Elementalist.CrescentWindSkill`,
  `Elementalist.RockyLoopSkill`, `Weaver.FlameWheelSkill`, `Weaver.DualOrbitFireAndWater`, `Weaver.DualOrbitFireAndAir`,
  `Weaver.DualOrbitFireAndEarth`, `Weaver.IcyCoilSkill`, `Weaver.DualOrbitFireAndWater`, `Weaver.DualOrbitWaterAndAir`,
  `Weaver.DualOrbitWaterAndEarth`, `Weaver.CrescentWindSkill`, `Weaver.DualOrbitFireAndAir`,
  `Weaver.DualOrbitWaterAndAir`, `Weaver.DualOrbitAirAndEarth`, `Weaver.RockyLoopSkill`, `Weaver.DualOrbitFireAndEarth`,
  `Weaver.DualOrbitWaterAndEarth`, `Weaver.DualOrbitAirAndEarth`, `Catalyst.FlameWheelSkill`, `Catalyst.IcyCoilSkill`,
  `Catalyst.CrescentWindSkill`, `Catalyst.RockyLoopSkill`.
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
  `Firebrand.MantraOfSolace`, `Firebrand.EchoOfTruth`, `Firebrand.VoiceOfTruth`, `Firebrand.EchoOfTruthOrVoiceOfTruth`.
- **Mesmer:** `Mesmer.SignetOfMidnightSkill`, `Mesmer.Swap`, `Mesmer.PhaseRetreat`, `Mesmer.BlinkOrPhaseRetreat`,
  `Mesmer.MindWrackOrMindWrackAmmo`, `Mesmer.MindWrack`, `Mesmer.MindWrackAmmo`, `Mesmer.CryOfFrustration`,
  `Mesmer.Diversion`, `Mesmer.DistortionSkill`, `Mesmer.DistortionSkill`, `Mesmer.MantraOfRecovery`,
  `Mesmer.PowerCleanse`, `Virtuoso.BladesongDistortion`.
- **Necromancer:** `Necromancer.SpitefulSpirit`, `Necromancer.SpectralRecallSkill`, `Necromancer.SpitefulRenewal`,
  `Reaper.MinionSpawnCastFinder(Rise, (int)MinionID.ShamblingHorror)  `, `Scourge.SandCascadeSkill`,
  `Scourge.DesertShroud`, `Scourge.SandstormShroudSkill`, `Scourge.SadisticSearingActivation`.
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
- **Thief:** `Thief.ShadowReturn`.
- **Warrior:** `Warrior.MendingMight`, `Bladesworn.FlowStabilizer`.

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
encounter-start handling against EI; do not replace it with a blanket "first player hit" rule.

## Import warning

Show this once for each successful EVTC or dps.report import, including report JSON and report URLs:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Use the existing returned `warnings` list and import-dialog rendering. This is informational and must not require
acknowledgment or block importing. Do not run a new completeness detector just to decide whether to show it.

Keep actionable warnings for unsupported skills, malformed/incomplete evidence, and other independent problems. Avoid
duplicating the generic opener warning across application and adapter layers. Native saved-rotation imports do not
receive this notice.

Application entry points are `js/games/gw2/app/import-export/logs/evtc-rotation-import.ts`,
`dps-report-rotation-import.ts`, and `rotation-import-dialog.ts`.

## Axe Deadeye preset investigation: 20260731-110141

The supplied `thief-build.json` and `thief-rotation (1).json` form the first Deadeye manifest preset, Power (Axe /
Pistol + Dagger / Pistol). The saved rotation restores six Shadow Swap activations observed in EVTC damage events but
absent from both the supplied rotation and EI's cast list. Their placement uses damage timestamps relative to each
Shadow Flare, rounded to the simulator's 40 ms input grid. This is a correction to the saved preset, not an additional
inference rule for fresh imports.

The [report](https://dps.report/zels-20260731-110141_golem) records 4,003,922 damage over 90.773 seconds, or 44,109 DPS.
The original supplied setup simulated at 40,825 DPS. Two confirmed discrepancies explain most of that difference:

- Eight stolen skills used the competitive 0.5 coefficient instead of the PvE 1.0 coefficient. Steal Time already used
  1.0. The
  [official skill API](https://api.guildwars2.com/v2/skills?ids=39960,40133,40888,40903,40904,42863,43373,43768,44526)
  includes both mode values; One in the Chamber separately multiplies the PvE coefficient by 1.25. Correcting the base
  coefficients raises the simulation to 42,785 DPS.
- Restoring the six Shadow Swaps raises it to 43,683 DPS, with 3,978,640 damage over 91.080 seconds and no simulation
  warnings. The remaining gap is 426 DPS (0.97%): 25,282 less damage and a 0.307-second longer observation window.

The axe-return discrepancy remains unresolved. Relative to combat start, the second Orchestrated Assault starts at 3.116
seconds, followed by a Malicious Cunning Salvo hit at 3.640, three Volley hits at 4.039, and three more at 4.083. The
outgoing Salvo already hit at 2.957. The next Volley starts at 3.957; the two three-hit groups arrive before its normal
outgoing hit timing. This supports seven return hits, but does not prove seven simultaneously stored axes. The axe
counter shows six stacks.

A diagnostic allowing six ordinary axes plus one Salvo produces all 63 observed Volley returns and 44,176 DPS. Matching
aggregate damage does not establish that storage rule. At the user's request, the implementation retains six axes total
across all types; the diagnostic rule is not shipped. The preset remains marked `upToDate: false` while the return
behavior and remaining timing gap need reconciliation. Do not change the cap or tune coefficients merely to match this
benchmark.

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
