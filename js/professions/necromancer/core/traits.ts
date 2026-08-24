import { professionCoreState } from '../../../platform/engine/profession/state.js';
import { enqueueOrdered } from '../../../platform/engine/events/queue.js';
import { isInternalCooldownReady } from '../../../platform/engine/core/clock.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { addCarapace } from './shared.js';
import { hasTrait } from '../../../platform/gw2/trait-state.js';
import { onResolvedPlayerCriticalHit } from '../../../platform/gw2/native-profession.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type { Gw2EventDraft } from '../../../platform/gw2/types.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
} from '../types.js';
import {
  NECROMANCER_CORE_BALANCE_PROFILE_IDS as PROFILE,
  balanceProfileEffect,
  necromancerBalanceProfile
} from './profiles.js';

interface TraitDamageDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly flatStrikeBase: number;
  readonly flatStrikePowerCoeff: number;
}

interface TraitConditionDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly condition: string;
  readonly stacks?: number;
  readonly duration: number;
}

interface TraitCoefficientDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly coefficient: number;
  readonly noCrit?: boolean;
}

interface TraitVulnerabilityDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly stacks: number;
  readonly duration: number;
}

function queueTraitDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, flatStrikeBase, flatStrikePowerCoeff }: TraitDamageDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillWeapon: 'Unequipped',
    noCrit: true,
    damageKind: 'life-steal',
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', name, event.at, event.skillName);
}

export function applyTraitCondition(
  details: NecromancerResolverReactionDetails,
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, condition, stacks = 1, duration }: TraitConditionDefinition
): void {
  const application: Gw2EventDraft = {
    type: 'condition',
    at: event.at,
    name: `${name} - ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    triggeredBy: event.skillName
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }

  context.recordProc?.('trait', name, event.at, event.skillName);
}

export function queueTraitCoefficientDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, coefficient, noCrit = true }: TraitCoefficientDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillWeapon: 'Unequipped',
    noCrit,
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', name, event.at, event.skillName);
}

function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return false;
  return Number(context.totals.strike || 0) + Number(context.totals.condition || 0) > maximum * 0.5;
}

// Vampiric adds one non-critical siphon to every direct player hit, while only
// the Necromancer's minions (not Ritualist spirits) use the larger minion packet.
function applyVampiric(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC)) return;
  const minionHit = event.actorType === 'summon' && event.summonKind !== 'spirit';
  if (event.actorType !== 'player' && !minionHit) return;

  const profile = necromancerBalanceProfile(context, PROFILE.vampiric);
  const packetLabel = minionHit ? 'minion' : 'player';
  const effect = profile?.effects?.find(
    (candidate) => candidate.type === 'strike' && candidate.packetLabel === packetLabel
  );
  queueTraitDamage(context, event, {
    name: minionHit ? 'Vampiric — Minion Life Steal' : 'Vampiric',
    traitId: TRAIT.VAMPIRIC,
    flatStrikeBase: Number(effect?.flatStrikeBase || (minionHit ? 50 : 38)),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff || (minionHit ? 0.0213 : 0.003))
  });
}

export function targetIsChilled(context: NecromancerResolverContext, at: number): boolean {
  if (
    context.config.target?.conditions?.Chilled === true ||
    Number(context.config.target?.conditions?.Chilled || 0) > 0
  )
    return true;
  return Number(professionCoreState(context).targetChilledUntil || 0) > at;
}

export function usesRandomTraitProcs(context: NecromancerResolverContext): boolean {
  return context.random?.stochastic === true;
}

export function rolledCritical(details: NecromancerResolverReactionDetails): boolean {
  return details.hitContext?.critical?.didCrit === true;
}

function hasActiveBuff(context: NecromancerResolverContext, kind: string, at: number): boolean {
  return (context.boons.get(kind) || []).some(
    (application) => application.at <= at && application.expiresAt > at && application.stacks > 0
  );
}

export function applyTraitVulnerability(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, stacks, duration }: TraitVulnerabilityDefinition
): void {
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: event.at,
    name,
    skillName: name,
    condition: 'Vulnerability',
    stacks,
    duration,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', name, event.at, event.skillName);
}

export function reactToNecromancerCoreDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  if (event.actorType === 'effect' || !(Number(event.coefficient) > 0)) {
    return;
  }

  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const shroudSkillOne = skill?.shroudSlot === 1 || event.necromancerShroudSkillOne === true;
  applyVampiric(context, event);
  if (hasTrait(context, TRAIT.REAPERS_MIGHT) && firstHit && shroudSkillOne) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.reapersMight), 'boon');
    enqueueOrdered(context.queue, {
      type: 'buff',
      at: event.at,
      name: "Reaper's Might",
      skillName: "Reaper's Might",
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 15),
      source: 'Trait',
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: 'effect',
      triggeredBy: event.skillName
    });
    context.recordProc?.('trait', "Reaper's Might", event.at, event.skillName);
  }

  if (
    hasTrait(context, TRAIT.SIPHONED_POWER) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.siphonedPower || 0))
  ) {
    const profile = necromancerBalanceProfile(context, PROFILE.siphonedPower);
    const effect = balanceProfileEffect(profile, 'boon');
    professionCoreState(context).traitProcReadyAt.siphonedPower = event.at + Number(profile?.cooldown || 1);
    enqueueOrdered(context.queue, {
      type: 'buff',
      at: event.at,
      name: 'Siphoned Power',
      skillName: 'Siphoned Power',
      kind: String(effect?.boon || 'might'),
      stacks: Number(effect?.stacks || 3),
      duration: Number(effect?.duration || 8),
      source: 'Trait',
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: 'effect',
      triggeredBy: event.skillName
    });
    context.recordProc?.('trait', 'Siphoned Power', event.at, event.skillName);
  }

  if (hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) && event.actorType === 'player' && targetBelowHalfHealth(context)) {
    professionCoreState(context).spitefulFortitudeLifeForce =
      Number(professionCoreState(context).spitefulFortitudeLifeForce || 0) +
      Number(necromancerBalanceProfile(context, PROFILE.spitefulFortitude)?.lifeForceGain || 1) *
        (hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1);
  }

  if (
    hasTrait(context, TRAIT.CHILL_OF_DEATH) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.chillOfDeath || 0))
  ) {
    const profile = necromancerBalanceProfile(context, PROFILE.chillOfDeath);
    professionCoreState(context).traitProcReadyAt.chillOfDeath = event.at + Number(profile?.cooldown || 16);
    const boons = context.config.target?.boonless
      ? 0
      : Math.min(
          3,
          Math.max(
            0,
            Number(
              context.config.target?.boonCount ??
                (Array.isArray(context.config.target?.boons) ? context.config.target.boons.length : 1)
            )
          )
        );
    const coefficient = Number(
      profile?.effects?.filter((effect) => effect.type === 'strike')[boons]?.coefficient || [0.6, 0.9, 1.5, 2.1][boons]
    );
    queueTraitCoefficientDamage(context, event, {
      name: 'Lesser Spinal Shivers',
      traitId: TRAIT.CHILL_OF_DEATH,
      coefficient,
      noCrit: true
    });
    enqueueOrdered(context.queue, {
      type: 'necromancer.chill',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: 'effect',
      skillName: 'Lesser Spinal Shivers',
      duration: Number(balanceProfileEffect(profile, 'condition')?.duration || 5)
    });
  }

  if (hasTrait(context, TRAIT.DHUUMFIRE) && shroudSkillOne) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.dhuumfire), 'condition');
    const interval = Number(event.dhuumfireInterval || 0);
    if (
      interval > 0 &&
      !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt?.dhuumfire || 0))
    ) {
      // Variant-specific internal cooldown supplied by the owning handler.
    } else {
      if (interval > 0) {
        professionCoreState(context).traitProcReadyAt.dhuumfire = event.at + interval;
      }

      applyTraitCondition(details, context, event, {
        name: 'Dhuumfire',
        traitId: TRAIT.DHUUMFIRE,
        condition: String(effect?.condition || 'Burning'),
        stacks: Number(effect?.stacks || 1),
        duration: Number(event.dhuumfireDuration ?? skill?.dhuumfireDuration ?? effect?.duration ?? 3)
      });
    }
  }

  if (hasTrait(context, TRAIT.UNYIELDING_BLAST) && firstHit && shroudSkillOne) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.unyieldingBlast), 'condition');
    applyTraitVulnerability(context, event, {
      name: 'Unyielding Blast',
      traitId: TRAIT.UNYIELDING_BLAST,
      stacks: Number(effect?.stacks || 2),
      duration: Number(effect?.duration || 10)
    });
  }

  necromancerBarbedPrecisionReaction.handler(context, event, details);
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE) &&
    isInternalCooldownReady(event.at, Number(professionCoreState(context).vampiricPresenceReadyAt || 0))
  ) {
    const profile = necromancerBalanceProfile(context, PROFILE.vampiricPresence);
    const effect = balanceProfileEffect(profile, 'strike');
    professionCoreState(context).vampiricPresenceReadyAt = event.at + Number(profile?.cooldown || 1);
    queueTraitDamage(context, event, {
      name: 'Vampiric Presence',
      traitId: TRAIT.VAMPIRIC_PRESENCE,
      flatStrikeBase: Number(effect?.flatStrikeBase || 80),
      flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff || 0.03)
    });
  }

  if (hasTrait(context, TRAIT.OVERFLOWING_THIRST) && hasActiveBuff(context, 'taste-for-blood', event.at)) {
    queueTraitDamage(context, event, {
      name: 'Taste for Blood',
      traitId: TRAIT.OVERFLOWING_THIRST,
      flatStrikeBase: 325,
      flatStrikePowerCoeff: 0
    });
  }
}

export const necromancerBarbedPrecisionReaction = onResolvedPlayerCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: 'necromancer.barbed-precision',
  order: 0,
  actorTypes: ['player', 'summon', 'unknown'],
  chanceOnCriticalHit: (context) =>
    Number(necromancerBalanceProfile(context, PROFILE.barbedPrecision)?.criticalChance || 0.33),
  randomStream: 'necromancer.barbed-precision',
  when: (context, event) => Number(event.coefficient) > 0 && hasTrait(context, TRAIT.BARBED_PRECISION),
  expectedProgress: {
    get: (context) => professionCoreState(context).barbedPrecisionProgress,
    set: (context, value) => {
      professionCoreState(context).barbedPrecisionProgress = value;
    }
  },
  attribution: { kind: 'trait', id: TRAIT.BARBED_PRECISION },
  handler: (context, event, details) => {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.barbedPrecision), 'condition');
    applyTraitCondition(details, context, event, {
      name: 'Barbed Precision',
      traitId: TRAIT.BARBED_PRECISION,
      condition: String(effect?.condition || 'Bleeding'),
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 3)
    });
  }
});

export function reactToNecromancerCoreCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  if (event.condition === 'Chilled') {
    professionCoreState(context).targetChilledUntil = Math.max(
      Number(professionCoreState(context).targetChilledUntil || 0),
      event.at + Number(event.effectiveDuration ?? event.duration ?? 0)
    );
    if (hasTrait(context, TRAIT.BITTER_CHILL)) {
      enqueueOrdered(context.queue, {
        type: 'condition',
        at: event.at,
        name: 'Bitter Chill',
        skillName: 'Bitter Chill',
        condition: 'Vulnerability',
        stacks: 3,
        duration: 8,
        source: 'Trait',
        sourceId: TRAIT.BITTER_CHILL,
        actorType: 'effect',
        triggeredBy: event.skillName
      });
      context.recordProc?.('trait', 'Bitter Chill', event.at, event.skillName);
    }
  }

  if (event.actorType !== 'summon' && hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) {
    addCarapace(professionCoreState(context), 1, event.at);
  }
}

export function reactToNecromancerBlind(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  if (
    !hasTrait(context, TRAIT.CHILLING_DARKNESS) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.chillingDarkness || 0))
  )
    return;
  const profile = necromancerBalanceProfile(context, PROFILE.chillingDarkness);
  const effect = balanceProfileEffect(profile, 'condition');
  professionCoreState(context).traitProcReadyAt.chillingDarkness = event.at + Number(profile?.cooldown || 3);
  applyTraitCondition(details, context, event, {
    name: 'Chilling Darkness',
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: String(effect?.condition || 'Chilled'),
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 2)
  });
}

export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {}
): void {
  professionCoreState(context).targetControlledUntil = Math.max(
    Number(professionCoreState(context).targetControlledUntil || 0),
    event.at + Math.max(0.001, Number(event.duration || 0))
  );
  if (event.controlKind === 'fear' || event.kind === 'fear') {
    professionCoreState(context).dreadUntil = Math.max(
      Number(professionCoreState(context).dreadUntil || 0),
      event.at + 3
    );
    if (hasTrait(context, TRAIT.TERROR)) {
      applyTraitCondition(details, context, event, {
        name: 'Terror',
        traitId: TRAIT.TERROR,
        condition: 'Fear',
        duration: Number(event.duration || 1)
      });
    }
  }

  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.insidiousDisruption), 'condition');
    applyTraitCondition(details, context, event, {
      name: 'Insidious Disruption',
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: String(effect?.condition || 'Torment'),
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 5)
    });
  }
}
