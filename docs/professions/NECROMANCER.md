# Necromancer

Native shared-engine profession. Entry point `necromancer.html`.
`definition.ts` composes the Core-first tuple from `modules.ts`; a runtime
contains Core plus at most one of Reaper, Scourge, Harbinger, or Ritualist. Only
the selected elite's skills, traits, state, and activation behavior are present
in that runtime.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API): 143 skills, 108 traits,
  and 9 specialization lines. Fifteen API-omitted Death Shroud, Lich Form,
  Ritualist innervate, and simulator action identities live in
  `data/necromancer-supplemental-skills.ts`.
- Refresh: `npm run update:profession-data -- --profession Necromancer` (API
  metadata only). Simulator timing and behavior live in owner-local `skills/`
  and `mechanics/` modules, and the application
  catalog is assembled from those module contributions.

## Implemented systems

- **Core** — Death Shroud (five-skill bar, minimum entry resource, continuous
  life-force drain, manual/forced exit, entry recharge); all terrestrial weapon
  families with swap validation, ammo, recharge, flips, and autoattack chains;
  persistent minions, command flips, minion attacks/consumption; signets, life
  siphons, corruption self-conditions, and duration-preserving condition
  transfers; Lich Form; Spear Soul Shards; Weaponmaster Training presentation.
- **Reaper** — Reaper's Shroud (full bar, autoattack chain, flips, channels,
  control, chill), wells, shouts, and Reaper trait modifiers.
- **Scourge** — F1-F5, three-charge Manifest Sand Shade, fixed base-health
  life-force costs, Desert/Sandstorm Shroud, and barrier-reactive traits.
  Scourge is the non-transform exception.
- **Harbinger** — Harbinger Shroud (zero-resource entry, Blight generation to a
  25-stack cap, empowered-consumption thresholds), elixirs, and Dark Barrage.
- **Ritualist** — Ritualist's Shroud, spirits (Anguish/Wanderlust/Preservation),
  spirit attacks, Essence Blast, innervates, and its supporting traits.
- Static and resolver-time strike/critical/condition/duration/recharge/resource/
  shroud/chill/fear/minion/spirit/Blight modifiers, with additive vs.
  multiplicative grouping. Deterministic expected-value procs replace random
  critical-hit chances.
- All 108 traits have a validated coverage disposition.

Core, Reaper, Harbinger, and Ritualist shroud skills stay visible while the
matching shroud is inactive but are disabled until entry; weapon/slot skills are
disabled while a transformed bar is active.

## Modeling boundaries

Single-target, outgoing-damage focused. Ally healing/revival/barrier, boon
removal, projectile interaction, pathing, incoming attacks, enemy positioning,
secondary targets, and competitive (PvP/WvW) splits are out of model; skills
whose only effects are in those categories are excluded rather than shown as
zero-damage.

Life-force capacity is 69% of maximum health (scales with Vitality; +20% with
Soul Battery). Death Shroud drains 3%/sec and Reaper's Shroud 4%/sec.
Damage-resolved target-health feedback is passed back to the scheduler (e.g.
Gravedigger recharges when its hit lands below 50% target health).
