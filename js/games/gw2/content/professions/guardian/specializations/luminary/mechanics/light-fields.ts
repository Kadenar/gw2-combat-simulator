import { EPSILON } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import { guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { radiantWeaponImpactAt } from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID } from '#gw2/content/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/content/professions/guardian/specializations/luminary/state.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  GuardianCastContext,
  GuardianLuminaryState,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill
} from '#gw2/content/professions/guardian/types.js';

const RADIANT_VIRTUE_IDS: ReadonlySet<SkillId> = new Set([
  GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
  GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
  GUARDIAN_SKILL_IDS.RADIANT_COURAGE
]);

function lightAuraActive(state: GuardianLuminaryState, at: number, epsilon: number): boolean {
  return Number(state.lightAuraUntil || 0) > at + epsilon;
}

// Resolver operations keep overlapping casts in combat-time order instead of scheduler order.
function emitLightAuraOperation(
  context: GuardianCastContext | GuardianSchedulerContext,
  type: string,
  at: number,
  skill: Pick<GuardianSkill, 'id' | 'name'>,
  priority: number,
  extra: Readonly<Record<string, unknown>> = {}
): void {
  context.emit({
    type,
    at,
    priority,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    sourceSkill: skill.name,
    ...extra
  });
}

function detonateLightAura(context: GuardianResolverContext, event: GuardianResolverEvent): boolean {
  const state = luminaryState.from(context);
  const epsilon = Number(context.epsilon ?? EPSILON);
  if (!lightAuraActive(state, event.at, epsilon)) return false;
  const strike = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.sovereignOfLight), 'strike');
  state.lightAuraUntil = 0;
  enqueueOrdered(
    context.queue,
    buildGuardianStrike({
      at: event.at,
      priority: -15,
      sourceId: GUARDIAN_SKILL_IDS.SOVEREIGN_OF_LIGHT_DAMAGE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.SOVEREIGN_OF_LIGHT_DAMAGE,
      skillName: 'Sovereign of Light',
      name: 'Sovereign of Light',
      coefficient: Number(strike?.coefficient || 1.5),
      skillWeapon: 'Unequipped',
      triggeredBy: event.sourceSkill || event.skillName,
      offTarget: event.offTarget === true
    })
  );
  context.recordProc(
    'trait',
    'Sovereign of Light',
    event.at,
    event.sourceSkill || event.skillName,
    'Light aura detonated',
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT)
  );
  return true;
}

export function handleLightAuraGrant(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  if (
    event.refreshOnly !== true &&
    lightAuraActive(state, event.at, Number(context.epsilon ?? EPSILON)) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT)
  ) {
    detonateLightAura(context, event);
  }

  state.lightAuraUntil =
    event.at +
    Number(
      event.duration ||
        balanceProfileEffect(balanceProfileFromContext(context, PROFILE.lightAura), 'buff')?.duration ||
        4
    );
}

export function handleLightAuraDetonate(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  detonateLightAura(context, event);
}

function isLuminaryDetonator(skill: GuardianSkill): boolean {
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) return false;
  return Boolean(
    RADIANT_VIRTUE_IDS.has(skill.id) ||
    skill.radiantForgeSkill === true ||
    (skill.specialization === 'Luminary' && skill.categories?.includes('Stance'))
  );
}

/** Schedules light-aura and light-field operations caused by one Luminary cast. */
export function processLuminaryLightFields(context: GuardianCastContext, skill: GuardianSkill): void {
  const activationAt = context.start;
  const impactAt = radiantWeaponImpactAt(context, skill);
  const sovereign = hasTrait(context, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT);
  if (sovereign && isLuminaryDetonator(skill)) {
    const detonatesOnImpact =
      skill.radiantForgeSkill === true ||
      skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE ||
      skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE;
    emitLightAuraOperation(
      context,
      'guardian.luminary.light-aura-detonate',
      detonatesOnImpact ? impactAt : activationAt,
      skill,
      -20
    );
  }

  const virtueOne = skill.categories?.includes('Virtue') && String(skill.slot) === 'Profession_1';
  const enteringRadiantForge = skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE;
  const grantsImmediately =
    skill.id === LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID ||
    skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE ||
    skill.id === GUARDIAN_SKILL_IDS.RADIANT_RESOLVE ||
    (enteringRadiantForge && sovereign) ||
    (virtueOne && hasTrait(context, GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND));
  if (grantsImmediately) {
    emitLightAuraOperation(context, 'guardian.luminary.light-aura-grant', activationAt, skill, -10, {
      refreshOnly: enteringRadiantForge
    });
  }

  if (virtueOne && hasTrait(context, GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND)) {
    const blind = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.justiceIsBlind), 'blind');
    context.emit({
      type: 'blind',
      at: activationAt,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      actorType: 'effect',
      skillId: GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      skillName: 'Justice is Blind',
      triggeredBy: skill.name,
      duration: Number(blind?.duration || 3)
    });
  }
}

/** Tracks only successful combo outcomes, so an unbound finisher cannot grant Luminary Light Aura. */
export function observeLuminaryLightFields(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (event.type === 'aura' && event.aura === 'Light Aura') {
    emitLightAuraOperation(
      context,
      'guardian.luminary.light-aura-grant',
      event.at,
      { id: event.skillId ?? event.sourceId, name: event.skillName || event.name || 'Light Aura' },
      -15,
      { duration: Number(event.duration || 5) }
    );
  }

  if (event.type === 'combo' && event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER) {
    emitLightAuraOperation(
      context,
      'guardian.luminary.light-aura-grant',
      event.at,
      { id: event.skillId, name: event.skillName || 'Dazzling Hammer' },
      -15,
      { duration: 4 }
    );
  }
}
