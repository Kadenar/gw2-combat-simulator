# Elementalist

Native shared-engine profession. Entry point `elementalist.html`.
`definition.ts` exports the profession contract; `family.ts` composes Core with
one of Tempest, Weaver, Catalyst, or Evoker. Core owns skills, attunements,
rules, state, and UI; each specialization owns its behavior under
`specializations/<name>/`. The shared engine owns scheduling, event processing,
GW2 formulas, equipment, conditions, and generic UI composition.

## Data

- API identity snapshot: 2026-08-12 (official GW2 API).
- Refresh: `npm run update:elementalist-data`.
- Generated API/trait/coverage metadata lives in `data/`; simulation-affecting
  fields live in owner-local modules. Runtime simulation is network-free.

## Implemented systems

- **Core** — attunements, weapon skills, shared rules/state, and profession
  attribute contributions.
- **Tempest** — overload behavior.
- **Weaver** — dual attunement behavior.
- **Catalyst** — energy, spheres, and empowerment.
- **Evoker** — familiars, charges, and Calcify commands.
- **Summoned elemental** — the elite selector exposes Fire and Earth variants of
  Glyph of Elementals; the chosen actor is created automatically on first
  action, uses its autonomous attacks, exposes a rotation command (Flame Barrage
  / Stomp), inherits party boons, expires after 120s, and recharges its glyph.

`Builds/elementalist/manifest.json` is the supported preset inventory; tests
reject missing/orphaned assets and load every preset through the native codec.

## Reference audit

The audit baseline is the upstream repository at
`reference-repos/Elementalist-Simulator/` (retained, Git-ignored, never
imported by the app). After `npm run build:modules`, the
`scripts/audit/compare-*-reference.mjs` scripts check 39 upstream fixtures
(13 Tempest, 11 Catalyst, 5 Weaver, 10 Evoker) against a 1.2% DPS actionable
threshold, plus warnings, timelines, mechanics, and per-ability components.
Diagnosed limitations are documented in the `ELEMENTALIST-*` and `*-AUDIT` /
`*-HANDOFF` markdown files at the repo root.

## Modeling boundaries

Single-target, outgoing-damage focused. Air and Ice Elemental AI remain
unsupported pending combat-log evidence. Ally support, incoming attacks,
pathing, secondary targets, and competitive (PvP/WvW) splits are out of model.
