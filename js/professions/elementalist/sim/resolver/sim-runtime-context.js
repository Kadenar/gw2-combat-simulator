import { buildHitResolutionContext, applyResolvedHit } from './sim-hit-resolution.js';
import { canTriggerShatteringIceProc, queueShatteringIceProc, shouldSkipHammerOrbHit } from './sim-hit-trigger-rules.js';
import { applyCondition } from './sim-condition-resolution.js';
import { applyBoonExtension, trackEffect, grantElementalEmpowerment } from '../mechanics/sim-effect-state.js';
import { procHit } from './sim-hit-application.js';
import { grantPersistingFlames, triggerLightningRod, checkRagingStorm, checkFreshAir } from '../mechanics/sim-elemental-traits.js';
import {
    checkOnCritSigils,
    procOnCcSigils,
    checkBurningPrecision,
    checkArcanePrecision,
    checkRenewingStamina,
    checkFoodCritProc,
} from '../mechanics/sim-crit-sigil-helpers.js';
import { applyAura } from '../mechanics/sim-field-aura-combo.js';
import { grantEmpoweringAuras, applyOnAuraGainEffects as runAuraGainEffects } from '../mechanics/sim-aura-effects.js';
import { checkCombo } from '../mechanics/sim-combo-resolution.js';
import { getRelicStrikeMultiplier, checkRelicOnHit, trackBlightbringerPoison, checkBloodstoneBlast } from '../mechanics/sim-relic-helpers.js';
import { pushTimedStack } from '../state/sim-runtime-state.js';
import { gainEndurance } from '../state/sim-endurance-state.js';
import { attunementAt, secondaryAttunementAt, mightStacksAt, vulnerabilityStacksAt, hasFuryAt, effectStacksAt } from '../shared/sim-state-queries.js';
import { applyPrimordialStance } from '../scheduler/sim-timeline-scheduling.js';
import { getEmpowermentMultiplier } from '../mechanics/sim-effect-state.js';
import { ensurePerSkillEntry } from '../shared/sim-stat-recharge-helpers.js';
import { pushReportingLog, pushReportingStep } from '../state/sim-reporting-state.js';
import {
    enqueueHitEvent,
    enqueueRelicActivateEvent,
    enqueueApplyEffectEvent,
    enqueueConditionTickEvent,
    enqueueRuntimeActionEvent,
} from '../shared/sim-events.js';
import {
    addCatalystEnergy,
    addEvokerCharges,
    incrementEvokerElemBalance,
} from '../state/sim-specialization-state.js';
import {
    getTraitIcd,
    setTraitIcd,
    isTraitIcdReady,
    armTraitIcd,
    getRelicIcd,
    setRelicIcd,
    isRelicIcdReady,
    armRelicIcd,
    getSigilIcd,
    setSigilIcd,
    isSigilIcdReady,
    armSigilIcd,
} from '../state/sim-icd-state.js';
import {
    getArcaneEchoUntil,
    setArcaneEchoUntil,
    armArcaneEchoWindow,
    clearArcaneEchoWindow,
    isArcaneEchoActive,
    addSignetFirePassiveLostWindow,
    isSignetFirePassiveLost,
} from '../state/sim-timing-window-state.js';

function queueRuntimeHitEvent(queue, event) {
    return enqueueHitEvent(queue, event);
}

function queueRuntimeRelicActivateEvent(queue, event) {
    return enqueueRelicActivateEvent(queue, event);
}

function queueRuntimeApplyEffectEvent(queue, event) {
    return enqueueApplyEffectEvent(queue, event);
}

function queueRuntimeConditionTickEvent(queue, event) {
    return enqueueConditionTickEvent(queue, event);
}

function queueRuntimeActionRecord(queue, action, { priority = -1 } = {}) {
    return enqueueRuntimeActionEvent(queue, {
        time: action.time,
        priority,
        action,
    });
}

export function createRuntimeContext(engine, S, config = {}) {
    const conjureWeapons = config.conjureWeapons || new Set();
    const eventQueue = config.eventQueue || S.eq;
    return {
        engine,
        S,
        ...config,
        conjureWeapons,
        eventQueue,
        activeProcSigils: engine._activeProcSigils || [],

        log(entry) {
            return pushReportingLog(S, entry);
        },

        addStep(entry) {
            return pushReportingStep(S, entry);
        },

        queueHitEvent(event) {
            return queueRuntimeHitEvent(eventQueue, event);
        },

        queueRelicActivateEvent(event) {
            return queueRuntimeRelicActivateEvent(eventQueue, event);
        },

        queueApplyEffectEvent(event) {
            return queueRuntimeApplyEffectEvent(eventQueue, event);
        },

        queueConditionTickEvent(event) {
            return queueRuntimeConditionTickEvent(eventQueue, event);
        },

        queueRuntimeActionEvent(action, options = {}) {
            return queueRuntimeActionRecord(eventQueue, action, options);
        },

        pushCondStack(entry) {
            return pushTimedStack(S, entry);
        },

        trackEffect(effect, stacks, durSec, time) {
            return trackEffect(engine, S, effect, stacks, durSec, time, {
                boons: config.boons,
                relicProcs: config.relicProcs,
                log: entry => this.log(entry),
                pushCondStack: entry => this.pushCondStack(entry),
                gainEndurance: (amount, at) => gainEndurance(S, amount, at),
            });
        },

        applyCondition(cond, stacks, durSec, time, skillName, castStart = null, extraCondDurPct = 0) {
            return applyCondition(engine, S, cond, stacks, durSec, time, skillName, castStart, extraCondDurPct, {
                relicProcs: config.relicProcs,
                boons: config.boons,
                damagingConditions: config.damagingConditions,
                queueConditionTick: event => this.queueConditionTickEvent(event),
            });
        },

        isDamagingCondition(cond) {
            return config.damagingConditions.has(cond);
        },

        getRelicProc(name) {
            return config.relicProcs[name] || null;
        },

        getSigilProc(name) {
            return config.sigilProcs[name] || null;
        },

        canTriggerShatteringIceProc(ev) {
            return canTriggerShatteringIceProc(S, ev);
        },

        queueShatteringIceProc(ev) {
            return queueShatteringIceProc(S, ev, {
                queueHit: hitEvent => this.queueHitEvent(hitEvent),
            });
        },

        shouldSkipHammerOrbHit(ev) {
            return shouldSkipHammerOrbHit(S, ev, {
                hammerDualOrbSkills: config.hammerDualOrbSkills,
            });
        },

        checkOnCritSigils(time, critChancePct) {
            return checkOnCritSigils(this, time, critChancePct);
        },

        procOnCcSigils(time) {
            return procOnCcSigils(this, time);
        },

        checkBurningPrecision(time, critChancePct) {
            return checkBurningPrecision(this, time, critChancePct);
        },

        checkRagingStorm(time, critChancePct) {
            return checkRagingStorm(this, time, critChancePct);
        },

        checkFreshAir(time, critChancePct) {
            return checkFreshAir(this, time, critChancePct);
        },

        checkArcanePrecision(time, critChancePct, attunement) {
            return checkArcanePrecision(this, time, critChancePct, attunement);
        },

        checkRenewingStamina(time, critChancePct) {
            return checkRenewingStamina(this, time, critChancePct);
        },

        checkFoodCritProc(time, critChancePct) {
            return checkFoodCritProc(this, time, critChancePct);
        },

        triggerLightningRod(time) {
            return triggerLightningRod(this, time);
        },

        grantEmpoweringAuras(time) {
            return grantEmpoweringAuras(this, time);
        },

        applyOnAuraGainEffects(time) {
            return runAuraGainEffects(this, time);
        },

        applyAura(auraName, durMs, time, skill, opts = {}) {
            return applyAura(engine, S, auraName, durMs, time, skill, {
                ...opts,
                boons: config.boons,
                relicProcs: config.relicProcs,
                runtimeActionTarget: this,
                log: entry => this.log(entry),
                pushCondStack: entry => this.pushCondStack(entry),
            });
        },

        grantElemEmpowerment(stacks, time, source) {
            return grantElementalEmpowerment(this, stacks, time, source);
        },

        checkCombo(ev) {
            return checkCombo(this, ev);
        },

        checkRelicOnHit(ev) {
            return checkRelicOnHit(this, ev);
        },

        checkBloodstoneBlast(time) {
            return checkBloodstoneBlast(this, time);
        },

        buildHitResolutionContext(ev, args) {
            return buildHitResolutionContext(this, ev, args);
        },

        applyResolvedHit(ev, hitCtx, opts = {}) {
            return applyResolvedHit(this, ev, hitCtx, opts);
        },

        procHit(ev, power, condDmg, critMult, strikeMul, condMul) {
            return procHit(this, ev, power, condDmg, critMult, strikeMul, condMul);
        },

        applyBoonExtension(durSec, time) {
            const extMs = Math.round(durSec * 1000);
            applyBoonExtension(S, durSec, time, {
                boons: config.boons,
            });
            this.log({ t: time, type: 'boon_extension', extMs });
        },

        trackBlightbringerPoison(time, skillName, castStart) {
            return trackBlightbringerPoison(S, time, skillName, castStart, {
                damagingConditions: config.damagingConditions,
                applyCondition: (cond, stacks, durSec, at, source) =>
                    this.applyCondition(cond, stacks, durSec, at, source),
                trackEffect: (effect, stacks, durSec, at) =>
                    this.trackEffect(effect, stacks, durSec, at),
            });
        },

        grantPersistingFlames(time) {
            return grantPersistingFlames(this, time);
        },

        ensurePerSkill(name) {
            return ensurePerSkillEntry(S, name);
        },

        skill(name) {
            const matches = engine.skills.filter(s => s.name === name);
            if (matches.length <= 1) return matches[0] || null;
            if (S.conjureEquipped) {
                return matches.find(s => s.weapon === S.conjureEquipped)
                    || matches.find(s => !conjureWeapons.has(s.weapon))
                    || matches[0];
            }
            return matches.find(s => !conjureWeapons.has(s.weapon)) || matches[0];
        },

        getTraitIcd(key, fallback = 0) {
            return getTraitIcd(S, key, fallback);
        },

        setTraitIcd(key, readyAt) {
            return setTraitIcd(S, key, readyAt);
        },

        traitIcdReady(key, time) {
            return isTraitIcdReady(S, key, time);
        },

        armTraitIcd(key, time, icdMs) {
            return armTraitIcd(S, key, time, icdMs);
        },

        getRelicIcd(key, fallback = 0) {
            return getRelicIcd(S, key, fallback);
        },

        setRelicIcd(key, readyAt) {
            return setRelicIcd(S, key, readyAt);
        },

        relicIcdReady(key, time) {
            return isRelicIcdReady(S, key, time);
        },

        armRelicIcd(key, time, icdMs) {
            return armRelicIcd(S, key, time, icdMs);
        },

        getSigilIcd(key, fallback = 0) {
            return getSigilIcd(S, key, fallback);
        },

        setSigilIcd(key, readyAt) {
            return setSigilIcd(S, key, readyAt);
        },

        sigilIcdReady(key, time) {
            return isSigilIcdReady(S, key, time);
        },

        armSigilIcd(key, time, icdMs) {
            return armSigilIcd(S, key, time, icdMs);
        },

        getArcaneEchoUntil(fallback = 0) {
            return getArcaneEchoUntil(S, fallback);
        },

        setArcaneEchoUntil(time) {
            return setArcaneEchoUntil(S, time);
        },

        armArcaneEchoWindow(startTime, durationMs) {
            return armArcaneEchoWindow(S, startTime, durationMs);
        },

        clearArcaneEchoWindow() {
            return clearArcaneEchoWindow(S);
        },

        arcaneEchoActiveAt(time) {
            return isArcaneEchoActive(S, time);
        },

        addSignetFirePassiveLostWindow(from, until) {
            return addSignetFirePassiveLostWindow(S, from, until);
        },

        signetFirePassiveLostAt(time) {
            return isSignetFirePassiveLost(S, time);
        },

        addCatalystEnergy(amount, maxEnergy) {
            return addCatalystEnergy(S, amount, maxEnergy);
        },

        grantEvokerCharges(amount, maxCharges) {
            return addEvokerCharges(S, amount, maxCharges);
        },

        incrementEvokerElemBalance(time, opts = {}) {
            return incrementEvokerElemBalance(S, time, opts);
        },

        gainEndurance(amount, time = S.t) {
            return gainEndurance(S, amount, time);
        },

        attAt(time) {
            return attunementAt(S, time);
        },

        att2At(time) {
            return secondaryAttunementAt(S, time);
        },

        mightStacksAt(time) {
            return mightStacksAt(S, time);
        },

        vulnStacksAt(time) {
            return vulnerabilityStacksAt(S, time);
        },

        hasFuryAt(time) {
            return hasFuryAt(S, time);
        },

        getEmpMul(time) {
            return getEmpowermentMultiplier(this, time);
        },

        effectStacksAt(effect, time) {
            return effectStacksAt(S, effect, time);
        },

        getRelicStrikeMul(ev, tgtHP) {
            return getRelicStrikeMultiplier(engine, S, ev, tgtHP);
        },

        applyPrimordialStance(att1, att2, time) {
            return applyPrimordialStance(this, att1, att2, time);
        },
    };
}
