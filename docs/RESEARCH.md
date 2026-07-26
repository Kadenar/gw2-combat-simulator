# Mesmer data and modeling notes

Data snapshot: **2026-07-25**

## Sources

Primary profession metadata, skill IDs, descriptions, icons, specialization
membership, trait ordering, and trait descriptions come from the official Guild
Wars 2 API:

- `https://api.guildwars2.com/v2/professions`
- `https://api.guildwars2.com/v2/specializations`
- `https://api.guildwars2.com/v2/traits`
- `https://api.guildwars2.com/v2/skills`

PvE coefficients, activation times, cooldown splits, strike counts, and
condition durations come from the Guild Wars 2 Wiki:

- `https://wiki.guildwars2.com/wiki/List_of_mesmer_skills`
- `https://wiki.guildwars2.com/wiki/Mesmer_traits`
- Individual skill and trait pages linked by the simulator catalog

The supplied benchmark coefficient and timing tables take precedence for the
explicit player, clone, phantasm, shatter, bladesong, and instrument rows they
cover.

Damage-relevant attribute conversions and modifier groupings were
cross-checked against:

- `https://github.com/discretize/discretize-gear-optimizer`
- `src/assets/modifierdata/mesmer.yaml` in that project

The Wiki is used for individual skill coefficients because the optimizer models
build modifiers and benchmark distributions rather than maintaining a complete
per-skill rotation table.

## Catalog coverage

| Area | Count |
| --- | ---: |
| Mesmer skills from the official API | 123 |
| Skills with modeled strike coefficients | 78 |
| Skills with modeled damaging conditions | 25 |
| Core trait lines | 5 |
| Elite specializations | 4 |
| Total traits | 108 |

The current trait lines are Domination, Dueling, Chaos, Inspiration, Illusions,
Chronomancer, Mirage, Virtuoso, and Troubadour.

## Damage formulas

Expected strike damage uses:

```text
coefficient × weapon strength × power ÷ target armor
× expected critical multiplier × outgoing multipliers
```

Expected critical multiplier uses the configured critical chance and critical
damage. Clone attacks use the low clone weapon strengths documented by the
Wiki. Phantasms inherit player attributes and use their own source-specific
trait modifiers.

Condition damage is integrated from application time to expiration or the end
of the encounter. Expertise and condition-specific duration modifiers are
capped at 100% bonus duration. Confusion includes passive damage plus the
configured target skill-activation rate, which defaults to zero for a
non-attacking training golem. Torment uses its stationary formula
unless the target is marked as moving.

## Normalizations

The Wiki lists conditional variants as separate facts. The simulator selects
one PvE scenario rather than adding mutually exclusive values:

- Counterspell is exposed beside Illusionary Counter while scepter is active,
  but remains disabled until Illusionary Counter has been used. It uses skill
  ID 10314, a 0.5-second activation, a 0.1 strike coefficient, five confusion
  stacks for seven seconds, and creates one clone. Illusionary Counter's two
  clones require a successful enemy block, so merely activating the skill does
  not create them in the deterministic rotation.
- Spatial Surge uses maximum-range damage.
- Mirror Blade uses the maximum single-target coefficient.
- Phantasmal Disenchanter assumes a boonless target.
- Mind Slash, Ether Bolt, Lacerating Chop, and Psycut represent their complete
  autoattack chains.
- Chaos Storm is represented as six strike pulses and one expected poison
  application.
- Flying Cutter adds Cutter Burst every third cast.
- Axe clones preserve the supplied Lacerating Chop, Ethereal Chop, and Mirror
  Strikes coefficients and measured attack timings instead of collapsing the
  chain into one periodic event.
- Unstable Bladestorm uses four storm pulses and four launched blades.
- Resource-scaled shatter, bladesong, instrument, and Crescendo coefficients
  use the supplied benchmark coefficient table.

Mesmer weapon swapping is represented by a ten-second base-recharge action.
Using it toggles the active weapon set and immediately replaces the weapon
skill palette. Each swap also starts a new weapon-set row in the rotation
timeline. Its icon is the Wiki's Weapon Swap Button asset.

Shatter coefficients are resource-sensitive. Core and Chronomancer shatters
include the Mesmer's own shatter event in addition to clone events. Virtuoso
bladesongs require at least one blade and spend all stocked blades.
Shatter Storm gives Split Second two serially recharging ammo charges, and
Illusionary Reversion refunds one clone after a shatter consumes three.
Signet of the Ether clears the cooldown of every cataloged phantasm skill.

Phantasm timing uses measured endpoints rather than a generic startup,
attack-duration, and recovery estimate. Every timing is measured from the
start of the player cast: `damage` is when all phantasm damage is complete and
`spawn` is when the phantasm becomes a clone. Chronophantasma has separate
damage-complete and clone-spawn endpoints for its repeated attack. Echo of
Memory uses the Phantasmal Avenger row. Phantasmal Rogue is retained in the
timing data but is not attached to a current catalog skill. Phantasmal
Sharpshooter and Phantasmal Lancer remain marked estimates because they were
not present in the supplied timing table.

## Gear, sigils, and relics

Ascended per-slot prefix values, rune bonuses, consumables, utility conversions,
sigil stat modifiers, Jade Bot vitality, and infusion values use a local gear
data model cross-checked against the Discretize optimizer.

Each weapon set stores two sigils. Critical chance, strike and condition damage,
and condition-duration modifiers are selected from the weapon set active at the
time an event resolves; Swap Weapons changes the active modifiers. Duplicate
sigils within one set are rejected and never stack their effects.

The rotation engine models these damage relics:

- Relic of Akeem: disabling a target with at least 5 Confusion or Torment
  applies 2 stacks each of Confusion and Torment for 10 seconds, with a
  10-second internal cooldown.
- Relic of Aristocracy: applying Weakness or Vulnerability grants 3% condition
  duration per stack, up to 5 stacks; qualifying applications have a 1-second
  internal cooldown and refresh the 8-second window.
- Relic of the Eagle: 10% strike damage after accumulated runtime damage drops
  the configured target below 50% health.
- Relic of the Thief: 1% strike damage per stack, maximum 5, refreshed for 6
  seconds by qualifying weapon hits.
- Relic of Fireworks: 7% strike damage for 6 seconds after a qualifying
  20-second-or-longer base-recharge hit.
- Relic of the Claw: 7% strike damage for 8 seconds after disabling the target.
  The disabling hit itself is resolved before the buff activates.
- Relic of the Fractal: the PvE burning and torment application at the
  documented threshold and internal cooldown.
- Relic of Mistburn: 10% critical chance while at 10 or more Might.
- Relic of the Mist Stranger: 105 life-siphon damage per player hit; clone and
  phantasm hits do not trigger it.
- Relic of Peitha: qualifying Mesmer shadowsteps and Deception skills apply
  2 Torment for 7 seconds and grant 10% strike damage for 4 seconds, with a
  4-second internal cooldown.
- Relic of Thorns uses a deterministic incoming-hit assumption: the first hit
  occurs at 3 seconds and subsequent hits every 5 seconds, granting 30
  condition damage per permanent stack up to 10.

References:

- `https://wiki.guildwars2.com/wiki/Relic_of_Akeem`
- `https://wiki.guildwars2.com/wiki/Relic_of_Aristocracy`
- `https://wiki.guildwars2.com/wiki/Relic_of_the_Eagle`
- `https://wiki.guildwars2.com/wiki/Relic_of_the_Thief`
- `https://wiki.guildwars2.com/wiki/Relic_of_Fireworks`
- `https://wiki.guildwars2.com/wiki/Relic_of_the_Claw`
- `https://wiki.guildwars2.com/wiki/Relic_of_the_Fractal`
- `https://wiki.guildwars2.com/wiki/Relic_of_Mistburn`
- `https://wiki.guildwars2.com/wiki/Relic_of_the_Mist_Stranger`
- `https://wiki.guildwars2.com/wiki/Relic_of_Peitha`
- `https://wiki.guildwars2.com/wiki/Relic_of_Thorns`

## Known boundaries

- The engine assumes attacks hit one benchmark target.
- Phantasm and clone travel time is represented by fixed delays.
- It uses expected critical-condition applications instead of random trials.
- Bloodsong turns expected bleeding applications into deterministic blades at
  each five-stack threshold.
- Continuum Split restores cooldown state. It does not restore clones because
  the live mechanic does not restore illusions.
- Troubadour Call and Response is cataloged but not simulated. Its effect
  depends on instrument performance interactions that the available benchmark
  data does not define reliably.
- Boon generation, healing, barriers, control damage, stealth, distortion,
  aegis, and defensive traits are outside the damage total.
- Damage-affecting Air, Torment, Earth, Blight, Doom, Geomancy, Hydromancy,
  and Severance sigil procs are resolved with their trigger cooldowns. Energy
  remains outside the damage total because endurance is not simulated.
- Competitive PvP and WvW splits are intentionally excluded.

When live balance changes, regenerate the metadata-only
`js/professions/mesmer/data/mesmer-catalog.js` from the current API, update
simulator mechanics in the Mesmer-owned skill, profession, or illusion data
modules under `js/professions/mesmer/data/`, or
the authoritative authored skill table as appropriate, update the snapshot
date, and rerun the test suite and `tests/browser/browser.html`.
