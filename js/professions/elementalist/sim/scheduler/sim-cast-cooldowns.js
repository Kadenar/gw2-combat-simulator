import { getProcState } from '../state/sim-proc-state.js';
import { getEvokerState } from '../state/sim-specialization-state.js';
import {
    getSkillCooldownReadyAt,
    getSkillCooldownMeta,
    getChargeState,
} from '../state/sim-cooldown-state.js';

export function prepareStandardSkillAvailability(ctx, sk, key) {
    const { S } = ctx;
    const isCharged = sk.maximumCount > 0 && sk.countRecharge > 0;

    if (isCharged) {
        ctx.initCharges(key, sk);

        const cdReady = getSkillCooldownReadyAt(S, key);
        ctx.advanceTimeTo(cdReady);

        ctx.catchUpCharges(key, sk);
        const chargeState = getChargeState(S, key);

        if (chargeState.count <= 0) {
            ctx.advanceTimeTo(chargeState.nextChargeAt);
            ctx.adjustChargeCount(key, 1);
            const baseMs = ctx.weaponRechargeMs(sk, Math.round(sk.countRecharge * 1000));
            const nextReadyAt = chargeState.count < sk.maximumCount
                ? S.t + ctx.alacrityAdjustedCooldown(baseMs, S.t)
                : Infinity;
            ctx.setChargeReadyAt(key, nextReadyAt);
        }

        ctx.adjustChargeCount(key, -1);
        if (chargeState.nextChargeAt === Infinity && chargeState.count < sk.maximumCount) {
            const baseMs = ctx.weaponRechargeMs(sk, Math.round(sk.countRecharge * 1000));
            ctx.setChargeReadyAt(key, S.t + ctx.alacrityAdjustedCooldown(baseMs, S.t));
        }
    } else {
        const cdReady = getSkillCooldownReadyAt(S, key);
        ctx.advanceTimeTo(cdReady);
    }

    return { isCharged };
}

export function prepareStandardHitScheduling(ctx, name) {
    const { S } = ctx;
    ctx.setFlag('_frigidFlurryProcActive', name === 'Frigid Flurry' && S.pistolBullets.Water === true);
    ctx.setFlag('_purblindingCDReduce', name === 'Purblinding Plasma' && S.pistolBullets.Air === true);
}

export function finishStandardHitScheduling(ctx) {
    ctx.setFlag('_frigidFlurryProcActive', false);
}

function resolveStandardSkillCooldown(ctx, sk, name, key, start, end) {
    const { S } = ctx;
    const evokerState = getEvokerState(S);
    const procState = getProcState(S);
    if (name === 'Rock Barrier') return;
    if (sk.recharge <= 0) return;

    let finalCd;
    let displayDurationMs = null;
    let displayUsesAlacrity = true;
    if (ctx.arcaneEchoActiveAt(end) && sk.type === 'Weapon skill') {
        finalCd = end + 1000;
        displayDurationMs = 1000;
        displayUsesAlacrity = false;
        ctx.clearArcaneEchoWindow();

        const absorbedCdMs = ctx.weaponRechargeMs(sk, Math.round(sk.recharge * 1000));
        const echoSkill = ctx.skill('Arcane Echo');
        if (echoSkill) {
            const echoKey = ctx.cdKey(echoSkill);
            const echoReadyAt = getSkillCooldownReadyAt(S, echoKey);
            const echoMeta = getSkillCooldownMeta(S, echoKey);
            const newReadyAt = echoReadyAt + ctx.alacrityAdjustedCooldown(absorbedCdMs, end);
            const echoBaseMs = Math.round(echoSkill.recharge * 1000);
            ctx.setSkillCooldown(echoKey, newReadyAt, {
                startedAt: echoMeta?.startedAt ?? end,
                displayDurationMs: echoBaseMs + absorbedCdMs,
                alacrityUntil: S.alacrityUntil || 0,
            });
        }

        ctx.log({ t: end, type: 'skill_proc', skill: 'Arcane Echo', detail: `${name} CD → 1s (Echo +${(absorbedCdMs / 1000).toFixed(0)}s)` });
    } else {
        let baseCdMs = ctx.weaponRechargeMs(sk, Math.round(sk.recharge * 1000));
        let cdrPct = 0;
        if (
            evokerState.elemBalanceActive
            && end <= evokerState.elemBalanceExpiry
            && start >= evokerState.elemBalanceActivatedAt
            && sk.type === 'Weapon skill'
            && sk.slot !== '1'
        ) {
            cdrPct += 0.66;
            ctx.consumeEvokerElemBalance();
            ctx.log({ t: end, type: 'skill_proc', skill: 'Elemental Balance', detail: `${name} CD -66%` });
        }
        if (S.spearNextCdReduce && sk.weapon === 'Spear' && sk.type === 'Weapon skill' && sk.slot !== '1') {
            cdrPct += 0.33;
            ctx.setFlag('spearNextCdReduce', false);
            ctx.log({ t: end, type: 'skill_proc', skill: 'Ripple', detail: `${name} CD -33%` });
        }
        if (procState.dazingDischargeUntil > end && sk.weapon === 'Pistol' && sk.type === 'Weapon skill' && sk.slot !== '1') {
            cdrPct += 0.33;
            ctx.setFlag('dazingDischargeUntil', 0);
            ctx.log({ t: end, type: 'skill_proc', skill: 'Dazing Discharge', detail: `${name} CD -33%` });
        }
        if (cdrPct > 0) {
            baseCdMs = Math.round(baseCdMs * Math.max(0, 1 - cdrPct));
        }
        if (name === 'Ride the Lightning') baseCdMs = Math.round(baseCdMs / 2);
        if (name === 'Purblinding Plasma' && S._purblindingCDReduce) {
            baseCdMs = Math.round(baseCdMs * (2 / 3));
            ctx.log({ t: end, type: 'skill_proc', skill: 'Purblinding Plasma', detail: 'Air bullet → CD -33%' });
        }
        displayDurationMs = baseCdMs;
        finalCd = end + ctx.alacrityAdjustedCooldown(baseCdMs, end);
    }

    ctx.setSkillCooldown(key, finalCd, {
        startedAt: end,
        displayDurationMs,
        alacrityUntil: displayUsesAlacrity ? (S.alacrityUntil || 0) : 0,
    });
}

function updateStandardSkillChainProgress(ctx, sk, end, { interrupted = false } = {}) {
    if (!sk.chainSkill) return;
    if (interrupted) return; // interrupted cast did not complete — do not advance the chain

    const chainRoot = ctx.getChainRoot(sk);
    const expiryAt = name => {
        if (name === 'Rock Barrier') return end + 30000;
        return sk.slot !== '1' ? end + 5000 : null;
    };
    ctx.setChainProgress(chainRoot, sk.chainSkill, expiryAt(sk.name));
}

function reconcilePendingCarryover(ctx) {
    const pendingPrev = ctx.takePendingAACPrevious();
    if (pendingPrev === undefined) return;

    ctx.setAACarryover(ctx.detectAACarryoverFromAttunement(pendingPrev));
}

function consumeResolvedCarryover(ctx, sk, isAACarryover) {
    const { S } = ctx;
    if (!S.aaCarryover) return;

    if (isAACarryover) {
        if (sk.chainSkill === S.aaCarryover.root) ctx.clearAACarryover();
    } else if (sk.slot === '1' && ctx.attOK(sk)) {
        ctx.clearAACarryover();
    }
}

export function finalizeStandardSkillBookkeeping(ctx, sk, name, {
    key,
    start,
    end,
    castMs,
    isAACarryover,
    interrupted = false,
    interruptMs = undefined,
    fullCastMs = castMs,
}) {
    resolveStandardSkillCooldown(ctx, sk, name, key, start, end);
    updateStandardSkillChainProgress(ctx, sk, end, { interrupted });
    if (name === 'Hurl') {
        const rootSkill = ctx.skill('Rock Barrier');
        ctx.expireChainProgress('Rock Barrier');
        if (rootSkill) {
            const rootKey = ctx.cdKey(rootSkill);
            const baseCdMs = ctx.weaponRechargeMs(rootSkill, Math.round(rootSkill.recharge * 1000));
            ctx.setSkillCooldown(rootKey, end + ctx.alacrityAdjustedCooldown(baseCdMs, end), {
                startedAt: end,
                displayDurationMs: baseCdMs,
                alacrityUntil: ctx.S.alacrityUntil || 0,
            });
        }
    }
    reconcilePendingCarryover(ctx);
    consumeResolvedCarryover(ctx, sk, isAACarryover);

    ctx.resetChainsOnCast(sk);

    ctx.recordSkillCast(name, castMs);
    const partialFill = ctx.takePendingPartialFill();
    ctx.addStep({
        skill: name,
        start,
        end,
        att: ctx.S.att,
        type: 'skill',
        ri: ctx.S._ri,
        partialFill: partialFill || undefined,
        interrupted: interrupted || undefined,
        interruptMs,
        fullCastMs: interrupted ? fullCastMs : undefined,
    });
}
