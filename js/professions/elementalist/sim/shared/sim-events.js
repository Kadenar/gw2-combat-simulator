import { enqueueOrdered } from '../../../../platform/engine/event-queue.js';
import { queueFreshAirHitIntent } from '../scheduler/sim-scheduler-intent-state.js';

export const EVENT_TYPES = Object.freeze({
    HIT: 'hit',
    CONDITION_TICK: 'ctick',
    APPLY_EFFECT: 'applyEffect',
    RELIC_ACTIVATE: 'relic_activate',
    RUNTIME_ACTION: 'runtime_action',
});

export const EVENT_DEFAULT_PRIORITIES = Object.freeze({
    [EVENT_TYPES.RUNTIME_ACTION]: -1,
});

const EVENT_TYPE_SET = new Set(Object.values(EVENT_TYPES));

function isPlainObject(value) {
    if (!value || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

export function buildQueuedEvent(type, payload = {}) {
    const event = { type, ...payload };
    const defaultPriority = EVENT_DEFAULT_PRIORITIES[type];
    if (defaultPriority !== undefined && event.priority === undefined) {
        event.priority = defaultPriority;
    }
    return event;
}

export function isEventType(event, type) {
    return event?.type === type;
}

export function isHitEvent(event) {
    return isEventType(event, EVENT_TYPES.HIT);
}

export function isConditionTickEvent(event) {
    return isEventType(event, EVENT_TYPES.CONDITION_TICK);
}

export function isApplyEffectEvent(event) {
    return isEventType(event, EVENT_TYPES.APPLY_EFFECT);
}

export function isRelicActivateEvent(event) {
    return isEventType(event, EVENT_TYPES.RELIC_ACTIVATE);
}

export function isRuntimeActionEvent(event) {
    return isEventType(event, EVENT_TYPES.RUNTIME_ACTION);
}

export function isDamageWindowEvent(event) {
    return (isHitEvent(event)
        && (event.dmg > 0 || Number.isFinite(event.flatStrikeBase) || Number.isFinite(event.flatStrikePowerCoeff)))
        || isConditionTickEvent(event);
}

export function getQueuedEventValidationError(event) {
    if (!isPlainObject(event)) return 'event must be a plain object';
    if (!EVENT_TYPE_SET.has(event.type)) return `unsupported event type: ${event.type}`;
    if (!isFiniteNumber(event.time)) return `event ${event.type} is missing a finite time`;
    if (event.priority !== undefined && !isFiniteNumber(event.priority)) {
        return `event ${event.type} has a non-numeric priority`;
    }

    if (isHitEvent(event)) {
        if (typeof event.skill !== 'string' || event.skill.length === 0) return 'hit event is missing skill';
        if (!isFiniteNumber(event.hitIdx)) return `hit event ${event.skill} is missing hitIdx`;
        return null;
    }

    if (isConditionTickEvent(event)) {
        if (typeof event.cond !== 'string' || event.cond.length === 0) return 'condition tick event is missing cond';
        return null;
    }

    if (isApplyEffectEvent(event)) {
        if (typeof event.effect !== 'string' || event.effect.length === 0) return 'apply-effect event is missing effect';
        if (!isFiniteNumber(event.duration)) return `apply-effect event ${event.effect} is missing duration`;
        return null;
    }

    if (isRelicActivateEvent(event)) {
        if (typeof event.relic !== 'string' || event.relic.length === 0) return 'relic-activate event is missing relic';
        return null;
    }

    if (isRuntimeActionEvent(event)) {
        if (!isPlainObject(event.action)) return 'runtime-action event is missing action payload';
        if (typeof event.action.type !== 'string' || event.action.type.length === 0) {
            return 'runtime-action event is missing action type';
        }
        return null;
    }

    return null;
}

export function assertQueuedEvent(event, context = 'queued event') {
    const error = getQueuedEventValidationError(event);
    if (!error) return event;
    throw new Error(`Invalid ${context}: ${error}`);
}

export function buildHitEvent(event) {
    return buildQueuedEvent(EVENT_TYPES.HIT, event);
}

export function enqueueHitEvent(queue, event) {
    const queuedHit = buildHitEvent(event);
    enqueueOrdered(queue, queuedHit);
    if (queue?._schedulerIntentState) {
        queueFreshAirHitIntent(queue._schedulerIntentState, queuedHit);
    }
    return queuedHit;
}

export function buildConditionTickEvent({ time, cond }) {
    return buildQueuedEvent(EVENT_TYPES.CONDITION_TICK, { time, cond });
}

export function enqueueConditionTickEvent(queue, { time, cond }) {
    enqueueOrdered(queue, buildConditionTickEvent({ time, cond }));
}

export function buildApplyEffectEvent({ time, effect, duration }) {
    return buildQueuedEvent(EVENT_TYPES.APPLY_EFFECT, { time, effect, duration });
}

export function enqueueApplyEffectEvent(queue, event) {
    enqueueOrdered(queue, buildApplyEffectEvent(event));
}

export function buildRelicActivateEvent({ time, relic, applyEffects = true }) {
    return buildQueuedEvent(EVENT_TYPES.RELIC_ACTIVATE, { time, relic, applyEffects });
}

export function enqueueRelicActivateEvent(queue, event) {
    enqueueOrdered(queue, buildRelicActivateEvent(event));
}

export function buildRuntimeActionEvent({ time, action, priority = -1 }) {
    return buildQueuedEvent(EVENT_TYPES.RUNTIME_ACTION, { time, action, priority });
}

export function enqueueRuntimeActionEvent(queue, event) {
    enqueueOrdered(queue, buildRuntimeActionEvent(event));
}
