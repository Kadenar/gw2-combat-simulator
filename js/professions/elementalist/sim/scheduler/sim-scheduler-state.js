import { getProcState, setProcStateValue } from '../state/sim-proc-state.js';
import {
    getArcaneEchoUntil,
    setArcaneEchoUntil,
    armArcaneEchoWindow,
    clearArcaneEchoWindow,
    isArcaneEchoActive,
    addSignetFirePassiveLostWindow,
    isSignetFirePassiveLost,
} from '../state/sim-timing-window-state.js';
import {
    addCatalystEnergy,
    spendCatalystEnergy,
    activateCatalystSphere,
    incrementEvokerElemBalance,
    consumeEvokerElemBalance,
    addEvokerCharges,
    setEvokerCharges,
    addEvokerEmpowered,
    setEvokerEmpowered,
    consumeEvokerIgniteTier,
} from '../state/sim-specialization-state.js';
import {
    catchUpEndurance,
    spendEndurance,
    gainEndurance,
} from '../state/sim-endurance-state.js';
import { pushCombatCondStack } from '../state/sim-combat-record-state.js';
import {
    pushReportingLog,
    pushReportingStep,
    recordPerSkillCast,
} from '../state/sim-reporting-state.js';
import { getCastUntil, setCastUntil } from '../state/sim-timing-window-state.js';
import {
    setSkillCooldownReadyAt,
    setAttunementCooldownReadyAt,
    adjustChargeCount,
    setChargeReadyAt,
    setChainProgress,
    expireChainProgress,
} from '../state/sim-cooldown-state.js';

export function pushSchedulerLog(S, entry) {
    return pushReportingLog(S, entry);
}

export function pushSchedulerStep(S, entry) {
    return pushReportingStep(S, entry);
}

export function setSchedulerTime(S, time) {
    catchUpEndurance(S, time);
    S.t = time;
    return S.t;
}

export function advanceSchedulerTime(S, time) {
    if (S.t < time) setSchedulerTime(S, time);
    return S.t;
}

export function setSchedulerCastUntil(S, time) {
    return setCastUntil(S, time);
}

export function getScheduledCastUntil(S, fallback = 0) {
    return getCastUntil(S, fallback);
}

export function beginScheduledCast(S, {
    skill,
    start,
    att,
    dur,
}) {
    pushSchedulerLog(S, { t: start, type: 'cast', skill, att, dur });
}

export function finishScheduledCast(S, {
    skill,
    end,
    setCastUntil = false,
}) {
    if (setCastUntil) setSchedulerCastUntil(S, end);
    setSchedulerTime(S, end);
    pushSchedulerLog(S, { t: end, type: 'cast_end', skill });
}

export function setSchedulerSkillCooldown(S, key, readyAt, meta = undefined) {
    return setSkillCooldownReadyAt(S, key, readyAt, meta);
}

export function setSchedulerAttunementCooldown(S, attunement, readyAt, meta = undefined) {
    return setAttunementCooldownReadyAt(S, attunement, readyAt, meta);
}

export function pushSchedulerAttunementTimeline(S, entry) {
    S.attTimeline.push(entry);
}

export function recordScheduledSkillCast(S, name, castMs) {
    return recordPerSkillCast(S, name, castMs);
}

export function pushSchedulerCondStack(S, entry) {
    return pushCombatCondStack(S, entry);
}

export function setSchedulerFlag(S, key, value) {
    return setProcStateValue(S, key, value);
}

export function getScheduledArcaneEchoUntil(S, fallback = 0) {
    return getArcaneEchoUntil(S, fallback);
}

export function setScheduledArcaneEchoUntil(S, time) {
    return setArcaneEchoUntil(S, time);
}

export function armScheduledArcaneEchoWindow(S, startTime, durationMs) {
    return armArcaneEchoWindow(S, startTime, durationMs);
}

export function clearScheduledArcaneEchoWindow(S) {
    return clearArcaneEchoWindow(S);
}

export function isScheduledArcaneEchoActive(S, time) {
    return isArcaneEchoActive(S, time);
}

export function addScheduledSignetFirePassiveLostWindow(S, from, until) {
    return addSignetFirePassiveLostWindow(S, from, until);
}

export function isScheduledSignetFirePassiveLost(S, time) {
    return isSignetFirePassiveLost(S, time);
}

export function adjustSchedulerChargeCount(S, key, delta) {
    return adjustChargeCount(S, key, delta);
}

export function setSchedulerChargeReadyAt(S, key, time) {
    return setChargeReadyAt(S, key, time);
}

export function setSchedulerChainProgress(S, chainRoot, nextSkill, expiryAt = null) {
    return setChainProgress(S, chainRoot, nextSkill, expiryAt);
}

export function setSchedulerAACarryover(S, carryover) {
    S.aaCarryover = carryover;
    return carryover;
}

export function setPendingSchedulerAACPrevious(S, attunement) {
    S._pendingAACPrev = attunement;
    return attunement;
}

export function takePendingSchedulerAACPrevious(S) {
    const prevAtt = S._pendingAACPrev;
    delete S._pendingAACPrev;
    return prevAtt;
}

export function takePendingSchedulerPartialFill(S) {
    const partialFill = S._pendingPartialFill;
    S._pendingPartialFill = null;
    return partialFill;
}

export function setPendingSchedulerPartialFill(S, partialFill) {
    S._pendingPartialFill = partialFill;
    return partialFill;
}

export function clearScheduledConjureWeapon(S) {
    const previousWeapon = S.conjureEquipped;
    S.conjureEquipped = null;
    return previousWeapon;
}

export function takeScheduledConjurePickup(S, weapon, time) {
    const pickupIndex = S.conjurePickups.findIndex(p => p.weapon === weapon && time <= p.expiresAt);
    if (pickupIndex === -1) return null;
    const [pickup] = S.conjurePickups.splice(pickupIndex, 1);
    return pickup;
}

export function resetScheduledWeaveSelfState(S) {
    S.weaveSelfUntil = 0;
    S.weaveSelfVisited = new Set();
    return true;
}

export function setScheduledWeaveSelfUntil(S, time) {
    S.weaveSelfUntil = time;
    return time;
}

export function addScheduledWeaveSelfVisited(S, attunement) {
    S.weaveSelfVisited.add(attunement);
    // Record the time window during which this attunement's Weave Self bonus
    // is active. The window runs from now until weaveSelfUntil. The resolver
    // receives the final (zeroed) weaveSelfVisited, so it needs these windows
    // to correctly compute per-tick bonuses.
    if (!S._disableWeaveSelfBonuses && S.weaveSelfUntil > S.t) {
        if (attunement === 'Fire') S.wsFireBonusWindows.push({ start: S.t, end: S.weaveSelfUntil });
        if (attunement === 'Air')  S.wsAirBonusWindows.push({  start: S.t, end: S.weaveSelfUntil });
    }
    return S.weaveSelfVisited.size;
}

export function setScheduledPerfectWeaveUntil(S, time) {
    S.perfectWeaveUntil = time;
    if (time > 0 && !S._disableWeaveSelfBonuses) {
        // Perfect Weave grants all Weave Self attunement bonuses simultaneously.
        S.wsFireBonusWindows.push({ start: S.t, end: time });
        S.wsAirBonusWindows.push({  start: S.t, end: time });
    }
    return time;
}

export function setScheduledUnravelUntil(S, time) {
    S.unravelUntil = time;
    return time;
}

export function expireScheduledChainProgress(S, chainRoot) {
    return expireChainProgress(S, chainRoot);
}

export function equipScheduledConjureWeapon(S, weapon) {
    S.conjureEquipped = weapon;
    return weapon;
}

export function queueScheduledConjurePickup(S, weapon, expiresAt) {
    const existing = S.conjurePickups.findIndex(p => p.weapon === weapon);
    if (existing !== -1) S.conjurePickups.splice(existing, 1);
    S.conjurePickups.push({ weapon, expiresAt });
    return expiresAt;
}

export function grantScheduledEvokerCharges(S, amount, maxCharges) {
    return addEvokerCharges(S, amount, maxCharges);
}

export function setScheduledEtchingProgress(S, etching, state, otherCasts = 0) {
    S.etchingState[etching] = state;
    S.etchingOtherCasts[etching] = otherCasts;
    return state;
}

export function incrementScheduledEtchingOtherCasts(S, etching, amount = 1) {
    const nextValue = (S.etchingOtherCasts[etching] || 0) + amount;
    S.etchingOtherCasts[etching] = nextValue;
    return nextValue;
}

export function armScheduledSpearFollowup(S, flagKey) {
    S[flagKey] = true;
    return true;
}

export function setSchedulerPrimaryAttunement(S, attunement) {
    S.att = attunement;
    return attunement;
}

export function withScheduledPrimaryAttunement(S, attunement, callback) {
    const previousAttunement = S.att;
    S.att = attunement;
    try {
        return callback();
    } finally {
        S.att = previousAttunement;
    }
}

export function setSchedulerSecondaryAttunement(S, attunement) {
    S.att2 = attunement;
    return attunement;
}

export function setSchedulerAttEnteredAt(S, time) {
    S.attEnteredAt = time;
    return time;
}

export function adjustSchedulerProcCounter(S, key, delta) {
    const procState = getProcState(S);
    const nextValue = (procState[key] || 0) + delta;
    setProcStateValue(S, key, nextValue);
    return nextValue;
}

export function addScheduledCatalystEnergy(S, amount, maxEnergy) {
    return addCatalystEnergy(S, amount, maxEnergy);
}

export function spendScheduledCatalystEnergy(S, amount) {
    return spendCatalystEnergy(S, amount);
}

export function activateScheduledCatalystSphere(S, attunement, startTime, durationMs) {
    return activateCatalystSphere(S, attunement, startTime, durationMs);
}

export function incrementScheduledEvokerElemBalance(S, time, opts = {}) {
    return incrementEvokerElemBalance(S, time, opts);
}

export function consumeScheduledEvokerElemBalance(S) {
    return consumeEvokerElemBalance(S);
}

export function setScheduledEvokerCharges(S, charges) {
    return setEvokerCharges(S, charges);
}

export function addScheduledEvokerEmpowered(S, amount, maxEmpowered = Infinity) {
    return addEvokerEmpowered(S, amount, maxEmpowered);
}

export function setScheduledEvokerEmpowered(S, empowered) {
    return setEvokerEmpowered(S, empowered);
}

export function consumeScheduledEvokerIgniteTier(S, time, opts = {}) {
    return consumeEvokerIgniteTier(S, time, opts);
}

export function consumeScheduledPistolBullet(S, element, time) {
    if (!S.pistolBullets[element]) return false;

    S.pistolBullets[element] = false;
    const mapEntry = S._pistolBulletMapEntry[element];
    if (mapEntry) {
        mapEntry.expiresAt = time;
        S._pistolBulletMapEntry[element] = null;
    }
    return true;
}

export function spendScheduledEndurance(S, amount, time) {
    return spendEndurance(S, amount, time);
}

export function gainScheduledEndurance(S, amount, time) {
    return gainEndurance(S, amount, time);
}
