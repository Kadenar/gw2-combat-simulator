import { conduitState } from "./state.js";
import { professionCoreState } from "../../../../platform/engine/profession.js";
/**
 * Conduit and Legendary Entity runtime mechanics.
 *
 * Owns affinity gain, Entity skill packets, legend resonances, Numinous Gift,
 * Shared Wisdom additions, Release Potential variants, and Cosmic Wisdom
 * state. It also handles delayed affinity-hit tasks and exports the feature's
 * raw skill callbacks for composition by handlers.js.
 */
import { emitRevenantState } from "../../core/shared.js";
import { emitRevenantBoon } from "../../core/boons.js";
import { REVENANT_RELEASE_POTENTIAL_BY_LEGEND } from "../../legend-rules.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as ID,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import {
  hasRevenantTrait,
  revenantConduitFormIsActive,
} from "../../core/state.js";
import { CONDUIT_MECHANICS as MECHANICS } from "./mechanics.js";
import type {
  SchedulerRecord,
  SimulationActorType,
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  ConduitState,
  RevenantCastContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSkill,
} from "../../types.js";

// Union type allows the same helper functions to be called from both cast contexts (which have start/effectiveEnd)
// and raw scheduler contexts (which do not), without requiring separate overloads.
type RevenantMechanicContext = RevenantSchedulerContext & {
  readonly start?: number;
  readonly effectiveEnd?: number;
  readonly skill?: RevenantSkill;
};

interface ConduitDamageOptions {
  readonly at?: number;
  readonly coefficient: number;
  readonly name?: string;
  readonly actorType?: SimulationActorType;
  readonly hitIndex?: number;
  readonly totalHits?: number;
  readonly affinityOnHit?: boolean;
}

interface ConduitConditionOptions {
  readonly at?: number;
  readonly condition: string;
  readonly stacks?: number;
  readonly duration: number;
  readonly name?: string;
}

interface ConduitAffinityTaskPayload extends SchedulerRecord {
  readonly amount: number;
}

interface ReleasePotentialProfile extends SchedulerRecord {
  readonly impactDelay?: number;
  readonly hitDelays?: readonly number[];
  readonly resistanceDuration: number;
  readonly regenerationDuration: number;
  readonly coefficient: number;
  readonly demonBleedStacks: number;
  readonly demonBleedDuration: number;
  readonly centaurMightDuration: number;
  readonly centaurMightStacks: number;
  readonly centaurFuryDuration: number;
  readonly tormentStacks: number;
  readonly tormentBaseDuration: number;
  readonly tormentDurationPerAffinity: number;
  readonly selfTormentBaseDuration: number;
  readonly selfDurationReductionPerAffinity: number;
  readonly dazeDuration: number;
  readonly hits: number;
  readonly coefficientPerHit: number;
  readonly conditionBaseDuration: number;
  readonly conditionDurationPerAffinity: number;
}

function hasLegend(
  context: RevenantSchedulerContext,
  legendId: string,
): boolean {
  return professionCoreState(context).selectedLegendIds.includes(legendId);
}

function hasTrait(
  context: RevenantSchedulerContext,
  traitId: SkillId,
): boolean {
  return hasRevenantTrait(context.config, traitId);
}

function effectiveAffinity(context: RevenantSchedulerContext): number {
  // Kinetic Insight contributes a virtual +2 to affinity for scaling calculations without mutating actual state.
  const bonus = hasTrait(context, TRAIT.KINETIC_INSIGHT) ? 2 : 0;
  return Math.min(
    MECHANICS.conduit.affinityMaximum,
    Number(conduitState.from(context).affinity || 0) + bonus,
  );
}

function targetsHit(context: RevenantCastContext, maximum = 5): number {
  // Command-level override takes priority so per-skill target counts can differ from the global config value.
  return Math.max(
    1,
    Math.min(
      maximum,
      Math.trunc(
        Number(
          (context.command as unknown as SchedulerRecord).targetsHit ??
            context.config.targetsHit ??
            context.config.targetCount ??
            1,
        ),
      ),
    ),
  );
}

function activeWeapon(context: RevenantSchedulerContext): string | undefined {
  // activeWeaponSet is 1-indexed; value 2 means the swap weapon set is currently active.
  return Number(context.state.activeWeaponSet) === 2
    ? context.config.weaponSet2Primary
    : context.config.primaryWeapon;
}

function emitDamage(
  context: RevenantCastContext,
  skill: RevenantSkill,
  options: ConduitDamageOptions,
): void {
  const {
    at = context.effectiveEnd,
    coefficient,
    name = skill.name,
    actorType = "player",
    hitIndex = 1,
    totalHits = 1,
    affinityOnHit = false,
  } = options;
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType,
    skillId: skill.id,
    skillName: skill.name,
    name,
    coefficient,
    hits: 1,
    hitIndex,
    totalHits,
    ...(affinityOnHit ? { affinityOnHit: true } : {}),
    // Utility, elite, and triggered attacks use GW2's standard level-based
    // strength. Profession mechanic attacks use the active weapon.
    skillWeapon:
      skill.weapon ||
      (skill.type === "Profession" ? activeWeapon(context) : "Unequipped"),
  });
}

export function emitDervishFormAttack(
  context: RevenantCastContext,
  skill: RevenantSkill,
  { elite = false }: { readonly elite?: boolean } = {},
): void {
  const state = conduitState.from(context);
  // Guard against non-Conduit builds calling this helper; specialization check is cheaper than checking the form alone.
  if (
    context.config.specialization !== "Conduit" ||
    state.conduitForm !== "Dervish" ||
    // Use context.start (cast begin) rather than effectiveEnd so the form check reflects the moment of triggering.
    Number(state.cosmicWisdomUntil || 0) <= context.start
  )
    return;
  const skillId = elite
    ? ID.FORM_OF_THE_DERVISH_ATTACK_ELITE
    : ID.FORM_OF_THE_DERVISH_ATTACK;
  const icon = context.catalog.skillsById.get(skillId)?.icon || "";
  context.emit({
    type: "damage",
    at: context.effectiveEnd,
    source: "revenant",
    sourceId: skillId,
    actorType: "player",
    skillId,
    skillName: "Form of the Dervish",
    icon,
    name: elite
      ? "Form of the Dervish (Attack - Elite)"
      : "Form of the Dervish (Attack)",
    coefficient: MECHANICS.conduit.formOfTheDervishCoefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    triggeredBy: skill.name,
  });
}

/** Emits Form of the Assassin's one-second/legend-skill dagger strike. */
export function emitLesserEnchantedDaggers(
  context: RevenantSchedulerContext,
  sourceSkill: RevenantSkill,
  at: number,
): void {
  if (!revenantConduitFormIsActive(conduitState.from(context), "Assassin", at))
    return;
  const skill = context.catalog.skillsById.get(ID.LESSER_ENCHANTED_DAGGERS);
  if (!skill) return;
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    icon: skill.icon || "",
    name: "Lesser Enchanted Daggers",
    coefficient:
      MECHANICS.conduit.formOfTheAssassin.lesserEnchantedDaggersCoefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    triggeredBy: sourceSkill.name,
  });
}

/** Applies the active Assassin or Dervish form after a legend skill cast. */
export function applyCosmicWisdomAfterCast(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const at = context.effectiveEnd;
  // Assassin form procs on any Assassin legend skill; Dervish form procs only on Entity legend skills.
  if (
    skill.legendId === LEGEND.ASSASSIN &&
    revenantConduitFormIsActive(conduitState.from(context), "Assassin", at)
  ) {
    emitLesserEnchantedDaggers(context, skill, at);
  }
  if (
    skill.legendId !== LEGEND.ENTITY ||
    !revenantConduitFormIsActive(conduitState.from(context), "Dervish", at)
  )
    return;
  emitDervishFormAttack(context, skill);
  // Twin Moon Sweep is the only Entity skill that also triggers the elite Dervish attack.
  if (
    (
      [ID.TWIN_MOON_SWEEP, ID.TWIN_MOON_SWEEP_ID_77001] as readonly number[]
    ).includes(Number(skill.id))
  ) {
    emitDervishFormAttack(context, skill, { elite: true });
  }
}

function emitCondition(
  context: RevenantCastContext,
  skill: RevenantSkill,
  options: ConduitConditionOptions,
): void {
  const {
    at = context.effectiveEnd,
    condition,
    stacks = 1,
    duration,
    name = `${skill.name} — ${condition}`,
  } = options;
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    name,
    condition,
    stacks,
    duration,
  });
}

function emitControl(
  context: RevenantCastContext,
  skill: RevenantSkill,
  controlKind: string,
  duration: number,
  at = context.effectiveEnd,
): void {
  context.emit({
    type: "control",
    at,
    source: "revenant",
    sourceId: skill.id,
    actorType: "player",
    skillId: skill.id,
    skillName: skill.name,
    controlKind,
    duration,
  });
}

/** Adds capped Conduit affinity and snapshots the resource change. */
export function gainConduitAffinity(
  context: RevenantMechanicContext,
  amount: number,
  reason: string,
): number {
  if (context.config.specialization !== "Conduit") return 0;
  const state = conduitState.from(context);
  const coreState = professionCoreState(context);
  const previous = Number(state.affinity || 0);
  state.affinity = Math.min(
    MECHANICS.conduit.affinityMaximum,
    previous + Math.max(0, Number(amount || 0)),
  );
  if (
    // Only fire the Expanded Consciousness pulse on the transition to maximum, not on every gain while already at max.
    previous < MECHANICS.conduit.affinityMaximum &&
    state.affinity === MECHANICS.conduit.affinityMaximum &&
    hasTrait(context, TRAIT.EXPANDED_CONSCIOUSNESS)
  ) {
    coreState.energy = Math.min(
      coreState.maximumEnergy,
      coreState.energy + MECHANICS.conduit.expandedConsciousnessEnergy,
    );
  }
  if (state.affinity !== previous) {
    // Use cast-start time when available so the state event aligns with the skill timeline rather than the clock.
    emitRevenantState(context, context.start ?? context.state.time, reason);
  }
  return state.affinity - previous;
}

/** Refreshes Conduit-owned Energy overrides for the active cosmic form. */
export function syncConduitEnergyCostOverrides(state: ConduitState): void {
  if (state.conduitForm !== "Mesmer") {
    state.energyCostOverrides = {};
    return;
  }
  const profile = MECHANICS.conduit.formOfTheMesmer;
  state.energyCostOverrides = {
    [ID.BANISH_ENCHANTMENT]: profile.banishEnchantmentEnergyCost,
    [ID.BANISH_ENCHANTMENT_ID_78587]: profile.banishEnchantmentEnergyCost,
    [ID.CALL_TO_ANGUISH]: profile.callToAnguishEnergyCost,
    [ID.UNYIELDING_IMPACT]: profile.unyieldingImpactEnergyCost,
    [ID.EMBRACE_THE_DARKNESS]: profile.embraceTheDarknessEnergyCost,
  };
}

/** Resolves a delayed affinity gain scheduled for a qualifying hit. */
export function handleConduitAffinityHit(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<ConduitAffinityTaskPayload>,
): void {
  if (!task.payload) return;
  gainConduitAffinity(context, task.payload.amount, "enigmatic-connection-hit");
}

/** Emits Numinous Gift's base and equipped-legend boon profile. */
export function emitNuminousGift(
  context: RevenantMechanicContext,
  skill: RevenantSkill,
  options: { readonly allies?: boolean } = {},
): void {
  if (context.config.specialization !== "Conduit") return;
  const profile = MECHANICS.conduit.numinousGift;
  const recipients = options.allies ? "allies" : "self";
  emitRevenantBoon(
    context,
    skill,
    "might",
    profile.mightDuration,
    profile.mightStacks,
    { recipients },
  );
  for (const legendId of professionCoreState(context).selectedLegendIds) {
    const boons = profile.boons as unknown as Readonly<
      Record<string, readonly [string, number]>
    >;
    const boon = boons[legendId];
    if (boon) {
      emitRevenantBoon(context, skill, boon[0], boon[1], 1, { recipients });
    }
  }
}

/** Emits Beguiling Haze or consumes one of its follow-up charges. */
export function castBeguilingHaze(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.conduit.beguilingHaze;
  const state = conduitState.from(context);
  // Charges > 0 means this is a follow-up cast; the main cast and follow-ups share the same handler id.
  const followUp = Number(state.beguilingHazeCharges || 0) > 0;
  const at =
    context.start +
    (followUp ? profile.followUpImpactDelay : profile.mainImpactDelay);
  if (followUp) {
    state.beguilingHazeCharges -= 1;
    emitDamage(context, skill, {
      at,
      coefficient: profile.followUpCoefficient,
      name: "Beguiling Haze — Follow-Up",
    });
  } else {
    // Register this cast's reservationId so completeBeguilingHaze can arm follow-up charges for exactly this cast.
    state.beguilingHazeMainReservations.push(context.reservationId);
    emitDamage(context, skill, {
      at,
      coefficient: profile.mainCoefficient,
      name: "Beguiling Haze",
    });
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(context, skill, "fury", profile.sharedWisdomFury);
  }
  emitRevenantState(context, context.effectiveEnd, "beguiling-haze");
}

/** Arms Beguiling Haze follow-up charges after the primary cast completes. */
export function completeBeguilingHaze(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  if (skill.handlerId !== "revenant.beguiling-haze") return;
  const state = conduitState.from(context);
  // Only the cast whose reservationId was registered in castBeguilingHaze qualifies as the main cast.
  const index = state.beguilingHazeMainReservations.indexOf(
    context.reservationId,
  );
  const mainCast = index >= 0;
  if (mainCast) {
    state.beguilingHazeMainReservations.splice(index, 1);
    state.beguilingHazeCharges =
      MECHANICS.conduit.beguilingHaze.followUpCharges;
    // The cooldown starts from effectiveEnd; alacrity shortens it from 10 s to 8 s.
    state.beguilingHazeReadyAt =
      context.effectiveEnd +
      (context.hasBuff?.("alacrity", context.effectiveEnd) ? 8 : 10);
  }
  // Mirror ConduitState into the platform ammo/cooldown system so the UI and scheduler agree.
  const ammo = context.state.ammo.get(skill.id);
  if (ammo) {
    if (state.beguilingHazeCharges > 0) {
      // While follow-up charges are available, present them as an ammo-style skill with no cooldown timer.
      ammo.maximum = MECHANICS.conduit.beguilingHaze.followUpCharges;
      ammo.charges = state.beguilingHazeCharges;
      ammo.nextRechargeAt = null;
      context.state.cooldowns.delete(skill.id);
    } else {
      // Follow-up charges are temporary. Only the main cast rearms when its
      // original cooldown finishes.
      ammo.maximum = 1;
      ammo.charges = 0;
      ammo.rechargeDuration = Math.max(
        0,
        state.beguilingHazeReadyAt - context.effectiveEnd,
      );
      ammo.nextRechargeAt = state.beguilingHazeReadyAt;
      context.state.cooldowns.set(skill.id, state.beguilingHazeReadyAt);
    }
  }
  emitRevenantState(context, context.effectiveEnd, "beguiling-haze-follow-up");
}

function activeSelfConditions(
  context: RevenantCastContext,
  at: number,
): number {
  const state = professionCoreState(context);
  // Prune expired dynamic entries before counting; the count represents conditions currently afflicting the player.
  state.selfConditions = state.selfConditions.filter(
    (application) => Number(application.expiresAt || 0) > at,
  );
  // selfConditionCount is a static config value representing pre-existing/simulated conditions (e.g. from Mesmer RP).
  const configured = Math.max(0, Number(state.selfConditionCount || 0));
  return configured + state.selfConditions.length;
}

/** Resolves projectile-count-scaled Hex Eater Vortex effects. */
export function castHexEaterVortex(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.conduit.hexEaterVortex;
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  // Demon legend fires all 6 projectiles regardless of self-condition count; others are limited by active conditions.
  const projectileCount = hasLegend(context, LEGEND.DEMON)
    ? profile.maximumProjectiles
    : Math.min(profile.maximumProjectiles, activeSelfConditions(context, at));
  // Conditions removed is capped at the actual active count even when Demon fires the full projectile salvo.
  const conditionsRemoved = Math.min(
    profile.maximumProjectiles,
    activeSelfConditions(context, at),
  );
  if (conditionsRemoved > 0) {
    // Deplete static (configured) conditions first, then peel dynamic (runtime) ones oldest-first.
    const configuredRemoved = Math.min(
      conditionsRemoved,
      Number(state.selfConditionCount || 0),
    );
    state.selfConditionCount -= configuredRemoved;
    state.selfConditions.splice(0, conditionsRemoved - configuredRemoved);
  }
  for (let index = 0; index < projectileCount; index += 1) {
    const projectileAt = context.start + profile.projectileDelays[index];
    emitDamage(context, skill, {
      at: projectileAt,
      coefficient: profile.projectileCoefficient,
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
      hitIndex: index + 1,
      totalHits: projectileCount,
    });
    emitCondition(context, skill, {
      at: projectileAt,
      condition: "Torment",
      stacks: profile.tormentStacks,
      duration: profile.tormentDuration,
      name: `Hex-Eater Vortex — Projectile ${index + 1}`,
    });
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(
      context,
      skill,
      "resolution",
      profile.sharedWisdomResolution,
    );
  }
  emitRevenantState(context, at, "hex-eater-vortex");
}

/** Resolves Gladiator's Defense and its legend/trait-dependent boons. */
export function castGladiatorsDefense(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.conduit.gladiatorsDefense;
  emitDamage(context, skill, { coefficient: profile.coefficient });
  emitCondition(context, skill, {
    condition: "Weakness",
    stacks: 1,
    duration: profile.weaknessDuration,
  });
  emitRevenantBoon(context, skill, "resolution", profile.resolutionDuration);
  emitRevenantBoon(context, skill, "resistance", profile.resistanceDuration);
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    emitRevenantBoon(
      context,
      skill,
      "stability",
      profile.sharedWisdomStability,
    );
  }
}

/** Emits both Twin Moon attackers and every equipped-legend resonance. */
export function castTwinMoonSweep(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const profile = MECHANICS.conduit.twinMoonSweep;
  const at = context.start + profile.impactDelay;
  // Only the player hit carries affinityOnHit so the single affinity gain fires once per cast, not twice.
  emitDamage(context, skill, {
    at,
    coefficient: profile.playerCoefficient,
    name: "Twin Moon Sweep — Player",
    hitIndex: 1,
    totalHits: profile.packets,
    affinityOnHit: true,
  });
  emitDamage(context, skill, {
    at,
    coefficient: profile.fragmentCoefficient,
    name: "Twin Moon Sweep — Fragment",
    actorType: "player",
    hitIndex: 2,
    totalHits: profile.packets,
  });
  for (let index = 0; index < profile.packets; index += 1) {
    emitCondition(context, skill, {
      at,
      condition: "Bleeding",
      stacks: profile.bleedStacks,
      duration: profile.bleedDuration,
      name: `Twin Moon Sweep — Bleeding ${index + 1}`,
    });
    emitRevenantBoon(
      context,
      skill,
      "might",
      profile.mightDuration,
      profile.mightStacks,
      {
        at,
        name: `Twin Moon Sweep — Might ${index + 1}`,
      },
    );
  }
  if (hasLegend(context, LEGEND.ASSASSIN)) {
    emitCondition(context, skill, {
      at,
      condition: "Immobilized",
      stacks: 1,
      duration: profile.assassinImmobilize,
    });
  }
  if (hasLegend(context, LEGEND.DEMON)) {
    const shatterAt = context.start + profile.demonShatterDelay;
    for (let index = 0; index < profile.packets; index += 1) {
      emitDamage(context, skill, {
        at: shatterAt,
        coefficient: profile.demonShatterCoefficient,
        name: `Twin Moon Sweep — Shatter ${index + 1}`,
        hitIndex: index + 1,
        totalHits: profile.packets,
      });
      emitCondition(context, skill, {
        at: shatterAt,
        condition: "Confusion",
        stacks: profile.demonConfusionStacks,
        duration: profile.demonConfusionDuration,
        name: `Twin Moon Sweep — Confusion ${index + 1}`,
      });
    }
  }
  if (hasTrait(context, TRAIT.SHARED_WISDOM)) {
    for (let index = 0; index < profile.packets; index += 1) {
      emitRevenantBoon(
        context,
        skill,
        "might",
        profile.sharedWisdomMightDuration,
        profile.sharedWisdomMightStacks,
        {
          at,
          name: `Shared Wisdom — Might ${index + 1}`,
        },
      );
    }
  }
}

/** Resolves the active Release Potential variant from affinity and legends. */
export function castReleasePotential(
  context: RevenantCastContext,
  skill: RevenantSkill,
): void {
  const affinity = effectiveAffinity(context);
  // At affinity ≥ 3 the skill gains effects from all equipped legends even if they are not currently active.
  const allLegendEffects =
    affinity >= MECHANICS.conduit.allReleaseEffectsAffinity;
  const releaseProfiles = MECHANICS.conduit
    .releasePotential as unknown as Readonly<
    Record<SkillId, ReleasePotentialProfile>
  >;
  const profile = releaseProfiles[skill.id];
  if (!profile) return;
  switch (skill.id) {
    case ID.RELEASE_POTENTIAL_MONK:
      emitRevenantBoon(
        context,
        skill,
        "resistance",
        profile.resistanceDuration,
      );
      emitRevenantBoon(
        context,
        skill,
        "regeneration",
        profile.regenerationDuration,
      );
      break;
    case ID.RELEASE_POTENTIAL_DERVISH: {
      const impactAt = context.start + Number(profile.impactDelay || 0);
      emitDamage(context, skill, {
        at: impactAt,
        coefficient: profile.coefficient,
      });
      if (hasLegend(context, LEGEND.DEMON) || allLegendEffects) {
        emitCondition(context, skill, {
          at: impactAt,
          condition: "Bleeding",
          stacks: profile.demonBleedStacks,
          duration: profile.demonBleedDuration,
        });
      }
      if (hasLegend(context, LEGEND.CENTAUR) || allLegendEffects) {
        emitRevenantBoon(
          context,
          skill,
          "might",
          profile.centaurMightDuration,
          profile.centaurMightStacks,
          { at: impactAt },
        );
        emitRevenantBoon(
          context,
          skill,
          "fury",
          profile.centaurFuryDuration,
          1,
          { at: impactAt },
        );
      }
      break;
    }
    case ID.RELEASE_POTENTIAL_MESMER: {
      const impactAt = context.start + Number(profile.impactDelay || 0);
      emitDamage(context, skill, {
        at: impactAt,
        coefficient: profile.coefficient,
      });
      emitCondition(context, skill, {
        at: impactAt,
        condition: "Torment",
        stacks: profile.tormentStacks,
        duration:
          profile.tormentBaseDuration *
          (1 + affinity * profile.tormentDurationPerAffinity),
      });
      // Self-torment duration decreases with higher affinity (more skill = less self-harm); clamped to 0 at max.
      const selfDuration =
        profile.selfTormentBaseDuration *
        Math.max(0, 1 - affinity * profile.selfDurationReductionPerAffinity);
      // One self-condition entry per target hit; Hex Eater Vortex then consumes entries to scale its projectiles.
      const count = targetsHit(context);
      for (let index = 0; index < count; index += 1) {
        professionCoreState(context).selfConditions.push({
          condition: "Torment",
          stacks: 1,
          at: impactAt,
          expiresAt: impactAt + selfDuration,
          sourceId: skill.id,
          skillName: skill.name,
        });
      }
      emitControl(context, skill, "daze", profile.dazeDuration, impactAt);
      break;
    }
    case ID.RELEASE_POTENTIAL_ASSASSIN:
      for (let index = 0; index < profile.hits; index += 1) {
        emitDamage(context, skill, {
          at:
            context.start +
            Number(
              // Use hard-coded hit delays when available; fall back to evenly spaced hits across the cast window.
              profile.hitDelays?.[index] ??
                ((context.effectiveEnd - context.start) * (index + 1)) /
                  profile.hits,
            ),
          coefficient: profile.coefficientPerHit,
          hitIndex: index + 1,
          totalHits: profile.hits,
        });
      }
      // Conditions land with the final hit; both share the same affinity-scaled duration formula.
      emitCondition(context, skill, {
        at: context.start + Number(profile.hitDelays?.at(-1) || 0),
        condition: "Crippled",
        stacks: 1,
        duration:
          profile.conditionBaseDuration *
          (1 + affinity * profile.conditionDurationPerAffinity),
      });
      emitCondition(context, skill, {
        at: context.start + Number(profile.hitDelays?.at(-1) || 0),
        condition: "Immobilized",
        stacks: 1,
        duration:
          profile.conditionBaseDuration *
          (1 + affinity * profile.conditionDurationPerAffinity),
      });
      break;
    case ID.RELEASE_POTENTIAL_WARRIOR:
      emitDamage(context, skill, { coefficient: profile.coefficient });
      break;
    default:
      break;
  }
}

/** Starts Cosmic Wisdom and selects the current legend-derived form. */
export function activateCosmicWisdom(context: RevenantCastContext): void {
  const state = conduitState.from(context);
  const at = context.effectiveEnd;
  // Mistfire resolves as part of the activation, before Cosmic Wisdom's
  // doubled Bolstered Bonds attributes become active.
  // It is emitted directly here rather than via observeConduitTraits because Cosmic Wisdom has no control event.
  if (hasTrait(context, TRAIT.MISTFIRE)) {
    const profile = MECHANICS.traitProcs.mistfire;
    context.emit({
      type: "damage",
      at,
      source: "revenant",
      sourceId: TRAIT.MISTFIRE,
      actorType: "effect",
      skillId: TRAIT.MISTFIRE,
      skillName: "Mistfire",
      name: "Mistfire",
      coefficient: profile.coefficient,
      hits: 1,
      hitIndex: 1,
      totalHits: 1,
      skillWeapon: "Unequipped",
    });
    context.emit({
      type: "condition",
      at,
      source: "revenant",
      sourceId: TRAIT.MISTFIRE,
      actorType: "effect",
      skillId: TRAIT.MISTFIRE,
      skillName: "Mistfire",
      name: "Mistfire — Burning",
      condition: "Burning",
      stacks: profile.burningStacks,
      duration: profile.burningDuration,
    });
  }
  state.cosmicWisdomUntil = at + MECHANICS.conduit.cosmicWisdomDuration;
  // Derive form name from active legend; strip "Release Potential: " prefix to get "Mesmer", "Assassin", etc.
  state.conduitForm =
    REVENANT_RELEASE_POTENTIAL_BY_LEGEND[
      professionCoreState(context).activeLegendId
    ]?.replace("Release Potential: ", "") || "";
  // Energy overrides must be applied immediately so the very next skill cast sees the correct cost.
  syncConduitEnergyCostOverrides(state);
  emitRevenantState(context, at, "cosmic-wisdom");
  // Numinous Gift fires on activation for the activating player (not allies); Found Purpose broadcasts to allies on swap.
  emitNuminousGift(context, context.skill);
}

/** Raw Conduit callbacks consumed by the Conduit handler registry. */
export const revenantConduitSkillHandlers = Object.freeze({
  "revenant.beguiling-haze": castBeguilingHaze,
  "revenant.gladiators-defense": castGladiatorsDefense,
  "revenant.hex-eater-vortex": castHexEaterVortex,
  "revenant.twin-moon-sweep": castTwinMoonSweep,
  "revenant.release-potential": castReleasePotential,
  "revenant.cosmic-wisdom": activateCosmicWisdom,
});
