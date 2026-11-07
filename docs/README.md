# Code navigation

These documents help locate and understand the simulator's code. The implementation, types, and executable tests
determine current behavior. Repository working rules live in [AGENTS.md](../AGENTS.md).

Start with the [glossary](GLOSSARY.md) for terminology, [architecture overview](architecture/ARCHITECTURE.md) for the
execution path, or [module map](architecture/MODULES.md) to find an owner.

## Guides

| Task                              | Start here                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Run a simulation from Node        | [Programmatic simulation](architecture/PROGRAMMATIC-SIMULATION.md)                         |
| Find simulation entry points      | [Agent API navigation](architecture/AGENT-API-REFERENCE.md)                                |
| Follow time advancement           | [Event clock](architecture/SIMULATION-EVENT-CLOCK.md)                                      |
| Follow simultaneous effects       | [Event ordering](architecture/SKILL-EVENT-ORDERING.md)                                     |
| Investigate condition damage      | [Condition ticks](architecture/SHARED-CONDITION-TICKS.md)                                  |
| Trace the rotation cursor display | [State snapshots](architecture/ROTATION_STATE_SNAPSHOT.md)                                 |
| Find proc probability controls    | [Proc overrides](architecture/PROC-RATE-OVERRIDES.md)                                      |
| Author a balance preview          | [Patch preview](architecture/PATCH-PREVIEW.md)                                             |
| Work on a profession              | [Profession owner maps](professions/)                                                      |
| Import or investigate combat logs | [EVTC import](EVTC-ROTATION-RECONSTRUCTION.md), [EI alignment](LOG-IMPORT-EI-ALIGNMENT.md) |
| Review a community preset         | [Build submissions](BUILD-SUBMISSIONS.md)                                                  |

The [wiki](../wiki/Home.md) covers using the simulator. These guides focus on locating code and running development
workflows. Exact field lists, formulas, defaults, and callback ordering belong beside their implementations; follow the
linked owners when changing them.

## Historical evidence

[Clone performance](audits/CLONE-PERFORMANCE.md) and the [skill timing audit](SKILL-TIMING-AUDIT.md) record dated
investigations. Their measurements describe the recorded revisions, not current coverage or required behavior.
