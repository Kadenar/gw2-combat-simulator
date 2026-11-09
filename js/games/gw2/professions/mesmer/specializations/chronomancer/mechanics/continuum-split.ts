/** Own Continuum entry, checkpoint restoration, and expiry so callers cannot omit lifecycle work. */
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { buildMesmerPacket } from '#gw2/professions/mesmer/core/mechanics/packets.js';
import {
  mesmerShatterCompleted,
  mesmerShatterResolved
} from '#gw2/professions/mesmer/core/mechanics/profession-actions.js';
import { mesmerSelectedShatter } from '#gw2/professions/mesmer/core/mechanics/selected-shatter.js';
import type { MesmerShatterResolution } from '#gw2/professions/mesmer/core/mechanics/shatter-types.js';
import { masterOfFragmentationDuration } from '#gw2/professions/mesmer/core/traits/illusions/index.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { mesmerShatterDefinition } from '#gw2/professions/mesmer/family-mechanics.js';
import { consumeMesmerResources } from '#gw2/professions/mesmer/shatter-lifecycle.js';
import { chronomancerState } from '#gw2/professions/mesmer/specializations/chronomancer/state.js';
import type { MesmerRuntime, MesmerRuntimeState } from '#gw2/professions/mesmer/types.js';

// Mimic and weapon swap keep their live recharge progress through either Continuum exit.
const UNAFFECTED_COOLDOWN_IDS = new Set<number>([SHARED_SKILL_IDS.SWAP_WEAPONS, ID.MIMIC]);
const EXPIRY = 'mesmer.continuum-expire';

/** Restore captured recharge once; autoattack chains continue independently of the rewind. */
function restoreContinuum(runtime: MesmerRuntime, reason: string): void {
  const chronomancer = chronomancerState.from(runtime.profession);
  const continuum = chronomancer.continuum;

  if (!continuum) return;

  const at = runtime.time;
  const { splitReady, openAt } = continuum;
  runtime.cooldownController.restoreCheckpoint(
    continuum.recharge,
    at,
    UNAFFECTED_COOLDOWN_IDS,
    splitReady ? [{ skillId: continuum.splitId, readyAt: at + splitReady - openAt }] : []
  );
  runtime.effects.emit({
    kind: 'packet',
    event: buildMesmerPacket({ type: 'marker', at, name: 'Continuum Shift', detail: reason })
  });
  chronomancer.continuum = null;
}

/** Capture clone spend and recharge before shatter rewards, then publish completion after the Split marker. */
function beginContinuumSplit(runtime: MesmerRuntime, skill: MesmerSkill, activationId: string): void {
  const durationPerSource = skillNumber(requireSkill(runtime.helpers, ID.CONTINUUM_SPLIT), 'durationPerTier');
  const bonusDuration = masterOfFragmentationDuration(runtime);
  const at = runtime.time;
  // Attribute the exact spend to its rotation entry so the timeline can show the standard shatter badge.
  const spent = consumeMesmerResources(runtime, at, { activationId });
  // Continuum selects exclusions; the shared recharge module owns pool representation and saved work.
  const recharge = runtime.cooldownController.checkpoint(at, UNAFFECTED_COOLDOWN_IDS, skill.id);
  const chronomancer = chronomancerState.from(runtime.profession);
  // Fragmentation extends the base window once, independently of the number of clones spent.
  const duration = durationPerSource * (spent + 1) + bonusDuration;
  const expiresAt = at + duration;
  chronomancer.continuum = {
    splitId: skill.id,
    splitReady: runtime.cooldownController.readyAt(skill.id),
    openAt: at,
    recharge,
    expiresAt
  };
  // Restore after same-time cast completion at -100, before ordinary cast tasks at priority 0.
  runtime.schedule(EXPIRY, expiresAt, expiresAt, undefined, -30);
  const resolution: MesmerShatterResolution = {
    skill,
    at,
    spent,
    traitHits: [{ at, count: spent + 1 }],
    delivery: {}
  };
  const definition = mesmerShatterDefinition(runtime, skill.id);
  runtime.fireTrigger(mesmerShatterResolved, {
    resolution,
    shatter: definition ? mesmerSelectedShatter(runtime.helpers, skill.id) : undefined
  });
  runtime.effects.emit({
    kind: 'packet',
    event: buildMesmerPacket({ type: 'marker', at, name: 'Continuum Split', detail: `${duration.toFixed(1)}s window` })
  });
  runtime.fireTrigger(mesmerShatterCompleted, { resolution });
}

/** Continuum Shift is castable only while Continuum Split is active. */
function continuumAvailability(context: MechanicQueriesOf<MesmerRuntime>, skill: MesmerSkill): AvailabilityResult {
  if (skill.id !== ID.CONTINUUM_SHIFT || chronomancerState.from(context.profession).continuum) {
    return { ready: true };
  }

  return {
    ready: false,
    retryAt: null,
    code: 'mesmer.continuum-inactive',
    reason: `${skill.name} requires an active Continuum Split.`
  };
}

/** Register the complete checkpoint lifecycle through the same runtime hooks used by casts and scheduled expiry. */
export const continuumLifecycle = {
  // Seed selected ammo pools so checkpoints include unused skills.
  initialize(runtime) {
    for (const skill of runtime.helpers.skills) runtime.cooldownController.ensureAmmo(skill);
  },
  availability: continuumAvailability,
  sideEffectHandlers: {
    'mesmer.chronomancer.begin-continuum'(runtime, context) {
      if (context.kind === 'cast') beginContinuumSplit(runtime, context.skill, context.cast.id);
    }
  },
  tasks: {
    [EXPIRY](runtime, data) {
      if (chronomancerState.from(runtime.profession).continuum?.expiresAt !== data) return;

      restoreContinuum(runtime, 'split expired');
    },
    'mesmer.chronomancer.restore-continuum'(runtime) {
      restoreContinuum(runtime, 'manual shift');
    }
  }
} satisfies RuntimeHooks<MesmerRuntimeState, MesmerSkill>;
