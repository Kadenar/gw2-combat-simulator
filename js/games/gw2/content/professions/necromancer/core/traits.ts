import { professionCoreState } from '../../../../platform/engine/profession/state.js';
import { enqueueOrdered } from '../../../../../../kernel/events/queue.js';
import { isInternalCooldownReady } from '../../../../../../kernel/core/clock.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '../data/ids.js';
import { TRAITS as NECROMANCER_TRAITS } from '../data/traits-data.js';
import { addCarapace, necromancerActiveMinionCompanionIds } from './shared.js';
import { hasTrait } from '../../../../platform/combat/state/traits.js';
import { combinedTargetDamage } from '../../../../platform/combat/state/target-health.js';
import { gw2AlliedEffectRecipients } from '../../../../platform/combat/state/allied-players.js';
import { onResolvedCriticalHit } from '../../../../integrations/patches/authoring/mechanics.js';
import { gw2ResolverBoonDuration } from '../../../../platform/resolver/boon-duration.js';
import type { SkillId } from '../../../../platform/engine/types.js';
import type { Gw2EventDraft } from '../../../../platform/equipment/relics/types.js';
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
  readonly icon?: string;
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
  readonly damageKind?: string;
  readonly icon?: string;
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
  { name, traitId, flatStrikeBase, flatStrikePowerCoeff, icon }: TraitDamageDefinition
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
    ...(icon ? { icon } : {}),
    ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
    triggeredBy: event.skillName
  });
  context.recordProc?.('trait', name, event.at, event.skillName, '', icon);
}

export function applyTraitCondition(
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
  // Resolver-derived trait conditions enter canonical state immediately so
  // chained condition reactions preserve their causal timestamp ordering.
  context.applyCondition(application);

  context.recordProc?.('trait', name, event.at, event.skillName);
}

export function queueTraitCoefficientDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, coefficient, noCrit = true, damageKind, icon }: TraitCoefficientDefinition
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
    ...(damageKind ? { damageKind } : {}),
    ...(icon ? { icon } : {}),
    ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
    triggeredBy: event.skillName
  });
  // Proc markers need the derived effect's artwork because their display name
  // does not necessarily match either the granting trait or triggering skill.
  context.recordProc?.('trait', name, event.at, event.skillName, '', icon);
}

function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return false;
  return combinedTargetDamage(context) > maximum * 0.5;
}

// Both packet variants explicitly use the granting trait's artwork so the
// minion variant cannot fall back to the icon of the attack that triggered it.
const VAMPIRIC_ICON = String(NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.VAMPIRIC)?.icon || '');

// Ritualist spirit attacks proc the owner's Vampiric packet. Ordinary Necromancer minions use the larger packet.
function applyVampiric(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC)) return;
  const summonHit = event.actorType === 'summon';
  const minionHit = summonHit && event.summonKind !== 'spirit';
  if (event.actorType !== 'player' && !summonHit) return;

  const profile = necromancerBalanceProfile(context, PROFILE.vampiric);
  const packetLabel = minionHit ? 'minion' : 'player';
  const effect = profile?.effects?.find(
    (candidate) => candidate.type === 'strike' && candidate.packetLabel === packetLabel
  );
  queueTraitDamage(context, event, {
    name: minionHit ? 'Vampiric — Minion Life Steal' : 'Vampiric',
    traitId: TRAIT.VAMPIRIC,
    flatStrikeBase: Number(effect?.flatStrikeBase || (minionHit ? 50 : 38)),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff || (minionHit ? 0.0213 : 0.003)),
    icon: VAMPIRIC_ICON
  });
}

function vampiricPresenceActorKey(context: NecromancerResolverContext, event: NecromancerResolverEvent): string | null {
  // Spirit attacks are owner-attributed and share the player's proc interval;
  // ordinary minions remain independent capped allied recipients.
  if (event.actorType === 'player' || (event.actorType === 'summon' && event.summonKind === 'spirit')) return 'self';
  if (event.actorType !== 'summon') return null;
  const recipients = gw2AlliedEffectRecipients(context.config, {
    maximumRecipients: 5,
    companionIds: necromancerActiveMinionCompanionIds(context)
  });
  const owner = String(event.summonOwner || '');
  if (owner && recipients.companionIds.includes(owner)) return owner;
  if (!owner && recipients.companionIds.length > 0) {
    return `summon:${String(event.sourceId || event.skillId || event.skillName || 'unknown')}`;
  }

  return null;
}

// Vampiric Presence has a per-recipient interval and swaps to its stronger
// packet only for real Necromancer Shroud forms; Lich Form is a transform.
function queueVampiricPresence(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  actorKey: string,
  intervalAlreadyApplied = false
): void {
  const profile = necromancerBalanceProfile(context, PROFILE.vampiricPresence);
  const state = professionCoreState(context);
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  const packetLabel = inShroud ? 'shroud' : 'base';
  const effect = profile?.effects?.find(
    (candidate) => candidate.type === 'strike' && candidate.packetLabel === packetLabel
  );
  const readyAt =
    actorKey === 'self'
      ? Number(state.vampiricPresenceReadyAt || 0)
      : Number(state.traitProcReadyAt[`vampiricPresence:${actorKey}`] || 0);
  if (!intervalAlreadyApplied && !isInternalCooldownReady(event.at, readyAt)) return;

  if (!intervalAlreadyApplied) {
    const nextAt = event.at + Number(profile?.cooldown ?? 0.5);
    if (actorKey === 'self') state.vampiricPresenceReadyAt = nextAt;
    else state.traitProcReadyAt[`vampiricPresence:${actorKey}`] = nextAt;
  }

  queueTraitDamage(context, event, {
    name: 'Vampiric Presence',
    traitId: TRAIT.VAMPIRIC_PRESENCE,
    flatStrikeBase: Number(effect?.flatStrikeBase ?? (inShroud ? 129 : 65)),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff ?? (inShroud ? 0.0666 : 0.0333))
  });
}

export function reactToVampiricPresenceAlliedHit(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  queueVampiricPresence(context, event, `ally:${Number(event.allyIndex || 0)}`, true);
}

export function targetIsChilled(context: NecromancerResolverContext, at: number): boolean {
  if (
    context.config.target?.conditions?.Chilled === true ||
    Number(context.config.target?.conditions?.Chilled || 0) > 0
  )
    return true;
  return Number(professionCoreState(context).targetChilledUntil || 0) > at;
}

// Taste for Blood uses generic buff reporting while profession-owned pools
// preserve independent charge consumption for every affected recipient.
function consumeTasteForBloodBuff(context: NecromancerResolverContext, recipient: string, at: number): boolean {
  const buffs = professionCoreState(context).tasteForBloodBuffs;
  const applications = buffs[recipient] || [];
  const index = applications.findIndex(
    (application) => application.at <= at && application.expiresAt > at && application.stacks > 0
  );
  if (index < 0) return false;

  const application = applications[index];
  if (application.stacks === 1) {
    applications.splice(index, 1);
  } else {
    applications[index] = { ...application, stacks: application.stacks - 1 };
  }

  buffs[recipient] = applications;
  return true;
}

function alliedTasteForBloodRecipient(allyIndex: number): string {
  return `ally:${allyIndex}`;
}

function companionTasteForBloodRecipient(companionId: string): string {
  return `companion:${companionId}`;
}

function addTasteForBloodApplication(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  recipient: string
): void {
  const buffs = professionCoreState(context).tasteForBloodBuffs;
  const applications = (buffs[recipient] || []).filter(
    (application) => application.expiresAt > event.at && application.stacks > 0
  );
  applications.push({
    at: event.at,
    expiresAt: event.at + Math.max(0, Number(event.duration || 0)),
    stacks: Math.max(1, Number(event.stacks || 1))
  });
  buffs[recipient] = applications;
}

// Trait-derived Taste for Blood packets and proc markers keep Overflowing
// Thirst artwork so attribution matches the mechanic that granted the stacks.
const OVERFLOWING_THIRST_ICON = String(
  NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon || ''
);

function queueTasteForBlood(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.overflowingThirst), 'strike');
  // Taste for Blood is a power-only life siphon, so armor and weapon strength
  // must not enter its 375 + 0.05 * Power damage formula.
  queueTraitDamage(context, event, {
    name: 'Taste for Blood',
    traitId: TRAIT.OVERFLOWING_THIRST,
    flatStrikeBase: Number(effect?.flatStrikeBase ?? 375),
    flatStrikePowerCoeff: Number(effect?.flatStrikePowerCoeff ?? 0.05),
    icon: OVERFLOWING_THIRST_ICON
  });
}

/** Gives each selected player or minion its own expiring stack application. */
export function reactToTasteForBloodGrant(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  if (event.affectsSelf !== false) addTasteForBloodApplication(context, event, 'self');
  for (let allyIndex = 1; allyIndex <= Number(event.alliedPlayerCount || 0); allyIndex += 1) {
    addTasteForBloodApplication(context, event, alliedTasteForBloodRecipient(allyIndex));
  }

  for (const companionId of Array.isArray(event.companionIds) ? event.companionIds.map(String) : []) {
    addTasteForBloodApplication(context, event, companionTasteForBloodRecipient(companionId));
  }
}

/** An allied hit consumes only that ally's Taste for Blood stack pool. */
export function reactToTasteForBloodAlliedHit(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  const allyIndex = Number(event.allyIndex || 0);
  if (!allyIndex || !consumeTasteForBloodBuff(context, alliedTasteForBloodRecipient(allyIndex), event.at)) return;
  queueTasteForBlood(context, event);
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
      duration: gw2ResolverBoonDuration(
        context,
        event,
        String(effect?.boon || 'might'),
        Number(effect?.duration || 15)
      ),
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
      duration: gw2ResolverBoonDuration(context, event, String(effect?.boon || 'might'), Number(effect?.duration || 8)),
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

      applyTraitCondition(context, event, {
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
  if (hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) {
    const actorKey = vampiricPresenceActorKey(context, event);
    if (actorKey) queueVampiricPresence(context, event, actorKey);
  }

  const tasteForBloodRecipient =
    event.actorType === 'player'
      ? 'self'
      : event.actorType === 'summon' && event.summonOwner
        ? companionTasteForBloodRecipient(String(event.summonOwner))
        : null;
  if (
    hasTrait(context, TRAIT.OVERFLOWING_THIRST) &&
    tasteForBloodRecipient &&
    consumeTasteForBloodBuff(context, tasteForBloodRecipient, event.at)
  ) {
    queueTasteForBlood(context, event);
  }
}

export const necromancerBarbedPrecisionReaction = onResolvedCriticalHit<
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails
>({
  id: 'necromancer.barbed-precision',
  order: 0,
  materialization: 'threshold',
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
  handler: (context, event, _details, application) => {
    // Barbed Precision emits one condition application per threshold proc.
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.barbedPrecision), 'condition');
      applyTraitCondition(context, event, {
        name: 'Barbed Precision',
        traitId: TRAIT.BARBED_PRECISION,
        condition: String(effect?.condition || 'Bleeding'),
        stacks: Number(effect?.stacks || 1),
        duration: Number(effect?.duration || 3)
      });
    }
  }
});

// Route resolved conditions into Necromancer trait reactions after the source
// condition has been accepted by the resolver.
export function reactToNecromancerCoreCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
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

// Convert a qualifying Blind into ICD-bound Chilling Darkness through the
// resolver's condition application hook.
export function reactToNecromancerBlind(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.CHILLING_DARKNESS) ||
    !isInternalCooldownReady(event.at, Number(professionCoreState(context).traitProcReadyAt.chillingDarkness || 0))
  )
    return;
  const profile = necromancerBalanceProfile(context, PROFILE.chillingDarkness);
  const effect = balanceProfileEffect(profile, 'condition');
  professionCoreState(context).traitProcReadyAt.chillingDarkness = event.at + Number(profile?.cooldown || 3);
  applyTraitCondition(context, event, {
    name: 'Chilling Darkness',
    traitId: TRAIT.CHILLING_DARKNESS,
    condition: String(effect?.condition || 'Chilled'),
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 2)
  });
}

// Record target-control and Dread windows, then attach fear-specific Terror and
// the generic Insidious Disruption condition to the originating control event.
export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
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
      applyTraitCondition(context, event, {
        name: 'Terror',
        traitId: TRAIT.TERROR,
        condition: 'Fear',
        duration: Number(event.duration || 1)
      });
    }
  }

  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    const effect = balanceProfileEffect(necromancerBalanceProfile(context, PROFILE.insidiousDisruption), 'condition');
    applyTraitCondition(context, event, {
      name: 'Insidious Disruption',
      traitId: TRAIT.INSIDIOUS_DISRUPTION,
      condition: String(effect?.condition || 'Torment'),
      stacks: Number(effect?.stacks || 1),
      duration: Number(effect?.duration || 5)
    });
  }
}
