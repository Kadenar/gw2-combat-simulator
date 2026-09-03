/**
 * Routes Core Elementalist casts to the skill families and persistent mechanics that own their behavior.
 * Catalog fragments remain in `skills/`; cross-cast state lives in `mechanics/`.
 */
import {
  balanceProfileEffectFromContext,
  balanceProfileValueFromContext
} from '#gw2/platform/combat/state/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { grantEndurance, spendEndurance } from '#gw2/platform/combat/resources/endurance.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import { produceGw2OwnedComboEvents } from '#gw2/platform/scheduler/combo-materializer.js';
import { emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import {
  AURA_TRANSMUTE_SKILLS,
  DODGE_ENDURANCE_COST,
  ETCHING_CHAINS
} from '#gw2/content/professions/elementalist/core/constants.js';
import {
  onAttunementComplete,
  targetAttunement
} from '#gw2/content/professions/elementalist/core/mechanics/attunements.js';
import { etchingChain, skillWeapon } from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import { updateEndurance } from '#gw2/content/professions/elementalist/core/mechanics/endurance.js';
import { shareAttunementVariantRecharge } from '#gw2/content/professions/elementalist/core/mechanics/weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/elementalist/core/profiles.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  type ElementalistAttunement
} from '#gw2/content/professions/elementalist/core/state.js';
import {
  applyElementalistAura,
  applyGenericPostCast,
  extendPersistingFlamesPackets,
  triggerEvasiveArcana
} from '#gw2/content/professions/elementalist/core/traits/index.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistSchedulerContext
} from '#gw2/content/professions/elementalist/types.js';
import { applyConjureState } from '#gw2/content/professions/elementalist/core/mechanics/conjures.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import {
  beginElementalistGlyphCast,
  completeElementalistElementalCommand,
  completeElementalistGlyphCast
} from '#gw2/content/professions/elementalist/core/mechanics/elementals/runtime.js';
import {
  applyHammerState,
  scheduleGrandFinaleProfile
} from '#gw2/content/professions/elementalist/core/mechanics/hammer-orbs.js';
import { applyPistolState } from '#gw2/content/professions/elementalist/core/mechanics/pistol-bullets.js';

/** scheduleSkill hook: offers the cast to the Grand Finale profile, which reports true when it authored the packets itself. */
export function scheduleElementalistSkill(context: ElementalistLifecycleContext, skill: Skill): boolean {
  return scheduleGrandFinaleProfile(context, skill);
}

// Skill data encodes a granted aura as "Element|seconds"; malformed or
// zero-length values grant nothing.
function applySkillAura(context: ElementalistLifecycleContext, skill: Skill): void {
  if (!skill.aura) return;
  const [element, rawDuration] = String(skill.aura).split('|');
  const duration = Number(rawDuration || 0);
  if (!element || !(duration > 0)) return;
  applyElementalistAura(context, {
    at: context.effectiveEnd,
    aura: `${element} Aura`,
    duration,
    skillName: skill.name,
    sourceId: skill.id
  });
}

/**
 * Cast-start hook: grants the skill's aura, opens glyph casts, seeds spear
 * etching progress, cancels orb packets Grand Finale is about to supersede, and
 * captures armed spear empowerments for this activation.
 */
export function elementalistOnCastStart(context: ElementalistLifecycleContext, skill: Skill): void {
  // Aura-bearing skills grant their aura before same-time strike/condition
  // packets, so aura-triggered modifiers can affect the skill that granted it.
  applySkillAura(context, skill);
  beginElementalistGlyphCast(context, skill);
  const state = professionCoreState(context);
  const chain = etchingChain(skill.id);
  if (chain && Number(skill.id) === chain.etchingId && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = { stage: 'lesser', otherCasts: 0 };
  }

  if (Number(skill.id) === ID.GRAND_FINALE) {
    // Grand Finale re-authors the orbs' damage, so any packet still pending from
    // the activations that created those orbs is cancelled rather than doubled.
    const activations = new Set(
      Object.values(state.hammerOrbActivationIds).filter((value): value is string => Boolean(value))
    );
    for (const event of [...context.events]) {
      if (
        activations.has(String(event.activationId || '')) &&
        event.at >= context.start &&
        (event.type === 'damage' || event.type === 'condition')
      ) {
        context.replaceEvent(event, {
          type: 'marker',
          cancelled: true,
          detail: 'cancelled by Grand Finale'
        });
      }
    }
  }

  if (skillWeapon(skill) === 'Spear' && String(skill.slot || '') !== 'Weapon_1') {
    // Snapshot the armed one-shot empowerments against this reservation so
    // afterCast applies them only to the packets of this cast.
    const followup = {
      damage: state.spearNextDamageBonus,
      critical: state.spearNextGuaranteedCritical,
      control: state.spearNextControlHit
    };
    if (followup.damage || followup.critical || followup.control) {
      state.spearFollowups[context.reservationId] = followup;
      state.spearNextDamageBonus = false;
      state.spearNextGuaranteedCritical = false;
      state.spearNextControlHit = false;
    }
  }
}

/**
 * Decorate packets only after the base skill has materialized so combo chances
 * and one-shot spear empowerments modify the exact activation they belong to.
 */
export function elementalistAfterCast(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  extendPersistingFlamesPackets(context, skill);
  const activationEvents = context.events
    .filter(
      (event) =>
        event.activationId === context.reservationId && event.type === 'damage' && Number(event.coefficient || 0) > 0
    )
    .sort((left, right) => left.at - right.at);

  if (Number(skill.id) === ID.FRIGID_FLURRY && state.pistolBullets.Water === true) {
    // An active ice bullet gives every Frigid Flurry strike its fixed 20% projectile-finisher chance.
    for (const [index, event] of activationEvents.entries()) {
      const replacement = context.replaceEvent(event, {
        comboFinishers: [
          {
            ownerId: 'elementalist',
            attemptGroup: `runtime:${index + 1}`,
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      });
      produceGw2OwnedComboEvents(context, replacement);
    }
  }

  const followup = state.spearFollowups[context.reservationId];
  if (!followup) return;
  for (const event of activationEvents) {
    context.replaceEvent(event, {
      ...(followup.damage
        ? {
            coefficient:
              Number(event.coefficient || 0) *
              balanceProfileValueFromContext(context, PROFILE.spearEmpowerments, 'damageMultiplier', 1.2)
          }
        : {}),
      ...(followup.critical ? { forceCrit: true } : {})
    });
  }

  if (followup.control && activationEvents[0]) {
    const first = activationEvents[0];
    emitSkillControl(context, {
      at: first.at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      skillId: skill.id,
      controlKind: 'crowd-control'
    });
  }

  delete state.spearFollowups[context.reservationId];
}

// Commit stateful flipovers and chain progress at cast completion, including
// aura transmutation, pistol bullets, etchings, orbs, and conjured weapons.
function applySpecialSkillProgression(context: ElementalistLifecycleContext, skill: Skill): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;

  const aura = AURA_TRANSMUTE_SKILLS[Number(skill.id)];
  if (aura) {
    state.activeAuras = state.activeAuras.filter((candidate) => candidate.type !== aura || candidate.expiresAt <= at);
  }

  const chain = etchingChain(skill.id);
  if (chain && Number(skill.id) !== chain.etchingId && skillWeapon(skill) === 'Spear') {
    state.etchings[chain.etching] = null;
  } else if (!chain || Number(skill.id) === chain.etchingId) {
    // Any other completed cast counts toward every armed etching, upgrading it
    // from the lesser release to the full one once enough casts have passed.
    for (const candidate of ETCHING_CHAINS) {
      const progress = state.etchings[candidate.etching];
      if (!progress || progress.stage !== 'lesser') continue;
      if (Number(skill.id) === candidate.etchingId) continue;
      const otherCasts = progress.otherCasts + 1;
      state.etchings[candidate.etching] = {
        stage:
          otherCasts >= balanceProfileValueFromContext(context, PROFILE.spearEmpowerments, 'maximumStacks', 3)
            ? 'full'
            : 'lesser',
        otherCasts
      };
    }
  }

  if (Number(skill.resourceGain || 0) > 0) {
    updateEndurance(context, state, at, Boolean(context.config.boons?.vigor));
    Object.assign(
      state,
      grantEndurance(
        state,
        Number(skill.resourceGain),
        at,
        balanceProfileValueFromContext(context, PROFILE.resources, 'maximumStacks', 100)
      )
    );
  }
}

/**
 * Runs Core Elementalist mechanics owned by one completed skill activation.
 *
 * Keys match the `mechanic` trigger types declared in skill effect data; the
 * scheduler dispatches the matching handler when a trigger falls due.
 */
export const elementalistCoreSkillMechanicHandlers = Object.freeze({
  'elementalist.core.open-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt =
      at + balanceProfileValueFromContext(context, PROFILE.rockBarrier, 'durationMultiplier', 30);
  },
  'elementalist.core.release-rock-barrier': ({
    context,
    at
  }: {
    context: ElementalistSchedulerContext;
    at: number;
  }): void => {
    professionCoreState(context).rockBarrierExpiresAt = 0;
    const root = context.catalog.skillsById.get(ID.ROCK_BARRIER);
    if (root) {
      context.state.cooldowns.set(root.id, at + context.rechargeDurationFor(root, at, { rockBarrierRelease: true }));
    }
  },
  'elementalist.core.consume-elemental-explosion': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => {
    const state = professionCoreState(context);
    const auraByAttunement: Readonly<Record<ElementalistAttunement, readonly [string, number]>> = {
      Fire: ['Fire Aura', 4],
      Water: ['Frost Aura', 4],
      Air: ['Shocking Aura', 3],
      Earth: ['Magnetic Aura', 3]
    };
    const [fallbackAura, fallbackDuration] = auraByAttunement[state.primaryAttunement];
    const auraEffect = balanceProfileEffectFromContext(
      context,
      PROFILE.elementalExplosion,
      'buff',
      0,
      state.primaryAttunement
    );
    applyElementalistAura(context, {
      at,
      aura: String(auraEffect?.kind || fallbackAura),
      duration: Number(auraEffect?.duration ?? fallbackDuration),
      skillName: skill.name,
      sourceId: skill.id
    });
    for (const element of ELEMENTALIST_ATTUNEMENTS) state.pistolBullets[element] = false;
  },
  'elementalist.core.arm-spear-damage': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextDamageBonus = true;
  },
  'elementalist.core.arm-spear-recharge': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextRechargeReduction = true;
  },
  'elementalist.core.arm-spear-critical': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextGuaranteedCritical = true;
  },
  'elementalist.core.arm-spear-control': ({ context }: { context: ElementalistSchedulerContext }): void => {
    professionCoreState(context).spearNextControlHit = true;
  },
  'elementalist.core.disable-signet-of-fire-passive': ({
    context,
    skill,
    at
  }: {
    context: ElementalistSchedulerContext;
    skill: Skill;
    at: number;
  }): void => {
    if (hasTrait(context, 'Written in Stone')) return;
    const state = professionCoreState(context);
    state.signetOfFireDisabledUntil = Number(context.state.cooldowns.get(skill.id) || at);
    context.emit({
      type: 'elementalist.signet-fire',
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      skillName: skill.name,
      disabledUntil: state.signetOfFireDisabledUntil
    });
  }
});

/**
 * Cast-completion hook: settles attunement swaps, conjures, etching progress and
 * endurance, then the Arcane Echo and Fulgor special cases, and finally the
 * pistol, hammer, and trait post-cast owners for the finished activation.
 */
export function elementalistOnCastComplete(context: ElementalistLifecycleContext, skill: Skill): void {
  completeElementalistGlyphCast(context, skill);
  completeElementalistElementalCommand(context, skill);
  // Attunement casts finish here. A specialization that already ran the swap
  // (Weaver dual attunements, Evoker) flags it so Core does not repeat it.
  const target = targetAttunement(skill);
  if (target) {
    if (context.elementalistAttunementHandled !== true) {
      onAttunementComplete(context, skill, target);
    }

    delete context.elementalistAttunementHandled;
    // Elementalist spear etchings count attunement swaps among the three
    // completed casts required to upgrade their release skill.
    applySpecialSkillProgression(context, skill);
    return;
  }

  const state = professionCoreState(context);
  applyConjureState(context, skill);
  applySpecialSkillProgression(context, skill);
  shareAttunementVariantRecharge(context, skill);
  // Dodge is modeled as a cast, so endurance is caught up to now before its cost is spent.
  if (Number(skill.id) === ID.DODGE) {
    updateEndurance(context, state, context.effectiveEnd, Boolean(context.config.boons?.vigor));
    Object.assign(
      state,
      spendEndurance(
        state,
        balanceProfileValueFromContext(context, PROFILE.resources, 'resourceCost', DODGE_ENDURANCE_COST),
        context.effectiveEnd,
        balanceProfileValueFromContext(context, PROFILE.resources, 'maximumStacks', 100)
      )
    );
    triggerEvasiveArcana(context, skill);
  }

  // Arcane Echo resets the next recharging weapon skill, and pays for it by
  // pushing its own cooldown out by that skill's full recharge.
  if (Number(skill.id) === ID.ARCANE_ECHO) {
    state.arcaneEchoUntil =
      context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.arcaneEcho, 'durationMultiplier', 10);
  } else if (
    state.arcaneEchoUntil >= context.effectiveEnd &&
    skill.type === 'Weapon' &&
    Number(skill.cooldown || 0) > 0
  ) {
    state.arcaneEchoUntil = 0;
    context.state.cooldowns.set(
      skill.id,
      context.effectiveEnd + balanceProfileValueFromContext(context, PROFILE.arcaneEcho, 'recharge', 1)
    );
    const arcaneEcho = context.catalog.skillsById.get(ID.ARCANE_ECHO);
    if (arcaneEcho) {
      const currentReadyAt = Number(context.state.cooldowns.get(arcaneEcho.id) || context.effectiveEnd);
      context.state.cooldowns.set(arcaneEcho.id, currentReadyAt + context.rechargeDuration);
    }
  }

  if (Number(skill.id) === ID.FULGOR) {
    const pulse = balanceProfileEffectFromContext(context, PROFILE.fulgor, 'strike');
    if (!pulse?.ticks?.length) throw new TypeError('Fulgor requires an explicit strike timeline.');
    // Fulgor owns one secondary action at a time, so a recast replaces only
    // the prior action's pulses that had not occurred when the recast began.
    for (const event of [...context.events]) {
      if (
        event.type !== 'damage' ||
        event.fulgorSecondary !== true ||
        event.cancelled === true ||
        event.at < context.start - context.epsilon
      ) {
        continue;
      }

      context.replaceEvent(event, {
        type: 'marker',
        cancelled: true,
        detail: 'replaced by a later Fulgor secondary action'
      });
    }

    for (const tick of pulse.ticks) {
      emitSkillDamage(context, {
        at: context.start + Number(tick.atMs) / 1000,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'effect',
        ownerActorType: 'player',
        skillName: skill.name,
        skillId: skill.id,
        coefficient: Number(tick.coefficient),
        flatStrikeBase: Number(tick.flatStrikeBase),
        flatStrikePowerCoeff: Number(tick.flatStrikePowerCoeff),
        fulgorSecondary: true,
        noCrit: true
      });
    }
  }

  // Bullet, orb, and trait post-cast owners run last so they observe the state
  // this hook has already settled.
  applyPistolState(context, skill);
  applyHammerState(context, skill);
  applyGenericPostCast(context, skill);
}
