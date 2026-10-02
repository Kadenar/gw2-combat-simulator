import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';

/** Owns Empowering Might's live tuning and trait behavior. */
export const empoweringMight = defineTrait({
  id: TRAIT.EMPOWERING_MIGHT,
  name: 'Empowering Might',
  balance: {
    internalCooldown: 1,
    effects: [{ type: 'boon', name: 'might', boon: 'might', stacks: 1, duration: 8, audience: { recipients: 'party' } }]
  },
  triggers: [
    {
      order: -2,
      emit: TRAIT.EMPOWERING_MIGHT,
      on: 'damage.resolved',
      icd: 'profile',
      when: (_runtime, event, details) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        (details.hitContext?.damage ?? 0) > 0 &&
        Boolean(details.hitContext?.critEligible && details.hitContext.critical.didCrit),
      attribution: {
        source: 'guardian',
        skillId: TRAIT.EMPOWERING_MIGHT,
        skillName: 'Empowering Might'
      }
    }
  ]
});

/** Owns Protector's Restoration's live tuning and trait behavior. */
export const protectorsRestoration = defineTrait({
  id: TRAIT.PROTECTORS_RESTORATION,
  name: "Protector's Restoration",
  balance: {
    internalCooldown: 20,
    effects: [
      {
        type: 'strike',
        name: 'Strike',
        // The symbol strikes on placement and twice more at one-second intervals.
        ticks: [0, 1000, 2000].map((atMs) => ({ atMs, coefficient: 0.6 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      // Protection keeps its pulse cadence even if the strike is removed.
      {
        type: 'boon',
        name: 'protection',
        boon: 'protection',
        duration: 1,
        stacks: 1,
        applications: 3,
        intervalMs: 1000
      }
    ]
  }
});

/** Owns Writ of Persistence's live tuning and trait behavior. */
export const writOfPersistence = defineTrait({
  id: TRAIT.WRIT_OF_PERSISTENCE,
  name: 'Writ of Persistence',
  balance: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          name: 'Smite',
          // Writ adds four more spatial Smite packets during its two-second symbol extension.
          ticks: [4240, 4760, 5240, 5760].map((atMs) => ({ atMs, coefficient: 0.2 })),
          actorType: 'player'
        },
        {
          type: 'strike',
          name: 'Symbol',
          ticks: [5240, 6240].map((atMs) => ({ atMs, coefficient: 0.5 })),
          actorType: 'player'
        },
        {
          type: 'boon',
          name: 'might',
          boon: 'might',
          stacks: 4,
          duration: 5,
          applications: 2,
          atMs: 5240,
          intervalMs: 1000,
          actorType: 'player'
        }
      ]),
      {
        type: 'buff',
        name: 'symbol-duration-extension',
        duration: 2,
        actorType: 'player'
      }
    ]
  }
});

/** Owns Force of Will's live tuning and trait behavior. */
export const forceOfWill = defineTrait({
  id: TRAIT.FORCE_OF_WILL,
  name: 'Force of Will',
  balance: { attributeBonus: 300 },
  buildAttributes: traitAttributeEffects(TRAIT.FORCE_OF_WILL, [
    { kind: 'flat', to: 'Vitality', field: 'attributeBonus', feedsConversions: true }
  ])
});

/** Owns Honorable Staff's live tuning and trait behavior. */
export const honorableStaff = defineTrait({
  id: TRAIT.HONORABLE_STAFF,
  name: 'Honorable Staff',
  balance: { attributeBonus: 120 },
  buildAttributes: traitAttributeEffects(TRAIT.HONORABLE_STAFF, [
    { kind: 'flat', to: 'Concentration', field: 'attributeBonus', feedsConversions: false }
  ])
});

/** Mace boons gain base duration before capped boon-duration bonuses; recharge uses the shared controller. */
export const invigoratedBulwark = defineTrait({
  id: TRAIT.INVIGORATED_BULWARK,
  name: 'Invigorated Bulwark',
  balance: { rechargeMultiplier: 0.8, durationMultiplier: 1.33 },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Mace',
      multiplier: { profile: TRAIT.INVIGORATED_BULWARK, field: 'rechargeMultiplier' }
    }
  ],
  hooks: {
    prepareEvent(runtime, event) {
      const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
      if (
        !hasTrait(runtime, TRAIT.INVIGORATED_BULWARK) ||
        event.type !== 'buff' ||
        !isStandardBoon(String(event.kind)) ||
        skill?.weapon !== 'Mace' ||
        event.sourceId !== skill.id
      )
        return event;
      const multiplier = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.INVIGORATED_BULWARK),
        'durationMultiplier'
      );
      // Scaling the skill-owned packet also covers Writ's added pulses without consuming capped bonus duration.
      return { ...event, duration: Number(event.duration) * multiplier };
    }
  }
});

export const guardianHonorTraits = [
  invigoratedBulwark,
  empoweringMight,
  protectorsRestoration,
  writOfPersistence,
  forceOfWill,
  honorableStaff
];
