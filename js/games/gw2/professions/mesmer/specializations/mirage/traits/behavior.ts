import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { emitMirageBoon, statusFromEffect } from '#gw2/professions/mesmer/specializations/mirage/mechanics/boons.js';
import { mirageControllerFor } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import type { MesmerMirageController } from '#gw2/professions/mesmer/specializations/mirage/types.js';
import type { MesmerAmbushAttack, MesmerRuntime } from '#gw2/professions/mesmer/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

/** Cloak rewards reduce the supported shatters through the shared cooldown controller. */
function reduceDuneCloakShatters(state: MesmerRuntime, at: number, source: string): void {
  const { addTraitProc } = mesmerMechanicsFor(state);

  if (!hasTrait(state, TRAIT.DUNE_CLOAK)) return;
  for (const id of [ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION]) {
    const shatter = state.helpers.skillsById.get(id) as MesmerSkill | undefined;
    const readyAt = shatter ? state.cooldowns.get(shatter.id) : null;
    if (shatter && readyAt != null) {
      const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
      state.cooldownController.reduceSkillRecharge(
        shatter,
        balanceProfileNumber(duneCloakProfile, 'rechargeReduction'),
        at
      );
    }
  }

  addTraitProc('Dune Cloak', at, source, 'Mind Wrack and Cry of Frustration recharge reduced by 1s');
}

/** Selection gates clone ambushes before any packets or diagnostic proc are emitted. */
export function beginInfiniteHorizonAmbush(state: MesmerRuntime, at: number, count: number, weapon: string): boolean {
  const { addTraitProc } = mesmerMechanicsFor(state);
  if (!hasTrait(state, TRAIT.INFINITE_HORIZON) || !count) return false;
  addTraitProc('Infinite Horizon', at, weapon, `${count} clone${count === 1 ? '' : 's'}`);
  return true;
}

/** Resolve Regeneration, cleanse reporting, Dune Cloak recharge, then Infinite Horizon at the cloak boundary. */
export function applyMirageCloakTraits(
  state: MesmerRuntime,
  at: number,
  source: string,
  duration: number,
  executeCloneAmbushes: MesmerMirageController['executeCloneAmbushes']
): void {
  const runtime = mesmerMechanicsFor(state);
  const { addEvent, addTraitProc } = runtime;

  const renewingOasis = hasTrait(state, TRAIT.RENEWING_OASIS)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.RENEWING_OASIS), 'boon', 'regeneration')
    : undefined;
  if (renewingOasis) {
    emitMirageBoon(addEvent, at, statusFromEffect(renewingOasis), source);
    addTraitProc('Renewing Oasis', at, source, '4s regeneration');
  }

  if (hasTrait(state, TRAIT.ELUSIVE_MIND)) {
    const elusiveMindProfile = requireBalanceProfileFromContext(state, TRAIT.ELUSIVE_MIND);
    addTraitProc(
      'Elusive Mind',
      at,
      source,
      `${balanceProfileNumber(elusiveMindProfile, 'maximumStacks')} conditions removed`
    );
  }

  reduceDuneCloakShatters(state, at, source);
  if (hasTrait(state, TRAIT.INFINITE_HORIZON)) {
    mirageState.from(state).cloneAmbushUntil = canonicalTime(at + duration);
    executeCloneAmbushes(at, professionCoreState(state).clones);
  }
}

/** Accepted ambushes consume Riddle of Sand and emit Mirage Mantle before their window closes. */
export function applyMirageAmbushTraits(state: MesmerRuntime, ambush: MesmerAmbushAttack, impactAt: number): void {
  const { addEvent, addTraitProc, addCondition } = mesmerMechanicsFor(state);

  const riddleOfSand =
    mirageState.from(state).riddleOfSandReady && hasTrait(state, TRAIT.RIDDLE_OF_SAND)
      ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')
      : undefined;
  if (riddleOfSand) {
    addCondition(ambush.name, impactAt, statusFromEffect(riddleOfSand), 'Player', `${ambush.name} — Riddle of Sand`);
    addTraitProc('Riddle of Sand', impactAt, ambush.name, '2 confusion');
    mirageState.from(state).riddleOfSandReady = false;
  }

  const mirageMantle = hasTrait(state, TRAIT.MIRAGE_MANTLE)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.MIRAGE_MANTLE), 'boon', 'alacrity')
    : undefined;
  if (mirageMantle) {
    emitMirageBoon(addEvent, impactAt, statusFromEffect(mirageMantle), ambush.name, 'player', 'party');
    addTraitProc('Mirage Mantle', impactAt, ambush.name, '4s alacrity');
  }
}

/** Preserve priming, Vigor, Phantom Pain, mirrors, and Dune Cloak after the shared shatter has resolved. */
export function applyMirageShatterTraits(
  state: MesmerRuntime,
  skill: MesmerSkill,
  at: number,
  spent: number,
  grantAmbushWindow: (at: number, source: string) => void,
  createMirrors: MesmerMirageController['createMirrors'],
  grantMirageCloak: MesmerMirageController['grantMirageCloak']
): void {
  const runtime = mesmerMechanicsFor(state);
  const { addEvent, addTraitProc } = runtime;

  if (state.config.specialization !== 'Mirage') return;
  if (
    hasTrait(state, TRAIT.RIDDLE_OF_SAND) &&
    requireEffect(requireBalanceProfileFromContext(state, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion')
  ) {
    mirageState.from(state).riddleOfSandReady = true;
    addTraitProc('Riddle of Sand', at, skill.name, 'ambush primed');
  }

  const nominalEndurance = hasTrait(state, TRAIT.NOMADS_ENDURANCE)
    ? requireEffect(requireBalanceProfileFromContext(state, TRAIT.NOMADS_ENDURANCE), 'boon', 'vigor')
    : undefined;
  if (nominalEndurance) {
    emitMirageBoon(addEvent, at, statusFromEffect(nominalEndurance), skill.name);
    addTraitProc("Nomad's Endurance", at, skill.name, '3s vigor');
  }

  if (hasTrait(state, TRAIT.PHANTOM_PAIN)) {
    const phantomPainProfile = requireBalanceProfileFromContext(state, TRAIT.PHANTOM_PAIN);
    addEvent({
      type: 'buff',
      at,
      // Phantom Pain starts after the same-time shatter packets resolve.
      priority: 5,
      kind: 'phantom-pain',
      stacks: Math.min(balanceProfileNumber(phantomPainProfile, 'maximumStacks'), spent + 1),
      duration: balanceProfileNumber(phantomPainProfile, 'durationMultiplier')
    });
    addTraitProc('Phantom Pain', at, skill.name);
  }

  if (skill.id === ID.DISTORTION && hasTrait(state, TRAIT.DESERT_DISTORTION)) {
    grantAmbushWindow(at, 'Desert Distortion');
    const desertDistortionProfile = requireBalanceProfileFromContext(state, TRAIT.DESERT_DISTORTION);
    createMirrors(at, spent * balanceProfileNumber(desertDistortionProfile, 'resourceGain'));
    addTraitProc('Desert Distortion', at, skill.name, `${spent} Mirage Mirror${spent === 1 ? '' : 's'} created`);
  }

  if (
    hasTrait(state, TRAIT.DUNE_CLOAK) &&
    spent >= balanceProfileNumber(requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK), 'threshold')
  ) {
    const duneCloakProfile = requireBalanceProfileFromContext(state, TRAIT.DUNE_CLOAK);
    grantMirageCloak(at, 'Dune Cloak', {
      duration: balanceProfileNumber(duneCloakProfile, 'durationMultiplier')
    });
  }
}

/** Install clone-gain reactions and initial Riddle readiness after the Mirage controller exists. */
export function initializeMirageTraits(context: MesmerRuntime): void {
  const runtime = mesmerMechanicsFor(context);
  const mirage = mirageControllerFor(runtime);
  // Infinite Horizon reacts to Mirage-authored clone gains while the generic resource controller stays spec-agnostic.
  runtime.resources.addGainHandler(({ at, cause, createdClones }) => {
    const traitId = Number(cause.traitId);
    const triggersCloneAmbush =
      traitId === TRAIT.DECEPTIVE_EVASION ||
      (traitId === TRAIT.SELF_DECEPTION && cause.sourceSkillId === ID.ILLUSIONARY_AMBUSH);
    // Preserve the inclusive clone-gain deadline, but never treat the zero sentinel as an active cloak.
    const cloneAmbushUntil = mirageState.from(context).cloneAmbushUntil;
    if (
      triggersCloneAmbush &&
      hasTrait(context, TRAIT.INFINITE_HORIZON) &&
      cloneAmbushUntil > 0 &&
      at <= cloneAmbushUntil
    ) {
      mirage.executeCloneAmbushes(at, createdClones);
    }
  });
  // Riddle of Sand starts armed only for the active Mirage runtime and is re-armed by Mirage shatters.
  mirageState.from(context).riddleOfSandReady =
    hasTrait(context, TRAIT.RIDDLE_OF_SAND) &&
    Boolean(requireEffect(requireBalanceProfileFromContext(context, TRAIT.RIDDLE_OF_SAND), 'condition', 'Confusion'));
}

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
export function completeMirageSkill(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  const runtime = mesmerMechanicsFor(context);
  if (
    hasTrait(context, TRAIT.SELF_DECEPTION) &&
    skill.categories?.includes('Deception') &&
    runtime.actions.currentResource() > 0
  ) {
    const selfDeceptionProfile = requireBalanceProfileFromContext(context, TRAIT.SELF_DECEPTION);
    runtime.resources.queueResources(
      context.time,
      balanceProfileNumber(selfDeceptionProfile, 'resourceGain'),
      runtime.activePrimaryWeapon(),
      `Self-Deception: ${skill.name}`,
      {
        traitId: TRAIT.SELF_DECEPTION,
        traitName: 'Self-Deception',
        sourceSkillId: skill.id
      }
    );
  }
}
