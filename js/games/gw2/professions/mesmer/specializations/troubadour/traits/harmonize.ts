import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { castWasInterrupted } from '#gw2/platform/skills/timing.js';
import { isCommittedInterruptedPhantasm } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Grants Harmonize's resource only once a phantasm has crossed its summon point. */
export function completeTroubadourPhantasm(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill as MesmerSkill;
  if (skill.resource?.mode !== 'phantasm') return;
  const interrupted = castWasInterrupted(cast);
  const completedInterruptedPhantasm = isCommittedInterruptedPhantasm(cast, skill);
  if (interrupted && !completedInterruptedPhantasm) return;

  const runtime = mesmerMechanicsFor(context);
  const harmonizeProfile = requireBalanceProfileFromContext(context, TRAIT.HARMONIZE);
  runtime.resources.queueResources(
    context.time,
    balanceProfileNumber(harmonizeProfile, 'resourceGain'),
    runtime.activePrimaryWeapon(),
    'Harmonize',
    { traitId: TRAIT.HARMONIZE, traitName: 'Harmonize' }
  );
}
