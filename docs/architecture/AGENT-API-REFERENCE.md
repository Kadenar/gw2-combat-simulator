# Simulator API reference for agents

Start with [AGENTS.md](../../AGENTS.md) for repository and testing rules. TypeScript source is authoritative; these are
internal APIs tied to the repository revision.

## Run a simulation

Use the runnable examples for [direct inputs](./PROGRAMMATIC-SIMULATION.md#run-a-script) or
[saved builds](./PROGRAMMATIC-SIMULATION.md#running-a-saved-build). Run `npm run build:modules` after source changes. Node resolves `#gw2/`, `#kernel/`, and `#ui/` imports to compiled `dist/js/` modules. Keep scripts inside the
repository.

Key pitfalls:

- Supply base attributes through `baseAttributeInputs`. The runtime adds profession and combat bonuses.
- Saved builds and run configs are different contracts; use the build-context loader for saved builds.
- Preserve skill ID types. Prefer canonical cast commands for persistent scripts.
- Inspect every run's warnings. Score output uses the same mechanics but omits detailed histories.
- Live timestamps use seconds; authored `*Ms`, result step times, and cooldown projections use milliseconds.
- Planning snapshots are detached observations, not resumable checkpoints. Player health stays at 100% in simulation.

## Find an owner

| Need                                           | Reference                                                   |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Run options, results, observations, randomness | [Programmatic simulation](./PROGRAMMATIC-SIMULATION.md)     |
| Layers and runtime composition                 | [Architecture](./ARCHITECTURE.md)                           |
| File placement and profession authoring        | [Module ownership](./MODULES.md)                            |
| Engine services and capability boundaries      | [Platform ownership](../../js/games/gw2/platform/README.md) |
| Exact time and expiry semantics                | [Event clock](./SIMULATION-EVENT-CLOCK.md)                  |
| Same-time dependencies and priority            | [Event ordering](./SKILL-EVENT-ORDERING.md)                 |

Build modules before focused Node tests. Use the repository's typecheck, formatting, and browser-test rules from
[AGENTS.md](../../AGENTS.md); do not edit generated `dist/` output.
