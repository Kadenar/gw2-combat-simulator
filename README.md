# Guild Wars 2 Combat Simulator

A standalone deterministic PvE build and rotation simulator with browser
applications for Mesmer, Elementalist, Guardian, and Necromancer.

Select the profession from the shared header:

- **Mesmer**: Core, Chronomancer, Mirage, Virtuoso, and Troubadour.
- **Elementalist**: Core, Tempest, Weaver, Catalyst, and Evoker.
- **Guardian**: Core, Dragonhunter, Firebrand, Willbender, and Luminary.
- **Necromancer**: Core, Reaper, Scourge, Harbinger, and Ritualist.

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

No build step is required.

## Test

```powershell
npm test
npm run check
```

Refresh the checked-in Guardian API snapshot with:

```powershell
npm run update:guardian-data
```

Refresh the checked-in Necromancer API snapshot with:

```powershell
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
    app/                       shared browser shell and composition
  Builds/                      Elementalist build presets
  Rotations/                   profession rotation examples
  csv input/                   Elementalist skill and hit data
  index.html                   Mesmer application
  elementalist.html            Elementalist application
  guardian.html                Guardian application
  necromancer.html             Necromancer application
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the profession contract and import
boundaries. Mesmer implementation assumptions remain in
[RESEARCH.md](RESEARCH.md); Elementalist implementation details are in
[ELEMENTALIST.md](ELEMENTALIST.md); Guardian status is in
[GUARDIAN.md](GUARDIAN.md); Necromancer status is in
[NECROMANCER.md](NECROMANCER.md).
