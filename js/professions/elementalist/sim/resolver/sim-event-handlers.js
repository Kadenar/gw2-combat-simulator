import {
    isApplyEffectEvent,
    isRuntimeActionEvent,
    isRelicActivateEvent,
} from '../shared/sim-events.js';
import { applyRuntimeAction } from '../shared/sim-deferred-runtime-actions.js';
import { handleConditionTickEvent as resolveConditionTickEvent } from './sim-condition-resolution.js';
import { getProcState } from '../state/sim-proc-state.js';
import { getRelicState } from '../state/sim-relic-state.js';
import { pushReportingLog, pushReportingStep } from '../state/sim-reporting-state.js';

const ELECTRIC_ENCHANTMENT_ICON = 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png';

export function handleApplyEffectEvent(ctx, ev) {
    const { S } = ctx;
    if (!isApplyEffectEvent(ev) || ev.effect !== 'Shattering Ice') return;

    ctx.pushCondStack({
        t: ev.time,
        cond: 'Shattering Ice',
        expiresAt: ev.time + ev.duration
    });

    ctx.setTraitIcd('ShatteringIce', ev.time);

    pushReportingLog(S, {
        t: ev.time,
        type: 'effect_apply',
        effect: 'Shattering Ice',
        duration: ev.duration
    });
}

export function handleRuntimeActionEvent(ctx, ev) {
    if (!isRuntimeActionEvent(ev)) return false;
    applyRuntimeAction(ctx, ev.action);
    return true;
}

export function handleRelicActivateEvent(ctx, ev) {
    const { S } = ctx;
    const relicState = getRelicState(S);
    if (!isRelicActivateEvent(ev)) return false;

    const rp = ctx.getRelicProc(ev.relic);
    if (rp && rp.effectDuration > 0) {
        relicState.buffUntil = Math.max(relicState.buffUntil, ev.time + rp.effectDuration);
    }
    if (ev.applyEffects && rp) {
        if (rp.conditions) {
            for (const [c, v] of Object.entries(rp.conditions)) {
                if (ctx.isDamagingCondition(c)) {
                    ctx.applyCondition(c, v.stacks, v.dur, ev.time, `Relic of ${ev.relic}`);
                } else {
                    ctx.trackEffect(c, v.stacks, v.dur, ev.time);
                }
            }
        }
        if (rp.strikeCoeff) {
            ctx.queueHitEvent({
                time: ev.time,
                skill: `Relic of ${ev.relic}`, hitIdx: 1, sub: 1, totalSubs: 1,
                dmg: rp.strikeCoeff, ws: rp.strikeWs,
                isField: false, cc: false, conds: null,
                isRelicProc: true, noCrit: false, att: S.att,
            });
        }
    }
    pushReportingLog(S, { t: ev.time, type: 'relic_proc', relic: ev.relic, skill: `Relic of ${ev.relic}` });
    pushReportingStep(S, { skill: `Relic of ${ev.relic}`, start: ev.time, end: ev.time, att: S.att, type: 'relic_proc', ri: -1, icon: rp?.icon });
    return true;
}

export function handleConditionTickEvent(ctx, ev, {
    might,
    empMul,
    condDmg,
    vulnMul,
}) {
    return resolveConditionTickEvent(ctx, ev, {
        might,
        empMul,
        condDmg,
        vulnMul,
    });
}

export function isPlayerHitEvent(ev) {
    return !ev.isSigilProc && !ev.isRelicProc && !ev.isTraitProc;
}

export function isDirectStrikeHit(ev) {
    return isPlayerHitEvent(ev) && ev.dmg > 0 && ev.ws > 0;
}

export function isDamagingHit(ev) {
    return isPlayerHitEvent(ev) && ev.dmg > 0;
}

export function buildHitTriggerContext(ev) {
    const playerHit = isPlayerHitEvent(ev);
    const directStrike = playerHit && ev.dmg > 0 && ev.ws > 0;
    const damagingHit = playerHit && ev.dmg > 0;
    return {
        playerHit,
        directStrike,
        damagingHit,
        ccPlayerHit: playerHit && !!ev.cc,
    };
}

export function enqueueTriggeredHit(ctx, queuedHit, { logEntry = null, stepEntry = null }) {
    const { S } = ctx;
    ctx.queueHitEvent(queuedHit);
    if (logEntry) pushReportingLog(S, logEntry);
    if (stepEntry) pushReportingStep(S, stepEntry);
}

export function runPreHitRules(ctx, ev) {
    const { S } = ctx;
    const procState = getProcState(S);
    if (ctx.canTriggerShatteringIceProc(ev)) {
        ctx.queueShatteringIceProc(ev);
    }

    if (ev.familiarCastId) {
        const canceledBySkill = procState.familiarCanceledCastIds?.[ev.familiarCastId];
        if (canceledBySkill) {
            if (!procState.familiarCanceledLoggedCastIds?.[ev.familiarCastId]) {
                procState.familiarCanceledLoggedCastIds[ev.familiarCastId] = true;
                pushReportingLog(S, {
                    t: ev.time,
                    type: 'skip',
                    skill: ev.skill,
                    reason: `interrupted by ${canceledBySkill}`,
                });
            }
            return false;
        }
    }

    if (ctx.shouldSkipHammerOrbHit(ev)) {
        pushReportingLog(S, { t: ev.time, type: 'skip', skill: ev.skill, reason: 'orb consumed by Grand Finale' });
        return false;
    }

    return true;
}

export function handleCritAndCcTriggers(ctx, ev, hitCtx, triggerCtx) {
    const { S } = ctx;
    if (triggerCtx.directStrike) {
        ctx.checkOnCritSigils(ev.time, hitCtx.cc);
        if (S._hasBurningPrecision) ctx.checkBurningPrecision(ev.time, hitCtx.cc);
        if (S._hasRagingStorm) ctx.checkRagingStorm(ev.time, hitCtx.cc);
        if (S._hasFreshAir) ctx.checkFreshAir(ev.time, hitCtx.cc);
        if (S._hasArcanePrecision) ctx.checkArcanePrecision(ev.time, hitCtx.cc, hitCtx.hitAtt);
        if (S._hasRenewingStamina) ctx.checkRenewingStamina(ev.time, hitCtx.cc);
        if (S._foodProc) ctx.checkFoodCritProc(ev.time, hitCtx.cc);
    }

    if (S._hasLightningRod && triggerCtx.ccPlayerHit) {
        ctx.triggerLightningRod(ev.time);
    }

    if (triggerCtx.ccPlayerHit) {
        ctx.procOnCcSigils(ev.time);
    }

    if (S._hasElementalPursuit && triggerCtx.ccPlayerHit) {
        ctx.trackEffect('Swiftness', 1, 3, ev.time);
    }

    if (S._hasViciousEmpowerment && triggerCtx.ccPlayerHit
        && ctx.traitIcdReady('ViciousEmp', ev.time)) {
        ctx.armTraitIcd('ViciousEmp', ev.time, 250);
        ctx.grantElemEmpowerment(2, ev.time, 'Vicious Empowerment');
        ctx.trackEffect('Might', 2, 10, ev.time);
    }

    if (S._hasElemLockdown && triggerCtx.ccPlayerHit
        && ctx.traitIcdReady('ElemLockdown', ev.time)) {
        ctx.armTraitIcd('ElemLockdown', ev.time, 1000);
        if (hitCtx.hitAtt === 'Fire') ctx.trackEffect('Might', 5, 5, ev.time);
        else if (hitCtx.hitAtt === 'Water') ctx.trackEffect('Regeneration', 1, 10, ev.time);
        else if (hitCtx.hitAtt === 'Air') ctx.trackEffect('Fury', 1, 5, ev.time);
        else if (hitCtx.hitAtt === 'Earth') ctx.trackEffect('Protection', 1, 4, ev.time);
    }
}

export function handleOverloadHitEffects(ctx, ev) {
    const { S } = ctx;
    if (S._hasLucidSingularity && ev.skill.startsWith('Overload ')) {
        if (ev.hitIdx >= 1 && ev.hitIdx <= 4) ctx.trackEffect('Alacrity', 1, 1, ev.time);
        else if (ev.hitIdx === 5) ctx.trackEffect('Alacrity', 1, 4.5, ev.time);
    }
}

export function handlePostHitRuntimeActions(ctx, ev) {
    const actions = ev.postHitActions;
    if (!Array.isArray(actions) || actions.length === 0) return;
    for (const action of actions) {
        ctx.queueRuntimeActionEvent(action, { priority: -1 });
    }
}

export function handleComboHitEffects(ctx, ev, triggerCtx) {
    if (!triggerCtx.playerHit) return;
    ctx.checkCombo(ev);
}

export function handleRecurringHammerOrbHits(ctx, ev) {
    if (!ev.hammerOrbElement || !(ev.hammerOrbRepeatMs > 0)) return;

    const { _queueSeq, ...evWithoutQueueSeq } = ev;
    const nextEv = {
        ...evWithoutQueueSeq,
        time: ev.time + ev.hammerOrbRepeatMs,
    };
    if (!ctx.shouldSkipHammerOrbHit(nextEv)) {
        ctx.queueHitEvent(nextEv);
    }
}

export function handleQueuedFollowupHits(ctx, ev, triggerCtx) {
    if (ctx.canTriggerShatteringIceProc(ev)) {
        ctx.queueShatteringIceProc(ev);
    }
}

export function handlePostHitConditions(ctx, ev, triggerCtx) {
    const { S, activeRelic } = ctx;
    const procState = getProcState(S);
    if (procState.sigilDoomPending && triggerCtx.damagingHit) {
        const dp = ctx.getSigilProc('Doom');
        ctx.applyCondition(dp.cond, dp.stacks, dp.dur, ev.time, 'Sigil of Doom');
        procState.sigilDoomPending = false;
        pushReportingLog(S, { t: ev.time, type: 'sigil_proc', sigil: 'Doom', skill: 'Sigil of Doom' });
        pushReportingStep(S, { skill: 'Sigil of Doom', start: ev.time, end: ev.time, att: S.att, type: 'sigil_proc', ri: -1, icon: dp.icon });
    }

    if (procState.electricEnchantmentStacks > 0 && triggerCtx.directStrike) {
        procState.electricEnchantmentStacks--;
        enqueueTriggeredHit(ctx, {
            time: ev.time,
            skill: 'Electric Enchantment', hitIdx: 1, sub: 1, totalSubs: 1,
            dmg: 0.4, ws: 690.5,
            isField: false, cc: false,
            conds: { Burning: { stacks: 1, duration: 1.5 } },
            isTraitProc: true, noCrit: false, att: S.att, att2: S.att2 || null,
        }, {
            logEntry: { t: ev.time, type: 'trait_proc', trait: 'Electric Enchantment' },
            stepEntry: {
                skill: 'Electric Enchantment', start: ev.time, end: ev.time,
                att: S.att, type: 'trait_proc', ri: -1,
                icon: ELECTRIC_ENCHANTMENT_ICON,
            },
        });
    }

    if (ev.frigidFlurryProc && triggerCtx.playerHit) {
        ctx.checkCombo({ ...ev, finType: 'Projectile', finVal: 0.2 });
    }

    if (procState.shatteringStoneHits > 0 && ev.time <= procState.shatteringStoneUntil
        && triggerCtx.directStrike) {
        procState.shatteringStoneHits--;
        ctx.applyCondition('Bleeding', 1, 5, ev.time, 'Shattering Stone');
        if (procState.shatteringStoneHits <= 0) procState.shatteringStoneUntil = 0;
        pushReportingLog(S, { t: ev.time, type: 'skill_proc', skill: 'Shattering Stone', detail: `Bleed proc (${procState.shatteringStoneHits} left)` });
    }

    if (activeRelic && triggerCtx.playerHit) {
        ctx.checkRelicOnHit(ev);
    }
}

export function handlePostHitTriggers(ctx, ev, hitCtx, triggerCtx) {
    handlePostHitRuntimeActions(ctx, ev);
    handleCritAndCcTriggers(ctx, ev, hitCtx, triggerCtx);
    handleOverloadHitEffects(ctx, ev);
    handleComboHitEffects(ctx, ev, triggerCtx);
    handleRecurringHammerOrbHits(ctx, ev);
    handleQueuedFollowupHits(ctx, ev, triggerCtx);
    handlePostHitConditions(ctx, ev, triggerCtx);
}

export function handleHitEvent(ctx, ev, {
    tgtHP,
    might,
    empMul,
    condDmg,
    vulnMul,
}) {
    const { skipVuln, sigilMuls, basePower, baseCritCh, critDmg, skipFury } = ctx;
    const triggerCtx = buildHitTriggerContext(ev);
    if (!runPreHitRules(ctx, ev)) {
        return false;
    }

    const hitCtx = ctx.buildHitResolutionContext(ev, {
        sigilMuls,
        basePower,
        baseCritCh,
        critDmg,
        tgtHP,
        skipFury,
        might,
        empMul,
        condDmg,
        vulnMul,
    });

    ctx.applyResolvedHit(ev, hitCtx, { skipVuln });
    handlePostHitTriggers(ctx, ev, hitCtx, triggerCtx);
    return true;
}
