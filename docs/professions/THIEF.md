# Thief

This profession uses the shared engine. Its browser entry point is `thief.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Daredevil, Deadeye, Specter, or Antiquary. Core owns shared
initiative, stealth, weapons, and traits; each specialization defines its data, state, mechanics, and presentation under
`specializations/<name>/`.

## Ordering rules

- Core availability checks closed follow-ups, spear stages, preparations, active follow-ups, stealth, rifle stance, and
  stolen inventory in that order.
- A malicious attack's damage bonus uses the malice it was cast with, even after its first hit spends it.

## Data

- Maintained skill and trait constants live in `data/ids.ts`.
- Core and specialization `skills/` entries define names, descriptions, icons, selection metadata, costs, recharge, and effects. Edit these definitions directly without scraping skills or regenerating metadata.
- `data/trait-lines.ts` retains specialization and trait presentation. `createNativeModuleData` materializes the
  complete declarations contributed by each module.

## Trait and resource ownership

Core definitions live in `core/traits/<line>/index.ts`; each elite registers its traits in `traits/index.ts`.
Definitions own balance profiles, modifiers, triggers, recharge rules, and build contributions. Supporting helpers stay
beside their owners; mechanics own resource clocks, stealth/Revealed, Mark/malice, shroud, artifacts, and applied
windows.

Build and live queries share `thiefProfession.attributeContributions`, combining equipped signet passives from
`core/skills/attribute-passives.ts` with selected trait declarations. The evaluator starts from equipment seeds and uses
the active balance context. Preparedness owns initiative capacity for both initial state and live resource queries.

Ordered mechanic trigger points preserve these boundaries:

- Stealth breaks before Unrelenting Strikes and No Quarter; steal traits run before stolen-skill acquisition and
  initiative rewards. `core/mechanics/steal.ts` dispatches the boundary from `core/mechanics/trigger-points.ts`.
- Dodge packets resolve before their new damage windows; Mark resets precede stolen-skill replacement and malice
  rewards.
- Specter emits barrier before Dark Sentry's task and resolves Amplified Siphoning before Improvisation. Siphon's skill
  owns Shadow Force calculation; Dark Sentry owns Rot Wallow Venom delivery.
- Antiquary preserves artifact grant order, Sun Crystal before Mistburn, and the granted lifetime of applied charges and
  windows. Shared strike dispatch remains in `core/hooks.ts` and delegates venom consumption to its mechanic owner.

## Implemented systems

- Core implements nine terrestrial weapon families with exact main-hand/off-hand matching for every dual-wield and
  empty-offhand slot-3 skill; shared initiative, passive regeneration, explicit weapon-skill costs, weapon-swap
  preservation, Preparedness, and initiative-gain traits; stealth stacking, Revealed, active-weapon stealth attacks, and
  core/Daredevil stolen skills.
- Daredevil implements physical-skill endurance, the Fist Flurry/Palm Strike window, delayed Pulmonary Impact, staff packets,
  and its damage-window traits.
- Deadeye implements Mark, malice, Kneel, malicious stealth attacks, and per-malice Backstab scaling.
- Specter implements Shadow Force pool and Shadow Shroud transitions, Scepter and shroud hit packets, wells, Siphon, and
  initiative-to-Shadow-Force gain.
- Antiquary implements artifact uses with all artifacts selectable, per-cast Double Edge outcomes, backfire state, and
  persistent Antiquary summons.

Core Steal exposes Detonate Plasma, Throw Magnetic Bomb, and Soul Stone Venom as its standard stolen-skill choice pool.
Double Edge success/backfire is saved per rotation entry; simulation never uses unseeded randomness.

## Modeling boundaries

The simulation models outgoing damage against one target. Player health stays at 100%; target health remains modeled. Incoming attacks,
active defense, ally support (Shallow Grave, Consume Shadows, Traversing Dusk, Panaku's Ambition, Hungering Darkness,
etc.), pathing, secondary targets, and competitive PvP and WvW balance splits are outside the model.
