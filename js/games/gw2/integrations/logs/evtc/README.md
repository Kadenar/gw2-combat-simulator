# EVTC Analyzer

The EVTC adapter parses ArcDPS combat logs and reconstructs recorded player actions as rotations that can be loaded into
the Guild Wars 2 Combat Simulator.

Unlike the dps.report adapter, which works from summarized Elite Insights JSON, this analyzer operates directly on the
raw EVTC event stream. That gives it access to animation events, state changes, buff transitions, effect packets, weapon
swaps, combat state, and other information that may no longer be present in a processed report.

## Supported Inputs

The simulator accepts:

- `.evtc`
- `.evtc.zip`
- `.zevtc`

Uncompressed EVTC data is parsed directly.

ZIP-compressed logs are expanded in the browser before parsing. EVTC ZIP archives must contain a single unencrypted
entry using either stored or deflate compression.

All processing is performed client-side.

## What the Analyzer Does

The EVTC import pipeline consists of three main stages:

1. **Decompression** — expands compressed EVTC files and validates archive safety limits.
2. **Parsing** — reads the binary EVTC header, agent table, skill table, and combat-event records.
3. **Rotation reconstruction** — identifies a player, interprets their recorded combat events, applies
   profession-specific corrections, and produces simulator rotation commands.

The resulting rotation attempts to preserve both the actions that were used and their recorded timing.

## EVTC Parsing

`parser.ts` reads the raw ArcDPS EVTC binary format.

It extracts:

- ArcDPS build information
- EVTC revision
- Encounter ID
- Agents
- Player profession and elite specialization data
- Skill metadata
- Combat events
- Activation records
- Buff events
- State changes
- Weapon swaps
- Animation events

Both EVTC combat-event revisions currently used by the parser are supported.

The parser also recognizes the optional ArcDPS footer that may appear after the combat-event table.

## Player Detection

Players are identified from EVTC agent metadata and mapped to their Guild Wars 2 profession and specialization.

When the simulator imports a log, it searches for a player matching the currently active profession and specialization.

If multiple matching players are present, the player with the greatest number of reconstructable actions is preferred.
If the leading candidates are tied, automatic selection is considered ambiguous and the import is rejected rather than
silently choosing the wrong player.

## Rotation Reconstruction

Rotation reconstruction uses several forms of EVTC evidence.

### Skill Animations

Modern EVTC logs expose animation start and stop events. These are paired to determine:

- Skill start time
- Skill end time
- Recorded cast duration
- Completed casts
- Interrupted casts
- Incomplete animations

Older EVTC activation records are also supported when modern animation events are not available.

### Weapon Swaps

Weapon-swap state changes are converted into simulator weapon-swap commands.

Profession mechanics that internally resemble weapon swaps can suppress these events when appropriate so they are not
mistaken for physical weapon changes.

### Buff and State Transitions

Some profession mechanics are represented more reliably by buff transitions than by normal skill animations.

Profession profiles can convert configured buff gains or losses into actions such as transformation, legend, kit, or
other state changes.

Initial buff state may also be used to reconstruct a transformation or precast that began before the visible combat
timeline.

### Instant Casts

Some zero-cast-time actions do not produce a normal animation event.

When enabled, the analyzer can infer supported instant skills from direct player-generated effect packets when those
effects provide sufficient evidence that the skill was activated.

These actions are marked as inferred so the importer can surface that distinction to the user.

### Precasts and Initial State

The raw EVTC stream can contain evidence of actions or state that existed before combat officially began.

Profession-specific reconstruction can use this information to recover certain:

- Precast skills
- Initial summons
- Transformations
- Profession states
- Opening resources or mechanics

The analyzer also records the combat-start boundary when it can be identified or reconstructed.

### Interruptions and Timing

Recorded cancelled autoattacks are preserved as interrupted cast commands. This keeps leaked autoattack inputs visible
and prevents them from being mistaken for idle time.

For other skills, a recorded interruption is used only when the simulator catalog defines a safe commit cutoff.
Otherwise the command uses the simulator's normal cast behavior.

Intervals with no recorded action are represented with explicit simulator wait commands. Overlapping or independently
cast actions retain their relative timing through command offsets. The importer does not change skill, cooldown,
resource, or proc behavior to match a log.

## Profession-Specific Reconstruction

EVTC provides much more information than processed report JSON, but many Guild Wars 2 profession mechanics still require
contextual interpretation.

The reconstruction system therefore uses profession and specialization profiles.

Profiles define information such as:

- Skill aliases
- Skill ID aliases
- Dodge behavior
- Buff-driven state transitions
- Initial summons
- Instant skills that should not be inferred generically
- Profession-specific combat-start behavior

Additional profession modules can then reconcile raw EVTC actions and effect packets into the simulator's canonical
representation.

The current profile registry covers all nine professions and their registered supported specializations.

## Simulator Catalog Integration

Whenever possible, recorded EVTC skills are resolved against the simulator's active skill catalog.

This allows imported actions to use the same canonical skill IDs, names, cast times, and behavior as manually authored
rotations.

Recorded actions that cannot be found in the active catalog are preserved in the reconstruction result but reported as
unsupported.

This is particularly useful when:

- A log contains skills not yet implemented by the simulator.
- The active build does not match the recorded build.
- A Guild Wars 2 update has changed skill IDs or behavior.
- The parser encounters an action it cannot confidently canonicalize.

## Import Warnings

Combat-log reconstruction is intentionally transparent about uncertainty.

The analyzer can report warnings when:

- Instant casts were inferred from effect packets.
- Recorded actions are missing from the simulator catalog.
- An animation has no matching stop event.
- A cast was interrupted but lacks simulator commit metadata.

These warnings do not necessarily mean the import failed. They identify places where the reconstructed rotation deserves
review.

## Safety Limits

EVTC files are treated as untrusted binary input.

The parser and decompressor enforce limits intended to prevent malformed or unexpectedly large files from exhausting
browser resources.

Current limits include:

- Maximum compressed ZIP size: **64 MiB**
- Maximum expanded EVTC size: **512 MiB**
- Maximum ZIP expansion ratio: **200×**
- Maximum agents: **100,000**
- Maximum skills: **100,000**
- Maximum combat events: **8,000,000**

ZIP archives must:

- Contain exactly one file
- Not be encrypted
- Use supported compression
- Pass CRC validation
- Not require ZIP64

## Project Structure

```text
js/games/gw2/integrations/logs/evtc/
├── decompression.ts
├── errors.ts
├── parser.ts
├── profession-metadata.ts
├── types.ts
└── rotation/
    ├── catalog.ts
    ├── effect-packets.ts
    ├── encounter.ts
    ├── index.ts
    ├── profiles.ts
    ├── reconstruct.ts
    ├── registry.ts
    └── professions/
```

### `decompression.ts`

Handles raw and ZIP-compressed EVTC input and applies archive safety validation.

### `parser.ts`

Parses the binary ArcDPS EVTC format into agents, skills, combat events, and header metadata.

### `profession-metadata.ts`

Maps EVTC profession and elite-specialization identifiers to the simulator's profession model.

### `rotation/catalog.ts`

Resolves recorded skills against the active simulator skill catalog.

### `rotation/reconstruct.ts`

Orchestrates player selection, animation pairing, state changes, buff transitions, weapon swaps, and supported effect
evidence to build the action timeline.

It also preserves cancelled actions, explicit idle waits, combat start, and overlapping actions when converting that
timeline into simulator commands.

### `rotation/players.ts`

Ranks source-specific player evidence and resolves explicit addresses. Dispatch and direct profile reconstruction use
the shared log-selection helper through this module while retaining EVTC validation errors.

### `rotation/animations.ts`

Pairs modern start/stop events and both legacy activation encodings, preserving event order, unmatched starts, and
clipped precasts before profession inference.

### `rotation/effect-packets.ts`

Reconciles recorded casts with their associated effect packets when additional evidence is required to determine the
canonical action or outcome.

### `rotation/profiles.ts`

Extends the shared profession profiles with EVTC-only effects, buff transitions, summons, and combat-start evidence.

### `rotation/professions/`

Contains profession- and specialization-specific logic for mechanics that require contextual interpretation beyond the
generic EVTC event model.

## Limitations

EVTC reconstruction should still be considered an interpretation of a combat log rather than a perfect recording of
player input.

ArcDPS records combat state and game events, not keyboard input. Some actions may:

- Produce no unique event.
- Share effects with another skill.
- Begin before the log starts.
- Be generated automatically by traits or profession mechanics.
- Appear differently between ArcDPS revisions.
- Be impossible to distinguish without knowing the player's build.

The analyzer therefore avoids guessing whenever the available evidence is insufficient.

Automatic effects already modeled by the simulator should generally remain simulator effects instead of being inserted
as explicit rotation actions.

Imported rotations should be reviewed before being used as authoritative benchmark reproductions.

## Relationship to dps.report Analyzer

Both analyzers ultimately serve the same purpose: converting recorded Guild Wars 2 combat into simulator rotation
commands.

The difference is the available source data:

|                         | EVTC adapter             | dps.report adapter              |
| ----------------------- | ------------------------ | ------------------------------- |
| Input                   | Raw ArcDPS EVTC          | Elite Insights JSON             |
| Animation events        | Yes                      | Summarized casts only           |
| Raw effect packets      | Yes                      | Limited / summarized            |
| Buff transitions        | Yes                      | Limited                         |
| Weapon/state changes    | Yes                      | Limited                         |
| Initial-state evidence  | Yes                      | Limited                         |
| Convenience             | Requires combat log      | Can import a public link        |
| Reconstruction fidelity | Preferred when available | Best-effort from processed data |

Use the original EVTC log when maximum reconstruction fidelity is important. Use dps.report import when the original log
is unavailable or when importing directly from an existing report is more convenient.
