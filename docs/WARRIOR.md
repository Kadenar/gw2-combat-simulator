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
  availability and spending, three-level burst traits, weapon swapping, and
  current Warrior weapon families.
- Berserker's Berserk entry cost and duration, Primal Burst gating, Rage-skill
  duration extensions, and specialization damage, cast-speed, and attribute
  traits.
- Spellbreaker's 20-point adrenaline cap, Full Counter, control tracking,
  Attacker's Insight, Pure Strike, and Sun and Moon Style.
- Bladesworn's replacement of adrenaline with flow, gunsaber entry and exit,
  gunsaber skill gating,
  Dragon Trigger charge conversion, scaling Dragon Slash packets, and its
  modeled damage traits. Normal weapon swapping is disabled for Bladesworn.
- Paragon's 10-point adrenaline cap, chants, motivation, active refrains,
  periodic motivation drain, and modeled refrain traits.
- A validated disposition for all 108 traits. Defensive, ally-only, movement,
  and other behavior outside the deterministic outgoing-damage model is marked
  out of model rather than silently treated as implemented.

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

Charging consumes 10 Flow every 500 ms. If the remaining Flow cannot reach the
requested count, the slash is rejected with a resource warning instead of
waiting indefinitely.

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
