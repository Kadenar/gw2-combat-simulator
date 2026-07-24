import { getChainProgress, getChainExpiry } from '../state/sim-cooldown-state.js';
import { getHammerOrbLastCast, hasUsedHammerOrbSkill } from '../mechanics/sim-hammer.js';
import { activateCombatStartEffects } from '../mechanics/sim-effect-state.js';
import {
    buildNourysTickAction,
    buildThornsEnemyHitAction,
    queueRuntimeAction,
} from '../shared/sim-deferred-runtime-actions.js';

const PICKUP_CAST_MS = 300;
const MIN_WAIT_MS = 1;
const AURA_TRANSMUTE_SKILLS = Object.freeze({
    'Transmute Frost': 'Frost Aura',
    'Transmute Lightning': 'Shocking Aura',
    'Transmute Earth': 'Magnetic Aura',
    'Transmute Fire': 'Fire Aura',
});

function isAuraTransmuteAvailable(ctx, sk, time) {
    const auraName = AURA_TRANSMUTE_SKILLS[sk?.name];
    if (!auraName) return false;
    return ctx.effectStacksAt(auraName, time) > 0;
}

function handleRockBarrierExpiry(ctx) {
    const { S } = ctx;
    const root = 'Rock Barrier';
    const expiryAt = getChainExpiry(S, root);
    if (expiryAt === undefined || expiryAt > S.t) return;
    if (getChainProgress(S, root) === root) return;

    const rootSkill = ctx.skill(root);
    ctx.expireChainProgress(root);
    if (!rootSkill || (rootSkill.recharge || 0) <= 0) return;

    const baseCdMs = ctx.weaponRechargeMs(rootSkill, Math.round(rootSkill.recharge * 1000));
    const readyAt = expiryAt + ctx.alacrityAdjustedCooldown(baseCdMs, expiryAt);
    ctx.setSkillCooldown(ctx.cdKey(rootSkill), readyAt);
}

export function handleBundleStepCommand(ctx, name, rotationMeta = {}) {
    const { S } = ctx;

    if (name === '__combat_start') {
        if (S.combatStartTime !== null) {
            ctx.log({ t: S.t, type: 'err', msg: 'Combat Start is already set' });
            return true;
        }
        S.hasExplicitCombatStart = true;
        S.combatStartTime = S.t;
        activateCombatStartEffects(S, S.t);
        if (S.activeRelic === 'Nourys') {
            queueRuntimeAction(S, buildNourysTickAction({ time: S.t + 3000 }));
        }
        if (S.activeRelic === 'Thorns') {
            queueRuntimeAction(S, buildThornsEnemyHitAction({ time: S.t + 3000 }));
        }
        ctx.log({ t: S.t, type: 'combat_start', skill: 'Combat Start' });
        ctx.addStep({ skill: name, start: S.t, end: S.t, att: S.att, type: 'combat_start', ri: S._ri });
        return true;
    }

    if (name === '__wait') {
        const waitMs = Math.max(MIN_WAIT_MS, Math.round(rotationMeta?.waitMs ?? 0));
        const start = S.t;
        const end = start + waitMs;
        ctx.setTime(end);
        ctx.log({ t: start, type: 'wait', skill: 'Wait', durMs: waitMs });
        ctx.addStep({ skill: name, start, end, att: S.att, type: 'wait', ri: S._ri, waitMs });
        return true;
    }

    if (name === '__drop_bundle') {
        if (S.conjureEquipped) {
            ctx.log({ t: S.t, type: 'drop', weapon: S.conjureEquipped });
            ctx.addStep({ skill: name, start: S.t, end: S.t, att: S.att, type: 'drop', ri: S._ri });
            ctx.clearConjure();
            ctx.procOnSwapSigils(S.t);
        }
        return true;
    }

    if (!name.startsWith('__pickup_')) return false;

    const weapon = name.slice(9);
    const start = S.t;
    const end = start + PICKUP_CAST_MS;
    const pickup = ctx.takeConjurePickup(weapon, end);
    if (pickup) {
        ctx.beginCast(`Pick up ${weapon}`, start, PICKUP_CAST_MS);
        ctx.finishCast(`Pick up ${weapon}`, end, { setCastUntil: true });
        ctx.equipConjure(weapon);
        ctx.log({ t: end, type: 'pickup', weapon });
        ctx.addStep({ skill: name, start, end, att: S.att, type: 'pickup', ri: S._ri });
        ctx.procOnSwapSigils(end);
        if (S._hasConjurer) ctx.applyAura('Fire Aura', 4000, end, 'Conjurer');
    } else {
        ctx.log({ t: start, type: 'err', msg: `No ${weapon} pickup available` });
    }

    return true;
}

export function applyPreludeStateRules(ctx) {
    const { S } = ctx;
    handleRockBarrierExpiry(ctx);
    if (S.weaveSelfUntil > 0 && S.t >= S.weaveSelfUntil && S.perfectWeaveUntil <= S.t) {
        ctx.resetWeaveSelfState();
        ctx.setChainProgress('Weave Self', 'Weave Self');
        ctx.log({ t: S.t, type: 'skill_proc', skill: 'Weave Self', detail: 'expired - chain reset' });
    }
}

export function validateTailoredVictory(ctx, name) {
    const { S } = ctx;
    if (name !== 'Tailored Victory' || S.perfectWeaveUntil > S.t) return true;

    ctx.log({ t: S.t, type: 'err', msg: 'Tailored Victory requires Perfect Weave to be active' });
    return false;
}

export function validateConjureWeaponRequirements(ctx, sk, name) {
    const { S } = ctx;
    if (ctx.conjureWeapons.has(sk.weapon) && S.conjureEquipped !== sk.weapon) {
        ctx.log({ t: S.t, type: 'err', msg: `Need ${sk.weapon} equipped for ${name}` });
        return false;
    }
    if (S.conjureEquipped && sk.type === 'Weapon skill' && !ctx.conjureWeapons.has(sk.weapon)) {
        ctx.log({ t: S.t, type: 'err', msg: `Cannot use ${name} while wielding ${S.conjureEquipped}` });
        return false;
    }
    return true;
}

export function detectAACarryoverSkill(ctx, sk, name) {
    const { S } = ctx;
    if (!S.aaCarryover || sk.slot !== '1') return false;

    const expected = getChainProgress(S, S.aaCarryover.root);
    return name === expected;
}

export function validateAttunementAccess(ctx, sk, name, isAACarryover) {
    const { S } = ctx;
    if (isAACarryover || !sk.attunement || ctx.attOK(sk)) return true;

    const inDesc = S.eliteSpec === 'Weaver' ? `${S.att}/${S.att2}` : S.att;
    ctx.log({ t: S.t, type: 'err', msg: `Wrong attunement for ${name} (need ${sk.attunement}, in ${inDesc})` });
    return false;
}

export function validateEnduranceAccess(ctx, sk, name) {
    const enduranceDelta = sk.endurance || 0;
    if (enduranceDelta >= 0) return true;

    const cost = Math.abs(enduranceDelta);
    const readyAt = ctx.getEnduranceReadyTime(cost, ctx.S.t);
    if (Number.isFinite(readyAt) && readyAt > ctx.S.t) {
        ctx.advanceTimeTo(Math.ceil(readyAt));
    }
    if ((ctx.S.endurance ?? 100) >= cost) return true;

    ctx.log({
        t: ctx.S.t,
        type: 'err',
        msg: `Not enough Endurance for ${name} (need ${cost}, have ${(ctx.S.endurance ?? 0).toFixed(1)})`,
    });
    return false;
}

export function validateChainAccess(ctx, sk, name) {
    const { S } = ctx;
    const isAuraTransmute = !!AURA_TRANSMUTE_SKILLS[sk?.name];
    if (isAuraTransmute) return isAuraTransmuteAvailable(ctx, sk, S.t);
    if (!sk.chainSkill) return true;

    const chainRoot = ctx.getChainRoot(sk);
    let expected = getChainProgress(S, chainRoot);
    const expiryAt = getChainExpiry(S, chainRoot);
    if (sk.slot !== '1' && expiryAt !== undefined && expiryAt <= S.t) {
        ctx.expireChainProgress(chainRoot);
        expected = chainRoot;
    }

    if (name === expected) return true;

    ctx.log({ t: S.t, type: 'err', msg: `Chain: need ${expected}, got ${name}` });
    return false;
}

export function validateEtchingAccess(ctx, name) {
    const { S } = ctx;
    const etchChain = ctx.etchingLookup.get(name);
    if (!etchChain) return true;

    const state = S.etchingState[etchChain.etching];
    if (name === etchChain.lesser) {
        if (state === 'lesser') return true;
        ctx.log({ t: S.t, type: 'err', msg: `Etching: need to cast ${etchChain.etching} first` });
        return false;
    }

    if (name === etchChain.full) {
        if (state === 'full') return true;
        ctx.log({ t: S.t, type: 'err', msg: `Etching: ${etchChain.full} requires 3 other Spear casts after ${etchChain.etching}` });
        return false;
    }

    return true;
}

export function applyHammerPreludeRules(ctx, sk, name) {
    const { S } = ctx;
    if (sk.weapon !== 'Hammer' || sk.type !== 'Weapon skill') return true;

    const isGF = name === 'Grand Finale';
    const isOrbSkill = ctx.hammerAllOrbNames.has(name);
    if (isOrbSkill && hasUsedHammerOrbSkill(S, name)) {
        ctx.log({ t: S.t, type: 'err', msg: `${name}: must cast Grand Finale before using this orb skill again` });
        return false;
    }

    const lastHammerOrbCast = getHammerOrbLastCast(S);
    if ((isGF || isOrbSkill) && lastHammerOrbCast > -Infinity) {
        const sinceLast = S.t - lastHammerOrbCast;
        if (sinceLast < ctx.hammerOrbIcdMs) ctx.setTime(lastHammerOrbCast + ctx.hammerOrbIcdMs);
    }

    if (!isGF) return true;

    const activeOrbs = ctx.hammerActiveOrbs(S.t);
    if (activeOrbs.length === 0) {
        ctx.log({ t: S.t, type: 'err', msg: 'Grand Finale: no active orbs' });
        return false;
    }
    if (ctx.hammerGFAvailable(S.t)) return true;

    ctx.log({ t: S.t, type: 'err', msg: `Grand Finale: need an orb from current attunement (${S.att}${S.att2 ? '/' + S.att2 : ''})` });
    return false;
}
