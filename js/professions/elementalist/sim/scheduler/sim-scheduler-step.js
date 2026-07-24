import {
    handleBundleStepCommand,
    applyPreludeStateRules,
    validateTailoredVictory,
    validateConjureWeaponRequirements,
    detectAACarryoverSkill,
    validateAttunementAccess,
    validateEnduranceAccess,
    validateChainAccess,
    validateEtchingAccess,
    applyHammerPreludeRules,
} from './sim-step-rules.js';
import { buildCastWindow, runConcurrentSteps } from './sim-cast-window.js';
import {
    prepareStandardSkillAvailability,
    prepareStandardHitScheduling,
    finishStandardHitScheduling,
    finalizeStandardSkillBookkeeping,
} from './sim-cast-cooldowns.js';
import { applyStandardCastProgression, armSpearEtchingOnCastStart } from './sim-cast-followups.js';

export const STEP_ACTIONS = Object.freeze({
    SWAP: 'swap',
    OVERLOAD: 'overload',
    JADE_SPHERE: 'jade_sphere',
    FAMILIAR: 'familiar',
    STANDARD_CAST: 'standard_cast',
});

export function prepareStepExecution(ctx, name, skipCastUntil, concurrents, rotationMeta = {}) {
    const { S } = ctx;
    if (!skipCastUntil) ctx.advanceTimeTo(ctx.getCastUntil());

    if (handleBundleStepCommand(ctx, name, rotationMeta)) {
        return { handled: true };
    }

    const sk = ctx.skillInContext(name);
    if (!sk) {
        ctx.log({ t: S.t, type: 'err', msg: `Unknown: ${name}` });
        return { handled: true };
    }

    applyPreludeStateRules(ctx);

    if (!validateTailoredVictory(ctx, name)) {
        return { handled: true };
    }

    if (sk.type === 'Attunement' && !sk.name.startsWith('Overload')) {
        return {
            handled: false,
            actionType: STEP_ACTIONS.SWAP,
            sk,
        };
    }

    if (sk.name.startsWith('Overload')) {
        return {
            handled: false,
            actionType: STEP_ACTIONS.OVERLOAD,
            sk,
        };
    }

    if (!validateConjureWeaponRequirements(ctx, sk, name)) {
        return { handled: true };
    }

    if (sk.type === 'Jade Sphere') {
        return {
            handled: false,
            actionType: STEP_ACTIONS.JADE_SPHERE,
            sk,
        };
    }

    if (sk.type === 'Familiar') {
        return {
            handled: false,
            actionType: STEP_ACTIONS.FAMILIAR,
            sk,
        };
    }

    const isAACarryover = detectAACarryoverSkill(ctx, sk, name);

    if (!validateAttunementAccess(ctx, sk, name, isAACarryover)) {
        return { handled: true };
    }

    if (!validateEnduranceAccess(ctx, sk, name)) {
        return { handled: true };
    }

    if (!validateChainAccess(ctx, sk, name)) {
        return { handled: true };
    }

    if (!validateEtchingAccess(ctx, name)) {
        return { handled: true };
    }

    if (!applyHammerPreludeRules(ctx, sk, name)) {
        return { handled: true };
    }

    return {
        handled: false,
        actionType: STEP_ACTIONS.STANDARD_CAST,
        sk,
        isAACarryover,
        rotationMeta,
    };
}

export function executeStandardSkillCast(ctx, sk, name, {
    concurrents,
    isAACarryover,
    rotationMeta,
}) {
    const { S } = ctx;
    const key = ctx.cdKey(sk);
    prepareStandardSkillAvailability(ctx, sk, key);

    const baseWindow = buildCastWindow(ctx, sk, S.t);
    const configuredInterruptMs = rotationMeta?.interruptMs;
    const hasInterrupt = Number.isFinite(configuredInterruptMs)
        && configuredInterruptMs >= 1
        && configuredInterruptMs < baseWindow.castMs;
    const castMs = hasInterrupt ? configuredInterruptMs : baseWindow.castMs;
    const scaleOff = baseWindow.scaleOff;
    const start = baseWindow.start;
    const end = start + castMs;

    if ((sk.endurance || 0) < 0) {
        ctx.spendEndurance(Math.abs(sk.endurance), start);
    }

    ctx.beginCast(name, start, castMs);
    prepareStandardHitScheduling(ctx, name);
    if (name !== 'Grand Finale') ctx.scheduleHits(sk, start, scaleOff, hasInterrupt ? end : null);
    finishStandardHitScheduling(ctx);
    if (!hasInterrupt) {
        ctx.trackField(sk, end);
        ctx.trackAura(sk, end);
    }

    armSpearEtchingOnCastStart(ctx, sk, name, start);

    runConcurrentSteps(ctx, concurrents, {
        anchorTime: start,
        restoreTime: start,
        clampToAnchor: true,
    });

    ctx.finishCast(name, end, { setCastUntil: castMs > 0 });
    finalizeStandardSkillBookkeeping(ctx, sk, name, {
        key,
        start,
        end,
        castMs,
        isAACarryover,
        interrupted: hasInterrupt,
        interruptMs: hasInterrupt ? configuredInterruptMs : undefined,
        fullCastMs: baseWindow.castMs,
    });

    return {
        key,
        start,
        end,
        castMs,
        scaleOff,
        interrupted: hasInterrupt,
        interruptMs: hasInterrupt ? configuredInterruptMs : undefined,
        fullCastMs: baseWindow.castMs,
    };
}

export function dispatchPreparedStepAction(ctx, prepared, {
    name,
    skipCastUntil = false,
    concurrents = [],
    rotationMeta = {},
}) {
    const { sk } = prepared;
    switch (prepared.actionType) {
    case STEP_ACTIONS.SWAP:
        ctx.doSwap(sk, skipCastUntil, concurrents);
        return;
    case STEP_ACTIONS.OVERLOAD:
        ctx.doOverload(sk, concurrents);
        return;
    case STEP_ACTIONS.JADE_SPHERE:
        ctx.doJadeSphere(sk, concurrents);
        return;
    case STEP_ACTIONS.FAMILIAR:
        ctx.doFamiliar(sk, concurrents);
        return;
    case STEP_ACTIONS.STANDARD_CAST: {
        const castCtx = executeStandardSkillCast(ctx, sk, name, {
            concurrents,
            isAACarryover: !!prepared.isAACarryover,
            rotationMeta: prepared.rotationMeta || rotationMeta,
        });
        if (!castCtx.interrupted) applyStandardCastProgression(ctx, sk, name, castCtx);
        return;
    }
    default:
        ctx.log({ t: ctx.S.t, type: 'err', msg: `Unknown scheduled action: ${prepared.actionType || 'none'}` });
    }
}
