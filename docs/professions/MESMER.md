# Mesmer

Native shared-engine profession. Entry point `mesmer.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Chronomancer, Mirage, Virtuoso, or Troubadour. Core owns the
shared shatter, phantasm, clone, weapon, and trait behavior; each specialization owns a vertical slice under
`specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API for skill IDs, descriptions, icons, specialization membership, and
  traits).
- Refresh: `npm run update:profession-data -- --profession Mesmer`, which regenerates the metadata-only
  `data/mesmer-api-metadata.ts`.
- Simulation-affecting coefficients, activation times, cooldowns, strike counts, condition durations, and state machines
  live in owner-local Core and specialization `skills/` and `mechanics/` modules. Runtime simulation is network-free.

## Architecture notes

Ordinary effects use shared declarative scheduling; shatters, bladesongs, instruments, phantasms, ambushes, flips,
resources, and Continuum actions select registered `mesmer.*` handler strategies by stable skill/trait ID. Display names
are labels only — routing, resource causes, flips, trait decisions, and timing all key off IDs, and legacy name
rotations are resolved at the build-migration boundary.

All 66 implemented traits have one native definition: 29 Core, nine Chronomancer, ten Mirage, eight Virtuoso, and ten
Troubadour. Core definitions live in `traits/chaos.ts`, `domination.ts`, `dueling.ts`, and `illusions.ts`; the Core
index collects them in registration order. Each elite owns its definitions and registration array in `traits/index.ts`.
Owners supply profiles, modifiers, build callbacks, triggers, recharge rules, hooks, and imperative decisions. Shared
mechanics retain illusion entities, resources, and packet emission.

Runtime callers import supporting `traits/behavior.ts` functions directly. Core's `traits/dispatch.ts` preserves
post-shatter ordering; Chronomancer retains `traits/time-bomb.ts` for delayed explosions, and Troubadour retains
`traits/performance.ts` and `traits/syncopate.ts` for instrument rewards and delayed waves. Behavior never imports trait
definitions. The Core hook registry directly owns the observable phantasm event markers.

Critical reactions preserve Master Fencer before Sharper Images, then Fencer's Finesse; shatters preserve Maim before
Illusionary Membrane. Master of Fragmentation owns each specialization's pre-emission transformation. Applied stack and
buff windows retain their lifetime without current selection. Chronomancer keeps Continuum restoration in mechanics;
Mirage passes lexical ambush and mirror callbacks to ordered trait helpers. Virtuoso retains Deadly Blades before Jagged
Mind and its existing Bloodsong thresholds. Its modifier collector installs the Dueling-owned extra Phantasmal Fury rule
at the original elite boundary. Troubadour keeps instrument snapshots and player/afterimage emission in mechanics;
owners implement Crescendo, Syncopate, Harmonize, dodge, and note decisions.

Build callbacks consume active patch values. Runtime attributes retain build provenance and the existing per-query
fixed-value cache while reading live stacks. Intrinsic Harmonize and Symphonic Resonance preserve their existing
selection-independent behavior. Generated identity metadata remains in `data/`. See the
[S5 migration record](../architecture/TRAIT-DEFINITIONS-PLAN.md#s5-progress-mesmer).

## Implemented systems

- **Core** — weapon sets with a ten-second in-combat swap recharge (none out of combat), clone/phantasm/shatter
  mechanics, ID-keyed phantasm timing, and profession-specific resolver reactions such as Ineptitude.
- **Chronomancer** — Continuum Split (restores cooldown state but not clones) and its shatter/alacrity behavior.
- **Mirage** — a continuous endurance pool, Mirage Cloak dodges, and ambush attacks.
- **Virtuoso** — bladesongs that require and spend all stocked blades, Jagged Mind bleeding, and Bloodsong blade gains.
- **Troubadour** — instruments resource, Crescendo, Dagger, and its dodge/ ambush interactions.

## Modeling boundaries

Single-target, outgoing-damage focused. Phantasm and clone travel time uses fixed delays. Critical-condition
applications consume the shared seeded critical-hit facts in both simulation modes. Bloodsong grants blades at each
five-stack bleeding-application threshold. Ally healing, barriers, control damage, stealth, and defensive effects stay
outside the damage total; boon/distortion applications are still emitted. Mirage and Troubadour use the shared 100-point
endurance pool, 50-point dodges, and continuous regeneration at 5/sec or 7.5/sec with Vigor. Troubadour's Flute adds
1.25 endurance/sec while playing, including when Vigor is active; Honorable Rogue restores 50 endurance without losing
partial regeneration. Competitive (PvP/WvW) splits are out of model.
