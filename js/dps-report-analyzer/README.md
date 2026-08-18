# dps.report analyzer

This folder converts the public Elite Insights JSON behind a dps.report link into simulator rotation commands. It is
parallel to `evtc-analyzer`, but its input is intentionally narrower:

1. `url.ts` resolves a permalink and fetches `dps.report/getJson`.
2. `parser.ts` validates the player, phase, skill-map, and cast-group contracts.
3. `rotation/registry.ts` selects a player and dispatches through the same 45 profession/specialization profiles used by
   EVTC reconstruction.
4. `rotation/reconstruct.ts` filters automatic procs, builds a chronological cast timeline, resolves active-catalog
   skills, and emits simulator commands.
5. `rotation/professions/<profession>.ts` owns profession-wide corrections, while
   `rotation/professions/<profession>/<specialization>.ts` owns specialization-specific reconstruction. This mirrors the
   `evtc-analyzer` layout.

## Known limits

Elite Insights rotation JSON is a cast summary, not a replacement for raw EVTC events. It does not expose every effect
packet, buff transition, initial state, or inferred instant action. Missing actions are only recovered when later casts
provide a profession-specific dependency or repeated-cycle proof:

- Engineer reconstructs Bomb Kit equips from kit weapon skills and Throw Mine from otherwise impossible Detonate Mine
  casts.
- Elementalist normalizes attunement-dependent skills and Aerial Agility chains, preserves shortened channels, and
  recovers otherwise omitted aura and Blinding Flash casts from build-gated buff and condition evidence.
- Luminary reconstructs the opening Radiant Courage and Radiant Forge state from Forge-only skills and the later
  reported activation cadence. Internal Forge transitions are separated from physical weapon swaps.
- Herald reconstructs opening facet consumes and a precombat Spiritcrush from dependent consumes and the later repeated
  Shortbow cycle. Automatic Song of the Mists calls are left to the simulator's trait logic.
- Conduit reconstructs omitted weapon/legend precasts from the opening upkeep release and later repeated skill set.
  Split Deathstrike and Phantom's Onslaught animations are merged, while generated Dervish attacks remain simulator
  effects.
- Renegade reconstructs omitted opening warband summons from a later repeated legend cycle, normalizes legend changes,
  and canonicalizes enhanced skill signals to actionable simulator skills.

When the available report data does not provide that evidence, the analyzer keeps the import conservative and presents a
review warning.

The app accepts either a dps.report link or a downloaded raw Elite Insights JSON file.
`scripts/analysis/analyze-dps-report.mjs` remains a separate forensic tool for inspecting the private data embedded in
rendered report HTML.
