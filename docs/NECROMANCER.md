# Necromancer implementation

Necromancer uses the profession-neutral scheduler and shared GW2 resolver.
The browser application is `necromancer.html`; it shares build controls,
rotation editing, results, event logs, persistence, and import/export with the
other declarative professions.

## Data

`js/professions/necromancer/data/necromancer-api-metadata.js` is generated from the
[official Guild Wars 2 API](https://api.guildwars2.com/v2/professions/Necromancer).
The July 25, 2026 snapshot contains 149 API skills, 108 traits, and all nine
specialization lines. The canonical catalog contains 166 entries after adding
API-omitted Death Shroud, Lich Form, Ritualist innervate, and simulator action
entries.

Refresh the snapshot with:

```powershell
npm run update:necromancer-data
```

The generator owns API metadata only. Simulator timing and behavior live in
the single authoritative `mechanics/skill-mechanics.js` table, with chains and
handlers supporting complex state. Missing-but-stable entries stay in
`data/necromancer-supplemental-skills.js`, so refreshes do not overwrite them.
Same-name API mode aliases resolve to one canonical selectable skill.

## Implemented mechanics

- Every catalog entry has executable mechanics; support-only actions that
  cannot change tracked damage or resources are intentionally excluded from
  the skill selector.
- Core Death Shroud, its five-skill bar, minimum entry resource, continuous
  life-force drain, manual exit, forced exit, and entry recharge.
- Reaper Shroud, four-percent-per-second drain, its complete bar, autoattack
  chain, flips, channels, control, chill, and Reaper trait modifiers.
- Scourge F1–F5, three-charge Manifest Sand Shade, shade duration/cap, current
  PvE life-force costs, Sand Savant, Desert Shroud, and Sandstorm Shroud.
- Harbinger Shroud, zero-resource entry, five-percent-per-second drain,
  two Blight per second, 25-stack cap, 25-second expiration, elixir Blight,
  empowered consumption thresholds, Cascading Corruption, Deathly Haste,
  Doom Approaches, and the complete always-visible transformed skill bar.
  Devouring Cut and Voracious Arc consume five Blight at threshold, double
  their 1.0/1.4 coefficients, and apply five Torment for five/seven seconds.
  Dark Barrage is six hits totaling 3.6, while Vital Draw is three hits
  totaling 1.2.
- Ritualist Shroud, Anguish/Wanderlust/Preservation spirits, spirit attacks,
  Painful Bond, Essence Blast scaling, innervates, Soul Twisting, Boon of
  Creation, Explosive Growth, Spirits' Strength, and Lingering Spirits.
- Lich Form entry, transformed skill bar, automatic/manual exit, Summon
  Madness, and exit life-force gain.
- Persistent core minions, command flips, minion attacks, consumption,
  creature-summon traits, and player/summon/effect ownership.
- Weapon swapping, equipped-set validation, all terrestrial Necromancer weapon
  families, active-set palette rows, ammo, recharge, flips, and autoattack
  chains.
- Signet of Undeath and Signet of Vampirism passives, Vampiric Mark, life
  siphons, Signets of Suffering, Plague Signet, corruption self-conditions,
  and duration-preserving condition transfers.
- Weaponmaster Training presentation and validation, including Harbinger torch
  skills. Lingering Curse exposes Devouring Darkness in place of Feast of
  Corruption instead of displaying both skills.
- Exact measured Quickness cast durations for the supplied core, Reaper,
  Scourge, and Harbinger skill set. Ghastly Claws and Soul Spiral resolve as
  individual packets; Soul Spiral packets persist after an early interrupt,
  Grasping Darkness commits at 120 ms under Quickness, and a manually
  interrupted Dark Barrage retains all six projectiles at 800 ms.
- Death, Reaper, and Harbinger shroud strikes use ascended-hammer weapon
  strength; Scourge shade strikes use unarmed strength. Ritualist Essence
  Blast uses the active equipped weapon, Anguish/Wanderlust use fixed minion
  strength, and Summon Spirits uses ascended-hammer strength.
- Static build traits and resolver-time strike, critical, condition,
  duration, recharge, resource, shroud, chill, fear, minion, spirit, and
  Blight modifiers. This includes Death's Carapace/Deadly Strength,
  Corrupter's Fervor, Dark Defense, Overflowing Thirst, Augury of Death,
  Desert Empowerment, and Bolstering Brew. Deterministic expected-value procs
  are used where the game uses random critical-hit chances.
- Soul Battery increases maximum Life Force, Eternal Life gains Life Force
  each interval outside shroud up to its threshold, and Death Perception adds
  critical chance and critical damage only while shroud is active. Soul Barbs
  is a non-stacking 15-second active state refreshed on shroud entry and exit.
- Dhuumfire burns for three seconds on core/Reaper/Ritualist, two seconds on
  Scourge with a one-second internal cooldown, and one second per Tainted
  Bolts projectile on Harbinger. Septic Corruption applies poison per Dark
  Barrage projectile; Dark Gunslinger converts 10% of Vitality to Expertise.
- Additive outgoing-damage grouping for Soul Barbs, Dread, Wicked/Septic
  Corruption, Cascading Corruption, and Lingering Spirits' Anguish bonus.
  Spiteful Talisman, Close to Death, Cold Shoulder, Soul Eater, and
  condition-specific damage bonuses remain multiplicative.
- Schema-version-3 build defaults, migration, sanitization, validation,
  canonical ID rotations, independent browser storage, and Life Force/Blight
  start controls. Life Force values are rounded for display, and Blight is
  stacked below Life Force rather than extending the palette horizontally.
- The Harbinger condition preset is loaded through
  `Builds/necromancer-manifest.json` and intentionally contains no rotation.
  Meltdown uses its wiki effect icon in proc results and modifier
  contributions.

Core, Reaper, Harbinger, and Ritualist shroud skills remain visible while the
matching shroud is inactive, but are disabled until entry. Weapon and slot
skills are disabled while those transformed bars are active. Scourge remains
the non-transform exception.

Relevant live mechanic references include
[Death Shroud](https://wiki.guildwars2.com/wiki/Death_Shroud),
[Reaper's Shroud](https://wiki.guildwars2.com/wiki/Reaper%27s_Shroud),
[Manifest Sand Shade](https://wiki.guildwars2.com/wiki/Manifest_Sand_Shade),
[Harbinger Shroud](https://wiki.guildwars2.com/wiki/Harbinger_Shroud),
[Blight](https://wiki.guildwars2.com/wiki/Blight), and
[Ritualist's Shroud](https://wiki.guildwars2.com/wiki/Ritualist%27s_Shroud).

## Modeling limits

The official API does not publish activation time for every skill and omits
some bundle skills and mode-specific facts. Measured/current PvE overrides are
used for the audited chains, channels, profession bars, persistent attacks,
and resource mechanics. Remaining skills use deterministic type-based cast
defaults and API coefficients.

This is a single-target damage simulator. Ally healing, revival, barrier,
boon removal, projectile interaction, pathing, incoming attacks, enemy
positioning, secondary targets, and competitive-mode splits are outside its
result model. Skills whose only effects are in those categories are excluded
instead of being shown as fake zero-damage implementations.
