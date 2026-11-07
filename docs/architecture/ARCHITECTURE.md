# Simulator architecture

This overview follows the main execution path. Use the [module map](MODULES.md) for locations and the
[glossary](../GLOSSARY.md) for terminology. Read the linked implementation and tests for current behavior.

## Layers

| Layer          | Role                                                              | Entry point                                                      |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Kernel         | Game-neutral clocks, queues, randomness, and observation          | [js/kernel/](../../js/kernel/)                                   |
| Platform       | Shared GW2 execution, combat, equipment, and results              | [platform/](../../js/games/gw2/platform/)                        |
| Professions    | Core and elite content, mechanics, and presentation contributions | [profession registry](../../js/games/gw2/profession-registry.ts) |
| Build context  | Headless build-to-attributes and configuration binding            | [build-context/](../../js/games/gw2/build-context/)              |
| Application    | GW2 editing, persistence, analysis, and browser composition       | [profession-app.ts](../../js/games/gw2/app/profession-app.ts)    |
| Browser and UI | Game loading, workers, shared shell, and neutral views            | [browser/](../../js/browser/), [ui/](../../js/ui/)               |
| Integrations   | Logs, chat codes, keybindings, assets, and patch previews         | [integrations/](../../js/games/gw2/integrations/)                |

Import restrictions live in [eslint.config.js](../../eslint.config.js). [Architecture tests](../../tests/architecture/)
check selected ownership and dependency properties. The tables here describe responsibilities rather than duplicate
those restrictions.

## A simulation run

1. A profession's `build/context.ts` binds its build codec and attribute calculator to the shared
   [build context](../../js/games/gw2/build-context/). Direct callers can instead supply explicit
   [run configuration](../../js/games/gw2/platform/simulation/config.ts).
2. [simulateGw2](../../js/games/gw2/platform/simulation/simulate.ts) selects the runtime. The
   [native profession compiler](../../js/games/gw2/platform/profession-definition/profession.ts) composes Core and the
   selected elite.
3. [runtime.ts](../../js/games/gw2/platform/simulation/runtime.ts) assembles services. The
   [coordinator](../../js/games/gw2/platform/simulation/coordinator.ts) advances one clock and queue across commands,
   tasks, and combat effects.
4. [Cast execution](../../js/games/gw2/platform/execution/cast-execution.ts) handles activation.
   [Effect delivery](../../js/games/gw2/platform/resolver/effect-delivery.ts) admits and resolves packets through combat
   services and profession contributions.
5. [Result projection](../../js/games/gw2/platform/results/project-runtime.ts) reads the settled run. The application
   builds result views and cursor previews from those observations.

[Programmatic simulation](PROGRAMMATIC-SIMULATION.md) provides runnable examples.
[Event clock](SIMULATION-EVENT-CLOCK.md) and [event ordering](SKILL-EVENT-ORDERING.md) locate scheduling code;
[state snapshots](ROTATION_STATE_SNAPSHOT.md) follows the editor's observations.

## Profession composition

Each profession's `catalog.ts` collects Core and elite modules; `profession.ts` binds them to build and presentation
services. Each module's `module.ts` registers its data, state projector, rules, and hooks.

Skills and traits keep their declarations with their owners. Named mechanics handle state that spans activations. Shared
platform services receive these contributions through
[profession contracts](../../js/games/gw2/platform/profession-definition/) and
[presentation contracts](../../js/games/gw2/platform/profession-presentation/).

The [profession guides](../professions/) link to those owners. They do not maintain a second inventory of tuning values
or trait execution order.

## Builds, previews, and encounters

The workspace, workers, and headless tools use build contexts to calculate inputs. The
[attribute preview](../../js/games/gw2/app/build/attribute-effects.ts) has separate hypothetical controls. Simulation
scope, including full player health, is recorded in [AGENTS.md](../../AGENTS.md#simulation-scope).

[Patch selection](../../js/games/gw2/integrations/patches/selection.ts) connects live or preview content to calculation.
[Boss scenario compilation](../../js/games/gw2/app/boss-scenarios/simulation.ts) adds encounter inputs;
[encounter state](../../js/games/gw2/platform/combat/state/encounter.ts) executes them on the same runtime.

## Adding another profession

Start with the [registry](../../js/games/gw2/profession-registry.ts), an existing family's `catalog.ts`,
`profession.ts`, and `build/context.ts`, and the
[native module types](../../js/games/gw2/platform/profession-definition/module-types.ts). Browser registration also
needs an `app/app-definition.ts` adapter.

Use the owning profession's focused tests and [repository validation policy](../../AGENTS.md#testing-policy) when
changing composition. Keep this overview focused on the execution path and update navigation links when owners move.
