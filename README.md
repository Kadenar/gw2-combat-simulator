# Guild Wars 2 Combat Simulator

A browser-based PvE build and rotation simulator for **Guild Wars 2**.

Run a rotation against a modeled target to compare builds, inspect damage and profession mechanics, or reconstruct
supported actions from combat logs.

**[Launch the simulator](https://kadenar.github.io/gw2-combat-simulator/)**

Results are controlled estimates for comparison, not guaranteed in-game DPS. Validate against in-game testing and logs.

## Features

### Build configuration

Configure equipment and attributes, weapons, runes, sigils, relics, consumables, traits, slot skills,
profession-specific mechanics, and boon/condition/target assumptions. Builds are saved locally in the browser and can be
imported or exported as JSON.

Simulations always assume player health is **100%**. Incoming damage and low-player-health combat scenarios are outside
scope. The isolated attribute preview can vary player health to show conditional stats, without affecting saved builds
or simulations. Target health remains configurable and decreases as damage is dealt.

### Rotation builder

Build rotations from the selected build's skills, by clicking or with keyboard hotkeys. The simulator enforces cast
times and aftercasts, cooldowns, ammo and charges, weapon swaps, skill chains, profession resources, and deferred or
triggered effects.

For precombat preparation, add a **Combat Start** marker and **Wait** entries; cooldowns carry into combat. **Precast
relics** apply buffs before combat with their original expiry; only the equipped combat relic can trigger again.

### Deterministic simulation

The default mode uses midpoint weapon strength and averaged critical damage, with seeded rolls for proc eligibility. The
**Critical damage** setting can instead apply individual critical rolls. Results include DPS, damage breakdowns,
modifiers, events, buffs, resources, and timelines.

The **Simulation seed** defaults to **1** and is saved with the build. Identical inputs and seeds reproduce results;
keep the seed fixed for A/B comparisons. A single run is one proc sample, not an average across trials.

### RNG distribution

RNG mode runs seeded trials with sampled weapon strength, rolled critical damage, and chance-based effects to estimate
mean, median, likely range, and unlucky/lucky outcomes.

### EVTC rotation import

Supported `.evtc` and compressed logs can be converted into simulator rotations. The importer matches the active
profession and specialization and extracts supported combat actions. See
[EVTC Rotation Reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md) for details and limitations.

### Benchmarks and boss scenarios

Open **Benchmarks** from the main navigation to browse saved build metrics, compare DPS and actions per minute, inspect
DPS by target-health band, or run a comparison over time. Open a benchmark's build and rotation in the simulator to
customize it. See [Benchmarks](wiki/Benchmarks.md).

In a profession workspace, **Bosses** creates a separate scenario from the active Golem build and rotation. Choose a
supported encounter and difficulty, configure group DPS and downtime, and inspect phase results. The model supports
health gates, timed damage windows, target changes, splits, and intermissions. See
[Boss scenarios](wiki/Boss-Scenarios.md).

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

## How simulation works

One live runtime interleaves rotation commands and combat effects on a shared clock and event queue. Cast admission
reads current cooldowns, resources, and profession state; the resolver applies damage and reactions in causal order.
Detailed and score-only runs use the same execution path. See [Architecture](docs/architecture/ARCHITECTURE.md).

## Running locally

Requires Node.js **24.11+** and npm. Browser tests also require Google Chrome.

```bash
git clone https://github.com/Kadenar/gw2-combat-simulator.git
cd gw2-combat-simulator
npm install
npm run dev              # open the URL Vite prints (normally http://localhost:5173)
```

### Development

```bash
npm run build            # production site → dist/site/
npm test                 # build and Node tests
npm run test:browser     # browser tests
npm run check            # format, lint, build, Node tests, typecheck, artifact checks
npm run check:all        # all checks, including browser tests
```

Compiled TypeScript for tests and CLI tooling goes to `dist/js/`. Never commit `dist/` output.

Production builds exclude the local `patch-preview.html` authoring page. Run `npm run author:patch-preview` for the
editor and its authoring API, and validate that development build with
`node scripts/build/check-site.mjs --development`.

[`package.json`](package.json) is the source of truth for commands; see [`scripts/README.md`](scripts/README.md) for
analysis tooling.

## Project structure

```text
gw2-combat-simulator/
├── js/
│   ├── kernel/            Game-neutral simulation primitives
│   ├── ui/                Game-neutral simulation views
│   ├── browser/           Shared browser services and shell
│   └── games/gw2/         GW2 platform, professions, app, and integrations
├── data/games.json        Runtime game-data manifest
├── data/gw2/              GW2 build and rotation presets
├── docs/                  Architecture and implementation documentation
├── scripts/               Build, data, analysis, and maintenance tooling
├── index.html             Simulator landing page
└── patch-preview.html     Local patch authoring interface
```

## Documentation

- [Agent API reference](docs/architecture/AGENT-API-REFERENCE.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Module responsibilities](docs/architecture/MODULES.md)
- [Programmatic simulation](docs/architecture/PROGRAMMATIC-SIMULATION.md)
- [Patch preview](docs/architecture/PATCH-PREVIEW.md)
- [EVTC rotation reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md)
- [Profession implementation notes](docs/professions/)

## Community builds

Submit build and rotation presets through the repository's GitHub Issue Form with an exported `build.json`, matching
`rotation.json`, profession and specialization, expected simulator DPS, and optional benchmark source and reviewer
notes. Submissions are reviewed before being added. See [Community Build Submissions](docs/BUILD-SUBMISSIONS.md).

## Accuracy and scope

The model focuses on single-target PvE outgoing damage. Movement, latency, incoming attacks, most support-only effects,
and mechanics beyond the authored boss phase plans are outside scope. Boss scenarios track encounter targets and group
damage while the player's attacks use the selected target; they do not model general cleave or a full encounter replay.
See [Accuracy and scope](wiki/Accuracy-and-Scope.md) and the profession notes for limitations.

## Legal

The simulator's original code and documentation are proprietary. Use through an authorized website is permitted; hosting
or redistribution requires separate permission. Snow Crows' existing hosting permission is preserved. See
[LICENSE.md](LICENSE.md) for the full notice and third-party exclusions.

This is an unofficial Guild Wars 2 fan project and is not affiliated with or endorsed by ArenaNet or NCSOFT.

Guild Wars Games © ArenaNet LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2, GW2, Heart of Thorns,
Path of Fire, End of Dragons, Secrets of the Obscure, Janthir Wilds, Visions of Eternity, and all associated logos,
designs, and composite marks are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the
property of their respective owners.
