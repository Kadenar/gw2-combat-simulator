# EVTC rotation reconstruction

The simulator can reconstruct a rotation from a local ArcDPS `.evtc`, `.evtc.zip`, or `.zevtc` combat log. Import runs
entirely in the browser and does not upload the log.

For the implementation-level reference, including parser behavior, safety limits, profession-specific inference, and
known limitations, see the colocated [EVTC analyzer documentation](../js/games/gw2/integrations/logs/evtc/README.md).

## Import flow

1. Open the simulator page for the recorded profession and specialization.
2. Select **Load Rotation**.
3. Choose the EVTC or compressed EVTC file.
4. Review the reconstructed rotation and any import warnings before using it for analysis.

The importer:

- decompresses and validates supported archives;
- parses the raw EVTC agent, skill, and combat-event tables;
- selects the player matching the active profession and specialization;
- converts recorded casts, explicit EI finder results, waits and represented weapon/state changes;
- resolves recorded skills against the active simulator catalog; and
- converts the result into normal simulator rotation commands.

If several matching players are equally plausible, import stops instead of silently choosing one.

## Reconstruction boundaries

An EVTC file records combat events, not keyboard input. Some actions have no unique event, share evidence with another
skill, begin before the log, or are generated automatically by traits and profession mechanics.

The importer follows explicit supported EI rules and leaves missing setup for manual editing. Initial buffs, existing
minions, later casts and resource requirements do not construct a preparation sequence. Every successful import shows
this notice once:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Source timestamps and durations remain separate from simulator command conversion. Typical independent warnings include:

- an inferred instant cast;
- a recorded skill missing from the simulator catalog;
- an animation without a matching stop event; or
- an interrupted cast without safe simulator commit timing.

Automatic effects already modeled by the simulator are not inserted as player actions. Always review imported rotations
before treating them as benchmark reproductions.

## Encounter-end inputs

Shared EVTC reconstruction keeps only actions whose reconstructed start is strictly before the encounter boundary.
Starts exactly at the boundary or later are excluded for every profession, including weapon swaps, buff transitions, and
EI-inferred instant actions. Mirage and Druid have no post-encounter grace period.

The boundary is computed once from the earliest death or combat exit of an agent whose profession code matches the EVTC
encounter ID. This remains a heuristic: temporary combat exits, multiple matching targets, or encounter IDs that do not
identify an agent can make it incomplete. With no matching target end event, inputs remain unbounded.

Cast decoding and profession normalization use the complete evidence, including stops and split-animation finish
segments after the boundary. A retained cast keeps its recorded duration; crossing the boundary alone does not cancel
it. Filtering precedes shared replay timing, and final eligibility covers late inference before origin calculation,
commands, and action warnings. If no actions survive, import returns the existing no-actions error.

Precombat inputs and source time origin rules are preserved. This input window does not set the simulator's damage
observation duration.

## Source layout

```text
js/games/gw2/integrations/logs/
├── lib/          Source-neutral reconstruction contracts and scheduling
├── evtc/         Raw EVTC parsing, evidence inference, and reconstruction
└── dps-report/   Elite Insights validation and supplied rotation conversion
```

The EVTC adapter is under `js/games/gw2/integrations/logs/evtc/`. Shared logic belongs in `../lib/`; source-specific
EVTC behavior remains in the adapter.

## Development tools

Build the compiled modules first:

```sh
npm run build:modules
```

Inspect a log without opening the browser:

```sh
node scripts/analysis/analyze-evtc.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>
```

Reconstruct simulator commands:

```sh
node scripts/analysis/reconstruct-evtc-rotation.mjs <fight.evtc|fight.evtc.zip|fight.zevtc>
```

Count Overload Fire's recorded Burning Bolts for each Tempest in a log, after running `npm run build:modules`:

```sh
node scripts/analysis/analyze-overload-fire.mjs "path/to/fight.zevtc"
```

The report includes cast times, durations, completion/interruption status, per-cast bolt counts, and totals. It accepts
`.evtc`, `.zevtc`, and single-entry `.evtc.zip` files. After building, save machine-readable results with:

```sh
node scripts/analysis/analyze-overload-fire.mjs "path/to/fight.zevtc" --json > overload-fire.json
```

Counts use Burning Bolt missile creation records (skill 12853) within the same player's Overload Fire animation (skill
29706), supporting legacy activations and modern animation events in revision 1 logs. Simultaneous projectiles count
separately; launch/removal events do not count again. These are projectile counts, not unique whirl pulses or confirmed
hits. Burning applications share a skill ID with other sources, so hit counts are not inferred. Missing projectile data
and incomplete cast records produce warnings; bolts outside recorded casts are reported separately in JSON and excluded
from the total. A cast without a stop is provisionally bounded by the next animation or the end of the log. Logs without
Tempest players are reported explicitly.

The original EVTC is preferred when available. For reconstruction from a public Elite Insights report, use the
[dps.report adapter](../js/games/gw2/integrations/logs/dps-report/README.md).
