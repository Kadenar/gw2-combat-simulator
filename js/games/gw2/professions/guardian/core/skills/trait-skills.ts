import { boonKey } from '#gw2/platform/combat/boons.js';
import { ACTOR, BOON, COMBO_FIELD, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

/**
 * Invoked skills own their payloads and recharge; fixed pulses preserve their independent impact timing.
 * Symbol tags, declared fields, and repeated pulses let Writ of Persistence extend triggered and cast symbols alike.
 */
export const GUARDIAN_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Lesser Symbol of Blades',
    id: ID.LESSER_SYMBOL_OF_BLADES,
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 10,
    castTimeMs: 0,
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
    name: 'Lesser Symbol of Protection',
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 20,
    castTimeMs: 0,
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
    name: 'Lesser Symbol of Resolution',
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    tags: ['symbol'],
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 30,
    castTimeMs: 0,
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
