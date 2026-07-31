/**
 * Stable application-facing scheduler facade.
 * Runtime modules import their Core or specialization-local rules directly.
 */
import { mesmerCoreSchedulerHooks } from "../core/rules.js";
import { chronomancerSchedulerHooks } from "../specializations/chronomancer/rules.js";
import { virtuosoSchedulerHooks } from "../specializations/virtuoso/rules.js";

export const mesmerSchedulerHooks = Object.freeze({
  ...mesmerCoreSchedulerHooks,
  taskHandlers: Object.freeze({
    ...mesmerCoreSchedulerHooks.taskHandlers,
    ...chronomancerSchedulerHooks.taskHandlers,
    ...virtuosoSchedulerHooks.taskHandlers,
  }),
});

export {
  advanceMesmerScheduler,
  completeMesmerCast,
  handleCloneAttackTask,
  handleExpectedProcTask,
  handleResourceGainTask,
  handleSignetEtherRelockTask,
  handleSignetIllusionsPassiveTask,
  initializeMesmerScheduler,
  mesmerCastRules,
  mesmerCoreSchedulerHooks,
  modifyMesmerMaximumAmmo,
  modifyMesmerRecharge,
  observeMesmerEvent,
  projectMesmerEndState,
  startMesmerCast,
} from "../core/rules.js";
export {
  chronomancerSchedulerHooks,
  handleContinuumExpiryTask,
} from "../specializations/chronomancer/rules.js";
export {
  handleBladeSpendTask,
  handleInfiniteForgeTask,
  virtuosoSchedulerHooks,
} from "../specializations/virtuoso/rules.js";
