# Guardian implementation

Guardian runs through the profession-neutral scheduler and shared GW2
resolver. Its browser application is available at `guardian.html` and uses the
same application shell, rotation UI, result views, persistence, and build I/O
as Mesmer.

## Data

`js/professions/guardian/data/guardian-catalog.js` is generated from the
official Guild Wars 2 API. It currently contains:

- 164 terrestrial or linked Guardian skills
- 108 traits
- 9 specialization lines, including Luminary

The API profession feed does not expose Firebrand tome pages, Luminary
Radiant Forge weapons, or two current Dragonhunter virtue variants.
`guardian-bundle-skills.js` supplies those 26 stable-ID entries, bringing the
canonical simulator catalog to 190 skills.

Refresh it with `npm run update:guardian-data`. Generated API metadata is kept
separate from simulator-owned timing and effect definitions in
`js/professions/guardian/mechanics.js`; the bundle supplement is intentionally
preserved by that refresh.

## Implemented mechanics

- A complete executable catalog: every terrestrial weapon, healing, utility,
  elite, and profession skill has scheduler mechanics
- API-derived strike packets, damaging conditions, cooldowns, ammo, chains,
  and flips, with calibrated overrides for multi-hit, channel, symbol, trap,
  and persistent-damage skills
- Core Justice, Resolve, and Courage activation and recharge
- Justice active burning and five-hit passive burning
- Permeating Wrath's three-hit Justice interval
- Renewed Focus virtue recharge
- Weapon swapping and active-set skill validation
- Guardian autoattack chains, sequence flips, ammo, channels, symbols, traps,
  spirit weapons, and persistent attacks
- Dragonhunter physical virtues and Spear of Justice/Hunter's Verdict
- Firebrand tome equip/stow, shared pages, page costs, regeneration,
  Archivist of Whispers, Loremaster, and Ashes of the Just
- Willbender physical skills and movement virtues
- Luminary Radiant Forge entry/exit, duration, radiant-weapon flips, and
  weapon-dependent Glaring Burst
- Static and resolver-time Guardian damage, recharge, condition, signet, and
  attribute trait rules
- Shared rotation-timeline cast steps, including cast timestamps and invalid
  cooldown attempts
- A damage-focused skill selector that omits support-only skills which cannot
  affect the tracked damage metrics
- Schema-version-3 Guardian build migration and validation

The official API does not provide activation times and omits some mode-specific
bundle facts. Skills without measured timing overrides use consistent
type-based activation defaults. The simulator models deterministic PvE combat
output; ally positioning, incoming damage, revival, and other encounter-side
support effects remain outside its damage model.
