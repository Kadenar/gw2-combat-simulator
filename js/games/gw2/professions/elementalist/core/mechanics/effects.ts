import type {
  AnnouncementEmission,
  EffectDelivery,
  ProfileEmission
} from '#gw2/platform/simulation/effect-emission.js';
/**
 * Elementalist payload selection and attribution for the shared emission service.
 *
 * Balance-profile-driven buff, condition, and announcement request builders plus the small
 * catalog and state lookups they depend on. Skill and trait handlers depend on
 * this module; it must not depend on them.
 */
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import { ETCHING_CHAINS } from '#gw2/professions/elementalist/core/constants.js';
import type { ElementalistAuraState, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
/** Reads the weapon a skill belongs to, tolerating either catalog field spelling. */
export function skillWeapon(skill: Skill): string {
  return skill.weapon || skill.skillWeapon || '';
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
export function combatStarted(context: ElementalistRuntime, at: number): boolean {
  return (
    context.combatActive &&
    (!context.hasExplicitCombatStart || (context.combatStartTime != null && at >= context.combatStartTime))
  );
}

// Resolve procedural sources through the catalog so request attribution retains canonical skill policy.
export function elementalistEventSkill(context: ElementalistRuntime, source: string, sourceId: Skill['id']): Skill {
  return context.helpers.skillsById.get(sourceId) || { id: sourceId, name: source };
}

/** Select a surviving profile boon; the shared service owns expansion and live duration. */
export function elementalistProfiledBuffRequest(
  context: ElementalistRuntime,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  source: string,
  sourceId: Skill['id'],
  priority = 0,
  recipients: 'self' | 'party' = 'self',
  emissionCast?: EffectDelivery['cast']
): ProfileEmission {
  const profile = requireBalanceProfileFromContext(context, profileId);
  const effect = requireEffect(profile, 'boon', effectName);
  const skill = elementalistEventSkill(context, source, sourceId);
  return {
    kind: 'profile',
    profile,
    effects: effect ? [effect] : [],
    at,
    fullEnd: at,
    cast: emissionCast,
    priority,
    attribution: {
      source: profile.profileKind === 'trait' ? 'Trait' : source,
      sourceId: profile.profileKind === 'trait' ? profile.id : sourceId,
      actorType: 'player',
      skillId: skill.id,
      skillName: source
    },
    transform: (event) => ({
      ...event,
      name: source,
      priority,
      ...(recipients === 'party' ? { audience: { recipients: 'party', maximumRecipients: 5 } } : {})
    })
  };
}

/** Select the optional condition payload without manufacturing removed balance effects. */
export function elementalistProfiledConditionRequest(
  context: ElementalistRuntime,
  at: number,
  profileId: Skill['id'],
  effectName: string,
  source: string,
  sourceId: Skill['id'],
  triggeredBy = '',
  emissionCast?: EffectDelivery['cast']
): ProfileEmission {
  const profile = requireBalanceProfileFromContext(context, profileId);
  const effect = requireEffect(profile, 'condition', effectName);
  const skill = elementalistEventSkill(context, source, sourceId);
  return {
    kind: 'profile',
    profile,
    effects: effect ? [effect] : [],
    at,
    fullEnd: at,
    cast: emissionCast,
    attribution: { source, sourceId, actorType: 'player', skillId: skill.id, skillName: source, triggeredBy },
    transform: (event) => ({ ...event, name: source + ' — ' + event.condition })
  };
}

/** Announcements carry display identity independently from combat packets and strength rolls. */
export function elementalistAnnouncement({
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
}): AnnouncementEmission {
  return {
    kind: 'announcement',
    log: true,
    attribution: { source: procType === 'trait' ? 'Trait' : name, sourceId, actorType: 'effect', skillName: name },
    announcement: { type: procType, name, at, sourceSkill, detail, icon }
  };
}

export interface ElementalistAuraApplication {
  readonly at: number;
  readonly aura: string;
  readonly duration: number;
  readonly skillName: string;
  readonly sourceId: Skill['id'];
  readonly priority?: number;
}
export type ElementalistAuraApplier = (context: ElementalistRuntime, application: ElementalistAuraApplication) => void;
