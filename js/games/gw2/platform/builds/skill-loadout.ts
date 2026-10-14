import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { SkillId } from '#gw2/platform/skills/types.js';

/** Build facts shared by headless calculations and presentation; empty slots retain their positions. */
export interface ResolvedSkillLoadout {
  readonly activeBarId: string;
  readonly bars: readonly {
    readonly id: string;
    readonly skillIds: readonly (SkillId | null)[];
  }[];
}

/** Ordinary builds select five independent skills, with no presentation or runtime state involved. */
export function resolveSelectedSkillLoadout(build: Readonly<Gw2CanonicalBuild>): ResolvedSkillLoadout {
  return {
    activeBarId: 'selected',
    bars: [
      {
        id: 'selected',
        skillIds: ['Heal', 'Utility1', 'Utility2', 'Utility3', 'Elite'].map(
          (slot) => build.selectedSkillIds[slot] ?? null
        )
      }
    ]
  };
}
