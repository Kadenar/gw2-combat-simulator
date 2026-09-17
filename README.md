# Guild Wars 2 Combat Simulator

A browser-based PvE build and rotation simulator for **Guild Wars 2**.

Instead of relying on a recorded benchmark attempt, the simulator runs a rotation against a modeled target and produces
an event-by-event result using GW2 combat formulas, profession mechanics, traits, boons, conditions, cooldowns,
resources, and modifiers.

**[Launch the simulator](https://kadenar.github.io/gw2-combat-simulator/)**

Use it to:

- Compare builds and rotations under identical conditions without re-benchmarking in game
- See where strike and condition damage is gained or lost
- Evaluate traits, modifiers, weapons, and profession mechanics
- Measure the effect of weapon-strength and proc RNG
- Reconstruct rotations from supported EVTC combat logs

It is an **analysis tool**, not a replacement for in-game testing or benchmark logs.

---

## Features

### Build configuration

Configure equipment and attributes, weapons, runes, sigils, relics, consumables, traits, slot skills,
profession-specific mechanics, and boon/condition/target assumptions. Builds are saved locally in the browser and can be
imported or exported as JSON.

### Rotation builder

Build rotations from the selected build's skills, by clicking or with keyboard hotkeys. The simulator enforces cast
times and aftercasts, cooldowns, ammo and charges, weapon swaps, skill chains, profession resources, and deferred or
triggered effects.

**Precombat preparation** requires a **Combat Start** marker. Add **Wait** entries to model preparation time; cooldowns
carry into combat. **Precast relics** (gear panel) apply their buffs before combat, keeping their original expiry, but
only the combat relic can trigger again. Mount Balrior activates one second after the elite finishes and assumes you
stay in its area. **Overlay relics** shows activation and expiry markers on the timeline.

### Deterministic simulation

The default mode produces a reproducible expected result for controlled A/B comparisons: total DPS, per-skill and
condition damage, damage modifiers, cast/damage events, buff and condition state, resource usage, and execution
timelines.

### RNG distribution

RNG mode runs reproducibly seeded trials to estimate mean, median, likely range, and unlucky/lucky outcomes. Modeled
sources include weapon-strength rolls and random or on-critical effects.

### EVTC rotation import

Supported `.evtc` and compressed logs can be converted into simulator rotations. The importer matches the active
profession and specialization and extracts supported combat actions. See
[EVTC Rotation Reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md) for details and limitations.

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

---

## How simulation works

1. **Schedule.** The scheduler turns the rotation into a millisecond-level timeline, tracking skill availability, cast
   duration, cooldowns, ammo, weapon swaps, resources, and triggered effects.
2. **Resolve.** The resolver processes those events in order, applying strike and condition damage, critical hits,
   modifiers, boons, target state, sigils, relics, and profession mechanics.

Keeping the stages separate lets the same rotation be analyzed consistently across builds and simulation modes. See
[Architecture](docs/architecture/ARCHITECTURE.md) for details.

---

## Running locally

Requires Node.js **24.11+** (latest Node 24 LTS), npm, and Google Chrome for browser tests.

```bash
git clone https://github.com/Kadenar/gw2-combat-simulator.git
cd gw2-combat-simulator
npm install
npm run dev              # open the URL Vite prints (normally http://localhost:5173)
```

### Development

```bash
npm run build            # production site → dist/site/
npm test                 # test suite
npm run test:browser     # browser tests
npm run check            # format, lint, build, Node tests, typecheck, artifact and browser checks
```

Compiled TypeScript for tests and CLI tooling goes to `dist/js/`. Never commit `dist/` output.

Production builds exclude the local `patch-preview.html` authoring page. Run `npm run author:patch-preview` for the
editor and its authoring API, and validate that development build with
`node scripts/build/check-site.mjs --development`.

[`package.json`](package.json) is the source of truth for commands; see [`scripts/README.md`](scripts/README.md) for
analysis tooling.

---

## Project structure

```text
gw2-combat-simulator/
├── js/
│   ├── kernel/            Game-neutral simulation primitives
│   ├── ui/                Game-neutral simulation views
│   ├── app/               Game registry, bootstrap, and shell
│   └── games/gw2/         GW2 platform, professions, app, and integrations
├── data/games.json        Runtime game-data manifest
├── data/gw2/              GW2 build and rotation presets
├── docs/                  Architecture and implementation documentation
├── scripts/               Build, data, analysis, and maintenance tooling
├── index.html             Simulator landing page
└── patch-preview.html     Local patch authoring interface
```

## Documentation

- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Module responsibilities](docs/architecture/MODULES.md)
- [Programmatic simulation](docs/architecture/PROGRAMMATIC-SIMULATION.md)
- [Patch preview](docs/architecture/PATCH-PREVIEW.md)
- [EVTC rotation reconstruction](docs/EVTC-ROTATION-RECONSTRUCTION.md)
- [Profession implementation notes](docs/professions/)

---

## Community builds

Submit build and rotation presets through the repository's GitHub Issue Form with an exported `build.json`, matching
`rotation.json`, profession and specialization, expected simulator DPS, and optional benchmark source and reviewer
notes. Submissions are reviewed before being added. See [Community Build Submissions](docs/BUILD-SUBMISSIONS.md).

---

## Accuracy and scope

Results are controlled, reproducible estimates for comparing builds and rotations, not guaranteed in-game DPS.
Encounter mechanics, movement, latency, player execution, undocumented behavior, incomplete modeling, and game updates
can all cause differences. Validate against in-game testing and combat logs where possible.

---

## Legal

The simulator's original code and documentation are proprietary. Use through an authorized website is permitted; hosting
or redistribution requires separate permission. Snow Crows' existing hosting permission is preserved. See
[LICENSE.md](LICENSE.md) for the full notice and third-party exclusions.

This is an unofficial Guild Wars 2 fan project and is not affiliated with or endorsed by ArenaNet or NCSOFT.

Guild Wars Games © ArenaNet LLC. All rights reserved. NCSOFT, ArenaNet, Guild Wars, Guild Wars 2, GW2, Heart of Thorns,
Path of Fire, End of Dragons, Secrets of the Obscure, Janthir Wilds, Visions of Eternity, and all associated logos,
designs, and composite marks are trademarks or registered trademarks of NCSOFT Corporation. All other trademarks are the
property of their respective owners.
