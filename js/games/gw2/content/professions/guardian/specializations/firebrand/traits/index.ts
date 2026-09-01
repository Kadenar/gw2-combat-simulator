import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { firebrandState } from '#gw2/content/professions/guardian/specializations/firebrand/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/content/professions/guardian/data/ids.js';
import { emitGuardianEvent } from '#gw2/content/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/content/professions/guardian/core/profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/content/professions/guardian/core/traits/index.js';
import { reactToJusticeHitWithOptions } from '#gw2/content/professions/guardian/core/mechanics/virtues.js';

import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/guardian/specializations/firebrand/profiles.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/content/professions/guardian/types.js';

const DORMANT_PROFILE_BY_VIRTUE: Readonly<Record<GuardianVirtue, string>> = Object.freeze({
  justice: PROFILE.tomeJustice,
  resolve: PROFILE.tomeResolve,
  courage: PROFILE.tomeCourage
});

function virtueFor(skill: GuardianSkill): GuardianVirtue | null {
  if (!/^Tome of /.test(skill.name)) return null;
  // Slot is "Profession_1/2/3"; extract the trailing digit to index into the
  // virtue order (1=justice, 2=resolve, 3=courage).
  const slot = Number(String(skill.slot || '').match(/(\d)$/)?.[1] || 0);
  return ([null, 'justice', 'resolve', 'courage'] as const)[slot] || null;
}

function isFinalMantraCharge(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // The description prefix is the authoritative GW2 API signal; the ammo
  // fallback handles cases where the catalog skill description is missing or
  // incomplete (e.g. custom/test data).
  if (/^Final Charge\./.test(String(skill.description || ''))) return true;
  return skill.categories?.includes('Mantra') === true && Number(context.ammo?.charges || 0) === 1;
}

export function updateFirebrandCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  const at = context.effectiveEnd;
  const state = firebrandState.from(context);
  const coreState = professionCoreState(context);
  const virtue = virtueFor(skill);
  if (virtue) {
    const passiveWasReady = state.tomeDormantReadyAt[virtue] <= at + context.epsilon;
    state.activeTome = virtue;
    // Switching to a different tome resets the Swift Scholar page-refund streak
    // because it requires three consecutive pages in the same tome.
    if (state.swiftScholarTome !== virtue) {
      state.swiftScholarTome = virtue;
      state.swiftScholarCount = 0;
    }

    // A ready passive starts its dormancy clock; Power of the Virtuous shortens
    // that clock, while reopening a dormant Tome preserves it.
    const dormantCooldown = Number(
      balanceProfileFromContext(context, DORMANT_PROFILE_BY_VIRTUE[virtue])?.cooldown ||
        (virtue === 'justice' ? 20 : virtue === 'resolve' ? 30 : 45)
    );
    const dormantRechargeMultiplier = hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
      ? Number(balanceProfileFromContext(context, CORE_PROFILE.powerOfTheVirtuous)?.rechargeMultiplier || 0.85)
      : 1;
    const passiveReadyAt = passiveWasReady
      ? at + dormantCooldown * dormantRechargeMultiplier
      : state.tomeDormantReadyAt[virtue];
    state.tomeDormantReadyAt[virtue] = passiveReadyAt;
    // virtueReadyAt on coreState is the canonical source the virtue subsystem
    // reads, so both fields must stay in sync.
    coreState.virtueReadyAt[virtue] = passiveReadyAt;
    emitGuardianEvent(context, skill, 'guardian.firebrand-virtue-activated', {
      virtue,
      passiveReadyAt
    });
    emitGuardianEvent(context, skill, 'weapon_set', {
      weaponSet: context.state.activeWeaponSet,
      mechanicSwap: true,
      weaponLine: skill.name
    });
    if (passiveWasReady) {
      const quickness = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.swiftScholar), 'boon');
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        kind: 'quickness',
        duration: Number(quickness?.duration || 3),
        stacks: 1
      });
      emitGuardianProc(context, {
        name: 'Swift Scholar',
        at,
        sourceSkill: skill.name,
        detail: '3 seconds of quickness',
        icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.SWIFT_SCHOLAR)
      });
    }
  }

  if (
    skill.type === 'Heal' &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.LIBERATORS_VOW) &&
    isInternalCooldownReady(at, state.liberatorsVowReadyAt)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.liberatorsVow);
    const quickness = balanceProfileEffect(profile, 'boon');
    state.liberatorsVowReadyAt = at + Number(profile?.internalCooldown || 7);
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'quickness',
      duration: Number(quickness?.duration || 2),
      stacks: 1,
      audience: { recipients: 'party' as const }
    });
    emitGuardianProc(context, {
      name: "Liberator's Vow",
      at,
      sourceSkill: skill.name,
      detail: '2 seconds of quickness',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.LIBERATORS_VOW)
    });
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS) && isFinalMantraCharge(context, skill)) {
    const profile = balanceProfileFromContext(context, PROFILE.weightyTerms);
    const slow = balanceProfileEffect(profile, 'condition');
    const pageGain = Number(profile?.resourceGain || 2);
    state.tomePages = Math.min(state.maximumTomePages, state.tomePages + pageGain);
    if (state.tomePages >= state.maximumTomePages) {
      state.nextTomePageAt = Number.POSITIVE_INFINITY;
    }

    emitSkillCondition(context, {
      at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Weighty Terms — Slow',
      condition: String(slow?.condition || 'Slow'),
      stacks: Number(slow?.stacks || 1),
      duration: Number(slow?.duration || 1.5)
    });
    emitGuardianProc(context, {
      name: 'Weighty Terms',
      at,
      sourceSkill: skill.name,
      detail: `Slow and +${pageGain} tome pages`,
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS)
    });
  }
}

export function observeFirebrandScheduledEvent(context: GuardianSchedulerContext, event: GuardianResolverEvent): void {
  const kind = String(event.kind || '').toLowerCase();
  const state = firebrandState.from(context);
  if (
    event.type === 'buff' &&
    ['aegis', 'stability'].includes(kind) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.STALWART_SPEED) &&
    isInternalCooldownReady(event.at, state.stalwartSpeedReadyAt)
  ) {
    const profile = balanceProfileFromContext(context, PROFILE.stalwartSpeed);
    const quickness = balanceProfileEffect(profile, 'boon');
    const sourceSkill = { id: GUARDIAN_TRAIT_IDS.STALWART_SPEED, name: 'Stalwart Speed' } as GuardianSkill;
    state.stalwartSpeedReadyAt = event.at + Number(profile?.internalCooldown || 7);
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      skillName: 'Stalwart Speed',
      kind: 'quickness',
      stacks: Number(quickness?.stacks || 1),
      duration: gw2SchedulerBoonDuration(context, sourceSkill, 'quickness', Number(quickness?.duration || 2)),
      audience: { recipients: 'party' as const },
      triggeredBy: event.skillName
    });
    emitGuardianProc(context, {
      name: 'Stalwart Speed',
      at: event.at,
      sourceSkill: event.skillName || 'Aegis or Stability',
      detail: '2 seconds of quickness',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.STALWART_SPEED)
    });
    return;
  }

  // Stoic Demeanor also triggers on certain debuffs applied to allies, which
  // arrive as condition events rather than control events; "slow" and "slowed"
  // are both checked because data inconsistency in the event stream.
  const qualifyingStoicCondition =
    event.type === 'condition' &&
    ['immobilized', 'slow', 'slowed'].includes(String(event.condition || '').toLowerCase());
  if ((event.type === 'control' || qualifyingStoicCondition) && hasTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)) {
    const profile = balanceProfileFromContext(context, PROFILE.stoicDemeanor);
    const sourceSkill = { id: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR, name: 'Stoic Demeanor' } as GuardianSkill;
    for (const buff of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
      emitSkillBuff(context, {
        at: event.at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        skillName: 'Stoic Demeanor',
        kind: String(buff.boon || ''),
        stacks: Number(buff.stacks || 1),
        duration: gw2SchedulerBoonDuration(context, sourceSkill, String(buff.boon || ''), Number(buff.duration || 0)),
        triggeredBy: event.skillName
      });
    }

    emitGuardianProc(context, {
      name: 'Stoic Demeanor',
      at: event.at,
      sourceSkill: event.skillName || 'Disable',
      detail: '2s resistance and 3 might',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
    });
    return;
  }

  if (event.type !== 'damage') return;
  const skill = event.skillId == null ? undefined : context.catalog.skillsById.get(event.skillId);
  if (
    skill?.weapon === 'Axe' &&
    event.actorType === 'player' &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM)
  ) {
    const bleeding = balanceProfileEffect(
      balanceProfileFromContext(context, PROFILE.unrelentingCriticism),
      'condition'
    );
    emitSkillCondition(context, {
      at: event.at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Unrelenting Criticism — Bleeding',
      condition: String(bleeding?.condition || 'Bleeding'),
      stacks: Number(bleeding?.stacks || 1),
      duration: Number(bleeding?.duration || 4.5),
      triggeredBy: 'Unrelenting Criticism',
      activationId: event.activationId
    });
  }
}

export function handleFirebrandVirtueActivation(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const virtue = event.virtue;
  if (!virtue) return;
  firebrandState.from(context).activeTome = virtue;
  firebrandState.from(context).tomeDormantReadyAt[virtue] = Number(event.passiveReadyAt);
  professionCoreState(context).virtueReadyAt[virtue] = Number(event.passiveReadyAt);
}

export function reactToFirebrandJusticeHit(
  context: GuardianResolverContext,
  event: GuardianResolverEvent,
  dependencies: {
    readonly hitContext?: object;
  } = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice'
  });
}

export function reactToFirebrandBuffTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = firebrandState.from(context);
  const includesSelf = event.resolvedAudience?.includesSelf === true;
  const alliedPlayerCount = Number(event.resolvedAudience?.alliedPlayerCount || 0);
  if (
    String(event.kind || '').toLowerCase() !== 'quickness' ||
    (!includesSelf && alliedPlayerCount <= 0) ||
    !hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE) ||
    !isInternalCooldownReady(event.at, state.quickfireReadyAt)
  ) {
    return;
  }

  const quickfire = balanceProfileFromContext(context, PROFILE.quickfire);
  const ashes = balanceProfileFromContext(context, PROFILE.ashes);
  const ashesBuff = balanceProfileEffect(quickfire, 'buff');
  const burn = balanceProfileEffect(ashes, 'condition');
  const duration = Number(ashesBuff?.duration || 10);
  state.quickfireReadyAt = event.at + Number(quickfire?.internalCooldown || 7);
  // Prefer an allied Quickfire recipient when present; otherwise the simulated player receives the charge.
  if (alliedPlayerCount <= 0 && includesSelf) {
    const hadAshes = state.ashesCharges > 0 && event.at < state.ashesExpiresAt - Number(context.epsilon || 0.0001);
    state.ashesCharges = Math.max(0, Number(state.ashesCharges || 0)) + 1;
    state.ashesBurnDuration = Number(burn?.duration || 2);
    // Don't reset the trigger timer when stacking onto an active Ashes buff;
    // resetting would skip a burn that should have fired at the next hit.
    state.ashesNextTriggerAt = hadAshes ? state.ashesNextTriggerAt : 0;
    state.ashesExpiresAt = event.at + duration;
    enqueueOrdered(context.queue, {
      type: 'guardian.ashes-expired',
      at: state.ashesExpiresAt,
      priority: 10,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.QUICKFIRE,
      actorType: 'effect',
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: 'Quickfire',
      ashesExpiresAt: state.ashesExpiresAt
    });
  } else {
    const [proc] = gw2AlliedPlayerProcTimeline(context.config, {
      start: event.at,
      duration,
      maximumAllies: 1,
      maximumPerAlly: 1,
      internalCooldown: Number(ashes?.internalCooldown || 1)
    });
    if (proc) {
      enqueueOrdered(context.queue, {
        type: 'condition',
        at: proc.at,
        priority: 5,
        source: 'guardian',
        sourceId: 'guardian.ashes-of-the-just',
        actorType: 'player',
        skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
        skillName: 'Quickfire',
        name: `Quickfire — Ally ${proc.allyIndex} Burning`,
        condition: String(burn?.condition || 'Burning'),
        stacks: Number(burn?.stacks || 1),
        duration: Number(burn?.duration || 2),
        triggeredByAlly: proc.allyIndex
      });
    }
  }

  context.recordProc(
    'trait',
    'Quickfire',
    event.at,
    event.skillName,
    '+1 Ashes of the Just',
    guardianTraitIcon(GUARDIAN_TRAIT_IDS.QUICKFIRE)
  );
}
