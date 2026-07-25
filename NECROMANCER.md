# Necromancer implementation

Necromancer uses the profession-neutral scheduler and shared GW2 resolver.
The browser application is `necromancer.html`; it shares build controls,
rotation editing, results, event logs, persistence, and import/export with the
other declarative professions.

## Data

`js/professions/necromancer/data/necromancer-catalog.js` is generated from the
[official Guild Wars 2 API](https://api.guildwars2.com/v2/professions/Necromancer).
The July 25, 2026 snapshot contains 149 API skills, 108 traits, and all nine
specialization lines. The canonical catalog contains 166 entries after adding
API-omitted Death Shroud, Lich Form, Ritualist innervate, and simulator action
entries.

Refresh the snapshot with:

```powershell
npm run update:necromancer-data
```

The generator owns API metadata only. Simulator timing and behavior stay under
`mechanics/`, using the common defaults, overrides, final-mechanics, chains,
and handlers boundaries. Missing-but-stable entries stay in
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
  empowered consumption thresholds, Cascading Corruption, and
  Doom Approaches.
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
  siphons, and Signets of Suffering interaction.
- Static build traits and resolver-time strike, critical, condition,
  duration, recharge, resource, shroud, chill, fear, minion, spirit, and
  Blight modifiers. Deterministic expected-value procs are used where the game
  uses random critical-hit chances.
- Schema-version-3 build defaults, migration, sanitization, validation,
  canonical ID rotations, independent browser storage, and Life Force/Blight
  start controls.

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
used for important chains, channels, profession bars, persistent attacks, and
resource mechanics. Remaining skills use deterministic type-based cast
defaults and API coefficients.

This is a single-target damage simulator. Ally healing, revival, barrier,
boon removal, projectile interaction, pathing, incoming attacks, enemy
positioning, secondary targets, and competitive-mode splits are outside its
result model. Skills whose only effects are in those categories are excluded
instead of being shown as fake zero-damage implementations.
