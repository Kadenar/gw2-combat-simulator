/**
 * Trait effects triggered by invoking a legend.
 *
 * Materializes Spirit Boon, Song of the Mists, Invoking Torment, Diabolic
 * Inferno, and Renegade Kalla's Fervor at legend-swap completion. Legend
 * selection accounts for Conduit's Entity bar by resolving the paired legend.
 */
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../../data/ids.js";
import { hasRevenantTrait } from "../../state.js";
import { REVENANT_HANDLER_MECHANICS as MECHANICS } from "../handler-mechanics.js";
import { emitRevenantBoon } from "./conduit.js";
import { grantKallasFervor } from "./assassin-renegade.js";
import type {
  SkillId,
} from "../../../../platform/engine/types.js";
import type {
  RevenantCastContext,
  RevenantSkill,
  RevenantState,
} from "../../types.js";

interface LegendInvocationBoon {
  readonly kind: string;
  readonly duration: number;
  readonly stacks: number;
}

interface LegendInvocationSong {
  readonly name: string;
  readonly coefficient: number;
  readonly conditions: readonly (readonly [string, number, number])[];
  readonly boons: readonly (readonly [string, number, number])[];
  readonly enduranceOnCast?: number;
  readonly endurancePerHit?: number;
  readonly hits?: number;
}

function invokedLegend(state: RevenantState): string {
  if (state.activeLegendId !== LEGEND.ENTITY) return state.activeLegendId;
  return (
    state.selectedLegendIds.find((id) => id !== LEGEND.ENTITY) || LEGEND.ENTITY
  );
}

function emitDamage(
  context: RevenantCastContext,
  name: string,
  coefficient: number,
  at: number,
  options: {
    readonly sourceId: SkillId;
    readonly extendsResolutionHorizon?: boolean;
  },
): void {
  context.emit({
    type: "damage",
    at,
    source: "revenant",
    sourceId: options.sourceId,
    actorType: "player",
    skillId: options.sourceId,
    skillName: name,
    name,
    coefficient,
    hits: 1,
    hitIndex: 1,
    totalHits: 1,
    skillWeapon: "Unequipped",
    ...(options.extendsResolutionHorizon
      ? { extendsResolutionHorizon: true }
      : {}),
  });
}

function emitCondition(
  context: RevenantCastContext,
  name: string,
  condition: string,
  stacks: number,
  duration: number,
  at: number,
  sourceId: SkillId,
): void {
  context.emit({
    type: "condition",
    at,
    source: "revenant",
    sourceId,
    actorType: "player",
    skillId: sourceId,
    skillName: name,
    name: `${name} — ${condition}`,
    condition,
    stacks,
    duration,
  });
}

function emitSpiritBoon(
  context: RevenantCastContext,
  swapSkill: RevenantSkill,
  legendId: string,
  at: number,
): void {
  const boons = MECHANICS.legendInvocation.spiritBoons as Readonly<
    Record<string, LegendInvocationBoon>
  >;
  const boon = boons[legendId];
  if (!boon) return;
  emitRevenantBoon(context, swapSkill, boon.kind, boon.duration, boon.stacks, {
    at,
    sourceId: TRAIT.SPIRIT_BOON,
    name: `Spirit Boon — ${boon.kind}`,
  });
}

function emitSongOfTheMists(
  context: RevenantCastContext,
  swapSkill: RevenantSkill,
  legendId: string,
  at: number,
): void {
  const songs = MECHANICS.legendInvocation.songs as unknown as Readonly<
    Record<string, LegendInvocationSong>
  >;
  const profile = songs[legendId];
  if (!profile) return;
  const sourceId = TRAIT.SONG_OF_THE_MISTS;
  emitDamage(context, profile.name, profile.coefficient, at, { sourceId });
  for (const [condition, stacks, duration] of profile.conditions) {
    emitCondition(
      context,
      profile.name,
      condition,
      stacks,
      duration,
      at,
      sourceId,
    );
  }
  for (const [boon, duration, stacks] of profile.boons) {
    if (boon === "kallas-fervor" || boon === "kallas-fervor-hit") {
      for (let index = 0; index < stacks; index += 1) {
        grantKallasFervor(context, context.action, {
          at,
          sourceId,
          sourceName: profile.name,
        });
      }
      continue;
    }
    const label =
      boon === "kallas-fervor"
        ? "Kalla's Fervor"
        : boon === "kallas-fervor-hit"
          ? "Kalla's Fervor for Hit"
          : boon;
    emitRevenantBoon(context, swapSkill, boon, duration, stacks, {
      at,
      sourceId,
      name: `${profile.name} — ${label}`,
    });
  }
  const endurance =
    Number(profile.enduranceOnCast || 0) +
    Number(profile.endurancePerHit || 0) *
      Math.max(0, Number(profile.hits || 1));
  if (endurance > 0) {
    const state = context.state.profession;
    state.endurance = Math.min(
      state.maximumEndurance,
      Number(state.endurance || 0) + endurance,
    );
    state.enduranceUpdatedAt = at;
  }
}

function emitInvokingTorment(
  context: RevenantCastContext,
  at: number,
): void {
  const profile = MECHANICS.legendInvocation.invokingTorment;
  const sourceId = TRAIT.INVOKING_TORMENT;
  const name = "Invoke Torment";
  emitDamage(context, name, profile.coefficient, at, {
    sourceId,
    extendsResolutionHorizon: true,
  });
  emitCondition(
    context,
    name,
    "Torment",
    profile.tormentStacks,
    profile.tormentDuration,
    at,
    sourceId,
  );
  if (hasRevenantTrait(context.config, TRAIT.DIABOLIC_INFERNO)) {
    emitCondition(
      context,
      name,
      "Poisoned",
      profile.poisonStacks,
      profile.poisonDuration,
      at,
      sourceId,
    );
    emitCondition(
      context,
      name,
      "Burning",
      profile.burningStacks,
      profile.burningDuration,
      at,
      sourceId,
    );
  }
}

/** Applies every selected trait that triggers from the newly invoked legend. */
export function applyLegendInvocationTraits(
  context: RevenantCastContext,
  swapSkill: RevenantSkill,
): void {
  const at = context.effectiveEnd;
  const legendId = invokedLegend(context.state.profession);
  if (hasRevenantTrait(context.config, TRAIT.SPIRIT_BOON)) {
    emitSpiritBoon(context, swapSkill, legendId, at);
  }
  if (hasRevenantTrait(context.config, TRAIT.SONG_OF_THE_MISTS)) {
    emitSongOfTheMists(context, swapSkill, legendId, at);
  }
  if (hasRevenantTrait(context.config, TRAIT.INVOKING_TORMENT)) {
    emitInvokingTorment(
      context,
      at + MECHANICS.legendInvocation.invokingTorment.delay,
    );
  }
}
