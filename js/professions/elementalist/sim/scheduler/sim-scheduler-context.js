import {
    pushSchedulerLog,
    pushSchedulerStep,
    setSchedulerTime,
    advanceSchedulerTime,
    getScheduledCastUntil,
    setSchedulerCastUntil,
    beginScheduledCast,
    finishScheduledCast,
    setSchedulerSkillCooldown,
    setSchedulerAttunementCooldown,
    pushSchedulerAttunementTimeline,
    recordScheduledSkillCast,
    pushSchedulerCondStack,
    setSchedulerFlag,
    getScheduledArcaneEchoUntil,
    setScheduledArcaneEchoUntil,
    armScheduledArcaneEchoWindow,
    clearScheduledArcaneEchoWindow,
    isScheduledArcaneEchoActive,
    addScheduledSignetFirePassiveLostWindow,
    isScheduledSignetFirePassiveLost,
    adjustSchedulerChargeCount,
    setSchedulerChargeReadyAt,
    setSchedulerChainProgress,
    setSchedulerAACarryover,
    setPendingSchedulerAACPrevious,
    takePendingSchedulerAACPrevious,
    takePendingSchedulerPartialFill,
    setPendingSchedulerPartialFill,
    clearScheduledConjureWeapon,
    takeScheduledConjurePickup,
    resetScheduledWeaveSelfState,
    setScheduledWeaveSelfUntil,
    addScheduledWeaveSelfVisited,
    setScheduledPerfectWeaveUntil,
    setScheduledUnravelUntil,
    expireScheduledChainProgress,
    equipScheduledConjureWeapon,
    queueScheduledConjurePickup,
    grantScheduledEvokerCharges,
    setScheduledEtchingProgress,
    incrementScheduledEtchingOtherCasts,
    armScheduledSpearFollowup,
    setSchedulerPrimaryAttunement,
    withScheduledPrimaryAttunement,
    setSchedulerSecondaryAttunement,
    setSchedulerAttEnteredAt,
    adjustSchedulerProcCounter,
    addScheduledCatalystEnergy,
    spendScheduledCatalystEnergy,
    activateScheduledCatalystSphere,
    incrementScheduledEvokerElemBalance,
    consumeScheduledEvokerElemBalance,
    setScheduledEvokerCharges,
    addScheduledEvokerEmpowered,
    setScheduledEvokerEmpowered,
    consumeScheduledEvokerIgniteTier,
    consumeScheduledPistolBullet,
    spendScheduledEndurance,
    gainScheduledEndurance,
} from './sim-scheduler-state.js';
import {
    detectAACarryover as detectCastStateAACarryover,
    getChainRoot as getCastStateChainRoot,
    resetChainsOnCast as resetCastStateChainsOnCast,
    propagateChainCooldown as propagateCastStateChainCooldown,
    fillGap as fillCastStateGap,
} from './sim-cast-state.js';
import {
    getCooldownKey,
    getAdjustedCastTime,
    getAlacrityAdjustedCooldown,
    catchUpCharges as catchUpRechargeCharges,
    initCharges as initRechargeCharges,
    getAdjustedWeaponRechargeMs,
    getWeaponStrength,
    ensurePerSkillEntry,
} from '../shared/sim-stat-recharge-helpers.js';
import {
    applyElementalAttunementBoon,
    getAttunementCooldownMs,
    triggerBountifulPower,
    procOnSwapSigils,
    procOnCcSigils,
} from '../mechanics/sim-crit-sigil-helpers.js';
import {
    attunementAt,
    effectStacksAt,
    mightStacksAt,
    attunementMatchesSkill,
    hammerActiveOrbsAt,
    hammerGrandFinaleAvailable,
} from '../shared/sim-state-queries.js';
import { getEnduranceReadyTime } from '../state/sim-endurance-state.js';
import {
    findFreshAirResetTimeInRange,
    scheduleSkillHits,
} from './sim-timeline-scheduling.js';
import {
    trackField as trackCombatField,
    applyAura as applyCombatAura,
    trackAura as trackCombatAura,
} from '../mechanics/sim-field-aura-combo.js';
import {
    trackEffect as trackCombatEffect,
    refreshEffect as refreshCombatEffect,
    grantFamiliarProwess,
    rechargeWeaponSkills,
    triggerAttunementEnterEffects,
} from '../mechanics/sim-effect-state.js';
import { applyCondition as applyCombatCondition } from '../resolver/sim-condition-resolution.js';
import {
    enqueueHitEvent,
    enqueueConditionTickEvent,
    enqueueApplyEffectEvent,
    enqueueRelicActivateEvent,
} from '../shared/sim-events.js';
import {
    triggerSunspot,
    triggerFlameExpulsion,
    triggerEarthenBlast,
    grantRockSolid,
    triggerElectricDischarge,
    applyFreshAirBuff,
} from '../mechanics/sim-elemental-traits.js';
import { checkRelicOnCast as checkCastRelicProc } from '../mechanics/sim-relic-helpers.js';
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

export function createSchedulerContext(engine, S, config = {}) {
    const conjureWeapons = config.conjureWeapons || new Set();
    const fireFieldSkills = config.fireFieldSkills || new Set();
    const boons = config.boons || new Set();
    const relicProcs = config.relicProcs || {};
    const hammerOrbSkills = config.hammerOrbSkills || {};
    const hammerDualOrbSkills = config.hammerDualOrbSkills || {};
    const sigilProcs = config.sigilProcs || {};
    const missingHandler = name => () => {
        throw new Error(`Scheduler context missing required handler: ${name}`);
    };
    const runStepHandler = config.runStep || missingHandler('runStep');
    const doSwapHandler = config.doSwap || missingHandler('doSwap');
    const doOverloadHandler = config.doOverload || missingHandler('doOverload');
    const doJadeSphereHandler = config.doJadeSphere || missingHandler('doJadeSphere');
    const doFamiliarHandler = config.doFamiliar || missingHandler('doFamiliar');
    return {
        engine,
        S,
        ...config,
        activeProcSigils: engine._activeProcSigils || [],
        conjureWeapons,
        fireFieldSkills,
        boons,
        relicProcs,
        hammerOrbSkills,
        hammerDualOrbSkills,
        sigilProcs,
        skills: engine.skills,
        skillHits: engine.skillHits,
        hitboxSize: engine.hitboxSize || 'large',
        glyphBoonedElementals: !!engine.glyphBoonedElementals,

        runStep(name, skipCastUntil = false, concurrents = [], rotationMeta = {}) {
            return runStepHandler(name, skipCastUntil, concurrents, rotationMeta);
        },

        log(entry) {
            return pushSchedulerLog(S, entry);
        },

        addStep(entry) {
            return pushSchedulerStep(S, entry);
        },

        queueRelicActivateEvent(event) {
            return enqueueRelicActivateEvent(S.eq, event);
        },

        queueHitEvent(event) {
            return enqueueHitEvent(S.eq, event);
        },

        queueConditionTickEvent(event) {
            return enqueueConditionTickEvent(S.eq, event);
        },

        queueApplyEffectEvent(event) {
            return enqueueApplyEffectEvent(S.eq, event);
        },

        setTime(time) {
            return setSchedulerTime(S, time);
        },

        advanceTimeTo(time) {
            return advanceSchedulerTime(S, time);
        },

        setCastUntil(time) {
            return setSchedulerCastUntil(S, time);
        },

        getCastUntil(fallback = 0) {
            return getScheduledCastUntil(S, fallback);
        },

        beginCast(skill, start, dur) {
            return beginScheduledCast(S, { skill, start, att: S.att, dur });
        },

        finishCast(skill, end, { setCastUntil = false } = {}) {
            return finishScheduledCast(S, { skill, end, setCastUntil });
        },

        setSkillCooldown(key, readyAt, meta = undefined) {
            return setSchedulerSkillCooldown(S, key, readyAt, meta);
        },

        setAttunementCooldown(attunement, readyAt, meta = undefined) {
            return setSchedulerAttunementCooldown(S, attunement, readyAt, meta);
        },

        pushAttunementTimeline(entry) {
            return pushSchedulerAttunementTimeline(S, entry);
        },

        skill(name) {
            return engine._skill(name);
        },

        skillInContext(name) {
            return engine._skillInContext(name, S);
        },

        cdKey(sk) {
            return getCooldownKey(sk, { conjureWeapons });
        },

        adjustCastTime(csvCastMs, startTime, options = {}) {
            return getAdjustedCastTime(S, csvCastMs, startTime, options);
        },

        alacrityAdjustedCooldown(baseCdMs, cdStart) {
            return getAlacrityAdjustedCooldown(S, baseCdMs, cdStart);
        },

        attunementCooldownMs(baseCdMs) {
            return getAttunementCooldownMs(S, baseCdMs);
        },

        initCharges(key, sk) {
            return initRechargeCharges(S, key, sk);
        },

        catchUpCharges(key, sk) {
            return catchUpRechargeCharges(this, key, sk);
        },

        weaponRechargeMs(sk, baseMs) {
            return getAdjustedWeaponRechargeMs(engine, sk, baseMs);
        },

        scheduleHits(sk, castStart, scaleOff, interruptAt = null, extraEventProps = null) {
            return scheduleSkillHits(this, sk, castStart, scaleOff, interruptAt, extraEventProps);
        },

        trackField(sk, castEnd) {
            return trackCombatField(engine, S, sk, castEnd, {
                fireFieldSkills,
                log: entry => this.log(entry),
            });
        },

        trackAura(sk, castEnd) {
            return trackCombatAura(engine, S, sk, castEnd, {
                log: entry => this.log(entry),
                pushCondStack: entry => this.pushCondStack(entry),
            });
        },

        fillGap(sk, gapMs) {
            return fillCastStateGap(this, sk, gapMs);
        },

        checkRelicOnCast(sk, start, end) {
            return checkCastRelicProc(engine, S, sk, start, end, {
                queueRelicActivate: event => this.queueRelicActivateEvent(event),
            });
        },

        applyAura(auraName, durMs, time, skill, opts = {}) {
            return applyCombatAura(engine, S, auraName, durMs, time, skill, {
                ...opts,
                boons,
                relicProcs,
                log: entry => this.log(entry),
                pushCondStack: entry => this.pushCondStack(entry),
            });
        },

        trackEffect(effect, stacks, durSec, time) {
            return trackCombatEffect(engine, S, effect, stacks, durSec, time, {
                boons,
                relicProcs,
                log: entry => this.log(entry),
                pushCondStack: entry => this.pushCondStack(entry),
                gainEndurance: (amount, at) => this.gainEndurance(amount, at),
            });
        },

        refreshEffect(effectName, durSec, time) {
            return refreshCombatEffect(this, effectName, durSec, time);
        },

        refreshArcaneLightningBuff(time) {
            return engine._refreshArcaneLightningBuff(S, time);
        },

        procOnCcSigils(time) {
            return procOnCcSigils(this, time);
        },

        pushCondStack(entry) {
            return pushSchedulerCondStack(S, entry);
        },

        applyCondition(cond, stacks, durSec, time, skillName, castStart = null, extraCondDurPct = 0) {
            return applyCombatCondition(engine, S, cond, stacks, durSec, time, skillName, castStart, extraCondDurPct, {
                relicProcs,
                boons,
                queueConditionTick: event => this.queueConditionTickEvent(event),
            });
        },

        weaponStrength(skill) {
            return getWeaponStrength(engine, skill);
        },

        mightStacksAt(time) {
            return mightStacksAt(S, time);
        },

        effectStacksAt(effect, time) {
            return effectStacksAt(S, effect, time);
        },

        attAt(time) {
            return attunementAt(S, time);
        },

        getChainRoot(sk) {
            return getCastStateChainRoot(this, sk);
        },

        resetChainsOnCast(sk) {
            return resetCastStateChainsOnCast(this, sk);
        },

        propagateChainCooldown(sk, cdTime) {
            return propagateCastStateChainCooldown(this, sk, cdTime);
        },

        detectAACarryover() {
            return detectCastStateAACarryover(this);
        },

        freshAirResetTimeInRange(fromTime, upTo) {
            return findFreshAirResetTimeInRange(this, fromTime, upTo);
        },

        attOK(sk) {
            return attunementMatchesSkill(S, sk);
        },

        ensurePerSkill(name) {
            return ensurePerSkillEntry(S, name);
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

        recordSkillCast(name, castMs) {
            this.ensurePerSkill(name);
            return recordScheduledSkillCast(S, name, castMs);
        },

        setFlag(key, value) {
            return setSchedulerFlag(S, key, value);
        },

        getArcaneEchoUntil(fallback = 0) {
            return getScheduledArcaneEchoUntil(S, fallback);
        },

        setArcaneEchoUntil(time) {
            return setScheduledArcaneEchoUntil(S, time);
        },

        armArcaneEchoWindow(startTime, durationMs) {
            return armScheduledArcaneEchoWindow(S, startTime, durationMs);
        },

        clearArcaneEchoWindow() {
            return clearScheduledArcaneEchoWindow(S);
        },

        arcaneEchoActiveAt(time) {
            return isScheduledArcaneEchoActive(S, time);
        },

        addSignetFirePassiveLostWindow(from, until) {
            return addScheduledSignetFirePassiveLostWindow(S, from, until);
        },

        signetFirePassiveLostAt(time) {
            return isScheduledSignetFirePassiveLost(S, time);
        },

        adjustChargeCount(key, delta) {
            return adjustSchedulerChargeCount(S, key, delta);
        },

        setChargeReadyAt(key, time) {
            return setSchedulerChargeReadyAt(S, key, time);
        },

        setChainProgress(chainRoot, nextSkill, expiryAt = null) {
            return setSchedulerChainProgress(S, chainRoot, nextSkill, expiryAt);
        },

        setAACarryover(carryover) {
            return setSchedulerAACarryover(S, carryover);
        },

        setPendingAACPrevious(attunement) {
            return setPendingSchedulerAACPrevious(S, attunement);
        },

        clearAACarryover() {
            return setSchedulerAACarryover(S, null);
        },

        takePendingAACPrevious() {
            return takePendingSchedulerAACPrevious(S);
        },

        takePendingPartialFill() {
            return takePendingSchedulerPartialFill(S);
        },

        setPendingPartialFill(partialFill) {
            return setPendingSchedulerPartialFill(S, partialFill);
        },

        clearConjure() {
            return clearScheduledConjureWeapon(S);
        },

        takeConjurePickup(weapon, time = S.t) {
            return takeScheduledConjurePickup(S, weapon, time);
        },

        resetWeaveSelfState() {
            return resetScheduledWeaveSelfState(S);
        },

        setWeaveSelfUntil(time) {
            return setScheduledWeaveSelfUntil(S, time);
        },

        addWeaveSelfVisited(attunement) {
            return addScheduledWeaveSelfVisited(S, attunement);
        },

        setPerfectWeaveUntil(time) {
            return setScheduledPerfectWeaveUntil(S, time);
        },

        setUnravelUntil(time) {
            return setScheduledUnravelUntil(S, time);
        },

        expireChainProgress(chainRoot) {
            return expireScheduledChainProgress(S, chainRoot);
        },

        equipConjure(weapon) {
            return equipScheduledConjureWeapon(S, weapon);
        },

        queueConjurePickup(weapon, expiresAt) {
            return queueScheduledConjurePickup(S, weapon, expiresAt);
        },

        grantEvokerCharges(amount, maxCharges) {
            return grantScheduledEvokerCharges(S, amount, maxCharges);
        },

        setEtchingProgress(etching, stateName, otherCasts = 0) {
            return setScheduledEtchingProgress(S, etching, stateName, otherCasts);
        },

        incrementEtchingOtherCasts(etching, amount = 1) {
            return incrementScheduledEtchingOtherCasts(S, etching, amount);
        },

        armSpearFollowup(flagKey) {
            return armScheduledSpearFollowup(S, flagKey);
        },

        setAttunement(attunement) {
            return setSchedulerPrimaryAttunement(S, attunement);
        },

        withPrimaryAttunement(attunement, callback) {
            return withScheduledPrimaryAttunement(S, attunement, callback);
        },

        detectAACarryoverFromAttunement(attunement) {
            return this.withPrimaryAttunement(attunement, () => this.detectAACarryover());
        },

        setSecondaryAttunement(attunement) {
            return setSchedulerSecondaryAttunement(S, attunement);
        },

        setAttEnteredAt(time) {
            return setSchedulerAttEnteredAt(S, time);
        },

        adjustProcCounter(key, delta) {
            return adjustSchedulerProcCounter(S, key, delta);
        },

        addCatalystEnergy(amount, maxEnergy) {
            return addScheduledCatalystEnergy(S, amount, maxEnergy);
        },

        spendCatalystEnergy(amount) {
            return spendScheduledCatalystEnergy(S, amount);
        },

        activateCatalystSphere(attunement, startTime, durationMs) {
            return activateScheduledCatalystSphere(S, attunement, startTime, durationMs);
        },

        incrementEvokerElemBalance(time, opts = {}) {
            return incrementScheduledEvokerElemBalance(S, time, opts);
        },

        consumeEvokerElemBalance() {
            return consumeScheduledEvokerElemBalance(S);
        },

        setEvokerCharges(charges) {
            return setScheduledEvokerCharges(S, charges);
        },

        addEvokerEmpowered(amount, maxEmpowered = Infinity) {
            return addScheduledEvokerEmpowered(S, amount, maxEmpowered);
        },

        setEvokerEmpowered(empowered) {
            return setScheduledEvokerEmpowered(S, empowered);
        },

        consumeEvokerIgniteTier(time, opts = {}) {
            return consumeScheduledEvokerIgniteTier(S, time, opts);
        },

        consumePistolBullet(element, time) {
            return consumeScheduledPistolBullet(S, element, time);
        },

        spendEndurance(amount, time = S.t) {
            return spendScheduledEndurance(S, amount, time);
        },

        gainEndurance(amount, time = S.t) {
            return gainScheduledEndurance(S, amount, time);
        },

        getEnduranceReadyTime(required, fromTime = S.t) {
            return getEnduranceReadyTime(S, required, fromTime);
        },

        procOnSwapSigils(time) {
            return procOnSwapSigils(this, time);
        },

        applyFreshAirBuff(time) {
            return applyFreshAirBuff(this, time);
        },

        triggerSunspot(time) {
            return triggerSunspot(this, time);
        },

        triggerFlameExpulsion(time) {
            return triggerFlameExpulsion(this, time);
        },

        triggerEarthenBlast(time) {
            return triggerEarthenBlast(this, time);
        },

        grantRockSolid(time) {
            return grantRockSolid(this, time);
        },

        triggerElectricDischarge(time) {
            return triggerElectricDischarge(this, time);
        },

        applyElemAttunementBoon(attunement, time) {
            return applyElementalAttunementBoon(this, attunement, time);
        },

        triggerBountifulPower(stacks, time) {
            return triggerBountifulPower(this, stacks, time);
        },

        grantFamiliarProwess(time) {
            return grantFamiliarProwess(this, time);
        },

        rechargeWeaponSkills(pct, time) {
            return rechargeWeaponSkills(this, pct, time);
        },

        triggerAttunementEnterEffects(element, time) {
            return triggerAttunementEnterEffects(this, element, time);
        },

        doSwap(sk, isConcurrent = false, concurrents = []) {
            return doSwapHandler(sk, isConcurrent, concurrents);
        },

        doOverload(sk, concurrents = []) {
            return doOverloadHandler(sk, concurrents);
        },

        doJadeSphere(sk, concurrents = []) {
            return doJadeSphereHandler(sk, concurrents);
        },

        doFamiliar(sk, concurrents = []) {
            return doFamiliarHandler(sk, concurrents);
        },

        hammerActiveOrbs(time) {
            return hammerActiveOrbsAt(S, time);
        },

        hammerGFAvailable(time) {
            return hammerGrandFinaleAvailable(engine, S, time);
        },
    };
}
