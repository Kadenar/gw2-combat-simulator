# Ranger

Native shared-engine profession. Entry point `ranger.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Druid, Soulbeast, Untamed, or Galeshot. Core owns pets, pet
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

## Trait ownership

Core defines traits in five `traits/<line>/index.ts` files; its `traits/index.ts` registers them in their original
order. Each elite owns its definitions and registration array in `traits/index.ts`: 46 Core, 5 Druid, 8 Soulbeast, 7
Untamed, and 8 Galeshot definitions. Owners contain trait balance profiles, modifiers, triggers, recharge rules, and
build contributions. Runtime callers import named Core trait helpers for opening strikes, Beast skills, movement,
critical procs, poison, attributes, and companion attributes inside their owning trait-line folders. Small helpers such
as Lingering Magic's companion Concentration stay in the line's `index.ts`. Elite trait helpers remain beside their
definitions. Pet identity and attribute snapshots live separately from scheduling in `core/mechanics/pet-attributes.ts`;
the signet passive query does not load slot-skill execution. Soulbeast hooks and modifiers assemble merged-pet
contributions before manifest registration. Ordered mechanic trigger points deliver completion and swap boundaries to
definition-local handlers. Profile consumers use `RANGER_TRAIT_IDS` directly; module `profiles.ts` files retain only
skill and mechanic packages. Build calculators compose `rangerProfession.traitBuildAttributes` alongside skill passives
and Soulbeast archetype attributes.

Commanded pet recharge captures the accepting companion's incarnation and retains it through shared cooldown projection.
Received Alacrity is integrated only from that companion's grants and extensions, ending at retirement while preserving
earlier recharge work. Pet swaps keep existing cooldowns; replacement and returning incarnations cannot apply their
boons to a previous incarnation's recharge.

The following execution boundaries remain explicit to preserve ordering and actor ownership:

- Core damage dispatch interleaves trait procs with weapon charges. Pet packet creation applies trait inheritance before
  snapshotting independent pet attributes. Quick Draw recharge reads its window before cast acceptance consumes it; pet,
  weapon, dodge, and Beast-skill reactions retain their existing dispatch order.
- Druid mechanics own Avatar transitions and Astral Force. They call Natural Balance before swap observers and call
  Avatar effect transformations before interruption filtering. Natural Mender owns its initialization and recurring
  task, including recovery after Avatar expiration.
- Soulbeast mechanics own merge state, archetype reconciliation, stance scheduling, and first Beast-ability-hit
  tracking. Core Beastmastery owners supply merged attribute/proc helpers. Bestial Rage remains at the Soulbeast control
  boundary after Twice as Vicious; the merged Loud Whistle and Lesser Sic 'Em modifiers remain installed at Soulbeast's
  modifier boundary. Applied buff rules do not gain a new selection gate.
- Untamed mechanics own unleash and ambush windows. Let Loose owns swap eligibility and its independent proc interval,
  then calls the mechanical ambush grant. Untamed owns Natural Fortitude's definition and runtime attribute callback.
  The `modifyNaturalFortitudeAttributes` helper adds its selected Vitality bonus to baseline stats while preserving
  precomputed build stats without double counting. Its owner also supplies the unconditional ambush life-steal packets,
  while skill declarations retain their first-hit timing and patch identity.
- Galeshot mechanics own arrows, Wind Force, Cyclone Bow, and Mistral. Trait owners handle Shrike projectile counting,
  Wuthering Wind pet charges, control refunds, bow completion rewards, and Perilous Skies availability. Cloudburst's
  authored reset remains in the triggering skill's commit-side-effect phase.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally healing/barrier/cleanse, pathing,
secondary targets, and competitive (PvP/WvW) splits are out of model.
