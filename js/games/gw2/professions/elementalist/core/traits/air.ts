import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
/** Imperative Air trait behavior; dispatch and reaction registration stay with their existing owners. */
import { emitElementalistBuff, emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';
import { ELEMENTALIST_ATTUNEMENT_SKILL_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { setElementalistAttunementReadyAt } from '#gw2/professions/elementalist/core/state.js';
import {
  combatStarted,
  emitElementalistProc,
  emitProfiledBuff,
  emitProfiledCondition
} from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { queueElementalistBuff } from '#gw2/professions/elementalist/core/mechanics/resolution-helpers.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/core/profiles.js';

/** Emits Electric Discharge from a qualifying Air-attunement transition. */
export function triggerElectricDischarge(context: ElementalistRuntime, at: number, sourceId: Skill['id']): void {
  if (!combatStarted(context, at) || !hasTrait(context, 'Electric Discharge')) return;
  const electricDischargeProfile = requireBalanceProfileFromContext(context, PROFILE.electricDischarge);
  const electricDischargeStrike = requireEffect(electricDischargeProfile, 'strike', 'Electric Discharge');
  if (electricDischargeStrike) {
    emitElementalistDamage(context, {
      at,
      source: 'Electric Discharge',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Electric Discharge',
      coefficient: effectNumber(electricDischargeProfile, electricDischargeStrike, 'coefficient'),
      skillWeapon: 'Unequipped'
    });
  }

  const conditionEmitted = emitProfiledCondition(
    context,
    at,
    PROFILE.electricDischarge,
    'Electric Discharge',
    'Electric Discharge',
    sourceId
  );
  if (electricDischargeStrike || conditionEmitted)
    emitElementalistProc(context, {
      at,
      name: 'Electric Discharge',
      procType: 'trait',
      sourceId,
      sourceSkill: context.helpers.skillsById.get(sourceId)?.name
    });
}

/** Opens Fresh Air's ferocity window when an attunement transition newly enters Air. */
export function applyFreshAirAttunementEntry(
  context: ElementalistRuntime,
  at: number,
  skill: Skill,
  previous: string
): void {
  if (previous === 'Air' || !hasTrait(context, 'Fresh Air')) return;
  const freshAirProfile = requireBalanceProfileFromContext(context, PROFILE.freshAir);
  const freshAir = requireEffect(freshAirProfile, 'buff', 'fresh-air');
  if (freshAir) {
    emitElementalistBuff(context, {
      skill: skill,
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: 'fresh air',
      stacks: Number(freshAir.stacks),
      duration: Number(freshAir.duration),
      skillName: skill.name,
      priority: -10
    });
  }
}

/** Reads Superspeed as a buff so profile overrides apply without boon-duration scaling. */
export function applyOneWithAir(context: ElementalistRuntime, at: number, skill: Skill): void {
  if (!hasTrait(context, 'One with Air')) return;
  const oneWithAirProfile = requireBalanceProfileFromContext(context, PROFILE.oneWithAir);
  const superspeed = requireEffect(oneWithAirProfile, 'buff', 'Superspeed');
  if (superspeed) {
    emitElementalistBuff(context, {
      skill: skill,
      at,
      source: skill.name,
      sourceId: skill.id,
      actorType: 'player',
      kind: String(superspeed.kind).toLowerCase(),
      stacks: Number(superspeed.stacks),
      duration: Number(superspeed.duration),
      skillName: skill.name
    });
  }
}

/** Grants Inscription's dedicated Resistance effect after entering Air. */
export function applyInscriptionAirEntry(context: ElementalistRuntime, at: number, skill: Skill): void {
  if (hasTrait(context, 'Inscription')) {
    emitProfiledBuff(context, at, PROFILE.inscription, 'Air Entry', skill.name, skill.id);
  }
}

/** Grants Inscription's current-attunement boon after a completed Glyph cast. */
export function applyInscriptionPostCast(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  if (!hasTrait(context, 'Inscription') || skill.skillFamily !== 'Glyph') return;
  const state = professionCoreState(context);
  emitProfiledBuff(context, cast.effectiveEnd, PROFILE.inscription, state.primaryAttunement, skill.name, skill.id);
}

/** Materializes Lightning Rod from a classified player control event. */
export function applyLightningRod(context: ElementalistRuntime, event: SimulationEvent): void {
  if (!hasTrait(context, 'Lightning Rod')) return;
  const sourceId = event.skillId ?? event.sourceId;
  const lightningRodProfile = requireBalanceProfileFromContext(context, PROFILE.lightningRod);
  const lightningRodStrike = requireEffect(lightningRodProfile, 'strike', 'Lightning Rod');
  if (lightningRodStrike) {
    emitElementalistDamage(context, {
      cause: event,
      at: event.at,
      source: 'Lightning Rod',
      sourceId,
      actorType: 'effect',
      ownerActorType: 'player',
      skillName: 'Lightning Rod',
      coefficient: effectNumber(lightningRodProfile, lightningRodStrike, 'coefficient'),
      skillWeapon: 'Unequipped'
    });
  }

  const conditionEmitted = emitProfiledCondition(
    context,
    event.at,
    PROFILE.lightningRod,
    'Lightning Rod',
    'Lightning Rod',
    sourceId
  );
  if (lightningRodStrike || conditionEmitted)
    emitElementalistProc(context, {
      at: event.at,
      name: 'Lightning Rod',
      procType: 'trait',
      sourceId,
      sourceSkill: String(event.skillName || event.source || '')
    });
}

/** Materializes Raging Storm after its registered critical-hit reaction succeeds. */
export function applyRagingStorm(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  const ragingStormProfile = requireBalanceProfileFromContext(context, PROFILE.ragingStorm);
  const fury = requireEffect(ragingStormProfile, 'boon', 'Fury');
  if (fury) {
    queueElementalistBuff(
      context,
      event,
      String(fury.boon),
      Number(fury.stacks),
      Number(fury.duration),
      'Raging Storm'
    );
  }
}

/** Both aura paths select the same profile effects before applying their own duration policy. */
function zephyrsBoonEffects(context: unknown) {
  return ['Fury', 'Swiftness'].flatMap((name) => {
    const zephyrsBoonProfile = requireBalanceProfileFromContext(context, PROFILE.zephyrsBoon);
    const effect = requireEffect(zephyrsBoonProfile, 'boon', name);
    if (!effect) return [];
    return [
      {
        kind: String(effect.boon).toLowerCase(),
        stacks: Number(effect.stacks),
        duration: Number(effect.duration)
      }
    ];
  });
}

/** Grants resolver-side Zephyr's Boon effects for one classified aura event. */
export function applyResolverZephyrsBoon(context: Gw2ResolverRuntime, event: Gw2ResolverEvent): void {
  if (!hasTrait(context, "Zephyr's Boon")) return;
  const source = String(event.skillName || event.name || event.source || '');
  for (const boon of zephyrsBoonEffects(context)) {
    queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, source);
  }
}

/** Only an accepted player critical hit can reset Air's actual recharge. */
export function applyFreshAirCritical(
  context: ElementalistRuntime,
  event: Gw2ResolverEvent,
  critical: { chance: number; didCrit?: boolean }
): void {
  if (
    !hasTrait(context, 'Fresh Air') ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    context.profession.core.primaryAttunement === 'Air' ||
    !critical.didCrit
  )
    return;
  if (Number(context.cooldowns.get(ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Air) ?? 0) > event.at)
    setElementalistAttunementReadyAt(context, 'Air', event.at);
  context.emitDerived(event, {
    type: 'elementalist.fresh-air',
    at: event.at,
    source: 'Fresh Air',
    sourceId: 'Fresh Air',
    actorType: 'effect',
    skillName: 'Fresh Air',
    sourceSkill: event.skillName,
    triggeringSkillId: event.skillId ?? event.sourceId
  });
}

/** Pending damage supplies a wake, never a predicted resource or critical result. */
export function projectedFreshAirReadyAt(context: ElementalistRuntime, upTo: number): number | null {
  if (!hasTrait(context, 'Fresh Air') || context.profession.core.primaryAttunement === 'Air') return null;
  const times = context.profession.core.freshAirCandidates
    .filter((candidate) => candidate.at > context.time && candidate.at <= upTo)
    .map((candidate) => candidate.at);
  return times.length ? Math.min(...times) : null;
}
