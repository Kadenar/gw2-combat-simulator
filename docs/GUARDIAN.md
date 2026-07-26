# Guardian implementation

Guardian runs through the profession-neutral scheduler and shared GW2
resolver. Its browser application is available at `guardian.html` and uses the
same application shell, rotation UI, result views, persistence, and build I/O
as Mesmer.

## Data

`js/professions/guardian/data/guardian-api-metadata.js` is generated from the
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
`js/professions/guardian/mechanics/`; the bundle supplement is intentionally
preserved by that refresh.

## Architecture

`definition.js` is the Guardian composition root. Gameplay behavior is grouped
by feature under `js/professions/guardian/mechanics/`: virtues, Firebrand
tomes, Radiant Forge, and weapon state each own their cast validation,
scheduler hooks, named skill handlers, and resolver reactions. `contract.js`
combines those feature hooks in deterministic order.

Ordinary timing, cooldowns, effects, and damage resolution continue to use the
shared platform scheduler and GW2 resolver. Guardian does not maintain a
parallel profession-specific engine.

Like Mesmer and Necromancer, Guardian keeps every simulation-affecting skill
field in `mechanics/skill-mechanics.js`. Generated API metadata does not
provide runtime coefficients, conditions, hit counts, intervals, or cast time.

## Implemented mechanics

- A complete executable catalog: every terrestrial weapon, healing, utility,
  elite, and profession skill has scheduler mechanics
- Explicit strike packets, damaging conditions, cooldowns, ammo, chains, and
  flips, including multi-hit, channel, symbol, trap, and persistent attacks
- Core Justice, Resolve, and Courage activation and recharge
- Justice active burning and five-hit passive burning
- Permeating Wrath's three-hit Justice interval
- Renewed Focus virtue recharge
- Weapon swapping and active-set skill validation
- Persistent W1/W2 palette rows with inactive-set cooldown visibility
- Guardian autoattack chains, sequence flips, ammo, channels, symbols, traps,
  spirit weapons, and persistent attacks
- Dragonhunter physical virtues and Spear of Justice/Hunter's Verdict
- Firebrand tome equip/stow, shared pages, page costs, regeneration,
  Archivist of Whispers, Loremaster, and Ashes of the Just
- Persistent tome and Radiant Forge palette rows that retain cooldown displays
  while inactive and lock weapon skills while either mode is active
- Willbender physical skills and movement virtues
- Luminary Radiant Forge entry/exit, duration, radiant-weapon flips, and
  weapon-dependent Glaring Burst
- Spear (Janthir Wilds) with the Illuminated mechanic (see below)
- Static and resolver-time Guardian damage, recharge, condition, signet, and
  attribute trait rules
- Shared rotation-timeline cast steps, including cast timestamps and automatic
  advancement to cooldown expiry
- A damage-focused skill selector that omits support-only skills which cannot
  affect the tracked damage metrics
- Schema-version-3 Guardian build migration and validation

The official API does not provide activation times and omits some mode-specific
bundle facts. Skills without measured timing overrides use consistent
type-based activation defaults. The simulator models deterministic PvE combat
output; ally positioning, incoming damage, revival, and other encounter-side
support effects remain outside its damage model.

## Spear Illuminated

Guardian spear is modeled in `mechanics/spear.js` (a scheduler `afterCast`
hook, registered in `contract.js`) plus its authoritative entries in
`mechanics/skill-mechanics.js`. Skill slots follow the API metadata:

| Slot | Skill | Illuminated role |
| --- | --- | --- |
| Spear 1 | Daybreaking Slash | filler; never consumes the buff |
| Spear 2 | Helio Rush | **arms** Illuminated for the next spear attack |
| Spear 3 | Gleaming Disc | arms Illuminated |
| Spear 4 | Solar Storm | arms Illuminated |
| Spear 5 | Symbol of Luminance | opens a 5s window that keeps **all** spear skills illuminated |

An illuminated cast of an enhanced-damage spear skill re-emits its strike ticks
scaled by a per-skill multiplier, taken from the reference build's
base→illuminated coefficients:

- Helio Rush `1.8 → 2.7` (×1.50)
- Gleaming Disc `1.5 → 1.875` (×1.25)
- Solar Storm `3.6 → 4.5` (extra 4th/5th shard ≈ ×1.25)

Each illuminated cast records an `Illuminated` proc (icon from the wiki) for the
rotation timeline; Symbol of Luminance records its own empowerment proc.

### Key differences from the reference build JSON

The attached `build-dh-virtues-dh-relic-sp.json` reference models the same
guardian effects declaratively; the simulator reproduces them differently:

- **Illuminated is automatic, not hand-picked.** The reference JSON has
  separate `… Illuminated` skills (`Solar Storm Illuminated`, `Helio Rush
  Illuminated`, `Gleaming Disc Illuminated`) that the author swaps in manually
  and links with `skills_to_put_on_cooldown`. The simulator tracks the
  Illuminated state itself (armed by spear 2/3/4, held open by spear 5) and
  applies the enhanced coefficients as an on-cast damage bonus — the rotation
  only lists the base skill.
- **Filler autoattacks never waste the buff.** Only the enhanced-damage spear
  skills consume Illuminated, so a Daybreaking Slash between an armer and its
  payoff does not eat the buff. In-game any spear attack consumes it; this is a
  deliberate DPS-sim simplification and is documented here.
- **Symbol of Luminance is a time window.** "While the symbol is active all
  spear skills are illuminated" is modeled as a 5s window
  (`spearLuminanceUntil`) rather than a positional in-symbol check; while the
  window is open the armed buff is not consumed.
- **Effects/buffs are code, not declarative `unique_effect` blocks.** The
  reference JSON expresses relics, sigils, food, and traits (Symbolic Avenger,
  Inspiring Virtue, DH Relic, Fiery Wrath, etc.) as `unique_effect`
  `attribute_modifiers`/`attribute_conversions`. The simulator implements the
  equivalents in `attribute-rules.js` (trait multipliers, conversions) and the
  shared platform (`relic-rules.js`, sigils, food), driven by the selected
  build rather than a per-build effect list.
- **Spear is one weapon set, not "aquatic".** The reference JSON parks the
  spear skills under an `aquatic` weapon slot; the simulator exposes Spear as a
  real two-handed land weapon in the guardian catalog.

Relic of the Dragonhunter procs now render its GW2 render-API icon in the
rotation proc row (`RELIC_DATA.Dragonhunter.icon` in
`js/platform/gw2/gear-data.js`).
