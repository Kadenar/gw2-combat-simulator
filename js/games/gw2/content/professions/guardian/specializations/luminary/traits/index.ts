import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { EPSILON } from '#kernel/core/clock.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { luminaryState } from '#gw2/content/professions/guardian/specializations/luminary/state.js';
import {
  LUMINARY_INITIAL_LIGHT_AURA_SKILL_ID,
  LUMINARY_INITIAL_STATE_SKILL_IDS,
  PIERCING_STANCE_IMPACT_MS
} from '#gw2/content/professions/guardian/specializations/luminary/skills/index.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { buildGuardianStrike } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import { reactToJusticeHitWithOptions } from '#gw2/content/professions/guardian/core/mechanics/virtues.js';
import { radiantWeaponImpactAt } from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';

import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/luminary/profiles.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianLuminaryState,
  GuardianVirtue
} from '#gw2/content/professions/guardian/types.js';

const RADIANT_WEAPON_SKILLS = Object.freeze({
  hammer: GUARDIAN_SKILL_IDS.DAZZLING_HAMMER,
  staff: GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
  blade: GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
  shield: GUARDIAN_SKILL_IDS.RADIANT_BULWARK
});
const RADIANT_VIRTUE_IDS: ReadonlySet<SkillId> = new Set([
  GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
  GUARDIAN_SKILL_IDS.RADIANT_RESOLVE,
  GUARDIAN_SKILL_IDS.RADIANT_COURAGE
]);

function lightAuraActive(state: GuardianLuminaryState, at: number, epsilon: number): boolean {
  return Number(state.lightAuraUntil || 0) > at + epsilon;
}

function activeLightField(state: GuardianLuminaryState, at: number, epsilon: number): boolean {
  // Expired fields are pruned eagerly here rather than on a separate sweep so
  // the array doesn't grow unbounded across a long rotation.
  state.lightFields = (state.lightFields || []).filter((field) => field.endsAt > at + epsilon);
  return state.lightFields.some((field) => field.startsAt <= at + epsilon && field.endsAt > at + epsilon);
}

function addLightField(state: GuardianLuminaryState, startsAt: number, duration: number): void {
  state.lightFields ||= [];
  state.lightFields.push({ startsAt, endsAt: startsAt + duration });
}

// Aura operations are replayed by the resolver so overlapping casts mutate
// aura state in combat-time order rather than rotation scheduling order.
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
      triggeredBy: event.sourceSkill || event.skillName
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

export function handleLightFieldStart(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  addLightField(luminaryState.from(context), event.at, Number(event.duration || 0));
}

export function handleLightFinisher(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  if (!activeLightField(luminaryState.from(context), event.at, Number(context.epsilon ?? EPSILON))) return;
  handleLightAuraGrant(context, { ...event, duration: 5 });
}

function isLuminaryDetonator(skill: GuardianSkill): boolean {
  // Glaring Burst is excluded: it fires from inside the forge and emitting a
  // detonate there would consume the aura before a leap or other finisher can
  // land in the same light field.
  if (skill.id === GUARDIAN_SKILL_IDS.GLARING_BURST) return false;
  return Boolean(
    RADIANT_VIRTUE_IDS.has(skill.id) ||
    skill.radiantForgeSkill === true ||
    (skill.specialization === 'Luminary' && skill.categories?.includes('Stance'))
  );
}

function isLightLeap(skill: GuardianSkill): boolean {
  return [GUARDIAN_SKILL_IDS.LEAP_OF_FAITH, GUARDIAN_SKILL_IDS.DARING_ADVANCE, GUARDIAN_SKILL_IDS.GLEAMING_BLADE].some(
    (skillId) => skillId === skill.id
  );
}

function processLightAuraAndFields(context: GuardianCastContext, skill: GuardianSkill): void {
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
      // Forge entry applies the trait's aura itself, so it refreshes rather
      // than consuming an aura granted by another source at the same instant.
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

  if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    emitLightAuraOperation(context, 'guardian.luminary.light-field-start', impactAt, skill, -30, { duration: 5 });
  }

  if (isLightLeap(skill) || skill.id === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER) {
    emitLightAuraOperation(context, 'guardian.luminary.light-finisher', impactAt, skill, -15);
  }
}

function processStanceDamageBuffs(context: GuardianCastContext, skill: GuardianSkill): void {
  const state = luminaryState.from(context);
  if (skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE) {
    const runtimeCastMs = Math.max(0, (context.fullEnd - context.start) * 1000);
    // Project the Quickness-authored buff timestamp through the same policy as
    // the stance packets so its damage bonus begins when the logged impact lands.
    const at =
      context.start + projectCastRelativeEffectTimingMs(skill, runtimeCastMs, PIERCING_STANCE_IMPACT_MS) / 1000;
    if (at > context.effectiveEnd + context.epsilon) return;
    const wasActive = Number(state.piercingStanceUntil || 0) > at + context.epsilon;
    // Stack duration additively when already active rather than resetting the
    // expiry, matching the in-game stacking behavior.
    state.piercingStanceUntil = wasActive ? state.piercingStanceUntil + 8 : at + 8;
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-piercing-stance',
      duration: state.piercingStanceUntil - at,
      stacks: 1
    });
  } else if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    // The target damage bonus begins with the logged tether application at impact,
    // rather than at the end of the one-second animation.
    emitSkillBuff(context, skill, {
      at: radiantWeaponImpactAt(context, skill),
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-daring-advance',
      duration: 8,
      stacks: 1
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE) {
    // Both events are scheduled at cast time so the window boundaries are fixed
    // even if other events arrive out of order during resolver playback.
    for (const { type, at } of [
      { type: 'guardian.effulgent-activated', at: context.start },
      { type: 'guardian.effulgent-detonate', at: context.start + 4 }
    ]) {
      context.emit({
        type,
        at,
        priority: type === 'guardian.effulgent-activated' ? -40 : 0,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }
  }
}

/** Replays only the remaining duration ArcDPS observed at the EVTC boundary. */
function replayInitialLuminaryState(context: GuardianCastContext, skill: GuardianSkill): void {
  const duration = Math.max(0, Number(context.command.initialStateDurationMs || 0)) / 1000;
  if (!(duration > 0)) return;
  const common = {
    at: context.start,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'player' as const,
    duration,
    stacks: 1
  };
  if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.resolution) {
    emitSkillBuff(context, skill, { ...common, kind: 'resolution' });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.empoweredArmaments) {
    luminaryState.from(context).empoweredArmamentsUntil = context.start + duration;
    emitSkillBuff(context, skill, { ...common, kind: 'guardian-empowered-armaments' });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.radiantHammer) {
    emitSkillBuff(context, skill, {
      ...common,
      kind: 'guardian-radiant-armaments',
      metadata: { radiantWeapon: 'hammer' }
    });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.claw) {
    // A zero-duration control hydrates only the selected Claw relic; it cannot disable the target.
    context.emit({
      ...common,
      type: 'control',
      controlKind: 'initial-state',
      duration: 0,
      initialStateDuration: duration,
      skillId: skill.id,
      skillName: skill.name
    });
  }
}

function reduceVirtueCooldowns(context: GuardianSchedulerContext, at: number, reduction: number): void {
  for (const skillId of RADIANT_VIRTUE_IDS) {
    const readyAt = Number(context.state.cooldowns.get(skillId) || 0);
    if (!(readyAt > at + context.epsilon)) continue;
    const reduced = Math.max(at, readyAt - reduction);
    if (reduced <= at + context.epsilon) {
      context.state.cooldowns.delete(skillId);
    } else {
      context.state.cooldowns.set(skillId, reduced);
    }
  }
}

export function handleRadiantWeaponEquipped(context: GuardianCastContext, skill: GuardianSkill): void {
  // Flip skills share the same skill ID as their parent; skip them so traits
  // only fire once per equip, not again on subsequent autoattack flips.
  if (!skill.radiantWeapon || skill.flipParentId != null) return;
  const at = context.effectiveEnd + 0.001;
  const state = luminaryState.from(context);
  const weapon = skill.radiantWeapon;
  state.radiantWeaponsUsed[weapon] = true;
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)) {
    const armaments = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.radiantArmaments), 'buff');
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-radiant-armaments',
      duration: Number(armaments?.duration || 10),
      stacks: 1,
      metadata: { radiantWeapon: weapon }
    });
    emitGuardianProc(context, {
      name: 'Radiant Armaments',
      at,
      sourceSkill: skill.name,
      detail: weapon === 'hammer' ? 'Radiant hammer: +7% strike damage' : `${weapon}: hammer bonus removed`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS)
    });
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)) {
    const profile = balanceProfileFromContext(context, PROFILE.empoweredArmaments);
    const duration = Number(profile?.resourceGain || 6);
    const maximumDuration = Number(profile?.maximumStacks || 20);
    const wasActive = Number(state.empoweredArmamentsUntil || 0) > at + context.epsilon;
    // Duration stacks additively up to a 20 s cap; the cap prevents the buff
    // from extending forever if many weapons are equipped in quick succession.
    state.empoweredArmamentsUntil = wasActive
      ? Math.min(at + maximumDuration, state.empoweredArmamentsUntil + duration)
      : at + duration;
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-empowered-armaments',
      duration: state.empoweredArmamentsUntil - at,
      stacks: 1
    });
    emitGuardianProc(context, {
      name: 'Empowered Armaments',
      at,
      sourceSkill: skill.name,
      detail: wasActive ? 'refreshed' : 'triggered',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS)
    });
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)) {
    const reduction = Number(
      balanceProfileFromContext(context, PROFILE.illuminatingInspiration)?.rechargeReduction || 4
    );
    reduceVirtueCooldowns(context, at, reduction);
    emitGuardianProc(context, {
      name: 'Illuminating Inspiration',
      at,
      sourceSkill: skill.name,
      detail: `Virtue recharges reduced by ${reduction} seconds`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION)
    });
  }
}

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  if (!RADIANT_VIRTUE_IDS.has(skill.id)) return null;
  // Virtues are identified by the trailing digit in their slot name
  // ("Profession_1" → justice, "Profession_2" → resolve, "Profession_3" → courage)
  // rather than by skill ID, because each virtue has multiple IDs across game patches.
  const slot = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
  return ([null, 'justice', 'resolve', 'courage'] as const)[slot] || null;
}

function resetRadiantWeaponCooldowns(context: GuardianSchedulerContext, virtue: GuardianVirtue): boolean {
  const ids =
    virtue === 'justice'
      ? [RADIANT_WEAPON_SKILLS.hammer]
      : virtue === 'resolve'
        ? [RADIANT_WEAPON_SKILLS.staff]
        : [RADIANT_WEAPON_SKILLS.blade, RADIANT_WEAPON_SKILLS.shield];
  for (const id of ids) context.state.cooldowns.delete(id);
  return ids.length > 0;
}

// Route a completed Luminary virtue through its shared activation traits and
// virtue-specific illumination effects.
function handleLuminaryVirtueTraits(context: GuardianCastContext, skill: GuardianSkill): void {
  const virtue = virtueFor(skill);
  if (!virtue) return;
  const at = context.effectiveEnd;
  const state = luminaryState.from(context);
  if (hasTrait(context, GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS) && resetRadiantWeaponCooldowns(context, virtue)) {
    emitGuardianProc(context, {
      name: 'Master-at-Arms',
      at,
      sourceSkill: skill.name,
      detail: `${virtue} radiant weapon skills recharged`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS)
    });
  }

  if (virtue === 'justice') {
    state.radiantJusticeArmed = true;
    emitGuardianProc(context, {
      name: 'Empowered Hammer',
      at,
      sourceSkill: skill.name,
      detail: 'Next Dazzling Hammer creates a delayed secondary impact',
      icon: skill.icon,
      procType: 'skill',
      source: 'Skill'
    });
  }

  if (virtue === 'courage') {
    state.radiantCourageSwordArmed = true;
    state.radiantCourageShieldArmed = true;
    emitGuardianProc(context, {
      name: 'Empowered Sword',
      at,
      sourceSkill: skill.name,
      detail: 'Next Gleaming Blade deals 50% more damage',
      icon: skill.icon,
      procType: 'skill',
      source: 'Skill'
    });
  }
}

export function updateLuminaryTraitCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  replayInitialLuminaryState(context, skill);
  if (skill.id === GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE) {
    // Register Exit Radiant Forge as an available flip so the scheduler and
    // UI treat it as an always-ready option while the forge is active.
    // POSITIVE_INFINITY means "no cooldown / never expires".
    professionCoreState(context).availableFlips[GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE] = Number.POSITIVE_INFINITY;
  }

  processStanceDamageBuffs(context, skill);
  processLightAuraAndFields(context, skill);
  handleLuminaryVirtueTraits(context, skill);
}

export function observeLuminaryScheduledEvent(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  if (event.type === 'combo_field' && String(event.fieldType) === 'Light') {
    emitLightAuraOperation(
      context,
      'guardian.luminary.light-field-start',
      event.at,
      {
        id: event.skillId ?? event.sourceId,
        name: event.skillName || event.name || 'Light field'
      },
      -30,
      { duration: Number(event.expiresAt) - event.at }
    );
  }

  if (
    event.type === 'damage' &&
    event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES &&
    // hitIndex === 1 is the first damaging tick that creates the field; index 0
    // is the initial impact and does not create a combo field.
    Number(event.hitIndex || 0) === 1
  ) {
    emitLightAuraOperation(
      context,
      'guardian.luminary.light-field-start',
      event.at,
      {
        id: event.skillId,
        name: event.skillName || 'Lesser Symbol of Blades'
      },
      -30,
      { duration: 4 }
    );
  }

  if (event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.LUMINOUS_STAFF) {
    const sourceSkill =
      context.catalog.skillsById.get(event.skillId) ||
      ({ id: event.skillId, name: event.skillName || 'Luminous Staff' } as GuardianSkill);
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: event.skillId,
      actorType: 'player',
      skillId: event.skillId,
      skillName: event.skillName,
      kind: 'resolution',
      stacks: 1,
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'resolution', 1)
    });
  }
}

export function reactToLuminaryJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: {
    readonly hitContext?: object;
  } = {}
): void {
  // Radiant Justice uses the two-second passive packet measured in the Luminary log.
  reactToJusticeHitWithOptions(context, event, dependencies, {
    skillId: GUARDIAN_SKILL_IDS.RADIANT_JUSTICE,
    skillName: 'Radiant Justice',
    passiveBurnDuration: 2
  });
}

export function reactToEffulgentStrike(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  const maximumStacks = Number(balanceProfileFromContext(context, PROFILE.effulgentStance)?.maximumStacks || 10);
  const guardianOwnedStrike =
    isGw2PlayerActorEvent(event) || (event.source === 'guardian' && event.actorType === 'effect');
  if (
    !guardianOwnedStrike ||
    // Only count strikes that deal damage (coefficient > 0), not utility hits.
    !(Number(event.coefficient || 0) > 0) ||
    // Strict less-than with epsilon so a strike at exactly effulgentActiveUntil
    // does not count — the window is half-open [activated, detonated).
    !(event.at < Number(state.effulgentActiveUntil || 0) - Number(context.epsilon ?? EPSILON))
  ) {
    return;
  }

  state.effulgentStacks = Math.min(maximumStacks, Number(state.effulgentStacks || 0) + 1);
}

export function handleEffulgentActivated(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  luminaryState.from(context).effulgentActiveUntil = event.at + 4;
  luminaryState.from(context).effulgentStacks = 0;
}

export function handleEffulgentDetonate(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  const profile = balanceProfileFromContext(context, PROFILE.effulgentStance);
  const strike = balanceProfileEffect(profile, 'strike');
  const control = balanceProfileEffect(profile, 'control');
  const maximumStacks = Number(profile?.maximumStacks || 10);
  const stacks = Math.max(0, Math.min(maximumStacks, Number(state.effulgentStacks || 0)));
  state.effulgentActiveUntil = 0;
  state.effulgentStacks = 0;
  context.recordProc('skill', 'Effulgent Stance', event.at, 'Effulgent Stance', `${stacks}/10 stacks`);
  enqueueOrdered(
    context.queue,
    buildGuardianStrike({
      at: event.at,
      priority: 5,
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: 'Effulgent Stance',
      name: 'Effulgent Stance',
      // Base coefficient 0.5 + 0.35 per stack; at 10 stacks this is 4.0.
      coefficient: Number(strike?.coefficient || 0.5) + stacks * Number(profile?.damageIncreasePerStack || 0.35),
      weaponStrengthProfileId: 'nonweapon.unequipped',
      stackCount: stacks
    })
  );
  if (stacks === maximumStacks) {
    // Daze is only triggered at max stacks; priority 6 > 5 so it sorts after
    // the strike in the resolver queue at the same timestamp.
    enqueueOrdered(context.queue, {
      type: 'control',
      at: event.at,
      priority: 6,
      source: 'guardian',
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: 'Effulgent Stance',
      controlKind: 'daze',
      duration: Number(control?.duration || 2)
    });
  }
}
