# Log import and EI navigation

The log adapters keep source evidence separate from simulator replay conversion. This guide locates the implementation
and its upstream references. Current behavior is determined by the parser, finder declarations, normalization code, and
executable tests.

## Reading path

| Concern                                       | Local owner                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EVTC binary format and recording boundaries   | [parser.ts](../js/games/gw2/integrations/logs/evtc/parser.ts), [recording.ts](../js/games/gw2/integrations/logs/evtc/recording.ts)                                                                |
| Recorded animation pairing                    | [animations.ts](../js/games/gw2/integrations/logs/evtc/rotation/animations.ts)                                                                                                                    |
| Ordinary EI finder declarations               | [ei-rules.ts](../js/games/gw2/integrations/logs/evtc/rotation/ei-rules.ts)                                                                                                                        |
| Shared finder evaluation                      | [ei-inference.ts](../js/games/gw2/integrations/logs/evtc/rotation/ei-inference.ts)                                                                                                                |
| Custom animation and minion evidence          | [ei-custom-casts.ts](../js/games/gw2/integrations/logs/evtc/rotation/ei-custom-casts.ts), [ei-minions.ts](../js/games/gw2/integrations/logs/evtc/rotation/ei-minions.ts)                          |
| EVTC profession-specific evidence             | [rotation/professions/](../js/games/gw2/integrations/logs/evtc/rotation/professions/)                                                                                                             |
| Supplied report rotations and phase filtering | [dps-report/rotation/reconstruct.ts](../js/games/gw2/integrations/logs/dps-report/rotation/reconstruct.ts)                                                                                        |
| Wingman conversion                            | [wingman/normalize.ts](../js/games/gw2/integrations/logs/wingman/normalize.ts)                                                                                                                    |
| Shared identities and represented actions     | [shared/rotation/normalization.ts](../js/games/gw2/integrations/logs/shared/rotation/normalization.ts), [shared profession rules](../js/games/gw2/integrations/logs/shared/rotation/professions/) |
| Replay scheduling                             | [shared/rotation/timeline.ts](../js/games/gw2/integrations/logs/shared/rotation/timeline.ts), [timing.ts](../js/games/gw2/integrations/logs/shared/rotation/timing.ts)                            |

The [glossary](GLOSSARY.md#log-import) distinguishes source actions, normalized actions, and replay commands. Trace
those representations separately when investigating a discrepancy. A reconstructed rotation may need manual opener
repair even when it faithfully converts the available evidence.

## Implemented coverage and remaining limits

Finder coverage is distributed across the ordinary table, custom finders, and profession-specific code. Absence from
`ei-rules.ts` alone does not establish a missing implementation. Each rule's evidence, version gates, offsets, and
duplicate window live with its declaration and evaluator.

For example, missile inference reads `rule.icd` in `ei-inference.ts`; Hurl has its own interval in `ei-rules.ts`. Use
those declarations instead of assuming every missile uses the shared default.

The [EVTC guide](../js/games/gw2/integrations/logs/evtc/README.md) and
[Mesmer evidence notes](../js/games/gw2/integrations/logs/evtc/rotation/professions/mesmer/README.md) provide background
on supported evidence and known gaps. Inspect current code for ownership handling and encounter boundaries before
drawing a parity conclusion. The adapters implement selected EI behavior, not the entire upstream parser.

## Investigating a mismatch

Match the log, player, parser version, time origin, and observation window first. Compare retained source actions before
normalized actions and replay commands. Simulated DPS alone cannot identify a parser mismatch.

Use the [EI maintenance guide](../js/games/gw2/integrations/logs/EI-PARSER-MAINTENANCE.md) for upstream review steps and
the [analysis tools](../scripts/README.md#analysis-tools) for local inspection.
[Log integration tests](../tests/games/gw2/integrations/logs/) exercise parser and reconstruction behavior. Repository
testing requirements remain in [AGENTS.md](../AGENTS.md#testing-policy).

## Pinned EI references

These existing provenance links target EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. They help locate the
upstream behavior behind local comments; they do not certify complete parity or alignment with the latest EI release.
Check the owning rule's provenance when reviewing a change.

- Record and cast decoding: [CombatItem][ei-combat-item], [cast factory][ei-cast-factory],
  [AnimatedCastEvent][ei-animated-cast], [parser helpers][ei-parser-helper].
- Finder dispatch and evidence: [CombatData][ei-combat-data], [InstantCastFinder][ei-instant-finder], [buff
  gains][ei-buff-gain], [Engineer helpers][ei-engineer], [minion spawns][ei-minion-spawn].
- Report export: [actor JSON][ei-json-actor], [actor filtering][ei-actor], [rotation JSON][ei-json-rotation].

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
