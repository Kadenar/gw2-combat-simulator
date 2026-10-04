import { createEffectEmissionService } from '#gw2/platform/effects/emission.js';

/** Isolate mechanic payload decisions while using the real shared profile expansion and submission contract. */
export function captureEffectEmissions({ now = () => 0, submit, announce } = {}) {
  const events = [];
  const announcements = [];
  const effects = createEffectEmissionService({
    now,
    registerReaction: () => undefined,
    submit(event, delivery) {
      events.push(event);
      return submit ? submit(event, delivery) : event;
    },
    announce(request) {
      announcements.push(request);
      return announce ? announce(request) : { type: 'proc', ...request.attribution, ...request.announcement };
    }
  });
  return { effects, events, announcements };
}
