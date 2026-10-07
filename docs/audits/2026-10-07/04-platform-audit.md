# GW2 platform audit

Source baseline: `061147ad40b62f032fb2f0da41f2dd4d9807eee3` (2026-10-07). Documentation-only review; source and baseline tests are unchanged.

## Status and scope

Initial review in progress. Owns platform domains and their contracts with profession implementations and the kernel. Runtime correctness overlaps are coordinated with the kernel auditor. This report will distinguish demonstrated defects from architecture improvements and unconfirmed hypotheses.

The baseline platform inventory is 219 TypeScript files / 32,229 lines across 15 domains (counts to be verified before finalization): builds, combat, combat-calculation, combos, effects, equipment, events, execution, profession-definition, profession-presentation, resolver, results, simulation, skill-damage, and skills. Inventory is not a claim of exhaustive semantic review.

## Methods and evidence

- Read the shared audit brief and platform README; review architecture/module ownership documents and the native profession contracts before proposing extensions.
- Baseline `npm run check` was reported passing by the coordinator, including 4,876 Node tests; this auditor does not repeat or rebuild it.
- Read-only source tracing, targeted searches and focused diagnostics against existing compiled `dist`; diagnostic files remain under `.scratch/audit/platform/`.

## Confirmed correctness findings

Pending investigation.

## Architectural recommendations

Pending investigation. Any proposed shared extension must identify actual profession consumers, current workarounds, smallest compatible change, and targeted validation.

## Open hypotheses and coverage gaps

In progress. No claim of exhaustive bug absence.
