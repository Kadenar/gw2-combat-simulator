# Boss scenarios

The **Bosses** workspace runs a continuous build rotation through a supported encounter's damage phases and downtime. It
uses the same combat engine as **Golem**, with encounter-specific target health, armor, hitbox size, and phase rules.

## Set up a scenario

1. Load the build and rotation you want in **Golem**, then select **Bosses**. On the first visit, a scenario is created
   from the active Golem build; later visits restore the selected scenario.
2. Choose **Boss** and, when available, **Difficulty**. The encounter supplies its phase sequence and health gates.
3. Enter **Group DPS (excludes you)** for each damage phase. For phases with several targets, set each target's group
   DPS and select the player's target where offered. The simulator adds your damage separately.
4. Set **Split after phase** durations and any **After split** intermissions, in seconds. A blank split duration means
   zero. Adjust timed damage windows where the encounter offers them.
5. Edit the scenario's build and rotation, then open **Analysis** to inspect its damage and phase results.

The scenario owns a separate copy of the build and rotation, patch selection, and simulation settings. Editing it does
not overwrite the Golem workspace. The scenario picker offers **New**, which copies the active Golem build, and
**Duplicate**, which copies the selected scenario.

## Understand phases and downtime

Health-gated phases end when their required targets reach the authored thresholds. Other phases use timed damage
windows; encounters with repeating mechanic cycles repeat their authored sequence. Group DPS advances target health but
does not count toward your player damage.

During a **split**, boss damage is blocked but rotation commands continue, allowing preparation actions. During an
**intermission**, boss damage is blocked and the rotation waits until the intermission ends. Cooldowns, resources, and
effect lifetimes continue on the same simulation clock across phase boundaries.

Review the phase damage and DPS in Analysis alongside overall encounter DPS, which includes downtime. A rotation can end
before the encounter is defeated; an in-progress phase is not a completed fight. Extend the rotation or add waits when
you need to observe later phases.

The selected encounter controls target properties. Boss scenarios use four allied players for subgroup effects and
disable automatic sharing of player boons with summons; explicit pet boons from skills and traits still apply. Player
health remains fixed at 100%.

## Save and share

Scenarios are stored locally in the browser. While editing a boss scenario, **Export** downloads the complete scenario,
including its build, rotation, encounter inputs, patch, and simulation settings. **Import** restores a scenario for the
active profession. Export before clearing browser data or moving to another device.

These scenarios model the authored damage opportunities and target transitions. They do not reproduce incoming attacks,
movement, general cleave, or every encounter mechanic. See [Accuracy and scope](Accuracy-and-Scope).
