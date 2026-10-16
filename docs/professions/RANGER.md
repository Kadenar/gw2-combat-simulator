# Ranger

Native shared-engine profession. Entry point `ranger.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Druid, Soulbeast, Untamed, or Galeshot. Core owns pets, pet
swapping and commands, weapon state, Hammer variants, shared traits, and profession resources. Each specialization owns
its data, state, mechanics, and UI under `specializations/<name>/`.

## Mechanic ownership

- Soulbeast's `specializations/soulbeast/mechanics/beastmode-effects.ts` owns merge transitions, pet initialization,
  availability, and merged-command completion alongside its hit reactions. The Beastmode skill catalog declares actions;
  hooks add stance grants and preserve the order of shared reactions.
- Druid's `specializations/druid/mechanics/celestial-avatar.ts` owns Avatar entry/release, Astral Force gains and drain,
  retry boundaries, availability, depletion, and the transition trigger. Stale depletion work cannot retire a newer
  Avatar lifetime.
- Untamed's `specializations/untamed/mechanics/unleash-effects.ts` owns unleash transitions, shared recharge, ambush
  grants and consumption, availability, and the ordered strike trigger. Hooks retain pet command routing and execution.
- Galeshot's `specializations/galeshot/mechanics/cyclone-bow.ts` owns bow transitions, arrow and Wind Force policies,
  delayed resource gains, Mistral activation and missile reactions, availability, and mechanic triggers. State creation
  stays independent of active behavior; skill declarations retain their authored action boundaries. Dismissing the bow
  preserves already scheduled Wind Force gains.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance. Pet identity lives in
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

Core trait definitions live in `core/traits/<line>/index.ts`; each elite registers definitions in `traits/index.ts`.
Definitions own profiles, modifiers, triggers, recharge rules, and build contributions; supporting helpers remain beside
them. Mechanics own ordered dispatch and companion scheduling. `core/mechanics/pet-attributes.ts` separates pet identity
and attribute snapshots from scheduling.

Build and live queries share `rangerProfession.attributeContributions`, combining selected traits, module-owned skill
passives, and Soulbeast archetype attributes from equipment seeds. Pet queries use the appropriate captured or live
attributes. Skirmishing owns Trapper's Expertise and Light on Your Feet's base-duration rules; the intrinsic shortbow
extension lives in `core/skills/weapons/shortbow.ts`. Both shortbow extensions add to the base before duration scaling.

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
  boundary after Twice as Vicious. Core Beastmastery definitions own the merged Loud Whistle and Lesser Sic 'Em
  modifiers with Soulbeast eligibility; the elite module registers the skill-owned Sic 'Em command bonus. Applied buff
  rules retain their granted lifetime without a new selection gate.
- Untamed mechanics own unleash and ambush windows. Let Loose owns swap eligibility and its independent proc interval,
  then calls the mechanical ambush grant. Natural Fortitude declares its selected Vitality bonus in its trait
  definition, using the same attribute contribution in build and live queries. Its owner also supplies the unconditional
  ambush life-steal packets, while skill declarations retain their first-hit timing and patch identity.
- Galeshot mechanics own arrows, Wind Force, Cyclone Bow, and Mistral. Trait owners handle Shrike projectile counting,
  Wuthering Wind pet charges, control refunds, bow completion rewards, and Perilous Skies availability. Cloudburst's
  authored reset remains in the triggering skill's commit-side-effect phase.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Incoming attacks,
active defense, ally healing/barrier/cleanse, pathing, secondary targets, and competitive (PvP/WvW) splits are out of
model.
