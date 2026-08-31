/**
 * Shared Elementalist emission helpers for the scheduler phase.
 *
 * Balance-profile-driven buff, condition, proc, and aura emitters plus the small
 * catalog and state lookups they depend on. Skill and trait handlers depend on
 * this module; it must not depend on them.
 */
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { balanceProfileEffectFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent, Skill } from '#gw2/platform/engine/types.js';
import type { ElementalistSchedulerContext } from '#gw2/content/professions/elementalist/types.js';
import type { ElementalistAuraState, ElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import { ETCHING_CHAINS } from '#gw2/content/professions/elementalist/core/constants.js';

/** Reads the weapon a skill belongs to, tolerating either catalog field spelling. */
export function skillWeapon(skill: Skill): string {
  return String(skill.weapon || skill.skillWeapon || '');
}

/** Finds the spear etching chain a skill name participates in, if any. */
export function etchingChain(name: string) {
  return ETCHING_CHAINS.find((chain) => name === chain.etching || name === chain.lesser || name === chain.full);
}

/** Returns the tracked application of one aura still active at `at`, or null. */
export function activeAura(state: ElementalistCoreState, aura: string, at: number): ElementalistAuraState | null {
  return state.activeAuras.find((candidate) => candidate.type === aura && candidate.expiresAt > at) || null;
}

/** Reports whether `at` lies inside the configured combat window; gates trait effects that only fire in combat. */
export function combatStarted(context: ElementalistSchedulerContext, at: number): boolean {
  return !context.hasExplicitCombatStart || (context.combatStartTime != null && at >= context.combatStartTime);
}

// Resolve procedural sources through the catalog so canonical emitters can
// apply skill policy without hiding event construction behind another emitter.
export function elementalistEventSkill(
  context: ElementalistSchedulerContext,
  source: string,
  sourceId: Skill['id']
): Skill {
  return (
    context.catalog.skillsById.get(sourceId) ||
    context.catalog.skillsByName.get(source) ||
    ({ id: sourceId, name: source } as Skill)
  );
}

/** Collects already-scheduled buff events of one kind whose window covers `at`. */
export function activeBuffEvents(context: ElementalistSchedulerContext, kind: string, at: number): SimulationEvent[] {
  const normalized = kind.toLowerCase();
  return context.events.filter(
    (event) =>
      event.type === 'buff' &&
      String(event.kind || '').toLowerCase() === normalized &&
      event.at <= at &&
      event.at + Number(event.duration || 0) > at
  );
}

/** Emits a boon whose kind, stacks, and duration come from the balance profile, falling back to the supplied literals. */
export function emitProfiledBuff(
  context: ElementalistSchedulerContext,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  fallbackKind: string,
  fallbackStacks: number,
  fallbackDuration: number,
  source: string,
  sourceId: Skill['id'],
  priority = 0,
  recipients: 'self' | 'party' = 'self'
): void {
  const effect = balanceProfileEffectFromContext(context, profileId, 'boon', 0, effectName);
  const kind = String(effect?.boon || fallbackKind).toLowerCase();
  emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
    at,
    source,
    sourceId,
    actorType: 'player',
    kind,
    stacks: Number(effect?.stacks ?? fallbackStacks),
    duration: Number(effect?.duration ?? fallbackDuration),
    skillName: source,
    priority,
    ...(recipients === 'party' ? { recipients: 'party', maximumRecipients: 5 } : {})
  });
}

/** Emits a condition whose type, stacks, and duration come from the balance profile, falling back to the supplied literals. */
export function emitProfiledCondition(
  context: ElementalistSchedulerContext,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  fallbackCondition: string,
  fallbackStacks: number,
  fallbackDuration: number,
  source: string,
  sourceId: Skill['id']
): void {
  const effect = balanceProfileEffectFromContext(context, profileId, 'condition', 0, effectName);
  emitSkillCondition(context, elementalistEventSkill(context, source, sourceId), {
    at,
    source,
    sourceId,
    actorType: 'player',
    condition: String(effect?.condition || fallbackCondition),
    stacks: Number(effect?.stacks ?? fallbackStacks),
    duration: Number(effect?.duration ?? fallbackDuration),
    skillName: source
  });
}

// Emit a consistently attributed proc marker for skill- and trait-owned
// Elementalist effects without duplicating packet construction at call sites.
export function emitElementalistProc(
  context: ElementalistSchedulerContext,
  {
    at,
    name,
    procType,
    sourceId,
    sourceSkill = '',
    detail = '',
    icon = ''
  }: {
    at: number;
    name: string;
    procType: 'trait' | 'skill';
    sourceId: Skill['id'];
    sourceSkill?: string;
    detail?: string;
    icon?: string;
  }
): void {
  context.emit({
    type: 'proc',
    at,
    source: name,
    sourceId,
    actorType: 'effect',
    name,
    skillName: name,
    procType,
    sourceSkill,
    detail,
    icon
  });
}

export interface ElementalistAuraApplication {
  readonly at: number;
  readonly aura: string;
  readonly duration: number;
  readonly skillName: string;
  readonly sourceId: Skill['id'];
  readonly priority?: number;
}

export type ElementalistAuraApplier = (
  context: ElementalistSchedulerContext,
  application: ElementalistAuraApplication
) => void;

// Register one finalized aura window and emit its canonical event; trait dispatchers adjust and react before calling in.
export function emitElementalistAura(
  context: ElementalistSchedulerContext,
  { at, aura, duration, skillName, sourceId, priority = 0 }: ElementalistAuraApplication
): void {
  const state = professionCoreState(context);
  const auraState: ElementalistAuraState = {
    type: aura,
    appliedAt: at,
    expiresAt: at + duration,
    skillName
  };
  state.activeAuras.push(auraState);
  context.emit({
    type: 'elementalist.aura',
    at,
    source: skillName,
    sourceId,
    actorType: 'effect',
    skillName,
    aura,
    duration,
    ...(priority ? { priority } : {})
  });
}
