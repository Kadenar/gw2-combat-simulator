# Mesmer

Native shared-engine profession. Entry point `mesmer.html`. Core owns the shared shatter/phantasm/clone machinery,
weapons, and traits; each specialization owns a vertical slice under `specializations/<name>/` and only the selected
elite (Chronomancer, Mirage, Virtuoso, or Troubadour) is present in a given runtime.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API for skill IDs, descriptions, icons, specialization membership, and
  traits).
- Refresh: `npm run update:mesmer-data`, which regenerates the metadata-only `data/mesmer-api-metadata.ts`.
- PvE coefficients, activation times, cooldowns, strike counts, and condition durations come from the Wiki, with
  supplied benchmark logs taking precedence for the rows they cover. Simulation-affecting fields live in owner-local
  Core and specialization `skills.ts` and `mechanics.ts` files. Runtime simulation is network-free.

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
- All 108 traits have a validated coverage disposition.

## Modeling boundaries

Single-target, outgoing-damage focused. Phantasm and clone travel time is fixed delays; expected critical-condition
applications replace random trials (Bloodsong converts expected bleeding into deterministic blades at each five-stack
threshold). Ally healing, barriers, control damage, stealth, and defensive effects stay outside the damage total;
boon/distortion applications are still emitted. Full endurance is not simulated (only Mirage/Troubadour dodge charges).
Competitive (PvP/WvW) splits are out of model.
