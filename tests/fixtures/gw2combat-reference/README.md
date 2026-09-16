# gw2combat reference fixture

Frozen inputs from [Mk-Chan/gw2combat](https://github.com/Mk-Chan/gw2combat) used to check the TypeScript combat engine
against the C++ reference. See the [migration plan](../../../docs/architecture/GW2COMBAT-TYPESCRIPT-MIGRATION.md).

## Provenance

- Revision: `cc9a0d069350516b6daba7d80d4395f9004971d5` (2025-12-14)
- License: MIT, copyright (c) 2023 Manik Charan. The notice is kept in [LICENSE-gw2combat.txt](LICENSE-gw2combat.txt).
- Files are copied without modification from upstream `resources/` (license from `LICENSE.txt`). Prettier ignores them
  so their contents stay identical. SHA-256 of the upstream files:

| File                               | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `build-cwb-pt-pp-skill-ticks.json` | `300304e825bb4601e09a0e41c3773cc6b67ade65d7b21c751cf3ef2ca4afbb26` |
| `build-golem-fractal-relic.json`   | `7128e3e7793156f89bb759b87d3af7d9829fba60c8f3b8cda115d2e3fe497ffb` |
| `rotation-cwb-pt-pp.csv`           | `8bd7200d3682795e02f5810163b44c47c07ded596f45380750357f181e6569c6` |
| `encounter.json`                   | `9c7e646075b6dc803fe5d8ff09be7049282dace1087cf4be4478bfe6a5e17b78` |
| `LICENSE-gw2combat.txt`            | `48794341e104a15bed3a60685b89168ea2f828dd94baea92cd55f94b55c5c904` |

The hashes identify the upstream bytes. A Git checkout with `core.autocrlf` may change line endings in the working copy;
the parsed content is unaffected.

The encounter is upstream's default: a Willbender (pistol/torch main build with the skill-tick virtue definitions)
against a fractal-relic golem, terminating at 4,000,000 damage, 110 s, or the end of the rotation.

## Loading rules

[reference-encounter.js](reference-encounter.js) resolves the file-based encounter. Resolution also adds the content
flags upstream implies by skill name (`weapon_swap`, `skip_on_strike_hooks`, and the fire-field `whirl_finisher_skills`
mapping) through `withUpstreamSkillConventions`. The loader then applies two reviewed changes:

- **Errata.** Six `stacking_type` keys sit on effect applications in the player build. Upstream's parser ignores them,
  so the C++ engine never uses them. The TypeScript engine rejects unknown keys, and the loader removes exactly those
  paths. Every listed path must exist, so a fixture change fails loudly.
- **Deterministic variant.** It adds `critical_chance_multiplier` 1.0 to the player and raises the single random
  threshold (the lifesteal proc, below 66) to 101. The C++ build seeds its generator from `std::random_device`; this
  variant removes every random outcome so C++ and TypeScript audits can be compared event by event.

## Recorded results

[reference-results.json](reference-results.json) is written by
`node scripts/analysis/gw2combat-reference/compare-reference.mjs --write-results`. DPS is the sum of every audit damage
event divided by the final tick in seconds. The canonical value is the mean of repeated C++ runs, because each C++ run
draws different proc outcomes. Tests compare only total DPS with these values, within 1%.
