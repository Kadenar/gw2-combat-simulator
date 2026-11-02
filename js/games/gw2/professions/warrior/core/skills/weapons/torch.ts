/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { COMBO_FIELD, COMBO_FINISHER, CONDITION } from '#gw2/platform/constants.js';
import { conditionTimeline, impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';

export const WARRIOR_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.BLAZE_BREAKER]: {
    name: 'Blaze Breaker',
    icon: 'https://render.guildwars2.com/file/2697E50F35B6DE6874F80BDBE31D3CEE8029349F/1058648.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_4',
    ammoCastLockout: 12,
    ammo: 2,

    cooldown: 15,
    castTimeMs: 480,
    interruptMode: 'commit',
    // Preserve committed blast effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 440,
    retainsCastLockoutAfterInterrupt: true,
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.BLAST
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 0.4
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 6
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3
        }
      ]
    )
  },
  [ID.FLAMES_OF_WAR]: {
    name: 'Flames of War',
    icon: 'https://render.guildwars2.com/file/F7A4B096DB511FBE534A636C6E62E19505A70910/1058649.png',
    type: 'Weapon',
    weapon: 'Torch',
    slot: 'Weapon_5',
    cooldown: 20,
    castTimeMs: 520,
    comboFields: [
      {
        ownerId: 'warrior',
        fieldType: COMBO_FIELD.FIRE,
        duration: 5,
        startAnchor: 'castEnd'
      }
    ],
    // Group identical Burning pulses separately from the explosion's stronger, longer Burning.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        atMs: 5480,
        coefficient: 1
      },
      conditionTimeline(
        [480, 1480, 2480, 3480, 4480].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 2
        }))
      ),
      {
        type: 'condition',
        atMs: 5480,
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 6
      }
    ])
  }
};
