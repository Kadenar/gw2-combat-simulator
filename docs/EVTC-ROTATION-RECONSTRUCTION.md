# EVTC rotation reconstruction

The EVTC rotation layer converts one player's recorded inputs into the
simulator's persisted rotation format. It has a registered parser profile for
Core and every elite specialization of all nine professions.

> [!WARNING]
> EVTC import is experimental and remains a work in progress. Reconstruction
> may produce incomplete, inaccurate, or otherwise undesirable rotations.
> Review imported results before relying on them.

Users can select an `.evtc`, `.evtc.zip`, or `.zevtc` file with the existing
**Load Rotation** control. The open simulator must match the recorded
profession and specialization; this prevents importing actions against the
wrong skill catalog.

It records:

- animated weapon, profession, heal, utility, and elite skill casts;
- interrupted and shortened casts, including their actual duration, while
  canceled autoattack packets that never completed a chain strike are omitted;
- dodges identified by the EVTC skill name;
- weapon swaps from `CBTS_WEAPONSWAP` state changes;
- profession transformations reconstructed from their configured buff gains
  and losses, including Reaper, Harbinger, and Ritualist shrouds and
  Bladesworn Gunsaber state;
- configured instant follow-ups whose use consumes an availability buff, such
  as Distress;
- Elementalist attunement changes, attunement-specific Glyph of Storms IDs,
  and Earth Elemental Stomp commands recovered from the player-owned actor,
  including a truncated opening Stomp recovered from its animation stop;
- precombat Necromancer minion summons when the initial EVTC state contains a
  player-owned minion agent;
- Ritualist Summon Spirits and Innervate actions inferred from their emitted
  combat effects;
- Scourge shade skills inferred from shade strikes, shroud pulses, barrier and
  fear events, plus player-owned Shadow Fiend Haunt activations;
- Revenant legend swaps reconstructed from stance transitions, Herald facet
  activations and initial upkeep recovered from their buffs, and Renegade
  warband commands recovered from player-owned actors;
- Revenant split Deathstrike and Phantom's Onslaught animations collapsed into
  their single executable actions, with canceled autoattack packets omitted;
- truncated Reaper Grasping Darkness and Nightfall opening precasts recovered
  from their surviving effects and animation stop;
- Engineer kit transitions reconstructed from weapon-set changes, Amalgam
  protocol animations normalized to the selected morphs, and Bomb Kit,
  Throw Mine, Hammer 5, and Flux State opening precasts recovered from their
  surviving combat effects, initial buffs, and animation stops;
- Mechanist Jade Mech commands recovered from player-owned agent activations,
  Overclock Signet recovered from its reset packet, and rifle/sword opening
  precasts reconstructed alongside Bomb Kit sequences;
- Holosmith Photon Forge entry, manual exit, and automatic overheat separated
  from kit swaps, with Blade Burst, Particle Accelerator, Laser Disk, and
  condition Bomb/Grenade Kit openings reconstructed from their EVTC evidence;
- Mesmer shatters, Continuum Split/Shift, Mirage Cloak and mirrors, Virtuoso
  bladesongs, teleports, Chaos Armor, Mirror Images, and opening phantasms or
  projectile skills reconstructed from effects, buffs, missiles, and owned
  illusion agents;
- Warrior precombat signets, physical skills, chants, Winds of Disenchantment,
  and opening Breaching Strike recovered from initial buffs and combat events,
  with Rend follow-ups and canceled autoattack animations collapsed into their
  executable simulator actions;
- Galeshot Cyclone Bow summons and dismissals separated from real weapon
  swaps, plus pet swaps and commanded pet-skill activations;
- max-range and close-range Path of Scars variants distinguished by the
  recorded outbound and return projectile timing;
- Galeshot precast Barrage and bundle activations whose successful casts use
  Arc's immediate-cancel encoding;
- combat entry; and
- otherwise-unrecorded instant casts when the same player emits a direct event
  for a zero-cast-time skill in the active profession catalog.

The `actions` result is the authoritative EVTC timeline. Every action has an
exact timestamp, duration, category, completion status, and evidence source.
The `rotation` result is the importable simulator representation. It inserts
waits for measured downtime and concurrent offsets for overlap.

Engineer imports preserve the exact timing in `actions`, while their importable
`rotation` omits between-cast input latency to produce a benchmark-quality
replay. The evidenced five-second Throw Mine arming window remains explicit.

After profession-specific reconstruction, the shared effect-packet reconciler
matches every player's catalog strike timeline against observed EVTC damage.
An observed packet is positive evidence that its cast committed even when Arc
reports an immediate cancel or an animation stop before impact. Explicit
`atMs`, `timingAnchor`, and `timingScale` metadata receives a narrow timing
match; effects without explicit timing use a bounded cast window. Validated
packets remain scheduled without extending a shortened lockout. Missing damage
does not independently prove interruption because attacks can miss, be blocked,
or fail to hit the selected target; without positive packet evidence, Arc's
recorded completion status remains authoritative.

## API

```js
import { parseEvtcRotation } from "./js/evtc-analyzer/rotation/index.js";

const result = parseEvtcRotation(expandedBytes, profession.catalog, {
  playerAddress: "0x1234", // optional for a single-player log
});

result.rotation; // importable rotation entries
result.actions; // exact evidence-bearing EVTC timeline
```

If multiple players have the same number of recorded actions, the caller must
select one by address. This avoids silently importing the wrong player's
rotation.

The generic reconstructor dispatches to a profession module after identifying
the selected player, then applies shared cast/effect reconciliation. Common
strike timing, packet commitment, and autoattack evidence helpers live in
`rotation/effect-packets.ts`. Profession-only event aliases, composite
animations, ownership, packet deduplication, range classification, and
autoattack-chain state remain under `rotation/professions/`.

Engineer follows the same profile and specialization breakdown as Necromancer:
`engineer/profile.ts` owns static parser registration, `engineer/shared.ts`
owns cross-specialization policy, `engineer/kits.ts` and
`engineer/autoattacks.ts` own core mechanics, and the Amalgam, Holosmith, and
Mechanist modules only interpret their specialization-specific EVTC evidence.

Mesmer follows the same split: its profile owns aliases and initial illusions,
shared modules normalize autoattacks and cross-specialization effects, and the
Chronomancer, Mirage, and Virtuoso modules interpret their mechanic-specific
effect GUIDs and buff transitions. Troubadour uses the shared Mesmer rules.

## CLI

Build the TypeScript modules, then write a rotation JSON file:

```sh
npm run build:modules
node scripts/analysis/reconstruct-evtc-rotation.mjs fight.zevtc > rotation.json
```

Use `--timeline` to include the exact reconstructed action records in metadata.
Use `--player=0x...` for ambiguous multi-player logs.

## Accuracy boundary

EVTC does not contain key presses. Animated casts, their start/stop times,
dodges, and weapon swaps are direct evidence. Some instant skills have no cast
record, so the parser can only infer them from a direct buff or damage event.
The generic path requires the event skill ID to match a zero-cast-time player
skill; profession modules may map documented effect IDs back to their owning
action and deduplicate multi-packet effects. These actions are marked with
`evidence: "effect"` and summarized in `warnings`; passive and summon-owned
events are not treated as user inputs.

Initial player-owned minion agents prove that the summon existed when combat
logging began, but EVTC does not retain their earlier cast timestamps. These
casts are marked with `evidence: "initial-state"` and placed sequentially before
the first recorded action. If a log starts during a shroud cast, its unmatched
animation stop is backdated by the recorded elapsed duration.

Ranger pet activations are summon-owned rather than player-owned events. The
Galeshot parser only promotes non-autonomous pet skills from agents owned by
the selected player; autonomous pet attacks remain simulation behavior rather
than rotation inputs. Pet spawn transitions supply the corresponding pet-swap
actions.

Catalog misses are retained in the exact action timeline and reported instead
of being discarded. This makes missing simulator data visible while preserving
what the log actually recorded.
