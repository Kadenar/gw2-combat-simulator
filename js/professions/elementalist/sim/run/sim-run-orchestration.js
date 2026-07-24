// High-level run lifecycle: prepare one run, switch setup/runtime phase,
// hand scheduled output to the resolver, and finalize results.
import { resolveScheduledStream } from '../resolver/sim-resolver.js';
import { enterSetupPhase, exitSetupPhase } from './sim-run-phase-state.js';
import { cloneScheduledEventStream } from '../shared/sim-scheduled-event-stream.js';

export const PREPARED_RUN_MODEL_KIND = 'prepared_run_model';
export const PREPARED_RUN_MODEL_VERSION = 1;

function isObject(value) {
    return !!value && typeof value === 'object';
}

export function buildRunInputModel(payload) {
    return { ...payload };
}

export function buildRunStateModel({ S }) {
    return { S };
}

export function buildRunResolverConfig(payload) {
    return { ...payload };
}

export function buildRunCleanupModel({ statAdj }) {
    return { statAdj };
}

export function buildPreparedRunModel({
    inputModel,
    stateModel,
    resolverConfig,
    cleanupModel,
}) {
    return {
        kind: PREPARED_RUN_MODEL_KIND,
        version: PREPARED_RUN_MODEL_VERSION,
        inputModel,
        stateModel,
        resolverConfig,
        cleanupModel,
    };
}

export function isPreparedRunModel(model) {
    return isObject(model)
        && model.kind === PREPARED_RUN_MODEL_KIND
        && model.version === PREPARED_RUN_MODEL_VERSION
        && isObject(model.inputModel)
        && isObject(model.stateModel)
        && isObject(model.stateModel.S)
        && isObject(model.resolverConfig)
        && isObject(model.cleanupModel)
        && isObject(model.cleanupModel.statAdj);
}

export function assertPreparedRunModel(model) {
    if (isPreparedRunModel(model)) return model;
    throw new Error('Invalid prepared run model: expected input/state/resolver/cleanup models');
}

export function getPreparedRunInputModel(model) {
    return assertPreparedRunModel(model).inputModel;
}

export function getPreparedRunStateModel(model) {
    return assertPreparedRunModel(model).stateModel;
}

export function getPreparedRunResolverConfig(model) {
    return assertPreparedRunModel(model).resolverConfig;
}

export function getPreparedRunCleanupModel(model) {
    return assertPreparedRunModel(model).cleanupModel;
}

export function prepareRunContext(engine, attributes, {
    startAtt,
    startAtt2,
    startEvokerElement,
    startEvokerCharges,
    startEvokerEmpowered,
    permaBoons,
    disabled,
    startPistolBullets,
    fireFieldSkills,
    catalystEnergyMax,
    conjureWeapons,
    relicProcs,
    boons,
    damagingConditions,
    sigilProcs,
    hammerDualOrbSkills,
}) {
    const disabledCtx = engine._applyDisabledStatAdjustments(attributes, disabled);
    const {
        disSigil,
        disRelic,
        disTrait,
        disFood,
        statAdj,
    } = disabledCtx;

    const basePower = attributes.Power?.final ?? 1000;
    const baseCondDmg = attributes['Condition Damage']?.final ?? 0;
    const baseCritCh = attributes['Critical Chance']?.final ?? 0;
    const critDmg = attributes['Critical Damage']?.final ?? 150;

    const sigilMuls = engine._computeSigilMuls(disSigil);
    engine._activeProcSigils = (engine.attributes.sigils || [])
        .filter(name => name !== disSigil && engine._isProcSigil(name));

    const activeRelic = (disRelic === engine.attributes.relic) ? null : (engine.attributes.relic || null);
    const relicProc = activeRelic ? (relicProcs[activeRelic] || null) : null;

    const eliteSpec = engine._getEliteSpec();
    const realStartAtt = engine._normalizeStartAttunement(startAtt);
    const realStartAtt2 = engine._normalizeSecondaryAttunement(eliteSpec, startAtt2, realStartAtt);

    const S = engine._createRunState({
        eliteSpec,
        realStartAtt,
        realStartAtt2,
        startEvokerElement,
        startEvokerCharges,
        startEvokerEmpowered,
        activeRelic,
        relicProc,
        startPistolBullets,
    });
    engine._applyRunSetupState(S, {
        disTrait,
        disFood,
        permaBoons,
        eliteSpec,
        a: attributes,
        realStartAtt2,
    });

    const inputModel = buildRunInputModel({
        startAtt,
        startAtt2,
        startEvokerElement,
        startEvokerCharges,
        startEvokerEmpowered,
        permaBoons,
        disabled,
        startPistolBullets,
        disSigil,
        disRelic,
        disTrait,
        eliteSpec,
        realStartAtt,
        realStartAtt2,
    });
    const stateModel = buildRunStateModel({ S });
    const resolverConfig = buildRunResolverConfig({
        activeRelic,
        sigilMuls,
        basePower,
        baseCondDmg,
        baseCritCh,
        critDmg,
        fireFieldSkills,
        catalystEnergyMax,
        conjureWeapons,
        relicProcs,
        boons,
        damagingConditions,
        sigilProcs,
        hammerDualOrbSkills,
        skipMight: disabled === 'Might',
        skipFury: disabled === 'Fury',
        skipVuln: disabled === 'Vulnerability',
    });
    const cleanupModel = buildRunCleanupModel({ statAdj });

    return buildPreparedRunModel({
        inputModel,
        stateModel,
        resolverConfig,
        cleanupModel,
    });
}

export function executeRunPhases(engine, runCtx, { stopAtTime, targetHP }) {
    const preparedRun = assertPreparedRunModel(runCtx);
    const { S } = getPreparedRunStateModel(preparedRun);
    const resolverConfig = getPreparedRunResolverConfig(preparedRun);

    enterSetupPhase(S);
    const scheduledStream = engine._scheduleRotation(S);
    exitSetupPhase(S);
    const { deathTime, rotationEndTime: rotEnd } = resolveScheduledStream(engine, S, scheduledStream, resolverConfig, {
        stopAtTime,
        targetHP,
    });

    return { S, rotEnd, deathTime, scheduledStream };
}

export function executeRunPhasesCapture(engine, runCtx, { stopAtTime, targetHP }) {
    const preparedRun = assertPreparedRunModel(runCtx);
    const { S } = getPreparedRunStateModel(preparedRun);
    const resolverConfig = getPreparedRunResolverConfig(preparedRun);

    enterSetupPhase(S);
    const scheduledStream = engine._scheduleRotation(S);
    exitSetupPhase(S);

    const capturedStream = cloneScheduledEventStream(scheduledStream);

    const { deathTime, rotationEndTime: rotEnd } = resolveScheduledStream(engine, S, scheduledStream, resolverConfig, {
        stopAtTime,
        targetHP,
    });

    return { S, rotEnd, deathTime, capturedStream };
}

export function executeRunPhasesWithCache(engine, runCtx, cachedStream, { stopAtTime, targetHP }) {
    const preparedRun = assertPreparedRunModel(runCtx);
    const { S } = getPreparedRunStateModel(preparedRun);
    const resolverConfig = getPreparedRunResolverConfig(preparedRun);

    const clonedStream = cloneScheduledEventStream(cachedStream);

    const { deathTime, rotationEndTime: rotEnd } = resolveScheduledStream(engine, S, clonedStream, resolverConfig, {
        stopAtTime,
        targetHP,
    });

    return { S, rotEnd, deathTime };
}

export function buildRunDamageWindow(S, rotEnd, deathTime) {
    const effectiveDmg = S.totalStrike + S.totalCond;
    const dpsStart = S.firstHitTime ?? (S.hasExplicitCombatStart
        ? (S.combatStartTime ?? 0)
        : 0);
    const effectiveEnd = deathTime !== null ? deathTime : rotEnd;
    const dpsWindowMs = Math.max(0, effectiveEnd - dpsStart);

    return {
        effectiveDmg,
        dpsWindowMs,
    };
}

export function finalizeRunResults(engine, S, rotEnd, deathTime, targetHP, { effectiveDmg, dpsWindowMs }) {
    if (engine.fastMode) {
        return engine._buildFastResults(effectiveDmg, dpsWindowMs);
    }

    if (S.log.sort) S.log.sort((a, b) => a.t - b.t);
    return engine._buildDetailedResults(S, rotEnd, dpsWindowMs, effectiveDmg, deathTime, targetHP);
}
