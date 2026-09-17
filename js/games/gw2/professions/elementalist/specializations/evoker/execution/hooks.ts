import {
  afterCast,
  onCastComplete,
  onCastStart
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';
import { initialize } from '#gw2/professions/elementalist/specializations/evoker/mechanics/resources.js';
import { onEventScheduled } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';

/**
 * Scheduler lifecycle hooks for the specialization. Ordering values interleave
 * Evoker bookkeeping with Core Elementalist handlers; `onCastComplete` runs
 * early (order 5) so familiar/charge settlement precedes Core's completion work.
 */
export const evokerSchedulerHooks = Object.freeze({
  initialize: {
    id: 'elementalist.evoker-initialize',
    order: 30,
    handler: initialize
  },
  onCastStart: {
    id: 'elementalist.evoker-start',
    order: 30,
    handler: onCastStart
  },
  afterCast: {
    id: 'elementalist.evoker-after-cast',
    order: 30,
    handler: afterCast
  },
  onCastComplete: {
    id: 'elementalist.evoker-complete',
    order: 5,
    handler: onCastComplete
  },
  onEventScheduled: {
    id: 'elementalist.evoker-charges',
    order: 30,
    handler: onEventScheduled
  }
});
