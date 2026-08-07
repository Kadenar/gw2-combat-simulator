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
- **Thief**: Core, Daredevil, Deadeye, Specter, and Antiquary.

The Elementalist package is a direct port of the reference
`Elementalist-Simulator` implementation. It retains its event scheduler,
resolver, traits, attunements, profession resources, skill data, presets,
rotation builder, and gear optimizer. All profession applications use the
same visual system and keep independent browser-local builds.

## Run

Node.js 20 or newer is required.

```powershell
cd gw2-combat-simulator
npm start
```

Open `http://127.0.0.1:4173`.

`npm start`, `npm test`, and `npm run check` compile the migrated TypeScript
modules automatically. Run `npm run build` directly when only the browser
JavaScript output needs to be refreshed. TypeScript is emitted into the ignored
`dist/js/` tree after a clean build. The development server serves compiled
modules from there and falls back to `js/` only for JavaScript-only or generated
modules. Do not commit compiled output or add `.js` siblings beside `.ts`
sources.

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
```

## Layout

```text
gw2-combat-simulator/
  js/
    platform/                  profession-neutral engine, GW2, and UI contracts
    professions/
      mesmer/                  Mesmer implementation
      elementalist/            Elementalist implementation and optimizer
      guardian/                Guardian data, rules, mechanics, and build codec
      necromancer/             Necromancer data, shrouds, summons, and rules
      engineer/                Engineer kits, heat, mech, and Amalgam rules
      revenant/                Revenant legends, energy, and Conduit rules
      thief/                   Thief initiative, stealth, and artifact rules
    app/                       shared browser shell and composition
  Builds/                      build presets and manifests
    manifest.json              Elementalist preset manifest
    <profession>/              native profession builds and manifest
  Rotations/                   Elementalist rotation examples
    <profession>/              native profession rotation examples
  csv input/                   Elementalist skill and hit data
  index.html                   Generic profession landing page
  mesmer.html                  Mesmer application
  elementalist.html            Elementalist application
  guardian.html                Guardian application
  necromancer.html             Necromancer application
  engineer.html                Engineer application
  revenant.html                Revenant application
  thief.html                   Thief application
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the profession contract and
import boundaries, and [docs/MODULES.md](docs/MODULES.md) for module
responsibilities and public contracts. Headless use of the same simulation API
called by the test suite is described in
[docs/PROGRAMMATIC-SIMULATION.md](docs/PROGRAMMATIC-SIMULATION.md).
Profession-specific documentation:

- Mesmer architecture and modeling assumptions: [docs/MESMER.md](docs/MESMER.md)
- Elementalist implementation details: [docs/ELEMENTALIST.md](docs/ELEMENTALIST.md)
- Guardian status: [docs/GUARDIAN.md](docs/GUARDIAN.md)
- Necromancer status: [docs/NECROMANCER.md](docs/NECROMANCER.md)
- Engineer status: [docs/ENGINEER.md](docs/ENGINEER.md)
- Revenant status: [docs/REVENANT.md](docs/REVENANT.md)
- Thief status: [docs/THIEF.md](docs/THIEF.md)
