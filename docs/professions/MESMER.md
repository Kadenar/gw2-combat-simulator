# Mesmer implementation and modeling notes

Data snapshot: **2026-08-07**

## Architecture

Mesmer is a native shared-engine profession. `catalog.ts` merges generated API
identity, positive-ID supplemental identity, ID-keyed mechanics, and the
negative-ID simulator actions. Ordinary effects use shared declarative
scheduling; exceptional shatters, bladesongs, instruments, phantasms, ambushes,
flips, resources, and Continuum actions select registered `mesmer.*` handler
strategies by stable ID.

The shared scheduler owns casts, cooldowns, ammo, weapon sets, and canonical
events. Mesmer state machines live in `core/` or the owning
`specializations/<elite>/` slice and publish future changes through typed tasks;
each simulation receives its controllers explicitly through scheduler context.
The shared resolver owns standard damage and conditions, and Mesmer adds only
profession-specific reactions such as Ineptitude and Bloodsong.

Display names are labels. Runtime routing, resource causes, flip relationships,
trait decisions, palette mechanics, and timing all key off skill or trait IDs.
Legacy name rotations are resolved at the build-migration boundary.

## Sources

Profession metadata, skill IDs, descriptions, icons, specialization membership,
and traits come from the official Guild Wars 2 API (`/v2/professions`,
`/v2/specializations`, `/v2/traits`, `/v2/skills`). PvE coefficients, activation
times, cooldowns, strike counts, and condition durations come from the Guild
Wars 2 Wiki, with supplied benchmark logs taking precedence for the player,
clone, phantasm, shatter, bladesong, and instrument rows they cover. Attribute
conversions and additive/multiplicative modifier groupings were cross-checked
against the Discretize gear optimizer.

## Damage formulas

Expected strike damage uses:

```text
coefficient × weapon strength × power ÷ target armor
× expected critical multiplier × outgoing multipliers
```

Clone attacks use low clone weapon strengths; phantasms inherit player
attributes with their own source-specific trait modifiers. Condition damage is
integrated from application to expiration or encounter end, with expertise and
condition-specific duration capped at +100%. Confusion includes passive damage
plus the configured target activation rate (zero for a stationary golem), and
Torment uses its stationary formula unless the target is marked as moving.

## Normalizations

The Wiki lists conditional variants as separate facts; the simulator selects one
PvE scenario per skill rather than modeling mutually exclusive values — for
example maximum-range or maximum single-target coefficients, boonless targets,
and deterministic clone/flip creation. Autoattack steps are separate catalog
skills connected by stable chain IDs. Per-skill coefficients, timings, strike
counts, and resource costs live in
`js/professions/mesmer/mechanics/skill-mechanics.ts`.

Weapon swapping has no out-of-combat recharge and a ten-second in-combat
recharge; using it toggles the active set and replaces the weapon-skill palette.
Shatter coefficients are resource-sensitive, and Virtuoso bladesongs require and
spend all stocked blades. Phantasm timing uses ID-keyed measured endpoints
(player-cast-relative `damage` completion and `spawn`-to-clone points) rather
than generic startup estimates.

## Gear, sigils, and relics

Prefix values, rune bonuses, consumables, sigil modifiers, Jade Bot vitality,
and infusions use a local gear data model cross-checked against the Discretize
optimizer. Each weapon set stores two sigils; the active set's modifiers apply
at resolve time, and duplicate sigils within a set are rejected. Supported
damage relics and damage-affecting sigil procs are modeled with their documented
thresholds and internal cooldowns.

## Known boundaries

- The engine assumes attacks hit one benchmark target, and phantasm and clone
  travel time is represented by fixed delays.
- Expected critical-condition applications are used instead of random trials;
  Bloodsong converts expected bleeding into deterministic blades at each
  five-stack threshold.
- Continuum Split restores cooldown state but not clones, matching the live
  mechanic.
- Ally healing, barriers, control damage, stealth, and defensive effects stay
  outside the damage total; boon and distortion applications are still emitted.
- Full endurance is not simulated; dodge charges model the relevant Mirage and
  Troubadour interactions.
- Competitive PvP and WvW splits are excluded.

When live balance changes, regenerate the metadata-only
`js/professions/mesmer/data/mesmer-api-metadata.js` from the current API, update
simulation-affecting fields in
`js/professions/mesmer/mechanics/skill-mechanics.ts`, refresh the snapshot date,
and rerun the test suite and browser fixtures.
