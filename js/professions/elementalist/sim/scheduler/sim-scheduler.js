// Scheduler entry point: normalize rotation input, replay it step by step,
// and emit the timed event stream consumed by the resolver.
import { prepareStepExecution, dispatchPreparedStepAction } from './sim-scheduler-step.js';
import {
    ROTATION_COMMAND_TYPES,
    isRawConcurrentRotationItem,
    normalizeRotationCommands,
} from './sim-rotation-command-model.js';
import { getSkillCooldownReadyAt } from '../state/sim-cooldown-state.js';
import {
    buildNourysTickAction,
    buildThornsEnemyHitAction,
    queueRuntimeAction,
} from '../shared/sim-deferred-runtime-actions.js';

export function isConcurrentRotationItem(item) {
    return isRawConcurrentRotationItem(item);
}

export function collectConcurrentRotationItems(rotation, startIndex) {
    const concurrents = [];
    let nextIndex = startIndex + 1;

    while (nextIndex < rotation.length) {
        const nextItem = rotation[nextIndex];
        if (!isConcurrentRotationItem(nextItem)) break;
        concurrents.push({
            name: nextItem.name,
            offset: nextItem.offset,
            interruptMs: nextItem.interruptMs,
            _ri: nextIndex,
        });
        nextIndex++;
    }

    return {
        concurrents,
        nextIndex,
    };
}

export function applyGapFillBeforeRotationItem(ctx, item, name) {
    const { S } = ctx;
    if (typeof item !== 'object' || isConcurrentRotationItem(item) || !item.gapFill) return;

    ctx.advanceTimeTo(ctx.getCastUntil());
    const targetSk = ctx.skillInContext(name);
    if (!targetSk) return;

    const cdKey = ctx.cdKey(targetSk);
    const cdReady = getSkillCooldownReadyAt(S, cdKey);
    const gapMs = Math.max(0, cdReady - S.t);
    if (gapMs <= 0) return;

    const fillerName = ctx.gapFillSkills[S.att] || null;
    const fillerSk = fillerName ? ctx.skills.find(s => s.name === fillerName) : null;
    if (fillerSk) ctx.fillGap(fillerSk, gapMs);
}

export function applyGapFillBeforeCommand(ctx, command) {
    if (command.type !== ROTATION_COMMAND_TYPES.STEP || !command.gapFill) return;

    const { S } = ctx;
    ctx.advanceTimeTo(ctx.getCastUntil());
    const targetSk = ctx.skillInContext(command.name);
    if (!targetSk) return;

    const cdKey = ctx.cdKey(targetSk);
    const cdReady = getSkillCooldownReadyAt(S, cdKey);
    const gapMs = Math.max(0, cdReady - S.t);
    if (gapMs <= 0) return;

    const fillerName = ctx.gapFillSkills[S.att] || null;
    const fillerSk = fillerName ? ctx.skills.find(s => s.name === fillerName) : null;
    if (fillerSk) ctx.fillGap(fillerSk, gapMs);
}

export function executeScheduledStep(ctx, name, skipCastUntil = false, concurrents = [], rotationMeta = {}) {
    const prepared = prepareStepExecution(ctx, name, skipCastUntil, concurrents, rotationMeta);
    if (prepared.handled) return;

    dispatchPreparedStepAction(ctx, prepared, {
        name,
        skipCastUntil,
        concurrents,
        rotationMeta,
    });
}

export function scheduleRotationItem(ctx, rotation, ri) {
    const { S } = ctx;
    const item = rotation[ri];

    if (isConcurrentRotationItem(item)) {
        S._ri = ri;
        ctx.runStep(item.name, false, [], {
            interruptMs: item.interruptMs,
            waitMs: item.waitMs,
        });
        return ri + 1;
    }

    const name = typeof item === 'string' ? item : item.name;
    const { concurrents, nextIndex } = collectConcurrentRotationItems(rotation, ri);

    applyGapFillBeforeRotationItem(ctx, item, name);

    S._ri = ri;
    ctx.runStep(name, false, concurrents, {
        interruptMs: typeof item === 'object' ? item.interruptMs : undefined,
        waitMs: typeof item === 'object' ? item.waitMs : undefined,
    });
    return nextIndex;
}

export function scheduleRotationCommand(ctx, command) {
    const { S } = ctx;

    if (command.type === ROTATION_COMMAND_TYPES.CONCURRENT_STANDALONE) {
        S._ri = command.ri;
        ctx.runStep(command.name, false, [], {
            interruptMs: command.interruptMs,
            waitMs: command.waitMs,
        });
        return;
    }

    applyGapFillBeforeCommand(ctx, command);

    S._ri = command.ri;
    ctx.runStep(command.name, false, command.concurrents || [], {
        interruptMs: command.interruptMs,
        waitMs: command.waitMs,
    });
}

export function scheduleRotation(ctx, rotation) {
    if (ctx.S.activeRelic === 'Nourys' && !ctx.S.hasExplicitCombatStart) {
        queueRuntimeAction(ctx.S, buildNourysTickAction({ time: 3000 }));
    }
    if (ctx.S.activeRelic === 'Thorns' && !ctx.S.hasExplicitCombatStart) {
        queueRuntimeAction(ctx.S, buildThornsEnemyHitAction({ time: 3000 }));
    }

    const commands = normalizeRotationCommands(rotation);
    for (const command of commands) {
        scheduleRotationCommand(ctx, command);
    }

    return ctx.S.t;
}
