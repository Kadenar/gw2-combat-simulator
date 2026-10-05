import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
/**
 * Owns shared Core pistol-bullet loading, consumption, and state queries.
 *
 * Each elemental pistol skill either loads its element's bullet or spends an
 * already loaded one for an enhanced payload; this module owns that flip at
 * cast completion. Skill-specific payloads live beside their declarations in `skills/weapons/pistol.ts`.
 */
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistRuntimeState, ElementalistSkill } from '#gw2/professions/elementalist/types.js';
/** Reads the completion-time bullet before the declaration's final load/spend action changes it. */
export function hasPistolBullet(
  context: MechanicQueriesOf<MechanicContext>,
  cast: RuntimeCast<ElementalistSkill>
): boolean {
  return readProfessionCoreState<ElementalistCoreState>(context.profession).pistolBullets![
    cast.skill.attunement as ElementalistAttunement
  ];
}

/** The final declared action updates bullet stock after any skill-specific enhancement reads it. */
export const pistolBulletSideEffectHandlers: RuntimeProfession<
  ElementalistRuntimeState,
  ElementalistSkill
>['sideEffectHandlers'] = {
  'elementalist.pistol.load-or-spend'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol bullets require a cast trigger.');
    const element = trigger.skill.attunement as ElementalistAttunement;
    const state = professionCoreState(context);
    state.pistolBullets[element] = !state.pistolBullets[element];
  },
  'elementalist.pistol.load'(context, trigger) {
    if (trigger.kind !== 'cast') throw new TypeError('Pistol bullets require a cast trigger.');
    professionCoreState(context).pistolBullets[trigger.skill.attunement as ElementalistAttunement] = true;
  }
};
