# Ranger implementation

Ranger is a native shared-engine profession. `family.ts` composes Core with
exactly one of Druid, Soulbeast, Untamed, or Galeshot, while
`app/app-definition.ts` supplies the shared browser-shell adapter.

## Runtime architecture

Core owns pets, pet swapping and commands, ordinary weapon state, Hammer
variants, shared traits, and profession resources. Each elite specialization
owns its skill mechanics, state, rules, resolver reactions, and UI under
`specializations/<elite>/`. Runtime assembly includes Core plus only the active
elite; the root catalog retains the complete build-editor view.

Skill IDs and presentation metadata come from the checked-in Guild Wars 2 API
snapshot. Pet identity lives in `data/ranger-pet-data.ts`, API-omitted actions
live in `data/ranger-supplemental-skills.ts`, and authoritative combat fields
live in owner-local `skills.ts` fragments. The root
`mechanics/skill-mechanics.ts` file is an inert application-catalog aggregate.

## Implemented systems

- Active and alternate pets, autonomous pet attacks, Beast commands, pet
  Alacrity, pet swaps, and modeled pet traits.
- Druid Astral Force, Celestial Avatar entry, drain, exit, glyph behavior, and
  damage-relevant Avatar traits.
- Soulbeast merge state, Beast skills, pet-family bonuses, and stance and
  damage modifiers.
- Untamed player/pet unleash state, Hammer variants, ambush windows, and
  specialization traits.
- Galeshot Cyclone Bow, rechargeable arrows, Wind Force, bow transitions, and
  the specialization's pet interactions.
- Canonical versioned builds, two weapon sets, shared gear and resolver rules,
  and validated coverage for all catalog traits.

## Presets and data refresh

`Builds/ranger/manifest.json` and `Rotations/ranger/` contain the supported
build and rotation corpus. Refresh the API identity snapshot with:

```powershell
npm run update:ranger-data
```

The refresh changes generated identity and presentation metadata only. Review
combat coefficients, timings, packets, and state rules in their owning Core or
specialization modules.
