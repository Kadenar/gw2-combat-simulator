import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitEngineerEvent } from '#gw2/professions/engineer/core/live-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import { AMALGAM_MORPH_KIND_BY_SKILL_ID } from '#gw2/professions/engineer/specializations/amalgam/mechanics/new-genes.js';
import type { AmalgamMorphKind } from '#gw2/professions/engineer/specializations/amalgam/mechanics/new-genes.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { EngineerRuntime, EngineerResolverEvent, EngineerSkill } from '#gw2/professions/engineer/types.js';

const EVOLVE_SKILL_IDS = new Set<SkillId>([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]);

/** Resolves the equipped protocol IDs to unique stable Morph kinds for strain application. */
function selectedMorphKinds(context: EngineerRuntime): Set<AmalgamMorphKind> {
  return new Set(
    amalgamState
      .from(context)
      .selectedMorphSkillIds.map((id) => AMALGAM_MORPH_KIND_BY_SKILL_ID.get(Number(id)))
      .filter((kind): kind is AmalgamMorphKind => Boolean(kind))
  );
}

/**
 * Applies the strain mapped to a Morph name, emitting status effects immediately
 * while retaining timestamp-backed strains for later modifier and resolver checks.
 */
function applyAmalgamStrain(context: EngineerRuntime, morphKind: AmalgamMorphKind, at: number): void {
  const state = amalgamState.from(context);
  const profile = requireBalanceProfileFromContext(context, PROFILE.strains);
  if (morphKind === 'thorns') {
    const rapaciousStrainProfile = requireBalanceProfileFromContext(context, PROFILE.rapaciousStrain);
    const duration = balanceProfileNumber(rapaciousStrainProfile, 'durationMultiplier');
    state.rapaciousUntil = Math.max(Number(state.rapaciousUntil || 0), at + duration);
  }

  // The selected packet owns its effect and duration; state windows follow their associated boon.
  for (const effect of profile.effects || []) {
    if (effect.metadata?.trigger !== morphKind) continue;
    if (!effect.sourceId || !effect.name) throw new Error('Missing Amalgam strain identity');
    if (effect.type === 'control') {
      emitEngineerEvent(context, 'control', {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: 'player',
        skillName: effect.name,
        name: effect.name,
        controlKind: effect.controlKind
      });
      continue;
    }

    if (effect.type !== 'boon' && effect.type !== 'buff') continue;
    if (effect.type === 'boon') {
      if (morphKind === 'obliterate')
        state.titanicUntil = Math.max(Number(state.titanicUntil || 0), at + effect.duration);
      else if (morphKind === 'shred')
        state.predatorUntil = Math.max(Number(state.predatorUntil || 0), at + effect.duration);
      else if (morphKind === 'demolish')
        state.berserkerUntil = Math.max(Number(state.berserkerUntil || 0), at + effect.duration);
    }

    // Resolve each strain's catalog identity before direct canonical status emission.
    const sourceSkill =
      context.helpers.skillsById.get(effect.sourceId) ||
      context.helpers.skillsByName.get(effect.name) ||
      ({ id: effect.sourceId, name: effect.name } as EngineerSkill);
    emitEngineerEvent(
      context,
      'buff',
      {
        at,
        source: 'engineer',
        sourceId: effect.sourceId,
        actorType: 'player',
        skillName: effect.name,
        name: effect.name,
        kind: String(effect.boon || effect.kind),
        duration: effect.duration,
        stacks: effect.stacks
      },
      sourceSkill
    );
  }
}

/** Reads the damaging-field assumption across supported configuration shapes. */
function assumesDamagingField(context: EngineerRuntime): boolean {
  return Boolean(
    context.config.professionAssumptions?.inDamagingField ??
    context.config.assumptions?.inDamagingField ??
    context.config.inDamagingField ??
    false
  );
}

/** Schedules six one-second Thorns Retaliation pulses when damaging-field uptime is explicitly assumed. */
function scheduleThornsRetaliation(context: EngineerRuntime, skill: EngineerSkill, at: number): void {
  if (!assumesDamagingField(context)) return;
  const morphsProfile = requireBalanceProfileFromContext(context, PROFILE.morphs);
  const hits = balanceProfileNumber(morphsProfile, 'maximumStacks');
  const interval = balanceProfileNumber(morphsProfile, 'pulseInterval');
  for (let index = 0; index < hits; index += 1) {
    const morphsAmalgamMorphsStrike = requireEffect(morphsProfile, 'strike', 'Amalgam Morphs');
    if (morphsAmalgamMorphsStrike) {
      emitEngineerEvent(context, 'damage', {
        at: at + index * interval,
        source: 'engineer',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name,
        name: 'Thorns Retaliation',
        coefficient: effectNumber(morphsProfile, morphsAmalgamMorphsStrike, 'coefficient'),
        hits: 1,
        hitIndex: index + 1,
        totalHits: hits,
        skillWeapon: 'Unequipped'
      });
    }
  }
}

/** Resolves a completed Morph cast, including its protocol state and selected trait payoffs. */
export function activateAmalgamMorph(context: EngineerRuntime, skill: EngineerSkill): void {
  const at = context.time;
  const state = amalgamState.from(context);
  const morphKind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id);
  // Schedule the protocol's retaliation pulses before applying its trait payoffs.
  if (morphKind === 'thorns') {
    scheduleThornsRetaliation(context, skill, at);
  }

  // Resolve traits whose duration or strain depends on the chosen protocol.
  if (hasTrait(context.config, TRAIT.WILLING_HOST)) {
    const willingHostProfile = requireBalanceProfileFromContext(context, PROFILE.willingHost);
    state.willingHostUntil = Math.max(
      state.willingHostUntil,
      at + balanceProfileNumber(willingHostProfile, 'durationMultiplier')
    );
  }

  if (hasTrait(context.config, TRAIT.HARDENED_CHROME)) {
    const sourceSkill =
      context.helpers.skillsById.get(TRAIT.HARDENED_CHROME) ||
      ({ id: TRAIT.HARDENED_CHROME, name: 'Hardened Chrome' } as EngineerSkill);
    const hardenedChromeProfile = requireBalanceProfileFromContext(context, PROFILE.hardenedChrome);
    emitEngineerEvent(
      context,
      'buff',
      {
        at,
        source: 'engineer',
        sourceId: TRAIT.HARDENED_CHROME,
        actorType: 'player',
        skillName: 'Hardened Chrome',
        name: 'Hardened Chrome',
        kind: 'protection',
        duration: balanceProfileNumber(hardenedChromeProfile, 'minimumStacks'),
        stacks: 1
      },
      sourceSkill
    );
  }

  if (morphKind && hasTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, morphKind, at);
  }

  // New Genes combines universal boons with one protocol-specific boon.
  if (hasTrait(context.config, TRAIT.NEW_GENES)) {
    // Each selected boon survives independently, including the protocol-specific packet.
    for (const name of ['alacrity', 'might', ...(morphKind ? [morphKind] : [])]) {
      const newGenesProfile = requireBalanceProfileFromContext(context, PROFILE.newGenes);
      const boon = requireEffect(newGenesProfile, 'boon', name);
      if (!boon) continue;
      emitEngineerEvent(context, 'buff', {
        at,
        source: 'engineer',
        sourceId: TRAIT.NEW_GENES,
        actorType: 'player',
        skillName: 'New Genes',
        name: 'New Genes',
        kind: String(boon.boon),
        duration: boon.duration,
        stacks: boon.stacks
      });
    }
  }
}

/** Activates Plasmatic State with its first strike. */
export function activatePlasmaticState(context: EngineerRuntime): void {
  const at = context.time;
  const plasmaticStateProfile = requireBalanceProfileFromContext(context, PROFILE.plasmaticState);
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + balanceProfileNumber(plasmaticStateProfile, 'durationMultiplier')
  );
}

/** Activates Evolved, grants selected strains, and resolves Evolve trait interactions. */
export function evolveAmalgam(context: EngineerRuntime): void {
  const at = context.time;
  const state = amalgamState.from(context);
  const selected = selectedMorphKinds(context);
  const evolveProfile = requireBalanceProfileFromContext(context, PROFILE.evolve);
  state.evolvedUntil = at + balanceProfileNumber(evolveProfile, 'durationMultiplier');

  if (!hasTrait(context.config, TRAIT.SILVER_LINING)) {
    for (const morphKind of selected) {
      applyAmalgamStrain(context, morphKind, at);
    }
  }

  if (hasTrait(context.config, TRAIT.SYMBIOTIC_SYNERGY)) {
    // Evolve recharges its morph skills as part of its traited kit. This is not
    // a discrete trait proc, so the reset is applied silently. Emitting a proc
    // here misreported it as a single ~43s cooldown reduction (the summed
    // remaining recharge of the three morphs) attributed to Evolve.
    for (const skillId of state.selectedMorphSkillIds) {
      context.cooldownController.clear(Number(skillId));
    }
  }

  if (hasTrait(context.config, TRAIT.HARDENED_CHROME)) {
    const sourceSkill =
      context.helpers.skillsById.get(TRAIT.HARDENED_CHROME) ||
      ({ id: TRAIT.HARDENED_CHROME, name: 'Hardened Chrome' } as EngineerSkill);
    const hardenedChromeProfile = requireBalanceProfileFromContext(context, PROFILE.hardenedChrome);
    emitEngineerEvent(
      context,
      'buff',
      {
        at,
        source: 'engineer',
        sourceId: TRAIT.HARDENED_CHROME,
        actorType: 'player',
        skillName: 'Hardened Chrome',
        name: 'Hardened Chrome',
        kind: 'protection',
        duration: balanceProfileNumber(hardenedChromeProfile, 'maximumStacks'),
        stacks: 1
      },
      sourceSkill
    );
  }
}

/** Successful player control advances Evolve recharge once per internal cooldown. */
export function reactToMercurialTendencies(context: EngineerRuntime, event: EngineerResolverEvent): void {
  if (!hasTrait(context.config, TRAIT.MERCURIAL_TENDENCIES) || event.actorType === 'summon') return;
  const at = event.at;
  const core = professionCoreState(context);
  if (!isInternalCooldownReady(at, Number(core.traitProcReadyAt.mercurialTendencies || 0))) return;
  const profile = requireBalanceProfileFromContext(context, PROFILE.mercurialTendencies);
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
  core.traitProcReadyAt.mercurialTendencies = at + balanceProfileNumber(profile, 'internalCooldown');
  emitEngineerEvent(context, 'proc', {
    at,
    source: 'Trait',
    sourceId: TRAIT.MERCURIAL_TENDENCIES,
    actorType: 'effect',
    name: 'Mercurial Tendencies',
    procType: 'trait',
    sourceSkill: event.skillName || event.name,
    cooldownReduction: reducedBy
  });
}
