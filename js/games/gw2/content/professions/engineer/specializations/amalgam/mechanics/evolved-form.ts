import { emitSkillBuff, emitSkillControl, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { emitStateSnapshot } from '#gw2/platform/engine/events/state-snapshots.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { amalgamState } from '#gw2/content/professions/engineer/specializations/amalgam/state.js';
import { snapshotEngineerState } from '#gw2/content/professions/engineer/state.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/engineer/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '#gw2/content/professions/engineer/core/profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/engineer/specializations/amalgam/profiles.js';
import { AMALGAM_NEW_GENES_BOONS } from '#gw2/content/professions/engineer/specializations/amalgam/mechanics/new-genes.js';
import type { SchedulerRecord, SkillId } from '#gw2/platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill
} from '#gw2/content/professions/engineer/types.js';

interface AmalgamBuff {
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly sourceId: SkillId;
  readonly name: string;
}

interface MercurialTendenciesPayload extends SchedulerRecord {
  readonly sourceSkill?: string;
}

/** Resolves the equipped protocol IDs to unique Morph names for strain application. */
function selectedMorphNames(context: EngineerSchedulerContext): Set<string> {
  return new Set(
    amalgamState
      .from(context)
      .selectedMorphSkillIds.map((id) => context.catalog.skillsById.get(Number(id))?.name)
      .filter((name): name is string => Boolean(name))
  );
}

/**
 * Applies the strain mapped to a Morph name, emitting status effects immediately
 * while retaining timestamp-backed strains for later modifier and resolver checks.
 */
function applyAmalgamStrain(context: EngineerSchedulerContext, morphName: string, at: number): void {
  const state = amalgamState.from(context);
  const strainDuration = engineerBalanceValue(context, PROFILE.strains, 'durationMultiplier', 8);
  const buffs: AmalgamBuff[] = [];
  if (morphName === 'Defensive Protocol: Protect') {
    buffs.push({
      kind: 'resistance',
      duration: strainDuration,
      sourceId: 'engineer.resiliant-strain',
      name: 'Resiliant Strain'
    });
  } else if (morphName === 'Defensive Protocol: Cleanse') {
    buffs.push({
      kind: 'alacrity',
      duration: strainDuration,
      sourceId: 'engineer.replicating-strain',
      name: 'Replicating Strain'
    });
  } else if (morphName === 'Defensive Protocol: Thorns') {
    state.rapaciousUntil = Math.max(Number(state.rapaciousUntil || 0), at + strainDuration);
  } else if (morphName === 'Offensive Protocol: Pierce') {
    emitSkillControl(context, {
      at,
      source: 'engineer',
      sourceId: 'engineer.volatile-strain',
      actorType: 'player',
      skillName: 'Volatile Strain',
      name: 'Volatile Strain',
      controlKind: 'stun',
      duration: 2
    });
  } else if (morphName === 'Offensive Protocol: Obliterate') {
    state.titanicUntil = Math.max(Number(state.titanicUntil || 0), at + strainDuration);
    buffs.push({
      kind: 'might',
      duration: strainDuration,
      stacks: engineerBalanceValue(context, PROFILE.strains, 'maximumStacks', 10),
      sourceId: 'engineer.titanic-strain',
      name: 'Titanic Strain'
    });
  } else if (morphName === 'Offensive Protocol: Shred') {
    state.predatorUntil = Math.max(Number(state.predatorUntil || 0), at + strainDuration);
    buffs.push({
      kind: 'quickness',
      duration: strainDuration,
      sourceId: 'engineer.predator-strain',
      name: 'Predator Strain'
    });
    buffs.push({
      kind: 'superspeed',
      duration: strainDuration,
      sourceId: 'engineer.predator-strain',
      name: 'Predator Strain'
    });
  } else if (morphName === 'Offensive Protocol: Demolish') {
    state.berserkerUntil = Math.max(Number(state.berserkerUntil || 0), at + strainDuration);
    buffs.push({
      kind: 'stability',
      duration: strainDuration,
      stacks: 5,
      sourceId: 'engineer.berserker-strain',
      name: 'Berserker Strain'
    });
  }

  // Resolve each strain's catalog identity before direct canonical status emission.
  for (const buff of buffs) {
    const sourceSkill =
      context.catalog.skillsById.get(buff.sourceId) ||
      context.catalog.skillsByName.get(buff.name) ||
      ({ id: buff.sourceId, name: buff.name } as EngineerSkill);
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
  const hits = engineerBalanceValue(context, PROFILE.morphs, 'maximumStacks', 6);
  const interval = engineerBalanceValue(context, PROFILE.morphs, 'pulseInterval', 1);
  for (let index = 0; index < hits; index += 1) {
    emitSkillDamage(context, {
      at: at + index * interval,
      source: 'engineer',
      sourceId: skill.id,
      actorType: 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: 'Thorns Retaliation',
      coefficient: engineerBalanceEffectValue(context, PROFILE.morphs, 'strike', 'coefficient', 0.5),
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
  // Apply protocol-owned state before any trait reactions inspect the cast.
  if (skill.name === 'Defensive Protocol: Thorns') {
    state.thornsUntil = Math.max(
      state.thornsUntil,
      at + engineerBalanceValue(context, PROFILE.morphs, 'durationMultiplier', 6)
    );
    scheduleThornsRetaliation(context, skill, at);
  }

  // Resolve traits whose duration or strain depends on the chosen protocol.
  if (hasTrait(context.config, TRAIT.WILLING_HOST)) {
    state.willingHostUntil = Math.max(
      state.willingHostUntil,
      at + engineerBalanceValue(context, PROFILE.willingHost, 'durationMultiplier', 10)
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
      duration: engineerBalanceValue(context, PROFILE.hardenedChrome, 'minimumStacks', 2.5),
      stacks: 1
    });
  }

  if (hasTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, skill.name, at);
  }

  // New Genes combines universal boons with one protocol-specific boon.
  if (hasTrait(context.config, TRAIT.NEW_GENES)) {
    const buffs: AmalgamBuff[] = [
      {
        kind: 'alacrity',
        duration: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'duration', 5),
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      },
      {
        kind: 'might',
        duration: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'duration', 12, 1),
        stacks: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'stacks', 4, 1),
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      }
    ];
    const extra = AMALGAM_NEW_GENES_BOONS[skill.name];
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

  emitStateSnapshot(context, 'engineer', at, 'amalgam-morph', snapshotEngineerState(context.state.profession));
}

/** Activates Plasmatic State at its observed mid-cast packet timestamp. */
export function activatePlasmaticState(context: EngineerCastContext, _skill: EngineerSkill): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // Plasmatic State is a two-phase cast. Its buff and first damage packet land
  // 640 ms into the 1,440 ms base timeline.
  const at = context.start + castDuration * (640 / 1440);
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + engineerBalanceValue(context, PROFILE.plasmaticState, 'durationMultiplier', 6)
  );
  emitStateSnapshot(context, 'engineer', at, 'plasmatic-state', snapshotEngineerState(context.state.profession));
}

/** Activates Evolved, grants selected strains, and resolves Evolve trait interactions. */
export function evolveAmalgam(context: EngineerCastContext): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // EVTC applies Evolved and all three strain buffs roughly 520 ms into the
  // measured 640 ms Quickness animation.
  const at = context.start + castDuration * (520 / 640);
  const state = amalgamState.from(context);
  const selected = selectedMorphNames(context);
  state.evolvedUntil = at + engineerBalanceValue(context, PROFILE.evolve, 'durationMultiplier', 8);

  if (!hasTrait(context.config, TRAIT.SILVER_LINING)) {
    for (const morphName of selected) {
      applyAmalgamStrain(context, morphName, at);
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
      duration: engineerBalanceValue(context, PROFILE.hardenedChrome, 'maximumStacks', 4),
      stacks: 1
    });
  }

  emitStateSnapshot(context, 'engineer', at, 'evolve', snapshotEngineerState(context.state.profession));
}

/** Queues Mercurial Tendencies checks for player control events while excluding summon-sourced control. */
export function observeAmalgamScheduledEvent(context: EngineerSchedulerContext, event: EngineerSimulationEvent): void {
  if (
    context.config.specialization !== 'Amalgam' ||
    !hasTrait(context.config, TRAIT.MERCURIAL_TENDENCIES) ||
    event.type !== 'control' ||
    event.actorType === 'summon'
  )
    return;
  context.tasks.schedule({
    type: 'engineer.mercurial-tendencies',
    at: event.at,
    ownerId: 'engineer.mercurial-tendencies',
    payload: {
      sourceSkill: event.skillName || event.name || ''
    }
  });
}

/** Reduces every tracked Evolve recharge by the profiled amount after enforcing the trait's internal cooldown. */
export function handleMercurialTendencies(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<MercurialTendenciesPayload>
): void {
  const at = task.at;
  const coreState = professionCoreState(context);
  const readyAt = Number(coreState.traitProcReadyAt.mercurialTendencies || 0);
  if (!isInternalCooldownReady(at, readyAt)) return;

  // Find every live Evolve timer because the skill may use either cooldown or ammo recharge tracking.
  let reducedBy = 0;
  const rechargeReduction = engineerBalanceValue(context, PROFILE.mercurialTendencies, 'rechargeReduction', 2.5);
  const trackedIds = new Set([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  for (const skillId of trackedIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.name !== 'Evolve') continue;
    reducedBy += context.cooldownController.reduceSkillRecharge(skill, rechargeReduction, at);
  }

  if (!(reducedBy > 0)) return;

  // Consume the internal cooldown only when a recharge was actually reduced, then expose the aggregate payoff.
  coreState.traitProcReadyAt.mercurialTendencies =
    at + engineerBalanceValue(context, PROFILE.mercurialTendencies, 'internalCooldown', 0.25);
  context.emit({
    type: 'proc',
    at,
    source: 'Trait',
    sourceId: TRAIT.MERCURIAL_TENDENCIES,
    actorType: 'effect',
    name: 'Mercurial Tendencies',
    procType: 'trait',
    sourceSkill: task.payload?.sourceSkill || '',
    cooldownReduction: reducedBy
  });
}
