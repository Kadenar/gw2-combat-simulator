/**
 * The skill damage preview inspects one Justice burn through the emitter the selected specialization uses in combat.
 * The profession definition binds these entries per specialization, so Core hooks never import elite code.
 */
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { damageInputEvent } from '#gw2/platform/skill-damage/input-event.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import { applyJusticeBurn } from '#gw2/professions/guardian/core/mechanics/virtues.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { emitWillbenderJusticeBurn } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtues.js';
import type { GuardianRuntime, GuardianRuntimeState, GuardianSkill } from '#gw2/professions/guardian/types.js';

/** Every owner except Willbender uses the shared passive burn. */
function emitSharedPassiveBurn(runtime: GuardianRuntime, hit: Gw2ResolverEvent): void {
  applyJusticeBurn(runtime, hit, 'passive');
}

/** A runtime's specialization never changes, so its passive emitter is chosen once at composition. */
export function guardianJusticeRuntimeHooks(specialization: string): RuntimeHooks<GuardianRuntimeState, GuardianSkill> {
  const emitPassive = specialization === 'Willbender' ? emitWillbenderJusticeBurn : emitSharedPassiveBurn;

  return {
    damageEffects: [
      {
        id: 'justice-passive',
        name: 'Justice (passive)',
        source: 'Profession',
        unit: 'occurrence',
        sourceIds: ['guardian.justice-passive'],
        emit: (runtime: GuardianRuntime) => emitPassive(runtime, damageInputEvent(runtime))
      },
      {
        id: 'justice-active',
        name: 'Justice (active)',
        source: 'Profession',
        unit: 'occurrence',
        sourceIds: ['guardian.justice-active'],
        emit: (runtime: GuardianRuntime) =>
          applyJusticeBurn(runtime, damageInputEvent(runtime), 'active', requireSkill(runtime.helpers, ID.JUSTICE))
      }
    ]
  };
}
