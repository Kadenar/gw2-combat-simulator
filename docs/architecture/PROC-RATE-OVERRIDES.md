# Proc rate overrides

The build editor exposes **Proc rate overrides** for selected, supported traits. Enter a percentage from 0 to 100; leave
the field blank or use Reset to inherit the active balance profile. Changes rerun the simulation and invalidate
dependent comparisons. Rates apply to both deterministic accumulation and stochastic rolls; trigger eligibility,
internal cooldowns, effects, and profession-owned accumulator policies are preserved.

For supported condition procs, Analysis displays activations in the Hits column. The primary resolved effect carries
`metadata.procCount`; secondary effects do not repeat it. The count is independent of condition stacks and damage ticks,
and can represent multiple activations batched into one application. Existing strike-hit counts retain their meaning for
attacks.

Build JSON stores optional fractional rates in `assumptions.procRateOverrides`, keyed by stable namespaced proc IDs.
Simulation configuration carries a detached `procRateOverrides` map to workers and headless runs. Zero is explicit;
absence inherits the current or preview balance value. Invalid rates fail validation. Unknown IDs remain saved but have
no effect unless an active proc explicitly consumes them. Imported log observations never set overrides automatically.

## Adding a supported proc

1. Add `procRate: { id, traitId, field, opportunity }` to its profession-owned balance profile. `field` identifies the
   existing chance field, and `opportunity` describes its denominator, such as `eligible critical hit` or
   `eligible explosion hit`.
2. Read its probability through `procChanceFromContext(context, profileId, fallback)`. Use the result in every
   deterministic and stochastic branch while retaining existing eligibility and cooldown logic.
3. Add a minimal trait-contract check covering zero, full probability, and ineligible opportunities. Mark the primary
   condition effect with `metadata.procCount` to expose its activations in Analysis.

The shared UI enumerates the active Core-plus-specialization runtime's profiles and filters by selected trait IDs.
Elite-specific declarations belong in that elite's module; Core declarations automatically work across its elites.
Multiple independently tunable procs from one trait can use separate profiles with distinct proc IDs and the same
`traitId`. Catalog validation rejects duplicate IDs and invalid defaults. The generic UI needs no profession switch.

Initial coverage: Necromancer Barbed Precision, Engineer Serrated Steel and Shrapnel, Warrior Bloodlust, and
Elementalist Burning Precision. Changing a rate approximates an observed proc frequency, not exact logged timestamps.
