/** Owns imperative Core Mesmer Chaos trait effects. */
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { gw2ConfiguredWeaponSet } from '#gw2/platform/equipment/weapons/loadout.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { SchedulerState, SimulationEvent } from '#gw2/platform/engine/types.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/content/professions/mesmer/data/ids.js';
import { mesmerBalanceValue } from '#gw2/content/professions/mesmer/core/profiles.js';
import type {
  MesmerAddDamage,
  MesmerAddEvent,
  MesmerAddTraitProc,
  MesmerRuntime,
  MesmerRuntimeState,
  MesmerSchedulerContext,
  MesmerShatter,
  MesmerSkill,
  MesmerTraitDamage
} from '#gw2/content/professions/mesmer/types.js';

export interface MesmerIllusionaryMembraneContext {
  readonly traits: ReadonlySet<number>;
  readonly addEvent: MesmerAddEvent;
  readonly addTraitProc: MesmerAddTraitProc;
  readonly balanceProfile: MesmerRuntime['balanceProfile'];
}

interface MethodOfMadnessContext {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly traits: ReadonlySet<number>;
  readonly addDamage: MesmerAddDamage;
  readonly addTraitProc: MesmerAddTraitProc;
}

/**
 * Recharges the active weapon set's deterministic phantasm target when a
 * qualifying interrupt lands, evaluating cooldown state at the impact time.
 */
export function triggerChaoticInterruption(
  context: MesmerSchedulerContext,
  event: SimulationEvent,
  skillName: string
): void {
  const runtime = context.mesmerRuntime;
  if (!runtime?.traits.has(TRAIT.CHAOTIC_INTERRUPTION) || !context.config.target?.activatingSkills) {
    return;
  }

  const defiant = Boolean(context.config.target?.defiant);
  const core = professionCoreState(context);
  if (defiant && !isInternalCooldownReady(event.at, Number(core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] || 0))) {
    return;
  }

  const set = context.state.activeWeaponSet;
  const [configuredMainhand, configuredOffhand] = gw2ConfiguredWeaponSet(context.config, set);
  const [primaryMainhand, primaryOffhand] = gw2ConfiguredWeaponSet(context.config, 1);
  const mainhand = configuredMainhand || primaryMainhand;
  const offhand = configuredOffhand || primaryOffhand;

  let targetId: number | null = null;
  if (mainhand === 'Staff') targetId = ID.PHANTASMAL_WARLOCK;
  else if (offhand === 'Pistol') targetId = ID.PHANTASMAL_DUELIST;
  else if (offhand === 'Torch') targetId = ID.PHANTASMAL_MAGE;

  if (targetId == null) return;

  // Only affects weapon skills that are recharging.
  const readyAt = Number(context.state.cooldowns.get(targetId) || 0);
  if (!(readyAt > event.at + EPSILON)) return;
  const reduction = mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'recharge', 5);

  const reduced = Math.max(event.at, readyAt - reduction);
  if (reduced > event.at + EPSILON) {
    context.state.cooldowns.set(targetId, reduced);
  } else {
    context.state.cooldowns.delete(targetId);
  }

  if (defiant) {
    core.traitReadyAt[TRAIT.CHAOTIC_INTERRUPTION] =
      event.at + mesmerBalanceValue(context, TRAIT.CHAOTIC_INTERRUPTION, 'internalCooldown', 1);
  }

  runtime.addTraitProc(
    'Chaotic Interruption',
    event.at,
    skillName,
    `${runtime.skillsById.get(targetId)?.name || 'weapon skill'} recharge -${reduction}s`
  );
}

/** Applies Illusionary Membrane after earlier post-resolution shatter traits. */
export function triggerIllusionaryMembrane(
  context: MesmerIllusionaryMembraneContext,
  shatter: MesmerShatter | undefined,
  skillName: string,
  at: number,
  epsilon: number
): void {
  if (shatter?.slot !== 2 || !context.traits.has(TRAIT.ILLUSIONARY_MEMBRANE)) return;
  const effect = context.balanceProfile(TRAIT.ILLUSIONARY_MEMBRANE)?.effects?.find(({ type }) => type === 'buff');
  context.addEvent({
    type: 'buff',
    at: at + epsilon,
    kind: 'illusionary-membrane',
    stacks: Number(effect?.stacks || 1),
    duration: Number(effect?.duration || 15)
  });
  context.addTraitProc('Illusionary Membrane', at + epsilon, skillName);
}

/** Emits Method of Madness at the owning healing-skill completion position. */
export function triggerMethodOfMadness(
  context: MethodOfMadnessContext,
  skill: MesmerSkill,
  at: number,
  storm: MesmerTraitDamage
): void {
  if (!context.traits.has(TRAIT.METHOD_OF_MADNESS)) return;
  const readyAt = professionCoreState(context.state).traitReadyAt[TRAIT.METHOD_OF_MADNESS] || 0;
  if (!isInternalCooldownReady(at, readyAt)) return;
  const hits = Math.max(1, Math.trunc(Number(storm.hits || 1)));
  context.addDamage(
    {
      id: 'Lesser Chaos Storm',
      name: 'Lesser Chaos Storm',
      weapon: 'Utility',
      blade: false
    },
    at,
    {
      coefficient: Number(storm.coefficient || 0),
      hits,
      intervalMs: Math.max(0, Number(storm.intervalMs || 0)),
      timingAnchor: 'castStart',
      timingScale: 'fixed',
      source: 'Player',
      weapon: 'utility'
    }
  );
  context.addTraitProc('Method of Madness', at, skill.name);
  professionCoreState(context.state).traitReadyAt[TRAIT.METHOD_OF_MADNESS] = at + Number(storm.cooldown || 0);
}
