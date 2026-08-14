# Rotation optimizer

The rotation optimizer searches for a high-damage rotation using the current
profession build and simulation configuration. It is available from every
native profession's rotation toolbar.

## Current search

The optimizer:

- enumerates equipped weapon skills, selected slot skills, profession mechanics,
  stateful flips, and shared actions without reading rendered HTML;
- runs the same profession adapter and simulator used by the normal results UI;
- forces deterministic randomness while searching;
- compares candidates over a user-selected 1 to 300 second window;
- preserves the current rotation's explicit precast prefix through `Combat
Start`, then measures the requested window in combat time;
- branches only through skills available at the current simulated time, or the
  earliest next cooldown when every candidate is unavailable;
- retains a small search allowance for zero-damage actions that may unlock or
  improve later damage;
- removes actions whose deletion does not reduce the final candidate's damage;
- pads a partial final cast sequence to the requested window so the optimizer
  result and the applied simulator result use the same DPS denominator;
- runs in a dedicated Web Worker with a time limit and cancellation support.

The result is the best rotation found within the search budget. It is not proof
of a globally optimal rotation. Applying the result replaces the current
rotation and reruns it through the normal simulator.

The phased target design, invariants, and agent validation gates are defined in
[ROTATION-OPTIMIZER-IMPLEMENTATION-CONTRACT.md](./ROTATION-OPTIMIZER-IMPLEMENTATION-CONTRACT.md).

## Ownership

`js/rotation-optimizer/` is a feature slice:

- `candidates.ts` builds the profession-neutral action universe from the current
  app state.
- `search.ts` owns deterministic beam search, fixed-window scoring, state
  deduplication, and redundant-action cleanup.
- `profession-loader.ts` loads only the active engine-facing profession contract
  to keep browser application code out of the worker dependency graph.
- `worker.ts` runs search off the UI thread.
- `ui.ts` mounts controls, progress, cancellation, and result application.
- `types.ts` defines the worker and search contracts.

Profession implementations should not define rotation priorities. Skill value
comes from simulated damage and future damage enabled by an action. Explicit
optimizer metadata should only be added if a mechanic cannot be observed
through the shared simulator.

## Known limitations

- Search currently emits serial casts. It does not optimize concurrent instant
  offsets or manual interrupt timings.
- Precasts are preserved from the current rotation rather than discovered by
  the search. Add `Combat Start` after the desired setup before optimizing.
- The scheduler is replayed from the start for each candidate. Snapshot-based
  branching would substantially increase search depth.
- A fixed search budget means wider profession action sets explore fewer depths.
- The configured target can still die before the selected search window. A
  future objective selector should distinguish fixed-duration damage from
  time-to-kill optimization.
