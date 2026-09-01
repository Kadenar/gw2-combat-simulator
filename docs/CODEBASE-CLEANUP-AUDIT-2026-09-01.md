# Codebase cleanup audit — 2026-09-01

## Scope

This cleanup-only audit covered 1,238 JavaScript/TypeScript source files (about 258,000 lines, including generated
metadata), 198 test files (about 94,000 lines), 30 scripts, dependencies, build configuration, and architecture
documentation. Findings were validated against imports and call sites; generated API snapshots, large behavioral tests,
and active migration documents were not treated as problems merely because they are large. `npm run typecheck` and
`npm run lint` both pass at the audited revision.

## Ranked findings

1. `[shrink]` `js/**/*.ts` contains 648 JSDoc type tags (`@param`, `@returns`, `@template`, `@typedef`, and `@property`)
   across 48 already-typed TypeScript files; remove the roughly 400 type-only lines while retaining behavioral,
   invariant, and edge-case prose, with the heaviest duplication in `platform/builds/codec.ts`,
   `platform/combat/query/combat-query.ts`, `platform/engine/execution/scheduler.ts`, and
   `app/build/panels/presets.ts`.
2. `[yagni]` `js/app/game/`, `js/games/gw2/plugin.ts`, and the two `worker-driver.ts` layers implement a validated,
   lazy multi-game plug-in framework even though `data/games.json` declares only GW2; bootstrap directly from the
   profession registry and load the GW2 worker adapter directly, deleting the fake-game fixture and framework-only
   tests until a second game actually exists (about 300 lines).
3. `[native]` `tests/architecture/{game-boundaries,platform-app-boundary,import-alias}.*`,
   `tests/professions/profession-architecture-baseline.test.js`, and parts of
   `tests/professions/profession-family.test.js` contain four separate source-tree walkers, two import parsers, and
   migration tombstones that overlap `eslint.config.js`; express static import boundaries with the existing
   `no-restricted-imports` rules and keep only runtime composition contracts (about 260 lines).
4. `[delete]` `js/games/gw2/platform/engine/resolution/resolver.ts` is a documented but unexported 217-line alternate
   direct resolver imported only by architecture tests while production uses `platform/resolver/resolve-timeline.ts`;
   retire the alternate engine, its direct-resolver-only assertions, and its promise in `ARCHITECTURE.md` (about 230
   lines).
5. `[delete]` production exports `eventLogRows`, `gw2WeaponStrength`, `defineGw2ResolverReactions`, `templateHasBoon`,
   `PROFESSION_ROUTES`, `professionRoute`, `weaponBarSkillStacks`, `partitionPatchAuthoringBalanceProfiles`,
   `criticalChanceAt`, and `weaponStrengthHalfRange` are called only by tests; delete these test-only APIs, their private
   support code, and tests of behavior that no application path consumes (about 180 lines).
6. `[delete]` `js/games/gw2/platform/engine/skills/factories.ts` spends 120 lines documenting and implementing an
   unused one-line `{ ...definition, implemented: true }` spread, with another dedicated test file and a documentation
   entry; delete all three because no skill authoring code calls it (about 149 lines).
7. `[shrink]` the eight `integrations/logs/evtc/rotation/professions/*/shared.ts` files repeat combat-start lookup,
   player-instance lookup, raw skill naming, catalog-duration lookup, zero-duration action construction, and nearby
   action deduplication; move only these exact common operations into one EVTC reconstruction helper instead of keeping
   profession-renamed copies (about 100 lines).
8. `[delete]` the private package exports roughly two dozen declarations with no consumer, including
   `ShellLifecycle`, `bootstrapProfessionApp`, `ENGINEER_INTERNAL_IDS`, `REVENANT_SPECIALIZATION_IDS`,
   `WARRIOR_SPECIALIZATION_IDS`, `ResolvedRotationAction`, seven redundant EVTC aliases, `PROFESSION_HOOK_ORDER`,
   `ComposedProfessionState`, and `KernelEvent`; remove the declarations and stop emitting the two specialization maps
   from their data generators (about 90 lines).
9. `[delete]` `scripts/build/version-pages-assets.mjs` is an unreferenced 45-line build mutation script absent from
   `package.json`, Vite, CI, tests, and documentation; delete it rather than preserve an undiscoverable second asset
   versioning path.
10. `[shrink]` every `content/professions/*/data/traits-data.ts` wrapper clones arrays, sets, and trait lists already
    produced by `createProfessionTraitData`; export typed aliases to the shared result so there is one immutable-looking
    value per dataset and no nine-fold copy boilerplate (about 35 lines).
11. `[shrink]` all nine profession build modules import and re-export the same
    `platform/builds/default-target-conditions.ts` function only so all nine app definitions can pass it back into
    `defineProfessionApp`; make it the factory default in `app/create-adapter.ts` and remove the forwarding chain (about
    30 lines).
12. `[shrink]` `Gw2AppAdapter` exposes both legacy `renderResults` and `presentation`, and feature runners still call the
    former while the shell uses the latter; route every render through the presentation contract and remove the
    compatibility member and wrapper (about 20 lines).
13. `[delete]` the nine `snapshot` properties in `vite.config.js` are never read by `renderProfessionPages` and duplicate
    dates maintained in profession documentation; delete the dead page configuration (9 lines).
14. `[shrink]` `js/ui/shared/html.ts` and `js/games/gw2/app/presentation/shared/html.ts` contain identical `escapeHtml`
    implementations; import or re-export the neutral UI helper from the GW2 module (6 lines and one duplicate security
    primitive).

## Net

`net: -1,700 lines, -0 deps possible.`

The estimate is conservative and removes overlapping lines only once. No dependency is a credible removal candidate:
all six development dependencies back the active build, typecheck, lint, formatting, or Vite workflow.
