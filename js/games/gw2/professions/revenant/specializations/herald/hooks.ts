import { canonicalTime, EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { armSkillFlip, consumeSkillFlip, skillFlipReady } from '#gw2/platform/engine/skills/skill-flips.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import {
  emitRevenantInvocationProfile,
  emitRevenantInvocationSkill
} from '#gw2/professions/revenant/core/traits/index.js';
import { activeRevenantUpkeep, removeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { HERALD_MECHANICS as MECHANICS } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facet-passives.js';
import { buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import {
  HERALD_DRACONIC_ECHO_PROFILE_ID,
  HERALD_ELEVATED_COMPASSION_PROFILE_ID,
  HERALD_NATURE_ASSASSIN_PROFILE_ID,
  HERALD_SHARED_EMPOWERMENT_PROFILE_ID,
  HERALD_SPIRIT_BOON_PROFILE_ID
} from '#gw2/professions/revenant/specializations/herald/profiles.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { EffectAudience } from '#gw2/platform/engine/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

const FACET_PULSE = 'revenant.herald-facet-pulse';
const ECHO_EXPIRY = 'revenant.herald-echo-expiry';
const COMPASSION = 'revenant.herald-elevated-compassion';

function facetConsumeId(skill: RevenantSkill, activeLegendId: string): SkillId | undefined {
  if (skill.id === ID.FACET_OF_NATURE)
    return (MECHANICS.trueNatureConsumeByLegendId as Readonly<Record<string, SkillId>>)[activeLegendId];
  return (MECHANICS.facetConsumeBySkillId as Readonly<Record<SkillId, SkillId>>)[skill.id];
}

/** Each facet pulse is identified by its scheduled instant; reactivation or expiry leaves stale pulses inert. */
function scheduleFacetPulse(runtime: RevenantRuntime, skillId: SkillId, at: number): void {
  heraldState.from(runtime).facetPulseReadyAt[skillId] = at;
  runtime.schedule(FACET_PULSE, at, { skillId });
}

function facetPulse(runtime: RevenantRuntime, data: unknown): void {
  const { skillId } = data as { skillId: SkillId };
  const state = heraldState.from(runtime);
  if (state.facetPulseReadyAt[skillId] !== runtime.time) return;
  if (!heraldFacetPassiveActive(runtime.profession.core, state, skillId, runtime.time)) return;
  const skill = runtime.helpers.skillsById.get(skillId) as RevenantSkill | undefined;
  const pulse = skill?.upkeepPulse as
    { readonly kind: string; readonly duration: number; readonly stacks: number } | undefined;
  if (!skill || !pulse) return;
  runtime.emitProcedural({
    type: 'buff',
    at: runtime.time,
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    name: `${skill.name} - ${pulse.kind}`,
    kind: pulse.kind,
    duration: pulse.duration,
    stacks: pulse.stacks,
    audience: { recipients: 'party' }
  });
  const next = canonicalTime(runtime.time + Math.max(EPSILON, Number(skill.pulseInterval ?? 3)));
  if (heraldFacetPassiveActive(runtime.profession.core, state, skillId, next))
    scheduleFacetPulse(runtime, skillId, next);
  else state.facetPulseReadyAt[skillId] = next;
}

/** An activated facet arms its consume and starts its own boon cadence at completion. */
function startFacet(runtime: RevenantRuntime, skill: RevenantSkill): void {
  if (!skill.facet || !activeRevenantUpkeep(runtime, skill.id)) return;
  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  delete state.lingeringFacets[skill.id];
  const consumeId = facetConsumeId(skill, core.activeLegendId);
  if (consumeId != null) armSkillFlip(core.availableFlips, consumeId, runtime.time);
  if (!skill.upkeepPulse) return;
  scheduleFacetPulse(
    runtime,
    skill.id,
    canonicalTime(runtime.time + Math.max(EPSILON, Number(skill.pulseInterval ?? 3)))
  );
}

// A committed consume's facet and prior activity are acceptance facts reused at its completion.
const consumedFacets = new WeakMap<RuntimeCast, { facet: RevenantSkill; wasActive: boolean }>();

function consumedFacet(runtime: RevenantRuntime, cast: RuntimeCast): RevenantSkill | undefined {
  const facetId = (MECHANICS.facetSkillByConsumeId as Readonly<Record<SkillId, SkillId>>)[cast.skill.id];
  return facetId == null ? undefined : (runtime.helpers.skillsById.get(facetId) as RevenantSkill | undefined);
}

/** A committed consume ends the facet's drain and passive immediately; its follow-up is spent. */
function startConsume(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const facet = consumedFacet(runtime, cast);
  const wasActive = Boolean(facet && removeRevenantUpkeep(runtime, facet.id));
  runtime.resourceController.refresh('energy');
  consumeSkillFlip(runtime.profession.core.availableFlips, cast.skill.id);
  if (facet) consumedFacets.set(cast, { facet, wasActive });
}

/** The parent recharge and any Draconic Echo retention begin when the consume completes. */
function completeConsume(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const consumed = consumedFacets.get(cast);
  consumedFacets.delete(cast);
  if (!consumed) return;
  const { facet, wasActive } = consumed;
  const core = runtime.profession.core;
  // Parent ownership makes Facet of Nature's cooldown shared by every legend-specific True Nature.
  if (cast.rechargeWork > 0) runtime.cooldownController.startRecharge(facet, runtime.time, cast.rechargeWork);
  if (!wasActive || !hasTrait(runtime, TRAIT.DRACONIC_ECHO)) return;
  const state = heraldState.from(runtime);
  const profile = requireBalanceProfileFromContext(runtime, HERALD_DRACONIC_ECHO_PROFILE_ID);
  const expiresAt = canonicalTime(runtime.time + balanceProfileNumber(profile, 'duration'));
  // Retention preserves the pulse phase, but never keeps an Energy-draining upkeep alive.
  state.lingeringFacets[facet.id] = { startsAt: runtime.time, expiresAt, legendId: core.activeLegendId };
  const nextAt = state.facetPulseReadyAt[facet.id];
  if (facet.upkeepPulse && nextAt >= runtime.time && nextAt < expiresAt) scheduleFacetPulse(runtime, facet.id, nextAt);
  runtime.schedule(ECHO_EXPIRY, expiresAt, { skillId: facet.id, expiresAt });
}

function echoExpiry(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, expiresAt } = data as { skillId: SkillId; expiresAt: number };
  const state = heraldState.from(runtime);
  if (state.lingeringFacets[skillId]?.expiresAt === expiresAt) delete state.lingeringFacets[skillId];
}

function elevatedCompassionActive(runtime: RevenantRuntime): boolean {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const threshold = Math.max(0, balanceProfileNumber(profile, 'threshold'));
  const upkeep = runtime.profession.core.activeUpkeeps.reduce(
    (total, active) => total + Math.max(0, Number(active.upkeepCost || 0)),
    0
  );
  return hasTrait(runtime, TRAIT.ELEVATED_COMPASSION) && upkeep >= threshold;
}

/** Grants one Quickness pulse and reserves the next legal pulse so threshold re-entry cannot bypass the ICD. */
function grantCompassion(runtime: RevenantRuntime): void {
  const profile = requireBalanceProfileFromContext(runtime, HERALD_ELEVATED_COMPASSION_PROFILE_ID);
  const effect = requireEffect(profile, 'boon', 'quickness');
  // The cooldown gates only quickness, so a removed boon leaves the pulse ready.
  if (!effect) return;
  runtime.emitProcedural({
    type: 'buff',
    at: runtime.time,
    source: 'revenant',
    sourceId: TRAIT.ELEVATED_COMPASSION,
    actorType: 'player',
    skillId: TRAIT.ELEVATED_COMPASSION,
    skillName: 'Elevated Compassion',
    name: 'Elevated Compassion - quickness',
    kind: String(effect.boon),
    duration: Math.max(0, effectNumber(profile, effect, 'duration')),
    stacks: Math.max(1, effectNumber(profile, effect, 'stacks')),
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
  });
  heraldState.from(runtime).elevatedCompassionReadyAt = canonicalTime(
    runtime.time + Math.max(EPSILON, balanceProfileNumber(profile, 'cooldown'))
  );
}

function scheduleCompassion(runtime: RevenantRuntime, at: number): void {
  heraldState.from(runtime).elevatedCompassionPulseAt = at;
  runtime.schedule(COMPASSION, at);
}

/** Upkeep-changing casts start the one Elevated Compassion cadence; falling below threshold ends it lazily. */
function syncCompassion(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime);
  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  if (state.elevatedCompassionPulseAt != null && state.elevatedCompassionPulseAt >= runtime.time) return;
  const readyAt = Math.max(runtime.time, Number(state.elevatedCompassionReadyAt || 0));
  if (readyAt <= runtime.time + EPSILON) {
    grantCompassion(runtime);
    scheduleCompassion(runtime, state.elevatedCompassionReadyAt);
  } else scheduleCompassion(runtime, readyAt);
}

function compassionPulse(runtime: RevenantRuntime): void {
  const state = heraldState.from(runtime);
  if (state.elevatedCompassionPulseAt !== runtime.time) return;
  if (!elevatedCompassionActive(runtime)) {
    state.elevatedCompassionPulseAt = null;
    return;
  }

  grantCompassion(runtime);
  scheduleCompassion(runtime, state.elevatedCompassionReadyAt);
}

/** Applied standard boons with at least one recipient grant Shared Empowerment's Might once per cooldown. */
function sharedEmpowerment(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (
    event.sourceId === TRAIT.SHARED_EMPOWERMENT ||
    !isStandardBoon(String(event.kind)) ||
    !(Number((event.resolvedAudience as { recipientCount?: number } | undefined)?.recipientCount) > 0) ||
    !hasTrait(runtime, TRAIT.SHARED_EMPOWERMENT)
  )
    return;
  const state = heraldState.from(runtime);
  if (!isInternalCooldownReady(runtime.time, state.sharedEmpowermentReadyAt)) return;
  const profile = requireBalanceProfileFromContext(runtime, HERALD_SHARED_EMPOWERMENT_PROFILE_ID);
  const effect = requireEffect(profile, 'boon', 'might');
  // The cooldown gates only might, so a removed boon leaves it ready.
  if (!effect) return;
  // Reserve the ICD before emitting Might so the derived boon cannot recursively trigger the trait.
  state.sharedEmpowermentReadyAt = runtime.time + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
  runtime.emitProcedural(
    {
      type: 'buff',
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.SHARED_EMPOWERMENT,
      actorType: 'effect',
      skillId: TRAIT.SHARED_EMPOWERMENT,
      skillName: 'Shared Empowerment',
      name: 'Shared Empowerment — might',
      kind: String(effect.boon),
      duration: Math.max(0, effectNumber(profile, effect, 'duration')),
      stacks: Math.max(1, effectNumber(profile, effect, 'stacks')),
      audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
    },
    { cause: event }
  );
}

/** True Nature (Dragon) extends boons when its authored proc lands; Core Value adds a flat second. */
function trueNatureDragon(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const proc = cast.skill.effects?.find(
    (effect) =>
      effect.type === 'custom' && (effect.event as { procType?: string } | undefined)?.procType === 'boon-extension'
  );
  const authored =
    proc?.type === 'custom' ? (proc.event as { name?: string; duration?: number; audience?: EffectAudience }) : null;
  if (!authored) return;
  const extension = Math.max(0, Number(authored.duration || 0)) + (hasTrait(runtime, TRAIT.CORE_VALUE) ? 1 : 0);
  if (extension <= 0) return;
  runtime.emit({
    type: 'boon_extension',
    at: runtime.time,
    source: 'revenant',
    sourceId: cast.skill.id,
    actorType: 'player',
    skillId: cast.skill.id,
    skillName: cast.skill.name,
    activationId: cast.id,
    procType: 'boon-extension',
    name: authored.name,
    duration: extension,
    ...(authored.audience ? { audience: authored.audience } : {}),
    extensionAudience: 'all'
  });
}

/** Landed player strikes under Assassin Nature (active or retained) siphon once per cooldown; siphons never recurse. */
function natureSiphon(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  const active = activeRevenantUpkeep(runtime, ID.FACET_OF_NATURE);
  const legend = active ? core.activeLegendId : state.lingeringFacets[ID.FACET_OF_NATURE]?.legendId;
  if (
    legend !== LEGEND.ASSASSIN ||
    !heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, runtime.time) ||
    !isInternalCooldownReady(runtime.time, state.natureSiphonReadyAt)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, HERALD_NATURE_ASSASSIN_PROFILE_ID);
  const strike = requireEffect(profile, 'strike', 'Life Siphon');
  // The cooldown gates only the siphon, so a removed strike leaves it ready.
  if (!strike) return;
  state.natureSiphonReadyAt = runtime.time + balanceProfileNumber(profile, 'cooldown');
  runtime.emitDerived(
    event,
    buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.FACET_OF_NATURE,
      skillId: ID.FACET_OF_NATURE,
      skillName: profile.name,
      name: 'Facet of Nature — Life Siphon',
      actorType: 'effect',
      ownerActorType: 'player',
      coefficient: 0,
      noCrit: true,
      lifeSiphon: true,
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName
    })
  );
}

/** Herald owns facet availability, lifecycle, passives, and Dragon invocation on the shared live state. */
export const heraldHooks: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  availability(runtime, skill) {
    const core = runtime.profession.core;
    if (skill.consume && !skillFlipReady(core.availableFlips[skill.id], runtime.time))
      return denySkillCast(skill, 'revenant.facet-inactive', 'activate the matching facet first.');
    if (skill.facet && activeRevenantUpkeep(runtime, skill.id))
      return denySkillCast(skill, 'revenant.facet-active', 'the facet is already active; consume it instead.');
    return { ready: true };
  },
  onCastStart(runtime, cast) {
    if (cast.skill.consume && !cast.cancelled) startConsume(runtime, cast);
  },
  onCastComplete(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    const committed = !cast.cancelled;
    if (committed && skill.consume) completeConsume(runtime, cast);
    if (committed && skill.id === ID.TRUE_NATURE_DRAGON && !castWasInterrupted(cast)) trueNatureDragon(runtime, cast);
    // Facet lifecycle changes aggregate upkeep before Elevated Compassion evaluates its threshold.
    if (committed) startFacet(runtime, skill);
    syncCompassion(runtime);
    if (!committed || skill.id !== ID.SWAP_LEGENDS) return;
    if (runtime.profession.core.activeLegendId !== LEGEND.DRAGON || !runtime.combatStartedAt()) return;
    if (hasTrait(runtime, TRAIT.SPIRIT_BOON))
      emitRevenantInvocationProfile(runtime, HERALD_SPIRIT_BOON_PROFILE_ID, TRAIT.SPIRIT_BOON);
    if (hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS))
      emitRevenantInvocationSkill(runtime, ID.CALL_OF_THE_DRAGON, TRAIT.SONG_OF_THE_MISTS);
  },
  reactions: {
    'buff.applied': sharedEmpowerment,
    'damage.resolved': natureSiphon
  },
  tasks: {
    [FACET_PULSE]: facetPulse,
    [ECHO_EXPIRY]: echoExpiry,
    [COMPASSION]: compassionPulse
  }
};
