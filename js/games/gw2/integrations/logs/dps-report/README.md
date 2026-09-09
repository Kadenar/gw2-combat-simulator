# dps.report import

Imports public dps.report links, report IDs and downloaded Elite Insights JSON. URL imports use the public `getJson`
endpoint; JSON and URL imports share validation and reconstruction.

The selected player's exported rotation is authoritative, including EI-inferred rows marked `isNotAccurate`. The
importer filters casts by intersection with the selected phase. A negative or pre-phase start is retained when the cast
crosses the phase start; an instant before the phase or a cast ending before it is outside the window. Equal timestamps
retain JSON traversal order. EI groups rows by skill, so original cross-skill tie order is unavailable.

`sourceActions` retains cast timestamps, durations, status and accuracy before replay normalization. Normalized
`actions` resolve catalog identities and represented composites. Shared profession rules handle aliases, chained
attacks, split animations and generated bar swaps. Trait/gear/unconditional procs and simulator-generated packets do not
become independent inputs. Supplied Luminary Forge entries remain inputs; missing opening entries stay missing.

No additional cast is inferred from initial buffs, minions, aggregate damage, later repetitions, resources or dependent
skills. No opener alignment or fixed preparation waits are applied. Users supply missing setup in the rotation editor.

Commands use catalog mechanics. Shorter observed durations are encoded as quantized interruptions where applicable;
longer occupancy can become waits. These replay conversions do not rewrite the source evidence or grant missing state.
Consequently an imported rotation can need editing or produce availability warnings before it simulates successfully.

Each successful import returns this notice once, alongside independent unsupported-action and interruption warnings:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

`parser.ts` validates players, phases, metadata and casts; `url.ts` validates and retrieves public reports.
`rotation/reconstruct.ts` owns selection, phase filtering and commands. Profession normalization lives in
`../lib/rotation/professions/`; there is no separate report recovery layer.

Reports produced by different EI versions or with different windows can contain different casts. Compare with EVTC only
after matching parser version, player, origin and window. The raw adapter's supported finder coverage is documented in
its [README](../evtc/README.md). Neither adapter reconstructs an unrecorded opener.
