# Ranger

This profession uses the shared engine. Its browser entry point is `ranger.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Druid, Soulbeast, Untamed, or Galeshot. Core owns pets, pet
swapping and commands, weapon state, Hammer variants, shared traits, and profession resources. Each specialization owns
its data, state, mechanics, and UI under `specializations/<name>/`.

## Lifetime rules

- Pending impacts only provide Astral Force retry boundaries; landed hits grant the force. Stale depletion work cannot
  retire a newer Celestial Avatar lifetime.
- Dismissing Cyclone Bow preserves already scheduled Wind Force gains.

## Data

- Maintained skill and trait constants live in `data/ids.ts`.
- Core and specialization `skills/` entries define names, descriptions, icons, selection metadata, costs, recharge, and effects. Edit these definitions directly without scraping skills or regenerating metadata.
- `data/trait-lines.ts` retains specialization and trait presentation. `createNativeModuleData` materializes the
  complete declarations contributed by each module.
- Pet identities and membership remain in `data/ranger-pet-data.ts`. Every pet skill uses `definePetSkill` for shared
  execution and actor recharge rules.

## Implemented systems

- Core implements active and alternate pets, autonomous pet attacks, Beast commands, pet Alacrity, pet swaps, pet traits, two
  weapon sets, shared gear and resolver rules.
- Druid implements Astral Force, Celestial Avatar entry/drain/exit, glyphs, and damage-relevant Avatar traits.
- Soulbeast implements merge state, Beast skills, pet-family bonuses, and stance and damage modifiers.
- Untamed implements player/pet unleash state, Hammer variants, ambush windows, and specialization traits.
- Galeshot implements Cyclone Bow, rechargeable arrows, Wind Force, bow transitions, and its pet interactions.

`data/gw2/builds/ranger/manifest.json` and `data/gw2/rotations/ranger/` hold the supported build and rotation corpus.

## Trait ownership

Core trait definitions live in `core/traits/<line>/index.ts`; each elite registers definitions in `traits/index.ts`.
Definitions own profiles, modifiers, triggers, recharge rules, and build contributions; supporting helpers remain beside
them. Mechanics own ordered dispatch and companion scheduling. `core/mechanics/pet-attributes.ts` separates pet identity
and attribute snapshots from scheduling.

Build and live queries share `rangerProfession.attributeContributions`, combining selected traits, module-owned skill
passives, and Soulbeast archetype attributes from equipment seeds. Pet queries use the appropriate captured or live
attributes. Skirmishing owns Trapper's Expertise and Light on your Feet's base-duration rules; the intrinsic shortbow
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

The simulation models outgoing damage against one target. Player health stays at 100%; target health remains modeled. Incoming attacks,
active defense, ally healing, barrier, and cleansing, pathing, secondary targets, and competitive PvP and WvW balance splits are outside the model.
