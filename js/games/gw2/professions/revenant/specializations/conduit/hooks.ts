import { materializeSkillEffectApplications } from '#gw2/platform/engine/effects/materializer.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import { emitEffects } from '#gw2/platform/simulation/procedural-emission.js';
import { compileRechargeRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { effectiveConduitAffinity } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { conditionEffectTicks, strikeEffectTicks } from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/platform/engine/skills/availability.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { beguilingHazeCastDuration } from '#gw2/professions/revenant/data/beguiling-haze-timing.js';
import {
  REVENANT_CONDUIT_FORM_BY_LEGEND,
  REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND
} from '#gw2/professions/revenant/data/legends.js';
import { REVENANT_CORE_BALANCE_PROFILE_IDS as CORE_PROFILE } from '#gw2/professions/revenant/core/profiles.js';
import { revenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { emitRevenantInvocationProfile } from '#gw2/professions/revenant/core/traits/index.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import type { Skill, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';

const FORM_EXPIRY = 'revenant.conduit-form-expiry';
const UPKEEP_AFFINITY = 'revenant.conduit-upkeep-affinity';
const UPKEEP_DAGGERS = 'revenant.conduit-upkeep-daggers';
const MESMER_RELEASE = 'revenant.release-mesmer-conditions';
const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));
const CUSTOM_EFFECT_SKILL_IDS = new Set<SkillId>([
  ...BEGUILING_HAZE_SKILL_IDS,
  ID.RELEASE_POTENTIAL_MESMER,
  ID.RELEASE_POTENTIAL_ASSASSIN,
  ID.HEX_EATER_VORTEX
]);
// A cast started in Dervish form keeps its scythe through form expiry or a concurrent legend swap.
const dervishCasts = new WeakSet<RuntimeCast>();
// A main Beguiling Haze arms follow-ups at its completion; follow-up casts never do.
const hazeMainCasts = new WeakSet<RuntimeCast>();

function conduit(runtime: RevenantRuntime) {
  return conduitState.from(runtime);
}

/** Affinity is combat-only and capped; reaching the cap grants Expanded Consciousness Energy. */
function gainAffinity(runtime: RevenantRuntime, amount: number): void {
  if (runtime.config.specialization !== 'Conduit' || !runtime.combatStartedAt()) return;
  const state = conduit(runtime);
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  state.affinityMaximum = maximum;
  const previous = state.affinity || 0;
  state.affinity = grantCapped(previous, amount, maximum);
  if (previous < maximum && state.affinity === maximum && hasTrait(runtime, TRAIT.EXPANDED_CONSCIOUSNESS))
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.expandedConsciousness), 'resourceGain')
    );
}

function hasLegend(runtime: RevenantRuntime, legendId: string): boolean {
  return runtime.profession.core.selectedLegendIds.includes(legendId);
}

/** Profession attacks inherit the active weapon; slot and triggered attacks use level-based strength. */
function skillWeapon(runtime: RevenantRuntime, skill: Skill): string {
  const set = runtime.activeWeaponSet === 2 ? 2 : 1;
  return skill.weapon || (skill.type === 'Profession' ? (gw2PrimaryWeapon(runtime.config, set) ?? '') : 'Unequipped');
}

/** Numinous Gift grants its base and equipped-legend boons to the caster or, with Found Purpose, to allies. */
function numinousGift(runtime: RevenantRuntime, cast: RuntimeCast, allies = false): void {
  if (runtime.config.specialization !== 'Conduit') return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.numinousGift);
  emitEffects(runtime, {
    owner: profile,
    effects: profile.effects?.filter(
      (effect) => effect.type === 'boon' && (!effect.metadata?.legendId || hasLegend(runtime, effect.metadata.legendId))
    ),
    baseEvent: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({
      ...event,
      name: cast.skill.name + ' \u2014 ' + event.kind,
      audience: { recipients: allies ? 'party' : 'self' }
    })
  });
}

/** One entity-specific Shared Wisdom boon accompanies the cast's completion. */
function completionSharedWisdom(runtime: RevenantRuntime, cast: RuntimeCast, trigger: string): void {
  if (!hasTrait(runtime, TRAIT.SHARED_WISDOM)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
  const shared = requireEffect(profile, 'boon', trigger);
  if (!shared) return;
  emitEffects(runtime, {
    owner: profile,
    effects: [shared],
    at: cast.effectiveEnd,
    baseEvent: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event) => ({ ...event, name: cast.skill.name + ' \u2014 ' + event.kind })
  });
}

function lesserDaggers(runtime: RevenantRuntime, source: Skill, cause?: Gw2ResolverEvent): void {
  if (!revenantConduitFormIsActive(conduit(runtime), 'Assassin', runtime.time)) return;
  const skill = runtime.helpers.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Lesser Enchanted Daggers skill declaration.');
  const hit = requireEffect(skill, 'strike', 'Lesser Enchanted Daggers');
  if (!hit) return;
  // Form procs retain player modifiers without recursively triggering player on-hit attacks.
  emitEffects(runtime, {
    owner: skill,
    effects: [hit],
    baseEvent: {
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      triggeredBy: source.name
    },
    cause,
    transform: (event) => ({
      ...event,
      name: 'Lesser Enchanted Daggers',
      skillWeapon: 'Unequipped',
      icon: skill.icon || ''
    })
  });
}

function dervishAttack(runtime: RevenantRuntime, cast: RuntimeCast, at: number, elite = false): void {
  const skillId = elite ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE : ID.FORM_OF_THE_DERVISH_ATTACK;
  const attack = runtime.helpers.skillsById.get(skillId);
  if (!attack) throw new Error('Missing Form of the Dervish attack skill ' + skillId + '.');
  const name = elite ? 'Form of the Dervish (Attack - Elite)' : 'Form of the Dervish (Attack)';
  const hit = requireEffect(attack, 'strike', name);
  if (!hit) return;
  // A removed scythe leaves no attack; surviving hits keep their authored sequence.
  emitEffects(runtime, {
    owner: attack,
    effects: [hit],
    at,
    baseEvent: {
      source: 'revenant',
      sourceId: attack.id,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: attack.id,
      skillName: 'Form of the Dervish',
      activationId: cast.id,
      triggeredBy: cast.skill.name
    },
    transform: (event) => ({ ...event, name, skillWeapon: 'Unequipped', icon: attack.icon || '' })
  });
}

/** Beguiling Haze consumes a follow-up charge, or records a main cast that arms follow-ups on completion. */
function beguilingHaze(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = conduit(runtime);
  const followUp = (state.beguilingHazeCharges || 0) > 0;
  if (followUp) state.beguilingHazeCharges -= 1;
  else hazeMainCasts.add(cast);
  const owner = followUp ? requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp) : cast.skill;
  const hit = requireEffect(owner, 'strike', followUp ? 'Beguiling Haze — Follow-Up' : 'Beguiling Haze');
  // Charge state and Shared Wisdom survive independently of any removed strike.
  if (hit)
    emitEffects(runtime, {
      owner,
      effects: [hit],
      at: cast.start,
      fullEnd: cast.fullEnd,
      baseEvent: {
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id
      },
      transform: (event) => ({
        ...event,
        name: followUp ? 'Beguiling Haze \u2014 Follow-Up' : 'Beguiling Haze',
        skillWeapon: skillWeapon(runtime, cast.skill)
      })
    });
  completionSharedWisdom(runtime, cast, 'beguiling-haze');
}

/** A completed main cast arms the follow-up charges on the shared ammo pool, retaining its main recharge. */
function completeBeguilingHaze(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const state = conduit(runtime);
  if (hazeMainCasts.has(cast)) {
    hazeMainCasts.delete(cast);
    state.beguilingHazeCharges = Math.max(
      0,
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp), 'maximumStacks')
    );
    state.beguilingHazeRecharge = structuredClone(
      runtime.rechargeProgress.get(skill.id) ?? runtime.ammo.get(skill.id)?.rechargeProgress ?? null
    );
    state.beguilingHazeReadyAt =
      runtime.cooldowns.get(skill.id) ?? runtime.ammo.get(skill.id)?.nextRechargeAt ?? runtime.time;
  }

  const ammo = runtime.ammo.get(skill.id);
  if (!ammo) return;
  if (state.beguilingHazeCharges > 0) {
    ammo.maximum = state.beguilingHazeCharges;
    ammo.charges = state.beguilingHazeCharges;
    ammo.nextRechargeAt = null;
    delete ammo.rechargeProgress;
    runtime.cooldownController.clear(skill.id);
  } else {
    ammo.maximum = 1;
    ammo.charges = 0;
    if (!state.beguilingHazeRecharge) throw new Error('Beguiling Haze follow-ups require a main-cast recharge.');
    ammo.rechargeProgress = { ...state.beguilingHazeRecharge };
    ammo.rechargeWork = ammo.rechargeProgress.work;
    ammo.nextRechargeAt = runtime.cooldownController.project(skill, ammo.rechargeProgress);
    state.beguilingHazeReadyAt = ammo.nextRechargeAt;
    runtime.cooldownController.refreshAmmo(skill, runtime.time);
  }
}

/** Hex-Eater Vortex fires one projectile per removed self-condition, or its full salvo with Demon equipped. */
function hexEaterVortex(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const core = runtime.profession.core;
  const at = cast.effectiveEnd;
  const effects = cast.skill.effects ?? [];
  const hit = effects.find((effect) => effect.type === 'strike');
  const torment = effects.find((effect) => effect.type === 'condition');
  const maximum = Math.max(
    hit?.type === 'strike' ? strikeEffectTicks(hit).length : 0,
    torment?.type === 'condition' ? conditionEffectTicks(torment).length : 0
  );
  // Self conditions still active at the cast's end are the ones the vortex removes.
  core.selfConditions = core.selfConditions.filter((application) => (application.expiresAt || 0) > at);
  const active = Math.max(0, core.selfConditionCount || 0) + core.selfConditions.length;
  const projectiles = hasLegend(runtime, LEGEND.DEMON) ? maximum : Math.min(maximum, active);
  const removed = Math.min(maximum, active);
  if (removed > 0) {
    // Static configured conditions deplete first, then runtime conditions oldest-first.
    const configured = Math.min(removed, core.selfConditionCount || 0);
    core.selfConditionCount -= configured;
    core.selfConditions.splice(0, removed - configured);
  }

  if (projectiles > 0)
    emitEffects(runtime, {
      owner: cast.skill,
      effects: effects.map((effect) =>
        effect.type === 'strike'
          ? { ...effect, ticks: strikeEffectTicks(effect).slice(0, projectiles) }
          : effect.type === 'condition'
            ? { ...effect, ticks: conditionEffectTicks(effect).slice(0, projectiles) }
            : effect
      ),
      at: cast.start,
      fullEnd: cast.fullEnd,
      baseEvent: {
        source: 'revenant',
        sourceId: cast.skill.id,
        actorType: 'player',
        skillId: cast.skill.id,
        skillName: cast.skill.name,
        activationId: cast.id
      },
      transform: (event) => ({
        ...event,
        name: 'Hex-Eater Vortex — Projectile ' + (event.hitIndex ?? event.applicationIndex),
        ...(event.type === 'damage' ? { skillWeapon: skillWeapon(runtime, cast.skill) } : {})
      })
    });

  completionSharedWisdom(runtime, cast, 'hex-eater-vortex');
}

/** Release Potential resolves the active legend's variant from current affinity and equipped legends. */
function releasePotential(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const mesmer = cast.skill.id === ID.RELEASE_POTENTIAL_MESMER;
  if (!mesmer && cast.skill.id !== ID.RELEASE_POTENTIAL_ASSASSIN) return;
  const affinity = effectiveConduitAffinity(runtime);
  emitEffects(runtime, {
    owner: cast.skill,
    effects: cast.skill.effects?.filter((effect) => !mesmer || effect.type !== 'condition'),
    at: cast.start,
    fullEnd: cast.fullEnd,
    baseEvent: {
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: 'player',
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id
    },
    transform: (event, effect) => ({
      ...event,
      ...(event.type === 'damage'
        ? {
            skillWeapon: skillWeapon(runtime, cast.skill),
            ...(!mesmer ? { weaponStrengthProfileId: 'nonweapon.profession-mechanic' } : {})
          }
        : {}),
      ...(event.type === 'condition'
        ? { duration: Number(event.duration) * (1 + affinity * Number(effect.durationPerAffinity || 0)) }
        : {})
    })
  });
  if (mesmer) {
    // Affinity is sampled at each actual condition application, independently of a surviving strike.
    for (const effect of cast.skill.effects ?? []) {
      if (effect.type !== 'condition') continue;
      for (const { event } of materializeSkillEffectApplications({
        skill: cast.skill,
        effect,
        start: cast.start,
        fullEnd: cast.fullEnd,
        reactionGroup:
          effect.reactions === undefined ? undefined : runtime.effectReactions.register(cast.skill, effect),
        baseEvent: {
          source: 'revenant',
          sourceId: cast.skill.id,
          actorType: 'player',
          skillId: cast.skill.id,
          skillName: cast.skill.name,
          activationId: cast.id
        }
      }))
        runtime.schedule(MESMER_RELEASE, event.at, {
          event,
          durationPerAffinity: effect.durationPerAffinity ?? 0,
          durationReductionPerAffinity: effect.durationReductionPerAffinity ?? 0
        });
    }
  }
}

/** Mesmer release Torment scales with impact-time affinity; one simulated enemy applies self-Torment once. */
function mesmerRelease(runtime: RevenantRuntime, data: unknown): void {
  const { event, durationPerAffinity, durationReductionPerAffinity } = data as {
    event: SimulationEventBase;
    durationPerAffinity: number;
    durationReductionPerAffinity: number;
  };
  const affinity = effectiveConduitAffinity(runtime);
  if (event.target === 'self') {
    const duration = Number(event.duration) * Math.max(0, 1 - affinity * durationReductionPerAffinity);
    runtime.profession.core.selfConditions.push({
      condition: String(event.condition),
      stacks: Number(event.stacks),
      at: event.at,
      expiresAt: event.at + duration,
      sourceId: event.sourceId,
      skillName: String(event.skillName)
    });
    return;
  }

  runtime.emitProcedural({ ...event, duration: Number(event.duration) * (1 + affinity * durationPerAffinity) });
}

function scheduleFormExpiry(runtime: RevenantRuntime): void {
  const until = conduit(runtime).cosmicWisdomUntil;
  if (until > runtime.time) runtime.schedule(FORM_EXPIRY, until, { until }, undefined, -200);
}

/** Mesmer form overrides these canonical Demon skills' Energy costs; other forms use native costs. */
const MESMER_FORM_COSTS = [
  [ID.EMPOWERING_MISERY, PROFILE.mesmerEmpoweringMisery],
  [ID.PAIN_ABSORPTION, PROFILE.mesmerPainAbsorption],
  [ID.BANISH_ENCHANTMENT, PROFILE.mesmerBanishEnchantment],
  [ID.CALL_TO_ANGUISH, PROFILE.mesmerCallToAnguish],
  [ID.UNYIELDING_IMPACT, PROFILE.mesmerUnyieldingImpact],
  [ID.EMBRACE_THE_DARKNESS, PROFILE.mesmerEmbraceTheDarkness]
] as const;

/** Applies the current form's cost overrides; input aliases have already resolved to canonical skills. */
function syncConduitEnergyCostOverrides(runtime: RevenantRuntime): void {
  const state = conduit(runtime);
  state.energyCostOverrides =
    state.conduitForm === 'Mesmer'
      ? Object.fromEntries(
          MESMER_FORM_COSTS.map(([skillId, profileId]) => [
            skillId,
            balanceProfileNumber(requireBalanceProfileFromContext(runtime, profileId), 'energyCost')
          ])
        )
      : {};
}

/** Form expiry clears the form and restores native Energy costs, unless an extension moved the deadline. */
function formExpiry(runtime: RevenantRuntime, data: unknown): void {
  const state = conduit(runtime);
  if (state.cosmicWisdomUntil !== (data as { until: number }).until) return;
  state.cosmicWisdomUntil = 0;
  state.conduitForm = '';
  syncConduitEnergyCostOverrides(runtime);
}

/** Cosmic Wisdom resolves Mistfire, then opens the current legend's form and grants Numinous Gift. */
function cosmicWisdom(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = conduit(runtime);
  if (hasTrait(runtime, TRAIT.MISTFIRE)) {
    const profile = requireBalanceProfileFromContext(runtime, PROFILE.mistfire);
    emitEffects(runtime, {
      owner: profile,
      effects: profile.effects?.filter((effect) => effect.type === 'strike' || effect.type === 'condition'),
      baseEvent: {
        source: 'revenant',
        sourceId: TRAIT.MISTFIRE,
        actorType: 'effect',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        activationId: cast.id
      },
      transform: (event) => ({
        ...event,
        name: event.type === 'damage' ? 'Mistfire' : 'Mistfire — Burning',
        skillWeapon: 'Unequipped'
      })
    });
  }

  const window = requireEffect(cast.skill, 'buff', 'cosmic-wisdom');
  // A removed window buff leaves the form and gift active for no duration.
  state.cosmicWisdomUntil = runtime.time + (window ? effectNumber(cast.skill, window, 'duration') : 0);
  state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[runtime.profession.core.activeLegendId] || '';
  syncConduitEnergyCostOverrides(runtime);
  scheduleFormExpiry(runtime);
  numinousGift(runtime, cast);
}

/** Legend swaps reset affinity, inherit Entity invocations, extend and re-select the form, and share Found Purpose. */
function swapLegend(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = conduit(runtime);
  const core = runtime.profession.core;
  const combat = runtime.combatStartedAt();
  // Entity invocation inherits Spirit Boon and Song of the Mists from Conduit's paired Core legend.
  if (core.activeLegendId === LEGEND.ENTITY && combat) {
    const paired = core.selectedLegendIds.find((legendId) => legendId !== LEGEND.ENTITY);
    if (paired && hasTrait(runtime, TRAIT.SPIRIT_BOON))
      emitRevenantInvocationProfile(
        runtime,
        CORE_PROFILE.spiritBoon,
        TRAIT.SPIRIT_BOON,
        (effect) => effect.metadata?.legendId === paired
      );
    if (paired && hasTrait(runtime, TRAIT.SONG_OF_THE_MISTS))
      emitRevenantInvocationProfile(
        runtime,
        CORE_PROFILE.songOfTheMists,
        TRAIT.SONG_OF_THE_MISTS,
        (effect) => effect.metadata?.legendId === paired
      );
  }

  // The form state before the reset decides Enhanced Embodiment and the form update.
  const formActive = state.cosmicWisdomUntil > runtime.time;
  state.affinity = 0;
  if (combat && hasTrait(runtime, TRAIT.LINGERING_DETERMINATION))
    gainAffinity(
      runtime,
      Math.max(
        0,
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.lingeringDetermination), 'resourceGain')
      )
    );
  if (formActive && hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT)) {
    const enhanced = requireBalanceProfileFromContext(runtime, PROFILE.enhancedEmbodiment);
    const extension = requireEffect(enhanced, 'buff', 'cosmic-wisdom-extension');
    if (extension) {
      state.cosmicWisdomUntil += Math.max(0, effectNumber(enhanced, extension, 'duration'));
      scheduleFormExpiry(runtime);
    }
  }

  if (formActive) {
    state.conduitForm = REVENANT_CONDUIT_FORM_BY_LEGEND[core.activeLegendId] || '';
    syncConduitEnergyCostOverrides(runtime);
  }

  // Found Purpose shares invocation boons only once combat has started.
  if (combat && hasTrait(runtime, TRAIT.FOUND_PURPOSE)) numinousGift(runtime, cast, true);
}

/** Each committed Energy-costing legend or armed weapon cast builds affinity at acceptance. */
function costAffinity(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as RevenantSkill;
  const cost = revenantEnergyCost(runtime, skill);
  if (!(cost > 0)) return;
  // Legend skills whose affinity is deferred to hit time are excluded to avoid double-granting.
  if (skill.legendId && !skill.affinityOnHit) gainAffinity(runtime, cost >= 25 ? 2 : 1);
  else if (skill.type === 'Weapon' && hasTrait(runtime, TRAIT.CONDUCTIVE_ARMAMENTS)) gainAffinity(runtime, 1);
}

/** Upkeep cadences grant affinity and Impossible Odds' Assassin daggers while their activation remains. */
function upkeepAffinity(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !runtime.helpers.skillsById.has(skillId)) return;
  gainAffinity(runtime, 1);
  runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
}

function upkeepDaggers(runtime: RevenantRuntime, data: unknown): void {
  const { skillId, startsAt } = data as { skillId: SkillId; startsAt: number };
  const skill = runtime.helpers.skillsById.get(skillId);
  if (!activeRevenantUpkeep(runtime, skillId, startsAt) || !skill) return;
  lesserDaggers(runtime, skill);
  runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
}

/** Conduit owns affinity, forms, Entity skills, Release Potential, and Beguiling Haze on the shared live state. */
// Form selection chooses the base first; trait rules then scale that selected recharge.
const conduitRecharge = compileRechargeRules<RevenantRuntimeState>([
  {
    trait: TRAIT.ENHANCED_EMBODIMENT,
    when: (runtime, skill) => skill.id === ID.SWAP_LEGENDS && runtime.combatStartedAt(),
    multiplier: { profile: PROFILE.enhancedEmbodiment, field: 'rechargeMultiplier' }
  },
  {
    trait: TRAIT.KINETIC_INSIGHT,
    when: (_runtime, skill) => RELEASE_POTENTIAL_IDS.has(skill.id),
    multiplier: { profile: TRAIT.KINETIC_INSIGHT, field: 'rechargeMultiplier' }
  }
]);

export const conduitHooks: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  // Control-triggered Burning shares Mistfire's profile, excluding its own Twin Moon chain.
  traitTriggers: [
    {
      trait: TRAIT.MISTFIRE,
      emit: PROFILE.mistfire,
      on: 'control.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        !(event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) &&
        Boolean(requireEffect(requireBalanceProfileFromContext(runtime, PROFILE.mistfire), 'condition', 'Burning')),
      effects: (effect) => effect.type === 'condition' && effect.name === 'Burning',
      attribution: {
        source: 'revenant',
        ownerActorType: 'player',
        skillId: TRAIT.MISTFIRE,
        skillName: 'Mistfire',
        name: 'Mistfire — Burning'
      }
    }
  ],
  availability(runtime, skill) {
    const state = conduit(runtime);
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      // Both skill identities share the main recharge and its committed progress.
      if (state.beguilingHazeRecharge)
        state.beguilingHazeReadyAt = gw2CooldownReadyAt(
          runtime.cooldownController.project(skill, state.beguilingHazeRecharge)
        );
      if ((state.beguilingHazeCharges || 0) <= 0 && runtime.time < (state.beguilingHazeReadyAt || 0))
        return denySkillCast(
          skill,
          'revenant.beguiling-haze-cooldown',
          'Beguiling Haze is recharging.',
          state.beguilingHazeReadyAt
        );
    }

    // All five variants share one bar slot; block the variant the active legend does not supply.
    if (
      RELEASE_POTENTIAL_IDS.has(skill.id) &&
      REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND[runtime.profession.core.activeLegendId] !== skill.id
    )
      return denySkillCast(
        skill,
        'revenant.release-variant',
        'the active legend supplies a different Release Potential variant.'
      );
    return { ready: true };
  },
  castDurationMs(runtime, skill, durationMs) {
    if (!BEGUILING_HAZE_SKILL_IDS.has(skill.id)) return durationMs;
    return (
      beguilingHazeCastDuration(
        durationMs / 1000,
        (conduit(runtime).beguilingHazeCharges || 0) > 0,
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp),
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeMainCastExtension)
      ) * 1000
    );
  },
  rechargeWork(runtime, skill, work) {
    if (skill.id === ID.SWAP_LEGENDS) {
      // Precombat legend swaps stay free; Enhanced Embodiment scales the base in combat.
      if (work === 0 || !runtime.combatStartedAt() || !hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT)) return work;
      return conduitRecharge(runtime, skill, Math.max(0, skill.cooldown ?? work));
    }

    const mesmerProfile =
      skill.id === ID.PAIN_ABSORPTION
        ? PROFILE.mesmerPainAbsorption
        : skill.id === ID.BANISH_ENCHANTMENT
          ? PROFILE.mesmerBanishEnchantment
          : null;
    // Mesmer form gives these Demon utilities a recharge; Alacrity still applies to the new base.
    if (mesmerProfile && revenantConduitFormIsActive(conduit(runtime), 'Mesmer', runtime.time))
      return Math.max(0, balanceProfileNumber(requireBalanceProfileFromContext(runtime, mesmerProfile), 'cooldown'));
    return conduitRecharge(runtime, skill, work);
  },
  modifyEffects(runtime, cast, effects) {
    if (CUSTOM_EFFECT_SKILL_IDS.has(cast.skill.id)) return [];
    // Declarative releases keep the same active-weapon attribution as their former procedural packets.
    return RELEASE_POTENTIAL_IDS.has(cast.skill.id)
      ? effects.map((effect) =>
          effect.type === 'strike' ? { ...effect, weapon: skillWeapon(runtime, cast.skill) } : effect
        )
      : effects;
  },
  onCastStart(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    costAffinity(runtime, cast);
    if (skill.legendId === LEGEND.ENTITY && revenantConduitFormIsActive(conduit(runtime), 'Dervish', cast.start))
      dervishCasts.add(cast);
    if (skill.id === ID.HEX_EATER_VORTEX) hexEaterVortex(runtime, cast);
    if (cast.cancelled) return;
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) beguilingHaze(runtime, cast);
    else if (RELEASE_POTENTIAL_IDS.has(skill.id)) releasePotential(runtime, cast);
  },
  onCastCommit(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      completeBeguilingHaze(runtime, cast);
    }

    // Cosmic Wisdom form procs follow successful casts through the common completion path.
    if (skill.legendId === LEGEND.ASSASSIN) lesserDaggers(runtime, skill);
    if (dervishCasts.has(cast)) {
      dervishAttack(runtime, cast, runtime.time);
      if (TWIN_MOON_SKILL_IDS.has(skill.id)) dervishAttack(runtime, cast, runtime.time, true);
    }

    dervishCasts.delete(cast);
    // Shared Wisdom Swiftness belongs only to Entity legend skills.
    if (skill.legendId === LEGEND.ENTITY) completionSharedWisdom(runtime, cast, 'entity-skill');

    if (skill.id === ID.COSMIC_WISDOM) cosmicWisdom(runtime, cast);
    else if (skill.id === ID.SWAP_LEGENDS) swapLegend(runtime, cast);
    if (isRevenantUpkeep(skill) && activeRevenantUpkeep(runtime, skill.id, runtime.time)) {
      const data = { skillId: skill.id, startsAt: runtime.time };
      runtime.schedule(UPKEEP_AFFINITY, canonicalTime(runtime.time + 3), data, undefined, -200);
      if (skill.id === ID.IMPOSSIBLE_ODDS)
        runtime.schedule(UPKEEP_DAGGERS, canonicalTime(runtime.time + 1), data, undefined, -190);
    }
  },
  onCooldownReset(runtime) {
    // A full cooldown reset makes Beguiling Haze immediately available.
    conduit(runtime).beguilingHazeReadyAt = runtime.time;
    conduit(runtime).beguilingHazeRecharge = null;
  },
  reactions: {
    'damage.resolved'(runtime, event) {
      if (event.metadata?.affinityOnHit !== true) return;
      const skill = event.skillId == null ? undefined : runtime.helpers.skillsById.get(event.skillId);
      gainAffinity(runtime, Number(skill?.energyCost || 0) >= 25 ? 2 : 1);
    }
  },
  tasks: {
    [FORM_EXPIRY]: formExpiry,
    [UPKEEP_AFFINITY]: upkeepAffinity,
    [UPKEEP_DAGGERS]: upkeepDaggers,
    [MESMER_RELEASE]: mesmerRelease
  }
};
