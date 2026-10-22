# Internal simulation clone performance

`cloneData` exists to reduce copying costs in packet emission and result construction. Its supported input contract is
deliberately narrower than `structuredClone`: primitive data, plain objects (including null prototypes), and dense
ordinary arrays, with enumerable data properties. Shared references and cycles within this graph are supported.
Functions, symbols, symbol keys, own `__proto__` keys, array extensions, accessors, and non-plain objects are outside
the contract.

Use native `structuredClone` on the entire graph when a caller needs other shapes. The helper's native delegation for
individual non-plain values does **not** make it a general serializer: references crossing plain objects and Maps can
lose identity, sparse-array holes become own properties, and an own `__proto__` changes the copied object's prototype.
These three counterexamples were reproduced during this audit.

## Reproduce

```powershell
npm run build:modules
New-Item -ItemType Directory -Force .scratch | Out-Null
node scripts/analysis/benchmark-clone.mjs --report .scratch/clone-benchmark.json
```

Optional `--filter` matches preset IDs case-insensitively; `--warmups` and `--rounds` control timing repetitions. Run
without other CPU-heavy work.

The script installs a process-local Node module load hook that makes the clone export switchable. It alternates the
actual custom function and native `structuredClone` through that export, leaving other native-clone callers untouched.
It changes no source or compiled files and adds no dispatch wrapper to timed clone calls.

Before timing, it runs every matching manifest preset in deterministic detailed and score modes. Every custom-clone
input is audited recursively for the supported contract, and every copy is compared with its native equivalent. Complete
live simulation results are then compared between implementations, including diagnostics. These are A/B measurements,
not saved snapshots or fixed numerical preset tests. Warnings are retained with their emitting preset and output mode in
the JSON report.

Simulation timing uses the first and last matching manifest preset per profession. Build loading, context construction,
auditing, and equality checks are outside the timer. Case order and implementation order alternate each round. Garbage
collection remains enabled and contributes to wall-clock time. Each aggregate sample sums the selected simulations for
that output mode; the reported aggregate is the median of those sums, not the sum of per-preset medians.

Separate clone-only measurements use deterministic reservoir samples of actual inputs from the audit: up to 256 packet
inputs and 32 arrays/report objects. Packet samples repeat the reservoir 100 times; report samples copy each retained
input once. Raw samples and per-preset simulation timings are included in the JSON report.

## Recorded measurement

Measured on October 22, 2026, from revision `54de73af1b556f6636aa1e6cf91ebe6d3ed0e85b`, using Node 24.14.1 (V8
13.6.233.17-node.44), Windows, and an Intel Core i7-13700K. The run used five timing warmups and fifteen measured
rounds.

The custom helper is worth retaining for its documented input contract. Across the 18 timed presets spanning all nine
professions, it reduced aggregate detailed simulation time by **11.85%** and score-only simulation time by **12.06%**.
Replacing it with native cloning would increase those times by 13.44% and 13.72%, respectively.

| Work per sample                           | Custom median | Native median | Native/custom ratio | Time reduction |
| ----------------------------------------- | ------------: | ------------: | ------------------: | -------------: |
| 18 detailed simulations                   |   2,254.91 ms |   2,558.04 ms |               1.13× |         11.85% |
| 18 score-only simulations                 |   1,477.73 ms |   1,680.44 ms |               1.14× |         12.06% |
| 25,600 packet copies (256 sampled inputs) |      12.02 ms |      55.98 ms |               4.66× |         78.53% |
| 32 sampled report/array copies            |      20.35 ms |      60.35 ms |               2.97× |         66.28% |

Every timed case favored the custom helper at the median: detailed simulation time reductions ranged from 10.39% to
16.02%, and score-only reductions from 7.80% to 15.52%. These are warm simulation measurements; loading and cold startup
were not measured.

All **151 rotation-backed manifest presets** produced deeply equal complete results in both detailed and score modes.
All **968,497 clone calls** in the custom audit runs satisfied the restricted input contract and matched their native
copies. No preset emitted warnings in either output mode. The audit found no Maps, sparse arrays, own `__proto__` keys,
or other unsupported shapes reaching this helper.

These results establish parity for the exercised current presets and input shapes, not equivalence for arbitrary
JavaScript data or every possible custom build. This is a Node benchmark; browser runtimes and other hardware may show
different gains. Re-run it when changing payload shapes or reconsidering the implementation. Keep the full input audit
outside production's per-packet hot path.
