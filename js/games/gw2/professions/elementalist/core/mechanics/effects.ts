/**
 * Shared Elementalist emission helpers for the scheduler phase.
 *
 * Balance-profile-driven buff, condition, proc, and aura emitters plus the small
 * catalog and state lookups they depend on. Skill and trait handlers depend on
 * this module; it must not depend on them.
 */
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { requireEffectFromContext } from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { ElementalistSchedulerContext } from '#gw2/professions/elementalist/types.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import type { ElementalistAuraState, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';

/** Reads the weapon a skill belongs to, tolerating either catalog field spelling. */
export function skillWeapon(skill: Skill): string {
  return String(skill.weapon || skill.skillWeapon || '');
}

/** Finds the spear etching chain a stable skill ID participates in, if any. */
export function etchingChain(skillId: Skill['id']) {
  const id = Number(skillId);
  return ETCHING_CHAINS.find((chain) => id === chain.etchingId || id === chain.lesserId || id === chain.fullId);
}

/** Returns the tracked application of one aura still active at `at`, or null. */
export function activeAura(state: ElementalistCoreState, aura: string, at: number): ElementalistAuraState | null {
  return state.activeAuras.find((candidate) => candidate.type === aura && candidate.expiresAt > at) || null;
}

/** Gates combat-only traits on combat already observed, including runs without an explicit start marker. */
export function combatStarted(context: ElementalistSchedulerContext, at: number): boolean {
  return (
    (context.schedulerPolicy as Gw2SchedulerPolicy).isCombatActive() &&
    (!context.hasExplicitCombatStart || (context.combatStartTime != null && at >= context.combatStartTime))
  );
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
      gw2EffectExpiresAt(event.at, Number(event.duration || 0)) > at
  );
}

/** Emit only the surviving named boon, using the selected profile's validated values. */
export function emitProfiledBuff(
  context: ElementalistSchedulerContext,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  source: string,
  sourceId: Skill['id'],
  priority = 0,
  recipients: 'self' | 'party' = 'self'
): void {
  const effect = requireEffectFromContext(context, 'balance-profile', profileId, 'boon', effectName);
  if (!effect) return;
  const kind = String(effect.boon).toLowerCase();

  emitSkillBuff(context, elementalistEventSkill(context, source, sourceId), {
    at,
    source,
    sourceId,
    actorType: 'player',
    kind,
    stacks: Number(effect.stacks),
    duration: Number(effect.duration),
    skillName: source,
    priority,
    ...(recipients === 'party' ? { audience: { recipients: 'party' as const, maximumRecipients: 5 } } : {})
  });
}

/** A removed condition emits nothing; surviving Burning still exposes each stack to relics. */
export function emitProfiledCondition(
  context: ElementalistSchedulerContext,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  source: string,
  sourceId: Skill['id'],
  triggeredBy = ''
): boolean {
  const effect = requireEffectFromContext(context, 'balance-profile', profileId, 'condition', effectName);
  if (!effect) return false;
  const condition = String(effect.condition);
  const stacks = Number(effect.stacks);
  // One-time Burning procs expose each stack to relics; other conditions keep their original packet.
  const applications = condition === 'Burning' ? Math.ceil(stacks) : 1;
  for (let index = 0; index < applications; index += 1) {
    emitSkillCondition(context, {
      skill: elementalistEventSkill(context, source, sourceId),
      at,
      source,
      sourceId,
      condition,
      stacks: condition === 'Burning' ? Math.min(1, stacks - index) : stacks,
      duration: Number(effect.duration),
      skillName: source,
      // Preserve an explicit trigger so resolved condition ticks can be attributed to their originating skill.
      triggeredBy
    });
  }

  return applications > 0;
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
