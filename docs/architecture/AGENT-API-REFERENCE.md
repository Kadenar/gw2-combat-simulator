# Simulator API navigation

Start with [AGENTS.md](../../AGENTS.md) for repository rules and [code navigation](../README.md) for the document index.
The APIs are internal to this repository revision; read their TypeScript declarations when writing a caller.

| Need                          | Start here                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run a direct scenario         | [Runnable example](PROGRAMMATIC-SIMULATION.md#run-a-script), [simulate.ts](../../js/games/gw2/platform/simulation/simulate.ts)                                                                   |
| Load a saved build            | [Saved-build example](PROGRAMMATIC-SIMULATION.md#running-a-saved-build), [build-context/types.ts](../../js/games/gw2/build-context/types.ts)                                                     |
| Inspect run inputs and output | [config.ts](../../js/games/gw2/platform/simulation/config.ts), [options.ts](../../js/games/gw2/platform/simulation/options.ts), [results/types.ts](../../js/games/gw2/platform/results/types.ts) |
| Find a change owner           | [Module map](MODULES.md)                                                                                                                                                                         |
| Trace scheduling              | [Clock](SIMULATION-EVENT-CLOCK.md), [event ordering](SKILL-EVENT-ORDERING.md)                                                                                                                    |
| Inspect cursor state          | [State snapshots](ROTATION_STATE_SNAPSHOT.md)                                                                                                                                                    |

Run `npm run build:modules` before using Node aliases after a source change. The alias mappings live in
[package.json](../../package.json). Inspect each simulation's warnings and follow the repository testing policy for
validation.
