import type { MaximumAmmoContext } from '#gw2/platform/profession-definition/runtime-context.js';
import { type SkillId } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import {
  type EngineerRuntime,
  type EngineerSkill,
  type EngineerResolverEvent,
  type EngineerModifierContext,
  type EngineerResolverContext
} from '#gw2/professions/engineer/types.js';
import { buildEngineerPackets } from '#gw2/professions/engineer/core/events.js';
import { isInternalCooldownReady } from '#gw2/platform/combat/procs.js';
import { eventSkill } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerModifierOwnedEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { applyAmalgamStrain } from '#gw2/professions/engineer/specializations/amalgam/skills/evolved-state-skills.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  type AmalgamMorphKind
} from '#gw2/professions/engineer/specializations/amalgam/selection-policy.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { resolverSkill, buildEngineerCondition } from '#gw2/professions/engineer/core/mechanics/resolution-helpers.js';

// Keep Morph, Evolve, and their trait reactions together so form transitions share one behavior owner.
const EVOLVE_SKILL_IDS = new Set<SkillId>([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]);

/** Only the selected Double Helix variant receives the active profile's Evolve ammo capacity. */
export function amalgamMaximumAmmo(context: MaximumAmmoContext<object>, skill: EngineerSkill, maximum: number): number {
  if (!EVOLVE_SKILL_IDS.has(Number(skill.id))) return maximum;
  return skill.id === ID.EVOLVE_DOUBLE_HELIX && context.hasTrait(TRAIT.DOUBLE_HELIX)
    ? Math.max(balanceProfileNumber(context.requireBalanceProfile(PROFILE.evolve), 'maximumStacks'), maximum || 0)
    : 0;
}

/** Accepted non-summon control consumes its internal cooldown only when Evolve recharge actually decreases. */
export function reactToMercurialTendencies(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (!hasTrait(context.traits, TRAIT.MERCURIAL_TENDENCIES) || event.actorType === 'summon') return;
  const at = event.at;
  if (!isInternalCooldownReady(at, context.procs.deadline('mercurialTendencies') || 0)) return;
  const profile = requireBalanceProfileFromContext(context, TRAIT.MERCURIAL_TENDENCIES);
  let reducedBy = 0;
  for (const id of EVOLVE_SKILL_IDS) {
    const skill = context.helpers.skillsById.get(id);
    if (skill)
      reducedBy += context.cooldownController.reduceSkillRecharge(
        skill,
        balanceProfileNumber(profile, 'rechargeReduction'),
        at
      );
  }

  if (!(reducedBy > 0)) return;
  context.procs.setDeadline('mercurialTendencies', at + balanceProfileNumber(profile, 'internalCooldown'));
  context.effects.emit({
    kind: 'announcement',
    log: true,
    attribution: { source: 'Trait', sourceId: TRAIT.MERCURIAL_TENDENCIES, actorType: 'effect' },
    announcement: {
      name: 'Mercurial Tendencies',
      at: at,
      cooldownReduction: reducedBy,
      type: 'trait',
      sourceSkill: event.skillName || event.name
    }
  });
}

/** Double Helix chooses the Evolved bonus without changing the shared pre-profession conversion pool. */
export function evolveAttributeFactor(context: EngineerModifierContext): number {
  const profile = requireBalanceProfileFromContext(context, PROFILE.evolve);
  return balanceProfileNumber(
    profile,
    hasTrait(context, TRAIT.DOUBLE_HELIX) ? 'coefficientMultiplier' : 'damageMultiplier'
  );
}

/** Restrict Symbiotic Synergy to player-owned Morph strikes. */
export function morphStrike(context: EngineerModifierContext): boolean {
  return Boolean(isGw2PlayerModifierOwnedEvent(context.event) && eventSkill(context)?.categories?.includes('Morph'));
}

/** The committed Morph tail preserves Willing Host, protection, strains, then New Genes. */
export function activateAmalgamMorph(context: EngineerRuntime, skill: EngineerSkill): void {
  const at = context.time;
  const state = amalgamState.from(context);
  const morphKind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id);
  // Resolve traits whose duration or strain depends on the chosen protocol.
  if (hasTrait(context.traits, TRAIT.WILLING_HOST)) {
    const willingHostProfile = requireBalanceProfileFromContext(context, TRAIT.WILLING_HOST);
    state.willingHostUntil = Math.max(
      state.willingHostUntil,
      at + balanceProfileNumber(willingHostProfile, 'durationMultiplier')
    );
  }

  grantHardenedChrome(context, 'minimumStacks');

  if (morphKind && hasTrait(context.traits, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, morphKind, at);
  }

  // New Genes combines universal boons with one protocol-specific boon.
  if (hasTrait(context.traits, TRAIT.NEW_GENES)) {
    // Each selected boon survives independently, including the protocol-specific packet.
    for (const name of ['alacrity', 'might', ...(morphKind ? [morphKind] : [])]) {
      const newGenesProfile = requireBalanceProfileFromContext(context, TRAIT.NEW_GENES);
      const boon = requireEffect(newGenesProfile, 'boon', name);
      if (!boon) continue;
      buildEngineerPackets('buff', {
        at,
        source: 'engineer',
        sourceId: TRAIT.NEW_GENES,
        actorType: 'player',
        skillName: 'New Genes',
        name: 'New Genes',
        kind: String(boon.boon),
        duration: boon.duration,
        stacks: boon.stacks
      }).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
    }
  }
}

/** Morph and Evolve share protection attribution while choosing their own duration field. */
function grantHardenedChrome(context: EngineerRuntime, durationField: 'minimumStacks' | 'maximumStacks'): void {
  if (hasTrait(context.traits, TRAIT.HARDENED_CHROME)) {
    const sourceSkill = context.helpers.skillsById.get(TRAIT.HARDENED_CHROME) || {
      id: TRAIT.HARDENED_CHROME,
      name: 'Hardened Chrome'
    };
    const hardenedChromeProfile = requireBalanceProfileFromContext(context, TRAIT.HARDENED_CHROME);
    buildEngineerPackets(
      'buff',
      {
        at: context.time,
        source: 'engineer',
        sourceId: TRAIT.HARDENED_CHROME,
        actorType: 'player',
        skillName: 'Hardened Chrome',
        name: 'Hardened Chrome',
        kind: 'protection',
        duration: balanceProfileNumber(hardenedChromeProfile, durationField),
        stacks: 1
      },
      sourceSkill
    ).forEach((packet) => context.effects.emit({ kind: 'packet', event: packet }));
  }
}

/** Evolve grants strains, silently resets Morph recharge, then grants protection in that order. */
export function applyAmalgamEvolveTraits(context: EngineerRuntime, selected: Set<AmalgamMorphKind>): void {
  const state = amalgamState.from(context);
  const at = context.time;
  if (!hasTrait(context.traits, TRAIT.SILVER_LINING)) {
    for (const morphKind of selected) {
      applyAmalgamStrain(context, morphKind, at);
    }
  }

  if (hasTrait(context.traits, TRAIT.SYMBIOTIC_SYNERGY)) {
    // Evolve recharges its morph skills as part of its traited kit. This is not
    // a discrete trait proc, so the reset is applied silently. Emitting a proc
    // here misreported it as a single ~43s cooldown reduction (the summed
    // remaining recharge of the three morphs) attributed to Evolve.
    for (const skillId of state.selectedMorphSkillIds) {
      context.cooldownController.clear(skillId);
    }
  }

  grantHardenedChrome(context, 'maximumStacks');
}

/** Carbolic accepts Amalgam skill hits and the Rapacious effect, while excluding summons. */
function isAmalgamSkillHit(context: EngineerResolverContext, event: EngineerResolverEvent): boolean {
  if (event.actorType === 'summon') return false;
  // Rapacious Strain fires as an "effect" actor after player hits. Allow it
  // through so Carbolic Composition also procs on Rapacious damage.
  if (event.actorType === 'effect') {
    return event.sourceId === 'engineer.rapacious-strain';
  }

  const skill = resolverSkill(context, event.skillId);
  return Boolean(
    skill?.specialization === 'Amalgam' ||
    skill?.categories?.includes('Amalgam') ||
    skill?.categories?.includes('Morph')
  );
}

/** Eligible Amalgam and Rapacious hits apply trait-owned Poison before Rapacious checks its own proc. */
export function applyCarbolicComposition(context: EngineerResolverContext, event: EngineerResolverEvent): void {
  if (hasTrait(context, TRAIT.CARBOLIC_COMPOSITION) && isAmalgamSkillHit(context, event)) {
    const carbolicCompositionProfile = requireBalanceProfileFromContext(context, TRAIT.CARBOLIC_COMPOSITION);
    const poison = requireEffect(carbolicCompositionProfile, 'condition', 'Poisoned');
    if (poison) {
      context.effects.emit({
        kind: 'packet',
        event: buildEngineerCondition(event, {
          name: 'Carbolic Composition',
          condition: String(poison.condition),
          stacks: Number(poison.stacks),
          duration: Number(poison.duration),
          sourceId: TRAIT.CARBOLIC_COMPOSITION,
          actorType: 'effect',
          ownerActorType: 'player'
        }),
        settlement: 'reaction'
      });
    }
  }
}
