# Guild Wars 2 Combat Simulator

A standalone deterministic PvE build and rotation simulator with browser
applications for every profession registered in
`js/app/profession/registry.js`.

Choose a profession from the landing page or the shared simulator header:

- **Mesmer**: Core, Chronomancer, Mirage, Virtuoso, and Troubadour.
- **Elementalist**: Core, Tempest, Weaver, Catalyst, and Evoker.
- **Guardian**: Core, Dragonhunter, Firebrand, Willbender, and Luminary.
- **Necromancer**: Core, Reaper, Scourge, Harbinger, and Ritualist.
- **Engineer**: Core, Scrapper, Holosmith, Mechanist, and Amalgam.
- **Revenant**: Core, Herald, Renegade, Vindicator, and Conduit.
- **Ranger**: Core, Druid, Soulbeast, Untamed, and Galeshot.
- **Warrior**: Core, Berserker, Spellbreaker, Bladesworn, and Paragon.
- **Thief**: Core, Daredevil, Deadeye, Specter, and Antiquary.

Elementalist now uses the same native family, scheduler, resolver, build codec,
and module-owned data boundaries as the other professions. Its retained
reference simulator is used only for parity audits. All profession applications
use the same visual system and keep independent browser-local builds.

## Run

Node.js 20.19 or newer is required.

```powershell
cd gw2-combat-simulator
npm start
```

Open `http://127.0.0.1:4173`.

### Author a patch preview

Start the dedicated authoring server and open `http://127.0.0.1:4174`. The
standalone authoring page loads every profession's live skill, trait, and
declarative modifier metadata. It groups entries by Core or elite
specialization, supports search, and writes a validated preview to
`js/patches/active-preview.ts`.

```powershell
npm run author:patch-preview
```

Existing effects can be numerically edited or removed, and complete new effect
objects can be added. Add the official ArenaNet patch-notes URL as preview
metadata; the UI generates a read-only change overview from the authored skill
and modifier diffs. A successful save updates source on disk; rebuild or
restart the simulator before using the preview in simulations. The authoring
server binds only to loopback on port `4174`; the normal simulator server on
port `4173` remains read-only and does not expose the authoring API.

`npm start`, `npm test`, and `npm run check` compile the migrated TypeScript
modules automatically. Local startup creates an unminified, source-mapped
multi-page bundle in `dist/site/`; `npm run build` creates the minified
deployment bundle. TypeScript is also emitted into the ignored `dist/js/` tree
for tests and command-line analysis. The development server prefers the
bundled site, serves hashed assets with immutable caching and compression, and
falls back to compiled or source modules for test fixtures. Do not commit
compiled output or add `.js` siblings beside `.ts` sources.

## Test

```powershell
npm test
npm run check
```

Refresh any native profession API snapshot with:

```powershell
npm run update:profession-data -- --profession Guardian
```

The generic command accepts new Guild Wars 2 profession names without a
central allowlist. Existing compatibility wrappers remain available:

```powershell
npm run update:mesmer-data
npm run update:guardian-data
npm run update:necromancer-data
npm run update:warrior-data
npm run update:ranger-data
```

## Layout

```text
gw2-combat-simulator/
  js/
    platform/                  profession-neutral engine, GW2, and UI contracts
    professions/
      mesmer/                  Mesmer implementation
      elementalist/            Native Elementalist implementation
      guardian/                Guardian data, rules, mechanics, and build codec
      necromancer/             Necromancer data, shrouds, summons, and rules
      engineer/                Engineer kits, heat, mech, and Amalgam rules
      revenant/                Revenant legends, energy, and Conduit rules
      warrior/                 Warrior adrenaline, bursts, and elite rules
      thief/                   Thief initiative, stealth, and artifact rules
      ranger/                  Ranger pets, Beastmode, Unleash, and Galeshot
    app/                       shared browser shell and composition
  Builds/                      build presets and manifests
    <profession>/              canonical builds and profession manifest
  Rotations/
    <profession>/              profession rotation examples
  index.html                   Generic profession landing page
  patch-preview.html           Local patch preview authoring interface
  mesmer.html                  Mesmer application
  elementalist.html            Elementalist application
  guardian.html                Guardian application
  necromancer.html             Necromancer application
  engineer.html                Engineer application
  revenant.html                Revenant application
  warrior.html                 Warrior application
  thief.html                   Thief application
  ranger.html                  Ranger application
```

Architecture and usage docs live in [docs/architecture/](docs/architecture/):
[ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for the profession contract
and import boundaries, [MODULES.md](docs/architecture/MODULES.md) for module
responsibilities and public contracts, and
[PROGRAMMATIC-SIMULATION.md](docs/architecture/PROGRAMMATIC-SIMULATION.md) for
headless use of the same simulation API called by the test suite.

Per-profession documentation lives in [docs/professions/](docs/professions/):

- Mesmer architecture and modeling assumptions: [MESMER.md](docs/professions/MESMER.md)
- Elementalist implementation details: [ELEMENTALIST.md](docs/professions/ELEMENTALIST.md)
- Guardian status: [GUARDIAN.md](docs/professions/GUARDIAN.md)
- Necromancer status: [NECROMANCER.md](docs/professions/NECROMANCER.md)
- Engineer status: [ENGINEER.md](docs/professions/ENGINEER.md)
- Revenant status: [REVENANT.md](docs/professions/REVENANT.md)
- Ranger status: [RANGER.md](docs/professions/RANGER.md)
- Thief status: [THIEF.md](docs/professions/THIEF.md)
- Warrior status: [WARRIOR.md](docs/professions/WARRIOR.md)

The GitHub Issue Form and maintainer review process for community build
submissions are documented in [docs/BUILD-SUBMISSIONS.md](docs/BUILD-SUBMISSIONS.md).
