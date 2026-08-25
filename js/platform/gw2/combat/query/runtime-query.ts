import { clamp } from '../numeric.js';
import { CANONICAL_TARGET_CONDITIONS, canonicalTargetConditionName, targetHasCondition } from '../state/targets.js';
import type { Skill, SkillId } from '../../../engine/types.js';
import type { Gw2ModifierContext } from '../modifiers/types.js';
import type { Gw2TimedBuffApplication } from '../state/types.js';

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

function selectedSkillName(value: unknown): string {
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { readonly name?: unknown }).name ?? value);
  }

  return String(value);
}

/** Resolves the current event's catalog skill across every supported modifier-context skill-id path. */
export function eventSkill<TSkill extends Skill>(context: Gw2ModifierContext): TSkill | undefined {
  const event = context.event as RuntimeSkillEvent | null | undefined;
  const skillId = event?.skillId ?? event?.application?.skillId ?? (context.skillId as SkillId | null | undefined);
  if (skillId == null) return undefined;
  const profession = context.profession as RuntimeSkillCatalog<TSkill> | undefined;
  return profession?.catalog?.skillsById?.get(skillId);
}

/** Normalizes array and slot-record loadouts, including legacy embedded skill objects, into skill names. */
export function selectedSkillNames(context: Gw2ModifierContext): ReadonlySet<string> {
  const selected = context.config?.selectedSkills;
  const values = Array.isArray(selected)
    ? selected
    : selected && typeof selected === 'object'
      ? Object.values(selected as Readonly<Record<string, unknown>>)
      : [];
  return new Set(values.map(selectedSkillName));
}

/** Tests a selected skill name without exposing the persisted loadout's array-or-record shape. */
export function hasSelectedSkill(context: Gw2ModifierContext, name: string): boolean {
  return selectedSkillNames(context).has(name);
}

/** Uses explicit target-health assumptions first, then derives health from resolved damage totals. */
export function targetHealthFraction(context: Gw2ModifierContext): number {
  const configured = Number(context.config?.targetHealthFraction ?? context.config?.target?.healthFraction);
  if (Number.isFinite(configured)) return clamp(configured, 0, 1);

  const maximum = Number(context.config?.target?.health ?? 0);
  if (!(maximum > 0)) return 1;
  const totals = context.runtime?.totals as { readonly strike?: number; readonly condition?: number } | undefined;
  const damage = Number(totals?.strike || 0) + Number(totals?.condition || 0);
  return clamp(1 - damage / maximum, 0, 1);
}

/** Normalizes the configured player-health assumption to the valid fraction range. */
export function playerHealthFraction(context: Gw2ModifierContext): number {
  return clamp(Number(context.config?.playerHealthFraction ?? 1), 0, 1);
}

/** Checks permanent, scheduled, and live player boon sources in runtime-precedence order. */
export function boonActive(context: Gw2ModifierContext, boon: string): boolean {
  if (context.config?.boons?.[boon]) return true;
  if (context.timeline?.timedActive(boon, context.time)) return true;
  return (context.runtime?.boons?.get(boon) || []).some(
    (application) =>
      application.affectsSelf !== false && application.at <= context.time && application.expiresAt > context.time
  );
}

/** Adds configured permanent stacks to the active live or scheduler boon applications. */
export function activeBoonStacks(context: Gw2ModifierContext, boon: string, maximum = 25): number {
  const permanent = context.config?.boons?.[boon];
  const base = permanent === true ? 1 : Number(permanent || 0);
  const schedulerState = context.state as { readonly boons?: Map<string, Gw2TimedBuffApplication[]> } | undefined;
  const boons = context.runtime?.boons ?? schedulerState?.boons;
  const dynamic = (boons?.get(boon) || [])
    .filter((application) => application.at <= context.time && application.expiresAt > context.time)
    .reduce((sum, application) => sum + Number(application.stacks || 1), 0);
  return clamp(base + dynamic, 0, maximum);
}

/** Counts distinct configured or live target conditions through the canonical combat query when available. */
export function targetConditionCount(context: Gw2ModifierContext): number {
  const names = new Set([
    ...CANONICAL_TARGET_CONDITIONS,
    ...Object.keys(context.config?.target?.conditions || {}).map(canonicalTargetConditionName),
    ...[...(context.runtime?.conditionState?.keys?.() || [])].map(canonicalTargetConditionName)
  ]);
  return [...names].filter((condition) =>
    context.query?.targetHasCondition
      ? context.query.targetHasCondition(condition, context.time, context.runtime)
      : targetHasCondition(context.config || {}, condition, context.time, context.runtime)
  ).length;
}

/** Reads target Vulnerability through the shared combat-query stack calculation. */
export function vulnerabilityStacks(context: Gw2ModifierContext): number {
  return Number(
    context.query?.targetConditionStacks?.('Vulnerability', context.time, context.runtime) ??
      context.query?.vulnerabilityStacksAt?.(context.time, context.runtime) ??
      0
  );
}
