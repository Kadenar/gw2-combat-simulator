# EVTC rotation reconstruction

The EVTC rotation layer reconstructs a player's recorded Guild Wars 2 actions from an ArcDPS combat log and converts them into the simulator's rotation format.

It supports Core and every elite specialization across all nine professions.

> [!WARNING]
> EVTC import is experimental. Reconstructed rotations may be incomplete or inaccurate and should be reviewed before relying on them.

## Using EVTC import

Select an `.evtc`, `.evtc.zip`, or `.zevtc` file through **Load Rotation**.

The active simulator must match the recorded player's profession and specialization so reconstructed actions are resolved against the correct skill catalog.

The importer can recover:

* animated skill casts, including interrupted and shortened casts;
* dodges and weapon swaps;
* profession state changes such as shrouds, attunements, kits, legends, tomes, and similar transformations;
* supported pet, summon, and profession-mechanic commands;
* selected precombat and truncated opening actions;
* otherwise-unrecorded instant casts when they can be inferred from direct combat evidence.

Profession-specific reconstruction handles mechanics that cannot be determined reliably through the generic EVTC event stream alone.

## Actions and rotation output

Reconstruction produces two related outputs:

* **`actions`** — the evidence-bearing reconstructed timeline, including timestamps, duration, action status, and evidence source.
* **`rotation`** — the simulator-compatible representation built from those actions, including waits and concurrent offsets.

The rotation output may normalize timing where necessary to produce a usable simulator replay.

Catalog misses are retained in the action timeline and reported as warnings instead of being silently discarded.

## Reconstruction model

The generic reconstructor:

1. identifies the selected player;
2. records animation casts, weapon swaps, and configured state transitions;
3. dispatches to the matching profession parser;
4. reconciles casts against observed combat-effect packets;
5. resolves reconstructed actions against the simulator catalog;
6. converts the resulting timeline into simulator rotation commands.

Shared cast and strike-packet logic lives under:

```text
js/evtc-analyzer/rotation/
```

Profession-specific interpretation lives under:

```text
js/evtc-analyzer/rotation/professions/
```

These modules handle mechanics such as transformation states, pets and summons, composite animations, profession resources, effect aliases, and profession-specific precasts.

## Effect reconciliation

EVTC animation state alone is not always sufficient to determine whether a skill committed.

Where the simulator has timing metadata for a skill's strike packets, reconstruction compares the expected packet timeline against observed EVTC damage events.

Observed packets provide positive evidence that a cast committed even when ArcDPS reports an interruption or unusually short animation.

Missing damage is **not** treated as proof that a cast failed, since an attack may miss, be blocked, or fail to connect with the selected target.

## Player selection

When a log contains a single suitable player, reconstruction can select that player automatically.

When player selection is ambiguous, provide the player's EVTC address explicitly.

```js
import { parseEvtcRotation } from "./js/evtc-analyzer/rotation/index.js";

const result = parseEvtcRotation(expandedBytes, profession.catalog, {
  playerAddress: "0x1234",
});

result.actions;
result.rotation;
result.warnings;
```

## CLI

Build the TypeScript modules:

```sh
npm run build:modules
```

Then reconstruct a rotation:

```sh
node scripts/analysis/reconstruct-evtc-rotation.mjs fight.zevtc > rotation.json
```

Useful options:

```text
--timeline         Include reconstructed action records in metadata
--player=0x...     Select a specific player from an ambiguous log
```

## Accuracy boundary

EVTC records combat events, not keyboard input.

Animated casts, animation timing, weapon swaps, and similar state changes provide direct evidence of player actions. Other actions—particularly instant skills, summon commands, precasts, and profession mechanics—may need to be inferred from buffs, damage packets, effects, missiles, owned agents, or other combat-log evidence.

Inferred actions are marked with their evidence source and surfaced through reconstruction warnings where appropriate.

Some precombat actions cannot be assigned an exact original cast timestamp. For example, an initial player-owned summon proves that the summon already existed when logging began, but not exactly when it was cast.

Because of these limitations, reconstructed rotations should be treated as a best-effort interpretation of the combat log rather than a literal recording of player inputs.
