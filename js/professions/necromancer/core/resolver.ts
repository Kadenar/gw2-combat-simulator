import { professionCoreState } from "../../../platform/engine/profession.js";
import { enqueueOrdered } from "../../../platform/engine/event-queue.js";
import { isInternalCooldownReady } from "../../../platform/engine/clock.js";
import {
  NECROMANCER_SKILL_IDS as ID,
  NECROMANCER_TRAIT_IDS as TRAIT,
} from "../data/ids.js";
import {
  handleNecromancerChillEvent,
  handleNecromancerStateEvent,
  handleNecromancerSummonAttack,
} from "./events.js";
import { NECROMANCER_CORE_MECHANICS as MECHANICS } from "./mechanics.js";
import { addCarapace } from "./shared.js";
import { hasTrait } from "../../../platform/gw2/trait-state.js";
import { onResolvedPlayerCriticalHit } from "../../../platform/gw2/native-profession.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type { Gw2EventDraft } from "../../../platform/gw2/types.js";
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerResolverReactionDetails,
} from "../types.js";

interface TraitDamageDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly flatStrikeBase: number;
  readonly flatStrikePowerCoeff: number;
}

interface TraitConditionDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly condition: string;
  readonly stacks?: number;
  readonly duration: number;
}

interface TraitCoefficientDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly coefficient: number;
  readonly noCrit?: boolean;
}

interface TraitVulnerabilityDefinition {
  readonly name: string;
  readonly traitId: SkillId;
  readonly stacks: number;
  readonly duration: number;
}

function queueTraitDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  {
    name,
    traitId,
    flatStrikeBase,
    flatStrikePowerCoeff,
  }: TraitDamageDefinition,
): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient: 0,
    flatStrikeBase,
    flatStrikePowerCoeff,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit: true,
    damageKind: "life-steal",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

export function applyTraitCondition(
  details: NecromancerResolverReactionDetails,
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, condition, stacks = 1, duration }: TraitConditionDefinition,
): void {
  const application: Gw2EventDraft = {
    type: "condition",
    at: event.at,
    name: `${name} — ${condition}`,
    skillName: name,
    condition,
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  };
  if (details.applyCondition) {
    details.applyCondition(context, application);
  } else {
    enqueueOrdered(context.queue, application);
  }
  context.recordProc?.("trait", name, event.at, event.skillName);
}

export function queueTraitCoefficientDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, coefficient, noCrit = true }: TraitCoefficientDefinition,
): void {
  enqueueOrdered(context.queue, {
    type: "damage",
    at: event.at,
    name,
    skillName: name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    skillWeapon: "Unequipped",
    noCrit,
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

function targetBelowHalfHealth(context: NecromancerResolverContext): boolean {
  const maximum = Number(context.config.target?.health || 0);
  if (!(maximum > 0)) return false;
  return (
    Number(context.totals.strike || 0) + Number(context.totals.condition || 0) >
    maximum * 0.5
  );
}

export function targetIsChilled(
  context: NecromancerResolverContext,
  at: number,
): boolean {
  if (
    context.config.target?.conditions?.Chilled === true ||
    Number(context.config.target?.conditions?.Chilled || 0) > 0
  )
    return true;
  return Number(professionCoreState(context).targetChilledUntil || 0) > at;
}

export function usesRandomTraitProcs(
  context: NecromancerResolverContext,
): boolean {
  return context.random?.stochastic === true;
}

export function rolledCritical(
  details: NecromancerResolverReactionDetails,
): boolean {
  return details.hitContext?.critical?.didCrit === true;
}

function hasActiveBuff(
  context: NecromancerResolverContext,
  kind: string,
  at: number,
): boolean {
  return (context.boons.get(kind) || []).some(
    (application) =>
      application.at <= at &&
      application.expiresAt > at &&
      application.stacks > 0,
  );
}

export function applyTraitVulnerability(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  { name, traitId, stacks, duration }: TraitVulnerabilityDefinition,
): void {
  enqueueOrdered(context.queue, {
    type: "buff",
    at: event.at,
    name,
    skillName: name,
    kind: "target-vulnerability",
    stacks,
    duration,
    source: "Trait",
    sourceId: traitId,
    actorType: "effect",
    triggeredBy: event.skillName,
  });
  context.recordProc?.("trait", name, event.at, event.skillName);
}

export function reactToNecromancerCoreDamage(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (event.actorType === "effect" || !(Number(event.coefficient) > 0)) {
    return;
  }
  const skill =
    event.skillId == null
      ? undefined
      : context.helpers.skillsById?.get(event.skillId);
  const firstHit = Number(event.hitIndex || 1) === 1;
  const shroudSkillOne =
    skill?.shroudSlot === 1 || event.necromancerShroudSkillOne === true;
  if (hasTrait(context, TRAIT.REAPERS_MIGHT) && firstHit && shroudSkillOne) {
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      name: "Reaper's Might",
      skillName: "Reaper's Might",
      kind: "might",
      stacks: 1,
      duration: 15,
      source: "Trait",
      sourceId: TRAIT.REAPERS_MIGHT,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Reaper's Might", event.at, event.skillName);
  }
  if (
    hasTrait(context, TRAIT.SIPHONED_POWER) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(
      event.at,
      Number(professionCoreState(context).traitProcReadyAt.siphonedPower || 0),
    )
  ) {
    professionCoreState(context).traitProcReadyAt.siphonedPower = event.at + 1;
    enqueueOrdered(context.queue, {
      type: "buff",
      at: event.at,
      name: "Siphoned Power",
      skillName: "Siphoned Power",
      kind: "might",
      stacks: 3,
      duration: 8,
      source: "Trait",
      sourceId: TRAIT.SIPHONED_POWER,
      actorType: "effect",
      triggeredBy: event.skillName,
    });
    context.recordProc?.("trait", "Siphoned Power", event.at, event.skillName);
  }
  if (
    hasTrait(context, TRAIT.SPITEFUL_FORTITUDE) &&
    event.actorType === "player" &&
    targetBelowHalfHealth(context)
  ) {
    professionCoreState(context).spitefulFortitudeLifeForce =
      Number(professionCoreState(context).spitefulFortitudeLifeForce || 0) +
      (hasTrait(context, TRAIT.GLUTTONY) ? 1.1 : 1);
  }
  if (
    hasTrait(context, TRAIT.CHILL_OF_DEATH) &&
    targetBelowHalfHealth(context) &&
    isInternalCooldownReady(
      event.at,
      Number(professionCoreState(context).traitProcReadyAt.chillOfDeath || 0),
    )
  ) {
    professionCoreState(context).traitProcReadyAt.chillOfDeath = event.at + 16;
    const boons = context.config.target?.boonless
      ? 0
      : Math.min(
          3,
          Math.max(
            0,
            Number(
              context.config.target?.boonCount ??
                (Array.isArray(context.config.target?.boons)
                  ? context.config.target.boons.length
                  : 1),
            ),
          ),
        );
    const coefficient = [0.6, 0.9, 1.5, 2.1][boons];
    queueTraitCoefficientDamage(context, event, {
      name: "Lesser Spinal Shivers",
      traitId: TRAIT.CHILL_OF_DEATH,
      coefficient,
      noCrit: true,
    });
    enqueueOrdered(context.queue, {
      type: "necromancer.chill",
      at: event.at,
      source: "Trait",
      sourceId: TRAIT.CHILL_OF_DEATH,
      actorType: "effect",
      skillName: "Lesser Spinal Shivers",
      duration: 5,
    });
  }
  if (hasTrait(context, TRAIT.DHUUMFIRE) && shroudSkillOne) {
    const proc = MECHANICS.traitProcs[TRAIT.DHUUMFIRE];
    const interval = Number(event.dhuumfireInterval || 0);
    if (
      interval > 0 &&
      !isInternalCooldownReady(
        event.at,
        Number(professionCoreState(context).traitProcReadyAt?.dhuumfire || 0),
      )
    ) {
      // Variant-specific internal cooldown supplied by the owning handler.
    } else {
      if (interval > 0) {
        professionCoreState(context).traitProcReadyAt.dhuumfire = event.at + interval;
      }
      applyTraitCondition(details, context, event, {
        ...proc,
        duration: Number(
          event.dhuumfireDuration ?? skill?.dhuumfireDuration ?? proc.duration,
        ),
      });
    }
  }
  if (hasTrait(context, TRAIT.UNYIELDING_BLAST) && firstHit && shroudSkillOne) {
    applyTraitVulnerability(
      context,
      event,
      MECHANICS.traitProcs[TRAIT.UNYIELDING_BLAST],
    );
  }
  necromancerBarbedPrecisionReaction.handler(context, event, details);
  if (
    hasTrait(context, TRAIT.VAMPIRIC_PRESENCE) &&
    isInternalCooldownReady(
      event.at,
      Number(professionCoreState(context).vampiricPresenceReadyAt || 0),
    )
  ) {
    const proc = MECHANICS.traitProcs[TRAIT.VAMPIRIC_PRESENCE];
    professionCoreState(context).vampiricPresenceReadyAt = event.at + proc.interval;
    queueTraitDamage(context, event, proc);
  }
  if (
    hasTrait(context, TRAIT.OVERFLOWING_THIRST) &&
    hasActiveBuff(context, "taste-for-blood", event.at)
  ) {
    queueTraitDamage(context, event, {
      name: "Taste for Blood",
      traitId: TRAIT.OVERFLOWING_THIRST,
      flatStrikeBase: 325,
      flatStrikePowerCoeff: 0,
    });
  }
}

const barbedPrecision = MECHANICS.traitProcs[TRAIT.BARBED_PRECISION];
export const necromancerBarbedPrecisionReaction =
  onResolvedPlayerCriticalHit<
    NecromancerResolverContext,
    NecromancerResolverEvent,
    NecromancerResolverReactionDetails
  >({
    id: "necromancer.barbed-precision",
    order: 0,
    actorTypes: ["player", "summon", "unknown"],
    chanceOnCriticalHit: barbedPrecision.chanceOnCriticalHit,
    randomStream: "necromancer.barbed-precision",
    when: (context, event) =>
      Number(event.coefficient) > 0 &&
      hasTrait(context, TRAIT.BARBED_PRECISION),
    expectedProgress: {
      get: (context) => professionCoreState(context).barbedPrecisionProgress,
      set: (context, value) => {
        professionCoreState(context).barbedPrecisionProgress = value;
      },
    },
    attribution: { kind: "trait", id: TRAIT.BARBED_PRECISION },
    handler: (context, event, details) =>
      applyTraitCondition(details, context, event, barbedPrecision),
  });

export function reactToNecromancerCoreCondition(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (event.condition === "Chilled") {
    professionCoreState(context).targetChilledUntil = Math.max(
      Number(professionCoreState(context).targetChilledUntil || 0),
      event.at + Number(event.effectiveDuration ?? event.duration ?? 0),
    );
  }
  if (
    event.actorType !== "summon" &&
    hasTrait(context, TRAIT.CORRUPTERS_FERVOR)
  ) {
    addCarapace(professionCoreState(context), 1, event.at);
  }
}

export function reactToNecromancerBlind(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  if (
    !hasTrait(context, TRAIT.CHILLING_DARKNESS) ||
    !isInternalCooldownReady(
      event.at,
      Number(professionCoreState(context).traitProcReadyAt.chillingDarkness || 0),
    )
  )
    return;
  professionCoreState(context).traitProcReadyAt.chillingDarkness = event.at + 3;
  applyTraitCondition(
    details,
    context,
    event,
    MECHANICS.traitProcs[TRAIT.CHILLING_DARKNESS],
  );
}

export function reactToNecromancerCoreControl(
  context: NecromancerResolverContext,
  event: NecromancerResolverEvent,
  details: NecromancerResolverReactionDetails = {},
): void {
  professionCoreState(context).targetControlledUntil = Math.max(
    Number(professionCoreState(context).targetControlledUntil || 0),
    event.at + Math.max(0.001, Number(event.duration || 0)),
  );
  if (event.controlKind === "fear" || event.kind === "fear") {
    professionCoreState(context).dreadUntil = Math.max(
      Number(professionCoreState(context).dreadUntil || 0),
      event.at + 3,
    );
    if (hasTrait(context, TRAIT.TERROR)) {
      applyTraitCondition(details, context, event, {
        name: "Terror",
        traitId: TRAIT.TERROR,
        condition: "Fear",
        duration: Number(event.duration || 1),
      });
    }
  }
  if (hasTrait(context, TRAIT.INSIDIOUS_DISRUPTION)) {
    applyTraitCondition(
      details,
      context,
      event,
      MECHANICS.traitProcs[TRAIT.INSIDIOUS_DISRUPTION],
    );
  }
}

/**
 * Necromancer resolver-side handlers: shroud/state and summon-attack timeline
 * events, plus trait reactions that queue extra damage and conditions.
 */
export const necromancerCoreResolverEventHandlers = Object.freeze({
  "necromancer.state": handleNecromancerStateEvent,
  "necromancer.chill": handleNecromancerChillEvent,
  "necromancer.summon-attack": handleNecromancerSummonAttack,
});

export const necromancerCoreResolverEventReactions = Object.freeze({
  damage: reactToNecromancerCoreDamage,
  condition: reactToNecromancerCoreCondition,
  blind: reactToNecromancerBlind,
  control: reactToNecromancerCoreControl,
});
