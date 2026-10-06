import {
  renegadeBuffPolicies,
  renegadeEffectStates
} from '#gw2/professions/revenant/specializations/renegade/effect-state.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '#gw2/platform/combat/state/allied-players.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import { buildResolverCondition } from '#gw2/platform/effects/packet-builders.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  grantRenegadeInvocationFervor,
  revenantLifeSiphonBonus
} from '#gw2/professions/revenant/core/traits/behavior.js';
import { completeRevenantCastTraits } from '#gw2/professions/revenant/core/traits/dispatch.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import {
  activeKallasFervorStacks,
  bandTogetherReady
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import {
  ashenDemeanor,
  criticalTraits,
  fervorProfile,
  furyTraits,
  grantAllForOneEnergy,
  grantKallasFervor,
  heroicCommandProfile
} from '#gw2/professions/revenant/specializations/renegade/traits/behavior.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

const SOULCLEAVE_ALLIES = 'revenant.soulcleave-allied-proc';

// Band Together's selected profile is an acceptance fact: the window is consumed before effects are selected.
const bandTogether = new WeakMap<RuntimeCast<RevenantSkill>, { enhanced: boolean; profileSkillId: SkillId }>();

function enhancedSkill(runtime: RevenantRuntime, skillId: SkillId): RevenantSkill | undefined {
  const enhancedId = RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)];
  return enhancedId == null ? undefined : runtime.helpers.skillsById.get(enhancedId);
}

/** Heroic Command refreshes every started Fervor stack and grants Might scaled by the active count. */
function heroicCommand(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = renegadeState.from(runtime);
  const profile = fervorProfile(runtime);
  const fervor = requireEffect(profile, 'buff', 'kallas-fervor');
  if (!fervor) return;
  const maximum = Math.max(1, balanceProfileNumber(profile, 'maximumStacks'));
  state.kallasFervorMaximumStacks = maximum;
  state.kallasFervor = state.kallasFervor.filter((application) => application.expiresAt > runtime.time);
  const duration = Math.max(0, effectNumber(profile, fervor, 'duration'));
  for (const application of state.kallasFervor)
    if (application.at <= runtime.time) application.expiresAt = runtime.time + duration;
  const stacks = activeKallasFervorStacks(state, runtime.time, maximum);
  if (!stacks) return;
  const source = heroicCommandProfile(runtime, cast);
  const might = requireEffect(source, 'boon', 'might');
  if (!might) return;
  runtime.effects.emit({
    kind: 'profile',
    profile: source,
    at: cast.start,
    fullEnd: runtime.time,
    effects: [{ ...might, stacks: Math.max(1, effectNumber(source, might, 'stacks')) * stacks }],
    attribution: (effect) => ({
      activationId: cast.id,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: effect.actorType || 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: null
  });
}

/** A committed warband summon consumes Band Together at acceptance and selects its enhanced profile. */
function beginBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const state = renegadeState.from(runtime);
  const enhanced = bandTogetherReady(runtime, cast.skill.id);
  const profile = enhanced ? enhancedSkill(runtime, cast.skill.id) : undefined;
  // Capture the accepted profile before spending; later grants cannot change this cast's effects or rewards.
  bandTogether.set(cast, { enhanced, profileSkillId: profile?.id ?? cast.skill.id });
  if (enhanced) consumeCharge(state.bandTogether, runtime.time);
  grantAllForOneEnergy(runtime, enhanced);
  if (profile)
    runtime.effects.emit({
      kind: 'profile',
      profile: profile,
      at: cast.start,
      fullEnd: cast.effectiveEnd,
      effects: profile.effects ?? [],
      attribution: (effect) => ({
        activationId: cast.id,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: effect.actorType || 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name
      }),
      skillWeaponFallback: 'Unequipped',
      cause: null
    });
}

/** Razorclaw's Rage arms its finite player charges and precomputes each assumed ally's ICD-limited Bleeding. */
function razorclawsRage(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>, profile: RevenantSkill): void {
  const buff = profile.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'razorclaws-rage');
  const proc = runtime.helpers.skillsById.get(PROFILE.razorclawsRageProc);
  if (!proc) throw new Error("Missing Razorclaw's Rage proc declaration.");
  const bleed = requireEffect(proc, 'condition', 'Bleeding');
  // Charges exist only to deliver the empowered bleed, so either removal arms nothing.
  if (!buff || !bleed) return;
  const duration = Math.max(0, effectNumber(profile, buff, 'duration'));
  const charges = Math.max(0, Math.trunc(effectNumber(profile, buff, 'stacks')));
  renegadeState.from(runtime).razorclawsRage = {
    ...grantCharges(charges, runtime.time + duration),
    readyAt: runtime.time
  };
  for (const allied of gw2AlliedPlayerProcTimeline(runtime.config, {
    start: runtime.time,
    duration,
    maximumPerAlly: charges,
    internalCooldown: Math.max(0, proc.cooldown || 0)
  }))
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: allied.at,
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: bleed.actorType || 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id,
        name: `${cast.skill.name} — Ally ${allied.allyIndex} Bleeding`,
        condition: String(bleed.condition),
        stacks: effectNumber(proc, bleed, 'stacks'),
        duration: effectNumber(proc, bleed, 'duration'),
        metadata: { triggeredByAlly: allied.allyIndex }
      })
    });
}

/** Completion arms Razorclaw's charges and, for an ordinary summon, the next Band Together enhancement. */
function completeBandTogether(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const selected = bandTogether.get(cast);
  bandTogether.delete(cast);
  if (!selected) return;
  if (selected.enhanced) return;
  const window = requireBalanceProfileFromContext(runtime, PROFILE.bandTogether);
  const effect = requireEffect(window, 'buff', 'band-together');
  // The enhancement window is the buff, so a removed buff arms no enhancement.
  if (!effect) return;
  const state = renegadeState.from(runtime);
  state.bandTogether = grantCharges(1, runtime.time + Math.max(0, effectNumber(window, effect, 'duration')));
  runtime.effects.emit({
    kind: 'profile',
    profile: window,
    effects: window.effects ?? [],
    attribution: (effect) => ({
      activationId: cast.id,
      source: 'revenant',
      sourceId: window.id,
      actorType: effect.actorType || 'player',
      skillId: window.id,
      skillName: window.name
    }),
    skillWeaponFallback: 'Unequipped',
    cause: null
  });
}

/** A ready, unexpired Razorclaw charge becomes an empowered Bleeding on a landed player strike. */
function razorclawProc(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.skillId === ID.RAZORCLAWS_RAGE) return;
  const razorclaw = renegadeState.from(runtime).razorclawsRage;
  // Keep activation and same-timestamp gating even when the profile has zero ICD.
  if (!isInternalCooldownReady(runtime.time, razorclaw.readyAt)) return;
  const profile = runtime.helpers.skillsById.get(PROFILE.razorclawsRageProc);
  if (!profile) throw new Error("Missing Razorclaw's Rage proc declaration.");
  const effect = requireEffect(profile, 'condition', 'Bleeding');
  // Charges exist only to deliver the bleed, so a removed packet leaves them unspent.
  if (!effect) return;
  const cooldown = Math.max(0, profile.cooldown || 0);
  if (!consumeCharge(razorclaw, runtime.time, cooldown)) return;
  if (cooldown === 0) razorclaw.readyAt = runtime.time;
  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.RAZORCLAWS_RAGE,
      actorType: 'player',
      skillId: ID.RAZORCLAWS_RAGE,
      skillName: "Razorclaw's Rage",
      name: "Razorclaw's Rage — Bleeding",
      condition: String(effect.condition),
      stacks: effectNumber(profile, effect, 'stacks'),
      duration: effectNumber(profile, effect, 'duration')
    })
  });
}

/** Soulcleave's Summit's player proc fires once per cooldown from a landed player strike while active. */
function soulcleavePlayer(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const soulcleave = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  if (
    !soulcleave ||
    !proc ||
    event.skillId === soulcleave.id ||
    !activeRevenantUpkeep(runtime, soulcleave.id) ||
    !runtime.procs.claimCooldown('revenant.renegade.soulcleave', runtime.time, Math.max(0, proc.cooldown || 0))
  )
    return;
  runtime.effects.emit({
    kind: 'profile',
    profile: proc,
    cause: event,
    attribution: (effect) => ({
      source: 'revenant',
      sourceId: soulcleave.id,
      actorType: effect.actorType || 'effect',
      skillId: soulcleave.id,
      skillName: soulcleave.name
    }),
    skillWeaponFallback: 'Unequipped',
    transform: (packet) => ({ ...packet, triggeredBy: event.skillName })
  });
}

/** Each assumed ally's Soulcleave proc arrives on its own cadence while the upkeep activation remains. */
function soulcleaveAllies(runtime: RevenantRuntime, data: unknown): void {
  const { startsAt } = data as { startsAt: number };
  if (!activeRevenantUpkeep(runtime, ID.SOULCLEAVES_SUMMIT, startsAt)) return;
  const skill = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  const allies = gw2AlliedPlayerAssumptions(runtime.config);
  if (!skill || !proc || !allies.count || !allies.strikesPerSecond) return;
  for (let allyIndex = 1; allyIndex <= allies.count; allyIndex += 1)
    runtime.effects.emit({
      kind: 'profile',
      profile: proc,
      attribution: (effect) => ({
        source: 'revenant',
        sourceId: skill.id,
        actorType: effect.actorType || 'effect',
        skillId: skill.id,
        skillName: skill.name
      }),
      skillWeaponFallback: 'Unequipped',
      transform: (event) => ({
        ...event,
        name: (event.name || proc.name).replace(
          "Soulcleave's Summit \u2014 ",
          `Soulcleave's Summit \u2014 Ally ${allyIndex} `
        )
      })
    });
  runtime.schedule(
    SOULCLEAVE_ALLIES,
    canonicalTime(runtime.time + Math.max(proc.cooldown || 0, 1 / allies.strikesPerSecond)),
    data,
    undefined,
    -200
  );
}

/** Renegade owns Fervor, warband summons, Kalla's commands, and their actual hit/boon reactions. */
export const renegadeHooks: RuntimeHooks<RevenantRuntimeState, RevenantSkill> = {
  buffPolicies: renegadeBuffPolicies,
  observeEffects: renegadeEffectStates,
  initialize(runtime) {
    renegadeState.from(runtime).kallasFervorMaximumStacks = Math.max(
      1,
      balanceProfileNumber(fervorProfile(runtime), 'maximumStacks')
    );
  },
  // Enhanced Band Together is instant; normal summons keep their authored cast time.
  castDurationMs: (runtime, skill, duration) => (bandTogetherReady(runtime, skill.id) ? 0 : duration),
  // Band Together readiness is sampled before the accepted cast changes its state.

  modifyEffects(_runtime, cast, effects) {
    if (cast.skill.id === ID.HEROIC_COMMAND) return [];
    return bandTogether.get(cast)?.enhanced ? [] : effects;
  },
  sideEffectHandlers: {
    'revenant.heroic-command'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      heroicCommand(runtime, context.cast);
    },
    'revenant.begin-band-together'(runtime, context) {
      if (context.kind === 'cast') beginBandTogether(runtime, context.cast);
    },
    'revenant.arm-razorclaw'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Elite completion follows Core trait publication, including any immediate boon reactions.
      completeRevenantCastTraits(runtime, context.cast);
      const selected = bandTogether.get(context.cast);
      if (!selected) return;
      razorclawsRage(runtime, context.cast, runtime.helpers.skillsById.get(selected.profileSkillId) ?? context.skill);
    },
    'revenant.complete-band-together'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      completeBandTogether(runtime, context.cast);
    },
    'revenant.soulcleave-allies'(runtime, context) {
      if (context.kind !== 'cast') return;
      // Keep Core rewards ahead of elite completion state and packets.
      completeRevenantCastTraits(runtime, context.cast);
      const allies = gw2AlliedPlayerAssumptions(runtime.config);
      if (!activeRevenantUpkeep(runtime, context.skill.id) || !allies.count || !allies.strikesPerSecond) return;
      // The declaration activates upkeep first; allied work retains its activation identity.
      runtime.schedule(
        SOULCLEAVE_ALLIES,
        canonicalTime(runtime.time + Math.max(1, 1 / allies.strikesPerSecond)),
        { startsAt: runtime.time },
        undefined,
        -200
      );
    }
  },
  onCastCommit(runtime, cast) {
    ashenDemeanor(runtime, cast);
    if (cast.skill.id === ID.SWAP_LEGENDS) grantRenegadeInvocationFervor(runtime, grantKallasFervor);
  },
  // Only Bombardment's first resolved hit emits Vindication's control packet.

  reactions: {
    'damage.resolving'(runtime, event) {
      // Core already applied its additive bonus; Fervor joins the same additive life-steal sum.
      const core = revenantLifeSiphonBonus(runtime, event);
      if (core == null) return;
      const stacks = activeKallasFervorStacks(renegadeState.from(runtime), runtime.time);
      if (!stacks) return;
      const perStack = balanceProfileNumber(fervorProfile(runtime), 'lifeSiphonDamagePerStack');
      return {
        flatStrikeMultiplier: ((event.flatStrikeMultiplier ?? 1) * (1 + core + stacks * perStack)) / (1 + core)
      };
    },
    'damage.resolved'(runtime, event, details) {
      if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
      criticalTraits(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
      razorclawProc(runtime, event);
      soulcleavePlayer(runtime, event);
    },
    'buff.applied': furyTraits
  },
  tasks: { [SOULCLEAVE_ALLIES]: soulcleaveAllies }
};
