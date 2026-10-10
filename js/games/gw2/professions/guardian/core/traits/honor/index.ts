import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { impactEffects, strikeEffectTicks } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import {
  guardianCastCompleted,
  type GuardianCastCompletion
} from '#gw2/professions/guardian/core/mechanics/combat-boundaries.js';
import { guardianCastCause } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { isGuardianSymbolSkill } from '#gw2/professions/guardian/core/mechanics/symbols.js';
import { emitTraitSymbol } from '#gw2/professions/guardian/core/traits/symbols.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import type { GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

type Runtime = MechanicContext<GuardianRuntimeState, GuardianSkill>;

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
      cooldown: 'profile',
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
  triggers: [
    onTriggerPoint(guardianCastCompleted, {
      when: (_runtime, { cast }: GuardianCastCompletion) => cast.skill.type === 'Heal',
      run: placeProtectorsSymbol
    })
  ],
  balance: {
    // This produced skill recharges with the player's Alacrity; ordinary trait ICDs remain fixed.
    cooldownPolicy: 'playerRecharge',
    cooldown: 20,
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
  hooks: { modifyEffects: writOfPersistenceEffects },

  id: TRAIT.WRIT_OF_PERSISTENCE,
  name: 'Writ of Persistence',
  balance: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          name: 'Smite',
          metadata: { guardianSymbol: true },
          // Writ adds four more spatial Smite packets during its two-second symbol extension.
          ticks: [4240, 4760, 5240, 5760].map((atMs) => ({ atMs, coefficient: 0.2 })),
          actorType: 'player'
        },
        {
          type: 'strike',
          name: 'Symbol',
          metadata: { guardianSymbol: true },
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

/**
 * Fields are selected before registration, so extensions never rewrite an already executed action. Core composes this
 * after its weapon-field selection, because a trait hook would run before Symbol of Ignition's field exists.
 */
export function writOfPersistenceFields(
  runtime: MechanicQueriesOf<Runtime>,
  cast: RuntimeCast<GuardianSkill>,
  fields: Skill['comboFields']
): Skill['comboFields'] {
  if (isGuardianSymbolSkill(cast.skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.WRIT_OF_PERSISTENCE);
    const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
    if (window)
      fields = fields?.map((field, index) =>
        index === 0 ? { ...field, duration: Number(field.duration) + effectNumber(profile, window, 'duration') } : field
      );
  }

  return fields;
}

/** Select authored trait extensions once and leave cancellation, impact delay, and boon sampling to the common runtime. */
function writOfPersistenceEffects(
  runtime: MechanicQueriesOf<Runtime>,
  cast: RuntimeCast<GuardianSkill>,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const extra: SkillEffect[] = [];
  const skill = cast.skill;
  const field = skill.comboFields?.[0];
  if (field && isGuardianSymbolSkill(skill) && hasTrait(runtime, TRAIT.WRIT_OF_PERSISTENCE)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.WRIT_OF_PERSISTENCE);
    if (skill.id === ID.SYMBOL_OF_PUNISHMENT) {
      for (const effect of profile.effects ?? []) {
        if (effect.type === 'strike') extra.push({ ...effect, name: skill.name, weapon: 'Scepter' });
        else if (effect.type === 'boon') extra.push({ ...effect, audience: { recipients: 'party' } });
      }
    } else {
      const window = requireEffect(profile, 'buff', 'symbol-duration-extension');
      const extension = window ? effectNumber(profile, window, 'duration') : 0;
      const pulse = effects.filter((effect) => effect.type === 'strike' && strikeEffectTicks(effect).length > 1).at(-1);
      if (pulse?.type === 'strike' && extension > 0) {
        const ticks = strikeEffectTicks(pulse);
        const last = ticks.at(-1)!;
        const fieldEnd =
          (field.startAnchor === 'castEnd' ? cast.fullEnd : cast.start) +
          Number(field.startMs ?? 0) / 1000 +
          Number(field.duration);
        const lastAt =
          ticks.length >= 5
            ? fieldEnd
            : (pulse.timingAnchor === 'castStart' ? cast.start : cast.fullEnd) + last.atMs / 1000;
        extra.push({
          type: 'strike',
          // Extended pulses retain the selected packet's semantic classification and tick overrides.
          metadata: { ...pulse.metadata, ...last.metadata },
          name: pulse.name ?? skill.name,
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          persistsAfterInterrupt: pulse.persistsAfterInterrupt,
          ticks: Array.from({ length: Math.floor(extension) }, (_, index) => ({
            atMs: (lastAt - cast.start + index + 1) * 1000,
            coefficient: last.coefficient
          }))
        });
      }
    }
  }

  const selected = [...effects, ...extra];
  // A symbol's self boon belongs to each pulse even when its hostile packet misses the target.
  if (skill.id === ID.SYMBOL_OF_RESOLUTION || skill.id === ID.LUMINOUS_STAFF || skill.id === ID.SYMBOL_OF_FAITH)
    for (const effect of extra) {
      if (effect.type !== 'strike') continue;
      for (const tick of strikeEffectTicks(effect))
        selected.push({
          type: 'boon',
          boon: skill.id === ID.SYMBOL_OF_FAITH ? 'regeneration' : 'resolution',
          duration: 1,
          stacks: 1,
          atMs: tick.atMs,
          timingAnchor: effect.timingAnchor,
          timingScale: effect.timingScale,
          persistsAfterInterrupt: effect.persistsAfterInterrupt
        });
    }

  return selected;
}

/** A committed heal claims Protection's interval only when its selected symbol can emit. */
function placeProtectorsSymbol(runtime: Runtime, { cast }: GuardianCastCompletion): void {
  const cause = { ...guardianCastCause(runtime, cast), type: 'action' as const };
  emitTraitSymbol(runtime, TRAIT.PROTECTORS_RESTORATION, ID.LESSER_SYMBOL_OF_PROTECTION, cause, {
    party: true,
    cooldownKey: 'guardian.core.protectorsRestoration',
    fieldDuration: (effect) => (effect.type === 'strike' ? (effect.ticks?.at(-1)?.atMs ?? 0) / 1000 : 0)
  });
}
