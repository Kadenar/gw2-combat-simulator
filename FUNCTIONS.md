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
- Returns: `SimConfig` object for sim-engine.simulateSequence()

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

### sim-engine.js

**`createDefaultConfig()`**
- Creates default simulation config: 30s duration, Virtuoso spec, Dagger/Sword, default stats/boons/target.
- Returns: `SimConfig` object

**`getResourceDefinition(specialization)`**
- Returns resource type definition: singular/plural/maximum (e.g., clone/clones/3 for core).
- Parameters: specialization name
- Returns: `{ singular: string, plural: string, maximum: number }`

**`simulateRotation(rotation, userConfig = {})`**
- Executes rotation repeatedly (benchmark mode) until horizon or max actions. Useful for repeated simulations.
- Parameters: rotation array, userConfig overrides
- Returns: Detailed simulation results with damage breakdown

**`simulateSequence(rotation, userConfig = {})`**
- Single-pass sequence execution (builder mode). Tracks step-by-step timeline, cooldowns at end, supports concurrent skill placement.
- Parameters: rotation array (items can be skill names or `{ name, interruptMs, offset }`), userConfig
- Returns: Results with `{ steps[], endState: { cooldowns, ammo, resource }, ...damageBreakdown }`

**`skillById(id)`**
- Lookup skill by GW2 skill ID.
- Parameters: id (number)
- Returns: Skill object or undefined

**`availableSkills(config)`**
- Filters all skills to those available for the build (specialization, terrestrial environment).
- Parameters: config (simulation config)
- Returns: Array of available skill objects

**`calculatedAttributes(config)`**
- Computes attributes from simulation config (used internally for damage calculation).
- Parameters: config
- Returns: Static attributes object

---

## Scheduler (`js/sim/scheduler/`)

### sim-scheduler-state.js

**`createSchedulerState(options = {})`**
- Creates fresh scheduler state: cooldowns, ammo, clones, pending resources, weapon set, instruments, etc.
- Parameters: `{ infiniteForge, startingTime }`
- Returns: State object

---

### sim-scheduler-events.js

**`createSchedulerEventFactory(helpers)`**
- Factory for creating scheduler events. Provides addEvent, addCondition, addDamage, addTraitProc helpers.
- Parameters: object with helpers (events, horizon, epsilon, conditionName, etc.)
- Returns: Object with `{ addEvent, addCondition, addDamage, addTraitProc, ... }` methods

---

### sim-scheduler-intents.js

**`createSchedulerIntentController(model)`**
- Creates intent controller: translates skill casts to scheduler events, manages weapon swap, autoattack chains.
- Parameters: model (scheduler model)
- Returns: Object with methods for casting, intent handling

---

### sim-scheduler.js

**`createScheduler(config, traits, horizon, model)`**
- Creates main scheduler instance from config/traits. Coordinates state, events, intents, clone attacks, profession actions.
- Parameters: config (sim config), traits (Set of trait names), horizon (duration), model (scheduler model)
- Returns: Scheduler instance with `{ cast(skill), advanceTo(time), state, events, warnings }`

---

## Resolver (`js/sim/resolver/`)

### sim-runtime-context.js

**`createRuntimeContext(options)`**
- Creates resolver execution context: breakdown tracking, condition state, proc tracking, relic state, sigil timers.
- Parameters: object with `{ config, traits, scheduler, horizon, query, helpers, queue }`
- Returns: Runtime context object with methods for recording procs, damage, conditions

---

### sim-query-context.js

**`buildResolverQuery(config, traits, events, model)`**
- Builds queryable event index for resolver (buffs, weapons, Aristocracy triggers, instruments, thorns stacks).
- Parameters: config, traits (Set), events array, model (resolver model)
- Returns: Query object with functions for looking up stacked buffs, durations, instrument state, etc.

---

### sim-resolver.js

**`resolveScheduledStream(options)`**
- Main resolver: processes scheduled events through damage/condition/effect resolution, produces final breakdown.
- Parameters: object with `{ stream, config, traits, scheduler, query, helpers }`
- Returns: Damage breakdown with breakdowns by skill, damage/condition totals, encounter timeline

---

## Shared Simulation (`js/sim/shared/`)

### sim-event-queue.js

**`compareQueuedEvents(a, b)`**
- Comparator for event sorting: by time, then priority, then insertion order.
- Parameters: two event objects
- Returns: `number` (-1, 0, 1)

**`enqueueOrdered(queue, event)`**
- Inserts event into queue maintaining sorted order (uses binary search).
- Parameters: queue (array), event (object)
- Returns: Event object

**`sortQueuedEvents(queue)`**
- Sorts entire queue in-place using compareQueuedEvents.
- Parameters: queue (array)
- Returns: Sorted queue

**`takeNextEvent(queue)`**
- Dequeues and returns first event (FIFO).
- Parameters: queue (array)
- Returns: First event or undefined

---

### sim-scheduled-event-stream.js

**`buildScheduledEventStream(options)`**
- Creates versioned event stream for passing to resolver.
- Parameters: object with `{ events, rotationEndTime, resolverHandoff, source }`
- Returns: Scheduled event stream object

**`assertScheduledEventStream(stream)`**
- Validates stream structure/version. Throws if invalid.
- Parameters: stream (object)
- Returns: Stream object (if valid)

---

## Mechanics (`js/sim/mechanics/`)

### mesmer-skill-normalization.js

**`normalizedSkill(rawSkill)`**
- Transforms catalog skill into usable form: adds activation/cooldown adjustments per boons.
- Parameters: rawSkill from catalog
- Returns: Normalized skill object

---

### sim-profession-actions.js

**`createProfessionActionController(helpers)`**
- Factory for profession mechanics: shatters, blade generation, notes, clone attacks, resource consumption.
- Parameters: helpers object with state, traits, resourceDefinition, etc.
- Returns: Object with shatter/bladesong/instrument trigger functions

---

### sim-illusion-actions.js

**`createCloneAttackScheduler(helpers)`**
- Schedules clone/phantasm auto-attacks and applies ambush effects.
- Parameters: helpers (scheduler, state, config, etc.)
- Returns: Scheduler for clone attacks

---

### sim-resolver-trait-rules.js

**`createTraitRuleResolver(query)`**
- Applies trait-specific damage/condition modifiers during hit resolution.
- Parameters: query (resolver query)
- Returns: Object with functions for applying trait modifiers

---

### sim-relic-rules.js

**`recordPassiveRelicTimeline(ctx, events, horizon)`**
- Generates passive events for relics (Aristocracy, Peitha, Thorns, etc.) and applies ongoing effects.
- Parameters: ctx (runtime context), events (array), horizon (duration)
- Returns: void (modifies ctx and events in place)

---

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
