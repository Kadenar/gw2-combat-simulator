# Guild Wars 2 Combat Simulator

A browser-based PvE build and rotation simulator for **Guild Wars 2**.

Configure a build, create a rotation, and simulate combat to understand where your damage comes from, how profession
mechanics interact, and how RNG can affect the final result.

**[Launch the simulator](https://kadenar.github.io/gw2-combat-simulator/)**

---

## What is this?

GW2 Combat Simulator is a client-side combat modeling tool designed for controlled build and rotation analysis.

Instead of relying on a recorded benchmark attempt, the simulator executes a rotation against a modeled target and
produces an event-by-event result using Guild Wars 2 combat formulas, profession mechanics, traits, boons, conditions,
cooldowns, resources, and modifiers.

It is useful for:

- Comparing builds under identical conditions
- Testing rotation changes without repeatedly benchmarking in game
- Understanding where damage is gained or lost
- Inspecting strike and condition damage contributions
- Evaluating traits, modifiers, weapons, and profession mechanics
- Measuring the effect of weapon and proc RNG
- Reconstructing rotations from supported EVTC combat logs

The simulator is intended as an **analysis tool**, not a replacement for in-game testing or benchmark logs.

---

## Features

### Build configuration

Configure the major pieces of a PvE build directly in the browser:

- Equipment and attributes
- Weapons
- Runes, sigils, relics, and consumables
- Traits and specializations
- Heal, utility, and elite skills
- Profession-specific mechanics
- Boons, conditions, and target assumptions

Builds are stored locally in your browser and can also be imported or exported as JSON.

### Rotation builder

Build rotations interactively using the skills available to the selected build.

The simulator models execution state including:

- Cast times and aftercasts
- Cooldowns
- Ammo and charges
- Weapon swaps
- Profession resources
- Boons and conditions
- Skill chains
- Profession mechanics
- Deferred and triggered effects

Keyboard hotkeys can also be used to add weapon, utility, and profession skills while constructing a rotation.

### Deterministic simulation

The default simulation mode produces a reproducible expected result for the same build and rotation.

Use it to inspect:

- Total DPS
- Skill damage
- Condition damage
- Damage modifiers
- Cast and damage events
- Buff and condition state
- Resource usage
- Execution timelines

This makes it useful for controlled A/B comparisons when testing changes.

### RNG distribution

Some GW2 damage comes from effects that cannot be represented perfectly by a single expected value.

RNG simulation runs reproducibly seeded trials to estimate the distribution of possible outcomes, including:

- Mean DPS
- Median DPS
- Likely DPS range
- Unlucky outcomes
- Lucky outcomes

Supported RNG sources include weapon-strength rolls and modeled random/on-critical effects.

### EVTC rotation import

Supported `.evtc` / compressed combat logs can be used to reconstruct a recorded player's rotation.

The importer matches the active profession and specialization, extracts supported combat actions, and converts them into
simulator rotation entries.

This makes it possible to take a rotation performed in game and analyze it using the simulator's deterministic combat
model.

See [EVTC Rotation Reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md) for implementation details and limitations.

---

## Supported professions

| Profession       | Specializations                                     |
| ---------------- | --------------------------------------------------- |
| **Elementalist** | Core, Tempest, Weaver, Catalyst, Evoker             |
| **Engineer**     | Core, Scrapper, Holosmith, Mechanist, Amalgam       |
| **Guardian**     | Core, Dragonhunter, Firebrand, Willbender, Luminary |
| **Mesmer**       | Core, Chronomancer, Mirage, Virtuoso, Troubadour    |
| **Necromancer**  | Core, Reaper, Scourge, Harbinger, Ritualist         |
| **Ranger**       | Core, Druid, Soulbeast, Untamed, Galeshot           |
| **Revenant**     | Core, Herald, Renegade, Vindicator, Conduit         |
| **Thief**        | Core, Daredevil, Deadeye, Specter, Antiquary        |
| **Warrior**      | Core, Berserker, Spellbreaker, Bladesworn, Paragon  |

Profession implementations share the same simulation engine while retaining profession-specific skills, mechanics,
resources, traits, and rules.

---

## How simulation works

At a high level, a simulation has two stages.

### 1. Schedule the rotation

The scheduler processes the requested rotation and determines when actions can occur.

It tracks things such as:

- Skill availability
- Cast duration
- Cooldowns
- Ammo
- Weapon swaps
- Profession actions
- Resource changes
- Triggered effects

The result is a millisecond-level combat timeline.

### 2. Resolve combat

The resolver processes the scheduled events in order and applies the relevant combat rules.

This includes:

- Strike damage
- Condition damage
- Critical hits
- Damage modifiers
- Boons
- Target state
- Sigils and relics
- Profession mechanics
- Resource interactions

Keeping scheduling and combat resolution separate allows the same rotation to be analyzed consistently across builds and
simulation modes.

---

## Running locally

### Requirements

- Node.js **20.19+**
- npm
- Google Chrome, only for browser tests

Clone the repository and install dependencies:

```bash
git clone https://github.com/Kadenar/gw2-combat-simulator.git
cd gw2-combat-simulator
npm install
```

Start the local simulator:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

---

## Development

Create a production build:

```bash
npm run build
```

Run the test suite:

```bash
npm test
```

Run the browser tests:

```bash
npm run test:browser
```

Run formatting, lint, build, Node tests, type, artifact, and browser checks:

```bash
npm run check
```

The production site is emitted to:

```text
dist/site/
```

Compiled TypeScript used by tests and command-line tooling is emitted separately under the ignored `dist/js/` tree.

Do not commit generated `dist/` output.

---

## Specialized tooling

The root [`package.json`](package.json) is the source of truth for available commands. See
[`scripts/README.md`](scripts/README.md) for analysis tooling and [Patch preview](docs/architecture/PATCH-PREVIEW.md)
for balance-change authoring.

---

## Project structure

```text
gw2-combat-simulator/
├── js/
│   ├── kernel/            Game-neutral simulation primitives
│   ├── ui/                Game-neutral simulation views
│   ├── app/               Game registry, bootstrap, and shell
│   └── games/gw2/         GW2 platform, content, app, and integrations
│
├── data/games.json        Runtime game-data manifest
├── data/gw2/              GW2 build and rotation presets
├── docs/                  Architecture and implementation documentation
├── scripts/               Build, data, analysis, and maintenance tooling
│
├── index.html             Simulator landing page
├── patch-preview.html     Local patch authoring interface
└── package.json
```

---

## Documentation

Additional technical documentation is available under [`docs/`](docs/).

Useful starting points:

- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Module responsibilities](docs/architecture/MODULES.md)
- [Programmatic simulation](docs/architecture/PROGRAMMATIC-SIMULATION.md)
- [Patch preview](docs/architecture/PATCH-PREVIEW.md)
- [EVTC rotation reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md)
- [Community build submissions](docs/BUILD-SUBMISSIONS.md)

Profession-specific implementation notes are available under [`docs/professions/`](docs/professions/).

---

## Community builds

Community build and rotation presets can be submitted through the repository's GitHub Issue Form.

A submission should include:

- Exported `build.json`
- Matching `rotation.json`
- Profession and specialization
- Expected simulator DPS
- Optional benchmark source
- Any relevant reviewer notes

Submissions are reviewed before being added to the repository.

See [Community Build Submissions](docs/BUILD-SUBMISSIONS.md) for the full process.

---

## Accuracy and scope

GW2 Combat Simulator is a combat model.

Results are intended to provide controlled, reproducible estimates for comparing builds and rotations. They should not
be interpreted as guaranteed in-game DPS.

Real gameplay may differ because of factors such as encounter mechanics, movement, latency, player execution,
undocumented behavior, incomplete modeling, or game updates.

Where possible, simulator behavior should be validated against in-game testing and combat logs.

---

## Legal

This is an unofficial Guild Wars 2 fan project and is not affiliated with or endorsed by ArenaNet or NCSOFT.

Guild Wars Games © ArenaNet LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2, GW2, Heart of Thorns,
Path of Fire, End of Dragons, Secrets of the Obscure, Janthir Wilds, Visions of Eternity, and all associated logos,
designs, and composite marks are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the
property of their respective owners.
