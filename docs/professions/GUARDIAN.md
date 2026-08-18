# Guardian

Native shared-engine profession. Entry point `guardian.html`. `definition.ts`
is the stable export; `family.ts` composes the Core-first module tuple with one
of Dragonhunter, Firebrand, Willbender, or Luminary. Virtues, Firebrand tomes,
Radiant Forge, and weapon state each own their cast validation, scheduler
hooks, skill handlers, and resolver reactions under `core/` or
`specializations/<name>/`.

## Data

- API identity snapshot: 2026-07-25 (official GW2 API): 164 terrestrial/linked
  skills, 108 traits, 9 specialization lines. The API omits Firebrand tome
  pages, Luminary Radiant Forge weapons, and two Dragonhunter virtue variants;
  `guardian-bundle-skills.js` supplies stable-ID supplements, bringing the
  catalog to 191 skills.
- Refresh: `npm run update:guardian-data` (generated API metadata only; the
  bundle supplement is preserved). Simulation-affecting fields live in
  owner-local `skills.ts` fragments.

## Implemented systems

- **Core** — complete executable catalog (every terrestrial weapon, heal,
  utility, elite, profession skill) with strike packets, damaging conditions,
  cooldowns, ammo, chains, flips, symbols, traps, channels, and persistent
  attacks; Justice/Resolve/Courage activation and recharge; Justice active and
  passive burning; Renewed Focus; weapon swapping and active-set validation.
- **Dragonhunter** — physical virtues, Spear of Justice / Hunter's Verdict.
- **Firebrand** — tome equip/stow, shared pages, page costs, regeneration, and
  Archivist of Whispers / Loremaster / Ashes of the Just.
- **Willbender** — physical skills and movement virtues.
- **Luminary** — Radiant Forge entry/exit, duration, radiant-weapon flips,
  weapon-dependent Glaring Burst, per-entry recharge reduction, and light-field
  / finisher / Sovereign of Light detonation behavior.
- **Spear (Janthir Wilds)** — the Illuminated mechanic (armed by spear 2/3/4,
  held open by Symbol of Luminance; consumed by the next spear attack to
  enhance its strike packet). Modeled in `core/spear.ts`.
- Explicit strike-modifier grouping (Force/Impact, Empowered/Radiant Armaments,
  Furious Focus, Retribution, Symbolic Avenger, Piercing Stance share one
  additive bucket; Fiery Wrath, Symbolic Exposure, gates, vulnerability, and
  relics stay separate multipliers). Permanent Protection/Resolution/
  Regeneration/Swiftness are on by default; Aegis is an off-by-default toggle.
- All 108 traits have a validated coverage disposition.

## Modeling boundaries

Single-target, outgoing-damage focused. Ally positioning, incoming damage,
revival, and other encounter-side support effects are out of model; support-only
skills are omitted from the damage selector. Skills without measured timing use
type-based activation defaults.

Uncompressed ArcDPS EVTC logs can be inspected with
`node scripts/analysis/analyze-evtc.mjs <log.evtc> --summary` (add
`--window=<seconds>` to compare a rotation prefix).
