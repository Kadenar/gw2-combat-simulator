import type { Gw2Runtime } from '#gw2/platform/simulation/runtime-state.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  requireBalanceProfileFromContext,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { hasSelectedSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { remainingTargetHealthBelow } from '#gw2/platform/combat/state/target-health.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';
import {
  warriorActiveBuffStacks,
  warriorBoonActive,
  warriorEventSkill,
  warriorTargetControlled,
  warriorWieldingWeapon,
  type WarriorModifierAttributes
} from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import type { Gw2ModifierContext, Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
// Trigger Lesser Signet of Might after the first eligible below-half-health strike at that strike's exact timestamp.
export function reactToWarriorDamage(context: Gw2Runtime<WarriorRuntimeState>, event: Gw2ResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient || 0) > 0) ||
    !remainingTargetHealthBelow(context.config, context, 0.5) ||
    !hasTrait(context, TRAIT.SIGNET_MASTERY)
  ) {
    return;
  }

  const signetMastery = requireBalanceProfileFromContext(context, PROFILE.signetMastery);
  // Reserve this trait's own deadline before emitting its effects.
  if (!context.procs.claim(PROFILE.signetMastery)) return;
  for (const effect of signetMastery.effects || []) {
    const kind = String(effect.boon || effect.kind || '');
    queueResolverBoon(
      context,
      event,
      buildResolverBuff({
        at: event.at,
        priority: 5,
        source: 'Trait',
        sourceId: TRAIT.SIGNET_MASTERY,
        actorType: 'effect',
        skillId: TRAIT.SIGNET_MASTERY,
        skillName: 'Lesser Signet of Might',
        kind,
        stacks: effectNumber(signetMastery, effect, 'stacks'),
        duration: effectNumber(signetMastery, effect, 'duration')
      })
    );
  }

  context.recordProc(
    'trait',
    'Lesser Signet of Might',
    event.at,
    event.skillName,
    '10 might; Signet Mastery stack',
    String(context.helpers.skillsById?.get(ID.SIGNET_OF_MIGHT)?.icon || '')
  );
}

// Resolve Arms-owned attributes, including live signet state and critical-proc stacks.
export function modifyWarriorArmsAttributes(
  context: Gw2ModifierContext,
  result: WarriorModifierAttributes,
  staticRulesApplied: boolean
): void {
  const signetMasteryProfile = requireBalanceProfileFromContext(context, PROFILE.signetMastery);
  const signetStacks = warriorActiveBuffStacks(
    context,
    'signet-mastery',
    balanceProfileNumber(signetMasteryProfile, 'maximumStacks')
  );
  if (hasTrait(context, TRAIT.SIGNET_MASTERY)) {
    result.ferocity += signetStacks * balanceProfileNumber(signetMasteryProfile, 'attributeBonus');
  }

  if (
    hasTrait(context, TRAIT.DEEP_STRIKES) &&
    warriorBoonActive(context, 'fury') &&
    !(staticRulesApplied && Boolean(context.config?.boons?.fury))
  ) {
    const deepStrikesProfile = requireBalanceProfileFromContext(context, PROFILE.deepStrikes);
    result.conditionDamage += balanceProfileNumber(deepStrikesProfile, 'attributeBonus');
  }

  if (hasTrait(context, TRAIT.BLADEMASTER) && warriorWieldingWeapon(context, 'Sword')) {
    const blademasterProfile = requireBalanceProfileFromContext(context, PROFILE.blademaster);
    result.conditionDamage += balanceProfileNumber(blademasterProfile, 'attributeBonus');
  }

  const furiousProfile = requireBalanceProfileFromContext(context, PROFILE.furious);
  result.conditionDamage +=
    warriorActiveBuffStacks(context, 'furious-surge', balanceProfileNumber(furiousProfile, 'maximumStacks')) *
    balanceProfileNumber(furiousProfile, 'attributeBonus');
  if (hasTrait(context, TRAIT.BURST_PRECISION) && warriorActiveBuffStacks(context, 'burst-precision', 1) > 0) {
    const burstPrecisionProfile = requireBalanceProfileFromContext(context, PROFILE.burstPrecision);
    result.ferocity += balanceProfileNumber(burstPrecisionProfile, 'attributeBonus');
  }

  if (warriorActiveBuffStacks(context, 'signet-of-fury-active', 1) > 0) {
    const signetOfFuryActiveProfile = requireBalanceProfileFromContext(context, PROFILE.signetOfFuryActive);
    const bonus = balanceProfileNumber(signetOfFuryActiveProfile, 'attributeBonus');
    result.precision += bonus;
    result.ferocity += bonus;
  }

  const activeSignets = (
    [
      ['Signet of Might', ID.SIGNET_OF_MIGHT, 'power'],
      ['Signet of Fury', ID.SIGNET_OF_FURY, 'precision']
    ] as const
  ).filter(([name, id]) => {
    if (!hasSelectedSkill(context, name)) return false;
    const onCooldown = Boolean(context.timeline?.skillOnCooldownAt(id, context.time));
    return staticRulesApplied ? onCooldown : !onCooldown;
  });
  if (activeSignets.length > 0) {
    const signetPassivesProfile = requireBalanceProfileFromContext(context, PROFILE.signetPassives);
    // Both eligible signets use the same passive bonus, read once before applying it.
    const passiveBonus = balanceProfileNumber(signetPassivesProfile, 'attributeBonus');
    for (const [, , attribute] of activeSignets) {
      result[attribute] += (staticRulesApplied ? -1 : 1) * passiveBonus;
    }
  }
}

export const warriorArmsModifierRules: readonly Gw2ModifierRule[] = Object.freeze([
  {
    id: 'warrior.furious-burst-fury-critical-chance',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FURIOUS_BURST), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.FURIOUS_BURST) && warriorBoonActive(context, 'fury')
  },
  {
    id: 'warrior.deep-strikes',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.DEEP_STRIKES), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.DEEP_STRIKES) && targetConditionActive(context, 'Bleeding')
  },
  {
    id: 'warrior.unsuspecting-foe',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNSUSPECTING_FOE), 'criticalChance'),
    when: (context) => hasTrait(context, TRAIT.UNSUSPECTING_FOE) && warriorTargetControlled(context)
  },
  {
    id: 'warrior.burst-precision',
    target: MODIFIER_TARGET.CRITICAL_CHANCE,
    operation: 'add',
    amount: (context) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.BURST_PRECISION), 'criticalChance'),
    when: (context) =>
      hasTrait(context, TRAIT.BURST_PRECISION) &&
      (Boolean(warriorEventSkill(context)?.burst) || warriorActiveBuffStacks(context, 'burst-precision', 1) > 0)
  }
]);
