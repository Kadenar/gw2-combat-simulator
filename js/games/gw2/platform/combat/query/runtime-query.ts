import { buffApplicationStacks, isDurationStackingBoon } from '#gw2/platform/combat/boons.js';
import { selectedSkillNameSet } from '#gw2/platform/builds/selected-skills.js';
import {
  CANONICAL_TARGET_CONDITIONS,
  canonicalTargetConditionName,
  targetHasCondition
} from '#gw2/platform/combat/state/targets.js';
import { remainingTargetHealthBelow, remainingTargetHealthFraction } from '#gw2/platform/combat/state/target-health.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2TimedBuffApplication } from '#gw2/platform/combat/boons.js';
import { boundedNumber, clamp } from '#kernel/core/numeric.js';

interface RuntimeSkillEvent {
  readonly skillId?: SkillId | null;
  readonly application?: {
    readonly skillId?: SkillId | null;
  };
}

interface RuntimeSkillCatalog<TSkill extends Skill> {
  readonly catalog?: {
    readonly skillsById?: ReadonlyMap<SkillId, TSkill>;
  };
}

/** Resolves the current event's catalog skill across every supported modifier-context skill-id path. */
export function eventSkill<TSkill extends Skill>(context: Gw2ModifierContext): TSkill | undefined {
  const event = context.event as RuntimeSkillEvent | null | undefined;
  const skillId = event?.skillId ?? event?.application?.skillId ?? (context.skillId as SkillId | null | undefined);
  if (skillId == null) return undefined;
  const profession = context.profession as RuntimeSkillCatalog<TSkill> | undefined;
  return profession?.catalog?.skillsById?.get(skillId);
}

/** Provides skill-name membership for array and slot-record loadouts. */
export function selectedSkillNames(context: Gw2ModifierContext): ReadonlySet<string> {
  return selectedSkillNameSet(context.config?.selectedSkills);
}

/** Tests a selected skill name without exposing the persisted loadout's array-or-record shape. */
export function hasSelectedSkill(context: Gw2ModifierContext, name: string): boolean {
  return selectedSkillNames(context).has(name);
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
  if (context.config?.boons?.[boon]) return true;
  if (!context.runtime) return Boolean(context.timeline?.timedActive(boon, context.time));
  const applications = context.runtime.boons?.get(boon) || [];
  return buffApplicationStacks(applications, boon, context.time, 1) > 0;
}

/** Counts only player applications so summon copies cannot extend duration or add intensity/custom stacks. */
export function activeBoonStacks(context: Gw2ModifierContext, boon: string, maximum = 25): number {
  const permanent = context.config?.boons?.[boon];
  const base = permanent === true ? 1 : Number(permanent || 0);
  // Configured duration presence needs no history, but must still respect the caller's output cap.
  if (base > 0 && isDurationStackingBoon(boon)) return clamp(1, 0, maximum);
  const schedulerState = context.state as { readonly boons?: Map<string, Gw2TimedBuffApplication[]> } | undefined;
  const boons = context.runtime?.boons ?? schedulerState?.boons;
  const applications = boons?.get(boon) || [];
  const dynamic = buffApplicationStacks(applications, boon, context.time, Infinity);
  return clamp((isDurationStackingBoon(boon) ? 0 : base) + dynamic, 0, maximum);
}

/** Gives an installed query adapter precedence while retaining config/runtime condition fallback for partial contexts. */
export function targetConditionActive(context: Gw2ModifierContext, condition: string): boolean {
  return Boolean(
    context.query?.targetHasCondition
      ? context.query.targetHasCondition(condition, context.time, context.runtime)
      : targetHasCondition(context.config || {}, condition, context.time, context.runtime)
  );
}

/** Counts distinct configured or live target conditions through the canonical combat query when available. */
export function targetConditionCount(context: Gw2ModifierContext): number {
  const names = new Set([
    ...CANONICAL_TARGET_CONDITIONS,
    ...Object.keys(context.config?.target?.conditions || {}).map(canonicalTargetConditionName),
    ...[...(context.runtime?.conditionState?.keys?.() || [])].map(canonicalTargetConditionName)
  ]);
  return [...names].filter((condition) => targetConditionActive(context, condition)).length;
}

/** Reads target Vulnerability through the shared combat-query stack calculation. */
export function vulnerabilityStacks(context: Gw2ModifierContext): number {
  return Number(
    context.query?.targetConditionStacks?.('Vulnerability', context.time, context.runtime) ??
      context.query?.vulnerabilityStacksAt?.(context.time, context.runtime) ??
      0
  );
}
