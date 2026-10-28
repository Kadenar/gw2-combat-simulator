/**
 * Owns shared Core pistol-bullet loading, consumption, and state queries.
 *
 * Each elemental pistol skill either loads its element's bullet or spends an
 * already loaded one for an enhanced payload; this module owns that flip at
 * cast completion. Skill-specific payloads live beside their declarations in `skills/weapons/pistol.ts`.
 */
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { MechanicContext, MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import type { RuntimeProfession } from '#gw2/platform/profession-definition/runtime-contract.js';
import { professionCoreState, readProfessionCoreState } from '#gw2/platform/profession-definition/state.js';
import type { ElementalistAttunement, ElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { ELEMENTALIST_ATTUNEMENTS } from '#gw2/professions/elementalist/core/state.js';
import type {
  ElementalistRuntime,
  ElementalistRuntimeState,
  ElementalistSkill
} from '#gw2/professions/elementalist/types.js';

/** Reads the completion-time bullet before the declaration's final load/spend action changes it. */
export function hasPistolBullet(
  context: MechanicQueriesOf<MechanicContext>,
  cast: RuntimeCast<ElementalistSkill>
): boolean {
  return readProfessionCoreState<ElementalistCoreState>(context.profession).pistolBullets![
    cast.skill.attunement as ElementalistAttunement
  ];
}

/** Elemental Explosion's prerequisite: one stored bullet of every element. */
export function allPistolBulletsLoaded(context: MechanicQueriesOf<ElementalistRuntime>): boolean {
  const bullets = professionCoreState(context).pistolBullets;
  return ELEMENTALIST_ATTUNEMENTS.every((element) => bullets[element]);
}

/** Elemental Explosion empties the whole stock at once rather than spending one element's bullet. */
export function spendAllPistolBullets(context: MechanicContext<ElementalistRuntimeState, ElementalistSkill>): void {
  const bullets = professionCoreState(context).pistolBullets;
  for (const element of ELEMENTALIST_ATTUNEMENTS) bullets[element] = false;
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
