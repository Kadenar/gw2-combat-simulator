import type { Skill } from '#gw2/platform/engine/types.js';
import type { Gw2ResolverEvent, Gw2ResolverHelpers } from '#gw2/platform/resolver/types.js';

/**
 * Resolves the catalog skill associated with an event. Stable ids take
 * precedence; name lookup supports older and generated event streams.
 */
export function skillForEvent(helpers: Gw2ResolverHelpers, event: Gw2ResolverEvent): Skill | undefined {
  return helpers.skillsById?.get(event.skillId ?? event.sourceId) ?? helpers.skillsByName?.get(event.skillName || '');
}
