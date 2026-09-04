# Ranger

Native shared-engine profession. Entry point `ranger.html`. `definition.ts` composes the Core-first tuple from
`modules.ts`; a runtime contains Core plus at most one of Druid, Soulbeast, Untamed, or Galeshot. Core owns pets, pet
swapping and commands, weapon state, Hammer variants, shared traits, and profession resources. Each specialization owns
its data, state, mechanics, and UI under `specializations/<name>/`.

## Data

- API identity snapshot: 2026-08-08 (official GW2 API) for skill IDs and presentation metadata. Pet identity lives in
  `data/ranger-pet-data.ts` and API-omitted actions in `data/ranger-supplemental-skills.ts`.
- Refresh: `npm run update:ranger-data`, which refreshes API metadata and regenerates Ranger IDs and pet data without
  overwriting owner-local mechanics.
- Authoritative checked-in combat fields live in owner-local `skills/` fragments, and the application catalog is
  assembled from those module contributions.

## Implemented systems

- **Core** — active and alternate pets, autonomous pet attacks, Beast commands, pet Alacrity, pet swaps, pet traits, two
  weapon sets, shared gear/resolver rules.
- **Druid** — Astral Force, Celestial Avatar entry/drain/exit, glyphs, and damage-relevant Avatar traits.
- **Soulbeast** — merge state, Beast skills, pet-family bonuses, and stance / damage modifiers.
- **Untamed** — player/pet unleash state, Hammer variants, ambush windows, and specialization traits.
- **Galeshot** — Cyclone Bow, rechargeable arrows, Wind Force, bow transitions, and its pet interactions.

`data/gw2/builds/ranger/manifest.json` and `data/gw2/rotations/ranger/` hold the supported build and rotation corpus.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally healing/barrier/cleanse, pathing,
secondary targets, and competitive (PvP/WvW) splits are out of model.
