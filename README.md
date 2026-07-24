# Guild Wars 2 Mesmer Simulator

A standalone, deterministic PvE build and rotation simulator for:

- Core Mesmer
- Chronomancer
- Mirage
- Virtuoso
- Troubadour

Its application, core calculations, data, fixtures, scheduler, and resolver all
live inside `mesmer-simulator/`; it has no external simulator dependency.

## Run

Node.js 20 or newer is required.

```powershell
cd mesmer-simulator
npm start
```

Open `http://127.0.0.1:4173`.

No dependency installation or build step is required.

## Test

```powershell
npm test
npm run check
```

## Included

- All 9 current Mesmer trait lines and all 108 traits.
- Complete gear selection for every armor, trinket, and weapon slot.
  Attributes are derived from prefixes, runes, sigils, relics, food, utility,
  Jade Bot core, infusions, selected traits, and equipped signets.
- Two independently selected weapon sets with two unique sigils per set and an
  attribute-panel set selector. The rotation's Swap Weapons action changes the
  active skill palette and sigil bonuses, tracks its recharge, and uses the
  Guild Wars 2 weapon-swap icon.
- All 127 skills returned for Mesmer by the Guild Wars 2 API, including aquatic
  and downed skills in the catalog. The rotation UI uses terrestrial skills.
- PvE skill coefficients and condition applications from the Guild Wars 2 Wiki.
- Full-chain normalization for sword, scepter, axe, and land spear autoattacks.
- Configurable target skill activations per second for Confusion, defaulting
  to zero for a non-attacking training golem.
- Configurable golem health with runtime death, kill time, and automatic
  above/below-50% damage modifier transitions.
- Permanent target conditions matching the Elementalist simulator. These count
  for condition-dependent traits and relics without crediting their external
  damage to the player.
- Cooldowns, quickness, alacrity, might, fury, expected critical hits, target
  armor, vulnerability, strike damage, and damaging conditions.
- Clone creation, replacement, autoattacks, and shattering.
- A live profession-resource display showing active clones, stocked blades, or
  notes after the currently queued rotation.
- Scepter's Illusionary Counter and Counterspell flip skill, including
  Counterspell's gated one-clone generation.
- Shatter Storm's second Split Second charge and Illusionary Reversion's
  three-clone shatter refund.
- Signet of the Ether recharge resets for all phantasm skills.
- Measured phantasm damage-complete and clone-conversion timings, including
  separate Chronophantasma repeat endpoints.
- Continuum Split and manual or automatic Continuum Shift cooldown restoration.
  Continuum Shift sits beside Continuum Split and is enabled only during an
  active split window.
- Mirage Cloak ambushes and Infinite Horizon clone ambushes.
- Virtuoso blade stocking, bladesongs, Infinite Forge, Jagged Mind, and
  Bloodsong's deterministic expected blade generation.
- Troubadour notes, instrument durations, Crescendo scaling, Shredding,
  Fortissimo, and Altered Chord.
- An icon rotation builder with live cooldown badges,
  automatic cooldown waiting, weapon-set timeline rows, timeline reordering,
  Shift+click concurrent instant casts, Ctrl+click interrupts, explicit waits,
  save/load, and browser-local persistence.
- Results with a summary strip (including kill time when the target dies), icon-backed
  per-skill strike/condition/DPS/cast metrics, per-condition damage and average
  stacks, a proc row, and DPS/effect timelines.
## Project layout

```text
mesmer-simulator/
  css/          visual system
  js/app/       UI, persistence, import/export, rotation builder
  js/core/      gear-derived attributes and damage helpers
  js/data/      gear, trait, specialization, and skill catalogs
  js/fixtures/  deterministic and browser interaction fixtures
  js/sim/
    scheduler/  rotation scheduling, state, intents, and event creation
    resolver/   runtime context, hits, conditions, triggers, and application
    shared/     scheduled-stream contract and stable chronological queue
    mechanics/  split skill/illusion/profession data and runtime rules
    sim-engine  public orchestration API
  tests/        Node regression tests
```

## Scope

This is a deterministic damage simulator. It does not reproduce networking,
animation canceling, projectile travel, target hitboxes, enemy movement,
encounter phases, healing, control effects, or every non-damage trait. Chaos
Storm uses a fixed damaging-condition assumption instead of random rolls.

All traits are selectable and documented. Damage-relevant effects listed in
`RESEARCH.md` are modeled; defensive, healing, control-only, and unsupported
boon-generation effects do not contribute to the damage total.

See [RESEARCH.md](./RESEARCH.md) for data sources, coefficient decisions, and
formula details.
