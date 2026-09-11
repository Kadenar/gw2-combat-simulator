# EVTC import

Parses local `.evtc`, `.evtc.zip` and `.zevtc` files entirely in the browser. Archives are validated before parsing
agents, skills and combat events. Player selection uses profession/specialization and usable evidence; ambiguous ties
require explicit selection. CLI and application imports share the same adapter.

## Cast evidence

Animation decoding follows EI commit `d7f186c8579a5cab4ed362f0703e49e4a81b9a2a`. The ArcDPS header build selects modern
state changes or legacy activations, even for stop-only logs. Starts/stops pair within actor and skill groups. An
unmatched stop is accepted only if `stop time - duration` is strictly before the recording boundary, defined by the
first timed record in the file. Missing stops are capped by recording end; unknown casts are truncated at the next cast
start plus EI's 10 ms server delay. Player animations lasting at most 1 ms are excluded. Source duration, status,
acceleration and saved time are retained separately from replay commands.

`rotation/ei-rules.ts` lists explicit ordinary EI finders with evidence IDs/GUIDs, build ranges, offsets, duplicate
windows, origin and accuracy. `ei-inference.ts` implements buff gain/loss/give, damage, effect source/destination,
missile creation, minion animation and minion command evidence. Ordinary buff gain rejects initial snapshots and
extensions. Effect namespaces remain separate; secondary effects and effect-availability gates are checked where
declared. Stable nested minion ownership is supported; ambiguous reused instances or changing masters are rejected
pending time-aware ownership.

`ei-custom-casts.ts` implements ProfHelper's buff- and effect-based animated finders, including their explicit
initial-application exceptions and suppression when a decoded animation exists. `ei-minions.ts` implements Ranger
pet/Reaper spawn rules and Chronomancer shatter effect/clone checks. An existing minion alone does not imply a summon.
Engineer kit identification requires an actual kit swap and a subsequent represented bundle animation.

Declared missile finders follow EI's pinned `MissileCastFinder`: accept the player's `MissileCreate` state (57), retain
its timestamp and accurate skill-origin metadata, and collapse projectiles using EI's sliding 50 ms duplicate window per
skill/caster. Launch/remove events and damage do not supply these casts. Unsupported effect fallbacks with secondary
same-source checks and missile-availability gates remain excluded; ambiguous evidence must not guess a skill.

Coverage is intentionally incomplete. Unsupported extension healing/barrier and custom checker families are not replaced
by generic damage or catalog guesses. Mechanist summon/recall skills are intentionally outside simulator scope. See the
[coverage inventory](../../../../../../docs/LOG-IMPORT-EI-ALIGNMENT.md) for the pinned finder exclusions. This
implementation is not a full EI parity certification; encounter logic and time-aware ownership remain limited.

## Normalization and timing

Shared `../lib/rotation/professions/` rules convert represented identities, chains and composites. Source actions remain
separate, including cast origin and EI rule provenance. Automatic procs do not become independent replay inputs.
Read-only packet/proc observations remain available and never inject casts or simulator state.

Combat start uses the selected player's enter-combat record, falling back to recording start. It is not moved to a first
damage packet. Encounter-end filtering retains starts strictly before the existing target death/exit boundary; full
evidence can still finish a retained animation. This target heuristic is not EI encounter-specific fight logic.

Commands preserve waits and observed overlap, using simulator timing and quantized cancellations where needed. Missing
setup, initial summons, dependent skills, resources and later repeats never construct extra preparation or reset state.
Manual precasts, saved rotations and normal simulator defaults remain available.

Every successful import returns this informational notice once:

> The log may omit opening casts or pre-combat setup. Review and complete the opener before simulating.

Unsupported mappings, unknown animations and missing interruption commit metadata have separate warnings. An incomplete
opener is a successful import and can require manual repair before simulation.

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

## Source layout

- `decompression.ts`, `parser.ts`: archive safety and binary validation.
- `recording.ts`: timed record boundary and animation encoding selection.
- `rotation/animations.ts`: EI animation pairing and metadata.
- `rotation/ei-*.ts`: explicit EI evidence finders.
- `rotation/professions/index.ts`: EVTC-specific represented variants and shared normalization bridge.
- `rotation/professions/`: read-only profession proc observations.
- `rotation/reconstruct.ts`: selection, evidence, encounter filtering, catalog resolution and command conversion.

Use [dps.report import](../dps-report/README.md) for supplied EI rotations. Comparing the adapters requires matching EI
version, player, origin and observation window; a report may legitimately include finders unsupported by this adapter.
