import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import type { ActionContext } from '#gw2/platform/simulation/side-effects.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';

import { armSkillFlip, consumeSkillFlip, skillFlipVisible } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { addVenomCharges, conditionEffects, venomForSkill } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { guildAttackConditions, thiefSpecializationGuildSummon } from '#gw2/professions/thief/family-state.js';
import { emitThiefCondition, emitThiefDamage } from '#gw2/professions/thief/core/events.js';

import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { AutoattackChainTransitionResult } from '#gw2/platform/skills/autoattack-chain-controller.js';
import type { ThiefSkill, ThiefSummonDefinition } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

export const THIEF_SCEPTER_CHAIN_EXPIRY = 'thief.scepter-chain-expire';
export const THIEF_GUILD_ATTACK = 'thief.thieves-guild-attack';
export const THIEF_GUILD_EXPIRY = 'thief.thieves-guild-expire';
export const THIEF_AXE_LAND = 'thief.axe-land';

const SPEAR_STEALTH_SKILLS = new Set<SkillId>([ID.ASHEN_ASSAULT]);

interface TrapDefinition {
  readonly prepareId: SkillId;
  readonly triggerId: SkillId;
  readonly name: string;
  readonly reason: string;
}

export const THIEF_PREPARATIONS: readonly TrapDefinition[] = Object.freeze([
  {
    prepareId: ID.PREPARE_THOUSAND_NEEDLES,
    triggerId: ID.THOUSAND_NEEDLES,
    name: 'Thousand Needles',
    reason: 'thousand-needles'
  },
  { prepareId: ID.PREPARE_PITFALL, triggerId: ID.PITFALL, name: 'Pitfall', reason: 'pitfall' }
]);

/** Each preparation stays flipped until triggered; its trigger waits out the recharge-scaled arming delay. */
export function thiefTrapAvailability(runtime: ThiefRuntime, skill: ThiefSkill): AvailabilityResult | null {
  const trap = THIEF_PREPARATIONS.find(
    (candidate) => candidate.prepareId === skill.id || candidate.triggerId === skill.id
  );
  if (!trap) return null;
  const window = runtime.profession.core.availableFlips[trap.triggerId];
  if (skill.id === trap.prepareId && skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, `thief.${trap.reason}-prepared`, `activate ${trap.name} before preparing it again.`);
  if (skill.id === trap.triggerId && !skillFlipVisible(window, runtime.time))
    return denySkillCast(skill, `thief.${trap.reason}`, `prepare ${trap.name} first.`);
  if (skill.id === trap.triggerId && window.availableAt > runtime.time)
    return denySkillCast(skill, `thief.${trap.reason}-arming`, 'the preparation is still arming.', window.availableAt);
  return null;
}

/** A committed placement exposes its trigger immediately; the trigger arms after a recharge-scaled delay. */
export function prepareTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.prepareId === cast.skill.id);
  if (!trap) return;
  const skill = cast.skill;
  const delay = Number(skill.durationMultiplier ?? 3) / runtime.cooldownController.rate(cast.skill);
  armSkillFlip(runtime.profession.core.availableFlips, trap.triggerId, runtime.time + delay, Infinity, runtime.time);
}

/** Triggering consumes the trap and mirrors its short rearm onto an already-recharged placement skill. */
export function activateTrap(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.triggerId === cast.skill.id);
  if (!trap) return;
  consumeSkillFlip(runtime.profession.core.availableFlips, trap.triggerId);
  const triggerReadyAt = runtime.cooldowns.get(trap.triggerId);
  if (triggerReadyAt == null || triggerReadyAt <= (runtime.cooldowns.get(trap.prepareId) || 0)) return;
  const placement = runtime.helpers.skillsById.get(trap.prepareId);
  if (placement) runtime.cooldownController.startRecharge(placement, cast.rechargeStart, cast.rechargeWork);
}

/** Arms the caster's finite venom charges and queues each assumed ally's bounded proc sequence. */
export function activateVenom(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const venom = venomForSkill(cast.skill.id);
  if (!venom) return;
  const core = runtime.profession.core;
  const at = runtime.time;
  const profile = requireBalanceProfileFromContext(runtime, venom.profileId);
  const maximumStacks = balanceProfileNumber(profile, 'maximumStacks');
  const duration = balanceProfileNumber(profile, 'durationMultiplier');
  addVenomCharges(core, cast.skill.id, at, maximumStacks, duration);
  // Recasts queue behind remaining ally charges, keeping one proc per assumed strike.
  const alliedStart = Math.max(at, core.venomAllyLastProcAt[String(cast.skill.id)] ?? at);
  const alliedProcs = gw2AlliedPlayerProcTimeline(runtime.config, {
    start: alliedStart,
    duration: Math.max(0, at + duration - alliedStart),
    maximumPerAlly: maximumStacks
  });
  if (alliedProcs.length)
    core.venomAllyLastProcAt[String(cast.skill.id)] = Math.max(...alliedProcs.map((proc) => proc.at));
  const packets = conditionEffects(profile).map((effect) => ({
    effect,
    stacks: effectNumber(profile, effect, 'stacks'),
    duration: effectNumber(profile, effect, 'duration')
  }));
  for (const proc of alliedProcs)
    for (const [effectIndex, { effect, stacks, duration: conditionDuration }] of packets.entries())
      emitThiefCondition(runtime, null, {
        at: proc.at,
        skillId: venom.skillId,
        skillName: venom.skillName,
        name: `${venom.skillName} — Ally ${proc.allyIndex} ${effect.condition}`,
        condition: String(effect.condition),
        stacks,
        duration: conditionDuration,
        activationId: `${cast.id}:ally:${proc.allyIndex}:${proc.procIndex}`,
        metadata: { triggeredByAlly: proc.allyIndex, venomProcEffectIndex: effectIndex }
      });
}

/** Spear stages advance on committed attacks; Distracting Throw after a finisher arms its damage window. */
export function updateSpearChain(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  const stage = spearChainStageForSkill(skill.id);
  if (stage != null) {
    core.spearChainStage = (stage + 1) % 3;
    core.spearLastWasFinisher = stage === 2;
    core.spearPreviousSkillId = skill.id;
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW && (core.spearLastWasFinisher || (core.spearChainStage || 0) === 0)) {
    const followsFinisher = core.spearLastWasFinisher;
    core.spearChainStage = 1;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
    // The committed window follows the throw's own same-time packets, so it buffs subsequent damage only.
    if (followsFinisher) runtime.schedule('thief.distracting-throw-window', runtime.time, undefined, undefined, 20);
    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(skill.id)) {
    core.spearChainStage = 0;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
  }
}

/** Open the finisher reward after the granting throw has resolved at the commitment instant. */
export function grantDistractingThrowWindow(runtime: ThiefRuntime): void {
  runtime.profession.core.distractingThrowBuffUntil =
    runtime.time +
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.distractingThrow), 'durationMultiplier');
}

/** A landed hit continues outward before occupying a ground slot; recall can intercept that flight. */
export function grantThiefGroundAxe(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'effect') return;
  const event = context.trigger.event;
  const axe = {
    id: `${event.activationId}:${event.effectReaction?.packet}`,
    skillId: context.skill.id,
    // Melee EVTC missile lifetimes: ordinary axes continue ~560ms after hitting; Salvo ~720ms.
    landsAt: canonicalTime(runtime.time + (context.skill.stealthAttack ? 0.72 : 0.56))
  };
  runtime.profession.core.outboundAxes.push(axe);
  runtime.schedule(THIEF_AXE_LAND, axe.landsAt, { id: axe.id });
}

/** Lower-priority ground axes are replaced first; age breaks ties within a projectile type. */
function axePriority(skillId: SkillId): number {
  if (skillId === ID.CUNNING_SALVO || skillId === ID.MALICIOUS_CUNNING_SALVO) return 2;
  return skillId === ID.VENOMOUS_VOLLEY ? 1 : 0;
}

/** Only landing claims one of six slots; a recalled flight makes its queued landing a no-op. */
export function landThiefAxe(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  const index = core.outboundAxes.findIndex((axe) => axe.id === (data as { id: string }).id);
  if (index < 0) return;
  const [landed] = core.outboundAxes.splice(index, 1);
  core.spinningAxes = core.spinningAxes.filter((axe) => axe.expiresAt > runtime.time);
  if (core.spinningAxes.length >= 6) {
    const lowestPriority = Math.min(...core.spinningAxes.map((axe) => axePriority(axe.skillId)));
    // Fizzling leaves protected axes and their expiry times intact.
    if (lowestPriority > axePriority(landed.skillId)) return;
    const replace = core.spinningAxes.findIndex((axe) => axePriority(axe.skillId) === lowestPriority);
    core.spinningAxes.splice(replace, 1);
  }

  core.spinningAxes.push({ skillId: landed.skillId, expiresAt: canonicalTime(runtime.time + 10) });
}

/** Recall repeats each live projectile's base effects, without creating new axes or scaling poison by malice again. */
export function recallThiefAxes(runtime: ThiefRuntime, context: ActionContext<ThiefSkill>): void {
  if (context.kind !== 'cast') return;
  const axes = [
    ...runtime.profession.core.spinningAxes.filter((axe) => axe.expiresAt > runtime.time),
    ...runtime.profession.core.outboundAxes
  ];
  // Returning packets own the recalled generation; later throws start a fresh ground/flight pool.
  runtime.profession.core.spinningAxes = [];
  runtime.profession.core.outboundAxes = [];
  const torment = context.skill.id === ID.HARROWING_STORM;
  const arrivals = axes.map((axe) => {
    const skill = runtime.helpers.skillsById.get(axe.skillId)!;
    // Melee return travel differs by projectile; Harrowing Storm keeps its immediate target arrival.
    const delay = torment ? 0 : skill.stealthAttack ? 0.04 : skill.id === ID.VENOMOUS_VOLLEY ? 0.48 : 0.52;
    return { skill, at: canonicalTime(runtime.time + delay) };
  });
  // The fifth arriving projectile owns immobilize, even when a later-emitted Salvo returns first.
  arrivals.sort((a, b) => a.at - b.at);
  for (const [index, { skill, at }] of arrivals.entries()) {
    const projectiles = skill.id === ID.VENOMOUS_VOLLEY ? 3 : 1;
    emitEffects(runtime, {
      owner: skill,
      effects: skill.effects?.map((effect) => ({
        ...effect,
        // Keep impact refunds, but returning projectiles never replenish the ground pool.
        reactions: effect.reactions?.filter(
          (reaction) => !('type' in reaction.do && reaction.do.type === 'thief.ground-axe')
        ),
        ...(effect.type === 'strike'
          ? { coefficient: (Number(effect.coefficient) / projectiles) * (torment ? 1 : 1.33), hits: 1 }
          : {}),
        ...(effect.type === 'condition' ? { stacks: Number(effect.stacks) / projectiles } : {})
      })),
      skillWeaponFallback: 'Axe',
      baseEvent: {
        source: 'thief',
        sourceId: skill.id,
        skillId: skill.id,
        skillName: skill.name,
        actorType: 'player',
        activationId: context.cast.id,
        metadata: { recallSkillId: context.skill.id }
      },
      transform: (event) => ({
        ...event,
        at,
        name: `${event.name} (Recall)`,
        offTarget: context.cast.command.offTarget
      })
    });
    // Recall adds its condition per returning axe; a target's condition cap can hide later applications in EVTC.
    emitThiefCondition(runtime, context.skill, {
      at,
      activationId: context.cast.id,
      offTarget: context.cast.command.offTarget,
      condition: torment ? 'Torment' : 'Weakness',
      stacks: 1,
      duration: torment ? 2 : 1
    });
    // Five returning hits trigger one immobilize; five is a threshold, not a cap on returning axes.
    if (index === 4)
      emitThiefCondition(runtime, context.skill, {
        at,
        activationId: context.cast.id,
        offTarget: context.cast.command.offTarget,
        condition: 'Immobilized',
        stacks: 1,
        duration: 1.5
      });
  }
}

/** Only a successful scepter chain step refreshes its three-second window from cast completion. */
export function transitionThiefScepterChain(
  runtime: ThiefRuntime,
  cast: RuntimeCast<ThiefSkill>,
  result: AutoattackChainTransitionResult
): void {
  const change = result.transitions.find((entry) => entry.chainRootId === ID.SHADOW_BOLT);
  if (!result.committed || !change || change.decision === 'preserve') return;
  const core = runtime.profession.core;
  core.scepterChainExpiresAt = change.decision === 'advance' ? canonicalTime(cast.effectiveEnd + 3) : null;
  if (core.scepterChainExpiresAt != null)
    runtime.schedule(THIEF_SCEPTER_CHAIN_EXPIRY, core.scepterChainExpiresAt, { at: core.scepterChainExpiresAt });
}

/** Restores Shadow Bolt when the continuation window closes, including while other skills are casting. */
export function expireThiefScepterChain(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if ((data as { at: number }).at !== core.scepterChainExpiresAt) return;
  core.scepterChainExpiresAt = null;
  resetAutoattackChains(runtime, [ID.SHADOW_BOLT]);
}

/** Assassin's Signet opens its active window and suppresses its passive until the signet recharges. */
export function activateAssassinsSignet(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.assassinsSignet);
  core.assassinsSignetActiveUntil = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  core.assassinsSignetPassiveDisabledUntil = runtime.cooldowns.get(ID.ASSASSINS_SIGNET) ?? runtime.time;
}

interface GuildAttackWork {
  readonly ownerId: string;
  readonly summonIndex: number;
  readonly attackIndex: number;
  readonly occurrence: number;
}

/** The two shared thieves plus the active specialization's third summon (Core Thief otherwise). */
function thievesGuildSummons(runtime: ThiefRuntime): ThiefSummonDefinition[] {
  const skill: ThiefSkill | undefined = runtime.helpers.skillsById.get(ID.THIEVES_GUILD);
  const profile = skill?.summonAttack;
  if (!profile) return [];
  const third =
    thiefSpecializationGuildSummon(runtime.profession.specialization.kind) ||
    profile.summons.find((summon) => summon.variant === 'Core Thief');
  return [...profile.summons.filter((summon) => summon.variant == null), ...(third ? [third] : [])];
}

/** A committed summon replaces any active guild; its streams start with combat. */
export function summonThievesGuild(runtime: ThiefRuntime, cast: RuntimeCast<ThiefSkill>): void {
  const profile = cast.skill.summonAttack;
  if (!profile) return;
  const core = runtime.profession.core;
  const expiresAt = canonicalTime(cast.start + (profile.duration || 0));
  core.activeThievesGuild = {
    ownerId: `${cast.id}:thieves-guild`,
    expiresAt,
    started: false
  };
  runtime.schedule(THIEF_GUILD_EXPIRY, expiresAt, { ownerId: core.activeThievesGuild.ownerId });
  if (runtime.combatActive) startThievesGuild(runtime);
}

/** Starts every authored attack stream once, at the accepted combat boundary or the summon itself. */
export function startThievesGuild(runtime: ThiefRuntime): void {
  const active = runtime.profession.core.activeThievesGuild;
  if (!active || active.started || runtime.time >= active.expiresAt) return;
  active.started = true;
  for (const [summonIndex, summon] of thievesGuildSummons(runtime).entries())
    for (const [attackIndex, attack] of (summon.attacks || []).entries()) {
      const at = canonicalTime(runtime.time + (attack.initialDelay || 0));
      if (at < active.expiresAt)
        runtime.schedule(THIEF_GUILD_ATTACK, at, {
          ownerId: active.ownerId,
          summonIndex,
          attackIndex,
          occurrence: 0
        } satisfies GuildAttackWork);
    }
}

/** One summon attack: its packets share a fresh activation, then the stream schedules its next occurrence. */
export function thievesGuildAttack(runtime: ThiefRuntime, data: unknown): void {
  const work = data as GuildAttackWork;
  const active = runtime.profession.core.activeThievesGuild;
  if (!active || active.ownerId !== work.ownerId || runtime.time >= active.expiresAt) return;
  const skill: ThiefSkill | undefined = runtime.helpers.skillsById.get(ID.THIEVES_GUILD);
  const profile = skill?.summonAttack;
  const summon = thievesGuildSummons(runtime)[work.summonIndex];
  const attack = summon?.attacks?.[work.attackIndex];
  if (!profile || !summon || !attack) return;
  const hits = Math.max(1, attack.hits ?? 1);
  const summonName = `Thieves Guild — ${summon.name}`;
  const attackName = `${summonName} — ${attack.name}`;
  const common = {
    at: runtime.time,
    sourceId: 'thief.thieves-guild',
    actorType: 'summon' as const,
    skillId: attack.skillId ?? ID.THIEVES_GUILD,
    skillName: summonName,
    parentSkillName: 'Thieves Guild',
    damageBreakdownName: `${summon.displayName || summon.name} — ${attack.name}`,
    summonIgnoresBoons: true,
    summonUsesEquipmentModifiers: false,
    activationId: `${work.ownerId}:${work.summonIndex}:${work.attackIndex}:${work.occurrence}`
  };
  emitThiefDamage(runtime, null, {
    ...common,
    name: attackName,
    coefficient: (attack.coefficientPerHit || 0) * hits,
    hits,
    hitIndex: 1,
    totalHits: hits,
    skillWeapon: summon.weapon,
    weaponStrengthProfileId: summon.weaponStrengthProfileId,
    independentSummonStrike: true,
    summonBasePower: profile.basePower,
    summonCriticalChance: profile.criticalChance,
    summonCriticalDamage: profile.criticalDamage
  });
  for (const condition of guildAttackConditions(runtime, attack))
    emitThiefCondition(runtime, null, {
      ...common,
      name: `${attackName} — ${condition.condition}`,
      condition: condition.condition,
      stacks: condition.stacks,
      duration: condition.duration || 0,
      summonInheritsAttributes: true
    });
  const next = canonicalTime(runtime.time + (attack.interval || 0));
  if ((attack.interval || 0) > 0 && next < active.expiresAt)
    runtime.schedule(THIEF_GUILD_ATTACK, next, { ...work, occurrence: work.occurrence + 1 } satisfies GuildAttackWork);
}

/** The guild's shared lifetime retires every stream at once. */
export function expireThievesGuild(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if (core.activeThievesGuild?.ownerId === (data as { ownerId: string }).ownerId) core.activeThievesGuild = null;
}

/**
 * Unsuspecting Strike's Bleeding adds a fresh bonus application while the target is above ninety percent health. The
 * bonus keeps the original skill identity and cannot trigger itself.
 */
export function unsuspectingStrikeBonus(runtime: ThiefRuntime, application: Gw2ResolverEvent): void {
  runtime.emitDerived(
    application,
    buildResolverCondition({
      at: runtime.time,
      source: application.source,
      sourceId: application.sourceId,
      actorType: application.actorType,
      ownerActorType: application.ownerActorType,
      skillId: application.skillId,
      skillName: application.skillName,
      activationId: application.activationId,
      triggeredBy: application.triggeredBy,
      fixedDuration: application.fixedDuration,
      name: 'Unsuspecting Strike - Bonus Bleeding',
      condition: 'Bleeding',
      duration: application.duration || 0,
      stacks: 3
    })
  );
}
