import { canonicalTime, isInternalCooldownReady } from '#kernel/core/clock.js';
import { grantCapped } from '#gw2/platform/combat/resources/pool.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  conditionEffectTicks,
  effectFirstAtMs,
  strikeEffectCoefficient,
  strikeEffectTicks
} from '#gw2/platform/engine/effects/authoring.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';
import { buildResolverCondition, buildResolverStrike } from '#gw2/platform/resolver/packets.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import { denySkillCast } from '#gw2/professions/shared/availability.js';
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
import { liveRevenantEnergyCost } from '#gw2/professions/revenant/family-state.js';
import { emitRevenantBuff, revenantLiveCombatActive } from '#gw2/professions/revenant/core/live-events.js';
import { revenantCastCommitted } from '#gw2/professions/revenant/core/live.js';
import { emitRevenantInvocationProfile } from '#gw2/professions/revenant/core/live-traits.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/live-upkeep.js';
import { isRevenantUpkeep } from '#gw2/professions/revenant/data/upkeep-skills.js';
import { CONDUIT_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { conduitState, revenantConduitFormIsActive } from '#gw2/professions/revenant/specializations/conduit/state.js';
import {
  BEGUILING_HAZE_SKILL_IDS,
  TWIN_MOON_SKILL_IDS
} from '#gw2/professions/revenant/specializations/conduit/skill-groups.js';
import type { SimulationEventBase } from '#gw2/platform/engine/events/events.js';
import type { Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { RuntimeCast, RuntimeProfession } from '#gw2/platform/simulation/runtime-state.js';
import type { RevenantRuntimeState, RevenantSkill } from '#gw2/professions/revenant/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/live-events.js';

const FORM_EXPIRY = 'revenant.conduit-form-expiry';
const UPKEEP_AFFINITY = 'revenant.conduit-upkeep-affinity';
const UPKEEP_DAGGERS = 'revenant.conduit-upkeep-daggers';
const MESMER_RELEASE = 'revenant.release-mesmer-conditions';
const RELEASE_POTENTIAL_IDS = new Set<SkillId>(Object.values(REVENANT_RELEASE_POTENTIAL_SKILL_ID_BY_LEGEND));
const CUSTOM_EFFECT_SKILL_IDS = new Set<SkillId>([
  ...BEGUILING_HAZE_SKILL_IDS,
  ...TWIN_MOON_SKILL_IDS,
  ...RELEASE_POTENTIAL_IDS,
  ID.GLADIATORS_DEFENSE,
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
  if (runtime.config.specialization !== 'Conduit' || !revenantLiveCombatActive(runtime)) return;
  const state = conduit(runtime);
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  state.affinityMaximum = maximum;
  const previous = Number(state.affinity || 0);
  state.affinity = grantCapped(previous, amount, maximum);
  if (previous < maximum && state.affinity === maximum && hasTrait(runtime, TRAIT.EXPANDED_CONSCIOUSNESS))
    runtime.resourceController.grant(
      'energy',
      balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.expandedConsciousness), 'resourceGain')
    );
}

/** Kinetic Insight adds a virtual +2 affinity for scaling without changing the stored value. */
function effectiveAffinity(runtime: RevenantRuntime): number {
  const maximum = Math.max(
    1,
    balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'maximumStacks')
  );
  return Math.min(maximum, Number(conduit(runtime).affinity || 0) + (hasTrait(runtime, TRAIT.KINETIC_INSIGHT) ? 2 : 0));
}

function hasLegend(runtime: RevenantRuntime, legendId: string): boolean {
  return runtime.profession.core.selectedLegendIds.includes(legendId);
}

/** Profession attacks inherit the active weapon; slot and triggered attacks use level-based strength. */
function skillWeapon(runtime: RevenantRuntime, skill: Skill): string {
  const set = runtime.activeWeaponSet === 2 ? 2 : 1;
  return (
    skill.weapon || (skill.type === 'Profession' ? String(gw2PrimaryWeapon(runtime.config, set) ?? '') : 'Unequipped')
  );
}

function effectAt(cast: RuntimeCast, effect: SkillEffect | undefined, atMs?: number): number {
  const origin = effect?.timingAnchor === 'castEnd' ? cast.fullEnd : cast.start;
  const packetAtMs =
    atMs ?? (effect?.type === 'strike' || effect?.type === 'condition' ? effectFirstAtMs(effect) : effect?.atMs);
  return canonicalTime(origin + Math.max(0, Number(packetAtMs || 0)) / 1000);
}

function firstConditionTick(effect: SkillEffect | undefined, condition?: string) {
  if (effect?.type !== 'condition') return undefined;
  return conditionEffectTicks(effect).find((tick) => condition == null || tick.condition === condition);
}

function strike(
  runtime: RevenantRuntime,
  cast: RuntimeCast | null,
  skill: Skill,
  fields: { at: number; coefficient: number } & Partial<SimulationEventBase>,
  cause?: Gw2ResolverEvent
): void {
  const event = buildResolverStrike({
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player' as const,
    skillId: skill.id,
    skillName: skill.name,
    name: skill.name,
    ...(cast ? { activationId: cast.id } : {}),
    ...fields
  });
  if (cause) runtime.emitDerived(cause, event);
  else runtime.emit(event);
}

function condition(
  runtime: RevenantRuntime,
  cast: RuntimeCast | null,
  skill: Skill,
  fields: { at: number; condition: string; stacks: number; duration: number } & Partial<SimulationEventBase>
): void {
  runtime.emit(
    buildResolverCondition({
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'player' as const,
      skillId: skill.id,
      skillName: skill.name,
      ...(cast ? { activationId: cast.id } : {}),
      ...fields
    })
  );
}

function boon(
  runtime: RevenantRuntime,
  cast: RuntimeCast | null,
  skill: Skill,
  fields: { at: number; kind: string; duration: number; stacks: number } & Partial<SimulationEventBase>
): void {
  emitRevenantBuff(runtime, {
    type: 'buff',
    source: 'revenant',
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    ...(cast ? { activationId: cast.id } : {}),
    ...fields
  });
}

/** Numinous Gift grants its base and equipped-legend boons to the caster or, with Found Purpose, to allies. */
function numinousGift(runtime: RevenantRuntime, cast: RuntimeCast, allies = false): void {
  if (runtime.config.specialization !== 'Conduit') return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.numinousGift);
  const legends = runtime.profession.core.selectedLegendIds;
  for (const effect of profile.effects ?? []) {
    if (effect.type !== 'boon' || !effect.boon) continue;
    const legendId = String(effect.metadata?.legendId || '');
    if (legendId && !legends.includes(legendId)) continue;
    boon(runtime, cast, cast.skill, {
      at: runtime.time,
      name: `${cast.skill.name} — ${effect.boon}`,
      kind: effect.boon,
      duration: effectNumber(profile, effect, 'duration'),
      stacks: effectNumber(profile, effect, 'stacks'),
      audience: { recipients: allies ? 'party' : 'self' }
    });
  }
}

/** One entity-specific Shared Wisdom boon accompanies the cast's completion. */
function completionSharedWisdom(runtime: RevenantRuntime, cast: RuntimeCast, trigger: string): void {
  if (!hasTrait(runtime, TRAIT.SHARED_WISDOM)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
  // Each boon is keyed by its triggering entity, so removing one never rebinds another entity's grant.
  const shared = requireEffect(profile, 'boon', trigger);
  if (!shared) return;
  boon(runtime, cast, cast.skill, {
    at: cast.effectiveEnd,
    name: `${cast.skill.name} — ${shared.boon}`,
    kind: String(shared.boon),
    duration: effectNumber(profile, shared, 'duration'),
    stacks: effectNumber(profile, shared, 'stacks')
  });
}

function lesserDaggers(runtime: RevenantRuntime, source: Skill, cause?: Gw2ResolverEvent): void {
  if (!revenantConduitFormIsActive(conduit(runtime), 'Assassin', runtime.time)) return;
  const skill = runtime.helpers.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) throw new Error('Missing Lesser Enchanted Daggers skill declaration.');
  const hit = requireEffect(skill, 'strike', 'Lesser Enchanted Daggers');
  if (!hit) return;
  strike(
    runtime,
    null,
    skill,
    {
      at: runtime.time,
      // Form procs inherit player damage bonuses without recursively triggering on-hit attacks.
      actorType: 'effect',
      ownerActorType: 'player',
      name: 'Lesser Enchanted Daggers',
      coefficient: strikeEffectCoefficient(hit),
      skillWeapon: 'Unequipped',
      triggeredBy: source.name,
      icon: skill.icon || ''
    },
    cause
  );
}

function dervishAttack(runtime: RevenantRuntime, cast: RuntimeCast, at: number, elite = false): void {
  const skillId = elite ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE : ID.FORM_OF_THE_DERVISH_ATTACK;
  const attack = runtime.helpers.skillsById.get(skillId);
  if (!attack) throw new Error(`Missing Form of the Dervish attack skill ${skillId}.`);
  const name = elite ? 'Form of the Dervish (Attack - Elite)' : 'Form of the Dervish (Attack)';
  const hit = requireEffect(attack, 'strike', name);
  // A removed scythe strike leaves no attack to emit.
  if (!hit) return;
  strike(runtime, cast, attack, {
    at,
    actorType: 'effect',
    ownerActorType: 'player',
    skillName: 'Form of the Dervish',
    name,
    coefficient: strikeEffectCoefficient(hit),
    skillWeapon: 'Unequipped',
    triggeredBy: cast.skill.name,
    icon: attack.icon || ''
  });
}

/** Beguiling Haze consumes a follow-up charge, or records a main cast that arms follow-ups on completion. */
function beguilingHaze(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const state = conduit(runtime);
  const followUp = Number(state.beguilingHazeCharges || 0) > 0;
  if (followUp) state.beguilingHazeCharges -= 1;
  else hazeMainCasts.add(cast);
  const owner = followUp ? requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp) : cast.skill;
  const hit = requireEffect(owner, 'strike', followUp ? 'Beguiling Haze — Follow-Up' : 'Beguiling Haze');
  // A removed strike emits no hit, while the follow-up charge and Shared Wisdom keep their own behavior.
  const tick = hit ? strikeEffectTicks(hit)[0] : undefined;
  if (tick)
    strike(runtime, cast, cast.skill, {
      at: canonicalTime(cast.start + Math.max(0, Number(tick.atMs || 0)) / 1000),
      coefficient: Number(tick.coefficient),
      name: followUp ? 'Beguiling Haze — Follow-Up' : 'Beguiling Haze',
      skillWeapon: skillWeapon(runtime, cast.skill)
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
    state.beguilingHazeReadyAt = Number(
      runtime.cooldowns.get(skill.id) ?? runtime.ammo.get(skill.id)?.nextRechargeAt ?? runtime.time
    );
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
  const strikeTicks = hit?.type === 'strike' ? (hit.ticks ?? []) : [];
  const tormentTicks = torment?.type === 'condition' ? (torment.ticks ?? []) : [];
  const maximum = Math.min(strikeTicks.length, tormentTicks.length);
  // Self conditions still active at the cast's end are the ones the vortex removes.
  core.selfConditions = core.selfConditions.filter((application) => Number(application.expiresAt || 0) > at);
  const active = Math.max(0, Number(core.selfConditionCount || 0)) + core.selfConditions.length;
  const projectiles = hasLegend(runtime, LEGEND.DEMON) ? maximum : Math.min(maximum, active);
  const removed = Math.min(maximum, active);
  if (removed > 0) {
    // Static configured conditions deplete first, then runtime conditions oldest-first.
    const configured = Math.min(removed, Number(core.selfConditionCount || 0));
    core.selfConditionCount -= configured;
    core.selfConditions.splice(0, removed - configured);
  }

  for (let index = 0; index < projectiles; index += 1) {
    const projectileAt = canonicalTime(cast.start + Number(strikeTicks[index].atMs || 0) / 1000);
    strike(runtime, cast, cast.skill, {
      at: projectileAt,
      coefficient: Number(strikeTicks[index].coefficient || 0),
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
      hitIndex: index + 1,
      totalHits: projectiles,
      skillWeapon: skillWeapon(runtime, cast.skill)
    });
    condition(runtime, cast, cast.skill, {
      at: projectileAt,
      condition: String(tormentTicks[index].condition || 'Torment'),
      stacks: Number(tormentTicks[index].stacks ?? 1),
      duration: Number(tormentTicks[index].duration || 0),
      name: `Hex-Eater Vortex — Projectile ${index + 1}`
    });
  }

  completionSharedWisdom(runtime, cast, 'hex-eater-vortex');
}

/** Gladiator's Defense resolves its strike, conditions, and boons at the cast's end. */
function gladiatorsDefense(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const at = cast.effectiveEnd;
  const skill = cast.skill;
  const hit = skill.effects?.find((effect) => effect.type === 'strike');
  if (hit?.type === 'strike')
    strike(runtime, cast, skill, {
      at,
      coefficient: strikeEffectCoefficient(hit),
      skillWeapon: skillWeapon(runtime, skill)
    });
  for (const effect of skill.effects ?? []) {
    if (effect.type === 'condition')
      for (const tick of conditionEffectTicks(effect))
        condition(runtime, cast, skill, {
          at,
          condition: tick.condition,
          stacks: Number(tick.stacks ?? 1),
          duration: Number(tick.duration || 0)
        });
    else if (effect.type === 'boon' && effect.boon)
      boon(runtime, cast, skill, {
        at,
        name: `${skill.name} — ${effect.boon}`,
        kind: effect.boon,
        duration: Number(effect.duration || 0),
        stacks: Number(effect.stacks ?? 1)
      });
  }

  completionSharedWisdom(runtime, cast, 'gladiators-defense');
}

/** Twin Moon Sweep's two attackers, packets, and equipped-legend resonances belong to its committed impact. */
function twinMoonSweep(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const effects = skill.effects ?? [];
  const mains = effects.filter((effect) => effect.type === 'strike' && !effect.metadata?.legendId);
  const bleeding = effects.find(
    (effect) => effect.type === 'condition' && firstConditionTick(effect, 'Bleeding') && !effect.metadata?.legendId
  );
  const bleedingTicks = bleeding?.type === 'condition' ? conditionEffectTicks(bleeding) : [];
  const might = effects.find((effect) => effect.type === 'boon' && effect.boon === 'might');
  const at = effectAt(cast, bleeding || might || mains[0]);
  const packets = Math.max(0, Number(bleedingTicks.length || (might?.applications ?? mains.length)));
  const coefficient = (effect: SkillEffect | undefined) =>
    effect?.type === 'strike' ? strikeEffectCoefficient(effect) : 0;
  const weapon = skillWeapon(runtime, skill);
  // Only the player hit carries affinityOnHit, so the cast's affinity gain happens once.
  strike(runtime, cast, skill, {
    at,
    coefficient: coefficient(mains[0]),
    name: 'Twin Moon Sweep — Player',
    hitIndex: 1,
    totalHits: mains.length,
    skillWeapon: weapon,
    metadata: { affinityOnHit: true }
  });
  strike(runtime, cast, skill, {
    at,
    coefficient: coefficient(mains[1]),
    name: 'Twin Moon Sweep — Fragment',
    hitIndex: 2,
    totalHits: mains.length,
    skillWeapon: weapon
  });
  for (let index = 0; index < packets; index += 1) {
    const tick = bleedingTicks[index] || bleedingTicks[0];
    condition(runtime, cast, skill, {
      at,
      condition: String(tick?.condition || 'Bleeding'),
      stacks: Number(tick?.stacks ?? 1),
      duration: Number(tick?.duration || 0),
      name: `Twin Moon Sweep — Bleeding ${index + 1}`
    });
    boon(runtime, cast, skill, {
      at,
      name: `Twin Moon Sweep — Might ${index + 1}`,
      kind: String(might?.boon || 'might'),
      duration: Number(might?.duration || 0),
      stacks: Number(might?.stacks ?? 1)
    });
  }

  if (hasLegend(runtime, LEGEND.ASSASSIN)) {
    const immobilized = firstConditionTick(
      effects.find((effect) => effect.type === 'condition' && effect.metadata?.legendId === LEGEND.ASSASSIN),
      'Immobilized'
    );
    condition(runtime, cast, skill, {
      at,
      condition: String(immobilized?.condition || 'Immobilized'),
      stacks: Number(immobilized?.stacks ?? 1),
      duration: Number(immobilized?.duration || 0)
    });
  }

  if (hasLegend(runtime, LEGEND.DEMON)) {
    const shatter = effects.find((effect) => effect.type === 'strike' && effect.metadata?.legendId === LEGEND.DEMON);
    const confusion = effects.find(
      (effect) => effect.type === 'condition' && effect.metadata?.legendId === LEGEND.DEMON
    );
    const shatterTicks = shatter?.type === 'strike' ? strikeEffectTicks(shatter) : [];
    for (const [index, tick] of shatterTicks.entries())
      strike(runtime, cast, skill, {
        at: effectAt(cast, shatter, tick.atMs),
        coefficient: Number(tick.coefficient || 0),
        name: `Twin Moon Sweep — Shatter ${index + 1}`,
        hitIndex: index + 1,
        totalHits: shatterTicks.length,
        skillWeapon: weapon
      });
    for (const [index, tick] of (confusion?.type === 'condition' ? conditionEffectTicks(confusion) : []).entries())
      condition(runtime, cast, skill, {
        at: effectAt(cast, confusion, tick.atMs),
        condition: String(tick.condition || 'Confusion'),
        stacks: Number(tick.stacks ?? 1),
        duration: Number(tick.duration || 0),
        name: `Twin Moon Sweep — Confusion ${index + 1}`
      });
  }

  if (!hasTrait(runtime, TRAIT.SHARED_WISDOM)) return;
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
  const shared = requireEffect(profile, 'boon', 'twin-moon-sweep');
  for (let index = 0; shared && index < Math.max(0, effectNumber(profile, shared, 'applications')); index += 1)
    boon(runtime, cast, skill, {
      at,
      name: `Shared Wisdom — Might ${index + 1}`,
      kind: String(shared.boon),
      duration: effectNumber(profile, shared, 'duration'),
      stacks: effectNumber(profile, shared, 'stacks')
    });
}

/** Release Potential resolves the active legend's variant from current affinity and equipped legends. */
function releasePotential(runtime: RevenantRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const affinity = effectiveAffinity(runtime);
  // At the minimum affinity the release gains every equipped legend's effects.
  const all =
    affinity >=
    Math.max(0, balanceProfileNumber(requireBalanceProfileFromContext(runtime, PROFILE.affinity), 'minimumStacks'));
  const effects = skill.effects ?? [];
  const hit = effects.find((effect) => effect.type === 'strike');
  const conditions = effects.filter((effect) => effect.type === 'condition');
  const boons = effects.filter((effect) => effect.type === 'boon');
  const weapon = skillWeapon(runtime, skill);
  const coefficient = hit?.type === 'strike' ? strikeEffectCoefficient(hit) : 0;
  switch (skill.id) {
    case ID.RELEASE_POTENTIAL_MONK:
      for (const effect of boons)
        if (effect.type === 'boon' && effect.boon)
          boon(runtime, cast, skill, {
            at: cast.effectiveEnd,
            name: `${skill.name} — ${effect.boon}`,
            kind: effect.boon,
            duration: Number(effect.duration || 0),
            stacks: Number(effect.stacks ?? 1)
          });
      break;
    case ID.RELEASE_POTENTIAL_DERVISH: {
      const impact = effectAt(cast, hit);
      // The conjured scythe uses sword strength on either equipped weapon set.
      strike(runtime, cast, skill, {
        at: impact,
        coefficient,
        skillWeapon: weapon,
        weaponStrengthProfileId: 'weapon.sword'
      });
      const tick = firstConditionTick(
        conditions.find((effect) => effect.metadata?.legendId === LEGEND.DEMON),
        'Bleeding'
      );
      if (hasLegend(runtime, LEGEND.DEMON) || all)
        condition(runtime, cast, skill, {
          at: impact,
          condition: String(tick?.condition || 'Bleeding'),
          stacks: Number(tick?.stacks ?? 1),
          duration: Number(tick?.duration || 0)
        });
      if (hasLegend(runtime, LEGEND.CENTAUR) || all)
        for (const effect of boons.filter((candidate) => candidate.metadata?.legendId === LEGEND.CENTAUR))
          if (effect.type === 'boon' && effect.boon)
            boon(runtime, cast, skill, {
              at: impact,
              name: `${skill.name} — ${effect.boon}`,
              kind: effect.boon,
              duration: Number(effect.duration || 0),
              stacks: Number(effect.stacks ?? 1)
            });
      break;
    }

    case ID.RELEASE_POTENTIAL_MESMER: {
      const impact = effectAt(cast, hit);
      strike(runtime, cast, skill, { at: impact, coefficient, skillWeapon: weapon });
      // Enemy and self Torment read affinity at impact, including swaps during the windup.
      runtime.schedule(MESMER_RELEASE, impact, { activationId: cast.id });
      const control = effects.find((effect) => effect.type === 'control');
      runtime.emit({
        type: 'control',
        at: effectAt(cast, control),
        source: 'revenant',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        activationId: cast.id,
        controlKind: String(control?.type === 'control' ? control.controlKind : 'daze')
      });
      break;
    }

    case ID.RELEASE_POTENTIAL_ASSASSIN: {
      const ticks = hit?.type === 'strike' ? strikeEffectTicks(hit) : [];
      for (const [index, tick] of ticks.entries())
        strike(runtime, cast, skill, {
          at: canonicalTime(cast.start + Number(tick.atMs || 0) / 1000),
          coefficient: Number(tick.coefficient || 0),
          hitIndex: index + 1,
          totalHits: ticks.length,
          skillWeapon: weapon,
          // Assassin shockwaves use profession-mechanic strength independently of the equipped weapon.
          weaponStrengthProfileId: 'nonweapon.profession-mechanic'
        });
      // Conditions land with the final hit and share the affinity-scaled duration formula.
      for (const effect of conditions)
        if (effect.type === 'condition')
          for (const tick of conditionEffectTicks(effect))
            condition(runtime, cast, skill, {
              at: effectAt(cast, effect, tick.atMs),
              condition: tick.condition,
              stacks: Number(tick.stacks ?? 1),
              duration: Number(tick.duration || 0) * (1 + affinity * Number(effect.durationPerAffinity || 0))
            });
      break;
    }

    case ID.RELEASE_POTENTIAL_WARRIOR:
      strike(runtime, cast, skill, { at: cast.effectiveEnd, coefficient, skillWeapon: weapon });
      break;
    default:
      break;
  }
}

/** Mesmer release Torment scales with impact-time affinity; one simulated enemy applies self-Torment once. */
function mesmerRelease(runtime: RevenantRuntime, data: unknown): void {
  const skill = runtime.helpers.skillsById.get(ID.RELEASE_POTENTIAL_MESMER);
  if (!skill) return;
  const { activationId } = data as { activationId: string };
  const affinity = effectiveAffinity(runtime);
  const conditions = skill.effects?.filter((effect) => effect.type === 'condition') ?? [];
  const torment = conditions.find((effect) => effect.target !== 'self');
  const self = conditions.find((effect) => effect.target === 'self');
  const tormentTick = firstConditionTick(torment, 'Torment');
  const selfTick = firstConditionTick(self, 'Torment');
  runtime.emit(
    buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      activationId,
      condition: String(tormentTick?.condition || 'Torment'),
      stacks: Number(tormentTick?.stacks ?? 1),
      duration: Number(tormentTick?.duration || 0) * (1 + affinity * Number(torment?.durationPerAffinity || 0))
    })
  );
  const selfDuration =
    Number(selfTick?.duration || 0) * Math.max(0, 1 - affinity * Number(self?.durationReductionPerAffinity || 0));
  runtime.profession.core.selfConditions.push({
    condition: String(selfTick?.condition || 'Torment'),
    stacks: Number(selfTick?.stacks ?? 1),
    at: runtime.time,
    expiresAt: runtime.time + selfDuration,
    sourceId: skill.id,
    skillName: skill.name
  });
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
    // The activation strike and Burning are independent packets; either survives the other's removal.
    const hit = requireEffect(profile, 'strike', 'Mistfire');
    const burning = requireEffect(profile, 'condition', 'Burning');
    const mistfire = { id: TRAIT.MISTFIRE, name: 'Mistfire' } as Skill;
    if (hit)
      strike(runtime, cast, mistfire, {
        at: runtime.time,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Mistfire',
        coefficient: strikeEffectCoefficient(hit),
        skillWeapon: 'Unequipped'
      });
    if (burning)
      condition(runtime, cast, mistfire, {
        at: runtime.time,
        actorType: 'effect',
        ownerActorType: 'player',
        name: 'Mistfire — Burning',
        condition: String(burning.condition),
        stacks: effectNumber(profile, burning, 'stacks'),
        duration: effectNumber(profile, burning, 'duration')
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
  const combat = revenantLiveCombatActive(runtime);
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
  const cost = liveRevenantEnergyCost(runtime, skill);
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

/** Mistfire burns on each accepted control outside Twin Moon's own chain, once per its cooldown. */
function mistfire(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if ((event.skillId != null && TWIN_MOON_SKILL_IDS.has(event.skillId)) || !hasTrait(runtime, TRAIT.MISTFIRE)) return;
  const state = conduit(runtime);
  const profile = requireBalanceProfileFromContext(runtime, PROFILE.mistfire);
  const burning = requireEffect(profile, 'condition', 'Burning');
  // The cooldown gates only Burning, so a removed packet leaves it ready.
  if (!burning || !isInternalCooldownReady(runtime.time, Number(state.mistfireReadyAt || 0))) return;
  state.mistfireReadyAt = runtime.time + Math.max(0, balanceProfileNumber(profile, 'cooldown'));
  runtime.emitDerived(
    event,
    buildResolverCondition({
      at: runtime.time,
      source: 'revenant',
      sourceId: TRAIT.MISTFIRE,
      actorType: 'effect',
      ownerActorType: 'player',
      skillId: TRAIT.MISTFIRE,
      skillName: 'Mistfire',
      name: 'Mistfire — Burning',
      condition: String(burning.condition),
      stacks: effectNumber(profile, burning, 'stacks'),
      duration: effectNumber(profile, burning, 'duration')
    })
  );
}

/** Conduit owns affinity, forms, Entity skills, Release Potential, and Beguiling Haze on the shared live state. */
export const conduitLiveMechanics: Partial<RuntimeProfession<RevenantRuntimeState>> = {
  availability(runtime, skill) {
    const state = conduit(runtime);
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      // Both skill identities share the main recharge; project its progress after any Alacrity changes.
      if (state.beguilingHazeRecharge)
        state.beguilingHazeReadyAt = gw2CooldownReadyAt(
          runtime.cooldownController.project(skill, state.beguilingHazeRecharge)
        );
      if (Number(state.beguilingHazeCharges || 0) <= 0 && runtime.time < Number(state.beguilingHazeReadyAt || 0))
        return denySkillCast(
          skill,
          'revenant.beguiling-haze-cooldown',
          'Beguiling Haze is recharging.',
          Number(state.beguilingHazeReadyAt)
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
        Number(conduit(runtime).beguilingHazeCharges || 0) > 0,
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeFollowUp),
        requireBalanceProfileFromContext(runtime, PROFILE.beguilingHazeMainCastExtension)
      ) * 1000
    );
  },
  rechargeWork(runtime, skill, work) {
    if (skill.id === ID.SWAP_LEGENDS) {
      // Precombat legend swaps stay free; Enhanced Embodiment scales the base in combat.
      if (work === 0 || !revenantLiveCombatActive(runtime) || !hasTrait(runtime, TRAIT.ENHANCED_EMBODIMENT))
        return work;
      return (
        Math.max(0, Number(skill.cooldown ?? work)) *
        Math.max(
          0,
          balanceProfileNumber(
            requireBalanceProfileFromContext(runtime, PROFILE.enhancedEmbodiment),
            'rechargeMultiplier'
          )
        )
      );
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
    return RELEASE_POTENTIAL_IDS.has(skill.id) && hasTrait(runtime, TRAIT.KINETIC_INSIGHT) ? work * 0.8 : work;
  },
  modifyEffects: (_runtime, cast, effects) => (CUSTOM_EFFECT_SKILL_IDS.has(cast.skill.id) ? [] : effects),
  onCastStart(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    costAffinity(runtime, cast);
    if (skill.legendId === LEGEND.ENTITY && revenantConduitFormIsActive(conduit(runtime), 'Dervish', cast.start))
      dervishCasts.add(cast);
    // Gladiator's Defense triggers its scythe with the instant stunbreak.
    if (skill.id === ID.GLADIATORS_DEFENSE && dervishCasts.has(cast)) dervishAttack(runtime, cast, cast.start);
    if (skill.id === ID.GLADIATORS_DEFENSE) gladiatorsDefense(runtime, cast);
    else if (skill.id === ID.HEX_EATER_VORTEX) hexEaterVortex(runtime, cast);
    if (!revenantCastCommitted(cast)) return;
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) beguilingHaze(runtime, cast);
    else if (TWIN_MOON_SKILL_IDS.has(skill.id)) twinMoonSweep(runtime, cast);
    else if (RELEASE_POTENTIAL_IDS.has(skill.id)) releasePotential(runtime, cast);
  },
  onCastComplete(runtime, cast) {
    const skill = cast.skill as RevenantSkill;
    const committed = revenantCastCommitted(cast);
    if (BEGUILING_HAZE_SKILL_IDS.has(skill.id)) {
      if (committed) completeBeguilingHaze(runtime, cast);
      else hazeMainCasts.delete(cast);
    }

    // Cosmic Wisdom form procs follow the cast; Gladiator's Defense already struck at its stunbreak.
    if (skill.legendId === LEGEND.ASSASSIN) lesserDaggers(runtime, skill);
    if (dervishCasts.has(cast) && skill.id !== ID.GLADIATORS_DEFENSE) {
      dervishAttack(runtime, cast, runtime.time);
      if (TWIN_MOON_SKILL_IDS.has(skill.id)) dervishAttack(runtime, cast, runtime.time, true);
    }

    dervishCasts.delete(cast);
    // Shared Wisdom Swiftness belongs only to Entity legend skills.
    if (skill.legendId === LEGEND.ENTITY && hasTrait(runtime, TRAIT.SHARED_WISDOM)) {
      const profile = requireBalanceProfileFromContext(runtime, PROFILE.sharedWisdom);
      const shared = requireEffect(profile, 'boon', 'entity-skill');
      if (shared)
        boon(runtime, cast, skill, {
          at: runtime.time,
          name: `${skill.name} — ${shared.boon}`,
          kind: String(shared.boon),
          duration: effectNumber(profile, shared, 'duration'),
          stacks: effectNumber(profile, shared, 'stacks')
        });
    }

    if (!committed) return;
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
    },
    'control.resolved': mistfire
  },
  tasks: {
    [FORM_EXPIRY]: formExpiry,
    [UPKEEP_AFFINITY]: upkeepAffinity,
    [UPKEEP_DAGGERS]: upkeepDaggers,
    [MESMER_RELEASE]: mesmerRelease
  }
};
