# Guardian

Native shared-engine profession. Entry point `guardian.html`. `profession.ts` is the stable export and composes the
Core-first tuple from `catalog.ts`. A runtime contains Core plus at most one of Dragonhunter, Firebrand, Willbender, or
Luminary. Virtues, Firebrand tomes, Radiant Forge, and weapon state each own their cast validation, scheduler hooks,
skill handlers, and resolver reactions under `core/` or `specializations/<name>/`.

Trait definitions live in `core/traits/<line>/index.ts` and each elite's `traits/index.ts`. They own profiles,
modifiers, build contributions, and hooks; supporting functions stay beside their definitions. Shared symbol emission
lives in `core/traits/symbols.ts`. Mechanics preserve virtue activation, page accounting, equip rewards, and proc order.
Firebrand's `initial-state.ts` supplies default profiles without importing trait definitions into its state factory.

## Ordering and lifetime rules

- Firebrand checks tome availability before mantra availability. On player hits, Ashes reactions run before Firebrand's
  strike trigger, followed by tome Justice reactions.
- A Luminary cast accepted during an earlier Radiant Forge session cannot equip a weapon in a later session.

## Data

- Generated identity metadata lives in `data/`; consult its header for snapshot provenance. The API omits Firebrand tome
  pages, Luminary Radiant Forge weapons, and Dragonhunter virtue variants; `data/guardian-bundle-skills.ts` supplies
  their identity and presentation supplements.
- Refresh: `npm run update:profession-data -- --profession Guardian` (generated API metadata only; the bundle supplement
  is preserved). Simulation-affecting fields live in owner-local `skills/` fragments.

## Implemented systems

- **Core** — executable terrestrial weapon, slot, and profession skills with strike packets, damaging conditions,
  cooldowns, ammo, chains, flips, symbols, traps, channels, and persistent attacks; Justice/Resolve/Courage activation
  and recharge; Justice active and passive burning; Renewed Focus; weapon swapping and active-set validation.
- **Dragonhunter** — physical virtues, Spear of Justice / Hunter's Verdict.
- **Firebrand** — tome equip/stow, shared pages, page costs, regeneration, and Archivist of Whispers / Loremaster /
  Ashes of the Just.
- **Willbender** — physical skills and movement virtues.
- **Luminary** — Radiant Forge entry/exit, duration, radiant-weapon flips, weapon-dependent Glaring Burst, per-entry
  recharge reduction, and light-field / finisher / Sovereign of Light detonation behavior.
- **Spear (Janthir Wilds)** — the Illuminated mechanic (armed by spear 2/3/4, held open by Symbol of Luminance; consumed
  by the next supported enhanced spear skill: Helio Rush, Gleaming Disc, or Solar Storm; filler autoattacks do not
  consume it). Skill data lives in `core/skills/weapons/spear.ts`; persistent Illuminated behavior lives in
  `core/mechanics/spear.ts`.
- Explicit strike-modifier grouping (Force/Impact, Empowered/Radiant Armaments, Furious Focus, Retribution, Symbolic
  Avenger, Piercing Stance share one additive bucket; Fiery Wrath, Symbolic Exposure, gates, vulnerability, and relics
  stay separate multipliers). Permanent Protection/Resolution/Regeneration/Swiftness are on by default; permanent Aegis
  is also on by default and can be toggled off.

## Modeling boundaries

Single-target, outgoing-damage focused. Player health stays at 100%; target health remains modeled. Ally positioning,
incoming damage, revival, and other encounter-side support effects are outside the damage total. Some support-only casts
remain in the catalog as timing or trait-triggering actions. Cast timings are checked into owner-local skill fragments;
catalog assembly does not infer a duration from the skill's type.

Uncompressed ArcDPS EVTC logs can be inspected with
`node scripts/analysis/analyze-evtc.mjs <log.evtc> --game=gw2 --summary` after `npm run build`.
