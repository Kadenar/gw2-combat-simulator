# GW2 DPS Calculator & Rotation Builder

A single-page application for simulating Guild Wars 2 Elementalist combat rotations, calculating DPS (damage per second), and analyzing the contribution of individual modifiers (sigils, relics, boons, traits).

---

## Running the App

Requires a local web server (file:// won't work due to CSV fetch).

```bash
# From the GW2 directory:
python -m http.server 8000
# Then open http://localhost:8000
```

---

## Current Status

This document reflects the current folderized codebase.

- `README.md` stays as the user-facing overview.
- Older planning and refactor notes are archived separately.
- The simulator now has an explicit `schedule -> resolve` split internally.

The most useful mental model is:

**UI/build state -> prepare run -> schedule timed events -> resolve queued events -> summarize results**

---

## Project Structure

> Port note: this document describes the original Elementalist repository.
> In the combined simulator, these files live under
> `js/professions/elementalist/`. Shared damage, attribute, equipment,
> event-queue, I/O, and UI helpers live under `js/platform/` or `js/app/`.
> The original browser fixture harness was not ported because nothing in the
> application or test suite referenced it; combined-repository regression
> fixtures remain under `tests/`.

```
GW2/
├── index.html                         # Main app entry
├── fixtures.html                      # Fixture harness entry
├── css/style.css                      # App styling
├── js/
│   ├── app/                           # Browser UI and state wiring
│   │   ├── app.js
│   │   ├── app-runtime.js
│   │   ├── app-state.js
│   │   ├── app-io.js
│   │   ├── app-rotation-ui.js
│   │   ├── app-optimizer.js
│   │   └── gw2-api.js
│   ├── core/                          # Shared math/build calculations
│   │   ├── calc-attributes.js
│   │   └── damage.js
│   ├── data/                          # Static data and CSV loading
│   │   ├── csv-loader.js
│   │   ├── gear-data.js
│   │   └── traits-data.js
│   ├── optimizer/                     # Gear optimizer + worker
│   │   ├── optimizer.js
│   │   └── optimizer-worker.js
│   ├── fixtures/                      # Fixture harness runtime
│   │   ├── fixture-harness-core.js
│   │   └── fixture-harness-page.js
│   ├── sim/                           # Internal simulator modules
│   │   ├── run/
│   │   ├── scheduler/
│   │   ├── resolver/
│   │   ├── shared/
│   │   ├── state/
│   │   └── mechanics/
│   └── simulation.js                  # Public simulation engine root
├── csv input/
│   ├── Tool_Elementalist - Skills_data.csv
│   └── Tool_Elementalist - Skill_hits_data.csv
├── fixtures/                          # Saved fixture states + baselines
├── TODO/                              # User todo list + internal technical roadmap
└── outdated docs/                     # Archived planning/refactor notes
```

**Note:** Gear prefixes, runes, food, utility, sigils, weapons, relics, and traits are hardcoded in JavaScript (`js/data/gear-data.js` and `js/data/traits-data.js`). Only Skills and Skill_hits data are loaded from CSV.

---

## Architecture Overview

```
index.html / fixtures.html
        │
        ├── js/app/app.js
        │       │
        │       ├── js/app/* helpers
        │       ├── js/data/*
        │       ├── js/core/*
        │       └── js/sim/run/sim-runner.js
        │               │
        │               └── js/simulation.js
        │                       │
        │                       └── js/sim/run/sim-run-orchestration.js
        │                               │
        │                               ├── js/sim/scheduler/*
        │                               ├── js/sim/shared/sim-scheduled-event-stream.js
        │                               └── js/sim/resolver/*
        │
        └── js/fixtures/fixture-harness-page.js
                │
                └── js/fixtures/fixture-harness-core.js
```

---

## Current Code Layout

### `js/app/`

Browser-facing application code.

- UI rendering
- DOM event wiring
- build/rotation snapshot handling
- optimizer panel integration
- GW2 icon/API helpers

### `js/core/`

Shared calculations used by multiple parts of the project.

- attribute calculation
- strike/condition damage formulas

### `js/data/`

Project data sources.

- static gear/trait data
- CSV loading for skills and hit tables

### `js/optimizer/`

The gear optimizer and its worker entry.

### `js/fixtures/`

The regression harness used to compare current behavior against saved baselines.

### `js/sim/`

The internal simulator, split by responsibility:

- `run/` = run preparation and orchestration
- `scheduler/` = convert rotation commands into timed events
- `resolver/` = process those events in time order
- `shared/` = explicit handoff/event-stream helpers shared between scheduler and resolver
- `state/` = named state domains
- `mechanics/` = gameplay-specific mechanic logic

---

## File-by-File Reference

### `js/data/gear-data.js` — Static GW2 Data

Centralizes all static item/modifier data.

| Export | Purpose |
|---|---|
| `GEAR_PREFIXES` | Map of gear prefix name → `{ Power, Precision, Ferocity, ... }` stat bonuses per slot category (heavy, medium, light, trinket, back, weapon). |
| `RUNE_DATA` / `RUNE_NAMES` | Rune stat bonuses map + sorted name list. |
| `FOOD_DATA` / `FOOD_NAMES` | Food modifier data (flat bonuses + conversion rules). |
| `UTILITY_DATA` / `UTILITY_NAMES` | Utility consumable data (flat bonuses + conversion rules). |
| `JBC_BONUS` | Jade Bot Core stat bonus object. |
| `INFUSION_BONUS` | Flat stat bonus per infusion (+5). |
| `BASE_STATS` | Base attribute values at level 80 (Power 1000, Precision 1000, etc.). |
| `WEAPON_DATA` | Map of weapon type → `{ wielding, weaponStrength }`. |
| `SIGIL_DATA` | Map of sigil name → stat bonuses (crit chance, condition durations, etc.). |
| `SIGIL_NAMES` | Sorted sigil name list. |
| `RELIC_DATA` | Map of relic name → proc definition (trigger, ICD, effects). |
| `RELIC_NAMES` | Sorted relic name list. |
| `PRIMARY_STATS` | Array of primary stat names (Power, Precision, Ferocity, etc.). |
| `DURATION_KEYS` | Map of condition/boon type → attribute key string. |

---

### `js/data/traits-data.js` — Trait Definitions

All Elementalist trait data.

| Export | Purpose |
|---|---|
| `TRAITS` | Array of all trait objects `{ tier, name, specialization, position, ...bonuses }`. Covers all 117 minor/major traits across all Elementalist specializations. |
| `SPECIALIZATIONS` | Ordered list of all Elementalist specialization names. |
| `ELITE_SPECS` | `Set` of elite specialization names (Tempest, Weaver, Catalyst, Evoker). |
| `CORE_SPECS` | Array of core specialization names. |
| `DEFAULT_TRAITS` | Default major trait picks string (`'1-1-1'`). |
| `getActiveTraits(specializations)` | Resolves which traits are active given the current build's three specialization slots. Returns an array of active trait objects (minors always active; one major per tier). |

---

### `js/core/calc-attributes.js` — Attribute Calculation Pipeline

Computes all character attributes dynamically from the current build state. Called by `App` whenever the build changes.

```javascript
calcAttributes(build, equippedSkills) → { attributeBreakdowns, derivedStats }
```

**`build` object shape:**
- `prefix` — Gear prefix name (looked up in `GEAR_PREFIXES`)
- `rune` — Rune name (looked up in `RUNE_DATA`)
- `sigil1` / `sigil2` — Sigil names
- `food` — Food name
- `utility` — Utility name
- `jbc` — Boolean, whether Jade Bot Core is active
- `infusions` — Array of `{ stat, count }` (up to 3 types, 18 total)
- `specializations` — Array of `{ name, traits }` (3 slots)
- `mainhandType` / `offhandType` — Weapon types

**Calculation order:**

1. **Base stats** (`BASE_STATS`) — Level 80 base values (1000 Power, 1000 Precision, etc.)
2. **Gear** (`GEAR_PREFIXES`) — Per-slot stat bonuses from selected prefix
3. **Runes** (`RUNE_DATA`) — Flat stat bonuses; `type: 'converted'` items feed conversion pool
4. **Food** — Flat bonuses + percentage conversions (from conversion pool = base + gear + runes)
5. **Utility** — Same as food; e.g., Superior Sharpening Stone converts 3% Precision + 6% Ferocity → Power
6. **Jade Bot Core** (`JBC_BONUS`) — Flat stat bonuses; Vitality included in conversion pool
7. **Trait flat bonuses** (`getActiveTraits`) — Burning Rage, Zephyr's Speed, Aeromancer's Training flat +150 Ferocity, etc.
8. **Trait conversions** — Applied in order: Ferocious Winds → Strength of Stone → Master's Fortitude → Elements of Rage
9. **Sigil stat bonuses** — Crit chance, condition duration bonuses from equipped sigils
10. **Infusions** — `count × INFUSION_BONUS` per `{ stat, count }` entry
11. **Assemble breakdown** — Each stat stored as `{ final, base, gear, runes, food, utility, jbc, traits, sigils, infusions }`
12. **Derived stats** — Critical Chance `(Precision − 1000) / 21 + flat CC`, Critical Damage `(Ferocity / 15) + 150`, condition/boon durations, etc.
13. **Skill passives** — Signet of Fire passive (+180 Precision) when equipped

**Trait conversion pool (`convBase`):**

`base + gear + runes + infusions + jade bot core` — this is the pool used for Ferocious Winds, Strength of Stone, Elements of Rage conversions. Food is included for Ferocious Winds and Elements of Rage but not Strength of Stone.

**Key design rule — no double-counting:**

`calcAttributes` computes the static "Hero Panel" attributes: gear, runes, food, utility, JBC, infusions, always-on trait bonuses (Burning Rage, Aeromancer's Training flat +150 Ferocity, etc.). Dynamic per-hit bonuses (Empowering Flame, Elemental Polyphony, Elemental Empowerment, etc.) are **not** included here — they are computed per-event inside `SimulationEngine.run()`.

**Attribute breakdown object:**

Each primary stat entry: `{ final, base, gear, runes, food, utility, jbc, traits, sigils, infusions }`. The `infusions` field is separately stored so the EE pool (base+gear+runes+infusions+food) can be computed correctly.

---

### `js/data/csv-loader.js` — Data Loading

Now only loads the two skills CSVs. All gear/trait/sigil/weapon/relic data has been migrated to JS modules.

| Export | Purpose |
|---|---|
| `loadAllData()` | Async. Fetches `Skills_data.csv` and `Skill_hits_data.csv`, parses them, returns `{ skills, skillHits }`. |
| `loadSkills(text)` | Parses `Skills_data.csv` → array of skill objects (`name`, `type`, `slot`, `attunement`, `weapon`, `castTime`, `recharge`, etc.). |
| `loadSkillHits(text)` | Parses `Skill_hits_data.csv` → map of `skillName → hitRow[]`. Each hit: `damage` (coefficient), `hit` index, `startOffsetMs`, `repeatOffsetMs`, `numberOfImpacts`, `isFieldTick`, `cc`, `conditions`, combo finisher info. |

**CSV format notes:**
- `Skill_hits_data.csv` is the most complex. Each row is one "hit" of a skill. Skills with multiple hits have multiple rows.
- `NumberOfImpacts = "Duration"` means the hit repeats for a duration at a given interval (field ticks).
- Condition columns use `stacks|duration` format (e.g., `2|5` = 2 stacks for 5 seconds).

---

### `js/platform/gw2/damage.js` — Damage Formulas

Pure math functions with no side effects. Constants:
- `TARGET_ARMOR = 2597` (standard golem armor)

| Export | Formula |
|---|---|
| `strikeDamage(coeff, ws, power, armor)` | `coeff × ws × power / armor` |
| `expectedCritMultiplier(critChance%, critDmg%)` | `1 + (cc/100) × (cd/100 - 1)` — expected value including crit probability |
| `conditionTickDamage(type, condDmg)` | `base + scaling × condDmg` — per-tick, per-stack |
| `conditionTotalDamage(type, stacks, durSec, condDmg, durBonus%)` | Total damage for a condition application |
| `getConditionDurationBonus(type, attrs)` | Looks up specific or general condition duration from attributes |
| `getBoonDurationBonus(type, attrs)` | Looks up boon duration (general + specific like Might Duration) |
| `calculateSkillDamage(skill, hits, ws, attrs)` | Full per-skill damage breakdown (used by the Skill Info Table panel) |

---

### `js/app/gw2-api.js` — Icon Fetching

`GW2API` class fetches skill/trait/specialization icons from the official GW2 API.

- Queries `/v2/professions/Elementalist` for all skill IDs, then batch-fetches from `/v2/skills` and `/v2/traits`.
- Caches to `localStorage` with a 7-day TTL (`gw2_icon_cache_v7`).
- `getSkillIcon(name)` does fuzzy matching: strips parenthetical suffixes, tries quoted variants.
- `EXTRA_ELEM_SKILL_IDS` — manually listed skill IDs for elite spec skills not returned by the profession endpoint.
- `PLACEHOLDER_ICON` — inline SVG placeholder for missing icons.

---

### `js/simulation.js` — Simulation Engine

The core of the app. The `SimulationEngine` class processes a user-defined rotation and produces a full damage timeline.

#### Constructor

```javascript
new SimulationEngine({ skills, skillHits, weapons, attributes, sigils, relics })
```

`weapons`, `sigils`, and `relics` are passed from JS constants (`WEAPON_DATA`, `SIGIL_DATA`, `RELIC_DATA` from `gear-data.js`), not from CSV. `attributes` comes from `calcAttributes()`.

#### Constants

| Constant | Purpose |
|---|---|
| `DAMAGING_CONDITIONS` | Set of conditions that deal damage (Burning, Bleeding, Poisoned, Torment, Confusion) |
| `BOONS` | Set of all boon names |
| `SIGIL_PROCS` | Defines all sigil proc mechanics (trigger type, ICD, effect, coefficient, icon) |
| `RELIC_PROCS` | Defines all relic proc mechanics (trigger type, ICD, damage multiplier, effect duration, conditions, icon) |
| `CONJURE_WEAPONS`, `CONJURE_MAP` | Conjured weapon handling |
| `EVOKER_FAMILIAR_SELECTORS`, `EVOKER_ELEMENT_MAP` | Evoker elite spec familiar mechanics |
| `FIRE_FIELD_SKILLS` | Set of skill names that produce fire fields (for Persisting Flames trait) |
| `ATTUNEMENTS` | Array of attunement names (`['Fire', 'Water', 'Air', 'Earth']`) |
| `CATALYST_ENERGY_MAX`, `CATALYST_SPHERE_COST` | Catalyst energy system constants |
| `OVERLOAD_DWELL` | Base time before Overload is available after attunement swap (6000ms) |

#### `run(startAtt, startAtt2, startEvokerElement, permaBoons, disabled, targetHP)`

The main simulation method. Processes the rotation and produces complete results.

**Parameters:**
- `startAtt` / `startAtt2` — Starting attunements (primary / secondary for Weaver)
- `startEvokerElement` — Starting Evoker familiar element
- `permaBoons` — Permanent boons/conditions applied at t=0 (e.g., `{ Might: 25, Fury: true }`)
- `disabled` — A modifier ID to disable for contribution analysis (e.g., `"Sigil:Air"`, `"Relic:Claw"`, `"Might"`, `"Trait:Burning Rage"`)
- `targetHP` — Target health pool (0 = infinite). Simulation stops dealing damage when target dies.

**Execution flow:**

1. **Attribute Setup** — Reads base stats from `this.attributes`. When `disabled` is a sigil or trait, subtracts that modifier's stat contribution.

2. **State Initialization (`S`)** — Creates the simulation state object (see Simulation State section).

3. **Permanent Effects** — Applies permanent boons from `permaBoons` with expiry at `999999999ms`.

4. **Rotation Processing** — Iterates through `this.rotation`, calling `_step(S, skillName)` for each entry. Rotation items can be plain strings, concurrent objects (`{ name, offset }`), interrupted-cast objects (`{ name, interruptMs }`), or virtual utility entries such as `__combat_start`.

5. **Event Loop** — Processes `S.eq` in chronological order. Event types:
   - `relic_activate` — Deferred relic activation
   - `hit` — Strike damage + condition application. Per-hit trait bonuses computed here.
   - `ctick` — Condition damage tick

6. **Results Assembly** — Packages totals, per-skill breakdown (`perSkill`), log, steps, and end-state into `this.results`.

**DPS window calculation:**

`firstHitTime` records the first damaging event. `lastHitTime` tracks the last. If the rotation contains an explicit `Combat Start` marker, the DPS window starts there; otherwise it starts at `firstHitTime`. The end of the window is `max(rotEnd, lastHitTime)` (or `deathTime` if the target was killed).

#### `computeContributions(startAtt, startAtt2, evokerElement, permaBoons, targetHP)`

Runs the simulation once at full power, then re-runs it once per modifier with that modifier disabled. Returns `contributions[]` with `{ name, dpsIncrease, pctIncrease }`.

**Important:** All comparison runs use `targetHP = 0` (no kill cap) to ensure a symmetric DPS window regardless of whether a modifier affects kill time. The main displayed DPS still uses the user's `targetHP`.

Modifier types handled:
- `"Might"`, `"Fury"`, `"Vulnerability"` — remove the boon/debuff from `permaBoons`
- `"Sigil:X"` — subtract sigil's stat bonuses from `a`
- `"Relic:X"` — set relic ID to null
- `"Trait:X"` — either subtract flat stat bonuses (`subStat`) OR set `_hasX` flag to false (flag-based traits)

---

### `js/app/app.js` — UI Controller

The `App` class manages all DOM rendering and user interaction.

#### Initialization Flow

```
new App() → app.init()
  ├── loadAllData()               ← Skills CSVs only
  ├── GW2API.init()               ← Icon fetch / cache load
  ├── new SimulationEngine(data)  ← Wire up simulation
  ├── _restoreBuild()             ← Load saved build from localStorage
  ├── Event listener binding
  └── app.render()
       ├── renderGear()
       ├── renderAttributes()      ← calls calcAttributes()
       ├── renderConditions()
       ├── renderTraits()
       ├── renderAttunementBar()
       ├── renderWeaponBar()
       ├── renderSkillBar()
       ├── renderSkillInfoTable()
       ├── _renderPermaBoons()
       └── renderRotationBuilder() ← Palette + timeline + results
```

#### Build State (`this.build`)

Central state object:

```javascript
{
  prefix: 'Berserker\'s',
  rune: 'Scholar',
  sigil1: 'Force',
  sigil2: 'Impact',
  relic: 'Thief',
  food: 'Bowl of Sweet and Spicy ...',
  utility: 'Superior Sharpening Stone',
  jbc: true,
  infusions: [
    { stat: 'Power', count: 18 },
    { stat: 'Precision', count: 0 },
    { stat: 'Ferocity', count: 0 },
  ],
  specializations: [
    { name: 'Fire', traits: '1-3-1' },
    { name: 'Air', traits: '1-2-3' },
    { name: 'Weaver', traits: '1-2-3' },
  ],
  mainhandType: 'Sword',
  offhandType: 'Dagger',
}
```

#### Build & Rotation Persistence

The build (gear, traits, selected skills, permaBoons) and rotation are auto-saved to `localStorage` on every `_autoRun()` call. They can also be explicitly exported to / imported from JSON files.

| Method | Purpose |
|---|---|
| `_buildSnapshot()` | Serializes entire build + rotation to a plain object |
| `_applySnapshot(state)` | Restores build + rotation from a snapshot object |
| `_persistBuild()` | Saves snapshot to `localStorage` key `gw2dps_build` |
| `_restoreBuild()` | Loads snapshot from `localStorage` on startup |
| `_exportBuild()` | Downloads full build as `gw2-build.json` |
| `_importBuild(file)` | Loads build from a JSON file |
| `_exportRotation()` | Downloads rotation as `gw2-rotation.json` |
| `_importRotation(file)` | Loads rotation from a JSON file (accepts `{ rotation: [...] }` or bare array) |
| `_serializeRotation()` | Converts `sim.rotation` to a JSON-safe array |
| `_deserializeRotation(items)` | Populates `sim.rotation` from a serialized array |

The rotation format is an array where each item is one of:

- a plain string (`"Charged Strike"`)
- a concurrent object (`{ name: "Air Attunement", offset: 120 }`)
- an interrupted-cast object (`{ name: "Arc Lightning", interruptMs: 1300 }`)
- a virtual marker (`"__combat_start"`)

#### Rotation Builder

The rotation is built by clicking skill icons in the palette. The simulation runs automatically whenever the rotation changes.

**Concurrent (mid-animation) skills:**
- Skills with zero cast time (attunement swaps, signets, stances, etc.) can be fired during another skill's animation by **Shift+clicking** them.
- They appear as `{ name, offset }` objects in the rotation array, where `offset` is the ms delay from the anchor skill's start.
- Offsets are normalized to a minimum of `1ms`, so concurrent entries never start at exactly the same timestamp as their anchor.
- In the timeline UI they render with a dashed border.
- The simulation processes them inside the anchor's `_step` with a `skipCastUntil` flag so they don't advance `S.t`.

**Interrupted casts:**
- Any non-instant skill can be inserted as an interrupted cast by **Ctrl+clicking** it.
- These entries are stored as `{ name, interruptMs }`, where `interruptMs` is measured from cast start.
- The scheduler shortens the cast to that timestamp and only schedules hits whose natural hit time is `<= interruptMs`.
- End-of-cast followups are skipped for genuinely interrupted casts.

**Combat Start marker:**
- The virtual `__combat_start` entry marks when the target becomes active / when the DPS window should begin.
- Events before the marker are treated as precombat setup.
- If the marker is absent, the simulator falls back to the old "first damaging event starts DPS" behavior.

**Skills on cooldown:**
- Clicking a skill that is on cooldown inserts it normally; the simulation automatically waits (`S.t` advances to the cooldown expiry before casting).

**Proc icons in the timeline:**
- After each simulation run, relic, sigil, and notable trait proc events (e.g., Sunspot) are displayed as small icons beneath the corresponding rotation step.

#### Per-Skill Breakdown Table

The table below the rotation results shows, per skill:

| Column | Meaning |
|---|---|
| Strike / Condi | Total damage by type |
| Total | Strike + Condition |
| DPS | `total / dpsWindowSec` |
| Avg/Cast | `total / casts` |
| DCT | `total / castTimeSec` — damage per cast time; `—` for instant skills |
| Casts | Number of times cast |

`dpsWindowMs` is exposed in `this.results` for the breakdown calculations.

#### `_renderPermaBoons()` — Permanent Boons & Conditions

Renders checkboxes for permanent boons/conditions. Defaults (pre-checked) are:

`25× Might, Fury, Protection, Resolution, Alacrity, Quickness, Regeneration, Vigor, Swiftness, Bleeding, Burning, Torment, Confusion, Poisoned, Chilled, Cripple, Slow, Weakness, 25× Vulnerability`

---

## Simulation State Object (`S`)

The `S` object is the central mutable state during a simulation run. Key fields:

| Field | Type | Purpose |
|---|---|---|
| `t` | number | Current simulation time (ms) |
| `castUntil` | number | Time when current cast finishes |
| `att` / `att2` | string | Current primary/secondary attunement |
| `attEnteredAt` | object | When each attunement was entered (for 4s swap lockout) |
| `attCD` | object | Attunement swap cooldowns |
| `skillCD` | object | Per-skill cooldown expiry times |
| `charges` | object | Ammo system state (count, next charge time) |
| `chainState` | object | Auto-attack chain tracking + skill chain state (e.g. Weave Self ↔ Tailored Victory) |
| `eq` | array | Event queue (sorted by time) |
| `condState` | object | Per-condition-type active stacks and tick scheduling |
| `allCondStacks` | array | Flat list of all stacks (conditions + boons) for counting |
| `quicknessUntil` / `alacrityUntil` | number | When Quickness/Alacrity expires |
| `conjureEquipped` | string\|null | Currently equipped conjured weapon |
| `conjurePickups` | array | Available conjure pickups on the ground |
| `energy` | number\|null | Catalyst energy (null if not Catalyst) |
| `sphereExpiry` | object | `{ Fire, Water, Air, Earth }` — per-attunement Jade Sphere expiry times |
| `sigilICD` | object | Per-sigil ICD tracking |
| `relicICD` | object | Per-relic ICD tracking |
| `relicBuffUntil` | number | When the active relic's strike buff expires |
| `totalStrike` / `totalCond` | number | Running damage totals |
| `perSkill` | object | `{ skillName: { strike, condition, casts, castTimeMs } }` |
| `log` | array | Event log entries |
| `steps` | array | Timeline step entries (for UI rendering) |
| `attTimeline` | array | Chronological attunement changes `[{ t, att, att2 }]` for historical lookup |
| `traitICD` | object | Per-trait internal cooldown tracking |
| `firstHitTime` / `lastHitTime` | number\|null | Timestamps of the first and last damaging events (for DPS window) |
| `fields` | array | Active combo fields: `[{ name, start, end, type }]` |
| `comboAccum` | object | Probabilistic accumulators for fractional combo finisher procs |
| `sigilCritAccum` | number | Probabilistic accumulator for on-crit sigil procs |
| `weaveSelfUntil` | number | Expiry of Weave Self buff (0 = inactive) |
| `weaveSelfVisited` | Set | Attunements visited during active Weave Self |
| `perfectWeaveUntil` | number | Expiry of Perfect Weave buff |
| `evokerCharges` | number | Current Evoker familiar charge count |
| `evokerEmpowered` | number | Stacks of empowered Evoker familiar |
| `igniteStep` | number | Current step in Ignite's cycling burn duration sequence |
| `igniteLastUse` | number | Last time Ignite was used (for 15s reset) |
| `electricEnchantmentStacks` | number | Galvanic Enchantment: stacks consumed on next hit |
| `arcaneEchoActive` | boolean | Whether Arcane Echo's next-weapon-skill reduction is primed |
| `relentlessFireUntil` | number | Expiry of Relentless Fire +10% strike buff |
| `shatteringIceUntil` | number | Expiry of Shattering Ice buff |
| `_has*` flags | boolean | ~60+ cached trait detection flags (set once at state init) |

---

## Event Queue System

The simulation uses a sorted event queue (`S.eq`). Events are inserted with `insertSorted()` (binary search insertion) and processed in chronological order.

Event types:

| Type | Fields | Processed By |
|---|---|---|
| `hit` | `time, skill, hitIdx, sub, totalSubs, dmg, ws, isField, cc, conds, noCrit, att, att2, castStart, finType, finVal, isSigilProc, isRelicProc, isTraitProc` | Main event loop → `_procHit()` |
| `ctick` | `time, cond` | Main event loop → `_procCondTick()` |
| `relic_activate` | `time, relic, applyEffects` | Main event loop (sets buff timer, optionally applies conditions/strike) |

---

## Combo Field System

Skills with a non-empty `Combo Field` column in `Skills_data.csv` create active fields. Skill hits with a `Combo Finisher` column interact with the oldest active field to produce combo effects.

**Rules:**
- Fields spawn at cast end (not cast start).
- Finishers proc at hit time (`startOffsetMs`).
- The **oldest active field** is always consumed (FIFO). A field can be comboed unlimited times.
- Fractional finishers (`Projectile|0.2`, `Whirl|2`) use probabilistic accumulators (`S.comboAccum`) for deterministic expected-value behaviour.

**Effects by field type and finisher:**

| Field | Blast | Leap | Projectile | Whirl |
|---|---|---|---|---|
| Fire | 3× Might (20s) | Fire Aura (5s) | 1s Burning | 1s Burning |
| Ice | Frost Aura (3s) | Frost Aura (5s) | 1s Chilled | 1s Chilled |
| Lightning | 10s Swiftness | CC on hit | 2× Vulnerability (5s) | 2× Vulnerability (5s) |
| Poison | 3s Weakness | 8s Weakness | 2s Poisoned | 2s Poisoned |
| Water | — | — | 2s Regeneration | — |

Aura combos (Fire Aura, Frost Aura) trigger all on-aura traits.

---

## Special Skill Logic

Several skills have custom simulation logic beyond what the CSV defines:

### Sand Squall
`BoonExtension = 3` — extends all currently active boons by 3 seconds flat (not affected by Boon Duration). Implemented in `_applyBoonExtension()`.

### Arcane Echo
Arms a flag that reduces the next weapon skill with `Recharge > 0` to a 1-second cooldown. Resets if unused within 10 seconds.

### Conjured Weapons
While a conjured weapon is equipped (`S.conjureEquipped`), stat bonuses are applied per-hit:
- **Frost Bow**: +20% Condition Duration, +180 Healing Power
- **Lightning Hammer**: +75 Ferocity, +180 Precision
- **Fiery Greatsword**: +260 Power, +180 Condition Damage

These are flat additions embedded into each scheduled `hit` event at cast time (so the bonus is locked to the equipped weapon at cast time, not at hit time).

### Overload Air
On cast completion, `Overload Air` triggers `Lightning Jolt`: an additional strike (coeff `1.32`, weapon strength `690.5`, cannot crit).

### Primordial Stance
Has four variants in the CSV (one per attunement). The correct variant is determined by **both** current attunements at hit time. If both attunements are the same element, all conditions are applied twice.

### Relentless Fire
Grants +10% additive strike damage for 5 seconds (8 seconds if "Deploy Jade Sphere (Fire)" is active at cast time). Tracked via `S.relentlessFireUntil`.

### Shattering Ice
After cast, applies a buff for 5 seconds (8 seconds with active Fire Jade Sphere). While the buff is active, each hit from any source triggers an additional strike (coeff `0.6`, weapon strength `690.5`, 1s Chilled) with a 1-second ICD. The proc can crit normally.

### Elemental Celerity
Resets cooldowns of all weapon skills (slots 1–5) for the current attunement. If any Jade Sphere is active, grants boons per active sphere: Fire → 5× Might (6s), Water → Vigor (6s), Air → Fury (6s), Earth → Protection (4s).

### Ride the Lightning
On hit (assumed always), the skill's recharge is halved at runtime. With Aeromancer's Training the effective cooldown becomes 8s; without it, 10s. The CSV `Recharge` value is kept at 20 so relic/sigil procs still fire on high-cooldown skills.

### Weave Self (Weaver Elite)

A 20-second buff with complex state:

1. Attunement swap cooldown is reduced to 2 seconds (further reduced by Alacrity).
2. Visiting each attunement grants a stacking bonus (Fire: +20% Condition Damage, Water: +20% Boon Duration, Air: +10% Strike Damage, Earth: nothing). These last until the buff ends.
3. Visiting all 4 attunements within 20 seconds ends Weave Self immediately, grants **Perfect Weave** for 10 seconds (all 4 bonuses), and unlocks the **Tailored Victory** chain skill.
4. The 4th attunement swap that triggers Perfect Weave correctly uses the 2-second Weave Self cooldown (not the normal 4-second cooldown).
5. If the 20-second timer expires before visiting all 4 attunements, bonuses are lost and the chain resets to Weave Self.

State fields: `S.weaveSelfUntil`, `S.weaveSelfVisited`, `S.perfectWeaveUntil`.

### Tailored Victory
Deals coeff `0.75`, applies CC = 1. Consumes Perfect Weave and all Weave Self bonuses. Can only be cast during an active Perfect Weave window.

---

## Evoker Familiar System

The Evoker elite spec uses F5 to select an element that determines passive and active familiar effects.

**Familiar charges** accumulate via skill casts and trait procs. 6 charges unlock the empowered skill. **Rejuvenate** instantly grants 6 charges.

### Passive Effects (applied on game events)

| Element | Passive | Trigger |
|---|---|---|
| Ignite (Fire) | +1 Might (6s) | When player applies Burning; 1s ICD |
| Zap (Air) | +75 Ferocity | While player has Fury AND is in Air attunement |

### Active Skills (F5)

| Skill | Effect |
|---|---|
| Ignite | Cycling Burning durations: 1st cast 2s → 2nd 0.5s → 3rd 1s → 4th+ 1.5s. Resets if unused for >15 seconds. Coeff 0.63, weapon strength 1100. |
| Conflagration | Burning (from empowered Ignite). Coeff 1.56, weapon strength 1100. |
| Zap | +3% multiplicative strike damage for 10s. Coeff 0.6, weapon strength 1100. |
| Lightning Blitz | Grants 1 stack of `electricEnchantment`. 0.28 coeff × 5 hits (= 1.4 total), weapon strength 1100. |
| Hare's Agility | Grants 5 stacks of `electricEnchantment`. |
| Fox's Fury | Grants 8× Might (10s) + Fury (10s). If Fire is specialized element, grants additional 3× Might. Damage coefficient and Burning scale with Might at cast start: <10 Might → 1.5/1×3s; 10–20 → 2.25/2×5s; 20+ → 3.0/3×7s. |
| Toad's Fortitude | Grants 4s Resistance if Earth is specialized element. |
| Elemental Procession | All 4 empowered familiar skills fire simultaneously. Player is not "trapped" in cast animation. |

---

## Trait System

Traits are the largest subsystem. Each trait is detected once at state init (`this._hasTrait(name)`) with the result cached as a `_has*` boolean flag.

### Static Traits (applied in `calc-attributes.js`)

Applied in `calcAttributes()` in a specific order to handle interdependencies:

| Trait | Effect | Pool |
|---|---|---|
| Ferocious Winds | 7% Precision → Ferocity | base+gear+runes+food |
| Strength of Stone | 10% Toughness → Condition Damage | base+gear+runes |
| Master's Fortitude | +120 Vitality (if Sword) + 5% Power/CondDmg → Vitality | base+gear+runes+food |
| Elements of Rage | 13% Vitality (incl. MF flat 120) → Precision | base+gear+runes+food |
| Aeromancer's Training | +150 Ferocity (flat, always active) | — |
| Burning Rage | +180 Condition Damage | — |
| Zephyr's Speed | +5% Critical Chance | — |
| Gathered Focus | +240 Concentration | — |
| Serrated Stones | +20% Bleeding Duration | — |
| Signet of Fire passive | +180 Precision (when equipped) | — |

### Dynamic Per-Hit/Per-Tick Traits (in event loop)

**Power/Ferocity/Crit modifiers (attunement-conditional):**

| Trait | Rule |
|---|---|
| Empowering Flame | +150 Power — **primary Fire only** |
| Aeromancer's Training | +150 Ferocity (= +10 crit dmg) — **primary Air only** |
| Power Overwhelming | Might ≥ 10: +300 Power if **primary Fire**, +150 Power otherwise |
| Elemental Polyphony | Each unique attunement (deduped): Fire→+200 Power, Air→+200 Ferocity, Water→+200 Healing Power, Earth→+200 Vitality |
| Fresh Air | +250 Ferocity for 5s on Air swap |
| Raging Storm | +180 Ferocity under Fury |
| Elemental Empowerment | +1%/1.5%/2% of base+gear+runes+infusions+food per stack (max 10, Catalyst) |

**Additive strike/condition modifiers** (accumulated into `addStrike`/`addCond`):

| Trait | Strike | Condition |
|---|---|---|
| Persisting Flames | +2% per stack (max 5) | — |
| Tempestuous Aria | +10% | +5% |
| Transcendent Tempest | +20% | +20% |
| Elements of Rage | +7% | +5% |
| Swift Revenge | +7% (with Swiftness/Superspeed) | — |
| Weaver's Prowess | — | +5% (when primary ≠ secondary) |
| Empowering Auras | +1% per stack (max 5) | +1% per stack (max 5) |
| Familiar's Prowess | Air: +5%/15% strike | Fire: +5%/15% condition |

**Multiplicative strike modifiers:**

| Trait | Multiplier | Condition |
|---|---|---|
| Pyromancer's Training | ×1.07 | Target has Burning |
| Fiery Might | ×1.05 | Target has Burning |
| Serrated Stones | ×1.05 | Target has Bleeding |
| Stormsoul | ×1.07 | Always |
| Bolt to the Heart | ×1.20 | Target below 50% HP |

**Cooldown reduction** (in `_pyroRechargeMs`):
- Pyromancer's Training, Aeromancer's Training, Geomancer's Training each reduce their element's weapon skill cooldowns by 20%. These always apply (bypass contribution-test disabling) because CDR affects when damage occurs, not how much each hit deals.

### Probabilistic On-Crit Trait Procs

| Trait | Effect | ICD |
|---|---|---|
| Burning Precision | 33% chance: 1 stack Burning (3s). Also always grants +20% Burn Duration (static, in base attrs). | 5s |
| Raging Storm | 33% chance: 4s Fury | 8s |
| Fresh Air | Recharges Air attunement on crit | — |

### Trigger-Based Traits

**On attunement swap** (in `_doSwap` / `_doWeaverSwap`):

| Trait | Element | Effect |
|---|---|---|
| Sunspot | Fire | 0.6 coeff strike + Fire Aura (3s) + Burning (with Burning Rage) |
| Electric Discharge | Air | 0.35 coeff strike + 100% bonus crit dmg + Vulnerability |
| One with Air | Air | 3s Superspeed |
| Inscription | Air | 3s Resistance |
| Fresh Air | Air | 250 Ferocity buff (5s) |
| Latent Stamina | Water | 3s Vigor (10s ICD) |
| Earthen Blast | Earth | 0.36 coeff strike (no crit) |
| Rock Solid | Earth | 3s Stability |
| Flame Expulsion | Leaving Fire | Scaled strike (1.0–1.5 coeff by Might) + Burning |
| Energized Elements | Any | +2 Energy + 2s Fury (Catalyst) |
| Elemental Dynamo | Selected | +1 Familiar charge (Evoker) |
| Elemental Balance | Selected | Every 2nd entry → 66% CDR on next weapon skill (5s window) |

**On skill cast** (in `_step`):

| Trait | Trigger | Effect |
|---|---|---|
| Pyromancer's Puissance | Any skill in Fire | +1 Might (15s) |
| Gale Song | Healing skill | 3s Protection |
| Tempestuous Aria | Shout skill | 2 Might (10s) |
| Bolstered Elements | Stance skill | 3s Protection |
| Earth's Embrace | Healing skill | 4s Resistance (15s ICD) |
| Inscription | Glyph skill | Attunement-based boon |
| Written in Stone | Signet skill | Attunement-based Aura |
| Altruistic Aspect | Meditation skill | Per-skill boons |

**On aura gain** (in `_applyAura`):

| Trait | Effect |
|---|---|
| Conjurer | Fire Aura on Conjure skill |
| Zephyr's Boon | +5s Fury + 5s Swiftness |
| Elemental Shielding | +3s Protection |
| Smothering Auras | +33% Aura duration |
| Invigorating Torrents | +5s Vigor + 5s Regeneration |
| Tempestuous Aria | Refreshes +10%/+5% buff (5s) |
| Elemental Bastion | +4s Alacrity |
| Empowering Auras | +1% strike/condi per stack (max 5, 10s, refresh all) |
| Elemental Epitome | +1 Elemental Empowerment stack |

**On overload** (in `_doOverload`):

| Trait | Effect |
|---|---|
| Harmonious Conduit | 8s Swiftness + 4s Stability at start |
| Hardy Conduit | 3s Protection at start |
| Unstable Conduit | Attunement-based Aura on completion |
| Transcendent Tempest | 33% dwell reduction + 20%/20% buff (7s) on completion |
| Lucid Singularity | Hits 1–4: 1s Alacrity; Hit 5: 4.5s Alacrity |

**On familiar skill** (in `_doFamiliar`):

| Trait | Effect |
|---|---|
| Familiar's Prowess | +5%/15% damage buff (5s, stacks duration to max 15s) |
| Familiar's Blessing | Fire/Air: 3s Quickness; Water/Earth: 3s Alacrity |
| Galvanic Enchantment | +2 Electric Enchantment stacks (consumed on next 2 hits for 0.4 coeff + 1.5s Burning) |
| Specialized Elements | Basic: 50% weapon skill recharge; Empowered: 50% recharge + trigger attunement-enter effects |

### Duration/Cooldown Modifiers

| Trait | Effect |
|---|---|
| Burning Precision | +20% Burning duration (always active, in base attrs) |
| Serrated Stones | +20% Bleeding duration |
| Weaver's Prowess | +20% all condition duration (when primary ≠ secondary attunement) |
| Smothering Auras | +33% Aura duration |
| Pyromancer's/Aeromancer's/Geomancer's Training | −20% Fire/Air/Earth weapon skill cooldowns |
| Persisting Flames | +2s fire field duration |
| Transcendent Tempest | −33% overload dwell time |
| Spectacular Sphere | Jade Sphere grants 1.5s Quickness |
| Sphere Specialist | +50% bonus Jade Sphere boon duration |
| Specialized Elements | −50% empowered familiar skill recharge |

---

## CSV Data Format Quick Reference

### Skills_data.csv
`Name, Type, Slot, Attunement, Weapon, Chain skill, Cast Time, Recharge, Count Recharge, Maximum Count, Combo Field, Duration, Aura`

### Skill_hits_data.csv
`Name, start_offset_ms, repeat_offset_ms, Hit, Number of Impacts, IsFieldTick, CC, Damage, Duration, Interval, Combo Finisher, [condition columns...]`

---

**Rotation Export tab details:**

- Configurable instant threshold (ms), start/end time window.
- Skill table with include/exclude checkboxes, detected average cast duration, and a "Map to Tool Name" field (auto-populated with attunement remaps).
- **Attunement tracking:** WeaponSwap state change events (isStateChange = 11) are captured for the PoV player, providing attunement context even when skill activation events are unavailable.
- **Variant skill resolution:** Skills whose tool name requires an attunement suffix (e.g., `Glyph of Storms` → `Glyph of Storms (Air)`) are automatically resolved based on the current attunement at cast time.
- Instant-cast skills fired during another skill's cast window are marked as concurrent `{ name, offset }` objects, matching the Shift+click format of the rotation builder.
- Interrupted casts are exported as `{ name, interruptMs }`.
- Explicit combat-start markers are exported as `__combat_start`.
- Export to `gw2-rotation.json`, then load it in the main tool via **↑ Load Rotation**.

---

## Key Design Decisions

1. **Event-driven simulation** — Rather than tick-based, the simulation schedules discrete events (hits, condition ticks, relic activations) and processes them in order.

2. **Probabilistic crit for sigils** — Uses an accumulator (`sigilCritAccum += critChance`). When it reaches 100, a proc fires. Gives deterministic, expected-value behaviour.

3. **Expected crit multiplier** — Strike damage uses `1 + cc × (cd - 1)` rather than random crits. Gives stable, repeatable DPS numbers.

4. **Modifier contribution via re-simulation** — `computeContributions()` runs the full simulation N+1 times (once full, once per modifier disabled). The DPS difference measures each modifier's marginal contribution. All comparison runs use `targetHP = 0` to ensure a symmetric window regardless of kill time effects.

5. **Quickness/Alacrity partial overlap** — Cast times and cooldowns correctly handle buffs expiring mid-cast, computing the blended duration.

6. **Attunement-aware skill resolution** — Skills are resolved in context: Weaver dual-attunement skills, conjured weapon skills, chain skills within auto-attack sequences.

7. **Target HP / death tracking** — Once total damage reaches `targetHP`, the target is dead. DPS = `targetHP / killTime`. Events after death are not processed.

8. **Trait flags cached once** — All `_hasTrait()` checks are done once during state init and stored as `_has*` boolean flags. Avoids repeated lookups in the hit event loop.

9. **Attunement timeline for historical lookup** — `S.attTimeline` records every attunement change. `_attAt(t)` and `_att2At(t)` binary-search this timeline to find the player's attunement at any historical time.

10. **Static vs dynamic trait stat bonuses** — Traits with fixed stat conversions are applied once in `calcAttributes()`. State-dependent bonuses are computed per-hit/per-tick. **No double-counting.**

11. **Primary-only attunement checks** — Empowering Flame, Aeromancer's Training, and Power Overwhelming check `hitAtt` (primary attunement) only. Elemental Polyphony uses a `Set([hitAtt, hitAtt2])` to check both but deduplicates.

12. **Elemental Empowerment base pool** — The `_empPool` object precomputes `base+gear+runes+infusions+food` stat totals at init. Per-event, `_getEmpMul()` returns the current percentage multiplier.

13. **Anti-chaining for trait procs** — Trait-generated hits carry `isTraitProc: true` to prevent recursive triggering of on-hit traits, sigils, and relics.

14. **Data in JS, not CSV** — Gear prefixes, runes, food, utility, sigils, weapons, relics, and traits are all hardcoded in `gear-data.js` and `traits-data.js`. Only skills remain as CSV.

15. **Concurrent (mid-animation) skills** — The scheduler collects `{ name, offset }` items that follow an anchor skill and processes them inside the anchor's step before the main timeline advances. Offsets are clamped to at least `1ms` to avoid duplicate cast-start timestamps.

16. **Interrupted casts are first-class rotation items** — `{ name, interruptMs }` entries shorten the cast window itself and filter out any hits scheduled after the interrupt point. They behave like a real cancel rather than a completed cast with truncated damage.

17. **DPS window can start explicitly** — If `__combat_start` exists in the rotation, the DPS denominator uses that timestamp. Otherwise the simulator falls back to `S.firstHitTime`, preserving older rotation behavior.

18. **Conjured weapon stat locking** — Hit events embed `conjure: S.conjureEquipped || null` at schedule time. This ensures the stat bonus reflects the equipped weapon at cast time.
