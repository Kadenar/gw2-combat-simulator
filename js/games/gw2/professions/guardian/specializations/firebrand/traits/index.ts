import { grantResource } from '#gw2/platform/combat/resources/resource-policy.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { MANTRAS } from '#gw2/professions/guardian/data/mantra-definitions.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillCondition } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { firebrandState } from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { emitGuardianEvent } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/guardian/core/profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { emitGuardianProc, guardianTraitIcon } from '#gw2/professions/guardian/core/traits/index.js';
import {
  guardianVirtueForSlot,
  reactToJusticeHitWithOptions
} from '#gw2/professions/guardian/core/mechanics/virtues.js';

import { FIREBRAND_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSchedulerContext,
  GuardianSkill,
  GuardianVirtue
} from '#gw2/professions/guardian/types.js';

const DORMANT_PROFILE_BY_VIRTUE: Readonly<Record<GuardianVirtue, string>> = Object.freeze({
  justice: PROFILE.tomeJustice,
  resolve: PROFILE.tomeResolve,
  courage: PROFILE.tomeCourage
});

function isFinalMantraCharge(context: GuardianCastContext, skill: GuardianSkill): boolean {
  // Canonical IDs decide charge identity; unfamiliar custom skills retain the description/ammo fallback.
  const mantra = MANTRAS.find(({ rootId, normalId, finalId }) =>
    [rootId, normalId, finalId].includes(Number(skill.id))
  );
  if (mantra) return skill.id === mantra.finalId;
  if (/^Final Charge\./.test(String(skill.description || ''))) return true;
  return skill.categories?.includes('Mantra') === true && Number(context.ammo?.charges || 0) === 1;
}

export function updateFirebrandCastState(context: GuardianCastContext, skill: GuardianSkill): void {
  const at = context.effectiveEnd;
  const state = firebrandState.from(context);
  const coreState = professionCoreState(context);
  const virtue = /^Tome of /.test(skill.name) ? guardianVirtueForSlot(skill.slot) : null;
  if (virtue) {
    const passiveWasReady = state.tomeDormantReadyAt[virtue] <= at + EPSILON;
    state.activeTome = virtue;
    // Switching to a different tome resets the Swift Scholar page-refund streak
    // because it requires three consecutive pages in the same tome.
    if (state.swiftScholarTome !== virtue) {
      state.swiftScholarTome = virtue;
      state.swiftScholarCount = 0;
    }

    const profile = requireBalanceProfileFromContext(context, DORMANT_PROFILE_BY_VIRTUE[virtue]);
    // A ready passive starts its dormancy clock; Power of the Virtuous shortens
    // that clock, while reopening a dormant Tome preserves it.
    const dormantCooldown = balanceProfileNumber(profile, 'cooldown');
    const dormantRechargeMultiplier = hasTrait(context, GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS)
      ? balanceProfileNumber(
          requireBalanceProfileFromContext(context, CORE_PROFILE.powerOfTheVirtuous),
          'rechargeMultiplier'
        )
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
      weaponLine: skill.name
    });
    if (passiveWasReady) {
      const swiftScholarProfile = requireBalanceProfileFromContext(context, PROFILE.swiftScholar);
      const quickness = requireEffect(swiftScholarProfile, 'boon', 'quickness');
      if (quickness) {
        emitSkillBuff(context, skill, {
          at,
          source: 'guardian',
          sourceId: skill.id,
          actorType: 'player',
          kind: 'quickness',
          duration: effectNumber(swiftScholarProfile, quickness, 'duration'),
          stacks: effectNumber(swiftScholarProfile, quickness, 'stacks')
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
  }

  if (
    skill.type === 'Heal' &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.LIBERATORS_VOW) &&
    isInternalCooldownReady(at, state.liberatorsVowReadyAt)
  ) {
    const liberatorsVowProfile = requireBalanceProfileFromContext(context, PROFILE.liberatorsVow);
    const quickness = requireEffect(liberatorsVowProfile, 'boon', 'quickness');
    if (quickness) {
      state.liberatorsVowReadyAt = at + balanceProfileNumber(liberatorsVowProfile, 'internalCooldown');
      emitSkillBuff(context, skill, {
        at,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        kind: 'quickness',
        duration: effectNumber(liberatorsVowProfile, quickness, 'duration'),
        stacks: effectNumber(liberatorsVowProfile, quickness, 'stacks'),
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
  }

  if (hasTrait(context, GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS) && isFinalMantraCharge(context, skill)) {
    const weightyTermsProfile = requireBalanceProfileFromContext(context, PROFILE.weightyTerms);
    const slow = requireEffect(weightyTermsProfile, 'condition', 'Slow');
    const pageGain = balanceProfileNumber(weightyTermsProfile, 'resourceGain');
    // Refunds refill the pool without resetting its running regeneration timer.
    grantResource(context, 'tomePages', pageGain, at);

    if (slow) {
      emitSkillCondition(context, {
        skill,
        at,
        sourceId: GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS,
        name: 'Weighty Terms — Slow',
        condition: String(slow.condition),
        stacks: effectNumber(weightyTermsProfile, slow, 'stacks'),
        duration: effectNumber(weightyTermsProfile, slow, 'duration')
      });
    }

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
  // The completed Renewed Focus event restores the shared page pool and re-enables tome activation passives.
  if (event.type === 'guardian.virtues-refreshed') {
    grantResource(context, 'tomePages', state.tomePages.maximum, event.at);
    state.tomeDormantReadyAt = { justice: event.at, resolve: event.at, courage: event.at };
    return;
  }

  if (
    event.type === 'buff' &&
    ['aegis', 'stability'].includes(kind) &&
    hasTrait(context, GUARDIAN_TRAIT_IDS.STALWART_SPEED) &&
    isInternalCooldownReady(event.at, state.stalwartSpeedReadyAt)
  ) {
    const stalwartSpeedProfile = requireBalanceProfileFromContext(context, PROFILE.stalwartSpeed);
    const quickness = requireEffect(stalwartSpeedProfile, 'boon', 'quickness');
    if (!quickness) return;
    const sourceSkill = { id: GUARDIAN_TRAIT_IDS.STALWART_SPEED, name: 'Stalwart Speed' } as GuardianSkill;
    state.stalwartSpeedReadyAt = event.at + balanceProfileNumber(stalwartSpeedProfile, 'internalCooldown');
    emitSkillBuff(context, {
      at: event.at,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      actorType: 'player',
      skillId: GUARDIAN_TRAIT_IDS.STALWART_SPEED,
      skillName: 'Stalwart Speed',
      kind: 'quickness',
      stacks: effectNumber(stalwartSpeedProfile, quickness, 'stacks'),
      duration: gw2SchedulerBoonDuration(
        context,
        sourceSkill,
        'quickness',
        effectNumber(stalwartSpeedProfile, quickness, 'duration')
      ),
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
    const profile = requireBalanceProfileFromContext(context, PROFILE.stoicDemeanor);
    if (!profile.effects?.some((effect) => effect.type === 'boon')) return;
    const sourceSkill = { id: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR, name: 'Stoic Demeanor' } as GuardianSkill;
    for (const buff of (profile?.effects || []).filter((effect) => effect.type === 'boon')) {
      emitSkillBuff(context, {
        at: event.at,
        source: 'guardian',
        sourceId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        actorType: 'player',
        skillId: GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR,
        skillName: 'Stoic Demeanor',
        kind: String(buff.boon),
        stacks: effectNumber(profile, buff, 'stacks'),
        duration: gw2SchedulerBoonDuration(
          context,
          sourceSkill,
          String(buff.boon),
          effectNumber(profile, buff, 'duration')
        ),
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
    const unrelentingCriticismProfile = requireBalanceProfileFromContext(context, PROFILE.unrelentingCriticism);
    const bleeding = requireEffect(unrelentingCriticismProfile, 'condition', 'Bleeding');
    if (!bleeding) return;
    emitSkillCondition(context, {
      skill,
      at: event.at,
      name: 'Unrelenting Criticism — Bleeding',
      condition: String(bleeding.condition),
      stacks: effectNumber(unrelentingCriticismProfile, bleeding, 'stacks'),
      duration: effectNumber(unrelentingCriticismProfile, bleeding, 'duration'),
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
  dependencies: Pick<NativeResolvedDamageDetails, 'hitContext'> = {}
): void {
  reactToJusticeHitWithOptions(context, event, dependencies, {
    retainsPassive: hasTrait(context, GUARDIAN_TRAIT_IDS.QUICKFIRE),
    skillId: GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE,
    skillName: 'Tome of Justice',
    // Tome passive Burning starts at one second; Amplified Wrath applies separately.
    passiveBurnDuration: 1
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

  const quickfireProfile = requireBalanceProfileFromContext(context, PROFILE.quickfire);
  const ashesBuff = requireEffect(quickfireProfile, 'buff', 'ashes-of-the-just');
  const ashesProfile = requireBalanceProfileFromContext(context, PROFILE.ashes);
  const burn = requireEffect(ashesProfile, 'condition', 'Burning');
  if (!ashesBuff || !burn) return;
  const duration = effectNumber(quickfireProfile, ashesBuff, 'duration');
  const expiresAt = gw2EffectExpiresAt(event.at, duration);
  state.quickfireReadyAt = event.at + balanceProfileNumber(quickfireProfile, 'internalCooldown');
  // Prefer an allied Quickfire recipient when present; otherwise the simulated player receives the charge.
  if (alliedPlayerCount <= 0 && includesSelf) {
    // Refresh all live charges while preserving their hit cooldown.
    state.ashes = grantCharges(1, expiresAt, state.ashes, event.at);
    state.ashesBurnDuration = effectNumber(ashesProfile, burn, 'duration');
    context.queue.enqueue({
      type: 'guardian.ashes-expired',
      at: state.ashes.expiresAt,
      // Match tome Ashes: same-time strikes consume charges before expiry cleanup.
      priority: 10,
      source: 'guardian',
      sourceId: GUARDIAN_TRAIT_IDS.QUICKFIRE,
      actorType: 'effect',
      skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
      skillName: 'Quickfire'
    });
  } else {
    const [proc] = gw2AlliedPlayerProcTimeline(context.config, {
      start: event.at,
      duration: expiresAt - event.at,
      maximumAllies: 1,
      maximumPerAlly: 1,
      internalCooldown: balanceProfileNumber(ashesProfile, 'internalCooldown')
    });
    if (proc) {
      context.queue.enqueue(
        buildResolverCondition({
          at: proc.at,
          priority: 5,
          source: 'guardian',
          sourceId: 'guardian.ashes-of-the-just',
          actorType: 'player',
          skillId: GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST,
          skillName: 'Quickfire',
          name: `Quickfire — Ally ${proc.allyIndex} Burning`,
          condition: String(burn.condition),
          stacks: effectNumber(ashesProfile, burn, 'stacks'),
          duration: effectNumber(ashesProfile, burn, 'duration'),
          metadata: { triggeredByAlly: proc.allyIndex }
        })
      );
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
