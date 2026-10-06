import { applyElementalistAura } from '#gw2/professions/elementalist/core/mechanics/auras.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { professionCoreState, readProfessionSpecializationState } from '#gw2/platform/profession-definition/state.js';
import { activeRefreshedStacks, grantRefreshedStacks } from '#gw2/platform/combat/resources/refreshed-stacks.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { gw2EffectExpiresAt } from '#gw2/platform/effects/timing.js';
import { catalystState, type CatalystState } from '#gw2/professions/elementalist/specializations/catalyst/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Refresh Empowering Auras before Epitome grants an empowerment stack from the same aura. */
export function applyEmpoweringAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.EMPOWERING_AURAS)) {
    const { maximumStacks, duration } = empoweringAurasParameters(context);
    const state = catalystState.from(context);
    const activeStacks = activeRefreshedStacks(state.empoweringAuras, event.at, 'exclusive');
    // Refresh survivors now, including at cap; new stacks still arrive at their queued buff-application boundary.
    const expiresAt = gw2EffectExpiresAt(event.at, duration);
    state.empoweringAuras = grantRefreshedStacks(
      state.empoweringAuras,
      0,
      event.at,
      expiresAt,
      maximumStacks,
      'exclusive'
    );
    if (activeStacks < maximumStacks) {
      context.effects.emit({
        kind: 'packet',
        durationContext: event,
        event: {
          type: 'buff',
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.EMPOWERING_AURAS,
          actorType: 'player',
          skillName: requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS).name,
          kind: 'Empowering Auras'.toLowerCase(),
          stacks: 1,
          duration: duration,
          triggeredBy: resolverSourceSkill(event),
          priority: Number(event.priority || 0)
        }
      });
    }

    // Report refreshes even at the cap, where no new gameplay stack is granted.
    context.effects.emit({
      kind: 'announcement',
      announcement: {
        type: 'trait',
        name: 'Empowering Auras',
        at: event.at,
        sourceSkill: resolverSourceSkill(event),
        detail: '',
        icon: '',
        cooldownReduction: null,
        expiresAt
      }
    });
  }
}

/** Accepted self buffs add to the same refreshed pool, including isolated preview inputs. */
export function applyEmpoweringAurasBuff(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (event.kind !== 'empowering auras' || !event.resolvedAudience?.includesSelf) return;
  const state = catalystState.from(context);
  const { maximumStacks } = empoweringAurasParameters(context);
  state.empoweringAuras = grantRefreshedStacks(
    state.empoweringAuras,
    event.stacks || 1,
    event.at,
    gw2EffectExpiresAt(event.at, event.duration || 0),
    maximumStacks,
    'exclusive'
  );
}

/** Strike and condition modifiers read the canonical Catalyst pool without replaying buff receipts. */
export function empoweringAuraStacks(context: Gw2ModifierContext): number {
  const state = readProfessionSpecializationState<CatalystState>(context.runtime?.profession, 'Catalyst');
  return activeRefreshedStacks(state?.empoweringAuras, context.time, 'exclusive');
}

/** Aura acceptance grants Epitome stacks only after combat starts. */
export function applyEpitomeAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (
    !hasTrait(context, TRAIT.ELEMENTAL_EPITOME) ||
    (context.combatStartTime != null && event.at < context.combatStartTime)
  ) {
    return;
  }

  const empowerment = elementalEpitomeEmpowerment(context);
  if (!empowerment) return;
  context.effects.emit({
    kind: 'packet',
    durationContext: event,
    event: {
      type: 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.ELEMENTAL_EPITOME,
      actorType: 'player',
      skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME).name,
      kind: 'Elemental Empowerment'.toLowerCase(),
      stacks: empowerment.stacks,
      duration: empowerment.duration,
      triggeredBy: resolverSourceSkill(event),
      priority: Number(event.priority || 0)
    }
  });
}

/** Epitome claims its per-element combo interval before emitting the selected aura. */
export function applyEpitomeCombo(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  const attunement = core.primaryAttunement;
  if (
    hasTrait(context, TRAIT.ELEMENTAL_EPITOME) &&
    context.procs.claimCooldown(
      `elementalist.catalyst.elementalEpitome:${attunement}`,
      event.at,
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME), 'internalCooldown')
    )
  ) {
    const aura = elementalEpitomeAura(context, attunement);
    if (aura) {
      applyElementalistAura(context, {
        at: event.at,
        aura: aura.aura,
        duration: aura.duration,
        skillName: 'Elemental Epitome',
        sourceId: event.skillId ?? event.sourceId
      });
      context.effects.emit({
        kind: 'announcement',
        announcement: {
          type: 'trait',
          name: 'Elemental Epitome',
          at: event.at,
          sourceSkill: resolverSourceSkill(event)
        }
      });
    }
  }
}

/** Synergy follows Epitome on an independent per-element combo interval. */
export function applySynergyCombo(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  const core = professionCoreState(context);
  const attunement = core.primaryAttunement;
  if (
    hasTrait(context, TRAIT.ELEMENTAL_SYNERGY) &&
    context.procs.claimCooldown(
      `elementalist.catalyst.elementalSynergy:${attunement}`,
      event.at,
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY), 'internalCooldown')
    )
  ) {
    if (attunement === 'Fire' || attunement === 'Earth') {
      const boon = elementalSynergyBoon(context, attunement);
      if (boon)
        context.effects.emit({
          kind: 'packet',
          durationContext: event,
          event: {
            type: 'buff',
            at: event.at,
            source: 'Trait',
            sourceId: TRAIT.ELEMENTAL_SYNERGY,
            actorType: 'player',
            skillName: requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY).name,
            kind: boon.kind.toLowerCase(),
            stacks: boon.stacks,
            duration: boon.duration,
            triggeredBy: resolverSourceSkill(event),
            priority: Number(event.priority || 0)
          }
        });
    } else if (attunement === 'Air') {
      const elementalSynergyProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY);

      context.endurance.grant(balanceProfileNumber(elementalSynergyProfile, 'resourceGain'));
    }

    context.effects.emit({
      kind: 'announcement',
      announcement: { type: 'trait', name: 'Elemental Synergy', at: event.at, sourceSkill: resolverSourceSkill(event) }
    });
  }
}

/** Shares aura-stack parameters while each phase retains its grant and refresh rules. */
function empoweringAurasParameters(context: unknown) {
  const empoweringAurasProfile = requireBalanceProfileFromContext(context, TRAIT.EMPOWERING_AURAS);
  return {
    maximumStacks: balanceProfileNumber(empoweringAurasProfile, 'maximumStacks'),
    duration: balanceProfileNumber(empoweringAurasProfile, 'durationMultiplier')
  };
}

/** Selects Epitome's empowerment payload without changing combat gating or stack tracking. */
function elementalEpitomeEmpowerment(context: unknown) {
  const elementalEpitomeProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME);
  const effect = requireEffect(elementalEpitomeProfile, 'buff', 'Empowerment');
  if (!effect) return undefined;
  return { stacks: Number(effect.stacks), duration: effect.duration };
}

/** Resolves the shared aura defaults; the resolver retains its canonical attunement identity. */
function elementalEpitomeAura(context: unknown, attunement: ElementalistAttunement) {
  const elementalEpitomeProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_EPITOME);
  const effect = requireEffect(elementalEpitomeProfile, 'buff', attunement);
  if (!effect) return undefined;
  return { aura: String(effect.kind), duration: effect.duration };
}

/** Fire and Earth combos share boon selection; Air's endurance remains phase-owned. */
function elementalSynergyBoon(context: unknown, attunement: 'Fire' | 'Earth') {
  const elementalSynergyProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY);
  const effect = requireEffect(elementalSynergyProfile, 'boon', attunement);
  if (!effect) return undefined;
  return {
    kind: String(effect.boon).toLowerCase(),
    stacks: Number(effect.stacks),
    duration: effect.duration
  };
}
