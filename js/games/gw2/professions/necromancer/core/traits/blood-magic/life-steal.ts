import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { appendChargeGrant, consumeChargeBatch, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedEffectRecipients, gw2AlliedPlayerAssumptions } from '#gw2/platform/combat/state/allied-players.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { necromancerActiveMinionCompanionIds } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { TRAITS as NECROMANCER_TRAITS } from '#gw2/professions/necromancer/data/traits-data.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns imperative Core Necromancer Blood Magic trait behavior for ordered dispatcher calls. */

interface TraitDamageDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly flatStrikeBase: number;
  readonly flatStrikePowerCoeff: number;
  readonly icon?: string;
}

/** Queues a flat life-steal trait packet and records matching proc attribution. */
function queueBloodMagicLifeSteal(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, flatStrikeBase, flatStrikePowerCoeff, icon }: TraitDamageDefinition
): void {
  context.effects.emit({
    kind: 'packet',
    event: buildResolverStrike({
      at: event.at,
      skillName: name,
      coefficient: 0,
      flatStrikeBase,
      flatStrikePowerCoeff,

      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillWeapon: 'Unequipped',
      canCrit: false,
      damageKind: 'life-steal',
      ...(icon ? { icon } : {}),
      ...(event.summonOwner ? { summonOwner: event.summonOwner } : {}),
      triggeredBy: event.skillName
    })
  });
  // Mirror the scheduled packet in result-level trait attribution.
  context.effects.emit({
    kind: 'announcement',
    announcement: { type: 'trait', name: name, at: event.at, sourceSkill: event.skillName, detail: '', icon: icon }
  });
}

// Both packet variants explicitly use the granting trait's artwork so the
// minion variant cannot fall back to the icon of the attack that triggered it.
const VAMPIRIC_ICON = NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.VAMPIRIC)?.icon || '';

/** Applies Vampiric to qualifying player, minion, and Ritualist spirit strikes. */
export function applyVampiric(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC)) return;
  const summonHit = event.actorType === 'summon';
  const minionHit = summonHit && event.summonKind !== 'spirit';
  if (event.actorType !== 'player' && !summonHit) return;

  const profile = requireBalanceProfileFromContext(context, TRAIT.VAMPIRIC);
  // Player and minion siphons are separately named, so removing one never borrows the other's values.
  const effect = requireEffect(profile, 'strike', minionHit ? 'minion' : 'player');
  if (!effect) return;
  queueBloodMagicLifeSteal(context, event, {
    name: minionHit ? 'Vampiric — Minion Life Steal' : 'Vampiric',
    traitId: TRAIT.VAMPIRIC,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff'),
    icon: VAMPIRIC_ICON
  });
}

/** Maps a player, spirit, or selected minion hit to its independent Vampiric Presence cooldown owner. */
function vampiricPresenceActorKey(context: NecromancerResolverContext, event: NecromancerResolverEvent): string | null {
  // Spirit attacks are owner-attributed and share the player's proc interval;
  // ordinary minions remain independent capped allied recipients.
  if (event.actorType === 'player' || (event.actorType === 'summon' && event.summonKind === 'spirit')) return 'self';
  if (event.actorType !== 'summon') return null;
  const recipients = gw2AlliedEffectRecipients(context.config, {
    recipients: 'party',
    maximumRecipients: 5,
    eligibleCompanionIds: necromancerActiveMinionCompanionIds(context)
  });
  const owner = event.summonOwner || '';
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
  actorKey: string
): void {
  // Select the live shroud packet and recipient-owned cooldown before materializing the life steal.
  const profile = requireBalanceProfileFromContext(context, TRAIT.VAMPIRIC_PRESENCE);
  const state = professionCoreState(context);
  const inShroud = Boolean(state.activeShroud && state.activeShroud !== 'lich');
  const effect = requireEffect(profile, 'strike', inShroud ? 'shroud' : 'base');
  // The recipient interval gates only the selected siphon, so a removed packet leaves it ready.
  if (!effect) return;
  const cooldownKey = actorKey === 'self' ? 'necromancer.core.vampiricPresence' : `vampiricPresence:${actorKey}`;
  // Every recipient checks the same live cooldown against its actual strike opportunity.
  if (!context.procs.claimCooldown(cooldownKey, event.at, balanceProfileNumber(profile, 'cooldown'))) return;

  // Both player and allied-recipient paths converge on the same attributed packet.
  queueBloodMagicLifeSteal(context, event, {
    name: 'Vampiric Presence',
    traitId: TRAIT.VAMPIRIC_PRESENCE,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff')
  });
}

export function applyVampiricPresence(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  const actorKey = vampiricPresenceActorKey(context, event);
  if (actorKey) queueVampiricPresence(context, event, actorKey);
}

/** An actual allied opportunity claims that recipient's Vampiric Presence cooldown. */
export function reactToVampiricPresenceAlliedHit(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  if (!hasTrait(context, TRAIT.VAMPIRIC_PRESENCE)) return;
  queueVampiricPresence(context, event, `ally:${Number(event.allyIndex || 0)}`);
}

function alliedTasteForBloodRecipient(allyIndex: number): string {
  return `ally:${allyIndex}`;
}

function companionTasteForBloodRecipient(companionId: string): string {
  return `companion:${companionId}`;
}

/** Adds one expiring Taste for Blood application to an independent recipient pool. */
function addTasteForBloodApplication(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  recipient: string
): void {
  const grants = professionCoreState(context).tasteForBloodGrants;
  grants[recipient] = appendChargeGrant(
    grants[recipient] ?? [],
    { ...grantCharges(Math.max(1, event.stacks ?? 1), event.at + Math.max(0, event.duration || 0)), at: event.at },
    event.at,
    'insertion'
  );
}

// Trait-derived Taste for Blood packets and proc markers keep Overflowing
// Thirst artwork so attribution matches the mechanic that granted the stacks.
const OVERFLOWING_THIRST_ICON = NECROMANCER_TRAITS.find((trait) => trait.id === TRAIT.OVERFLOWING_THIRST)?.icon || '';

/**
 * Consumes a recipient charge as Taste for Blood's power-only life-steal packet. Charges exist only to deliver the
 * siphon, so a removed strike leaves them unspent.
 */
function consumeTasteForBlood(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  recipient: string
): void {
  const profile = requireBalanceProfileFromContext(context, TRAIT.OVERFLOWING_THIRST);
  const effect = requireEffect(profile, 'strike', 'Strike');
  // Application time remains owner metadata: future grants cannot pay for an earlier hit.
  const grants = professionCoreState(context).tasteForBloodGrants[recipient] ?? [];
  if (!effect || !consumeChargeBatch(grants, event.at, (grant) => grant.at <= event.at)) return;
  // Taste for Blood is a power-only life siphon, so armor and weapon strength
  // must not enter its flat base plus Power damage formula.
  queueBloodMagicLifeSteal(context, event, {
    name: 'Taste for Blood',
    traitId: TRAIT.OVERFLOWING_THIRST,
    flatStrikeBase: effectNumber(profile, effect, 'flatStrikeBase'),
    flatStrikePowerCoeff: effectNumber(profile, effect, 'flatStrikePowerCoeff'),
    icon: OVERFLOWING_THIRST_ICON
  });
}

/** Gives each selected player or minion its own expiring stack application. */
export function reactToTasteForBloodGrant(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (!hasTrait(context, TRAIT.OVERFLOWING_THIRST)) return;
  if (event.resolvedAudience?.includesSelf) addTasteForBloodApplication(context, event, 'self');
  for (let allyIndex = 1; allyIndex <= (event.resolvedAudience?.alliedPlayerCount || 0); allyIndex += 1) {
    addTasteForBloodApplication(context, event, alliedTasteForBloodRecipient(allyIndex));
  }

  for (const companionId of event.resolvedAudience?.companionIds || []) {
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
  if (allyIndex) consumeTasteForBlood(context, event, alliedTasteForBloodRecipient(allyIndex));
}

export function applyOverflowingThirstDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent
): void {
  const recipient =
    event.actorType === 'player'
      ? 'self'
      : event.actorType === 'summon' && event.summonOwner
        ? companionTasteForBloodRecipient(event.summonOwner)
        : null;
  if (hasTrait(context, TRAIT.OVERFLOWING_THIRST) && recipient) consumeTasteForBlood(context, event, recipient);
}

const TASTE_FOR_BLOOD_STACKS_BY_SKILL = new Map<number, number>([
  [ID.NECROTIC_BITE, 1],
  [ID.LIFE_SIPHON, 3],
  [ID.DARK_PACT, 3],
  [ID.DEATHLY_SWARM, 3],
  [ID.ENFEEBLING_BLOOD, 3]
]);

/** Dagger activations deliver party charges before player, minion, and allied hits spend their individual pools. */
export function applyOverflowingThirstCast(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  const stacks = TASTE_FOR_BLOOD_STACKS_BY_SKILL.get(Number(cast.skill.id)) ?? 0;
  if (!stacks || !hasTrait(runtime, TRAIT.OVERFLOWING_THIRST)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.OVERFLOWING_THIRST);
  const buff = requireEffect(profile, 'buff', 'taste-for-blood');
  if (!buff) return;
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'buff',
      at: runtime.time,
      source: 'Trait',
      sourceId: TRAIT.OVERFLOWING_THIRST,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      kind: String(buff.kind),
      duration: effectNumber(profile, buff, 'duration'),
      stacks,
      audience: {
        recipients: 'party',
        maximumRecipients: 5,
        eligibleCompanionIds: necromancerActiveMinionCompanionIds(runtime)
      }
    }
  });
}

/** Persistent trait listeners consume the common ally strike without maintaining independent clocks. */
export function startNecromancerAlliedOpportunities(runtime: NecromancerRuntime): void {
  const allies = gw2AlliedPlayerAssumptions(runtime.config);
  for (let allyIndex = 1; allyIndex <= allies.count; allyIndex++)
    runtime.alliedStrikes.register({
      id: `necromancer.blood-magic:${allyIndex}`,
      allyIndex,
      trigger(opportunity) {
        const event: NecromancerResolverEvent = {
          type: 'proc',
          at: opportunity.at,
          source: 'Trait',
          sourceId: 'necromancer.blood-magic',
          actorType: 'effect' as const,
          skillName: `Allied Player ${allyIndex} Attack`,
          allyIndex,
          activationId: opportunity.activationId
        };
        reactToVampiricPresenceAlliedHit(runtime, event);
        reactToTasteForBloodAlliedHit(runtime, event);
      }
    });
}
