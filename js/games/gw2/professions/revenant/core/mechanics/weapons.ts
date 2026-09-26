import { canonicalTime } from '#kernel/core/clock.js';
import { activeStackCount, addTimedStacks, purgeExpiredStacks } from '#gw2/platform/combat/resources/timed-stacks.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient
} from '#gw2/platform/engine/effects/authoring.js';
import { armSkillFlip, consumeSkillFlip, expireSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { emitRevenantBuff } from '#gw2/professions/revenant/core/events.js';
import type { Skill, SkillEffect, StrikeEffect } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

export const REVENANT_IMPERIAL_GUARD_EXPIRY = 'revenant.imperial-guard-expire';
export const REVENANT_BLOSSOMING_AURA = 'revenant.blossoming-aura';
export const REVENANT_ABYSSAL_RAZE = 'revenant.abyssal-raze-impact';
const WEAPON_FLIP_DURATION_BY_PARENT: Readonly<Record<number, number>> = Object.freeze({ [ID.OTHERWORLDLY_BOND]: 7 });

interface AuraPulse {
  readonly index: number;
  readonly expiresAt: number;
  readonly activationId: string;
}

/** Small targets never intersect large-hitbox-only packets, so those ticks and effects are never queued. */
export function revenantHitboxEffects(
  runtime: RevenantRuntime,
  effects: readonly SkillEffect[]
): readonly SkillEffect[] {
  if (String(runtime.config.professionAssumptions?.hitboxSize || 'small') === 'large') return effects;
  return effects.flatMap((effect) => {
    if (effect.metadata?.largeHitboxOnly === true) return [];
    const authored = (effect as { readonly ticks?: readonly { readonly metadata?: { largeHitboxOnly?: unknown } }[] })
      .ticks;
    if (!authored?.some((tick) => tick.metadata?.largeHitboxOnly === true)) return [effect];
    const ticks = authored.filter((tick) => tick.metadata?.largeHitboxOnly !== true);
    return ticks.length ? [{ ...effect, ticks } as SkillEffect] : [];
  });
}

/** Imperial Guard blocks from acceptance; its True Strike follow-up belongs to this exact channel. */
export function startRevenantWeaponCast(runtime: RevenantRuntime, cast: RuntimeCast): void {
  if (cast.skill.id !== ID.IMPERIAL_GUARD) return;
  armSkillFlip(
    runtime.profession.core.availableFlips,
    ID.TRUE_STRIKE,
    cast.start,
    canonicalTime(cast.effectiveEnd + 4),
    cast.start,
    cast.id
  );
  emitRevenantBuff(
    runtime,
    {
      type: 'buff',
      at: cast.start,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      name: 'Imperial Guard — Blocking',
      kind: 'blocking',
      duration: Math.max(0, cast.effectiveEnd - cast.start),
      stacks: 1
    },
    null,
    true
  );
}

/** Imperial Guard's window expires by identity, so a later channel's follow-up survives an older deadline. */
export function completeRevenantImperialGuard(runtime: RevenantRuntime, cast: RuntimeCast): void {
  if (cast.skill.id === ID.IMPERIAL_GUARD)
    runtime.schedule(REVENANT_IMPERIAL_GUARD_EXPIRY, canonicalTime(cast.effectiveEnd + 4), { identity: cast.id });
  else if (cast.skill.id === ID.TRUE_STRIKE) consumeSkillFlip(runtime.profession.core.availableFlips, ID.TRUE_STRIKE);
}

export function expireRevenantImperialGuard(runtime: RevenantRuntime, data: unknown): void {
  expireSkillFlip(
    runtime.profession.core.availableFlips,
    ID.TRUE_STRIKE,
    runtime.time,
    (data as { identity: string }).identity
  );
}

/** Committed weapon casts open their follow-up windows; follow-ups consume their own window. */
export function completeRevenantWeaponFlips(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const flips = runtime.profession.core.availableFlips;
  if (skill.id === ID.CALL_TO_ANGUISH) armSkillFlip(flips, ID.UNYIELDING_IMPACT, runtime.time);
  else if (skill.id === ID.UNYIELDING_IMPACT) consumeSkillFlip(flips, ID.UNYIELDING_IMPACT);
  if (skill.type !== 'Weapon') return;
  if (
    skill.id !== ID.IMPERIAL_GUARD &&
    skill.id !== ID.BLOSSOMING_AURA &&
    skill.flipSkillId != null &&
    skill.flipSkillId !== skill.nextChainId
  ) {
    const flip = runtime.helpers.skillsById.get(Number(skill.flipSkillId));
    if (flip?.flipParentId === skill.id)
      armSkillFlip(
        flips,
        flip.id,
        runtime.time,
        canonicalTime(
          runtime.time + (WEAPON_FLIP_DURATION_BY_PARENT[Number(skill.id)] || Number(skill.flipDuration ?? 5))
        )
      );
  }

  if (skill.id !== ID.TRUE_STRIKE && skill.flipParentId != null) consumeSkillFlip(flips, skill.id);
}

function auraSkill(runtime: RevenantRuntime): RevenantSkill {
  return runtime.helpers.skillsById.get(ID.BLOSSOMING_AURA) as RevenantSkill;
}

function auraPulseTicks(skill: Skill) {
  const pulse = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Pulsing Damage');
  const ticks = (pulse as StrikeEffect | undefined)?.ticks;
  if (!pulse || !ticks?.length) throw new Error('Blossoming Aura is missing its pulse ticks.');
  return { pulse, ticks };
}

/** Only the initial impact follows cast speed; the attached aura then ticks on a fixed fuse. */
export function startRevenantBlossomingAura(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const { ticks } = auraPulseTicks(skill);
  const firstAt =
    cast.start + projectCastRelativeEffectTimingMs(skill, (cast.fullEnd - cast.start) * 1000, ticks[0].atMs) / 1000;
  const expiresAt = canonicalTime(firstAt + Number(skill.duration));
  for (let index = 0; index <= ticks.length; index += 1)
    runtime.schedule(
      REVENANT_BLOSSOMING_AURA,
      index === ticks.length ? expiresAt : canonicalTime(firstAt + index * Number(skill.pulseInterval)),
      { index, expiresAt, activationId: cast.id } satisfies AuraPulse
    );
}

/** Manual and automatic detonation share scaling and consume the one armed fuse. */
function detonateAura(runtime: RevenantRuntime, activationId?: string): void {
  const flips = runtime.profession.core.availableFlips;
  const expiresAt = Number(flips[ID.DETONATE_BLOSSOMING_AURA]?.expiresAt || 0);
  if (!expiresAt) return;
  const skill = auraSkill(runtime);
  const final = skill.effects?.find((effect) => effect.type === 'strike' && effect.name === 'Final Damage');
  if (final?.type !== 'strike') throw new Error('Blossoming Aura is missing its final strike.');
  const stacks = Math.min(
    3,
    Math.max(0, Math.floor((runtime.time - expiresAt + Number(skill.duration) + 1e-9) / Number(skill.pulseInterval)))
  );
  const common = {
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    ...(activationId ? { activationId } : {})
  };
  runtime.emit(
    buildResolverStrike({
      ...common,
      name: final.name,
      coefficient: Number(final.coefficient) * (1 + Number(final.damageIncreasePerStack) * stacks),
      skillWeapon: String(skill.weapon || '')
    })
  );
  for (const effect of skill.effects ?? [])
    if (effect.type === 'condition' && effect.condition)
      runtime.emit(
        buildResolverCondition({
          ...common,
          condition: effect.condition,
          stacks: Number(effect.stacks),
          duration: Number(effect.duration)
        })
      );
  consumeSkillFlip(flips, ID.DETONATE_BLOSSOMING_AURA);
}

/** The first pulse arms detonation; later pulses and the fuse run only while that same aura remains armed. */
export function revenantBlossomingAuraPulse(runtime: RevenantRuntime, data: unknown): void {
  const { index, expiresAt, activationId } = data as AuraPulse;
  const skill = auraSkill(runtime);
  const { pulse, ticks } = auraPulseTicks(skill);
  const flips = runtime.profession.core.availableFlips;
  if (index === 0) armSkillFlip(flips, ID.DETONATE_BLOSSOMING_AURA, runtime.time, expiresAt);
  else if (Number(flips[ID.DETONATE_BLOSSOMING_AURA]?.expiresAt) !== expiresAt) return;
  if (index === ticks.length) {
    detonateAura(runtime, activationId);
    return;
  }

  runtime.emit(
    buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      activationId,
      name: pulse.name,
      coefficient: Number(ticks[index].coefficient),
      hitIndex: index + 1,
      totalHits: ticks.length,
      skillWeapon: String(skill.weapon || '')
    })
  );
}

/** Manual detonation resolves at acceptance of the committed follow-up. */
export function detonateRevenantBlossomingAura(runtime: RevenantRuntime, cast: RuntimeCast): void {
  detonateAura(runtime, cast.id);
}

function activeCrushingAbyss(runtime: RevenantRuntime): number[] {
  const core = runtime.profession.core;
  core.crushingAbyss = purgeExpiredStacks(core.crushingAbyss || [], runtime.time);
  return core.crushingAbyss;
}

// Emit Abyssal Raze's stack-scaled strike and Torment packets at the current instant.
function abyssalRazePackets(
  runtime: RevenantRuntime,
  skill: RevenantSkill,
  stacks: number,
  activationId?: string,
  triggeredBy = ''
): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition') ?? [];
  const baseTorment = conditions.find((effect) => !effect.metadata?.trigger);
  const crushingTorment = conditions.find((effect) => effect.metadata?.trigger === 'crushing-abyss');
  if (strike?.type !== 'strike' || !baseTorment || !crushingTorment)
    throw new Error('Abyssal Raze is missing its declarative effects.');
  const base = strikeEffectCoefficient(strike);
  const common = {
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    skillWeapon: 'Spear',
    ...(activationId ? { activationId } : {}),
    ...(triggeredBy ? { triggeredBy } : {})
  };
  runtime.emit(
    buildResolverStrike({
      ...common,
      name: triggeredBy ? 'Abyssal Raze — Crushing Abyss' : 'Abyssal Raze',
      coefficient: triggeredBy ? base : base * (1 + Number(strike.damageIncreasePerStack || 0) * stacks)
    })
  );
  const baseTick = conditionEffectTicks(baseTorment)[0];
  runtime.emit(
    buildResolverCondition({
      ...common,
      name: 'Abyssal Raze — Torment',
      condition: 'Torment',
      stacks: Number(baseTick?.stacks || 0),
      duration: Number(baseTick?.duration || 0)
    })
  );
  if (stacks > 0) {
    const crushingTick = conditionEffectTicks(crushingTorment)[0];
    runtime.emit(
      buildResolverCondition({
        ...common,
        name: 'Abyssal Raze — Crushing Abyss Torment',
        condition: 'Torment',
        stacks: Number(crushingTick?.stacks || 0) * stacks,
        duration: Number(crushingTick?.duration || 0)
      })
    );
  }
}

/** A committed Abyssal Raze resolves at its authored impact, reading the stacks that exist at that instant. */
export function startRevenantAbyssalRaze(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const strike = cast.skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) throw new Error('Abyssal Raze is missing its strike effect.');
  runtime.schedule(REVENANT_ABYSSAL_RAZE, canonicalTime(cast.start + Number(effectFirstAtMs(strike) || 0) / 1000), {
    activationId: cast.id
  });
}

/** Impact packets use the current stack count; the impact then grants one more Crushing Abyss stack. */
export function revenantAbyssalRazeImpact(runtime: RevenantRuntime, data: unknown): void {
  const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE) as RevenantSkill | undefined;
  if (!skill) return;
  const { activationId } = data as { activationId: string };
  abyssalRazePackets(runtime, skill, activeStackCount(activeCrushingAbyss(runtime), runtime.time), activationId);
  const effect = skill.effects?.find((candidate) => candidate.type === 'buff' && candidate.kind === 'crushing-abyss');
  if (effect?.type !== 'buff') throw new Error('Abyssal Raze is missing Crushing Abyss.');
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  const duration = Math.max(0, Number(effect.duration || 0));
  const grant = addTimedStacks(activeCrushingAbyss(runtime), 1, runtime.time, duration, maximum);
  // At the cap the grant lands nothing, and the buff must not be published either.
  if (grant.added === 0) return;
  runtime.profession.core.crushingAbyss = grant.expiries;
  const effectId = effect.sourceId ?? ID.ABYSSAL_RAZE;
  const effectName = String(effect.name || 'Crushing Abyss');
  emitRevenantBuff(
    runtime,
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.ABYSSAL_RAZE,
      actorType: 'player',
      skillId: effectId,
      skillName: effectName,
      activationId,
      icon: skill.icon,
      name: effectName,
      kind: 'crushing-abyss',
      duration,
      stacks: 1
    },
    null,
    true
  );
  runtime.emit({
    type: 'proc',
    procType: 'skill',
    at: runtime.time,
    source: 'revenant',
    sourceId: ID.ABYSSAL_RAZE,
    actorType: 'player',
    skillId: effectId,
    skillName: effectName,
    sourceSkill: skill.name,
    icon: skill.icon,
    name: effectName,
    detail: `${runtime.profession.core.crushingAbyss.length}/${maximum} stacks`
  });
}

function sameWeaponSets(runtime: RevenantRuntime): boolean {
  const set = (index: number) => gw2ConfiguredWeaponSet(runtime.config, index).map((weapon) => weapon || '');
  return JSON.stringify(set(1)) === JSON.stringify(set(2));
}

/** A committed swap to a genuinely different set spends maximum Crushing Abyss on an empowered Raze. */
export function completeRevenantCrushingAbyssSwap(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE) as RevenantSkill | undefined;
  if (!skill) return;
  const maximum = Math.max(0, Number(skill.maximumStacks || 0));
  if (activeCrushingAbyss(runtime).length < maximum || sameWeaponSets(runtime)) return;
  runtime.profession.core.crushingAbyss = [];
  abyssalRazePackets(runtime, skill, maximum, cast.id, 'Swap Weapons');
}

/** The first landed hit of a spear skill reduces Abyssal Raze's live recharge by its authored seconds. */
export function reactRevenantSpearRecharge(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || Number(event.hitIndex || 1) !== 1) return;
  const source = runtime.helpers.skillsById.get(Number(event.skillId)) as RevenantSkill | undefined;
  const seconds = Number(source?.rechargeReduction || 0);
  const raze = runtime.helpers.skillsById.get(ID.ABYSSAL_RAZE);
  if (!source || !seconds || !raze || !(Number(raze.ammoRecharge) > 0)) return;
  // Spear reductions are authored in base seconds; the shared controller converts them to tracked recharge time.
  const reducedBy = runtime.cooldownController.reduceSkillRecharge(raze, seconds, runtime.time);
  if (reducedBy <= 0) return;
  const cooldownReduction = Number(reducedBy.toFixed(3));
  runtime.emitDerived(event, {
    type: 'proc',
    procType: 'skill',
    at: runtime.time,
    source: 'revenant',
    sourceId: source.id,
    actorType: 'player',
    skillId: source.id,
    skillName: source.name,
    sourceSkill: source.name,
    icon: source.icon || '',
    name: `${source.name} — Abyssal Raze recharge`,
    detail: `${cooldownReduction}s`,
    cooldownReduction
  });
}

/** Drop the Hammer's landed delayed strike resets Coalescence of Ruin. */
export function reactRevenantDropTheHammer(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.DROP_THE_HAMMER && Number(event.coefficient || 0) > 0)
    runtime.cooldownController.clear(ID.COALESCENCE_OF_RUIN);
}
