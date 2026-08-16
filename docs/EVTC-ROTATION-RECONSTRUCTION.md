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
  as Distress; and
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
the selected player. Profession-only event aliases, packet deduplication, and
autoattack packet interpretation live under `rotation/professions/` rather
than in the shared event-pairing pipeline.

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
