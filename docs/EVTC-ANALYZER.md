# Browser EVTC Analyzer

The home page's **Log analysis** section accepts uncompressed `.evtc`,
ZIP-compressed `.evtc.zip`, and `.zevtc` training-golem logs. The browser reads
the selected file into an `ArrayBuffer`, transfers ownership to a dedicated Web
Worker, and performs decompression, parsing, encounter validation, player
detection, generic analysis, and profession analysis there.

The analyzer does not call `fetch`, `XMLHttpRequest`, `sendBeacon`, dps.report,
or any server API. It does not store the log, character name, or account name in
browser storage. Worker results omit account names and raw combat events.
Resetting the surface terminates the active worker and releases the transferred
file buffer.

## Supported EVTC data

Combat-event revisions 0 and 1 are parsed explicitly. Revision 0 legacy buff
applications and revision 1 `CBTS_BUFFAPPLY` events are both available to
analyzers. Unknown revisions fail with a structured error instead of being
interpreted as a known record layout.

ZIP inputs may contain one stored or raw-deflate entry. The adapter validates
the central directory, local entry, compression method, expanded size, and CRC.
Raw deflate uses the browser's `DecompressionStream` only after feature and
format detection; stored ZIP entries and uncompressed EVTC remain available
without it. Unsupported compression receives a controlled error.

Safety limits are centralized in `js/evtc-analyzer/parser.ts` and
`js/evtc-analyzer/decompression.ts`:

- 64 MiB maximum compressed input
- 512 MiB maximum expanded EVTC
- 200:1 maximum declared expansion ratio
- 100,000 agents
- 100,000 skills
- 8,000,000 64-byte combat events
- complete agent, skill, and event records required

## Encounter validation

Only Special Forces Training Area golems are accepted. Validation uses the EVTC
trigger ID and a matching stable NPC species ID, never the filename or an agent
name. When `CBTS_MAPID` is present, it must identify map 1154. The current
allowlist is:

- Massive Kitty Golem: 16169 (10M), 16202 (4M), and 16178 (1M)
- Vital Kitty Golem: 16198
- Average Kitty Golem: 16177
- Standard Kitty Golem: 16199
- Large Kitty Golem: 19676
- Medium Kitty Golem: 19645
- Tough Kitty Golem: 16174
- Resistant Kitty Golem: 16176

The log must also contain a real player, player-originated damage against the
recognized target, and a usable damage interval. Raid, strike, fractal,
open-world, PvP, WvW, and unknown triggers are rejected before any profession
module is loaded.

## Analysis results

Generic results include combat duration, outgoing strike and condition damage,
connected/critical/non-critical hits, per-skill damage and final-damage roll
distributions, casts, weapon swaps, actions per minute, and outgoing buff or
condition applications. Player-owned agents are attributed through EVTC master
instance IDs.

Actions per minute (`generic.actionsPerMinute`) is derived from the same
selected-player cast and weapon-swap events used elsewhere, divided by the
damage-interval duration. A cast is a skill activation that reached its tooltip
time (arcdps `ACTV_CANCEL_FIRE`); cancelled activations are not counted.
`castApm` counts skill casts only, while the headline `apm` adds weapon swaps.
Because the duration basis is the first-to-last damage interval, cast or swap
events outside that window are still counted as actions but do not extend the
denominator.

The home-page result prioritizes profession RNG sections. Combat totals are
shown as supporting context, while per-skill damage and roll data remain in a
collapsed technical-details disclosure.

EVTC does not normally contain the complete coefficient, Power, target armor,
modifier, critical multiplier, and damage-type inputs needed to reconstruct an
absolute weapon-strength sample. The analyzer therefore labels these results as
observed final-damage distributions, provides within-skill normalization, and
returns `weaponStrength.status = "unavailable"` with the missing inputs. It does
not assume a build.

If one player clearly supplied the benchmark damage, that player is selected.
When multiple players each dealt at least 1% of the leading player's damage,
the UI asks the user to choose rather than guessing.

## Profession analysis and attribution

Necromancer is the first profession analyzer. Its Barbed Precision section uses
the simulator's trait ID, chance, duration, and direct-skill mechanics. It
correlates player critical strikes and Bleeding applications by source, target,
time, duration, known direct applications, and condition-transfer collisions.

EVTC does not prove that Curses or Barbed Precision was equipped and does not
always label the causal source of a Bleeding application. Results therefore
state that expectation is conditional on the trait being equipped. Fully
classified candidates are marked **exact**; duration-dependent candidates are
**inferred**; transfer collisions, multiple criticals, and same-timestamp
collisions are **ambiguous** and report minimum/maximum bounds.
Bounded results also report a proc-rate range and a proc-count difference range
relative to expectation instead of hiding those values.

When the log contains a dominant, non-conflicting Bleeding-duration cohort tied
to critical hits, the analyzer derives that duration as the player's observed
Barbed Precision signature. This accounts for Bleeding duration from the build
without assuming its equipment and preserves matching proc applications that
occur beside a direct skill's longer-duration Bleeding. Applications outside
that derived signature, or beyond Barbed Precision's 100% condition-duration
cap, are excluded. Ambiguous upper bounds use one-to-one matching between
applications and eligible critical hits, so the reported proc rate cannot
exceed 100%.

## Adding a profession RNG analyzer

1. Add a module under `js/evtc-analyzer/professions/` implementing
   `EvtcProfessionAnalyzer` from `contract.ts`.
2. Register a dynamic import in `professions/registry.ts`, keyed by base
   profession. Specialization loaders can augment the base result without
   changing the parser.
3. Use `EvtcAnalysisContext` indexes and ownership queries. Do not rescan the
   original byte buffer or parse EVTC fields in the profession module.
4. Return serializable sections with an exact, inferred, or ambiguous status,
   evidence, and explicit assumptions.
5. Add generated binary-fixture tests. Do not commit personal combat logs.

The generic parser has no imports from profession analyzers. Unsupported
professions still receive complete generic analysis.
