import { amalgamState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasEngineerTrait } from '../../core/state.js';
import { emitEngineerState } from '../../core/events.js';
import { engineerBalanceEffectValue, engineerBalanceValue } from '../../core/profiles.js';
import { AMALGAM_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';
import { AMALGAM_NEW_GENES_BOONS } from './mechanics.js';
import type { SchedulerRecord, SkillId } from '../../../../platform/engine/types.js';
import type {
  EngineerCastContext,
  EngineerScheduledTask,
  EngineerSchedulerContext,
  EngineerSimulationEvent,
  EngineerSkill
} from '../../types.js';

interface AmalgamBuff {
  readonly kind: string;
  readonly duration: number;
  readonly stacks?: number;
  readonly sourceId: SkillId;
  readonly name: string;
}

interface AmalgamControl {
  readonly name: string;
  readonly controlKind: string;
  readonly duration: number;
  readonly sourceId: SkillId;
}

interface MercurialTendenciesPayload extends SchedulerRecord {
  readonly sourceSkill?: string;
}

function emitBuff(
  context: EngineerSchedulerContext,
  at: number,
  { kind, duration, stacks = 1, sourceId, name }: AmalgamBuff
): void {
  context.emit({
    type: 'buff',
    at,
    source: 'engineer',
    sourceId,
    actorType: 'player',
    skillName: name,
    name,
    kind,
    duration,
    stacks
  });
}

function emitControl(
  context: EngineerSchedulerContext,
  at: number,
  { name, controlKind, duration, sourceId }: AmalgamControl
): void {
  context.emit({
    type: 'control',
    at,
    source: 'engineer',
    sourceId,
    actorType: 'player',
    skillName: name,
    name,
    controlKind,
    duration
  });
}

function selectedMorphNames(context: EngineerSchedulerContext): Set<string> {
  return new Set(
    amalgamState
      .from(context)
      .selectedMorphSkillIds.map((id) => context.catalog.skillsById.get(Number(id))?.name)
      .filter((name): name is string => Boolean(name))
  );
}

// Maps each morph name to the strain effect granted by the Silver Lining trait
// (or, for Evolve without Silver Lining, applied for each selected morph).
// Thorns only sets a timestamp-until timer; its damage is handled via the
// resolver (Rapacious Strain ICD check) rather than emitting here.
function applyAmalgamStrain(context: EngineerSchedulerContext, morphName: string, at: number): void {
  const state = amalgamState.from(context);
  const strainDuration = engineerBalanceValue(context, PROFILE.strains, 'durationMultiplier', 8);
  if (morphName === 'Defensive Protocol: Protect') {
    emitBuff(context, at, {
      kind: 'resistance',
      duration: strainDuration,
      sourceId: 'engineer.resiliant-strain',
      name: 'Resiliant Strain'
    });
  } else if (morphName === 'Defensive Protocol: Cleanse') {
    emitBuff(context, at, {
      kind: 'alacrity',
      duration: strainDuration,
      sourceId: 'engineer.replicating-strain',
      name: 'Replicating Strain'
    });
  } else if (morphName === 'Defensive Protocol: Thorns') {
    state.rapaciousUntil = Math.max(Number(state.rapaciousUntil || 0), at + strainDuration);
  } else if (morphName === 'Offensive Protocol: Pierce') {
    emitControl(context, at, {
      name: 'Volatile Strain',
      controlKind: 'stun',
      duration: 2,
      sourceId: 'engineer.volatile-strain'
    });
  } else if (morphName === 'Offensive Protocol: Obliterate') {
    state.titanicUntil = Math.max(Number(state.titanicUntil || 0), at + strainDuration);
    emitBuff(context, at, {
      kind: 'might',
      duration: strainDuration,
      stacks: engineerBalanceValue(context, PROFILE.strains, 'maximumStacks', 10),
      sourceId: 'engineer.titanic-strain',
      name: 'Titanic Strain'
    });
  } else if (morphName === 'Offensive Protocol: Shred') {
    state.predatorUntil = Math.max(Number(state.predatorUntil || 0), at + strainDuration);
    emitBuff(context, at, {
      kind: 'quickness',
      duration: strainDuration,
      sourceId: 'engineer.predator-strain',
      name: 'Predator Strain'
    });
    emitBuff(context, at, {
      kind: 'superspeed',
      duration: strainDuration,
      sourceId: 'engineer.predator-strain',
      name: 'Predator Strain'
    });
  } else if (morphName === 'Offensive Protocol: Demolish') {
    state.berserkerUntil = Math.max(Number(state.berserkerUntil || 0), at + strainDuration);
    emitBuff(context, at, {
      kind: 'stability',
      duration: strainDuration,
      stacks: 5,
      sourceId: 'engineer.berserker-strain',
      name: 'Berserker Strain'
    });
  }
}

function assumesDamagingField(context: EngineerSchedulerContext): boolean {
  return Boolean(
    context.config.professionAssumptions?.inDamagingField ??
    context.config.assumptions?.inDamagingField ??
    context.config.inDamagingField ??
    false
  );
}

// Thorns Retaliation fires once per second for 6 s while inside a damaging
// field. Only emitted when the "inDamagingField" assumption is enabled because
// the field source and uptime cannot be inferred from the rotation alone.
function scheduleThornsRetaliation(context: EngineerCastContext, skill: EngineerSkill, at: number): void {
  if (!assumesDamagingField(context)) return;
  const hits = engineerBalanceValue(context, PROFILE.morphs, 'maximumStacks', 6);
  const interval = engineerBalanceValue(context, PROFILE.morphs, 'pulseInterval', 1);
  for (let index = 0; index < hits; index += 1) {
    context.emit({
      type: 'damage',
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

export function activateAmalgamMorph(context: EngineerCastContext, skill: EngineerSkill): void {
  const at = context.effectiveEnd;
  const state = amalgamState.from(context);
  if (skill.name === 'Defensive Protocol: Thorns') {
    state.thornsUntil = Math.max(
      state.thornsUntil,
      at + engineerBalanceValue(context, PROFILE.morphs, 'durationMultiplier', 6)
    );
    scheduleThornsRetaliation(context, skill, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.WILLING_HOST)) {
    state.willingHostUntil = Math.max(
      state.willingHostUntil,
      at + engineerBalanceValue(context, PROFILE.willingHost, 'durationMultiplier', 10)
    );
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: 'protection',
      duration: engineerBalanceValue(context, PROFILE.hardenedChrome, 'minimumStacks', 2.5),
      sourceId: TRAIT.HARDENED_CHROME,
      name: 'Hardened Chrome'
    });
  }
  if (hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    applyAmalgamStrain(context, skill.name, at);
  }
  if (hasEngineerTrait(context.config, TRAIT.NEW_GENES)) {
    emitBuff(context, at, {
      kind: 'alacrity',
      duration: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'duration', 5),
      sourceId: TRAIT.NEW_GENES,
      name: 'New Genes'
    });
    emitBuff(context, at, {
      kind: 'might',
      duration: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'duration', 12, 1),
      stacks: engineerBalanceEffectValue(context, PROFILE.newGenes, 'boon', 'stacks', 4, 1),
      sourceId: TRAIT.NEW_GENES,
      name: 'New Genes'
    });
    const extra = AMALGAM_NEW_GENES_BOONS[skill.name];
    if (extra) {
      emitBuff(context, at, {
        ...extra,
        sourceId: TRAIT.NEW_GENES,
        name: 'New Genes'
      });
    }
  }
  emitEngineerState(context, at, 'amalgam-morph');
}

export function activatePlasmaticState(context: EngineerCastContext, _skill: EngineerSkill): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // Plasmatic State is a two-phase cast. Its buff and first damage packet land
  // 640 ms into the 1,440 ms base timeline.
  const at = context.start + castDuration * (640 / 1440);
  amalgamState.from(context).plasmaticStateUntil = Math.max(
    amalgamState.from(context).plasmaticStateUntil,
    at + engineerBalanceValue(context, PROFILE.plasmaticState, 'durationMultiplier', 6)
  );
  emitEngineerState(context, at, 'plasmatic-state');
}

export function evolveAmalgam(context: EngineerCastContext): void {
  const castDuration = Math.max(0, context.fullEnd - context.start);
  // EVTC applies Evolved and all three strain buffs roughly 520 ms into the
  // measured 640 ms Quickness animation.
  const at = context.start + castDuration * (520 / 640);
  const state = amalgamState.from(context);
  const selected = selectedMorphNames(context);
  state.evolvedUntil = at + engineerBalanceValue(context, PROFILE.evolve, 'durationMultiplier', 8);

  if (!hasEngineerTrait(context.config, TRAIT.SILVER_LINING)) {
    for (const morphName of selected) {
      applyAmalgamStrain(context, morphName, at);
    }
  }
  if (hasEngineerTrait(context.config, TRAIT.SYMBIOTIC_SYNERGY)) {
    // Evolve recharges its morph skills as part of its traited kit. This is not
    // a discrete trait proc, so the reset is applied silently. Emitting a proc
    // here misreported it as a single ~43s cooldown reduction (the summed
    // remaining recharge of the three morphs) attributed to Evolve.
    for (const skillId of state.selectedMorphSkillIds) {
      context.state.cooldowns.delete(Number(skillId));
    }
  }
  if (hasEngineerTrait(context.config, TRAIT.HARDENED_CHROME)) {
    emitBuff(context, at, {
      kind: 'protection',
      duration: engineerBalanceValue(context, PROFILE.hardenedChrome, 'maximumStacks', 4),
      sourceId: TRAIT.HARDENED_CHROME,
      name: 'Hardened Chrome'
    });
  }
  emitEngineerState(context, at, 'evolve');
}

// Watches the scheduler event stream and queues a Mercurial Tendencies task for
// every control event. Summon-sourced controls (Jade Mech CC) are excluded
// because Mercurial Tendencies only procs on the player's own control effects.
export function observeAmalgamScheduledEvent(context: EngineerSchedulerContext, event: EngineerSimulationEvent): void {
  if (
    context.config.specialization !== 'Amalgam' ||
    !hasEngineerTrait(context.config, TRAIT.MERCURIAL_TENDENCIES) ||
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

// Reduces Evolve's cooldown by 2.5 s per control event (0.25 s ICD between
// procs). Works with both standard cooldown and ammo-based recharge tracking.
export function handleMercurialTendencies(
  context: EngineerSchedulerContext,
  task: EngineerScheduledTask<MercurialTendenciesPayload>
): void {
  const at = task.at;
  const coreState = professionCoreState(context);
  const readyAt = Number(coreState.traitProcReadyAt.mercurialTendencies || 0);
  if (readyAt > at + context.epsilon) return;

  let reducedBy = 0;
  const rechargeReduction = engineerBalanceValue(context, PROFILE.mercurialTendencies, 'rechargeReduction', 2.5);
  const trackedIds = new Set([...context.state.cooldowns.keys(), ...context.state.ammo.keys()]);
  for (const skillId of trackedIds) {
    const skill = context.catalog.skillsById.get(skillId);
    if (skill?.name !== 'Evolve') continue;
    if (context.state.ammo.has(skillId)) {
      reducedBy += context.cooldownController.reduceAmmoRecharge(skill, rechargeReduction, at).reducedBy;
      continue;
    }
    const cooldown = Number(context.state.cooldowns.get(skillId) || 0);
    if (cooldown <= at + context.epsilon) continue;
    const reduction = Math.min(rechargeReduction, cooldown - at);
    context.state.cooldowns.set(skillId, cooldown - reduction);
    reducedBy += reduction;
  }
  if (!(reducedBy > 0)) return;

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
