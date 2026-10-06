import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { grantWarriorResource } from '#gw2/professions/warrior/resource-rules.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Enhance the ranged autoattacks, applying Burning separately for each Dual Shot arrow that hits. */
export const crackShot = defineTrait({
  id: TRAIT.CRACK_SHOT,
  name: 'Crack Shot',
  balance: {
    effects: [{ name: 'Burning', type: 'condition', condition: 'Burning', stacks: 1, duration: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.crack-shot',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      when: (context) =>
        skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.FIERCE_SHOT
    }
  ],
  triggers: [
    {
      on: 'damage.resolved',
      when: (_runtime, event) =>
        event.actorType === 'player' && event.skillId === ID.DUAL_SHOT && Number(event.coefficient) > 0,
      emit: TRAIT.CRACK_SHOT
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const burstMastery = defineTrait({
  id: TRAIT.BURST_MASTERY,
  name: 'Burst Mastery',
  balance: {
    resourceGain: 0.33,
    effects: [{ name: 'swiftness', type: 'boon', boon: 'swiftness', stacks: 1, duration: 3 }]
  },
  modifierRules: [
    {
      id: 'warrior.burst-mastery',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      order: 100,
      when: (context) => Boolean(skillForEvent(context.profession?.catalog, context.event, context.skillId)?.burst)
    }
  ],
  profiles: [
    {
      id: 'warrior.bladesworn.burst-mastery',
      name: 'Bladesworn Burst Mastery Conversion',
      profileKind: 'mechanic',
      resourceGain: 0.2,
      effects: []
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const axeMastery = defineTrait({
  id: TRAIT.AXE_MASTERY,
  name: 'Axe Mastery',
  balance: {
    attributeBonus: 120,
    weaponAttributeBonus: 240,
    rechargeMultiplier: 0.8,
    resourceGain: 2
  },
  buildAttributes(_common, context) {
    const weapons = (context.weaponSet === 2 ? context.build.alternateWeapons : context.build.weapons) || [];
    return {
      attributeEffects: [
        {
          kind: 'flat',
          to: 'Ferocity',
          amount: balanceProfileNumber(
            requireBalanceProfileFromContext(context.balanceContext, TRAIT.AXE_MASTERY),
            weapons.includes('Axe') ? 'weaponAttributeBonus' : 'attributeBonus'
          ),
          feedsConversions: false,
          enabled: true
        }
      ]
    };
  },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Axe',
      multiplier: { profile: TRAIT.AXE_MASTERY, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const versatileRage = defineTrait({
  id: TRAIT.VERSATILE_RAGE,
  name: 'Versatile Rage',
  balance: { resourceGain: 5 }
});

/** Reduce burst recharge, including Dragon Trigger, which owns the recharge for Dragon Slash. */
export const versatilePower = defineTrait({
  id: TRAIT.VERSATILE_POWER,
  name: 'Versatile Power',
  balance: { rechargeMultiplier: 0.85 },
  rechargeRules: [
    {
      order: -1,
      when: (_runtime, skill) => Boolean(skill.burst) || skill.id === ID.DRAGON_TRIGGER,
      multiplier: { profile: TRAIT.VERSATILE_POWER, field: 'rechargeMultiplier' }
    }
  ]
});

/** Owns Heightened Focus's execute-range Quickness and Burst recharge; its healing stacks are out of scope. */
export const heightenedFocus = defineTrait({
  id: TRAIT.HEIGHTENED_FOCUS,
  name: 'Heightened Focus',
  balance: {
    internalCooldown: 12,
    effects: [{ name: 'quickness', type: 'boon', boon: 'quickness', stacks: 1, duration: 5 }]
  },
  hooks: {
    reactions: { 'damage.resolved': triggerHeightenedFocus },
    onCastCommit: readyHeightenedFocusBurst
  }
});

/** Owns this trait's tuning and selected contributions. */
export const warriorsSprint = defineTrait({
  id: TRAIT.WARRIORS_SPRINT,
  name: "Warrior's Sprint",
  modifierRules: [
    {
      order: 7,
      id: 'warrior.warriors-sprint',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'damage-additive',
      amount: 0.1,
      when: (context) => warriorBoonActive(context, 'swiftness')
    }
  ]
});

type WarriorRuntime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

/**
 * Heightened Focus: the first player strike after its internal cooldown that lands while the target is below half
 * health grants Quickness and readies every Burst skill, so execute phases can chain bursts. The adrenaline-scaled
 * outgoing-healing stacks are support-only and intentionally not modeled.
 */
export function triggerHeightenedFocus(runtime: WarriorRuntime, event: Gw2ResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !((event.coefficient || 0) > 0) ||
    !hasTrait(runtime, TRAIT.HEIGHTENED_FOCUS) ||
    !runtime.combat.targetHealthBelow(0.5) ||
    !runtime.procs.claim(TRAIT.HEIGHTENED_FOCUS)
  )
    return;
  {
    const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.HEIGHTENED_FOCUS);
    runtime.effects.emit({
      kind: 'profile',
      profile: traitProfile,
      effects: traitProfile.effects?.filter((effect) => ['boon', 'buff', 'condition'].includes(effect.type)),
      attribution: {
        source: 'Trait',
        sourceId: TRAIT.HEIGHTENED_FOCUS,
        actorType: 'effect',
        skillId: event.skillId,
        skillName: event.skillName
      },
      cause: event,
      transform: (packet) => ({ ...packet, priority: 5, name: traitProfile.name, stacks: 1 * Number(packet.stacks) })
    });
  }

  // The live catalog defines which skills are bursts, including elite primal bursts and chants.
  for (const skill of runtime.helpers.skills) if (skill.burst) runtime.cooldownController.clear(skill.id);
  runtime.effects.emit({
    kind: 'announcement',
    announcement: {
      type: 'trait',
      name: 'Heightened Focus',
      at: event.at,
      sourceSkill: event.skillName,
      detail: 'quickness; Burst skills recharged'
    }
  });
}

/**
 * In game a burst's recharge begins at activation, so a Heightened Focus trigger during that burst's own cast also
 * readies it. The simulator commits recharge at completion, before this hook, so the burst is cleared again here when
 * the latest trigger (recovered from the proc deadline) falls inside its cast window.
 */
export function readyHeightenedFocusBurst(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>): void {
  if (!cast.skill.burst || !hasTrait(runtime, TRAIT.HEIGHTENED_FOCUS)) return;
  const readyAt = runtime.procs.deadline(TRAIT.HEIGHTENED_FOCUS);
  if (!(readyAt > 0)) return;
  // Canonicalize subtraction roundoff without admitting procs outside the cast window.
  const triggeredAt = canonicalTime(
    readyAt -
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.HEIGHTENED_FOCUS), 'internalCooldown')
  );
  if (triggeredAt >= canonicalTime(cast.start) && triggeredAt <= canonicalTime(runtime.time))
    runtime.cooldownController.clear(cast.skill.id);
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function axeMasteryCritical(runtime: WarriorRuntime, event: Gw2ResolverEvent, criticals: number): void {
  if (criticals > 0 && hasTrait(runtime, TRAIT.AXE_MASTERY)) {
    const skill = runtime.helpers.skillsById.get(event.skillId ?? '');
    if ((skill?.skillWeapon || skill?.weapon || event.skillWeapon) === 'Axe')
      grantWarriorResource(
        runtime,
        criticals * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.AXE_MASTERY), 'resourceGain')
      );
  }
}

/** Apply line-owned rewards at the shared reaction boundary. */
export function versatileRageSwap(runtime: WarriorRuntime): void {
  if (hasTrait(runtime, TRAIT.VERSATILE_RAGE))
    grantWarriorResource(
      runtime,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.VERSATILE_RAGE), 'resourceGain')
    );
}

/** Refund the captured burst spend before later completion rewards. */
export function burstMasteryCommit(runtime: WarriorRuntime, cast: RuntimeCast<WarriorSkill>, spent: number): void {
  if (cast.skill.burst && cast.skill.id !== ID.FULL_COUNTER && spent > 0 && hasTrait(runtime, TRAIT.BURST_MASTERY)) {
    grantWarriorResource(
      runtime,
      spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY), 'resourceGain')
    );
    // The refund is live now; Swiftness resolves after same-time burst damage, preserving reward ordering.
    {
      const traitProfile = requireBalanceProfileFromContext(runtime, TRAIT.BURST_MASTERY);
      const selectedEffect = requireEffect(traitProfile, 'boon', 'swiftness');
      if (selectedEffect)
        runtime.effects.emit({
          kind: 'profile',
          profile: traitProfile,
          effects: [selectedEffect],
          at: runtime.time,
          attribution: {
            source: 'Trait',
            sourceId: TRAIT.BURST_MASTERY,
            actorType: 'effect',
            skillId: cast.skill.id,
            skillName: cast.skill.name,
            activationId: cast.id
          },
          transform: (event) => ({ ...event, name: 'Burst Mastery — Swiftness', priority: 5 })
        });
    }
  }
}
