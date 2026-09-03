# Extracting Mesmer shatters from EVTC logs

This document covers only Mesmer shatter extraction. A shatter input can emit one player signal, up to three clone
signals, direct damage, clone lifecycle events, or a buff transition. The importer reduces that evidence to one
simulator cast.

The relevant implementation is in [`shared.ts`](shared.ts), [`chronomancer.ts`](chronomancer.ts),
[`mirage.ts`](mirage.ts), and the Distortion portion of [`common.ts`](common.ts).

## Shatter evidence by skill

| Shatter            | Canonical ID | Primary extraction path                                           |
| ------------------ | -----------: | ----------------------------------------------------------------- |
| Split Second       |        56930 | Chronomancer effect GUID, with direct IDs 56925/56930 as fallback |
| Rewinder           |        56928 | Chronomancer effect GUID, with direct ID 56928 as fallback        |
| Time Sink          |        56873 | Chronomancer effect GUID, with direct ID 56873 as fallback        |
| Continuum Split    |        29830 | Time Anchored buff gain, ID 30136                                 |
| Distortion         |        10192 | Distortion buff gain, ID 10243                                    |
| Cry of Frustration |        10190 | Mirage direct player damage, then effect GUID fallback            |
| Mind Wrack         |        10191 | Mirage direct player damage, then effect GUID fallback            |
| Diversion          |        10287 | Mirage effect GUID                                                |

These skill IDs are excluded from generic instant-cast inference. Only the shatter-specific paths below are allowed to
turn their packets into casts.

## Signal types

### Effect signals

EVTC effect-create events use encounter-local content IDs. `effectSignals()` resolves them as follows:

1. Read state-change `46` events.
2. Convert each event's 64-bit `source` and `target` values to little-endian bytes and concatenate them into a 16-byte
   GUID.
3. Map that event's `skillId`, the effect content ID, to the GUID.
4. Keep later events when:
   - `source === playerAddress`;
   - `skillId !== 0`;
   - the state change is `45`, `51`, `60`, `62`, or `79`;
   - the content ID maps to the requested shatter GUID.

Each matching event becomes a timestamped shatter signal. The event itself does not identify whether the source was the
Mesmer or one of their clones.

### Direct signals

`directSkillSignals()` accepts only events that:

- are sourced by the selected player, not a clone;
- use a requested shatter skill ID;
- have no state change or activation marker;
- are not buff events;
- have positive `value` or `buffDamage`.

Because clone addresses are excluded, a direct signal can serve as one player-input anchor without duplicating the cast
for every clone hit.

### Buff signals

Distortion and Continuum Split use buff gains targeting the selected player. Their buff transitions are more reliable
cast anchors than their damage or effect packets.

## Chronomancer shatters

Chronomancer uses these effect GUIDs:

| Shatter      | Effect GUID                        |
| ------------ | ---------------------------------- |
| Split Second | `C035166E3E4C414ABE640F47797D9B4A` |
| Rewinder     | `DC1C8A043ADCD24B9458688A792B04BA` |
| Time Sink    | `AB2E22E7EE74DA4C87DA777C62E475EA` |

Raw Split Second effect ID `56925` is aliased to canonical simulator ID `56930`.

### 1. Choose effect or direct evidence

For each shatter independently:

1. Collect direct player signals using the IDs in the first table.
2. Collect effect signals using the shatter's GUID.
3. If at least one effect signal exists anywhere in the log for that shatter, use effect signals.
4. Use direct signals only if the log contains no matching effect signal.

### 2. Direct-signal fallback

When no effect signal exists:

1. Sort direct signals by timestamp and event index.
2. Start a new group when the gap from the previous signal is greater than 750 ms.
3. Keep the first signal from each group as a cast.

### 3. Find owned clone lifecycle ends

When effect signals exist:

1. Find the selected player's instance ID from their first event with `sourceInstance > 0`.
2. Collect agent addresses whose normalized character name is exactly `clone`.
3. Keep lifecycle events where:
   - the source is one of those clone addresses;
   - `sourceMasterInstance` equals the selected player's instance ID;
   - the state change is `ExitCombat` or `ChangeDead`.
4. Sort them by time.
5. For the same clone address, collapse lifecycle events within 2 ms so duplicate death/exit records count once.

This prevents another Mesmer's clone deaths from consuming the selected player's signals.

### 4. Remove clone-source signals

For every owned clone lifecycle end:

1. Find unmatched shatter effect signals within plus or minus 2 ms.
2. Choose the signal with the smallest absolute timestamp difference.
3. On an equal difference, choose the later event-table index.
4. Mark that signal as consumed.

Each lifecycle end consumes at most one signal, and each signal can be consumed only once. Unconsumed signals are the
`primarySignals`, normally the player-side cast anchors.

### 5. Recover lifecycle-only casts

A valid shatter can have every observed signal consumed by clone lifecycle matching. If primary signals exist elsewhere
for that skill, `lifecycleOnlyShatterCastSignals()` recovers the missing cast:

1. Walk all effect signals in log order.
2. Skip signals already in `primarySignals`.
3. Find the latest primary or recovered signal at or before the removed signal.
4. If it is within 1,000 ms, treat the removed signal as another source from that prior cast.
5. Otherwise retain the removed signal as a new cast anchor.
6. Merge primary and recovered anchors, then cluster duplicates within 10 ms.

### 6. Fallback when every primary signal is missing

If lifecycle matching removes every primary signal for the skill's entire stream:

1. Return to all original effect signals.
2. Group signals using a 750 ms inter-signal gap.
3. Limit each group to four signals: one Mesmer and three clones.
4. Keep the first signal from each group as a cast.

The four-signal limit makes a fifth nearby signal start another shatter even if it is inside the 750 ms gap.

### 7. Create the cast

For every retained anchor:

1. Check whether the same canonical skill ID or normalized name already exists within 100 ms.
2. Skip it if an action already exists.
3. Otherwise create a zero-duration, instant canonical action at the signal timestamp.
4. Preserve the raw effect or fallback skill ID and mark the evidence as `effect`.

This process runs separately for Split Second, Rewinder, and Time Sink.

## Continuum Split

Continuum Split consumes clones but does not use clone lifecycle matching:

1. Find a gain of Time Anchored buff ID `30136` targeting the player.
2. Skip it if Continuum Split already exists within 100 ms.
3. Create canonical Continuum Split ID `29830` at the buff timestamp.

Continuum Shift is extracted from removal of the same buff when `buffRemove === 3` and the event reports more than 150
ms remaining. It is created as internal action ID `-4`.

## Mirage shatters

Mirage does not use the Chronomancer clone-lifecycle algorithm.

### Cry of Frustration and Mind Wrack

For each skill independently:

1. Collect direct player damage using its canonical skill ID.
2. If any direct signal exists, use only direct signals.
3. Otherwise use the skill's effect GUID.
4. Sort and cluster signals, keeping the first signal per cluster:
   - Cry of Frustration: 750 ms gap, GUID `52F65A4D9970954BA849CB57A46A65A8`;
   - Mind Wrack: 1,250 ms gap, GUID `3D29ABD39CB5BD458C4D50A22FCC0E4B`.
5. Skip a result if the same action already exists within 100 ms.
6. Create an instant canonical cast at the retained timestamp.

Direct clone damage cannot create duplicates because direct signals require the selected player's source address.

### Diversion

Diversion uses GUID `916D8385083F144EBAA5BEEDE21FD47A`:

1. Cluster its effect signals using a 750 ms gap.
2. Collect the reconstructed timestamps for Cry of Frustration, Mind Wrack, and Distortion.
3. Reject a Diversion signal that occurs at or after one of those shatters and no more than 1,000 ms later.
4. Skip it if Diversion already exists within 100 ms.
5. Create an instant canonical Diversion cast.

The overlap rejection prevents a shared or ambiguous effect sequence from creating an extra Diversion.

## Distortion

For Core, Chronomancer, and Mirage:

1. Find gains of Distortion buff ID `10243` targeting the player.
2. Cluster gains using a 500 ms gap.
3. Keep the first gain from each cluster.
4. Reject a gain that has no Distortion/Mind Wrack shatter effect (`3D29ABD39CB5BD458C4D50A22FCC0E4B`) within 250 ms.
5. Skip it if Distortion already exists within 100 ms.
6. Create canonical Distortion ID `10192` with `buff-transition` evidence.

The shatter-effect pairing is required because Blurred Inscriptions applies the Distortion buff on every signet use, so
the buff gain alone is not proof of a Distortion shatter. The real shatter emits both the buff and the shared shatter
effect; signet-granted distortion emits only the buff. Mind Wrack emits the effect but never the Distortion buff, so it
is not misread as Distortion.

Virtuoso and Troubadour are excluded from this Distortion path.

## Final shatter deduplication

After shatter extraction, actions are sorted by timestamp and event index. For the same canonical or raw skill ID, only
the first action within 50 ms is retained. Shatter actions at or after the encounter end are removed; Mirage alone has a
2,000 ms post-encounter input grace period.

## Clone count is not extracted from shatter packets

The importer extracts the shatter input, not its resource count. It deliberately does not:

- convert every clone packet into a cast;
- copy effect-signal count into the rotation;
- infer clone count from clone deaths;
- force the replay to reproduce the log's exact number of hits.

The simulator determines clone count by replaying clone-generating and clone-consuming actions. If the shatter cast
count is correct but its replay has too few packets, inspect clone resource timing rather than adding another shatter.

## Chronomancer examples

### One shatter with three clones

```text
11,000  effect signal, no clone lifecycle end
11,100  effect signal + clone A ChangeDead
11,200  effect signal + clone B ChangeDead
11,300  effect signal + clone C ChangeDead
```

The three lifecycle-matched signals are consumed. The 11,000 ms primary signal creates one shatter cast.

### A lifecycle-only shatter followed by another shatter

```text
11,000  effect signal + clone A ChangeDead
11,080  effect signal + clone B ChangeDead
11,700  unmatched effect signal
```

Only 11,700 is initially primary. The recovery pass keeps 11,000 because no earlier cast anchor exists. It treats 11,080
as another source within the 1,000 ms tail of the recovered cast. The result is two casts at 11,000 and 11,700.

## Exact timing constants

| Rule                                                |               Window |
| --------------------------------------------------- | -------------------: |
| Clone lifecycle duplicate suppression               |                 2 ms |
| Clone lifecycle-to-effect matching                  |   plus or minus 2 ms |
| Chronomancer primary/recovered duplicate clustering |                10 ms |
| Existing-action suppression                         |               100 ms |
| Chronomancer source-tail classification             |             1,000 ms |
| Chronomancer direct/effect grouping                 |               750 ms |
| Cry of Frustration grouping                         |               750 ms |
| Mind Wrack grouping                                 |             1,250 ms |
| Diversion grouping                                  |               750 ms |
| Diversion overlap rejection                         |             1,000 ms |
| Distortion grouping                                 |               500 ms |
| Distortion buff-to-shatter-effect pairing           | plus or minus 250 ms |
| Final same-skill deduplication                      |                50 ms |

## Focused tests

Shatter extraction tests are in
[`tests/evtc/mesmer-rotation-reconstruction.test.js`](../../../../../../../../../tests/evtc/mesmer-rotation-reconstruction.test.js),
including:

- `reconstructs Chronomancer shatters and Continuum transitions`;
- `separates a second shatter after three clone detonations`;
- `recovers a shatter whose only effect signals coincide with clone lifecycle ends`;
- `does not collapse rapid Time Sink fallback packets into one shatter`;
- `uses clone lifecycle ends to preserve rapid Chronomancer shatters across Continuum Split`;
- `preserves a shatter cast when a clone detonates at the same timestamp`.
