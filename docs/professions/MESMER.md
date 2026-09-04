# Mesmer

Native shared-engine profession. Entry point `mesmer.html`. `definition.ts` composes the Core-first tuple from
`modules.ts`; a runtime contains Core plus at most one of Chronomancer, Mirage, Virtuoso, or Troubadour. Core owns the
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

## Implemented systems

- **Core** — weapon sets with a ten-second in-combat swap recharge (none out of combat), clone/phantasm/shatter
  mechanics, ID-keyed phantasm timing, and profession-specific resolver reactions such as Ineptitude and Bloodsong.
- **Chronomancer** — Continuum Split (restores cooldown state but not clones) and its shatter/alacrity behavior.
- **Mirage** — Mirage Cloak dodge charges and ambush attacks.
- **Virtuoso** — bladesongs that require and spend all stocked blades.
- **Troubadour** — instruments resource, Crescendo, Dagger, and its dodge/ ambush interactions.

## Modeling boundaries

Single-target, outgoing-damage focused. Phantasm and clone travel time is fixed delays; expected critical-condition
applications replace random trials (Bloodsong converts expected bleeding into deterministic blades at each five-stack
threshold). Ally healing, barriers, control damage, stealth, and defensive effects stay outside the damage total;
boon/distortion applications are still emitted. Full endurance is not simulated (only Mirage/Troubadour dodge charges).
Competitive (PvP/WvW) splits are out of model.
