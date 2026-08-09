# Warrior simulator

Warrior uses the shared native-profession scheduler, resolver, build editor,
and browser application boundary. The stable entry point is
`js/professions/warrior/definition.ts`; `family.ts` composes Core with exactly
one of Berserker, Spellbreaker, Bladesworn, or Paragon.

Each specialization owns its state, skill handlers, modifier rules, and UI in
`js/professions/warrior/specializations/<name>/`. Core adrenaline, bursts,
weapon state, shared traits, and profession actions live under `core/`.

## Implemented systems

- Core adrenaline generation on player strike packets, a 30-point cap, burst
  availability and spending, three-level burst traits, weapon swapping,
  endurance and Dodge, and current Warrior weapon families.
- Berserker's Berserk entry cost and duration, Primal Burst gating, Rage-skill
  duration extensions, and specialization damage, cast-speed, and attribute
  traits, including Slicing Maelstrom's boonless modifier and measured
  Quickness timing.
- Spellbreaker's 20-point adrenaline cap, level-one bursts, Full Counter,
  control tracking, Attacker's Insight, Pure Strike, No Escape, Sun and Moon
  Style, Magebane Tether, Winds of Disenchantment pulses, Wastrel's Ruin and
  Breaching Strike target modifiers, and fixed Breaching Strike timing.
- Bladesworn's replacement of adrenaline with flow, gunsaber entry and exit,
  gunsaber skill gating, gunsaber and pistol ammo, armament reloads and buffs,
  Dragon Trigger utilities, charge conversion, scaling Dragon Slash packets,
  ammunition traits, gunsaber-swap traits, and Dragon Slash grandmasters.
  Normal weapon swapping is disabled for Bladesworn.
- Strength and Tactics support includes outgoing attribute and damage
  modifiers, Soldier's Focus, party boon applications, ammo and physical-skill
  procs, movement-skill adrenaline, control reactions, and burst/dodge
  endurance interactions. Traits explicitly supplied as unimplemented remain
  excluded.
- Paragon's 10-point adrenaline cap, chants, motivation, active refrains,
  periodic motivation drain, and modeled refrain traits.
- A validated disposition for all 108 traits. Remaining incoming-damage,
  healing, and other behavior outside the deterministic model is marked out of
  model rather than silently treated as implemented.

## Dragon Trigger rotations

Queue Dragon Slash directly after Dragon Trigger. The scheduler waits for the
specialization's current maximum charge count automatically, so the rotation
does not need a guessed Wait entry:

```js
["Dragon Trigger", "Dragon Slash—Force"];
```

Set `releaseAtCharges` on the Dragon Slash cast to release early. The timeline's
`⚡Max` badge edits the same value; clearing it restores maximum-charge release.
The requested value is capped to the active specialization maximum, including
Daring Dragon's five-charge maximum.

```js
["Dragon Trigger", { name: "Dragon Slash—Force", releaseAtCharges: 3 }];
```

Flow increases by 2 per second in combat. Flow Stabilizer adds two Positive
Flow stacks, increasing that rate by another 4 per second for 8 seconds.
Adrenaline gains convert to Flow, while ordinary attack hits do not generate
it.

Dragon Trigger consumes 5 Flow every 250 ms and continues gaining passive Flow
during the channel. A normal channel gains one charge per interval for up to 10
charges in 2.5 seconds. Tactical Reload makes the next channel gain two charges
per interval without increasing its Flow cost. If the requested count cannot
be reached by the end of the channel, the slash is rejected with a resource
warning instead of waiting indefinitely.

Daring Dragon caps the channel at 5 charges and consumes 10 Flow per interval.
Its five-charge interpolation still reaches the listed maximum Dragon Slash
coefficient and grants 10 seconds of Alacrity to the party.

Dragon Slash coefficients interpolate from their one-charge minimum to their
maximum at the active charge cap. Gunsaber attacks are tagged as explosions;
Overcharged Cartridges therefore increases their strike damage and applies
Burning while its 8-second buff is active.

## Power Bladesworn preset

The Bladesworn preset uses the requested Axe/Pistol, Berserker gear with
Assassin leggings, Infiltration runes, Force/Accuracy sigils, Peitha, Plate of
Truffle Steak, Furious Sharpening Stone, 17 Power infusions, and 1 Precision
infusion. It selects Strength `3-3-1`, Tactics `1-1-1`, and Bladesworn `1-2-2`.

The supplied EVTC records 3,972,566 damage over 95.644 seconds (41,534.92 DPS).
Its non-gunsaber weapon windows contain Sword autoattacks, despite the requested
Axe/Pistol build. The saved preset therefore preserves the EVTC gunsaber order
and measured Quickness activation durations while replacing those Sword
windows with the requested Axe skills. It is an executable Axe/Pistol
reconstruction, not an exact replay of the mismatched weapon packets.

## Power Spellbreaker presets

Both Spellbreaker presets use Dagger/Mace with Force/Air. Their alternate set
is either Sword/Axe or Sword/Dagger with Force/Hydromancy. They have full
Berserker gear, Scholar runes, Relic of the Claw, Cilantro Lime Sous-Vide
Steak, Superior Sharpening Stone, and 18 Power infusions. Both select Arms
`2-3-3`, Strength `3-3-1`, and Spellbreaker `1-3-3`, with Healing Signet, Kick,
Signet of Fury, Signet of Might, and Winds of Disenchantment.

The Sword/Axe EVTC records 3,949,729 damage over a 92.521-second damage window
(42,690.08 DPS). The Sword/Dagger EVTC records 3,957,534 damage over 92.406
seconds (42,827.67 DPS). Both saved rotations precast Winds and preserve its
five one-second pulses, seven Kick casts, fourteen Crushing Blow hits, and the
weapon-window activation order. The Sword/Dagger rotation additionally
preserves seven Wastrel's Ruin hits, nine Hushblade hits, and its measured
autoattack packet counts.

## Data

The August 8, 2026 snapshot contains 195 API skills, 108 traits, and all nine
specialization lines. Twelve API-omitted Bladesworn gunsaber and Dragon Slash
skills are checked in as supplemental identities. Refresh and regenerate the
Warrior data with:

```powershell
npm run update:warrior-data
```

The Warrior updater deliberately removes invalid API skill `62857`
(`((996787))`) and repairs Dragon Trigger's dangling flip reference. The
mechanics generator also rejects zero-duration effects and de-duplicates the
API's repeated mode variants before producing executable skill fragments.

## Modeling limits

The simulator is single-target and outgoing-damage focused. Incoming attacks,
active defense, ally healing and revival, projectile interaction, pathing,
secondary targets, and competitive-mode splits are outside the model. Full
Counter is treated as triggered when cast. Public API data does not expose all
activation times or mode-specific facts, so the generator uses current Wiki
activation data where available and deterministic fallbacks elsewhere.
