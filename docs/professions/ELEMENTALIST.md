# Elementalist

Elementalist is a native shared-engine profession. The retired standalone
implementation has been removed; reproducible parity audits use the ignored
upstream clone in `reference-repos/Elementalist-Simulator/`.

## Entry points

- `elementalist.html` boots the shared application shell.
- `js/professions/elementalist/definition.ts` exports the profession contract.
- `js/professions/elementalist/app/app-definition.ts` supplies the browser
  adapter, assumptions, result views, and persistence boundary.
- `js/professions/elementalist/catalog.ts` builds the canonical skill catalog.
- `js/professions/elementalist/build.ts` owns canonical build defaults and
  migration.

## Profession layout

```text
js/professions/elementalist/
  app/                    shared-shell adapter
  core/                   attunements, core rules, modifiers, state, and UI
  data/                   skill, trait, gear, ID, and API metadata
  mechanics/              catalog mechanics metadata
  specializations/
    tempest/              overload and Tempest behavior
    weaver/               dual attunement and Weaver behavior
    catalyst/             energy, spheres, empowerment, and Catalyst behavior
    evoker/               familiars, charges, and Evoker behavior
  assumptions.ts          Elementalist-only simulation assumptions
  build.ts                canonical build codec
  build-attributes.ts     profession attribute contributions
  catalog-data.ts         canonical skill definitions
  definition.ts           profession contract
  family.ts               shared-engine family definition
  modules.ts              core/specialization module composition
  types.d.ts              Elementalist state and configuration contracts
```

The shared engine owns scheduling, generic event processing, common Guild Wars
2 formulas, equipment, conditions, and generic UI composition. Elementalist
owns only profession-specific state, rules, resolver extensions, and views.

## Presets and rotations

`Builds/elementalist/manifest.json` is the supported preset inventory. Each
entry points to a build in `Builds/elementalist/` and a rotation in
`Rotations/elementalist/`. Tests reject missing or orphaned supported assets and
load every retained preset through the native build codec.

## Reference audit

The audit baseline is the upstream repository at
`reference-repos/Elementalist-Simulator/`. It is intentionally retained and
ignored by Git for future audits. The reference is never imported by the
production application.

After building modules, run:

```powershell
npm run build:modules
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-power-tempest-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-catalyst-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-weaver-reference.mjs --check-actionable --summary
node --import ./scripts/testing/register-dist-loader.mjs scripts/audit/compare-evoker-reference.mjs --check-actionable --summary
```

The suite covers 39 upstream fixtures: 13 Tempest, 11 Catalyst, five Weaver,
and 10 Evoker. The actionable aggregate threshold is 1.2% DPS. It also checks
warnings, timelines, mechanics, per-ability strike and condition components,
casts, hits, condition applications, effective stack-seconds, and rejects
unclassified differences.

Current results and diagnosed shared-engine limitations are documented in:

- `ELEMENTALIST-NATIVE-MIGRATION-AUDIT.md`
- `POWER-TEMPEST-REFERENCE-AUDIT.md`
- `ELEMENTALIST-CATALYST-PARITY-HANDOFF.md`
- `ELEMENTALIST-WEAVER-PARITY-HANDOFF.md`
- `ELEMENTALIST-EVOKER-PARITY-HANDOFF.md`

## Elemental profiles

The native tool supports an EVTC-derived Fire Elemental profile for normal
simulation and a fixed `reference` profile for reproducible upstream fixture
comparison. The latter is an explicit data profile, not a second simulator.
Air, Ice, and Earth Elemental AI require additional combat-log evidence before
distinct behavior can be implemented.
