import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { grantTimedStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import { gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import { permanentTargetConditionStacks } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  armSkillFlip,
  consumeSkillFlip,
  skillFlipVisible,
  type SkillFlipWindows,
  followUpOf
} from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resetAutoattackChains } from '#gw2/platform/skills/autoattack-chain-controller.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { spearChainStageForSkill } from '#gw2/professions/thief/data/spear-chain-stages.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { addVenomCharges, conditionEffects, venomForSkill } from '#gw2/professions/thief/core/mechanics/venoms.js';
import { thiefSpecializationGuildSummon } from '#gw2/professions/thief/family-state.js';
import { emitThiefCondition, emitThiefDamage } from '#gw2/professions/thief/core/events.js';
import {
  grantThiefEndurance,
  grantThiefInitiative,
  setThiefKneeling
} from '#gw2/professions/thief/core/mechanics/resources.js';
import { grantThiefStealth } from '#gw2/professions/thief/core/mechanics/stealth.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { AutoattackChainTransitionResult } from '#gw2/platform/skills/autoattack-chain-controller.js';
import type { ThiefSkill, ThiefSummonDefinition, ThiefSummonStrike } from '#gw2/professions/thief/types.js';
import type { ThiefRuntime } from '#gw2/professions/thief/core/events.js';

export const THIEF_SCEPTER_CHAIN_EXPIRY = 'thief.scepter-chain-expire';
export const THIEF_GUILD_ATTACK = 'thief.thieves-guild-attack';
export const THIEF_GUILD_EXPIRY = 'thief.thieves-guild-expire';

const SPEAR_STEALTH_SKILLS = new Set<SkillId>([ID.ASHEN_ASSAULT]);
const SPINNING_AXE_SKILLS = new Set<SkillId>([
  ID.SPINNING_AXE,
  ID.SPINNING_AXE_ID_71967,
  ID.VENOMOUS_VOLLEY,
  ID.CUNNING_SALVO,
  ID.MALICIOUS_CUNNING_SALVO
]);
const AXE_RECALL_SKILLS = new Set<SkillId>([ID.HARROWING_STORM, ID.ORCHESTRATED_ASSAULT, ID.RECALL_AXES]);

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
function prepareTrap(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.prepareId === cast.skill.id);
  if (!trap) return;
  const skill = cast.skill as ThiefSkill;
  const delay = Number(skill.durationMultiplier ?? 3) / runtime.cooldownController.rate(cast.skill);
  armSkillFlip(runtime.profession.core.availableFlips, trap.triggerId, runtime.time + delay, Infinity, runtime.time);
}

/** Triggering consumes the trap and mirrors its short rearm onto an already-recharged placement skill. */
function activateTrap(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const trap = THIEF_PREPARATIONS.find((candidate) => candidate.triggerId === cast.skill.id);
  if (!trap) return;
  consumeSkillFlip(runtime.profession.core.availableFlips, trap.triggerId);
  const triggerReadyAt = runtime.cooldowns.get(trap.triggerId);
  if (triggerReadyAt == null || triggerReadyAt <= Number(runtime.cooldowns.get(trap.prepareId) || 0)) return;
  const placement = runtime.helpers.skillsById.get(trap.prepareId);
  if (placement) runtime.cooldownController.startRecharge(placement, cast.rechargeStart, cast.rechargeWork);
}

/** Arms the caster's finite venom charges and queues each assumed ally's bounded proc sequence. */
function activateVenom(runtime: ThiefRuntime, cast: RuntimeCast): void {
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
function updateSpearChain(runtime: ThiefRuntime, skill: ThiefSkill): void {
  const core = runtime.profession.core;
  const stage = spearChainStageForSkill(skill.id);
  if (stage != null) {
    core.spearChainStage = (stage + 1) % 3;
    core.spearLastWasFinisher = stage === 2;
    core.spearPreviousSkillId = skill.id;
    return;
  }

  if (skill.id === ID.DISTRACTING_THROW && (core.spearLastWasFinisher || Number(core.spearChainStage || 0) === 0)) {
    const followsFinisher = core.spearLastWasFinisher;
    core.spearChainStage = 1;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
    if (followsFinisher)
      core.distractingThrowBuffUntil =
        runtime.time +
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.distractingThrow), 'durationMultiplier');
    return;
  }

  if (skill.spearStealthAttack || SPEAR_STEALTH_SKILLS.has(skill.id)) {
    core.spearChainStage = 0;
    core.spearLastWasFinisher = false;
    core.spearPreviousSkillId = skill.id;
  }
}

/** Scales every strike coefficient of an authored effect, including per-tick coefficients. */
function scaleStrike(effect: SkillEffect, factor: number): SkillEffect {
  if (effect.type !== 'strike') return effect;
  return effect.ticks?.length
    ? { ...effect, ticks: effect.ticks.map((tick) => ({ ...tick, coefficient: Number(tick.coefficient) * factor })) }
    : { ...effect, coefficient: Number(effect.coefficient || 0) * factor };
}

/**
 * Falling Spider after an Entangling Asp chain gains its empowered coefficient and extra Bleeding/Poison stacks. The
 * chain state is read at acceptance, before the cast's own completion advances it.
 */
export function thiefSpearEffects(
  runtime: ThiefRuntime,
  cast: RuntimeCast,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  const core = runtime.profession.core;
  if (
    cast.skill.id !== ID.FALLING_SPIDER ||
    Number(core.spearChainStage || 0) !== 2 ||
    core.spearPreviousSkillId !== ID.ENTANGLING_ASP
  )
    return effects;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.fallingSpiderEmpowered);
  const factor = balanceProfileNumber(profile, 'damageMultiplier');
  const extraStacks = balanceProfileNumber(profile, 'resourceGain');
  const boosted = (condition: unknown) => ['Bleeding', 'Poisoned'].includes(String(condition));
  return effects.map((effect) => {
    if (effect.type === 'strike') return scaleStrike(effect, factor);
    if (effect.type !== 'condition') return effect;
    if (effect.ticks?.length)
      return {
        ...effect,
        ticks: effect.ticks.map((tick) =>
          boosted(tick.condition ?? effect.condition)
            ? { ...tick, stacks: Number(tick.stacks ?? 1) + extraStacks }
            : tick
        )
      };
    return boosted(effect.condition) ? { ...effect, stacks: Number(effect.stacks ?? 1) + extraStacks } : effect;
  });
}

/**
 * Completion-time weapon state: stealth grants, endurance refunds, spear stages, axe recall, and weapon follow-up
 * windows. A committed opener arms its follow-up; a committed follow-up consumes it.
 */
export function completeThiefWeaponState(
  runtime: ThiefRuntime,
  cast: RuntimeCast,
  committed: boolean,
  completed: boolean
): void {
  const skill = cast.skill as ThiefSkill;
  const core = runtime.profession.core;
  const flips: SkillFlipWindows = core.availableFlips;
  if (completed && !(skill.categories || []).includes('stolen skill')) grantThiefStealth(runtime, skill);
  if (committed && Number(skill.resourceGain || 0) > 0) grantThiefEndurance(runtime, Number(skill.resourceGain));
  if (committed) updateSpearChain(runtime, skill);
  if (completed && AXE_RECALL_SKILLS.has(skill.id)) core.spinningAxeExpirations = [];
  // Dual-wield openers keep their follow-up one second shorter unless the skill authors its own window.
  const followUp = committed && skill.type === 'Weapon' ? followUpOf(runtime.helpers.skillsById, skill) : undefined;
  if (followUp)
    runtime.armFlip(followUp.id, {
      expiresAt: runtime.time + Number(skill.flipDuration ?? (skill.dualWieldOpener ? 4 : 5))
    });

  if (committed && skill.type === 'Weapon' && skill.flipParentId != null) consumeSkillFlip(flips, skill.id);
}

/** Each landed axe joins the shared ground pool for ten seconds, keeping the six newest. */
export function reactThiefSpinningAxe(runtime: ThiefRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !SPINNING_AXE_SKILLS.has(Number(event.skillId))) return;
  const core = runtime.profession.core;
  core.spinningAxeExpirations = grantTimedStacks(core.spinningAxeExpirations, {
    at: runtime.time,
    expiresAt: runtime.time + 10,
    count: 1,
    maximumStacks: 6,
    retain: 'newest-grant'
  });
}

/** Only a successful scepter chain step refreshes its three-second window from cast completion. */
export function transitionThiefScepterChain(
  runtime: ThiefRuntime,
  cast: RuntimeCast,
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

/** Swapping weapons stands up; Quick Pockets grants in-combat initiative once per its cooldown. */
function completeThiefWeaponSwap(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  setThiefKneeling(runtime, false);
  if (
    !runtime.combatStartedAt() ||
    !hasTrait(runtime, TRAIT.QUICK_POCKETS) ||
    !isInternalCooldownReady(runtime.time, Number(core.quickPocketsReadyAt || 0))
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.quickPockets);
  core.quickPocketsReadyAt = runtime.time + balanceProfileNumber(profile, 'internalCooldown');
  grantThiefInitiative(runtime, balanceProfileNumber(profile, 'resourceGain'));
}

/** Assassin's Signet opens its active window and suppresses its passive until the signet recharges. */
function activateAssassinsSignet(runtime: ThiefRuntime): void {
  const core = runtime.profession.core;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.assassinsSignet);
  core.assassinsSignetActiveUntil = runtime.time + balanceProfileNumber(profile, 'durationMultiplier');
  core.assassinsSignetPassiveDisabledUntil = Number(runtime.cooldowns.get(ID.ASSASSINS_SIGNET) ?? runtime.time);
}

/** Utility, stance, and swap transitions owned by Core at the committed completion. */
export function completeThiefCoreActions(runtime: ThiefRuntime, cast: RuntimeCast, committed: boolean): void {
  const skill = cast.skill;
  if (skill.id === ID.SWAP_WEAPONS) {
    completeThiefWeaponSwap(runtime);
    return;
  }

  if (!committed) return;
  if (skill.id === ID.KNEEL) setThiefKneeling(runtime, true);
  else if (skill.id === ID.FREE_ACTION) setThiefKneeling(runtime, false);
  else if (skill.id === ID.ASSASSINS_SIGNET) activateAssassinsSignet(runtime);
  else if (skill.id === ID.THIEVES_GUILD) summonThievesGuild(runtime, cast);
  else if (venomForSkill(skill.id)) activateVenom(runtime, cast);
  prepareTrap(runtime, cast);
  activateTrap(runtime, cast);
}

interface GuildAttackWork {
  readonly ownerId: string;
  readonly summonIndex: number;
  readonly attackIndex: number;
  readonly occurrence: number;
}

/** The two shared thieves plus the active specialization's third summon (Core Thief otherwise). */
function thievesGuildSummons(runtime: ThiefRuntime): ThiefSummonDefinition[] {
  const profile = (runtime.helpers.skillsById.get(ID.THIEVES_GUILD) as ThiefSkill | undefined)?.summonAttack;
  if (!profile) return [];
  const third =
    thiefSpecializationGuildSummon(runtime.profession.specialization.kind) ||
    profile.summons.find((summon) => summon.variant === 'Core Thief');
  return [...profile.summons.filter((summon) => summon.variant == null), ...(third ? [third] : [])];
}

/** A committed summon replaces any active guild; its streams start with combat. */
function summonThievesGuild(runtime: ThiefRuntime, cast: RuntimeCast): void {
  const profile = (cast.skill as ThiefSkill).summonAttack;
  if (!profile) return;
  const core = runtime.profession.core;
  const summons = thievesGuildSummons(runtime);
  const expiresAt = canonicalTime(cast.start + Number(profile.duration || 0));
  core.activeThievesGuild = {
    ownerId: `${cast.id}:thieves-guild`,
    variant: summons.at(-1)?.name || 'Core Thief',
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
      const at = canonicalTime(runtime.time + Number(attack.initialDelay || 0));
      if (at < active.expiresAt)
        runtime.schedule(THIEF_GUILD_ATTACK, at, {
          ownerId: active.ownerId,
          summonIndex,
          attackIndex,
          occurrence: 0
        } satisfies GuildAttackWork);
    }
}

const WELL_OF_SORROW = 67795;
const WELL_OF_SORROW_PRIORITY = Object.freeze(['Poisoned', 'Bleeding', 'Torment']);
const WELL_OF_SORROW_CONDITIONS = Object.freeze([
  Object.freeze({ condition: 'Poisoned', stacks: 1, duration: 3 }),
  Object.freeze({ condition: 'Bleeding', stacks: 2, duration: 4 }),
  Object.freeze({ condition: 'Torment', stacks: 2, duration: 4 }),
  Object.freeze({ condition: 'Torment', stacks: 1, duration: 4 })
]);

/** Well of Sorrow chooses the first missing condition from the target's state at its own impact. */
function guildAttackConditions(runtime: ThiefRuntime, attack: ThiefSummonStrike) {
  if (attack.skillId !== WELL_OF_SORROW) return attack.conditions || [];
  if (WELL_OF_SORROW_PRIORITY.every((condition) => permanentTargetConditionStacks(runtime.config, condition) > 0))
    return [WELL_OF_SORROW_CONDITIONS[3]];
  const missing = WELL_OF_SORROW_PRIORITY.findIndex(
    (condition) => !runtime.query.targetHasCondition(condition, runtime.time, runtime)
  );
  return [WELL_OF_SORROW_CONDITIONS[missing < 0 ? 3 : missing]];
}

/** One summon attack: its packets share a fresh activation, then the stream schedules its next occurrence. */
export function thievesGuildAttack(runtime: ThiefRuntime, data: unknown): void {
  const work = data as GuildAttackWork;
  const active = runtime.profession.core.activeThievesGuild;
  if (!active || active.ownerId !== work.ownerId || runtime.time >= active.expiresAt) return;
  const profile = (runtime.helpers.skillsById.get(ID.THIEVES_GUILD) as ThiefSkill | undefined)?.summonAttack;
  const summon = thievesGuildSummons(runtime)[work.summonIndex];
  const attack = summon?.attacks?.[work.attackIndex];
  if (!profile || !summon || !attack) return;
  const hits = Math.max(1, Number(attack.hits ?? 1));
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
    coefficient: Number(attack.coefficientPerHit || 0) * hits,
    hits,
    hitIndex: 1,
    totalHits: hits,
    skillWeapon: summon.weapon,
    weaponStrengthProfileId: summon.weaponStrengthProfileId,
    independentSummonStrike: true,
    summonBasePower: Number(profile.basePower),
    summonCriticalChance: Number(profile.criticalChance),
    summonCriticalDamage: Number(profile.criticalDamage)
  });
  for (const condition of guildAttackConditions(runtime, attack))
    emitThiefCondition(runtime, null, {
      ...common,
      name: `${attackName} — ${condition.condition}`,
      condition: condition.condition,
      stacks: Number(condition.stacks ?? 1),
      duration: Number(condition.duration || 0),
      summonInheritsAttributes: true
    });
  const next = canonicalTime(runtime.time + Number(attack.interval || 0));
  if (Number(attack.interval || 0) > 0 && next < active.expiresAt)
    runtime.schedule(THIEF_GUILD_ATTACK, next, { ...work, occurrence: work.occurrence + 1 } satisfies GuildAttackWork);
}

/** The guild's shared lifetime retires every stream at once. */
export function expireThievesGuild(runtime: ThiefRuntime, data: unknown): void {
  const core = runtime.profession.core;
  if (core.activeThievesGuild?.ownerId === (data as { ownerId: string }).ownerId) core.activeThievesGuild = null;
}
