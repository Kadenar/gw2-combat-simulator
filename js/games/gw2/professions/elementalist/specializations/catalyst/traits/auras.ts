import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { resolverSourceSkill } from '#gw2/platform/resolver/packets.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';
import {
  activeElementalistBuffs,
  queueElementalistAura,
  queueElementalistBuff,
  recordElementalistTraitProc,
  refreshElementalistBuffs
} from '#gw2/professions/elementalist/core/mechanics/reactions.js';
import type { ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

/** Refresh Empowering Auras before Epitome grants an empowerment stack from the same aura. */
export function applyEmpoweringAura(context: ElementalistRuntime, event: Gw2ResolverEvent): void {
  if (hasTrait(context, TRAIT.EMPOWERING_AURAS)) {
    const { maximumStacks, duration } = empoweringAurasParameters(context);
    const current = activeElementalistBuffs(context, 'Empowering Auras', event.at);
    refreshElementalistBuffs(context, 'Empowering Auras', event.at, () => event.at + duration);
    const activeStacks = current.reduce((total, application) => total + (application.stacks || 1), 0);
    if (activeStacks < maximumStacks) {
      queueElementalistBuff(context, event, 'Empowering Auras', 1, duration, resolverSourceSkill(event));
    }

    // Report refreshes even at the cap, where no new gameplay stack is granted.
    context.recordProc(
      'trait',
      'Empowering Auras',
      event.at,
      resolverSourceSkill(event),
      '',
      '',
      null,
      event.at + duration
    );
  }
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
  queueElementalistBuff(
    context,
    event,
    'Elemental Empowerment',
    empowerment.stacks,
    empowerment.duration,
    resolverSourceSkill(event)
  );
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
      queueElementalistAura(context, event, aura.aura, aura.duration, 'Elemental Epitome');
      recordElementalistTraitProc(context, event, 'Elemental Epitome');
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
      if (boon) queueElementalistBuff(context, event, boon.kind, boon.stacks, boon.duration, 'Elemental Synergy');
    } else if (attunement === 'Air') {
      const elementalSynergyProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_SYNERGY);

      context.endurance.grant(balanceProfileNumber(elementalSynergyProfile, 'resourceGain'));
    }

    recordElementalistTraitProc(context, event, 'Elemental Synergy');
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
