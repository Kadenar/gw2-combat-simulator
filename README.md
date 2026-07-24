# Guild Wars 2 Combat Simulator

A standalone deterministic PvE build and rotation simulator for Mesmer and
Elementalist.

Select the profession from the shared header:

- **Mesmer**: Core, Chronomancer, Mirage, Virtuoso, and Troubadour.
- **Elementalist**: Core, Tempest, Weaver, Catalyst, and Evoker.

The Elementalist package is a direct port of the reference
`Elementalist-Simulator` implementation. It retains its event scheduler,
resolver, traits, attunements, profession resources, skill data, presets,
rotation builder, and gear optimizer. Both profession applications use the
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

## Layout

```text
gw2-combat-simulator/
  js/
    platform/                  profession-neutral engine, GW2, and UI contracts
    professions/
      mesmer/                  Mesmer implementation
      elementalist/            Elementalist implementation and optimizer
    app/                       shared shell and Mesmer composition
  Builds/                      Elementalist build presets
  Rotations/                   profession rotation examples
  csv input/                   Elementalist skill and hit data
  index.html                   Mesmer application
  elementalist.html            Elementalist application
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the profession contract and import
boundaries. Mesmer implementation assumptions remain in
[RESEARCH.md](RESEARCH.md); Elementalist implementation details are in
[ELEMENTALIST.md](ELEMENTALIST.md).
