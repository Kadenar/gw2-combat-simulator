import { ACTOR, RECIPIENT, BOON, COMBO_FIELD } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import { impactEffects } from '#gw2/platform/effects/authoring.js';

/**
 * Invoked skills own their payloads and recharge; fixed pulses preserve their independent impact timing.
 * Symbol tags, declared fields, and repeated pulses let Writ of Persistence extend triggered and cast symbols alike.
 */
export const GUARDIAN_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 10,
    comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 4 }],
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        actorType: ACTOR.PLAYER,
        weaponStrengthProfileId: 'nonweapon.unequipped',
        metadata: { guardianSymbol: true },
        coefficient: 0.65,
        atMs: 0,
        applications: 5,
        intervalMs: 1000
      }
    ])
  },
  {
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    name: 'Lesser Symbol of Protection',
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 20,
    comboFields: [{ ownerId: 'guardian', fieldType: COMBO_FIELD.LIGHT, duration: 2 }],
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        actorType: ACTOR.PLAYER,
        weaponStrengthProfileId: 'nonweapon.unequipped',
        metadata: { guardianSymbol: true },
        coefficient: 0.6,
        atMs: 0,
        applications: 3,
        intervalMs: 1000
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY },
        name: boonKey(BOON.PROTECTION),
        boon: BOON.PROTECTION,
        duration: 1,
        stacks: 1,
        applications: 3,
        intervalMs: 1000
      }
    ])
  },
  {
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    name: 'Lesser Symbol of Resolution',
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 30,
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Strike',
        actorType: ACTOR.PLAYER,
        weaponStrengthProfileId: 'nonweapon.unequipped',
        metadata: { guardianSymbol: true },
        coefficient: 0.5,
        atMs: 0,
        applications: 5,
        intervalMs: 1000
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        name: boonKey(BOON.RESOLUTION),
        boon: BOON.RESOLUTION,
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        actorType: ACTOR.PLAYER
      }
    ])
  }
]);
