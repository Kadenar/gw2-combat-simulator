# Proc rate override navigation

Proc rate overrides let a build supply a probability for a supported trait proc. The implementation separates that
probability from the proc's eligibility, cooldown, and effects.

## Locate a change

| Concern                                          | Owner                                                                                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stored rates, validation, and available profiles | [builds/proc-rates.ts](../../js/games/gw2/platform/builds/proc-rates.ts)                                                                                              |
| Balance-profile declarations                     | [skills/types.ts](../../js/games/gw2/platform/skills/types.ts), [balance-profiles.ts](../../js/games/gw2/platform/skills/balance-profiles.ts)                         |
| Run configuration                                | [simulation/config.ts](../../js/games/gw2/platform/simulation/config.ts), [build-context/simulation-config.ts](../../js/games/gw2/build-context/simulation-config.ts) |
| Proc claims and intervals                        | [combat/procs/registry.ts](../../js/games/gw2/platform/combat/procs/registry.ts)                                                                                      |
| Trait selection and reactions                    | Owning profession's `traits/` declarations                                                                                                                            |
| Activation reporting                             | [results/](../../js/games/gw2/platform/results/), search for `procCount`                                                                                              |

Search the owning trait for `procRate` and `procChanceFromContext` to follow an existing declaration through its roll.
Search [app/build/](../../js/games/gw2/app/build/) for `procRateOverrides` to find the editor controls. The active
catalog supplies the supported proc inventory.

[Proc-rate override tests](../../tests/games/gw2/platform/builds/proc-rate-overrides.test.js) cover the shared behavior.
Trait-specific eligibility belongs in the [profession tests](../../tests/games/gw2/professions/).
