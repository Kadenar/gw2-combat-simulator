import {
  resolveGw2Timeline,
} from "../../../platform/gw2/resolver/resolve-timeline.js";
import {
  mesmerCommonResolverEventHandlers,
  shouldSkipMesmerResolverEvent,
} from "./resolver-profile.js";
import {
  mesmerResolverEventHandlers,
} from "./event-handlers.js";
import { createRuntimeState } from "./runtime-state.js";

export function resolveScheduledStream({
  stream,
  config,
  traits,
  query,
  helpers,
}) {
  const handoff = stream?.resolverHandoff || {};
  return resolveGw2Timeline({
    stream,
    config,
    traits,
    query,
    helpers,
    createRuntimeState,
    commonHandlers: mesmerCommonResolverEventHandlers,
    professionHandlers: mesmerResolverEventHandlers,
    professionState: {
      ineptitudeReadyAt: 0,
      sharperImagesProgress: 0,
      bloodsongProgress: 0,
    },
    eventFilterState: {
      cloneDeaths: new Map(handoff.cloneDeaths || []),
    },
    shouldSkipEvent: shouldSkipMesmerResolverEvent,
  });
}
