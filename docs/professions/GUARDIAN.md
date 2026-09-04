# Guardian

Native shared-engine profession. Entry point `guardian.html`. `definition.ts` is the stable export and composes the
Core-first tuple from `modules.ts`. A runtime contains Core plus at most one of Dragonhunter, Firebrand, Willbender, or
Luminary. Virtues, Firebrand tomes,
Radiant Forge, and weapon state each own their cast validation, scheduler hooks, skill handlers, and resolver reactions
under `core/` or `specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API): 142 skills, 108 traits, and 9 specialization lines. The API
  omits Firebrand tome pages, Luminary Radiant Forge weapons, and Dragonhunter virtue variants;
  `data/guardian-bundle-skills.ts` supplies 29 stable-ID identity and presentation supplements.
- Refresh: `npm run update:profession-data -- --profession Guardian` (generated API metadata only; the bundle
  supplement is preserved).
  Simulation-affecting fields live in owner-local `skills/` fragments.

## Implemented systems

- **Core** — complete executable catalog (every terrestrial weapon, heal, utility, elite, profession skill) with strike
  packets, damaging conditions, cooldowns, ammo, chains, flips, symbols, traps, channels, and persistent attacks;
  Justice/Resolve/Courage activation and recharge; Justice active and passive burning; Renewed Focus; weapon swapping
  and active-set validation.
- **Dragonhunter** — physical virtues, Spear of Justice / Hunter's Verdict.
- **Firebrand** — tome equip/stow, shared pages, page costs, regeneration, and Archivist of Whispers / Loremaster /
  Ashes of the Just.
- **Willbender** — physical skills and movement virtues.
- **Luminary** — Radiant Forge entry/exit, duration, radiant-weapon flips, weapon-dependent Glaring Burst, per-entry
  recharge reduction, and light-field / finisher / Sovereign of Light detonation behavior.
- **Spear (Janthir Wilds)** — the Illuminated mechanic (armed by spear 2/3/4, held open by Symbol of Luminance; consumed
  by the next spear attack to enhance its strike packet). Skill data lives in `core/skills/weapons/spear.ts`; persistent
  Illuminated behavior lives in `core/mechanics/spear-illumination.ts`.
- Explicit strike-modifier grouping (Force/Impact, Empowered/Radiant Armaments, Furious Focus, Retribution, Symbolic
  Avenger, Piercing Stance share one additive bucket; Fiery Wrath, Symbolic Exposure, gates, vulnerability, and relics
  stay separate multipliers). Permanent Protection/Resolution/ Regeneration/Swiftness are on by default; Aegis is an
  off-by-default toggle.

## Modeling boundaries

Single-target, outgoing-damage focused. Ally positioning, incoming damage, revival, and other encounter-side support
effects are out of model; support-only skills are omitted from the damage selector. Skills without measured timing use
type-based activation defaults.

Uncompressed ArcDPS EVTC logs can be inspected with
`node scripts/analysis/analyze-evtc.mjs <log.evtc> --game=gw2 --summary` after `npm run build`.
