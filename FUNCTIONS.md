# Mesmer Simulator Function Reference

Complete documentation of all exported functions in the mesmer-simulator project, organized by module.

---

## Application Layer (`js/app/`)

### app-state.js

**`createDefaultTargetConditions()`**
- Creates the default permanent training-golem condition map.
- Returns: object keyed by condition name with boolean or stack-count values

**`createDefaultBuild()`**
- Creates a new default build with standard gear (Berserker's), weapons (Dagger/Sword), specializations (Dueling/Illusions/Virtuoso), and rotation.
- Returns: `Build` object with all default properties

**`loadBuild()`**
- Loads build from localStorage or returns default if storage is empty/corrupt.
- Returns: `Build` object merged with defaults

**`saveBuild(build)`**
- Persists build to localStorage under STORAGE_KEY.
- Parameters: `build` - Build object to save
- Returns: void

**`replaceBuild(saved)`**
- Merges saved build with defaults, handles legacy format conversion, validates relic/sigils.
- Parameters: `saved` - Partial or full build object
- Returns: `Build` object

---

### app-runtime.js

**`eliteSpecialization(build)`**
- Determines which elite specialization is active (Chronomancer, Mirage, Virtuoso, Troubadour) or returns 'Core'.
- Parameters: `build` - Build object
- Returns: `string` - Elite spec name or 'Core'

**`recalculate(app)`**
- Recalculates attributes based on build and selected skills, stores result in app.attributeData.
- Parameters: `app` - MesmerApp instance
- Returns: void

**`simulationConfig(app)`**
- Transforms app build into simulation engine config (stats, boons, target health and permanent conditions, weapons, traits).
- Parameters: `app` - MesmerApp instance
- Returns: `SimConfig` object for simulator.simulateSequence()

**`runSimulation(app)`**
- Executes simulateSequence() with current build/rotation, stores results in app.results.
- Parameters: `app` - MesmerApp instance
- Returns: Simulation results object

---

### app-io.js

**`downloadJson(filename, payload)`**
- Triggers browser download of JSON-serialized payload (for build/rotation export).
- Parameters: `filename` (string), `payload` (object)
- Returns: void

**`readJsonFile(file)`**
- Async: Reads File object from input, parses JSON.
- Parameters: `file` - File from <input type="file">
- Returns: `Promise<object>`

---

## Core Mechanics (`js/core/`)

### calc-attributes.js

**`calcAttributes(build, selectedSkills = [], weaponSet = 1)`**
- Main attribute calculator. Aggregates stats from gear, runes, food, utility, infusions, traits, sigils. Computes derived attributes (Crit Chance, Critical Damage, Duration bonuses).
- Parameters:
  - `build` - Build object with gear, weapons, specializations, food, utility
  - `selectedSkills` - Array of selected skill objects (for signet stat buffs)
  - `weaponSet` - Which weapon set (1 or 2) to calc sigil stats for
- Returns: Object with `{ attributes, activeTraits, gear, weapons, rune, sigils, relic, food, utility, jadeBotCore, specializations }`

---

### damage.js

**`strikeDamage(coefficient, weaponStrength, power, armor = 2597)`**
- Raw strike damage formula: `coefficient * weaponStrength * power / armor`
- Parameters: coefficient (number), weaponStrength (number), power (number), armor (optional, default 2597)
- Returns: `number` - Raw strike damage before crit

**`expectedCritMultiplier(critChancePct, critDamagePct)`**
- Expected damage multiplier accounting for crit chance and crit damage %.
- Parameters: critChancePct (0-100), critDamagePct (100-400+)
- Returns: `number` - Multiplier (1.0 = no crit bonus)

**`conditionTickDamage(conditionType, conditionDamage)`**
- Damage per tick for a condition: `base + scaling * conditionDamage`
- Parameters: conditionType (string: 'Burning', 'Bleeding', etc.), conditionDamage (number)
- Returns: `number` - Damage per second per stack

**`conditionTotalDamage(conditionType, stacks, baseDurationSec, conditionDamage, durationBonusPct)`**
- Total condition damage over full duration including duration bonuses.
- Parameters: all documented
- Returns: `number` - Total condition damage

**`getConditionDurationBonus(conditionType, attributes)`**
- Lookup condition duration bonus from attributes (base + condition-specific).
- Parameters: conditionType (string), attributes (from calcAttributes)
- Returns: `number` - Duration bonus %

**`getBoonDurationBonus(boonType, attributes)`**
- Lookup boon duration bonus from attributes.
- Parameters: boonType (string: 'Might', 'Fury', etc.), attributes
- Returns: `number` - Duration bonus %

**`calculateSkillDamage(skill, skillHits, weaponStrength, attributes, options = {})`**
- Full damage breakdown for a skill cast: strike + condition damage, per-hit details.
- Parameters:
  - `skill` - Skill object
  - `skillHits` - Array of hit definitions from skill
  - `weaponStrength` - Weapon strength value
  - `attributes` - Calculated attributes
  - `options` - `{ maxHit: number, infernoBurningTick: number }`
- Returns: Object with `{ totalStrike, totalCondition, totalDamage, dps, critMultiplier, hitDetails[], conditionDetails[] }`

---

### weapon-sigils.js

**`normalizeWeaponSigils(value, fallback = DEFAULT_WEAPON_SIGILS)`**
- Validates and normalizes sigil selections, ensures no duplicates per weapon set.
- Parameters: value (raw sigil array), fallback (defaults)
- Returns: Normalized `[[[sigilName, sigilName], [sigilName, sigilName]]]` structure

**`weaponSigilsForSet(build, setNumber = 1)`**
- Retrieves sigil names for a specific weapon set.
- Parameters: build, setNumber (1 or 2)
- Returns: `[sigilName, sigilName]` array

**`setWeaponSigil(build, setIndex, slotIndex, name)`**
- Updates sigil selection, swaps with other slot if duplicate.
- Parameters: build, setIndex (0-1), slotIndex (0-1), sigil name
- Returns: void

**`aggregateSigilSet(sigilNames)`**
- Combines multiple sigils into aggregate effects (crit bonus, strike/condition multipliers, duration bonuses).
- Parameters: sigilNames array
- Returns: Object with `{ names[], criticalChanceBonus, strike, condition, conditionDurationBonus, conditionDurationBonuses, boonDurationBonus }`

---

## Data Layer (`js/data/`)

### traits-data.js

**`getActiveTraits(specializations)`**
- Extracts active traits from specialization selections (1-3-1 format per spec).
- Parameters: specializations array of `{ name, traits: '1-1-1' }`
- Returns: Array of active trait objects with names, stats, durations

---

## Simulation Engine (`js/sim/`)

### simulator.js

- **`createDefaultConfig()`** — creates the default simulation configuration.
- **`getResourceDefinition(specialization)`** — returns clone, blade, or note resource metadata.
- **`simulateRotation(rotation, config)`** — repeats a benchmark rotation through the configured horizon.
- **`simulateSequence(rotation, config)`** — executes one builder sequence and returns timeline/end-state data.
- **`skillById(id)`** — looks up a normalized skill.
- **`availableSkills(config)`** — returns skills usable by the current build.
- **`calculatedAttributes(config)`** — derives static attributes for display.

## Scheduler (`js/sim/scheduler/`)

- **`createScheduler(config, traits, horizon, model)`** in `scheduler.js` — composes scheduler state and focused controllers.
- **`createSchedulerState(options)`** in `scheduler-state.js` — creates state for one run.
- **`createEventFactory(options)`** in `event-factory.js` — creates typed scheduler events.
- **`createExpectedProcTracker(options)`** in `expected-procs.js` — tracks deterministic expected trait procs.
- **`createCastController(options)`** in `cast-controller.js` — validates and dispatches casts.
- **`createCooldownController(options)`** in `cooldown-controller.js` — owns cooldown and ammo state.
- **`createContinuumController(options)`** in `continuum-controller.js` — snapshots and restores Continuum Split.
- **`createResourceController(options)`** in `resource-controller.js` — owns resource gains.
- **`createSkillEffectController(options)`** in `skill-effects.js` — schedules ordinary skill effects.

## Resolver (`js/sim/resolver/`)

- **`resolveScheduledStream(options)`** in `resolve-timeline.js` — resolves a versioned scheduled timeline.
- **`createRuntimeState(options)`** in `runtime-state.js` — creates mutable state for one resolver pass.
- **`runEventLoop(ctx)`** in `event-loop.js` — drains the ordered event queue.
- **`buildResolverQuery(config, traits, events, model)`** in `resolver-query.js` — composes resolver queries.
- **`createTimelineIndex(options)`** in `timeline-index.js` — builds temporal event lookups.
- **`createCombatStats(options)`** in `combat-stats.js` — builds attributes and critical-strike queries.
- **`createDamageModifiers(options)`** in `damage-modifiers.js` — builds strike, condition, and duration modifiers.

## Shared Simulation (`js/sim/shared/`)

- **`enqueueOrdered(queue, event)`**, **`sortQueuedEvents(queue)`**, and **`takeNextEvent(queue)`** in `event-queue.js` — maintain stable event ordering.
- **`buildScheduledEventStream(options)`** and **`assertScheduledEventStream(stream)`** in `scheduled-event-stream.js` — define the scheduler/resolver boundary.

## Mechanics (`js/sim/mechanics/`)

- **`normalizedSkill(rawSkill)`** in `mesmer-skill-normalization.js` — canonicalizes one generated skill using hand-authored corrections.
- `mesmer-skill-overrides.js` exports simulator-only skills, autoattack chains, and override lookup helpers.
- **`createProfessionActionController(options)`** in `profession-actions.js` — handles shatters, instruments, and profession resources.
- **`createCloneAttackScheduler(options)`** in `illusion-actions.js` — schedules clone autoattacks.
- **`createMirageActionController(options)`** in `mirage-actions.js` — handles Mirage Cloak and ambushes.
- **`recordPassiveRelicTimeline(ctx, events, horizon)`** in `relic-rules.js` — records passive relic effects.

## Fixtures (`js/fixtures/`)

### fixture-harness-core.js

**`defaultSimulationConfig(overrides = {})`**
- Creates test simulation config with reasonable defaults (3000 power, 2200 precision, etc.).
- Parameters: overrides (partial config to merge)
- Returns: Complete simulation config

---

## Key Data Structures

### Build
```javascript
{
  gear: { [slot]: prefix },         // e.g., { Helm: "Berserker's" }
  weapons: [mainHand, offHand],     // e.g., ["Dagger", "Sword"]
  alternateWeapons: [mh, oh],
  rune: string,
  weaponSigils: [[[name, name]], [[name, name]]], // 2 weapon sets
  relic: string,
  food: string,
  utility: string,
  jadeBotCore: boolean,
  infusions: [{ stat, count }],
  specializations: [{ name, traits: "1-1-1" }],
  selectedSkills: { Heal, Utility1, Utility2, Utility3, Elite },
  assumptions: { might, fury, quickness, alacrity, regeneration, vigor, vulnerability, ... },
  initialResource: number,
  targetArmor: number,
  rotation: [] // skill names or { name, interruptMs, offset }
}
```

### Attributes
```javascript
{
  attributes: {
    [stat]: {
      final: number,
      base: number,
      gear: number,
      runes: number,
      food: number,
      utility: number,
      jbc: number,
      traits: number,
      sigils: number,
      infusions: number
    }
  },
  activeTraits: [trait objects],
  gear: {},
  weapons: [],
  rune: string,
  // ... etc
}
```

### Skill
```javascript
{
  id: number,
  name: string,
  type: "Weapon" | "Profession" | "Heal" | "Utility",
  weapon: string,
  slot: string,
  specialization: string,
  activation: number,           // seconds
  cooldown: number,             // seconds
  damage: [{ coefficient, hits, source, weapon, ... }],
  conditions: [{ name, duration, stacks }],
  phantasm: boolean,
  resource: { mode, count },    // for clones/blades/notes
  blade: boolean,
  wikiUrl: string
}
```

### Event
```javascript
{
  type: "action" | "damage" | "condition" | "cooldown" | "resource" | "proc" | "buff" | ...,
  at: number,                   // timestamp
  name: string,
  // ... type-specific fields
  priority?: number             // for queue ordering
}
```

---

## Common Patterns

### Damage Calculation
1. `calcAttributes()` - Get static attributes from build
2. `strikeDamage()` - Calculate base strike
3. `expectedCritMultiplier()` - Apply crit multiplier
4. `conditionTickDamage()` - Calculate condition per-tick
5. `calculateSkillDamage()` - Full breakdown

### Simulation
1. `simulationConfig()` - Transform build to config
2. `createScheduler()` - Create scheduler
3. `scheduler.cast(skill)` - Queue actions
4. `resolveScheduledStream()` - Calculate damage
5. Display results

### Attribute Aggregation
1. `calcAttributes()` with build
2. Tracks each source: gear, runes, food, utility, infusions, traits, sigils
3. Derives secondary stats from primaries
4. Returns breakdown for tooltips/inspection
