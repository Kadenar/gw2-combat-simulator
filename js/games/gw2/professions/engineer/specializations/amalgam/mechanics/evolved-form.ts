import { scheduledReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { reduceMatchingCooldowns } from '#gw2/platform/execution/cooldowns.js';
import {
  balanceProfileEffectFromContext,
  balanceProfileFromContext,
  balanceProfileValue,
  balanceProfileValueFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillBuff, emitSkillControl, emitSkillDamage } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { amalgamState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import { emitEngineerStateSnapshot } from '#gw2/professions/engineer/family-state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { effectFirstAt } from '#gw2/platform/engine/effects/materializer.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/engineer/specializations/amalgam/profiles.js';
import {
  AMALGAM_MORPH_KIND_BY_SKILL_ID,
  AMALGAM_NEW_GENES_BOONS
} from '#gw2/professions/engineer/specializations/amalgam/mechanics/new-genes.js';
import type { AmalgamMorphKind } from '#gw2/professions/engineer/specializations/amalgam/mechanics/new-genes.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type {
  EngineerCastContext,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill
} from '#gw2/professions/engineer/types.js';

interface AmalgamBuff {
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly sourceId: SkillId;
  readonly name: string;
}

interface MercurialTendenciesPayload {
  readonly sourceSkill: string;
}

const EVOLVE_SKILL_IDS = new Set<SkillId>([ID.EVOLVE_BASE, ID.EVOLVE_DOUBLE_HELIX]);

/** Resolves the equipped protocol IDs to unique stable Morph kinds for strain application. */
function selectedMorphKinds(context: EngineerSchedulerContext): Set<AmalgamMorphKind> {
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
function applyAmalgamStrain(context: EngineerSchedulerContext, morphKind: AmalgamMorphKind, at: number): void {
  const state = amalgamState.from(context);
  const profile = balanceProfileFromContext(context, PROFILE.strains);
  if (!profile) throw new Error('Missing Amalgam strain profile');
  if (morphKind === 'thorns') {
    const duration = balanceProfileFromContext(context, PROFILE.rapaciousStrain)?.durationMultiplier;
    if (typeof duration !== 'number') throw new Error('Missing Rapacious Strain duration');
    state.rapaciousUntil = Math.max(Number(state.rapaciousUntil || 0), at + duration);
  }

  // The selected packet owns its effect and duration; state windows follow their associated boon.
  for (const effect of profile.effects || []) {
    if (effect.metadata?.trigger !== morphKind) continue;
    if (!effect.sourceId || !effect.name) throw new Error('Missing Amalgam strain identity');
    if (effect.type === 'control') {
      emitSkillControl(context, {
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
      context.catalog.skillsById.get(effect.sourceId) ||
      context.catalog.skillsByName.get(effect.name) ||
      ({ id: effect.sourceId, name: effect.name } as EngineerSkill);
    emitSkillBuff(context, {
      skill: sourceSkill,
      at,
      source: 'engineer',
      sourceId: effect.sourceId,
      actorType: 'player',
      skillName: effect.name,
      name: effect.name,
      kind: String(effect.boon || effect.kind),
      duration: effect.duration,
      stacks: effect.stacks ?? 1
    });
  }
}

/** Reads the damaging-field assumption across supported configuration shapes. */
function assumesDamagingField(context: EngineerSchedulerContext): boolean {
  return Boolean(
    context.config.professionAssumptions?.inDamagingField ??
    context.config.assumptions?.inDamagingField ??
    context.config.inDamagingField ??
    false
  );
}

/** Schedules six one-second Thorns Retaliation pulses when damaging-field uptime is explicitly assumed. */
function scheduleThornsRetaliation(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (!assumesDamagingField(context)) return;
  const hits = balanceProfileValueFromContext(context, PROFILE.morphs, 'maximumStacks', 6);
  const interval = balanceProfileValueFromContext(context, PROFILE.morphs, 'pulseInterval', 1);
  for (let index = 0; index < hits; index += 1) {
    emitSkillDamage(context, {
      at: at + index * interval,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thorns Retaliation',
      coefficient: balanceProfileValue(
        balanceProfileEffectFromContext(context, PROFILE.morphs, 'strike'),
        'coefficient',
        0.5
      ),
      hits: 1,
      hitIndex: index + 1,
      totalHits: hits,
      skillWeapon: 'Unequipped'
    });
  }
}

/** Resolves a completed Morph cast, including its protocol state and selected trait payoffs. */
export function activateAmalgamMorph(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  const state = amalgamState.from(context);
  const morphKind = AMALGAM_MORPH_KIND_BY_SKILL_ID.get(skill.id);
  // Schedule the protocol's retaliation pulses before applying its trait payoffs.
  if (morphKind === 'thorns') {
    scheduleThornsRetaliation(context, skill, at);
  }

  // Resolve traits whose duration or strain depends on the chosen protocol.
  if (hasTrait(context.config, TRAIT.WILLING_HOST)) {
    state.willingHostUntil = Math.max(
      state.willingHostUntil,
      at + balanceProfileValueFromContext(context, PROFILE.willingHost, 'durationMultiplier', 10)
    );
  }

  if (hasTrait(context.config, TRAIT.HARDENED_CHROME)) {
    const sourceSkill =
      context.catalog.skillsById.get(TRAIT.HARDENED_CHROME) ||
      ({ id: TRAIT.HARDENED_CHROME, name: 'Hardened Chrome' } as EngineerSkill);
    emitSkillBuff(context, {
      skill: sourceSkill,
      at,
      source: 'engineer',
      sourceId: TRAIT.HARDENED_CHROME,
      actorType: 'player',
      skillName: 'Hardened Chrome',
      name: 'Hardened Chrome',
      kind: 'protection',
      duration: balanceProfileValueFromContext(context, PROFILE.hardenedChrome, 'minimumStacks', 2.5),
      stacks: 1
    });
  }

  if (morphKind && hasTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, morphKind, at);
  }

  // New Genes combines universal boons with one protocol-specific boon.
  if (hasTrait(context.config, TRAIT.NEW_GENES)) {
    const buffs: AmalgamBuff[] = [
      {
        kind: 'alacrity',
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.newGenes, 'boon'),
          'duration',
          5
        ),
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      },
      {
        kind: 'might',
        duration: balanceProfileValue(
          balanceProfileEffectFromContext(context, PROFILE.newGenes, 'boon', 1),
          'duration',
          12
        ),
        stacks: balanceProfileValue(balanceProfileEffectFromContext(context, PROFILE.newGenes, 'boon', 1), 'stacks', 4),
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      }
    ];
    const extra = morphKind ? AMALGAM_NEW_GENES_BOONS.get(morphKind) : undefined;
    if (extra) {
      buffs.push({
        ...extra,
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      });
    }

    const sourceSkill =
      context.catalog.skillsById.get(TRAIT.NEW_GENES) || ({ id: TRAIT.NEW_GENES, name: 'New Genes' } as EngineerSkill);
    for (const buff of buffs) {
      emitSkillBuff(context, {
        skill: sourceSkill,
        at,
        source: 'engineer',
        sourceId: buff.sourceId,
        actorType: 'player',
        skillName: buff.name,
        name: buff.name,
        kind: buff.kind,
        duration: buff.duration,
        stacks: buff.stacks ?? 1
      });
    }
  }

  emitEngineerStateSnapshot(context, at, 'amalgam-morph');
}

/** Activates Plasmatic State with its first strike. */
export function activatePlasmaticState(context: EngineerCastContext, skill: EngineerSkill): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');
  if (!strike) return;
  const timing = context.schedulerPolicy.effectTiming?.(context, skill, strike) ?? strike;
  const at = effectFirstAt(context.start, context.fullEnd, timing);
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + balanceProfileValueFromContext(context, PROFILE.plasmaticState, 'durationMultiplier', 6)
  );
  emitEngineerStateSnapshot(context, at, 'plasmatic-state');
}

/** Activates Evolved, grants selected strains, and resolves Evolve trait interactions. */
export function evolveAmalgam(context: EngineerCastContext): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // EVTC applies Evolved and all three strain buffs roughly 520 ms into the
  // measured 640 ms Quickness animation.
  const at = context.start + castDuration * (520 / 640);
  const state = amalgamState.from(context);
  const selected = selectedMorphKinds(context);
  state.evolvedUntil = at + balanceProfileValueFromContext(context, PROFILE.evolve, 'durationMultiplier', 8);

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
      context.state.cooldowns.delete(Number(skillId));
    }
  }

  if (hasTrait(context.config, TRAIT.HARDENED_CHROME)) {
    const sourceSkill =
      context.catalog.skillsById.get(TRAIT.HARDENED_CHROME) ||
      ({ id: TRAIT.HARDENED_CHROME, name: 'Hardened Chrome' } as EngineerSkill);
    emitSkillBuff(context, {
      skill: sourceSkill,
      at,
      source: 'engineer',
      sourceId: TRAIT.HARDENED_CHROME,
      actorType: 'player',
      skillName: 'Hardened Chrome',
      name: 'Hardened Chrome',
      kind: 'protection',
      duration: balanceProfileValueFromContext(context, PROFILE.hardenedChrome, 'maximumStacks', 4),
      stacks: 1
    });
  }

  emitEngineerStateSnapshot(context, at, 'evolve');
}

/** Queues Mercurial Tendencies checks for player control events while excluding summon-sourced control. */
export const mercurialTendenciesReaction = scheduledReaction<
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  MercurialTendenciesPayload
>({
  id: 'engineer.mercurial-tendencies',
  order: 20,
  select(context, event) {
    if (
      context.config.specialization !== 'Amalgam' ||
      !hasTrait(context.config, TRAIT.MERCURIAL_TENDENCIES) ||
      event.type !== 'control' ||
      event.actorType === 'summon'
    )
      return null;
    return {
      at: event.at,
      ownerId: 'engineer.mercurial-tendencies',
      payload: {
        sourceSkill: event.skillName || event.name || ''
      }
    };
    return null;
  },
  execute(context, taskAt, payload) {
    const at = taskAt;
    const coreState = professionCoreState(context);
    const readyAt = Number(coreState.traitProcReadyAt.mercurialTendencies || 0);
    if (!isInternalCooldownReady(at, readyAt)) return;

    // Find every live Evolve timer because the skill may use either cooldown or ammo recharge tracking.
    const rechargeReduction = balanceProfileValueFromContext(
      context,
      PROFILE.mercurialTendencies,
      'rechargeReduction',
      2.5
    );
    const reducedBy = reduceMatchingCooldowns(
      context,
      (skill) => EVOLVE_SKILL_IDS.has(skill.id),
      rechargeReduction,
      at
    );

    if (!(reducedBy > 0)) return;

    // Consume the internal cooldown only when a recharge was actually reduced, then expose the aggregate payoff.
    coreState.traitProcReadyAt.mercurialTendencies =
      at + balanceProfileValueFromContext(context, PROFILE.mercurialTendencies, 'internalCooldown', 0.24);
    context.emit({
      type: 'proc',
      at,
      source: 'Trait',
      sourceId: TRAIT.MERCURIAL_TENDENCIES,
      actorType: 'effect',
      name: 'Mercurial Tendencies',
      procType: 'trait',
      sourceSkill: payload.sourceSkill,
      cooldownReduction: reducedBy
    });
  }
});

/** Reduces every tracked Evolve recharge by the profiled amount after enforcing the trait's internal cooldown. */
