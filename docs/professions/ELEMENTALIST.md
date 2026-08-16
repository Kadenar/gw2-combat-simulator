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
  core/                   core skills, attunements, rules, state, and UI
  data/                   generated API, trait, coverage, and ID metadata
  mechanics/              catalog mechanics metadata
  specializations/
    tempest/              overload and Tempest behavior
    weaver/               dual attunement and Weaver behavior
    catalyst/             energy, spheres, empowerment, and Catalyst behavior
    evoker/               familiars, charges, and Evoker behavior
  assumptions.ts          Elementalist-only simulation assumptions
  build.ts                canonical build codec
  build-attributes.ts     profession attribute contributions
  catalog-data.ts         inert generated metadata and module catalog options
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
load every retained preset through the native build codec. Presets are stored
directly in the canonical versioned build schema used by the shared shell.

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
- `ELEMENTALIST-NATIVE-ELEMENTAL-AUDIT.md`
- `POWER-TEMPEST-REFERENCE-AUDIT.md`
- `ELEMENTALIST-CATALYST-PARITY-HANDOFF.md`
- `ELEMENTALIST-WEAVER-PARITY-HANDOFF.md`
- `ELEMENTALIST-EVOKER-PARITY-HANDOFF.md`

## Summoned elemental

The elite skill selector exposes separate Fire and Earth variants of Glyph of
Elementals. The simulation reads that selection and automatically creates the
chosen actor on the first player action or explicit combat marker; rotations
do not cast the summon themselves.

Fire Elemental autonomously uses Fireball and Flame Burst and exposes Flame
Barrage as its rotation command. Earth Elemental autonomously uses Punch and
Enervating Punch, which applies three seconds of Weakness on an eight-second
recharge, and exposes Stomp as its rotation command. Stomp deals summon strike
damage, grants three seconds of Protection to allies, applies five seconds of
Crippled, and applies one second of Immobilized. Both actors use the shared
summon scheduler, inherit eligible party boons, interrupt
their current action when commanded, expire after 120 seconds, and put their
selected glyph on the post-expiry recharge.

The EVTC importer reconstructs Elementalist attunement changes, maps the raw
Firestorm and Lightning Storm IDs to their attunement-specific Glyph of Storms
skills, recovers Fire Elemental Flame Barrage and Earth Elemental Stomp
commands from their owned actors, and recovers Evoker Calcify commands from
the familiar actor. Air and Ice Elemental AI remain unsupported pending
combat-log evidence.
