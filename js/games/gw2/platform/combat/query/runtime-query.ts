import {
  buffApplicationStacks,
  isDurationStackingBoon,
  isStandardBoon,
  GW2_STANDARD_BOONS
} from '#gw2/platform/combat/boons.js';
import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
  targetHasCondition
} from '#gw2/platform/combat/state/targets.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { boundedNumber, clamp } from '#kernel/core/numeric.js';

interface RuntimeSkillEvent {
  readonly skillId?: SkillId | null;
  readonly application?: {
    readonly skillId?: SkillId | null;
  };
}

interface RuntimeSkillCatalog {
  readonly catalog?: {
    readonly skillsById?: ReadonlyMap<SkillId, Skill>;
  };
}

/** Resolves the current event's catalog skill across every supported modifier-context skill-id path. */
export function eventSkill(context: Gw2ModifierContext): Skill | undefined {
  const event = context.event as RuntimeSkillEvent | null | undefined;
  const skillId = event?.skillId ?? event?.application?.skillId ?? context.skillId;
  if (skillId == null) return undefined;
  const profession = context.profession as RuntimeSkillCatalog | undefined;
  return profession?.catalog?.skillsById?.get(skillId);
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

/** Keeps permanent player boons while using live state to hide later same-time applications. */
export function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (!isStandardBoon(boon)) return false;
  if (context.config?.boons?.[boon]) return true;
  if (!context.runtime) return Boolean(context.timeline?.timedActive(boon, context.time));
  const applications = context.runtime.boons?.get(boon) || [];
  return buffApplicationStacks(applications, boon, context.time, 1) > 0;
}

/** Preview totals affect only per-boon bonuses; normal simulations count native boon presence, including owner-specific state. */
export function countActiveBoons(
  context: Gw2ModifierContext,
  active = (boon: string) => boonActive(context, boon)
): number {
  if (context.config?.fixedBoonCount != null)
    return Math.trunc(boundedNumber(context.config.fixedBoonCount, 0, 0, GW2_STANDARD_BOONS.length));
  return GW2_STANDARD_BOONS.filter(active).length;
}

/** Counts only player applications so summon copies cannot extend duration or add intensity/custom stacks. */
export function activeBoonStacks(context: Gw2ModifierContext, boon: string, maximum = 25): number {
  if (!isStandardBoon(boon)) return 0;
  const permanent = context.config?.boons?.[boon];
  const base = permanent === true ? 1 : permanent || 0;
  // Configured duration presence needs no history, but must still respect the caller's output cap.
  if (base > 0 && isDurationStackingBoon(boon)) return clamp(1, 0, maximum);
  const boons = context.runtime?.boons;
  const applications = boons?.get(boon) || [];
  const dynamic = buffApplicationStacks(applications, boon, context.time, Infinity);
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

/** Ordinary buffs use accepted player grants; only absent runtimes may inspect scheduled preview events. */
export function activeBuffStacks(context: Gw2ModifierContext, kind: string, maximum = 25): number {
  if (isStandardBoon(kind)) return 0;
  if (!context.runtime) return context.timeline?.buffStacksAt(kind, context.time, 0, maximum) ?? 0;
  return buffApplicationStacks(context.runtime.buffs?.get(kind) ?? [], kind, context.time, maximum);
}

/** Buff presence stays separate from configured and generated standard boons. */
export function buffActive(context: Gw2ModifierContext, kind: string): boolean {
  return activeBuffStacks(context, kind, 1) > 0;
}
