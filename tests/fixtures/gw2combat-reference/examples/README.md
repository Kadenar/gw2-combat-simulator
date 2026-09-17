# Additional upstream examples

Ten additional build/rotation pairs from the same pinned
[gw2combat revision](https://github.com/Mk-Chan/gw2combat/tree/cc9a0d069350516b6daba7d80d4395f9004971d5/resources) as
the original Willbender fixture. The upstream MIT notice is in [LICENSE-gw2combat.txt](../LICENSE-gw2combat.txt).

| IDs                                           | Coverage                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `cwb-pt-pp`, `cwb-pt-sp`, `cwb-sw-tor-sc-tor` | Legacy Willbender actions, weapon variants, and a short rotation                        |
| `dh-bgh`, `dh-hl`, `dh-virtues`               | Dragonhunter variants, triggered child skills, modifiers and conversions                |
| `gs-slb`, `lb-axe-axe-slb`, `lb-sw-axe-slb`   | Soulbeast weapon variants and temporary effects                                         |
| `qfb`                                         | Quickness Firebrand, bundles, conditional skills, ammo, counters and an external recipe |

[manifest.json](manifest.json) selects the player build, rotation and plain golem build for each example. The loader
reuses the original upstream encounter's teams, termination rules, condition-clock offset, and damage modes. These are
historical engine fixtures, not current-game benchmark builds. The short sword/torch Willbender rotation is retained as
authored; it is not extended into a full benchmark.

## Provenance and compatibility

The files were imported from Git objects at `cc9a0d069350516b6daba7d80d4395f9004971d5`. JSON is formatted with Prettier;
its parsed content is unchanged. CSV files are copied unchanged. The manifest records original SHA-256 hashes,
parsed-JSON hashes and LF-normalized CSV hashes so tests can verify content despite formatting or checkout line-ending
changes.

[example-encounters.js](../example-encounters.js) resolves builds, rotations and `recipes/mantra-of-flame.json` from
these frozen copies. It applies upstream's existing skill-name conventions and only the exact compatibility changes
listed in the manifest, checking each original value before changing it:

- Effect-application `stacking_type`, skill `is_child_skill` and `TODO`, and the old counter fields `reset_at_value` and
  `increment_conditions` are ignored by the pinned C++ deserializers and removed for strict TypeScript validation.
- The Virtues Dragonhunter's uppercase `GREATSWORD` is explicitly mapped to `invalid`, matching upstream's enum
  fallback. It is not corrected to `greatsword`. Its obsolete counter fields remain ineffective, as in C++.

The condition Firebrand build (`build-cfb.json`) is excluded. With its standard rotation, both the pinned C++ engine and
TypeScript fail when Flame Rush is scheduled while Mantra of Flame is on cooldown. Its alternate synced rotation also
fails in TypeScript. The manifest records this limitation; no rotation or cooldown edits hide it.

## Validation and regeneration

[results.json](results.json) records independent C++ DPS samples at its native 1 ms step and a separate TypeScript
baseline at 40 ms. Tests compare only total DPS, with a maximum relative error of 1%. They run the 1 ms examples in
score mode and the 40 ms examples in detailed mode. The original Willbender tests remain in place.

The **40 ms values preserve existing port behavior**. They do not establish C++ parity or correct game timing;
coarse-step expiration, trigger ordering and auditing still require separate focused contracts. Intentional timing
changes should be reviewed before updating these baselines. Do not regenerate them merely to hide a regression.

After building the pinned C++ reference and TypeScript modules, regenerate with:

```sh
node scripts/analysis/gw2combat-reference/compare-examples.mjs --runs=10 --write-results
```

The script reads the actual completion tick from the C++ log, including rotations that finish without a final audit
event. It refuses to write results if any TypeScript 1 ms result differs from the measured C++ mean by more than 1%.
Generated inputs, logs and audits stay under `.scratch/gw2combat-reference/examples/`.

Profile an individual example without changing its inputs:

```sh
node scripts/analysis/profile-combat-engine.mjs --example qfb --step-ms 40 --workload
```
