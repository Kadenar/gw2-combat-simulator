import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { resolveGw2Timeline } from '#gw2/platform/resolver/resolve-timeline.js';

const profession = defineProfession({ id: 'resolver-fixture', name: 'Resolver fixture' });

/** Resolves focused streams through production setup while retaining explicit query and reaction fixtures. */
export function resolveTestGw2Stream({ professionReactions = {}, ...options }) {
  return resolveGw2Timeline({
    profession: { ...profession, eventReactions: professionReactions },
    ...options
  });
}
