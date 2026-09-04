# Reading results

The simulator recalculates after a build or rotation change. Use **Workspace** to edit and **Analysis** to inspect the
result.

## Summary

The summary separates player damage into strike and condition damage and reports the observed rotation duration and DPS.
Some modeled effects may also report environment or target damage separately.

Compare DPS only when the builds use the same rotation, target, assumptions, and observation window.

## Damage breakdown

The damage table shows each source's total damage, DPS, casts, hits, and average damage per cast. Select a source to show
its damage events on the timeline.

The condition table reports damage, DPS, and average stacks for each damaging condition.

## DPS and effects over time

The charts show how damage develops across the fight and when tracked boons, conditions, and buffs are active. Hover the
charts for values at a specific time and use the effect toggles to reduce visual noise.

![Analysis walkthrough](https://raw.githubusercontent.com/Kadenar/gw2-combat-simulator/main/docs/assets/gw2-combat-simulator-analysis.gif)

## Modifier contributions

Modifier contribution rows rerun the same rotation with one eligible modifier removed. They estimate that modifier's DPS
increase in the current setup; they are not additive because modifiers can interact.

## Randomized DPS range

The normal detailed result is deterministic and reproducible. **Calculate range** runs seeded stochastic trials for
modeled random effects and reports the mean, median, likely range, and lucky or unlucky outcomes.

Use deterministic results for precise A/B comparisons. Use the randomized range to judge how much normal outcome
variation could hide a small difference.

## Relic break-even comparison

When available, choose another relic to compare both relics across different fight durations. The crossover marker shows
when the alternative overtakes the equipped relic under the current build and rotation.

Next: [Accuracy and scope](Accuracy-and-Scope).
