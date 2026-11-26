/** Amalgam strains own their granted effects, proc cooldowns, and attribute bonuses across protocol slots. */
import type { Gw2AttributeContext } from '#gw2/platform/attributes/types.js';
import { isStandardBoon } from '#gw2/platform/combat/boons.js';
import { buffDeadlineActive } from '#gw2/platform/combat/buff-expiry.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { gw2EffectExpiresAt } from '#gw2/platform/combat/effect-timing.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs/registry.js';
import { ACTOR, BOON } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { effectNumber, requireEffect, requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/skills/types.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { buildEngineerStrike } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import type { AmalgamSkill } from '#gw2/professions/engineer/specializations/amalgam/types.js';
import type { EngineerResolverEvent, EngineerRuntime } from '#gw2/professions/engineer/types.js';

/** Resolve the button's tuning owner so the grant and its later effects use the same protocol. */
export function applyAmalgamStrain(context: EngineerRuntime, button: AmalgamSkill, at: number): void {
  const state = amalgamState.from(context.profession);
  const skill: AmalgamSkill = requireSkill(context.helpers, button.tuningSkillId ?? button.id);
  const morphKind = skill.morphKind;
  const action = requireSkillAction(skill, 'strain');

  if (morphKind === 'thorns') {
    // A removed shared payload cannot arm an empty proc window.
    const duration = skillNumber(skill, 'rapaciousDuration');

    if (duration > 0 && requireEffect(skill, 'strike', 'Rapacious Strain', action)) {
      state.rapaciousUntil = gw2Time(Math.max(state.rapaciousUntil || 0, at + duration));
    }

    return;
  }

  for (const effect of action.effects) {
    if (!effect.sourceId || !effect.name) throw new Error('Missing Amalgam strain identity');

    if (effect.type === 'control') {
      buildEngineerPackets('control', {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: ACTOR.PLAYER,
        skillName: effect.name,
        name: effect.name,
        controlKind: effect.controlKind
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
      continue;
    }

    if (effect.type !== 'boon' && effect.type !== 'buff') continue;

    // Titanic's attribute bonus uses the protocol's base duration.
    if (effect.type === 'boon' && morphKind === 'obliterate') {
      state.titanicUntil = gw2Time(Math.max(state.titanicUntil || 0, at + effect.duration));
    }

    // Each strain grant is a finite occurrence; profile emission retains its yield lineage for sustained generation.
    const sourceSkill = context.helpers.skillsById.get(effect.sourceId) || { id: effect.sourceId, name: effect.name };
    context.effects.emit({
      kind: 'profile',
      profile: sourceSkill,
      effects: [effect],
      at,
      attribution: {
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: ACTOR.PLAYER,
        skillId: sourceSkill.id,
        skillName: effect.name
      },
      // Preserve the strain label for consumers that read the packet rather than its buff kind.
      transform: (event) => ({ ...event, name: effect.name })
    });
  }
}

const strainBoonTimers = new Map<SkillId, 'resiliantUntil' | 'replicatingUntil' | 'predatorUntil' | 'berserkerUntil'>([
  ['engineer.resiliant-strain', 'resiliantUntil'],
  ['engineer.replicating-strain', 'replicatingUntil'],
  ['engineer.predator-strain', 'predatorUntil'],
  ['engineer.berserker-strain', 'berserkerUntil']
]);

/** The inspector follows accepted self boons. Predator's Superspeed shares its source ID but has a separate duration. */
export function observeAmalgamStrainGrant(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const timer = strainBoonTimers.get(event.sourceId);
  const duration = event.duration ?? 0;

  if (!timer || !isStandardBoon(event.kind) || !event.resolvedAudience?.includesSelf || !(duration > 0)) return;

  const state = amalgamState.from(context.profession);
  state[timer] = Math.max(state[timer], gw2EffectExpiresAt(event.at, duration));
}

/** Rapacious can trigger on another eligible strike throughout its grant. */
export function triggerRapaciousStrain(context: EngineerRuntime, event: EngineerResolverEvent): void {
  const state = context.procs;
  const strain = amalgamState.from(context.profession);

  if (
    event.actorType === ACTOR.SUMMON ||
    event.sourceId === 'engineer.rapacious-strain' ||
    !buffDeadlineActive(strain.rapaciousUntil, event.at)
  )
    return;

  // The shared strain owner keeps one cooldown regardless of the last granting slot.
  const skill = requireSkill(context.helpers, ID.DEFENSIVE_PROTOCOL_THORNS);
  // The strain's own lifetime authorizes procs, including Silver Lining grants outside Evolve.
  // Rapacious cannot trigger itself, even with a zero authored ICD.
  const cooldown = skillNumber(skill, 'rapaciousInternalCooldown');

  if (cooldown === 0 || isInternalCooldownReady(event.at, state.deadline('rapacious') || 0)) {
    const strike = requireEffect(skill, 'strike', 'Rapacious Strain', requireSkillAction(skill, 'strain'));

    // Keep Rapacious effect-owned for proc gating while inheriting the player's outgoing modifiers.
    if (strike) {
      state.setDeadline('rapacious', event.at + cooldown);
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerStrike(event, {
          skillWeapon: 'Unequipped',
          name: 'Rapacious Strain',
          coefficient: effectNumber(skill, strike, 'coefficient'),
          sourceId: 'engineer.rapacious-strain',
          actorType: ACTOR.EFFECT,
          ownerActorType: ACTOR.PLAYER
        })
      });

      context.effects.emit({
        attribution: { source: 'engineer', sourceId: skill.id, actorType: ACTOR.EFFECT },
        kind: 'announcement',
        cause: event,
        announcement: {
          type: 'trait',
          name: 'Rapacious Strain',
          at: event.at,
          sourceSkill: event.skillName,
          icon: skill.icon
        }
      });
    }
  }
}

/** Titanic applies its protocol tuning to live Might until the grant expires. */
export function titanicStrainBonus(context: Gw2AttributeContext): number {
  return activeAmalgamState(context, 'titanicUntil')
    ? activeBoonStacks(context, BOON.MIGHT) *
        skillNumber(
          requireSkill(context.balanceContext.catalog, ID.OFFENSIVE_PROTOCOL_OBLITERATE),
          'titanicAttributePerStack'
        )
    : 0;
}
