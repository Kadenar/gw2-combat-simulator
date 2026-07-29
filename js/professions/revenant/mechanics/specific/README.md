# Revenant specific mechanics

This directory owns Revenant behavior that cannot be represented by the shared
declarative effect schema alone. The surrounding modules have distinct roles:

- `../skill-mechanics.js` declares direct, unconditional cast packets and
  skill-level costs, timing, recharge, legend, and availability metadata.
- `../handler-mechanics.js` stores immutable formulas and profiles for
  triggered effects and state machines.
- This directory mutates profession state, emits derived events, schedules
  typed tasks, and exposes callbacks used by `../contract.js` or `handlers.js`.

## Module map

| File | Responsibility | Main state/events/tasks |
| --- | --- | --- |
| `assassin-renegade.js` | Assassin and Renegade active mechanics: Enchanted Daggers, Kalla's Fervor, Citadel Orders, allied Razorclaw procs, and Band Together enhancement. | Owns `enchantedDaggers`, `kallasFervor`, `razorclawsRage`, and Band Together readiness/expiry. Dynamically replaces enhanced Icerazor packets so scheduler observers see their final timestamps. |
| `conduit.js` | Conduit affinity, Entity-legend skills, Release Potential variants, Cosmic Wisdom, Numinous Gift, and Shared Wisdom additions. | Owns `affinity`, `cosmicWisdomUntil`, `conduitForm`, and Beguiling Haze follow-up state. Handles `revenant.affinity-hit` tasks and emits damage, conditions, control, boons, and state snapshots. |
| `core.js` | Feature-map adapter for actions shared by all Revenants. | Exposes weapon swap, legend swap, and dodge callbacks to the central skill-handler registry. |
| `dodge.js` | Endurance payment and selected dodge replacement damage. | Spends normal or Vindicator endurance and emits the configured delayed dodge strike plus a state snapshot. |
| `energy.js` | Continuous Energy/endurance advancement and cast-time Energy spending. | Applies upkeep drain, out-of-combat Energy capping, starvation cancellation/cooldowns, Cosmic Wisdom expiry, and Conduit affinity from Energy costs. |
| `handlers.js` | The only catalog-facing skill-handler registry. | Wraps feature callbacks in explicit `augment` or `replace` strategies and selects the runtime replacement mode for enhanced Icerazor. |
| `legend.js` | Legend-swap state transition. | Changes the active legend/loadout, resets Energy and active upkeeps/flips, triggers swap sigils and invocation traits, and applies Conduit swap interactions. |
| `legend-traits.js` | Effects that fire specifically when invoking a legend. | Materializes Spirit Boon, Song of the Mists, Invoking Torment, Diabolic Inferno, and Renegade fervor effects. |
| `shared.js` | Small cross-feature primitives. | Performs weapon-set swaps and emits `revenant.state` snapshots for the resolver handoff. |
| `traits.js` | Scheduler-side trait lifecycle and reactions to newly scheduled events. | Initializes trait state; changes cast/recharge duration; grants/consumes Battle Scars and Kalla's Fervor; handles critical, boon, condition, control, dagger, Razorclaw, and Mistfire procs. |
| `upkeep.js` | Upkeep activation, release, facet consumption, and pulse execution. | Owns `activeUpkeeps` and facet flips; handles `revenant.upkeep-pulse`; materializes facet boons, Demon/Dwarf/Renegade pulses, allied Soulcleave procs, and Conduit upkeep affinity. |
| `weapon-state.js` | Weapon-chain and temporary weapon-skill state. | Advances/reset autoattack chains, owns the Imperial Guard/True Strike flip, and handles `revenant.imperial-guard-expire`. |

## Lifecycle wiring

`../contract.js` connects the modules to the shared scheduler:

- Initialization and scheduled-event observation use `traits.js`.
- Time advancement and cast-start Energy payment use `energy.js`.
- Cast start/completion and after-cast weapon state use `weapon-state.js`.
- Typed tasks dispatch to `upkeep.js`, `conduit.js`, and `weapon-state.js`.
- Catalog skills resolve handler IDs through `handlers.js`.

Skill handlers use three phases:

1. `beforeEffects` prepares state or fully emits a replacement profile.
2. `afterEffect` observes or adjusts each declarative event.
3. `afterEffects` commits state after the declarative packet list.

An augmenting handler leaves declarative effects enabled. A replacing handler
owns the complete packet profile, so its skill normally declares an empty
`effects` list. Enhanced Icerazor is the deliberate runtime exception: its base
cast augments declarative effects, while Band Together selects replacement mode
and emits the accelerated packet train before scheduler observers run.

## State handoff

Scheduler state is mutable and lives at `context.state.profession`.
`emitRevenantState()` snapshots it into a `revenant.state` event whenever a
change must be visible to the resolver timeline. The resolver replays those
snapshots while preserving resolver-owned trait internal cooldowns.

When adding mechanics:

- Put direct cast packets in `skill-mechanics.js`.
- Put triggered formulas and immutable profiles in `handler-mechanics.js`.
- Keep runtime branching in the owning feature module here.
- Register raw feature callbacks in a feature handler map, then assign their
  augment/replace strategy in `handlers.js`.
- Use namespaced, serializable typed tasks for delayed state work.
- Emit a state snapshot after externally observable profession-state changes.
- Preserve actor ownership (`player`, `summon`, or `effect`) so traits, sigils,
  relics, and result attribution trigger correctly.
