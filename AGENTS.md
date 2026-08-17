# Repository Instructions

- Use Prettier for every Prettier-supported file that you create or modify.
- Before completing a task, run `npx prettier --write <touched-files>` on all supported files touched by that task, including documentation and configuration files.
- Format only files touched by the current task; do not reformat unrelated files.
- If Prettier cannot format a touched file type, leave that file unchanged by Prettier and state that exception in the final response.
- When adding or editing functionality, include a short functional description comment explaining the intended logic — what the code is meant to do and why, not just what it literally does.

## Testing Policy

- Add focused tests for engine contracts such as scheduling, cooldowns, resources, state transitions, event ordering, observation windows, loading, migration, and validation.
- Add behavioral tests for trait logic and small, generic tests for modifiers, formulas, coefficients, packet timing, and other calculations. Each test should use the smallest input or rotation that demonstrates the behavior.
- Treat trait coverage manifests as implementation-scope inventories, not proof of test coverage. A trait marked implemented still needs a focused behavioral test when its behavior is added or changed.
- Saved-preset tests may verify that manifests, builds, and rotations load and simulate successfully. Numerical preset regressions should compare only total DPS to the manifest value with a maximum relative error of 1%.
- Do not add tests that reproduce EVTC or report shape: exact saved-rotation length or ordering, fixed rotation indices, aggregate casts or hits per skill, per-skill aggregate damage, exact benchmark DPS, or snapshots of an entire simulation result.
- Exact assertions are appropriate when the value itself is the focused engine, trait, or formula contract. Do not derive broad expectations from a full saved rotation when a minimal scenario can cover the same behavior.
- Do not silence preset warnings to make a smoke test pass. Identify the emitting preset and either fix the underlying issue or explicitly document and scope an intentional warning.
