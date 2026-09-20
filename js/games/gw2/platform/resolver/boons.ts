import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import type { Gw2ResolverRuntime } from '#gw2/platform/resolver/runtime-state.js';
import type { Gw2ResolverEvent } from '#gw2/platform/resolver/types.js';

/** Scale a derived boon using its owner's live stats while preserving application attribution and timing. */
export function queueResolverBoon(
  context: Gw2ResolverRuntime,
  trigger: Gw2ResolverEvent,
  application: Gw2ResolverEvent & { readonly kind: string; readonly duration: number }
): void {
  context.queue.enqueue({
    ...application,
    type: 'buff',
    duration: gw2ResolverBoonDuration(context, trigger, application.kind, application.duration, application)
  });
}
