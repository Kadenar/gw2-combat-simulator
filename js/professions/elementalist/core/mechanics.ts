import { hasTrait as hasGw2Trait } from '../../../platform/gw2/combat/state/traits.js';
import { gw2SchedulerBoonDuration } from '../../../platform/gw2/scheduler/policy.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { SimulationEvent, Skill } from '../../../platform/engine/types.js';
import type { ElementalistSchedulerContext } from '../types.js';
import type { ElementalistAuraState, ElementalistCoreState } from './state.js';
import { ETCHING_CHAINS } from './constants.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceEffect,
  elementalistBalanceValue
} from './profiles.js';

function hasTrait(context: unknown, trait: string): boolean {
  return hasGw2Trait(context as never, trait);
}

export function skillWeapon(skill: Skill): string {
  return String(skill.weapon || skill.skillWeapon || '');
}

export function etchingChain(name: string) {
  return ETCHING_CHAINS.find((chain) => name === chain.etching || name === chain.lesser || name === chain.full);
}

export function activeAura(state: ElementalistCoreState, aura: string, at: number): ElementalistAuraState | null {
  return state.activeAuras.find((candidate) => candidate.type === aura && candidate.expiresAt > at) || null;
}

export function combatStarted(context: ElementalistSchedulerContext, at: number): boolean {
  return !context.hasExplicitCombatStart || (context.combatStartTime != null && at >= context.combatStartTime);
}

export function emitElementalistBuff(
  context: ElementalistSchedulerContext,
  at: number,
  kind: string,
  stacks: number,
  duration: number,
  source: string,
  sourceId: Skill['id'],
  priority = 0,
  recipients: 'self' | 'party' = 'self'
): void {
  const normalizedKind = kind.toLowerCase();
  const sourceSkill =
    context.catalog.skillsById.get(sourceId) ||
    context.catalog.skillsByName.get(source) ||
    ({ id: sourceId, name: source } as Skill);
  const adjustedDuration = gw2SchedulerBoonDuration(context, sourceSkill, normalizedKind, duration);
  context.emit({
    type: 'buff',
    at,
    source,
    sourceId,
    actorType: 'player',
    kind: normalizedKind,
    stacks,
    duration: adjustedDuration,
    skillName: source,
    priority,
    ...(recipients === 'party' ? { recipients: 'party', maximumRecipients: 5 } : {})
  });
}

export const emitBuff = emitElementalistBuff;

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

export function emitCondition(
  context: ElementalistSchedulerContext,
  at: number,
  condition: string,
  stacks: number,
  duration: number,
  source: string,
  sourceId: Skill['id']
): void {
  context.emit({
    type: 'condition',
    at,
    source,
    sourceId,
    actorType: 'player',
    condition,
    stacks,
    duration,
    skillName: source
  });
}

export function profiledEffect(context: unknown, profileId: Skill['id'], type: string, name?: string) {
  return elementalistBalanceEffect(context, profileId, type, name);
}

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
  const effect = profiledEffect(context, profileId, 'boon', effectName);
  emitBuff(
    context,
    at,
    String(effect?.boon || fallbackKind),
    Number(effect?.stacks ?? fallbackStacks),
    Number(effect?.duration ?? fallbackDuration),
    source,
    sourceId,
    priority,
    recipients
  );
}

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
  const effect = profiledEffect(context, profileId, 'condition', effectName);
  emitCondition(
    context,
    at,
    String(effect?.condition || fallbackCondition),
    Number(effect?.stacks ?? fallbackStacks),
    Number(effect?.duration ?? fallbackDuration),
    source,
    sourceId
  );
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

// Register the adjusted aura window first, then emit its canonical event and
// combat-only trait boons so every consumer observes one shared application.
export function applyElementalistAura(
  context: ElementalistSchedulerContext,
  {
    at,
    aura,
    duration,
    skillName,
    sourceId,
    priority = 0
  }: {
    at: number;
    aura: string;
    duration: number;
    skillName: string;
    sourceId: Skill['id'];
    priority?: number;
  }
): void {
  const state = professionCoreState(context);
  const adjustedDuration = hasTrait(context, 'Smothering Auras')
    ? duration * elementalistBalanceValue(context, PROFILE.smotheringAuras, 'durationMultiplier', 1.33)
    : duration;
  const auraState: ElementalistAuraState = {
    type: aura,
    appliedAt: at,
    expiresAt: at + adjustedDuration,
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
    duration: adjustedDuration,
    ...(priority ? { priority } : {})
  });
  if (!combatStarted(context, at)) return;
  if (hasTrait(context, "Zephyr's Boon")) {
    emitProfiledBuff(context, at, PROFILE.zephyrsBoon, 'Fury', 'Fury', 1, 5, skillName, sourceId);
    emitProfiledBuff(context, at, PROFILE.zephyrsBoon, 'Swiftness', 'Swiftness', 1, 5, skillName, sourceId);
  }

  if (hasTrait(context, 'Elemental Shielding')) {
    emitProfiledBuff(context, at, PROFILE.elementalShielding, 'Protection', 'Protection', 1, 3, skillName, sourceId);
  }
}
