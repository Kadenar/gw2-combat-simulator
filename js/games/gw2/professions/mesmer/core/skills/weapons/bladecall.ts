import { WEAPON, ACTOR, COMBO_FINISHER } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';

/** Both Bladecall variants share projectile impacts, with fresh effects so each skill retains independent ownership. */
export function bladecallEffects(): SkillEffect[] {
  return [
    { atMs: 200, hits: 3 },
    { atMs: 2720, hits: 2 },
    { atMs: 2760, hits: 1 }
  ].flatMap(({ atMs, hits }) =>
    impactEffects({ atMs, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        coefficient: 0.25 * hits,
        hits,
        actorType: ACTOR.PLAYER,
        weapon: WEAPON.DAGGER.toLowerCase(),
        comboFinishers: [
          {
            ownerId: 'mesmer',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      }
    ])
  );
}
