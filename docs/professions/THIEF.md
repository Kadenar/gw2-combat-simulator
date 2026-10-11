# Thief

Native shared-engine profession. Entry point `thief.html`. `profession.ts` composes the Core-first tuple from
`catalog.ts`; a runtime contains Core plus at most one of Daredevil, Deadeye, Specter, or Antiquary. Core owns shared
initiative, stealth, weapons, and traits; each specialization owns a complete vertical slice under
`specializations/<name>/`.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance.
- Refresh: `npm run update:profession-data -- --profession Thief`.
- Runtime simulation is network-free. Initiative, skill mechanics, modifiers, and other non-API behavior are checked
  into owner-local `skills/`, `traits/`, and `mechanics/` modules.

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
  initiative rewards. `core/mechanics/steal.ts` dispatches the boundary from `core/mechanics/boundaries.ts`.
- Dodge packets resolve before their new damage windows; Mark resets precede stolen-skill replacement and malice
  rewards.
- Specter emits barrier before Dark Sentry's task and resolves Amplified Siphoning before Improvisation. Siphon's skill
  owns Shadow Force calculation; Dark Sentry owns Rot Wallow Venom delivery.
- Antiquary preserves artifact grant order, Sun Crystal before Mistburn, and the granted lifetime of applied charges and
  windows. Mixed strike dispatch lives in `core/mechanics/reactions.ts`.

## Implemented systems

- **Core** — nine terrestrial weapon families with exact main-hand/off-hand matching for every dual-wield and
  empty-offhand slot-3 skill; shared initiative, passive regeneration, explicit weapon-skill costs, weapon-swap
  preservation, Preparedness, and initiative-gain traits; stealth stacking, Revealed, active-weapon stealth attacks, and
  core/Daredevil stolen skills.
- **Daredevil** — physical-skill endurance, the Fist Flurry/Palm Strike window, delayed Pulmonary Impact, staff packets,
  and its damage-window traits.
- **Deadeye** — Mark, malice, Kneel, malicious stealth attacks, and per-malice Backstab scaling.
- **Specter** — Shadow Force pool and Shadow Shroud transitions, Scepter and shroud hit packets, wells, Siphon, and
  initiative-to-Shadow-Force gain.
- **Antiquary** — artifact uses with all artifacts selectable, per-cast Double Edge outcomes, backfire state, and
  persistent Antiquary summons.

Core Steal exposes Detonate Plasma, Throw Magnetic Bomb, and Soul Stone Venom as its standard stolen-skill choice pool.
Double Edge success/backfire is saved per rotation entry; simulation never uses unseeded randomness.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Incoming attacks,
active defense, ally support (Shallow Grave, Consume Shadows, Traversing Dusk, Panaku's Ambition, Hungering Darkness,
etc.), pathing, secondary targets, and competitive (PvP/WvW) splits are out of model.
