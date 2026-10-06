import { appliedEffectStacks, type EffectRecipient } from '#gw2/platform/combat/query/effect-query.js';
import { isDurationStackingBoon, isStandardBoon, GW2_STANDARD_BOONS } from '#gw2/platform/combat/boons.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
  targetHasCondition
} from '#gw2/platform/combat/state/targets.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { CanonicalCatalog, Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boundedNumber, clamp } from '#kernel/core/numeric.js';

interface SkillEventIdentity {
  readonly skillId?: SkillId | null;
  readonly application?: {
    readonly skillId?: SkillId | null;
  };
}

/** Resolve the packet's identity before its application or query context; an unknown ID never selects another skill. */
export function skillForEvent<TSkill extends Skill>(
  catalog: Partial<Pick<CanonicalCatalog<TSkill>, 'skillsById'>> | undefined,
  event: SkillEventIdentity | null | undefined,
  contextSkillId?: SkillId | null
): TSkill | undefined {
  const skillId = event?.skillId ?? event?.application?.skillId ?? contextSkillId;
  if (skillId == null) return undefined;
  return catalog?.skillsById?.get(skillId);
}

/** Provides canonical ID membership for simulation loadouts. */
export function selectedSkillIds(context: Gw2ModifierContext): ReadonlySet<SkillId> {
  return selectedSkillIdSet(context.config?.selectedSkillIds);
}

/** Tests a selected canonical ID independently of its display name. */
export function hasSelectedSkillId(context: Gw2ModifierContext, id: SkillId): boolean {
  return selectedSkillIds(context).has(id);
}

/** Shares the resolver's dynamic health model so modifiers, death detection, and diagnostics agree on one value. */
export function targetHealthFraction(context: Gw2ModifierContext): number {
  return remainingTargetHealthFraction(context.config, context.runtime) ?? 1;
}

/** Modifier-context form of the shared strict "target below X% health" gate. */
export function targetHealthBelow(context: Gw2ModifierContext, threshold: number): boolean {
  return remainingTargetHealthBelow(context.config, context.runtime, threshold);
}

/** Simulations always use full health; only isolated stat-preview queries can vary it. */
export function playerHealthFraction(context: Gw2ModifierContext): number {
  return boundedNumber(context.attributePreviewPlayerHealthFraction ?? 1, 1, 0, 1);
}

/** Presence and stack queries share recipient, preview, and configured-boon semantics. */
export function boonActive(
  context: Gw2ModifierContext,
  boon: string,
  recipient: EffectRecipient = { actor: 'player' }
): boolean {
  return activeBoonStacks(context, boon, 1, recipient) > 0;
}

/** Only player counts use preview assumptions; companions count their own accepted boons. */
export function countActiveBoons(
  context: Gw2ModifierContext,
  recipient: EffectRecipient = { actor: 'player' },
  active = (boon: string) => boonActive(context, boon, recipient)
): number {
  if (recipient.actor === 'player' && context.config?.fixedBoonCount != null)
    return Math.trunc(boundedNumber(context.config.fixedBoonCount, 0, 0, GW2_STANDARD_BOONS.length));
  return GW2_STANDARD_BOONS.filter(active).length;
}

/** Configured boons belong to the player; dynamic stacks follow the selected recipient and source. */
export function activeBoonStacks(
  context: Gw2ModifierContext,
  boon: string,
  maximum = 25,
  recipient: EffectRecipient = { actor: 'player' }
): number {
  boon = boon.toLowerCase();
  if (!isStandardBoon(boon)) return 0;
  const base = recipient.actor === 'player' ? Number(context.config?.boons?.[boon] || 0) : 0;
  // Configured duration presence needs no history, but must still respect the caller's output cap.
  if (base > 0 && isDurationStackingBoon(boon)) return clamp(1, 0, maximum);
  // Live grants cannot increase configured intensity stacks that already meet the requested cap.
  if (base >= maximum) return clamp(base, 0, maximum);
  const dynamic = appliedEffectStacks(context, boon, maximum, recipient);
  return clamp((isDurationStackingBoon(boon) ? 0 : base) + dynamic, 0, maximum);
}

/** Gives an installed query adapter precedence while retaining config/runtime condition fallback for partial contexts. */
export function targetConditionActive(context: Gw2ModifierContext, condition: string): boolean {
  return context.query?.targetHasCondition
    ? context.query.targetHasCondition(condition, context.time, context.runtime)
    : targetHasCondition(context.config || {}, condition, context.time, context.runtime);
}

/** Counts distinct configured or live target conditions through the canonical combat query when available. */
export function targetConditionCount(context: Gw2ModifierContext): number {
  const names = new Set([
    ...CANONICAL_TARGET_CONDITIONS,
    ...Object.keys(context.config?.target?.conditions || {}).map(canonicalTargetConditionName),
    ...[...(context.runtime?.conditionState?.keys() || [])].map(canonicalTargetConditionName)
  ]);
  return [...names].filter((condition) => targetConditionActive(context, condition)).length;
}

/** Reads target Vulnerability through the shared combat-query stack calculation. */
export function vulnerabilityStacks(context: Gw2ModifierContext): number {
  return (
    context.query?.targetConditionStacks('Vulnerability', context.time, context.runtime) ??
    context.query?.vulnerabilityStacksAt(context.time, context.runtime) ??
    0
  );
}

/** Ordinary buffs share recipient and source selection without inheriting configured boons. */
export function activeBuffStacks(
  context: Gw2ModifierContext,
  kind: string,
  maximum = 25,
  recipient: EffectRecipient = { actor: 'player' },
  fallbackDuration = 0
): number {
  if (isStandardBoon(kind)) return 0;
  return appliedEffectStacks(context, kind, maximum, recipient, fallbackDuration);
}

/** Buff presence uses the same recipient and lifetime rules as its stack count. */
export function buffActive(
  context: Gw2ModifierContext,
  kind: string,
  recipient: EffectRecipient = { actor: 'player' }
): boolean {
  return activeBuffStacks(context, kind, 1, recipient) > 0;
}
