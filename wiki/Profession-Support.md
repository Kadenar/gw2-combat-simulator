# Profession support

The simulator includes all nine professions. Each runtime contains Core plus at most one elite specialization.

| Profession   | Supported specializations                              | Implementation notes                                                                                                      |
| ------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Elementalist | Core, Tempest, Weaver, Catalyst, Evoker                | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/ELEMENTALIST.md)                       |
| Engineer     | Core, Scrapper, Holosmith, Mechanist, Amalgam          | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/ENGINEER.md)                           |
| Guardian     | Core, Dragonhunter, Firebrand, Willbender, Luminary    | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/GUARDIAN.md)                           |
| Mesmer       | Core, Chronomancer, Mirage, Virtuoso, Troubadour       | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/MESMER.md)                             |
| Necromancer  | Core, Reaper, Scourge, Harbinger, Ritualist            | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/NECROMANCER.md)                        |
| Ranger       | Core, Druid, Soulbeast, Untamed, Galeshot              | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/RANGER.md)                             |
| Revenant     | Core, Herald, Renegade, Vindicator, Conduit            | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/REVENANT.md)                           |
| Thief        | Core, Daredevil, Deadeye, Specter, Antiquary           | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/THIEF.md)                              |
| Warrior      | Core, Berserker, Spellbreaker, Bladesworn, Paragon     | [Details](https://github.com/Kadenar/gw2-combat-simulator/blob/main/docs/professions/WARRIOR.md)                            |

Support means the profession can load and simulate through the shared engine. It does not mean every game mode, skill,
trait, encounter interaction, or support effect is modeled. Check the linked implementation notes for profession-specific
systems and boundaries.

If an action is absent from the palette or rejected with a warning, do not assume it contributes zero damage. It may be
outside the simulator's current scope.
