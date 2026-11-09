import { elementalistHammerOrbLifecycle } from '#gw2/professions/elementalist/core/mechanics/hammer-orbs.js';

/** Commit a selected orb grant at an exact scheduler phase without bypassing its registered handler. */
export function commitHammerOrbFixture(runtime, skillId, activationId) {
  const skill = runtime.helpers.skillsById.get(skillId);

  if (!skill) throw new TypeError(`Unknown orb fixture skill ${skillId}.`);

  elementalistHammerOrbLifecycle.sideEffectHandlers['elementalist.create-hammer-orbs'](runtime.mechanics, {
    kind: 'cast',
    skill,
    cast: { id: activationId, effectiveEnd: runtime.time, skill, command: {} }
  });
}
