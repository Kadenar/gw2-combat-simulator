import { createCooldownStateSnapshot, restoreCooldownState } from '../state/sim-cooldown-state.js';
import { restoreCombatRecordState } from '../state/sim-combat-record-state.js';
import { restoreConditionState } from '../state/sim-condition-state.js';
import { restoreReportingState } from '../state/sim-reporting-state.js';
import { createTimingWindowStateSnapshot, restoreTimingWindowState } from '../state/sim-timing-window-state.js';

export const RESOLVER_HANDOFF_KIND = 'resolver_handoff_model';
export const RESOLVER_HANDOFF_VERSION = 2;

const RESOLVER_HANDOFF_TIMING_KEYS = Object.freeze([
    't',
    'att',
    'att2',
    'attTimeline',
]);

const RESOLVER_HANDOFF_COOLDOWN_KEYS = Object.freeze([
    'traitICD',
    'sigilICD',
    'relicICD',
]);

const RESOLVER_HANDOFF_PROGRESS_KEYS = Object.freeze([
    'comboAccum',
    'permaBoons',
    'hasExplicitCombatStart',
    'combatStartTime',
    'quicknessUntil',
    'alacrityUntil',
    'endurance',
    'enduranceUpdatedAt',
]);

const RESOLVER_HANDOFF_POST_RESOLVE_KEYS = Object.freeze([
    'attEnteredAt',
    'aaCarryover',
]);

const RESOLVER_HANDOFF_SPECIALIZATION_KEYS = Object.freeze([
    'conjureEquipped',
    'conjurePickups',
    'catalystState',
    'evokerState',
    'weaveSelfUntil',
    'weaveSelfVisited',
    'perfectWeaveUntil',
    'wsFireBonusWindows',
    'wsAirBonusWindows',
    'unravelUntil',
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
]);

const RESOLVER_HANDOFF_PROC_KEYS = Object.freeze([
    'procState',
    'relicState',
    'activeRelic',
    'relicProc',
]);

function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
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
    return value;
}

function cloneKeys(source, keys) {
    const section = {};
    for (const key of keys) section[key] = cloneValue(source?.[key]);
    return section;
}

function buildCombatRecords(source) {
    const schedulerCombatState = source?.schedulerCombatState;
    if (schedulerCombatState) return cloneValue(schedulerCombatState);
    return {
        fields: cloneValue(source?.fields || []),
        auras: cloneValue(source?.auras || []),
        allCondStacks: cloneValue(source?.allCondStacks || []),
        _condMap: cloneValue(source?._condMap || new Map()),
    };
}

function buildCooldownState(source) {
    return {
        ...createCooldownStateSnapshot(source),
        ...cloneKeys(source, RESOLVER_HANDOFF_COOLDOWN_KEYS),
    };
}

function buildTimingWindowState(source) {
    return createTimingWindowStateSnapshot(source);
}

function buildConditionState(source) {
    const schedulerConditionState = source?.schedulerConditionState;
    if (schedulerConditionState) return cloneValue(schedulerConditionState);
    return {
        condState: cloneValue(source?.condState || {}),
    };
}

function buildReportingState(source) {
    const schedulerReportingState = source?.schedulerReportingState;
    if (schedulerReportingState) return cloneValue(schedulerReportingState);
    return {
        log: cloneValue(source?.log || []),
        steps: cloneValue(source?.steps || []),
        perSkill: cloneValue(source?.perSkill || {}),
    };
}

export function buildResolverHandoff(source) {
    return {
        kind: RESOLVER_HANDOFF_KIND,
        version: RESOLVER_HANDOFF_VERSION,
        timing: cloneKeys(source, RESOLVER_HANDOFF_TIMING_KEYS),
        timingWindows: buildTimingWindowState(source),
        cooldowns: buildCooldownState(source),
        progression: cloneKeys(source, RESOLVER_HANDOFF_PROGRESS_KEYS),
        specialization: cloneKeys(source, RESOLVER_HANDOFF_SPECIALIZATION_KEYS),
        procs: cloneKeys(source, RESOLVER_HANDOFF_PROC_KEYS),
        reporting: buildReportingState(source),
        combatRecords: buildCombatRecords(source),
        conditionState: buildConditionState(source),
        postResolve: cloneKeys(source, RESOLVER_HANDOFF_POST_RESOLVE_KEYS),
    };
}

function validateTimelineEntry(entry) {
    if (!isPlainObject(entry)) return 'attTimeline entry must be a plain object';
    if (!isFiniteNumber(entry.t)) return 'attTimeline entry is missing finite t';
    if (typeof entry.att !== 'string' || entry.att.length === 0) return 'attTimeline entry is missing att';
    if (entry.att2 !== undefined && entry.att2 !== null && typeof entry.att2 !== 'string') {
        return 'attTimeline entry att2 must be string or null';
    }
    return null;
}

function validateChargeStateMap(charges) {
    if (!isPlainObject(charges)) return 'cooldowns.charges must be a plain object';
    for (const [key, entry] of Object.entries(charges)) {
        if (!isPlainObject(entry)) return `cooldowns.charges.${key} must be a plain object`;
        if (!isFiniteNumber(entry.count)) return `cooldowns.charges.${key}.count must be finite`;
        if (!isFiniteNumber(entry.nextChargeAt)) return `cooldowns.charges.${key}.nextChargeAt must be finite`;
    }
    return null;
}

function validateNumericMap(value, label) {
    if (!isPlainObject(value)) return `${label} must be a plain object`;
    for (const [key, entry] of Object.entries(value)) {
        if (!isFiniteNumber(entry)) return `${label}.${key} must be finite`;
    }
    return null;
}

function validateResolverHandoff(value) {
    if (!value) return 'handoff must be present';
    if (value.kind !== RESOLVER_HANDOFF_KIND) return `expected kind ${RESOLVER_HANDOFF_KIND}`;
    if (value.version !== RESOLVER_HANDOFF_VERSION) return `expected version ${RESOLVER_HANDOFF_VERSION}`;
    if (!isPlainObject(value.timing)) return 'timing must be a plain object';
    if (!isPlainObject(value.timingWindows)) return 'timingWindows must be a plain object';
    if (!isPlainObject(value.cooldowns)) return 'cooldowns must be a plain object';
    if (!isPlainObject(value.progression)) return 'progression must be a plain object';
    if (!isPlainObject(value.specialization)) return 'specialization must be a plain object';
    if (!isPlainObject(value.procs)) return 'procs must be a plain object';
    if (!isPlainObject(value.reporting)) return 'reporting must be a plain object';
    if (!isPlainObject(value.combatRecords)) return 'combatRecords must be a plain object';
    if (!isPlainObject(value.conditionState)) return 'conditionState must be a plain object';
    if (!isPlainObject(value.postResolve)) return 'postResolve must be a plain object';

    if (!isFiniteNumber(value.timing.t)) return 'timing.t must be finite';
    if (typeof value.timing.att !== 'string' || value.timing.att.length === 0) return 'timing.att must be a string';
    if (value.timing.att2 !== null && typeof value.timing.att2 !== 'string') return 'timing.att2 must be a string or null';
    if (!Array.isArray(value.timing.attTimeline) || value.timing.attTimeline.length === 0) return 'timing.attTimeline must be a non-empty array';
    for (const entry of value.timing.attTimeline) {
        const error = validateTimelineEntry(entry);
        if (error) return error;
    }

    if (!isFiniteNumber(value.timingWindows.castUntil)) return 'timingWindows.castUntil must be finite';
    if (!isPlainObject(value.timingWindows.runtimeWindowState)) return 'timingWindows.runtimeWindowState must be a plain object';
    if (!isFiniteNumber(value.timingWindows.runtimeWindowState.arcaneEchoUntil)) return 'timingWindows.runtimeWindowState.arcaneEchoUntil must be finite';
    if (!Array.isArray(value.timingWindows.runtimeWindowState.signetFirePassiveLostWindows)) return 'timingWindows.runtimeWindowState.signetFirePassiveLostWindows must be an array';

    const attCdError = validateNumericMap(value.cooldowns.attCD, 'cooldowns.attCD');
    if (attCdError) return attCdError;
    const skillCdError = validateNumericMap(value.cooldowns.skillCD, 'cooldowns.skillCD');
    if (skillCdError) return skillCdError;
    const chargeError = validateChargeStateMap(value.cooldowns.charges);
    if (chargeError) return chargeError;
    if (!isPlainObject(value.cooldowns.chainState)) return 'cooldowns.chainState must be a plain object';
    if (!isPlainObject(value.cooldowns.chainExpiry)) return 'cooldowns.chainExpiry must be a plain object';
    const traitIcdError = validateNumericMap(value.cooldowns.traitICD, 'cooldowns.traitICD');
    if (traitIcdError) return traitIcdError;
    const sigilIcdError = validateNumericMap(value.cooldowns.sigilICD, 'cooldowns.sigilICD');
    if (sigilIcdError) return sigilIcdError;
    const relicIcdError = validateNumericMap(value.cooldowns.relicICD, 'cooldowns.relicICD');
    if (relicIcdError) return relicIcdError;

    if (!isPlainObject(value.progression.comboAccum)) return 'progression.comboAccum must be a plain object';
    if (!isPlainObject(value.progression.permaBoons)) return 'progression.permaBoons must be a plain object';
    if (typeof value.progression.hasExplicitCombatStart !== 'boolean') return 'progression.hasExplicitCombatStart must be boolean';
    if (value.progression.combatStartTime !== null && !isFiniteNumber(value.progression.combatStartTime)) {
        return 'progression.combatStartTime must be finite or null';
    }
    if (!isFiniteNumber(value.progression.quicknessUntil)) return 'progression.quicknessUntil must be finite';
    if (!isFiniteNumber(value.progression.alacrityUntil)) return 'progression.alacrityUntil must be finite';
    if (!isFiniteNumber(value.progression.endurance)) return 'progression.endurance must be finite';
    if (!isFiniteNumber(value.progression.enduranceUpdatedAt)) return 'progression.enduranceUpdatedAt must be finite';

    if (!Array.isArray(value.specialization.conjurePickups)) return 'specialization.conjurePickups must be an array';
    if (!isPlainObject(value.specialization.catalystState)) return 'specialization.catalystState must be a plain object';
    if (!isPlainObject(value.specialization.evokerState)) return 'specialization.evokerState must be a plain object';
    if (!isFiniteNumber(value.specialization.unravelUntil)) return 'specialization.unravelUntil must be finite';
    if (!(value.specialization.weaveSelfVisited instanceof Set)) return 'specialization.weaveSelfVisited must be a Set';
    if (value.specialization.wsFireBonusWindows != null && !Array.isArray(value.specialization.wsFireBonusWindows)) return 'specialization.wsFireBonusWindows must be an array';
    if (value.specialization.wsAirBonusWindows != null && !Array.isArray(value.specialization.wsAirBonusWindows)) return 'specialization.wsAirBonusWindows must be an array';
    if (!isPlainObject(value.specialization.hammerOrbs)) return 'specialization.hammerOrbs must be a plain object';
    if (!isPlainObject(value.specialization.hammerOrbGrantedBy)) return 'specialization.hammerOrbGrantedBy must be a plain object';
    if (!isPlainObject(value.specialization.hammerOrbDamageWindows)) return 'specialization.hammerOrbDamageWindows must be a plain object';
    if (!(value.specialization.hammerOrbsUsed instanceof Set)) return 'specialization.hammerOrbsUsed must be a Set';
    if (!isPlainObject(value.specialization.pistolBullets)) return 'specialization.pistolBullets must be a plain object';
    if (!isPlainObject(value.specialization._pistolBulletMapEntry)) return 'specialization._pistolBulletMapEntry must be a plain object';

    if (!isPlainObject(value.procs.procState)) return 'procs.procState must be a plain object';
    if (!isPlainObject(value.procs.relicState)) return 'procs.relicState must be a plain object';

    if (!Array.isArray(value.reporting.log)) return 'reporting.log must be an array';
    if (!Array.isArray(value.reporting.steps)) return 'reporting.steps must be an array';
    if (!isPlainObject(value.reporting.perSkill)) return 'reporting.perSkill must be a plain object';

    if (!Array.isArray(value.combatRecords.fields)) return 'combatRecords.fields must be an array';
    if (!Array.isArray(value.combatRecords.auras)) return 'combatRecords.auras must be an array';
    if (!Array.isArray(value.combatRecords.allCondStacks)) return 'combatRecords.allCondStacks must be an array';
    if (!(value.combatRecords._condMap instanceof Map)) return 'combatRecords._condMap must be a Map';

    if (!isPlainObject(value.conditionState.condState)) return 'conditionState.condState must be a plain object';
    if (!isFiniteNumber(value.postResolve.attEnteredAt)) return 'postResolve.attEnteredAt must be finite';
    if (value.postResolve.aaCarryover !== null && value.postResolve.aaCarryover !== undefined && !isPlainObject(value.postResolve.aaCarryover)) {
        return 'postResolve.aaCarryover must be a plain object or null';
    }

    return null;
}

export function isResolverHandoff(value) {
    return validateResolverHandoff(value) === null;
}

export function assertResolverHandoff(value) {
    const error = validateResolverHandoff(value);
    if (!error) return value;
    throw new Error(`Invalid resolver handoff: ${error}`);
}

function restoreSection(runState, section) {
    for (const [key, value] of Object.entries(section)) {
        runState[key] = value;
    }
}

export function bindResolverHandoffToRunState(runState, handoff) {
    const resolved = assertResolverHandoff(handoff);
    restoreSection(runState, resolved.timing);
    restoreTimingWindowState(runState, resolved.timingWindows);
    restoreCooldownState(runState, resolved.cooldowns);
    restoreSection(runState, cloneKeys(resolved.cooldowns, RESOLVER_HANDOFF_COOLDOWN_KEYS));
    restoreSection(runState, resolved.progression);
    restoreSection(runState, resolved.specialization);
    restoreSection(runState, resolved.procs);
    restoreReportingState(runState, resolved.reporting);
    restoreCombatRecordState(runState, resolved.combatRecords);
    restoreConditionState(runState, resolved.conditionState);
    // Ensure bonus-window arrays are always present (may be absent in older handoffs).
    if (!Array.isArray(runState.wsFireBonusWindows)) runState.wsFireBonusWindows = [];
    if (!Array.isArray(runState.wsAirBonusWindows))  runState.wsAirBonusWindows  = [];
    return runState;
}

export function applyResolverPostResolveState(runState, handoff) {
    const resolved = assertResolverHandoff(handoff);
    restoreSection(runState, resolved.postResolve);
    return runState;
}
