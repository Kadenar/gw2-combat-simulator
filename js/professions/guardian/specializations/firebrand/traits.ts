import { firebrandState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { enqueueOrdered } from '../../../../platform/engine/events/queue.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { gw2AlliedPlayerProcTimeline } from '../../../../platform/gw2/combat/state/allied-players.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '../../data/ids.js';
import { emitGuardianEvent } from '../../core/events.js';
import { emitGuardianBuff, emitGuardianProc, guardianTraitIcon, hasGuardianTrait } from '../../core/traits.js';
import { reactToJusticeHitWithOptions } from '../../core/virtues.js';
import { guardianBalanceProfile, guardianBalanceProfileEffect } from '../../core/profiles.js';
import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import type { Gw2ConditionResolution } from '../../../../platform/gw2/resolver/types.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '../../types.js';

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

    // If the passive was on cooldown when the tome opened, don't reset the
    // timer; the existing tomeDormantReadyAt carries the correct future time.
    const passiveReadyAt = passiveWasReady
      ? at +
        Number(
          guardianBalanceProfile(context, DORMANT_PROFILE_BY_VIRTUE[virtue])?.cooldown ||
            (virtue === 'justice' ? 20 : virtue === 'resolve' ? 30 : 45)
        )
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
      const quickness = guardianBalanceProfileEffect(guardianBalanceProfile(context, PROFILE.swiftScholar), 'boon');
      emitGuardianBuff(context, skill, at, 'quickness', Number(quickness?.duration || 3));
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
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.LIBERATORS_VOW) &&
    isInternalCooldownReady(at, state.liberatorsVowReadyAt)
  ) {
    const profile = guardianBalanceProfile(context, PROFILE.liberatorsVow);
    const quickness = guardianBalanceProfileEffect(profile, 'boon');
    state.liberatorsVowReadyAt = at + Number(profile?.internalCooldown || 7);
    emitGuardianBuff(context, skill, at, 'quickness', Number(quickness?.duration || 2), {
      recipients: 'party'
    });
    emitGuardianProc(context, {
      name: "Liberator's Vow",
      at,
      sourceSkill: skill.name,
      detail: '2 seconds of quickness',
      icon: guardianTraitIcon(GUARDIAN_TRAIT_IDS.LIBERATORS_VOW)
    });
  }

  if (hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS) && isFinalMantraCharge(context, skill)) {
    const profile = guardianBalanceProfile(context, PROFILE.weightyTerms);
    const slow = guardianBalanceProfileEffect(profile, 'condition');
    const pageGain = Number(profile?.resourceGain || 2);
    state.tomePages = Math.min(state.maximumTomePages, state.tomePages + pageGain);
    if (state.tomePages >= state.maximumTomePages) {
      state.nextTomePageAt = Number.POSITIVE_INFINITY;
    }

    context.emit({
      type: 'condition',
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
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STALWART_SPEED) &&
    isInternalCooldownReady(event.at, state.stalwartSpeedReadyAt)
  ) {
    const profile = guardianBalanceProfile(context, PROFILE.stalwartSpeed);
    const quickness = guardianBalanceProfileEffect(profile, 'boon');
    state.stalwartSpeedReadyAt = event.at + Number(profile?.internalCooldown || 7);
    context.emit({
      type: 'buff',
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      skillName: 'Stalwart Speed',
      kind: 'quickness',
      stacks: Number(quickness?.stacks || 1),
      duration: Number(quickness?.duration || 2),
      recipients: 'party',
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
  if (
    (event.type === 'control' || qualifyingStoicCondition) &&
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR)
  ) {
    const profile = guardianBalanceProfile(context, PROFILE.stoicDemeanor);
    for (const buff of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
      context.emit({
        type: 'buff',
        at: event.at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        skillName: 'Stoic Demeanor',
        kind: String(buff.boon || ''),
        stacks: Number(buff.stacks || 1),
        duration: Number(buff.duration || 0),
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
    hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM)
  ) {
    const bleeding = guardianBalanceProfileEffect(
      guardianBalanceProfile(context, PROFILE.unrelentingCriticism),
      'condition'
    );
    context.emit({
      type: 'condition',
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
    readonly applyCondition?: Gw2ConditionResolution['applyCondition'];
  } = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice'
  });
}

export function reactToFirebrandBuffTraits(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = firebrandState.from(context);
  if (
    String(event.kind || '').toLowerCase() !== 'quickness' ||
    // Skip if the event goes to allies only AND no allies are configured —
    // there is nobody to trigger Quickfire from.
    (event.affectsSelf === false && Number(event.alliedPlayerCount || 0) <= 0) ||
    !hasGuardianTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE) ||
    !isInternalCooldownReady(event.at, state.quickfireReadyAt)
  ) {
    return;
  }

  const quickfire = guardianBalanceProfile(context, PROFILE.quickfire);
  const ashes = guardianBalanceProfile(context, PROFILE.ashes);
  const ashesBuff = guardianBalanceProfileEffect(quickfire, 'buff');
  const burn = guardianBalanceProfileEffect(ashes, 'condition');
  const duration = Number(ashesBuff?.duration || 10);
  state.quickfireReadyAt = event.at + Number(quickfire?.internalCooldown || 7);
  if (event.affectsSelf !== false) {
    const hadAshes = state.ashesCharges > 0 && event.at < state.ashesExpiresAt - Number(context.epsilon || 0.0001);
    state.ashesCharges = Math.max(0, Number(state.ashesCharges || 0)) + 1;
    state.ashesBurnDuration = Number(burn?.duration || 2);
    // Don't reset the trigger timer when stacking onto an active Ashes buff;
    // resetting would skip a burn that should have fired at the next hit.
    state.ashesNextTriggerAt = hadAshes ? state.ashesNextTriggerAt : event.at;
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
