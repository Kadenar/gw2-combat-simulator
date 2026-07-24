import { createCooldownStateSnapshot } from '../state/sim-cooldown-state.js';
import { createSchedulerIntentState } from './sim-scheduler-intent-state.js';
import { createTimingWindowStateSnapshot } from '../state/sim-timing-window-state.js';

export const SCHEDULER_PHASE_STATE_KIND = 'scheduler_phase_state';
export const SCHEDULER_PHASE_STATE_VERSION = 2;

const SCHEDULER_WORKING_STATE_FIXED_KEYS = Object.freeze([
    't',
    'att',
    'att2',
    'attEnteredAt',
    'comboAccum',
    'boons',
    'schedulerTimingWindowState',
    'schedulerCooldownState',
    'schedulerCombatState',
    'schedulerConditionState',
    'schedulerReportingState',
    'conjureEquipped',
    'conjurePickups',
    'catalystState',
    'evokerState',
    'weaveSelfUntil',
    'weaveSelfVisited',
    'perfectWeaveUntil',
    'wsFireBonusWindows',
    'wsAirBonusWindows',
    '_disableWeaveSelfBonuses',
    'unravelUntil',
    'hasExplicitCombatStart',
    'combatStartTime',
    'aaCarryover',
    'quicknessUntil',
    'alacrityUntil',
    'endurance',
    'enduranceUpdatedAt',
    'runPhase',
    'schedulerIntentState',
    'procState',
    'relicState',
    'sigilICD',
    'relicICD',
    'activeRelic',
    'relicProc',
    '_pendingPartialFill',
    '_pendingAACPrev',
    'permaBoons',
    'attTimeline',
    'traitICD',
    'etchingState',
    'etchingOtherCasts',
    'hammerOrbs',
    'hammerOrbGrantedBy',
    'hammerOrbDamageWindows',
    'hammerOrbLastCast',
    'hammerOrbsUsed',
    'pistolBullets',
    '_pistolBulletMapEntry',
    '_frigidFlurryProcActive',
    '_purblindingCDReduce',
    'spearNextDmgBonus',
    'spearNextCdReduce',
    'spearNextGuaranteedCrit',
    'spearNextCCHit',
    'eliteSpec',
    '_empPool',
    '_mightCondDmgBonus',
    '_furyCritBonus',
    '_ri',
]);

function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (value instanceof Map) {
        const next = new Map();
        for (const [key, entry] of value.entries()) next.set(cloneValue(key), cloneValue(entry));
        return next;
    }
    if (value instanceof Set) {
        const next = new Set();
        for (const entry of value.values()) next.add(cloneValue(entry));
        return next;
    }
    if (isPlainObject(value)) {
        const next = {};
        for (const [key, entry] of Object.entries(value)) next[key] = cloneValue(entry);
        return next;
    }
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // Fast-mode reporting placeholders carry function properties (for example noop push()).
            // Fall back to returning the original non-structured-cloneable value in those cases.
        }
    }
    return value;
}

function createSchedulerCombatState(runState) {
    return {
        fields: cloneValue(runState?.fields || []),
        auras: cloneValue(runState?.auras || []),
        allCondStacks: cloneValue(runState?.allCondStacks || []),
        _condMap: cloneValue(runState?._condMap || new Map()),
    };
}

function createSchedulerConditionState(runState) {
    return {
        condState: cloneValue(runState?.condState || {}),
    };
}

function createSchedulerReportingState(runState) {
    return {
        log: cloneValue(runState?.log || []),
        steps: cloneValue(runState?.steps || []),
        perSkill: cloneValue(runState?.perSkill || {}),
    };
}

function createSchedulerTimingWindowState(runState) {
    return createTimingWindowStateSnapshot(runState);
}

function getSchedulerWorkingStateKeys(runState) {
    const keys = new Set(SCHEDULER_WORKING_STATE_FIXED_KEYS);
    for (const key of Object.keys(runState || {})) {
        if (key.startsWith('_has')) keys.add(key);
    }
    return [...keys];
}

export function createSchedulerPhaseState(runState, {
    eventQueue = [],
} = {}) {
    const phaseState = {
        kind: SCHEDULER_PHASE_STATE_KIND,
        version: SCHEDULER_PHASE_STATE_VERSION,
        eventQueue,
        eq: eventQueue,
        schedulerTimingWindowState: createSchedulerTimingWindowState(runState),
        schedulerCooldownState: createCooldownStateSnapshot(runState),
        schedulerCombatState: createSchedulerCombatState(runState),
        schedulerConditionState: createSchedulerConditionState(runState),
        schedulerReportingState: createSchedulerReportingState(runState),
        schedulerIntentState: createSchedulerIntentState(),
    };

    for (const key of getSchedulerWorkingStateKeys(runState)) {
        if (key === 'schedulerTimingWindowState' || key === 'schedulerCooldownState' || key === 'schedulerCombatState' || key === 'schedulerConditionState' || key === 'schedulerReportingState' || key === 'schedulerIntentState') continue;
        phaseState[key] = cloneValue(runState[key]);
    }

    if (phaseState.schedulerIntentState) {
        eventQueue._schedulerIntentState = phaseState.schedulerIntentState;
    }

    if (!Array.isArray(phaseState.wsFireBonusWindows)) phaseState.wsFireBonusWindows = [];
    if (!Array.isArray(phaseState.wsAirBonusWindows))  phaseState.wsAirBonusWindows  = [];

    return phaseState;
}

export function getSchedulerPhaseEventQueue(phaseState) {
    if (!phaseState) return [];
    if (Array.isArray(phaseState.eventQueue)) return phaseState.eventQueue;
    if (Array.isArray(phaseState.eq)) return phaseState.eq;
    return [];
}

export function isSchedulerPhaseState(value) {
    return !!value
        && value.kind === SCHEDULER_PHASE_STATE_KIND
        && value.version === SCHEDULER_PHASE_STATE_VERSION;
}
