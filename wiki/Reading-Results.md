# Reading results

The simulator recalculates after a build or rotation change. Use **Workspace** to edit and **Analysis** to inspect the
result. Analysis follows the active Golem or Bosses workspace; [Boss scenarios](Boss-Scenarios) also provide phase
damage and DPS, with downtime included in overall encounter DPS. To compare saved builds across professions, use
[Benchmarks](Benchmarks).

## Summary

The summary separates player damage into strike and condition damage and reports the observed rotation duration and DPS.
Some modeled effects may also report environment or target damage separately.

Compare DPS only when the builds use the same rotation, target, assumptions, and observation window.

## Damage breakdown

The damage table shows each source's total damage, DPS, casts, hits, and average damage per cast. Select a source to
show its damage events on the timeline.

The condition table reports damage, DPS, and average stacks for each damaging condition.

## DPS and effects over time

The charts show how damage develops across the fight and when tracked boons, conditions, and buffs are active. Hover the
charts for values at a specific time and use the effect toggles to reduce visual noise.

![Analysis walkthrough](https://raw.githubusercontent.com/Kadenar/gw2-combat-simulator/main/images/tutorials/gw2-combat-simulator-analysis.gif)

## Modifier contributions

Modifier contribution rows compare the baseline with a simulation that removes one eligible modifier. Most comparisons
keep the same rotation. Skill comparisons also remove every cast of that skill, including its time cost, active effects,
and resource rewards, so the rotation can change. The rows estimate each modifier's DPS increase in the current setup;
they are not additive because modifiers can interact.

## Randomized DPS range

The normal detailed result is deterministic and reproducible. **Calculate range** runs seeded stochastic trials for
modeled random effects and reports the mean, median, likely range, and lucky or unlucky outcomes.

Keep the build's **Simulation seed** fixed for reproducible A/B comparisons. The detailed result uses midpoint weapon
strength and defaults to averaged critical damage; **Critical damage → Rolled** applies individual critical outcomes.
Stochastic trials sample weapon strength and always use rolled critical damage. Use the range to judge whether random
variation could hide a small difference.

## Inspect damage calculations

In the Event Log, enable **Capture damage calculations** to rerun the baseline with the same seed and expand individual
hits. Capture is session-only and resets on reload. The download changes from **CSV Log** to **Download debug JSON**,
including the matching rotation, config, patch, seed, observation policy, and damage events. The outgoing multiplier is
an aggregate, not a list of individual modifier contributions.

## Relic break-even comparison

When available, choose another relic to compare both relics across different fight durations. The crossover marker shows
when the alternative overtakes the equipped relic under the current build and rotation.

Next: [Accuracy and scope](Accuracy-and-Scope).
