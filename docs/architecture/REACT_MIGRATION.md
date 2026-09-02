# Incremental React UI migration

**Status:** Complete — all phases implemented locally

## Execution constraints

- Complete Phases 0 through 4 sequentially in the current local worktree.
- Do not create or open pull requests, branches, or commits as part of this migration.
- Treat each phase as a local implementation and verification checkpoint; the migration is complete only after every
  phase passes its exit criteria.

## Decision

The simulator can migrate to React incrementally. It does not need to become a fully React-owned application.

Keep the generated HTML document, application bootstrap, `ProfessionApp`, simulation engine, workers, persistence, and
domain models outside React. React will take ownership of selected dynamic containers one at a time. During migration,
the page may contain multiple React roots alongside untouched static and imperative DOM.

The permanent boundary is ownership, not framework purity:

- the Vite HTML template owns the document shell and stable mount containers;
- React exclusively owns the descendants of each React root;
- existing TypeScript may own DOM outside those roots;
- the engine and profession content remain independent of React.

This is supported directly by React's
[`createRoot` API](https://react.dev/reference/react-dom/client/createRoot#rendering-a-page-partially-built-with-react),
which permits multiple roots on a page that is only partially built with React.

## Context

The current application already has useful migration seams:

- `templates/profession.html` defines the static document and empty dynamic containers.
- `js/app/bootstrap.ts` and the game registry load the selected profession.
- `js/games/gw2/app/profession-app.ts` owns mutable application state, simulation revisions, and render orchestration.
- Build sections expose stable `renderX(app)` entry points through `BuildEditor`.
- Simulation results are projected through `SimulationViewModel` before presentation.
- The engine and programmatic simulation paths do not require a browser UI.

The main maintenance cost comes from renderers that:

1. build HTML strings;
2. assign `innerHTML`;
3. query the new subtree;
4. attach event handlers; and
5. repeat that work after `app.changed()`.

`renderGear` and `renderAssumptions` are representative examples. The rotation timeline is more advanced: it already
performs keyed reconciliation and should not be the first migration target.

## Goals

- Replace dynamic HTML-string rendering with typed components and JSX.
- Preserve current URLs, styling, saved builds, simulation behavior, and static-page generation.
- Preserve the existing application and engine boundaries.
- Migrate one reviewable UI surface at a time.
- Allow migrated and unmigrated surfaces to run together without sharing DOM ownership.
- Delete the old renderer and its listener-binding code when each surface moves.

## Non-goals

- Rewriting the simulation engine, workers, persistence, or profession contracts.
- Adding a router, React framework, server rendering, React Server Components, CSS-in-JS, or a component library.
- Introducing Redux or another state-management library.
- Converting static headers, legal text, or loading markup solely for consistency.
- Rewriting the timeline, drag-and-drop behavior, or charts before simpler panels establish the migration pattern.
- Maintaining two selectable implementations of a migrated panel.

## Target architecture

```text
Vite-generated HTML document
├── static header and page layout                    HTML owns this DOM
├── #gear-slots                                      React root
├── #attributes-list                                 React root
├── #traits-panel                                    React root
├── #skill-bar                                       React root
├── #perma-boons                                     React root
├── #rotation-palette / #rotation-timeline           React roots
└── #rotation-results                                React root

ProfessionApp
├── build and result state
├── app.changed() orchestration
├── simulation revisions and worker completion
└── calls existing render entry points

React panels
├── receive app state or narrow view-model props
├── mutate through existing application operations
└── call app.changed() using the current commit semantics

Simulation engine, profession content, workers, and persistence
└── no React imports
```

Multiple roots are acceptable. Adjacent roots should be merged only when they need shared React context, coordinated
local state, or atomic rendering. A root-count reduction is not itself a migration goal.

## DOM ownership rules

1. React is the only code allowed to mutate descendants of a React root.
2. Imperative code may locate the root container but must not query or mutate its descendants.
3. A converted renderer must delete its `innerHTML`, `createElement`, and listener-binding implementation in the same
   change.
4. Components must not use `dangerouslySetInnerHTML` for application data. Reviewed, compile-time static assets such as
   an SVG may remain outside React or be represented as JSX.
5. React roots mount only into stable containers that survive for the page lifetime. A removable container must call
   `root.unmount()` before removal.
6. Existing IDs and classes should be retained until behavior and CSS compatibility are verified.

These rules prevent the migration from becoming a permanent mixed-ownership subtree.

## React bridge

### Root registry

Add one neutral helper under `js/ui/` that caches a React root by container and renders a supplied React node:

```tsx
const roots = new WeakMap<HTMLElement, Root>();

export function renderReact(container: HTMLElement, node: ReactNode): void {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }

  root.render(node);
}
```

The real implementation should include the repository-required functional description comment and an explicit
`unmountReact` only if a migrated root can be removed during the page lifetime.

Do not create a generic component registry, plugin system, or base component. The root cache is the complete bridge.

### Keep existing render entry points

Converted surfaces retain their current exported function signature so callers do not change:

```tsx
export function renderAssumptions(app: ProfessionAppState): void {
  renderReact(requiredElement('perma-boons'), <AssumptionsPanel app={app} />);
}
```

`ProfessionApp.changed()` already invokes build-section renderers, and asynchronous result runners already invoke the
presentation renderer. Repeated `root.render()` calls update the matching React tree while preserving component state.
This means the first migration does not require an event bus, immutable store, context provider, or
`useSyncExternalStore` adapter.

Add a subscription API later only if state begins changing outside the existing render orchestration. If that happens,
`useSyncExternalStore` is the supported React bridge for an external store; it should expose a stable revision snapshot
rather than the mutable `ProfessionApp` object itself.

### State ownership

Keep persisted and simulation-relevant state in `ProfessionApp` and its build/result models:

- build selections;
- target assumptions;
- authored rotation;
- simulation status and results;
- saved UI preferences already stored by the application.

Use React-local state only for transient presentation state that does not affect the simulation:

- an open menu;
- a draft numeric input before commit;
- focus or hover state;
- an expanded local disclosure.

Do not copy the build into React state. That would create two sources of truth.

### Input behavior

React's `onChange` timing does not always match the native `change` handlers used today. Preserve current behavior:

- selects and checkboxes may commit immediately;
- numeric and text inputs that currently commit on native `change` should keep a local draft and commit on blur or
  explicit confirmation;
- validation and clamping remain at the existing application boundary;
- stable component types and keys must preserve focus, selection, and native select type-ahead;
- do not key a component tree by `buildRevision` or `resultRevision`.

### Imperative leaf widgets

Canvas charts, complex drag-and-drop, and other proven imperative widgets may remain imperative leaves inside a React
component. Mount them from a ref in an effect and clean them up when the effect reruns or unmounts. The widget owns only
the referenced leaf container.

Do not wrap an entire legacy panel in an effect merely to label it React. A wrapper is useful only for a bounded widget
that is intentionally not being rewritten yet.

## Source placement

- Generic React mounting support and genuinely game-neutral components belong in `js/ui/`.
- GW2 application components belong beside their current renderers under `js/games/gw2/app/`.
- Profession-specific presentation continues to enter through the existing profession UI hooks.
- Platform, engine, worker, persistence, and headless content modules must not import React.

This preserves the existing dependency direction documented in `MODULES.md`.

## Build and tooling changes

The foundation change should add only the tooling needed to compile and validate TSX:

- runtime dependencies: `react` and `react-dom`;
- development types: `@types/react` and `@types/react-dom`;
- Vite's official `@vitejs/plugin-react` for React Fast Refresh;
- JSX configuration using the automatic `react-jsx` runtime;
- `*.tsx` coverage in both build and typecheck configurations;
- React Hooks linting for TSX files.

Do not add a React framework or change the multi-page Vite build. The existing profession-page transform continues to
generate the document shell, and `createRoot` mounts into its empty containers. This is client rendering, not hydration.

## Testing strategy

Keep the current `node:test` runner and Playwright browser-test setup.

- Continue testing models, projections, validation, and mutations as pure TypeScript/JavaScript.
- Use Playwright for the smallest browser interaction proving that a user action updates the application state and that
  a subsequent render reflects it.
- Replace assertions over complete generated HTML with accessible role, label, value, and state assertions.
- Keep existing simulation and saved-preset tests unchanged unless their assertions inspect the migrated markup.
- Run the existing build, typecheck, lint, focused UI tests, and profession smoke tests for every migration.

Do not add jsdom, a React component-test framework, or another test runner unless Playwright becomes measurably too slow
for focused component feedback.

Avoid snapshots of whole components. They reproduce DOM shape instead of testing behavior and would repeat the current
HTML-string coupling.

## Migration plan

- [x] Phase 0: Foundation and assumptions pilot
- [x] Phase 1: Build editor panels
- [x] Phase 2: Results and analysis
- [x] Phase 3: Rotation palette and timeline
- [x] Phase 4: Cleanup

### Phase 0: Foundation and assumptions pilot

1. Add the React dependencies, Vite plugin, TSX configuration, and Hooks linting; reuse the existing Playwright setup.
2. Add the neutral React root helper.
3. Convert `renderAssumptions` to `AssumptionsPanel` while preserving its export and `app.changed()` behavior.
4. Delete the old assumptions HTML generator, subtree queries, and per-render event binding.
5. Verify every profession because profession-owned assumption controls compose into this surface.

Why this panel first: it has one stable root, substantial form behavior, profession extension data, validation, and no
canvas or drag-and-drop. It proves the architecture on real complexity without starting at the hardest surface.

**Exit criteria:** no imperative code mutates descendants of `#perma-boons`; focused behavior tests cover checkbox,
select, numeric draft/commit, validation, and one profession-provided control.

### Phase 1: Build editor panels

Convert in this order:

1. attributes;
2. traits;
3. skills;
4. gear.

Attributes establish read-only projection. Traits and skills exercise catalog-driven selections. Gear comes last in this
phase because it has the largest focus-preservation and cross-field validation surface.

Keep the existing build-editor section contract until every consumer is React-owned. Share only small leaf components
that appear at least twice, such as a labeled select or icon tile; do not build a speculative design system.

**Exit criteria:** build configuration no longer uses HTML-string injection or per-render listener binding, and focus is
preserved across the same changes that preserve it today.

### Phase 2: Results and analysis

1. Convert neutral summary, warning, table, and state-snapshot panels.
2. Convert the GW2 result tables and controls while retaining existing view-model transforms.
3. Keep chart canvases as imperative leaf widgets initially.
4. Replace direct asynchronous presentation calls only if they bypass the retained React render entry point.

The view models should remain framework-neutral. React consumes them; it does not replace them with resolver output.

**Exit criteria:** result renderers no longer clone or inject summary/table markup, and queued, stale, progress,
success, and error states still render for baseline and optional feature runners.

### Phase 3: Rotation palette and timeline

Migrate the palette before the timeline. The timeline is last because its current implementation includes keyed row
reconciliation, insertion cursors, drag-and-drop, floating editor anchors, proc overlays, and focus-sensitive behavior.

Before rewriting the timeline, retain and test its pure model functions. React should replace only the view and event
binding. Existing editor widgets may remain imperative leaves until their own migration is justified.

**Exit criteria:** rotation editing, undo/redo, drag-and-drop, insertion, hotkeys, overlays, editor anchors, and
deferred worker rendering preserve their existing behavioral contracts.

### Phase 4: Cleanup

1. Delete unused HTML-string helpers and markup-only tests.
2. Add a lint restriction preventing new `innerHTML` and `dangerouslySetInnerHTML` in React-owned directories.
3. Merge adjacent roots only where doing so removes real coordination code.
4. Update the architecture ownership documentation to describe the final React surfaces.

This migration does not stop at a partially React UI: all five phases above must meet their exit criteria.

## Local implementation boundaries

Each local surface checkpoint should include:

- the TSX component;
- the retained `renderX(app)` adapter;
- deletion of the old renderer and listener binding;
- focused behavior tests;
- Prettier formatting and existing repository checks.

Do not add runtime feature flags or keep parallel renderers. Git already provides rollback, and a subtree-sized change
is small enough to revert independently.

## Risks and mitigations

| Risk                                                   | Mitigation                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| React and imperative code both mutate one subtree      | Enforce the root ownership rules and delete the legacy renderer during cutover.                                                |
| Mutable `ProfessionApp` changes without a React render | Retain current render entry points; audit asynchronous writers when their surface migrates. Add a subscription only if needed. |
| Inputs simulate on every keystroke                     | Preserve native commit semantics with local drafts for text and numeric controls.                                              |
| Focus or select type-ahead resets                      | Keep stable component types/keys and do not key by revisions. Add focused focus-preservation tests.                            |
| Context cannot cross multiple roots                    | Pass `app` or narrow props through existing entry points. Merge only roots that develop real shared UI state.                  |
| Results show stale asynchronous data                   | Continue using `buildRevision`/`resultRevision` and existing stale-result rejection.                                           |
| Timeline behavior regresses                            | Migrate it last, retain pure models, and add focused behavioral tests for each interaction contract.                           |
| Bundle size grows on the landing page                  | Keep React imports in simulator UI chunks and verify Vite output before merging the foundation change.                         |
| Tests remain coupled to markup strings                 | Replace migrated tests with role/label/value and state-transition assertions.                                                  |

## Acceptance criteria

The migration architecture is successful when:

- React and imperative DOM have explicit, non-overlapping ownership;
- any individual panel can be migrated without converting its siblings;
- `ProfessionApp` remains the source of truth for build and result state;
- the engine and headless simulation paths contain no React dependency;
- current multi-page URLs and Vite-generated HTML continue to work;
- migrated panels contain no application-data `innerHTML` or manual listener rebinding;
- behavior, accessibility, focus, saved data, and simulation results remain unchanged;
- the application can intentionally retain static HTML and selected imperative leaf widgets.

## Explicitly rejected alternatives

### Big-bang conversion

Rejected because it combines framework adoption with simultaneous rewrites of forms, results, drag-and-drop, charts,
workers, and navigation. It increases regression risk without providing a necessary technical benefit.

### Permanent mixed ownership inside a subtree

Rejected because React cannot safely reconcile descendants that other code mutates. Coexistence happens between roots,
never inside one.

### Custom template or virtual-DOM abstraction

Rejected because it would create and maintain another rendering framework while leaving lifecycle and testing problems
for the repository to solve.

### New global state library

Rejected because `ProfessionApp` already owns the application state and render schedule. Add a store abstraction only
after a concrete React use case cannot be handled by the retained entry points.
