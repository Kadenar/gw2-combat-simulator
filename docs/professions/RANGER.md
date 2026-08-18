# Ranger

Native shared-engine profession. Entry point `ranger.html`. `family.ts`
composes Core with exactly one of Druid, Soulbeast, Untamed, or Galeshot. Core
owns pets, pet swapping/commands, weapon state, Hammer variants, shared traits,
and profession resources; each specialization owns its skills, state, rules,
resolver reactions, and UI under `specializations/<name>/`. Only the active
elite is assembled into a given runtime.

## Data

- API identity snapshot: 2026-08-08 (official GW2 API) for skill IDs and
  presentation metadata. Pet identity lives in `data/ranger-pet-data.ts` and
  API-omitted actions in `data/ranger-supplemental-skills.ts`.
- Refresh: `npm run update:ranger-data` (changes generated identity/presentation
  metadata only).
- Authoritative combat fields live in owner-local `skills.ts` fragments; the
  root `mechanics/skill-mechanics.ts` is an inert application-catalog aggregate.

## Implemented systems

- **Core** — active and alternate pets, autonomous pet attacks, Beast commands,
  pet Alacrity, pet swaps, pet traits, two weapon sets, shared gear/resolver
  rules.
- **Druid** — Astral Force, Celestial Avatar entry/drain/exit, glyphs, and
  damage-relevant Avatar traits.
- **Soulbeast** — merge state, Beast skills, pet-family bonuses, and stance /
  damage modifiers.
- **Untamed** — player/pet unleash state, Hammer variants, ambush windows, and
  specialization traits.
- **Galeshot** — Cyclone Bow, rechargeable arrows, Wind Force, bow transitions,
  and its pet interactions.
- All catalog traits have a validated coverage disposition.

`Builds/ranger/manifest.json` and `Rotations/ranger/` hold the supported build
and rotation corpus.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally
healing/barrier/cleanse, pathing, secondary targets, and competitive (PvP/WvW)
splits are out of model.
