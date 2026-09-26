import {
  requireBalanceProfileFromContext,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { cancelledBeforeInterruptCommit } from '#gw2/platform/execution/effect-adapter.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerRuntime } from '#gw2/professions/mesmer/types.js';

/** Applies Self-Deception to categorized Deception skills after their casts complete. */
export function completeMirageSkill(context: MesmerRuntime, cast: RuntimeCast): void {
  const skill = cast.skill;
  if (cancelledBeforeInterruptCommit(skill, cast.start, cast.fullEnd, cast.effectiveEnd)) return;
  const runtime = mesmerMechanicsFor(context);
  if (
    runtime.traits.has(TRAIT.SELF_DECEPTION) &&
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
