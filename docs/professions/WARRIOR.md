# Warrior

Native shared-engine profession. Entry point `warrior.html`. `definition.ts`
is the stable export and composes the Core-first tuple from `modules.ts`. A
runtime contains Core plus at most one of Berserker, Spellbreaker, Bladesworn,
or Paragon. Core owns adrenaline, bursts, weapon
state, shared traits, and profession actions; each specialization owns its
state, skill handlers, modifier rules, and UI under `specializations/<name>/`.

## Data

- API identity snapshot: 2026-08-08 (official GW2 API): 171 skills, 108
  traits, and all nine specialization lines. Twelve API-omitted Bladesworn
  gunsaber and Dragon Slash skills are checked in as supplemental identities.
- Refresh: `npm run update:warrior-data`. The updater drops invalid API skill
  `62857`, repairs Dragon Trigger's dangling flip reference, and regenerates
  API metadata, Warrior IDs, and supplemental skills without overwriting the
  owner-local mechanics catalogs.
- Public API data omits some activation times and mode-specific facts; the
  generator uses current Wiki activation data where available and deterministic
  fallbacks elsewhere.

## Implemented systems

- **Core** — adrenaline generation on player strikes (30-point cap), burst
  availability/spending, three-level burst traits, weapon swapping, endurance
  and Dodge, and current weapon families; Strength/Tactics attribute and damage
  modifiers, Soldier's Focus, party boons, and control/dodge interactions.
- **Berserker** — Berserk entry cost/duration, Primal Burst gating, Rage-skill
  extensions, and specialization damage/cast-speed/attribute traits.
- **Spellbreaker** — 20-point adrenaline cap, level-one bursts, Full Counter,
  control tracking, and its target/tether/disenchantment traits.
- **Bladesworn** — flow replaces adrenaline, gunsaber entry/exit and gating,
  gunsaber/pistol ammo, armament reloads, Dragon Trigger charge conversion, and
  scaling Dragon Slash packets. Normal weapon swapping is disabled.
- **Paragon** — 10-point adrenaline cap, chants, motivation, active refrains,
  periodic motivation drain, and refrain traits.
- All 108 traits have a validated coverage disposition.

## Dragon Trigger (Bladesworn) rotations

Queue Dragon Slash directly after Dragon Trigger; the scheduler waits for the
specialization's current maximum charge count automatically:

```js
["Dragon Trigger", "Dragon Slash—Force"];
```

Set `releaseAtCharges` (or edit the timeline's `⚡Max` badge) to release early;
the value is capped to the active spec maximum, including Daring Dragon's five.
If the requested count cannot be reached by the end of the channel, the slash
is rejected with a resource warning instead of waiting indefinitely.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally
healing/revival, projectile interaction, pathing, secondary targets, and
competitive (PvP/WvW) splits are out of model. Full Counter is treated as
triggered when cast.
