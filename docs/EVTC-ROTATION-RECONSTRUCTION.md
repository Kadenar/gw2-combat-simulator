# EVTC rotation reconstruction

The EVTC rotation layer converts one player's recorded inputs into the
simulator's persisted rotation format. It has a registered parser profile for
Core and every elite specialization of all nine professions.

Users can select an `.evtc`, `.evtc.zip`, or `.zevtc` file with the existing
**Import Rotation** control. The open simulator must match the recorded
profession and specialization; this prevents importing actions against the
wrong skill catalog.

It records:

- animated weapon, profession, heal, utility, and elite skill casts;
- interrupted and shortened casts, including their actual duration;
- dodges identified by the EVTC skill name;
- weapon swaps from `CBTS_WEAPONSWAP` state changes;
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
record, so the parser can only infer them from a direct buff or damage event
whose skill ID matches a zero-cast-time player skill. These actions are marked
with `evidence: "effect"` and summarized in `warnings`; passive and
summon-owned events are not treated as user inputs.

Catalog misses are retained in the exact action timeline and reported instead
of being discarded. This makes missing simulator data visible while preserving
what the log actually recorded.
