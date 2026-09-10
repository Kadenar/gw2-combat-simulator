# Keeping log imports aligned with Elite Insights

Use this guide when an Elite Insights (EI) release, ArcDPS encoding change, game patch, or reported import mismatch
requires reviewing our parser. It continues the [log-import alignment work](../../../../../docs/LOG-IMPORT-EI-ALIGNMENT.md);
that document records the cleanup and its original validation, while this guide describes ongoing maintenance.

## Baseline and scope

The current reference is EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a` in
[GW2-Elite-Insights-Parser](https://github.com/baaron4/GW2-Elite-Insights-Parser). This is a source behavior baseline,
not a claim of complete parity or the latest upstream version. The pinned links below come from the alignment document.

- Raw EVTC imports decode recorded casts and apply supported, explicit EI finders with their actual evidence checks.
- dps.report imports use the selected player's supplied rotation and selected phase, including EI-inferred casts.
  Older reports remain authoritative for their own contents; updating our EVTC rules does not authorize adding rows to them.
- Shared normalization maps represented actions into simulator inputs. Keep `sourceActions`, normalized `actions`,
  and replay commands distinct so a replay change cannot silently rewrite evidence.
- Missing setup stays missing. Initial buffs, existing minions, later skills, damage totals, and simulation requirements
  do not justify inventing casts. Preserve the single opener notice and independent actionable warnings.

Known gaps include extension healing/barrier, missile and unported custom checker families, Mechanist Crash Down's
position/impact checker, time-aware ownership and reused instance IDs, and EI encounter-specific boundaries. Some custom
finders have separate implementations even when excluded from the ordinary table. Consult the
[coverage inventory](../../../../../docs/LOG-IMPORT-EI-ALIGNMENT.md#implemented-coverage-and-remaining-limits) and
[EVTC README](evtc/README.md) before treating a difference as a regression.

## Review an upstream update

1. **Choose an exact candidate commit.** Record the old and candidate full SHAs and any release tag. Review the upstream
   diff between them, including renamed files; release notes alone cannot establish parser compatibility. A release
   without relevant changes needs only a recorded review, not a parser edit.
2. **Keep three versions separate.** The EI commit identifies the reference implementation; the ArcDPS/EVTC build selects
   event encoding; the GW2 build selects game-era rules. Locally, `minBuild`/`maxBuild` gate GW2 builds and
   `minEvtcBuild`/`maxEvtcBuild` gate ArcDPS builds. Their ranges are half-open: minimum inclusive, maximum exclusive.
   Do not use today's date, the report upload date, or the EI release number as an event-format gate.
3. **Trace the changed upstream behavior to its local owner.** Review shared finder implementations as well as profession
   declarations and identifier/build constants. One shared finder change can affect many professions without changing
   their declarations. Follow each changed local helper's callers before editing it.
4. **Classify each relevant change.** Record it as implemented, unaffected with a reason, or deferred with an explicit
   coverage limitation. Review additions, modifications, and removals; merely appending new skill IDs misses changed
   predicates and obsolete rules. Preserve older log behavior through the applicable build gates.
5. **Port complete conditions.** Carry over evidence IDs/GUIDs and namespaces, actor/owner selection, specialization and
   build gates, initial/extension exclusions, secondary checks, effect-availability gates, offsets, duplicate windows,
   and origin/accuracy metadata. If a checker is unsupported, document the omission instead of approximating it from
   damage or the simulator catalog. Add a short functional comment naming the EI method and why the local logic exists.
6. **Validate before advancing the pin.** Update the baseline, affected source provenance comments, adapter documentation,
   and coverage inventory together after reviewing the candidate. Keep old/new SHAs and remaining gaps in the change
   description. For a partial port, record the affected rule's candidate SHA and retain an explicit mixed-version scope;
   do not relabel every rule as aligned with the candidate.

To inspect an upstream checkout, run these commands there, replacing `CANDIDATE_SHA` with the reviewed full SHA:

```powershell
git diff --name-status d7f186c8579a5cab4ed362f0703e49e4a81b9a2a CANDIDATE_SHA
git diff d7f186c8579a5cab4ed362f0703e49e4a81b9a2a CANDIDATE_SHA -- path/to/changed/upstream/file
```

After a baseline update, use the newly recorded baseline as the next diff's starting point. Search this repository for
both full and abbreviated old SHAs when updating provenance; preserve explicitly historical references.

## Where changes belong

Paths below are relative to this directory. Use the pinned references to locate upstream symbols even if they move in
the candidate commit.

| Upstream area to inspect | Local owner and review focus |
| --- | --- |
| `CombatItem`, event factory, ArcDPS build/state constants | `evtc/parser.ts`, `evtc/types.ts`, `evtc/recording.ts`: field decoding, timed records, recording boundaries, encoding selection, and input validation. |
| `AnimatedCastEvent`, `CreateCastEvents`, parser timing constants | `evtc/rotation/animations.ts`: pairing within actor/skill, unmatched stops, missing ends, unknown casts, status, duration, and acceleration metadata. |
| `InstantCastFinder` and concrete finder classes | `evtc/rotation/ei-inference.ts`: shared evidence semantics, ownership, build ranges, offsets, and duplicate suppression. |
| Profession helpers and their skill, effect, minion, and build constants | `evtc/rotation/ei-rules.ts`: explicit ordinary declarations; review numeric IDs and GUIDs alongside conditions. |
| Custom animated finders, Engineer kits, spawn and shatter helpers | `evtc/rotation/ei-custom-casts.ts`, `ei-minions.ts`, and `professions/index.ts`: inspect separate custom paths rather than forcing them into the ordinary table. These filenames are under `evtc/rotation/`. |
| Effect encoding, agent lifecycle, encounter boundaries | `evtc/rotation/effect-packets.ts`, `ei-inference.ts`, `players.ts`, `encounter.ts`, and `reconstruct.ts`: audit assumptions and document unsupported encounter/ownership behavior. These filenames are under `evtc/rotation/`. |
| JSON actor/rotation builders and actor window filtering | `dps-report/parser.ts`, `types.ts`, and `rotation/reconstruct.ts`: schema validation, units, selected player/phase, crossing casts, accuracy, and stable timestamp ties. These filenames are under `dps-report/`. |
| Cast identity and origin classification | `lib/rotation/catalog.ts`, `normalization.ts`, and `professions/`: aliases, represented composites, and proc filtering; never missing-input recovery. These filenames are under `lib/rotation/`. |
| Simulator command conversion | `lib/rotation/timeline.ts` and `timing.ts`: inspect only after source evidence agrees; catalog timing and cancellation quantization are separate from EI parsing. Both files are under `lib/rotation/`. |

## Compare evidence before replay

Use the same raw log with the exact reference EI version and our adapter. Record the input identity, EI SHA/version,
ArcDPS build, GW2 build, selected player, EI parser/export settings, and observation window. Keep the generated JSON with
the comparison evidence; a public report may have been generated by a different EI version.

First compare `sourceActions`, including skill identity, start, duration, status, origin/accuracy and rule provenance
where available. Align recording, combat, report/phase, and replay origins explicitly; a common offset does not permit
moving individual casts. Only then inspect normalized actions and commands. Simulated DPS is not a parser parity test.

For an absent, extra, or shifted cast, check in order:

1. Whether both comparisons include the same source interval. EI JSON export can omit a cast that ended before its
   window even when later damage survives. Crossing casts retain their source start and duration.
2. Whether the appropriate encoding and build-gated finder applies, including required evidence and ownership checks.
3. Whether our documented coverage excludes that finder or encounter behavior.
4. Whether identity mapping, automatic-proc filtering, or represented-composite normalization explains the difference.
5. Whether only replay encoding differs. Do not change engine resources, cooldowns, timings, or saved presets to hide
   a parser mismatch. Exact timestamp ties in report JSON preserve traversal order; original cross-skill order is unavailable.

Existing CLI tools expose source and normalized actions with `--timeline`. Run from the repository root, substituting
the input and player values:

```powershell
npm run build:modules
node scripts/analysis/reconstruct-evtc-rotation.mjs "path/to/fight.zevtc" --player=0x1234 --timeline
node scripts/analysis/reconstruct-dps-report-rotation.mjs "https://dps.report/REPORT_ID" --player=0 --phase=0 --timeline
```

The report CLI fetches a public report; it does not run a pinned EI build or select its version. Use the report JSON import
path for locally generated reference JSON. Match player identity across adapters rather than equating their selectors.

## Validation and completion

Add small synthetic cases for changed parser contracts using the existing test helpers. Useful checks include actor/skill
pairing, stop-only encoding selection, recording/window boundaries, initial versus ordinary buff evidence, ownership,
event ordering, duplicate suppression, and both sides of a changed build boundary. Exercise affected shared callers and
include older supported encoding behavior where relevant.

Follow [repository testing policy](../../../../../AGENTS.md): no tests specifically for Quickness cast times or
`interruptCommitMs`, saved-rotation shape/order, aggregate per-skill casts/hits/damage, exact benchmark DPS, or whole-result
snapshots. Minimal exact parser-contract assertions are appropriate. Saved-preset numerical checks may compare only
total DPS with at most 1% relative error. Identify and fix or explicitly scope preset warnings; do not silence them.

Run focused tests from the repository root after compiling the modules:

```powershell
npm run build:modules
node --test tests/evtc tests/dps-report tests/log-analyzer
npm run typecheck
```

For implementation changes, complete the repository checks with `npm run check`, including import UI coverage. Before
completion, format only touched Prettier-supported files with `npx prettier --write <touched-files>`; do not run a
repository-wide write. For documentation-only updates, check formatting and links without rerunning simulation tests.

The change description should record:

- Baseline and candidate EI SHAs, changed upstream methods, and affected local owners.
- Implemented changes, intentionally unchanged behavior, deferred coverage, and preserved build compatibility.
- Focused checks and diagnostic comparisons performed, their versions/windows, and any unresolved differences.
- Updated pinned references and coverage notes. Historical test counts in the alignment document are not current validation.

## Pinned EI references

All links below target `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. When advancing the baseline, verify each path and method
against the candidate; do not just replace the SHA in URLs. Use method names to navigate when line numbers move.

- [CombatItem][ei-combat-item]: record interpretation and timed-event classification.
- [CombatEventFactory / CreateCastEvents][ei-cast-factory]: animation dispatch and cast construction.
- [AnimatedCastEvent][ei-animated-cast]: incomplete casts, durations, statuses, and acceleration.
- [ParserHelper][ei-parser-helper]: shared parser constants, including server delay.
- [CombatData / EICastParse][ei-combat-data]: orchestration of ordinary and custom finders.
- [InstantCastFinder][ei-instant-finder]: shared finder conditions and metadata.
- [BuffGainCastFinder][ei-buff-gain]: ordinary buff application evidence and initial-application exclusion.
- [EngineerHelper][ei-engineer]: kit identification and profession-specific evidence.
- [MinionSpawnCastFinder][ei-minion-spawn]: actual spawn evidence and summon attribution.
- [JsonActorBuilder][ei-json-actor]: actor rotation export.
- [Actor][ei-actor]: cast intersection filtering for observation windows.
- [JsonRotationBuilder][ei-json-rotation]: serialized rotation fields and timing.

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
