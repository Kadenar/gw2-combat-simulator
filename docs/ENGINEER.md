# Engineer implementation

The Engineer implementation uses the checked-in Guild Wars 2 API identity
snapshot from July 28, 2026 plus manually reviewed PvE mechanics encoded in
the profession modules.

## Implemented systems

- Eight terrestrial weapon families and both configured equipment sets.
- Engineering kits as weapon-bar replacements. Equipping or stowing a kit
  emits a sigil-swap trigger without changing the equipped weapon set.
- Tool-belt skills derived from selected heal, utility, and elite skills.
- Holosmith Photon Forge, passive heat generation, skill heat, the six-second
  kit lockout, overheat, and the current piecewise cooling rates.
- Mechanist trait-selected F1-F3 commands, summon/recall state, inherited mech
  attributes, persistent basic attacks, command interruption of those attacks,
  signets, and damage-relevant mech trait reactions.
- Amalgam F2-F4 morph loadout persistence and Evolve state.
- Ammo, cooldowns, autoattack chains, current damage packets, conditions,
  controls, boons, and modeled offensive traits.

Every catalog trait has a validated coverage entry. Effects outside a
single-target damage rotation, such as personal defense, ally support,
movement, and competitive-mode behavior, are explicitly classified out of
model.

## Mechanist

### Profession bar and command selection

Selecting Mechanist replaces ordinary tool-belt skills with one command from
each selected Mechanist trait tier. Only the selected F1-F3 commands are
available in the rotation. F4 displays Recall Mech while the mech is active and
Crash Down while it is inactive.

| Trait | Slot | Selected command |
| --- | --- | --- |
| Mech Arms: Single-Edge Cutters | F1 | Rolling Smash |
| Mech Arms: High-Impact Drivers | F1 | Explosive Knuckle |
| Mech Arms: Jade Cannons | F1 | Spark Revolver |
| Mech Frame: Conductive Alloys | F2 | Discharge Array |
| Mech Frame: Channeling Conduits | F2 | Crisis Zone |
| Mech Frame: Variable Mass Distributor | F2 | Core Reactor Shot |
| Mech Core: Jade Dynamo | F3 | Jade Mortar |
| Mech Core: Barrier Engine | F3 | Barrier Burst |
| Mech Core: J-Drive | F3 | Sky Circus |

The simulation starts with the mech active. Recall Mech stops its automatic
attacks and disables F1-F3. Crash Down reactivates it, deals a 2.5-coefficient
strike, and applies launch control.

Mech commands are explicit rotation actions; the simulator does not
automatically cast them when they recharge. A damaging command makes the mech
busy for its measured animation plus a 350 ms recovery, delaying its persistent
basic attack without cancelling already committed command packets.

### Attribute inheritance and caps

Mech events resolve an independent attribute set from the owner's current
non-Might attributes. The base values and inheritance rules are:

| Attribute | Mech calculation before boons and buffs | Base cap |
| --- | --- | ---: |
| Power | 1,000 + 50% of owner Power | 2,250 |
| Precision | 1, or 1 + 100% of owner Precision with Variable Mass Distributor | 2,500 |
| Toughness | 1,000 + 100% of owner Toughness | Not modeled |
| Vitality | 1,000 + 100% of owner Vitality | Not modeled |
| Ferocity | 50% of owner Ferocity | 750 |
| Condition Damage | 50%, or 100% with Conductive Alloys | 750 / 1,500 |
| Expertise | 50%, or 100% with Conductive Alloys | 750 / 1,500 |
| Concentration | 50%, or 100% with Channeling Conduits | 750 / 1,500 |
| Healing Power | 50%, or 100% with Channeling Conduits | 750 / 1,500 |

These are base-attribute caps. Boons and buffs are applied afterward and may
raise the final value above a cap. Mechanical Genius does not double dip the
owner's Might: Might is removed before inheritance, and Shift Signet then
copies it to the capped mech. For example, a power-capped mech with 25 Might
has 2,250 + 750 = 3,000 Power.

Engineer-only Firearms bonuses are not inherited as owner attributes. In
particular, No Scope's 150 Ferocity is removed from the inherited pool and
Hematic Focus's additional Fury critical chance applies only to player
strikes. Mech Arms: Jade Cannons independently adds 20% mech critical chance.

The implementation is in `js/professions/engineer/state.js` and
`js/professions/engineer/attribute-rules.js`. Cap, frame-trait, post-cap Might,
and critical-stat regressions are in `tests/engineer.test.js`.

### Persistent mech attacks

The first automatic mech attack is scheduled one second after combat starts.
Commands and Jade Buster Cannon postpone the next basic attack while the mech
is busy.

With Mech Arms: Jade Cannons, the mech alternates the two Jade Energy Shot
skill IDs:

- each arm deals a 0.42-coefficient strike;
- the second arm follows after 0.5 seconds;
- the next two-arm cycle begins after another 1.075 seconds; and
- copied Quickness from Shift Signet divides both intervals by 1.5.

Without Jade Cannons, the mech repeats this melee chain:

| Attack | Strike packet | Delay to next step |
| --- | ---: | ---: |
| Hard Strike | 0.45 | 0.25 seconds |
| Heavy Smash | 0.45 | 0.5 seconds |
| Twin Strike | 0.8 split across two hits | 0.5 seconds |

Copied Quickness also divides the melee intervals by 1.5.

### Strike and condition ownership

Mech attacks are emitted as summon-owned Engineer events. They use the mech's
inherited Power, Precision, Ferocity, Condition Damage, and Expertise rather
than the player's final attributes.

The mech has no equipped player weapon. Its strikes therefore use the shared
independent-summon damage path and native mech reference packets instead of
the engineer's rifle, sword, kit, sigils, or other active weapon-strength
profile:

| Native mech packet class | Reference damage per coefficient | Reference Power |
| --- | ---: | ---: |
| Persistent basic attacks and Rocket Punch | 1,445 | 1,500 |
| Mech commands and Jade Buster Cannon | 1,662 | 1,500 |

These are profession-wide summon inputs, not benchmark-specific or
per-rotation damage adjustments. Coefficients, conditions, critical chance,
critical damage, target armor, Vulnerability, and eligible Engineer
profession modifiers are still resolved through the common GW2 damage path.
Force Signet applies 15% strike damage to the engineer and mech, or 18% with
J-Drive.

Deterministic simulations use expected critical damage. The supplied EVTC can
therefore differ when it realizes an unusually high or low number of mech
critical hits.

### Damage-relevant commands and traits

- Rolling Smash is a 1.6-coefficient summon strike and applies four Bleeding
  for eight seconds.
- Single-Edge Cutters adds one three-second Bleeding application from mech
  hits with a one-second interval.
- Explosive Knuckle is a 1.8-coefficient explosion and applies Weakness for
  five seconds.
- High-Impact Drivers grants one Might for ten seconds from mech hits with a
  one-second interval.
- Spark Revolver fires twelve 0.176-coefficient projectiles.
- Jade Cannons gives persistent basic attacks 20% critical chance and one
  six-second Vulnerability application per hit.
- Discharge Array pulses five times at one-second intervals. Each pulse has a
  0.3 strike coefficient and applies Slow, Confusion, and Burning.
- Core Reactor Shot lands 684 ms after activation, has a 2.5 coefficient, and
  applies launch control.
- Jade Mortar lands 601 ms after activation, has a 2.2 coefficient, applies
  three Burning for six seconds, and applies one second of daze.
- Jade Dynamo reduces command recharge by 20% and grants the engineer 2.5
  seconds of Quickness when a command is used.
- Sky Circus deals three 0.6 missile strikes plus a 1.2 landing strike,
  applies Burning, and applies knockdown control.
- Activating a non-kit weapon skill 3 while the mech is active triggers Rocket
  Punch on a five-second interval. Rocket Punch is a 1.0-coefficient
  explosion, applies five seconds of Burning, and deals 100 defiance damage.
- Overclock Signet commands five Jade Buster Cannon hits at 650 ms intervals.
  Each hit has a 0.95 coefficient and applies one Burning for six seconds.
- J-Drive improves Force Signet from 15% to 18%, improves Superconducting
  Signet to 12% condition damage, reduces other signet recharges by 24%, and
  preserves their passive recharge behavior represented by the simulator.

Support-only effects from Crisis Zone, Barrier Burst, Barrier Engine,
Rectifier Signet, and Barrier Signet may appear as actions or boon events but
do not add artificial damage to the single-target result.

### Engineer trait reactions from mech events

Mech projectiles can trigger Aim-Assisted Rocket when the underlying skill is a
supported missile. Spark Revolver, Core Reactor Shot, and Jade Mortar qualify;
Jade Energy Shot is intentionally not in that command-trigger list. The trait
uses a three-second interval, creates four 1.0-coefficient rockets with a 40 ms
impact delay, and replaces every fifth proc with a 1.92-coefficient Orbital
Command Strike that lands two seconds later.

Mech explosions can participate in explosion reactions such as Shrapnel.
Incendiary Powder accepts player and mech critical hits but tracks separate
ten-second ready times for those owners. Mech conditions retain summon
ownership so they resolve from mech attributes and do not silently use player
condition stats.

## Mechanist modeling boundaries

- The simulation assumes the mech remains within the Mechanical Genius range.
  It does not apply the out-of-range command-recharge penalty.
- Mech health, death, incoming damage, pathing, target acquisition, projectile
  obstruction, and movement are not modeled.
- Commands are never automatically cast by mech AI.
- Recall and Crash Down use fixed simulator state; Crash Down recharge does
  not scale from missing mech health.
- Overclock Signet models Jade Buster Cannon only while the mech is active. Its
  live-game fallback that summons a missing mech is not modeled.
- J-Drive's aerial bombardment while the mech is dismissed is not modeled.
- Native mech weapon-strength randomness is not sampled. The deterministic
  native reference packets above are used for both deterministic and
  stochastic simulations.
- Ally healing, barrier value, condition cleansing, defensive reduction,
  target caps, and competitive PvP/WvW splits are outside the outgoing
  single-target damage model.

## Data provenance

Refresh API identity data with:

```powershell
npm run update:profession-data -- --profession Engineer
```

This runs `scripts/update-profession-api-data.mjs`. Runtime simulation is
network-free. Non-API coefficients and state-machine rules are manually
reviewed and checked into the mechanics modules; the repository does not
currently track per-record Wiki revision metadata.

The authoritative implementation locations are:

- `js/professions/engineer/state.js` for resource and mech attribute state;
- `js/professions/engineer/attribute-rules.js` for inherited attributes and
  damage modifiers;
- `js/professions/engineer/mechanics/specific/mech.js` for persistent attacks,
  command busy time, Rocket Punch, and Jade Buster Cannon;
- `js/professions/engineer/mechanics/skill-mechanics.js` for skill packets,
  cooldowns, and timings; and
- `js/professions/engineer/resolver/event-handlers.js` for trait reactions.
