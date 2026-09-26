import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { consumeCharge, grantCharges } from '#gw2/platform/combat/resources/charges.js';
import {
  gw2AlliedPlayerAssumptions,
  gw2AlliedPlayerProcTimeline,
  gw2BoonApplicationRecipients
} from '#gw2/platform/combat/state/allied-players.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { revenantLifeSiphonBonus } from '#gw2/professions/revenant/core/mechanics/life-siphon.js';
import {
  emitRevenantBuff,
  emitRevenantPacket,
  emitRevenantProfile,
  revenantCombatActive
} from '#gw2/professions/revenant/core/events.js';
import { revenantCastCommitted } from '#gw2/professions/revenant/core/events.js';
import {
  emitRevenantInvocationProfile,
  emitRevenantInvocationSkill
} from '#gw2/professions/revenant/core/traits/index.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import {
  activeKallasFervorStacks,
  isBandTogetherReady
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import {
  RENEGADE_PROFILE_IDS as PROFILE,
  RENEGADE_SPIRIT_BOON_PROFILE_ID
} from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import type { BalanceProfile, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2HitResolutionContext } from '#gw2/platform/resolver/hit-resolution.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type {
  RevenantResolverContext,
  RevenantResolverEvent,
  RevenantRuntimeState,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

const SOULCLEAVE_ALLIES = 'revenant.soulcleave-allied-proc';
// Band Together's selected profile is an acceptance fact: the window is consumed before effects are selected.
const bandTogether = new WeakMap<RuntimeCast, { enhanced: boolean; profileSkillId: SkillId }>();

function fervorProfile(runtime: RevenantRuntime): BalanceProfile {
  return requireBalanceProfileFromContext(
    runtime,
    hasTrait(runtime, TRAIT.LASTING_LEGACY) ? PROFILE.kallasFervorLastingLegacy : PROFILE.kallasFervor
  );
}

function enhancedSkill(runtime: RevenantRuntime, skillId: SkillId): RevenantSkill | undefined {
  const enhancedId = RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)];
  return enhancedId == null ? undefined : (runtime.helpers.skillsById.get(enhancedId) as RevenantSkill | undefined);
}

function bandTogetherReady(runtime: RevenantRuntime, skillId: SkillId): boolean {
  return (
    RENEGADE_ENHANCED_SKILL_BY_ID[Number(skillId)] != null &&
    isBandTogetherReady(renegadeState.from(runtime), runtime.time)
  );
}

/** Adds one Kalla's Fervor stack; at the cap it replaces the soonest-expiring stack so hits sustain Fervor. */
export function grantKallasFervor(
  runtime: RevenantRuntime,
  { sourceId, sourceName, cause = null }: { sourceId: SkillId; sourceName: string; cause?: Gw2ResolverEvent | null }
): void {
  const state = renegadeState.from(runtime);
  const profile = fervorProfile(runtime);
  const effect = requireEffect(profile, 'buff', 'kallas-fervor');
  // Fervor stacks are the buff, so a removed buff grants nothing.
  if (!effect) return;
  const maximum = Math.max(1, balanceProfileNumber(profile, 'maximumStacks'));
  state.kallasFervorMaximumStacks = maximum;
  state.kallasFervor = state.kallasFervor.filter((application) => application.expiresAt > runtime.time);
  if (activeKallasFervorStacks(state, runtime.time, maximum) >= maximum)
    state.kallasFervor.sort((left, right) => left.expiresAt - right.expiresAt).shift();
  const duration = Math.max(0, effectNumber(profile, effect, 'duration'));
  state.kallasFervor.push({ at: runtime.time, expiresAt: runtime.time + duration });
  emitRevenantBuff(
    runtime,
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId,
      actorType: effect.actorType || 'player',
      skillId: sourceId,
      skillName: sourceName,
      name: `${sourceName} — Kalla's Fervor`,
      kind: String(effect.kind),
      duration,
      stacks: effectNumber(profile, effect, 'stacks')
    },
    cause,
    true
  );
}

/** Heroic Command refreshes every started Fervor stack and grants Might scaled by the active count. */
function heroicCommand(runtime: RevenantRuntime, cast: RuntimeCast): void {
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
  const source = hasTrait(runtime, TRAIT.LASTING_LEGACY)
    ? requireBalanceProfileFromContext(runtime, PROFILE.heroicCommandLastingLegacy)
    : cast.skill;
  const might = requireEffect(source, 'boon', 'might');
  if (!might) return;
  emitRevenantProfile(runtime, source, {
    at: cast.start,
    fullEnd: runtime.time,
    sourceId: cast.skill.id,
    eventSkill: cast.skill,
    activationId: cast.id,
    effects: [{ ...might, stacks: Math.max(1, effectNumber(source, might, 'stacks')) * stacks }]
  });
}

/** Orders from Above materializes its normal or Righteous Rebel pulses, plus Bold Reversal's Protection. */
function ordersFromAbove(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const rebel = hasTrait(runtime, TRAIT.RIGHTEOUS_REBEL);
  const common = {
    at: cast.start,
    fullEnd: cast.effectiveEnd,
    sourceId: cast.skill.id,
    eventSkill: cast.skill,
    activationId: cast.id
  };
  emitRevenantProfile(
    runtime,
    rebel ? requireBalanceProfileFromContext(runtime, PROFILE.ordersFromAboveRighteousRebel) : cast.skill,
    common
  );
  if (rebel && hasTrait(runtime, TRAIT.BOLD_REVERSAL))
    emitRevenantProfile(runtime, requireBalanceProfileFromContext(runtime, PROFILE.boldReversalRighteousRebel), common);
}

/** A committed warband summon consumes Band Together at acceptance and selects its enhanced profile. */
function beginBandTogether(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = renegadeState.from(runtime);
  const enhanced = bandTogetherReady(runtime, cast.skill.id);
  const profile = enhanced ? enhancedSkill(runtime, cast.skill.id) : undefined;
  state.bandTogetherReady = false;
  state.bandTogetherExpiresAt = 0;
  if (enhanced && hasTrait(runtime, TRAIT.ALL_FOR_ONE))
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.allForOne), 'resourceGain')
    );
  if (profile)
    emitRevenantProfile(runtime, profile, {
      at: cast.start,
      fullEnd: cast.effectiveEnd,
      sourceId: cast.skill.id,
      eventSkill: cast.skill,
      activationId: cast.id
    });
  bandTogether.set(cast, { enhanced, profileSkillId: profile?.id ?? cast.skill.id });
}

/** Razorclaw's Rage arms its finite player charges and precomputes each assumed ally's ICD-limited Bleeding. */
function razorclawsRage(runtime: RevenantRuntime, cast: RuntimeCast, profile: RevenantSkill): void {
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
    internalCooldown: Math.max(0, Number(proc.cooldown || 0))
  }))
    runtime.emit(
      buildResolverCondition({
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
    );
}

/** Completion arms Razorclaw's charges and, for an ordinary summon, the next Band Together enhancement. */
function completeBandTogether(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const selected = bandTogether.get(cast);
  bandTogether.delete(cast);
  if (!selected) return;
  const profile = (runtime.helpers.skillsById.get(selected.profileSkillId) as RevenantSkill | undefined) ?? cast.skill;
  if (cast.skill.id === ID.RAZORCLAWS_RAGE) razorclawsRage(runtime, cast, profile as RevenantSkill);
  if (selected.enhanced) return;
  const window = requireBalanceProfileFromContext(runtime, PROFILE.bandTogether);
  const effect = requireEffect(window, 'buff', 'band-together');
  // The enhancement window is the buff, so a removed buff arms no enhancement.
  if (!effect) return;
  const state = renegadeState.from(runtime);
  state.bandTogetherReady = true;
  state.bandTogetherExpiresAt = runtime.time + Math.max(0, effectNumber(window, effect, 'duration'));
  emitRevenantProfile(runtime, window, { sourceId: window.id, activationId: cast.id });
}

/** Ashen Demeanor grants its Fervor and self boons once per healing-skill cooldown. */
function ashenDemeanor(runtime: RevenantRuntime, cast: RuntimeCast): void {
  if (cast.skill.slot !== 'Heal' || !hasTrait(runtime, TRAIT.ASHEN_DEMEANOR)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.ashenDemeanor);
  if (
    !tryConsumeProcCooldown(
      runtime.profession.core.traitProcReadyAt,
      'ashenDemeanor',
      runtime.time,
      balanceProfileNumber(profile, 'cooldown')
    )
  )
    return;
  for (let stack = 0; stack < Math.max(0, balanceProfileNumber(profile, 'fervorStacks')); stack += 1)
    grantKallasFervor(runtime, { sourceId: TRAIT.ASHEN_DEMEANOR, sourceName: profile.name });
  for (const effect of profile.effects?.filter((candidate) => candidate.type === 'boon') ?? [])
    emitRevenantBuff(runtime, {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.ASHEN_DEMEANOR,
      actorType: 'player',
      skillId: TRAIT.ASHEN_DEMEANOR,
      skillName: profile.name,
      activationId: cast.id,
      name: `${profile.name} — ${String(effect.boon)}`,
      kind: String(effect.boon),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: effect.audience ?? { recipients: 'self' }
    });
}

/** Actual critical and positional facts drive Ambush Commander and Endless Enmity. */
function criticalTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent, hit?: Gw2HitResolutionContext): void {
  const ambush = hasTrait(runtime, TRAIT.AMBUSH_COMMANDER);
  const enmity = hasTrait(runtime, TRAIT.ENDLESS_ENMITY);
  if (!ambush && !enmity) return;
  const critical = Boolean(hit?.critEligible && hit.critical.didCrit);
  // A defiant golem never rotates, so flanking/behind positional triggers always apply.
  if (ambush && (Boolean(runtime.config.target?.defiant) || critical))
    grantKallasFervor(runtime, { sourceId: TRAIT.AMBUSH_COMMANDER, sourceName: 'Ambush Commander', cause: event });
  const state = renegadeState.from(runtime);
  if (!enmity || !critical || !isInternalCooldownReady(runtime.time, Number(state.endlessEnmityReadyAt || 0))) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.endlessEnmity);
  const effect = requireEffect(profile, 'boon', 'fury');
  // The cooldown gates only fury, so a removed boon leaves it ready.
  if (!effect) return;
  state.endlessEnmityReadyAt = runtime.time + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
  emitRevenantBuff(
    runtime,
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.ENDLESS_ENMITY,
      actorType: 'player',
      skillId: TRAIT.ENDLESS_ENMITY,
      skillName: 'Endless Enmity',
      name: 'Endless Enmity — fury',
      kind: String(effect.boon),
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
    },
    event
  );
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
  const cooldown = Math.max(0, Number(profile.cooldown || 0));
  if (!consumeCharge(razorclaw, runtime.time, cooldown)) return;
  if (cooldown === 0) razorclaw.readyAt = runtime.time;
  runtime.emitDerived(
    event,
    buildResolverCondition({
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
  );
}

/** Citadel Bombardment's first landed impact applies Vindication's Daze. */
function vindication(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (
    event.skillId !== ID.CITADEL_BOMBARDMENT ||
    Number(event.hitIndex || 1) !== 1 ||
    !hasTrait(runtime, TRAIT.VINDICATION)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.vindication);
  const effect = requireEffect(profile, 'control', 'daze');
  if (!effect) return;
  runtime.emitDerived(event, {
    type: 'control',
    at: runtime.time,
    source: 'revenant',
    sourceId: TRAIT.VINDICATION,
    actorType: 'player',
    skillId: TRAIT.VINDICATION,
    skillName: 'Vindication',
    name: 'Vindication — Daze',
    ...(effect.metadata ? { metadata: effect.metadata } : {}),
    controlKind: String(effect.controlKind)
  });
}

/** Soulcleave's Summit's player proc fires once per cooldown from a landed player strike while active. */
function soulcleavePlayer(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  const soulcleave = runtime.helpers.skillsById.get(ID.SOULCLEAVES_SUMMIT);
  const proc = runtime.helpers.skillsById.get(PROFILE.soulcleavesSummitProc);
  const state = renegadeState.from(runtime);
  if (
    !soulcleave ||
    !proc ||
    event.skillId === soulcleave.id ||
    !activeRevenantUpkeep(runtime, soulcleave.id) ||
    !isInternalCooldownReady(runtime.time, Number(state.soulcleaveReadyAt || 0))
  )
    return;
  state.soulcleaveReadyAt = runtime.time + Math.max(0, Number(proc.cooldown || 0));
  for (const effect of proc.effects ?? [])
    for (const { event: packet } of materializeSkillEffectApplications({
      skill: proc,
      effect,
      start: runtime.time,
      fullEnd: runtime.time,
      baseEvent: {
        source: 'revenant',
        sourceId: soulcleave.id,
        actorType: effect.actorType || 'effect',
        skillId: soulcleave.id,
        skillName: soulcleave.name
      },
      skillWeaponFallback: 'Unequipped'
    }))
      emitRevenantPacket(runtime, { ...packet, triggeredBy: event.skillName }, event);
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
    for (const effect of proc.effects ?? [])
      for (const { event } of materializeSkillEffectApplications({
        skill: proc,
        effect,
        start: runtime.time,
        fullEnd: runtime.time,
        baseEvent: {
          source: 'revenant',
          sourceId: skill.id,
          actorType: effect.actorType || 'effect',
          skillId: skill.id,
          skillName: skill.name
        },
        skillWeaponFallback: 'Unequipped'
      }))
        emitRevenantPacket(runtime, {
          ...event,
          name: String(event.name || proc.name).replace(
            "Soulcleave's Summit — ",
            `Soulcleave's Summit — Ally ${allyIndex} `
          )
        });
  runtime.schedule(
    SOULCLEAVE_ALLIES,
    canonicalTime(runtime.time + Math.max(Number(proc.cooldown || 0), 1 / allies.strikesPerSecond)),
    data,
    undefined,
    -200
  );
}

/** Received Fury drives Brutal Momentum's Vigor and Blood Fury's Fervor on their own cooldowns. */
function furyTraits(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (String(event.kind || '').toLowerCase() !== 'fury') return;
  const state = renegadeState.from(runtime);
  if (
    hasTrait(runtime, TRAIT.BRUTAL_MOMENTUM) &&
    gw2BoonApplicationRecipients(runtime.config, event).includesSelf &&
    isInternalCooldownReady(runtime.time, state.brutalMomentumReadyAt)
  ) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.brutalMomentum);
    const effect = requireEffect(profile, 'boon', 'vigor');
    // The cooldown gates only vigor, so a removed boon leaves it ready.
    if (effect) {
      state.brutalMomentumReadyAt = runtime.time + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
      emitRevenantBuff(
        runtime,
        {
          type: 'buff',
          at: runtime.time,
          source: 'revenant',
          sourceId: TRAIT.BRUTAL_MOMENTUM,
          actorType: 'player',
          skillId: profile.id,
          skillName: profile.name,
          kind: String(effect.boon),
          duration: effectNumber(profile, effect, 'duration'),
          stacks: effectNumber(profile, effect, 'stacks')
        },
        event
      );
    }
  }

  if (
    hasTrait(runtime, TRAIT.BLOOD_FURY) &&
    isInternalCooldownReady(runtime.time, Number(state.bloodFuryReadyAt || 0))
  ) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.bloodFury);
    state.bloodFuryReadyAt = runtime.time + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
    grantKallasFervor(runtime, { sourceId: TRAIT.BLOOD_FURY, sourceName: 'Blood Fury', cause: event });
  }
}

/** Swapping into Kalla in combat applies Spirit Boon and Song of the Mists, including two Fervor stacks. */
function invokeRenegade(runtime: RevenantRuntime): void {
  if (runtime.profession.core.activeLegendId !== LEGEND.RENEGADE || !revenantCombatActive(runtime)) return;
  if (hasTrait(runtime, TRAIT.SPIRIT_BOON))
    emitRevenantInvocationProfile(runtime, RENEGADE_SPIRIT_BOON_PROFILE_ID, TRAIT.SPIRIT_BOON);
  const song = runtime.helpers.skillsById.get(ID.CALL_OF_THE_RENEGADE);
  if (!hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS) || !song) return;
  emitRevenantInvocationSkill(runtime, ID.CALL_OF_THE_RENEGADE, TRAIT.SONG_OF_THE_MISTS);
  for (let index = 0; index < 2; index += 1)
    grantKallasFervor(runtime, { sourceId: TRAIT.SONG_OF_THE_MISTS, sourceName: song.name });
}

/** Renegade owns Fervor, warband summons, Kalla's commands, and their actual hit/boon reactions. */
export const renegadeHooks: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  initialize(runtime) {
    renegadeState.from(runtime).kallasFervorMaximumStacks = Math.max(
      1,
      balanceProfileNumber(fervorProfile(runtime), 'maximumStacks')
    );
  },
  // Enhanced Band Together is instant; normal summons keep their authored cast time.
  castDurationMs: (runtime, skill, duration) => (bandTogetherReady(runtime, skill.id) ? 0 : duration),
  rechargeWork(runtime, skill, work) {
    if (!bandTogetherReady(runtime, skill.id) || !hasTrait(runtime, TRAIT.ALL_FOR_ONE)) return work;
    return (
      work *
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.allForOne), 'rechargeMultiplier')
      )
    );
  },
  modifyEffects(_runtime, cast, effects) {
    if (cast.skill.id === ID.HEROIC_COMMAND || cast.skill.id === ID.ORDERS_FROM_ABOVE) return [];
    return bandTogether.get(cast)?.enhanced ? [] : effects;
  },
  onCastStart(runtime, cast) {
    const committed = revenantCastCommitted(cast);
    if (cast.skill.id === ID.ORDERS_FROM_ABOVE) ordersFromAbove(runtime, cast);
    else if (committed && RENEGADE_ENHANCED_SKILL_BY_ID[Number(cast.skill.id)] != null)
      beginBandTogether(runtime, cast);
  },
  onCastComplete(runtime, cast) {
    const committed = revenantCastCommitted(cast);
    if (cast.skill.id === ID.HEROIC_COMMAND && !castWasInterrupted(cast)) heroicCommand(runtime, cast);
    if (committed) completeBandTogether(runtime, cast);
    ashenDemeanor(runtime, cast);
    if (!committed) return;
    if (cast.skill.id === ID.SWAP_LEGENDS) invokeRenegade(runtime);
    const allies = gw2AlliedPlayerAssumptions(runtime.config);
    if (
      cast.skill.id === ID.SOULCLEAVES_SUMMIT &&
      activeRevenantUpkeep(runtime, cast.skill.id) &&
      allies.count &&
      allies.strikesPerSecond
    )
      // Start at least one second after activation.
      runtime.schedule(
        SOULCLEAVE_ALLIES,
        canonicalTime(runtime.time + Math.max(1, 1 / allies.strikesPerSecond)),
        { startsAt: runtime.time },
        undefined,
        -200
      );
  },
  reactions: {
    'damage.resolving'(runtime, event) {
      // Core already applied its additive bonus; Fervor joins the same additive life-steal sum.
      const core = revenantLifeSiphonBonus(
        runtime as unknown as RevenantResolverContext,
        event as RevenantResolverEvent
      );
      if (core == null) return;
      const stacks = activeKallasFervorStacks(renegadeState.from(runtime), runtime.time);
      if (!stacks) return;
      const perStack = balanceProfileNumber(fervorProfile(runtime), 'lifeSiphonDamagePerStack');
      return {
        flatStrikeMultiplier: (Number(event.flatStrikeMultiplier ?? 1) * (1 + core + stacks * perStack)) / (1 + core)
      };
    },
    'damage.resolved'(runtime, event, details) {
      vindication(runtime, event);
      if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
      criticalTraits(runtime, event, (details as { hitContext?: Gw2HitResolutionContext }).hitContext);
      razorclawProc(runtime, event);
      soulcleavePlayer(runtime, event);
    },
    'buff.applied': furyTraits
  },
  tasks: { [SOULCLEAVE_ALLIES]: soulcleaveAllies }
};
