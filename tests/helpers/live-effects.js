import { createLiveEffects } from '#gw2/platform/combat/live-effects.js';

/** Seed focused query fixtures through accepted grants, including explicit recipient histories. */
export function createTestLiveEffects(grants = [], config = {}) {
  const effects = createLiveEffects(config);
  for (const [kind, applications] of grants)
    for (const application of applications) grantTestEffect(effects, { ...application, kind });
  return effects;
}

/** Convert a test window into a complete accepted packet without exposing storage. */
export function grantTestEffect(effects, application) {
  const audience = application.resolvedAudience;
  effects.grant({
    ...application.event,
    ...application,
    type: 'buff',
    kind: application.kind,
    duration: application.duration ?? application.expiresAt - application.at,
    ...(audience
      ? {
          resolvedAudience: {
            includesSelf: false,
            includesSummons: false,
            alliedPlayerCount: 0,
            companionIds: [],
            recipientCount:
              Number(audience.includesSelf ?? false) +
              (audience.alliedPlayerCount ?? 0) +
              (audience.companionIds?.length ?? 0),
            ...audience
          }
        }
      : {})
  });
}
