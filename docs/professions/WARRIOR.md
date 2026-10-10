# Warrior

Native shared-engine profession. Entry point `warrior.html`. `profession.ts` is the stable export and composes the
Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Berserker, Spellbreaker, Bladesworn, or
Paragon. Core owns adrenaline, bursts, weapon state, shared traits, and profession actions; each specialization owns its
state, skill handlers, modifier rules, and UI under `specializations/<name>/`.

## Data

- API identity snapshot: 2026-08-08 (official GW2 API): 159 skills, 108 traits, and all nine specialization lines.
  Twelve API-omitted Bladesworn gunsaber and Dragon Slash skills are checked in as supplemental identities.
- Refresh: `npm run update:warrior-data`. The updater drops invalid API skill `62857`, repairs Dragon Trigger's dangling
  flip reference, and regenerates API metadata, Warrior IDs, and supplemental skills without overwriting the owner-local
  mechanics catalogs.
- The generator uses Wiki skill infoboxes to identify supplemental skills, then fetches their API metadata. It does not
  generate activation timings; those remain authored in the owning Core and specialization skill modules.

Native modules register 77 trait owners: Core 43, Berserker 9, Spellbreaker 6, Bladesworn 10, and Paragon 9. Grouped
trait-line `traits/<line>/index.ts` files own profiles, modifier rules, triggers, recharge rules, build contributions,
and trait decisions; Core `traits/index.ts` collects line declarations, while each elite `traits/index.ts` owns its
definitions and registration array. `traits/behavior.ts` contains runtime helpers; Core keeps its shared modifier
queries in `traits/modifier-queries.ts`. Consumers use numeric trait IDs. Build calculations combine the skill-owned
signet callback with `warriorProfession.traitBuildAttributes`; callbacks read the active balance context.

Versatile Power remains in `core/traits/discipline/index.ts`. Recharge order -1 keeps it before weapon rules and the
imperative weapon-swap cap. Explicit modifier orders preserve the former Strength/Tactics/Defense/Arms and skill-rule
sequence. Burst Mastery owns its separate Bladesworn conversion profile under its existing patch identity.

Retained imperative boundaries preserve shared observations and granted lifetimes:

- Core claims the first surviving burst hit once and computes one critical opportunity. It calls trait owners in the
  original order before ordinary strike adrenaline. Soldier's Focus retains one shared claim; Martial Cadence owns its
  swap reset. Attribute owners receive the original mutable pools so live Might, signets, and Berserk conversions keep
  their established inputs.
- Berserker mechanics publish mode extension after owner calculations; completion rewards and aura detonation keep their
  causal timing. King of Fires owns aura acquisition, the live deadline, and queued detonation.
- Bladesworn mechanics retain Flow ticks, charge capture, bar transitions, and ammunition spending. Trait owners retain
  the shared adept cooldown, Positive Flow lifetime, ammunition rewards, Glory extension, action substitution, and
  selected charge policy. Core owners receive converted Dragon Slash spend for completion rewards.
- Paragon mechanics retain the capped Motivation pool and refrain/echo tasks. Tiers are read before spending; trait
  adrenaline follows actual spend. Feverish Pulse follows chant opening and scheduling, Inspiring Implements follows
  burst echo consumption, and each captured echo count survives for its admitted lifetime.

Intrinsic specialization resource prerequisites remain shared with their native mode owners. Generic emission and
modifier-query helpers carry no concrete trait selection policy. Ordinary `hooks.ts` files call owner helpers where
registering an independent hook would reorder resource changes or same-time events.

## Implemented systems

- **Core** — adrenaline generation on player strikes (30-point cap), burst availability/spending, three-level burst
  traits, weapon swapping, endurance and Dodge, and current weapon families; Strength/Tactics attribute and damage
  modifiers, Soldier's Focus, party boons, and control/dodge interactions.
- **Berserker** — Berserk entry cost/duration, Primal Burst gating, Rage-skill extensions, and specialization
  damage/cast-speed/attribute traits.
- **Spellbreaker** — 20-point adrenaline cap, level-one bursts, Full Counter, control tracking, and its
  target/tether/disenchantment traits.
- **Bladesworn** — flow replaces adrenaline, gunsaber entry/exit and gating, gunsaber/pistol ammo, armament reloads,
  Dragon Trigger charge conversion, and scaling Dragon Slash packets. Normal weapon swapping is disabled.
- **Paragon** — a 30-point adrenaline pool with a 10-point burst-spending cap, chants, motivation, active refrains,
  periodic motivation drain, and refrain traits.

## Dragon Trigger (Bladesworn) rotations

Queue Dragon Slash directly after Dragon Trigger; the scheduler waits for the specialization's current maximum charge
count automatically:

```js
['Dragon Trigger', 'Dragon Slash—Force'];
```

Set `releaseAtCharges` (or use the timeline's Dragon Slash pencil editor) to release early; the value is capped to the
active spec maximum, including Daring Dragon's five. If the requested count cannot be reached by the end of the channel,
the slash is rejected with a resource warning instead of waiting indefinitely.

The same editor has an optional **Additional release delay (ms)** field below the charge choices, in 40 ms increments.
Its canonical `releaseDelayMs` value holds the selected charges after their actual threshold is reached, including any
Flow stalls. For a full ten-charge release, 80 ms adds to the normal 2400 ms or Tactical Reload's 1200 ms. Charging
spends no additional Flow and gains no extra charges during the hold; regeneration, cooldowns, and buff expiry continue.
Zero or blank clears the field. A hold cannot extend Dragon Trigger's lifetime.

EVTC and DPS-report imports retain positive observed time beyond the inferred charge threshold in `releaseDelayMs`,
rounded to the existing action-tick grid. This is inferred from animation duration; the log cannot distinguish an
intentional hold from a Flow shortage or processing delay. Imported holds can be edited or cleared in the same field.

## Modeling boundaries

Single-target, outgoing-damage focused. Incoming attacks, active defense, ally healing/revival, projectile interaction,
pathing, secondary targets, and competitive (PvP/WvW) splits are out of model. Full Counter activation spends adrenaline
and starts recharge, but does not produce an automatic counterattack or successful-burst rewards without an incoming
attack.
