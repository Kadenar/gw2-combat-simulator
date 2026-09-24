import { resourceDepletionAt } from '#gw2/platform/combat/resources/clock.js';
import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import { quantizeGw2ActionTimingMs } from '#gw2/platform/skills/timing.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl,
  emitSkillDamage
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import type { EmitSkillBuffOptions } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import {
  addBlight,
  consumeBlight,
  harbingerState,
  purgeHarbingerTimedState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import type { HarbingerState } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { emitNecromancerStateSnapshot } from '#gw2/professions/necromancer/family-state.js';
/**
 * Harbinger blight skill handlers.
 *
 * Elixirs and blight ("shroud") skills consume accumulated blight to fire an
 * empowered variant (higher coefficient, extra conditions/boons), then add
 * fresh blight. Consuming blight also feeds the Cascading Corruption trait,
 * which procs Meltdown every 20 stacks. Exports `necromancerBlightSkillHandlers`.
 */
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type {
  NecromancerCastContext,
  NecromancerSchedulerContext,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';
import type { BalanceProfile, SkillEffect } from '#gw2/platform/engine/skills/types.js';

import {
  HARBINGER_BALANCE_PROFILE_IDS as PROFILE,
  HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID
} from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

const MELTDOWN_ICON = 'https://wiki.guildwars2.com/wiki/Special:FilePath/Meltdown.png';

const CASCADING_CORRUPTION_EFFECT: NecromancerSkill = Object.freeze({
  id: ID.CASCADING_CORRUPTION,
  name: 'Cascading Corruption',
  type: 'Trait',
  skillWeapon: 'Unequipped'
});

// Blight has no skill or trait id of its own; it is the Harbinger Shroud resource, so it borrows that identity.
const BLIGHT_EFFECT: NecromancerSkill = Object.freeze({
  id: ID.HARBINGER_SHROUD,
  name: 'Blight',
  type: 'Trait',
  skillWeapon: 'Unequipped'
});

/**
 * Republishes the whole live Blight resource so the analysis chart tracks it like any other timed effect.
 *
 * Blight is not additive on the chart: it is gained in bursts, spent in fixed chunks by shroud skills and
 * elixirs, and each stack also ages out on its own 25-second window. A grant-only emission would show the
 * gains and never the spending, so every emission carries the complete current count and supersedes the
 * previous one through the presentation's replacement group. The duration runs to the longest-lived stack,
 * which is when the count would reach zero if nothing further touched it.
 */
export function emitBlightState(context: NecromancerSchedulerContext, state: HarbingerState, at: number): void {
  // Blight's own clock publishes only its specialization, never an unrelated resource or summon slice.
  context.emit({
    type: 'necromancer.blight',
    at,
    source: 'necromancer',
    sourceId: ID.HARBINGER_SHROUD,
    actorType: 'player',
    state: structuredClone(state)
  });
  const expiries = state.blightExpiries || [];
  emitSkillBuff(context, BLIGHT_EFFECT, {
    at,
    kind: 'harbinger-blight',
    stacks: expiries.length,
    duration: expiries.length ? Math.max(...expiries) - at : 0
  });
}

/** Publishes each expiry at its own time before later gains or spends can change the surviving stacks. */
function expireBlight(context: NecromancerSchedulerContext, state: HarbingerState, target: number): void {
  while (state.blightExpiries.length && Math.min(...state.blightExpiries) <= target) {
    const at = Math.min(...state.blightExpiries);
    purgeHarbingerTimedState(state, at);
    emitBlightState(context, state, at);
  }
}

/** Advances timed Blight accrual through a target time while Harbinger Shroud remains active. */
export function advanceHarbingerBlight(context: NecromancerSchedulerContext, target: number): void {
  const state = harbingerState.from(context);
  const coreState = professionCoreState(context);
  // Blight only accrues while inside Harbinger Shroud; reset the cursor after every exit path.
  if (coreState.activeShroud !== 'harbinger') {
    state.nextBlightAt = Number.POSITIVE_INFINITY;
    expireBlight(context, state, target);
    return;
  }

  const resources = requireBalanceProfileFromContext(context, PROFILE.resources);
  // The shared drain segment keeps the zero crossing stable across intermediate observations.
  const exitAt = Math.min(target, resourceDepletionAt(coreState.lifeForce));
  // Doom Approaches doubles the passive Blight gain rate (2 → 4 stacks/s).
  const stacksPerSecond = balanceProfileNumber(
    hasTrait(context, TRAIT.DOOM_APPROACHES)
      ? requireBalanceProfileFromContext(context, PROFILE.doomApproaches)
      : resources,
    'blightGain'
  );
  // nextBlightAt is a whole-second cursor; each tick adds stacksPerSecond stacks and advances the cursor by 1 s.
  while (Number(state.nextBlightAt ?? Number.POSITIVE_INFINITY) <= exitAt + EPSILON) {
    const nextBlightAt = Number(state.nextBlightAt);
    expireBlight(context, state, nextBlightAt);
    addBlight(state, stacksPerSecond, nextBlightAt);
    emitBlightState(context, state, nextBlightAt);
    state.nextBlightAt = nextBlightAt + 1;
  }

  expireBlight(context, state, target);
}

/** Accumulates consumed Blight and emits Meltdown whenever Cascading Corruption crosses its threshold. */
function applyCascadingCorruption(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  consumed: number,
  at: number
): void {
  if (
    !hasTrait(context, TRAIT.CASCADING_CORRUPTION) ||
    !consumed ||
    // Pre-combat Blight consumption (e.g. from initialBlight config) must not trigger Meltdown before the fight starts.
    (context.hasExplicitCombatStart && (context.combatStartTime == null || at < Number(context.combatStartTime)))
  )
    return;
  const state = harbingerState.from(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.cascadingCorruption);
  // Meltdown's window, strike, and Torment are independent outputs of one threshold proc.
  const meltdown = requireEffect(profile, 'buff', 'meltdown');
  const strike = requireEffect(profile, 'strike', 'Strike');
  const torment = requireEffect(profile, 'condition', 'Torment');
  // With every output removed there is no Meltdown to count toward.
  if (!meltdown && !strike && !torment) return;
  const threshold = balanceProfileNumber(profile, 'minimumStacks');
  state.cascadingCorruptionStacks += consumed;
  // Every 20 accumulated stacks triggers exactly one Meltdown; remainder carries over to the next threshold.
  if (state.cascadingCorruptionStacks < threshold) return;
  state.cascadingCorruptionStacks -= threshold;
  // Meltdown lasts 10 s and grants the Cascading Corruption damage bonus during that window.
  if (meltdown) state.meltdownUntil = at + effectNumber(profile, meltdown, 'duration');
  emitBlightState(context, state, at);
  context.emit({
    type: 'proc',
    procType: 'trait',
    at,
    name: 'Meltdown',
    sourceSkill: skill.name,
    detail: `Consumed ${threshold} Cascading Corruption stacks`,
    icon: MELTDOWN_ICON,
    source: 'Trait',
    sourceId: TRAIT.CASCADING_CORRUPTION,
    actorType: 'effect'
  });
  if (strike)
    emitSkillDamage(context, CASCADING_CORRUPTION_EFFECT, {
      // The explosion follows Meltdown activation; modifiers resolve against its later impact state.
      at: canonicalTime(at + quantizeGw2ActionTimingMs(effectNumber(profile, strike, 'atMs')) / 1000),
      source: 'Trait',
      sourceId: TRAIT.CASCADING_CORRUPTION,
      actorType: 'effect',
      coefficient: effectNumber(profile, strike, 'coefficient'),
      parentSkillName: skill.name
    });
  if (torment)
    emitSkillCondition(context, {
      skill: CASCADING_CORRUPTION_EFFECT,
      at: canonicalTime(at + quantizeGw2ActionTimingMs(effectNumber(profile, torment, 'atMs')) / 1000),
      source: 'Trait',
      sourceId: TRAIT.CASCADING_CORRUPTION,
      actorType: 'effect',
      condition: String(torment.condition),
      stacks: effectNumber(profile, torment, 'stacks'),
      duration: effectNumber(profile, torment, 'duration'),
      parentSkillName: skill.name
    });
}

/** Materializes a base or empowered elixir profile while preserving Blight metadata and boon routing. */
function emitElixirEffects(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  source: NecromancerSkill | BalanceProfile,
  impactAt: number,
  boonOptions: Pick<EmitSkillBuffOptions, 'audience'> | undefined,
  blight: number
): void {
  // Every elixir payload shares its skill-authored impact while empowered profiles replace only effect values.
  for (const effect of (source.effects || []) as readonly SkillEffect[]) {
    if (effect.type === 'strike') {
      emitSkillDamage(context, skill, {
        at: impactAt,
        coefficient: effectNumber(source, effect, 'coefficient'),
        hits: Number(effect.hits ?? 1),
        metadata: {
          blightEmpowered: source !== skill,
          necromancerBlight: blight
        }
      });
    } else if (effect.type === 'condition') {
      emitSkillCondition(context, {
        skill,
        at: impactAt,
        condition: String(effect.condition),
        stacks: effectNumber(source, effect, 'stacks'),
        duration: effectNumber(source, effect, 'duration')
      });
    } else if (effect.type === 'boon') {
      emitSkillBuff(context, skill, {
        at: impactAt,
        kind: String(effect.boon),
        duration: effectNumber(source, effect, 'duration'),
        stacks: effectNumber(source, effect, 'stacks'),
        ...(boonOptions || {})
      });
    } else if (effect.type === 'blind') {
      context.emit({
        type: 'blind',
        at: impactAt,
        source: 'necromancer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }
  }
}

/** Schedules the throw and impact separately so neither exposes future Blight during cast planning. */
function elixir(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  // The interruption cutoff controls whether the cast survives, never when its resource events occur.
  if (cancelledBeforeInterruptCommit(skill, context.start, context.fullEnd, context.effectiveEnd)) return true;
  // Read the base strike's authored timing so empowered profiles retain the same projectile impact.
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  const timing = strike ? (context.schedulerPolicy.effectTiming?.(context, skill, strike) ?? strike) : undefined;
  const impactAnchor = timing?.timingAnchor === 'castStart' ? context.start : context.fullEnd;
  const impactAt =
    timing?.atMs == null
      ? context.fullEnd
      : canonicalTime(impactAnchor + quantizeGw2ActionTimingMs(Number(timing.atMs)) / 1000);
  // Every elixir consumes Blight on the ninth 40 ms tick, independently of its impact timing.
  const consumeAt = canonicalTime(context.start + 0.36);
  blightCommit.onEventScheduled.handler(context, { skillId: skill.id, at: consumeAt, impactAt });
  return true;
}

/** Launch consumes empowerment Blight; fresh Blight belongs to the surviving projectile's later impact. */
function commitElixir(context: NecromancerSchedulerContext, skill: NecromancerSkill, impactAt: number): void {
  const at = context.state.time;
  const state = harbingerState.from(context);
  const empoweredProfile = requireBalanceProfileFromContext(
    context,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(skill.id)]
  );
  const threshold = balanceProfileNumber(empoweredProfile, 'blightCost');
  const empowered = state.blight >= threshold;
  const consumed = empowered ? consumeBlight(state, threshold, at) : 0;
  emitBlightState(context, state, at);
  applyCascadingCorruption(context, skill, consumed, at);
  emitNecromancerStateSnapshot(context, at, 'blight-consumed', {
    dedupeAcrossSourceIds: true
  });
  const boonOptions = hasTrait(context, TRAIT.TWISTED_MEDICINE)
    ? { audience: { recipients: 'party' as const, maximumRecipients: 5 } }
    : undefined;
  const bolsteringBrew = hasTrait(context, TRAIT.BOLSTERING_BREW)
    ? requireBalanceProfileFromContext(context, PROFILE.bolsteringBrew)
    : undefined;
  const protection = bolsteringBrew && requireEffect(bolsteringBrew, 'boon', 'protection');
  if (bolsteringBrew && protection) {
    emitSkillBuff(context, skill, {
      at,
      kind: String(protection.boon),
      duration: effectNumber(bolsteringBrew, protection, 'duration'),
      stacks: effectNumber(bolsteringBrew, protection, 'stacks'),
      ...(boonOptions || {})
    });
  }

  elixirImpact.onEventScheduled.handler(context, { skillId: skill.id, at: impactAt, empowered, blight: state.blight });
}

/** Publish impact gains before the payload, retaining the existing post-cost damage snapshot from launch. */
function impactElixir(
  context: NecromancerSchedulerContext,
  skill: NecromancerSkill,
  empowered: boolean,
  blight: number
): void {
  const at = context.state.time;
  const state = harbingerState.from(context);
  const empoweredProfile = requireBalanceProfileFromContext(
    context,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(skill.id)]
  );
  const boonOptions = hasTrait(context, TRAIT.TWISTED_MEDICINE)
    ? { audience: { recipients: 'party' as const, maximumRecipients: 5 } }
    : undefined;
  // Elixir of Ambition's profile grants more Blight than other elixirs, consistent with its higher threshold.
  addBlight(state, balanceProfileNumber(empoweredProfile, 'blightGain'), at);
  emitBlightState(context, state, at);
  emitNecromancerStateSnapshot(context, at, 'blight-gained', {
    dedupeAcrossSourceIds: true
  });
  emitElixirEffects(context, skill, empowered ? empoweredProfile : skill, at, boonOptions, blight);
}

/** Resolves a Harbinger shroud skill from its base or Blight-empowered balance profile. */
function blightSkill(context: NecromancerCastContext, skill: NecromancerSkill): boolean {
  const at = context.effectiveEnd;
  // Devouring Cut must reach its declared commit frame before spending Blight or landing its packet.
  if (skill.id === ID.DEVOURING_CUT && Math.round((at - context.start) * 1000) < Number(skill.interruptCommitMs || 0)) {
    return true;
  }

  // Blight skills have mid-cast hit frames; these fractions come from wiki frame data, not approximations.
  const impactProgress = skill.id === ID.DEVOURING_CUT ? 0.75 : skill.id === ID.VORACIOUS_ARC ? 20 / 21 : 1;
  const impactAt = canonicalTime(
    context.start + quantizeGw2ActionTimingMs((context.fullEnd - context.start) * impactProgress * 1000) / 1000
  );
  // A surviving attack samples and consumes Blight when it hits, after earlier passive ticks.
  if (impactAt <= at + EPSILON)
    blightCommit.onEventScheduled.handler(context, { skillId: skill.id, at: impactAt, impactAt });
  return true;
}

function commitBlightSkill(context: NecromancerSchedulerContext, skill: NecromancerSkill, impactAt: number): void {
  const at = context.state.time;
  const state = harbingerState.from(context);
  const empoweredProfile = requireBalanceProfileFromContext(
    context,
    HARBINGER_EMPOWERED_PROFILE_BY_SKILL_ID[Number(skill.id)]
  );
  const cost = balanceProfileNumber(empoweredProfile, 'blightCost');
  const empowered = state.blight >= cost;
  const consumed = empowered ? consumeBlight(state, cost, at) : 0;
  // The strike retains the post-cost count after reconciling earlier resource ticks.
  const damageBlight = state.blight;
  emitBlightState(context, state, at);
  applyCascadingCorruption(context, skill, consumed, at);
  emitNecromancerStateSnapshot(context, at, 'blight-skill', {
    dedupeAcrossSourceIds: true
  });
  const source = empowered ? empoweredProfile : skill;
  // A removed strike emits no hit while the spend, Torment, and control keep their own behavior.
  const strike = requireEffect(source, 'strike', 'Strike');
  if (strike)
    emitSkillDamage(context, skill, {
      at: impactAt,
      coefficient: effectNumber(source, strike, 'coefficient'),
      metadata: {
        blightEmpowered: empowered,
        necromancerBlight: damageBlight
      }
    });
  if (empowered) {
    const condition = requireEffect(empoweredProfile, 'condition', 'Torment');
    if (condition) {
      emitSkillCondition(context, {
        skill,
        at: impactAt,
        condition: String(condition.condition),
        stacks: effectNumber(empoweredProfile, condition, 'stacks'),
        duration: effectNumber(empoweredProfile, condition, 'duration')
      });
    }
  }

  // Devouring Cut has no CC; Voracious Arc normally dazes but Doom Approaches upgrades the daze to a fear.
  if (skill.id !== ID.DEVOURING_CUT) {
    emitSkillControl(context, skill, {
      at: impactAt,
      controlKind: hasTrait(context, TRAIT.DOOM_APPROACHES) ? 'fear' : 'daze'
    });
  }
}

/** The queue owns commitment and cast lineage; planning captures timing without changing live Blight. */
const blightCommit = scheduledReaction<
  NecromancerSchedulerContext,
  { skillId: NecromancerSkill['id']; at: number; impactAt: number },
  { skillId: NecromancerSkill['id']; impactAt: number }
>({
  id: 'necromancer.harbinger-blight-commit',
  select: (_context, { at, ...payload }) => ({ at, priority: -90, payload }),
  execute(context, _at, { skillId, impactAt }) {
    const skill = context.catalog.skillsById.get(skillId);
    if (!skill) return;
    if (skill.handlerId === 'necromancer.elixir') commitElixir(context, skill, impactAt);
    else commitBlightSkill(context, skill, impactAt);
  }
});

// Committed projectiles retain their empowerment while the queue delays their resource grant until impact.
const elixirImpact = scheduledReaction<
  NecromancerSchedulerContext,
  { skillId: NecromancerSkill['id']; at: number; empowered: boolean; blight: number },
  { skillId: NecromancerSkill['id']; empowered: boolean; blight: number }
>({
  id: 'necromancer.harbinger-elixir-impact',
  select: (_context, { at, ...payload }) => ({ at, priority: -90, payload }),
  execute(context, _at, { skillId, empowered, blight }) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill) impactElixir(context, skill, empowered, blight);
  }
});

export const harbingerBlightTaskHandlers = { ...blightCommit.taskHandlers, ...elixirImpact.taskHandlers };

export const necromancerBlightSkillHandlers = Object.freeze({
  'necromancer.elixir': elixir,
  'necromancer.blight-skill': blightSkill
});
