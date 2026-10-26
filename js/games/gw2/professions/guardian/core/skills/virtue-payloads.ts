import type { Skill } from '#gw2/platform/skills/types.js';

/** Triggered virtue payloads are read by their live controller, never emitted by activating the skill. */
export const triggeredVirtueEffects: NonNullable<Skill['effectVariants']>[number] = {
  when: () => true,
  transform: (_runtime, _cast, effects) => effects.filter((effect) => effect.metadata?.trigger !== 'virtue')
};
