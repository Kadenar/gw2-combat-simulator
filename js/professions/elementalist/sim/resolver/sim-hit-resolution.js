import { expectedCritMultiplier } from '../../../../platform/gw2/damage.js';
import { MIGHT_ATTRIBUTE_BONUS_PER_STACK } from '../../../../platform/gw2/runtime-rules.js';
import { getEvokerState } from '../state/sim-specialization-state.js';
import { getActiveConditionStacks } from '../state/sim-runtime-state.js';
import { applyRuntimeAction } from '../shared/sim-deferred-runtime-actions.js';

function checkWsBonusWindow(windows, t) {
    if (!windows) return false;
    for (const w of windows) {
        if (t >= w.start && t < w.end) return true;
    }
    return false;
}

function hasActiveConditionOrPermaBoon(S, cond, time) {
    return (getActiveConditionStacks(S, cond, time).length > 0)
        || !!(S.permaBoons?.[cond]);
}

function buildHitEffectSnapshot(ctx, ev) {
    const { S } = ctx;
    const evokerState = getEvokerState(S);
    const time = ev.time;
    const effectStacks = effect => ctx.effectStacksAt(effect, time);

    return {
        freshAirActive: S._hasFreshAir
            && !S._suppressFreshAirContributionBuff
            && effectStacks('Fresh Air') > 0,
        nourysActive: S.activeRelic === 'Nourys' && effectStacks('Nourys') > 0,
        severanceUp: effectStacks('Severance') > 0,
        arcaneLightningActive: S._hasArcaneLightning && effectStacks('Arcane Lightning') > 0,
        weaknessActive: S._hasSuperiorElements && effectStacks('Weakness') > 0,
        hammerAirOrbUp: effectStacks('Hammer Orb Air') > 0,
        persistingFlamesStacks: S._hasPersistingFlames
            ? Math.min(effectStacks('Persisting Flames'), 5)
            : 0,
        tempestuousAriaUp: S._hasTempestuousAria && effectStacks('Tempestuous Aria') > 0,
        transcendentTempestUp: S._hasTranscendentTempest
            && !S._suppressTranscendentTempestContributionBuff
            && effectStacks('Transcendent Tempest') > 0,
        elementsOfRageUp: S._hasElementsOfRage && effectStacks('Elements of Rage') > 0,
        empoweringAurasStacks: S._hasEmpoweringAuras
            ? Math.min(effectStacks('Empowering Auras'), 5)
            : 0,
        familiarsProwessUp: S._hasFamiliarsProwess && effectStacks("Familiar's Prowess") > 0,
        relentlessFireUp: effectStacks('Relentless Fire') > 0,
        bountifulPowerUp: S._hasBountifulPower && effectStacks('Bountiful Power Active') > 0,
        hammerFireOrbUp: effectStacks('Hammer Orb Fire') > 0,
        zapBuff: evokerState.element === 'Air' && effectStacks('Zap Buff') > 0,
    };
}

function buildTargetSnapshot(ctx, ev) {
    const { S } = ctx;
    return {
        targetHasBurning: hasActiveConditionOrPermaBoon(S, 'Burning', ev.time),
        targetHasBleeding: hasActiveConditionOrPermaBoon(S, 'Bleeding', ev.time),
        targetHasVuln: ctx.vulnStacksAt(ev.time) > 0,
    };
}

function buildPowerAndCritContext(ctx, ev, {
    basePower,
    baseCritCh,
    critDmg,
    skipFury,
    might,
    empMul,
    condDmg,
    effectSnapshot,
}) {
    const { S } = ctx;
    const evokerState = getEvokerState(S);
    const useStampedAtt = ev.isTraitProc || ev.isSigilProc || ev.isRelicProc;
    const hitAtt = useStampedAtt ? ev.att : ctx.attAt(ev.time);
    const hitAtt2 = useStampedAtt ? (ev.att2 || null) : ctx.att2At(ev.time);
    const empFlame = (S._hasEmpoweringFlame && hitAtt === 'Fire') ? 150 : 0;

    let powOvr = 0;
    if (S._hasPowerOverwhelming && might >= 10) powOvr = hitAtt === 'Fire' ? 300 : 150;

    let polyPow = 0;
    let polyFer = 0;
    if (S._hasElemPolyphony) {
        const atts = hitAtt2 !== null ? new Set([hitAtt, hitAtt2]) : new Set([hitAtt]);
        if (atts.has('Fire')) polyPow = 200;
        if (atts.has('Air')) polyFer = 200 / 15;
    }

    const empPow = Math.round((S._empPool?.Power || 0) * empMul);
    const empCritCh = (S._empPool?.Precision || 0) * empMul / 21;
    const empCritDmg = (S._empPool?.Ferocity || 0) * empMul / 15;

    const conjurePow = ev.conjure === 'Fiery Greatsword' ? 260 : 0;
    const conjureCondDmgBonus = ev.conjure === 'Fiery Greatsword' ? 180 : 0;
    const conjureFer = ev.conjure === 'Lightning Hammer' ? 75 / 15 : 0;
    const conjurePrec = ev.conjure === 'Lightning Hammer' ? 180 / 21 : 0;

    const hitCondDmg = condDmg + conjureCondDmgBonus;
    const power = basePower
        + might * MIGHT_ATTRIBUTE_BONUS_PER_STACK
        + empFlame + powOvr + polyPow + empPow + conjurePow;

    const fury = skipFury ? false : ctx.hasFuryAt(ev.time);
    const ragingFerocity = (S._hasRagingStorm && fury) ? 12 : 0;
    const aeroFerocity = (S._hasAeroTraining && hitAtt === 'Air') ? 10 : 0;
    const freshAirFerocity = effectSnapshot.freshAirActive ? (250 / 15) : 0;
    const severanceFerocity = effectSnapshot.severanceUp ? (250 / 15) : 0;
    const zapPassiveFer = (evokerState.element === 'Air' && fury) ? 75 / 15 : 0;
    const arcaneLightningFer = effectSnapshot.arcaneLightningActive ? 150 / 15 : 0;
    const effectiveCritDmg = critDmg + ragingFerocity + aeroFerocity
        + freshAirFerocity + severanceFerocity + polyFer + empCritDmg + conjureFer + zapPassiveFer + arcaneLightningFer + (ev.bonusCritDmg || 0);

    const signetFireLost = ctx.signetFirePassiveLostAt(ev.time) ? (180 / 21) : 0;
    const supElemCrit = effectSnapshot.weaknessActive ? 20 : 0;
    const hammerAirCritBonus = effectSnapshot.hammerAirOrbUp ? 15 : 0;
    const severanceCritBonus = effectSnapshot.severanceUp ? (250 / 21) : 0;
    const mistburnCritBonus = S.activeRelic === 'Mistburn'
        && might >= (ctx.getRelicProc('Mistburn')?.mightThreshold || 10)
        ? (ctx.getRelicProc('Mistburn')?.criticalChance || 0)
        : 0;
    const cc = ev.noCrit ? 0 : (ev.spearForceCrit ? 100 : Math.min(
        baseCritCh + (fury ? S._furyCritBonus : 0) - signetFireLost + supElemCrit
        + empCritCh + conjurePrec + hammerAirCritBonus + severanceCritBonus + mistburnCritBonus,
        100
    ));

    return {
        hitAtt,
        hitAtt2,
        empFlame,
        powOvr,
        polyPow,
        polyFer,
        mistburnCritBonus,
        power,
        hitCondDmg,
        fury,
        effectiveCritDmg,
        cc,
    };
}

function buildStrikeAndConditionMultipliers(ctx, ev, {
    sigilMuls,
    tgtHP,
    vulnMul,
    hitAtt,
    cc,
    effectiveCritDmg,
    effectSnapshot,
    targetSnapshot,
}) {
    const { S } = ctx;
    const evokerState = getEvokerState(S);
    const critCtx = buildCritMultiplierContext(ctx, ev, tgtHP, cc, effectiveCritDmg);

    const pfStacks = effectSnapshot.persistingFlamesStacks;
    const tempAriaUp = effectSnapshot.tempestuousAriaUp;
    const transcTempUp = effectSnapshot.transcendentTempestUp;
    const elemRageUp = effectSnapshot.elementsOfRageUp;
    const empAurasStacks = effectSnapshot.empoweringAurasStacks;
    const famProwessUp = effectSnapshot.familiarsProwessUp;
    const fpPct = famProwessUp ? (S._hasFamiliarsFocus ? 0.10 : 0.05) : 0;
    const fpStrike = (famProwessUp && evokerState.element === 'Air') ? fpPct : 0;
    const fpCond = (famProwessUp && evokerState.element === 'Fire') ? fpPct : 0;
    const relentlessFireUp = effectSnapshot.relentlessFireUp;
    const bountifulPowerUp = effectSnapshot.bountifulPowerUp;
    const hammerFireOrbUp = effectSnapshot.hammerFireOrbUp;
    const nourysStrikeAdd = effectSnapshot.nourysActive ? (ctx.getRelicProc('Nourys')?.strikeDmgA || 0) : 0;
    const nourysCondAdd = effectSnapshot.nourysActive ? (ctx.getRelicProc('Nourys')?.condDmgA || 0) : 0;
    const wsFireBonus = checkWsBonusWindow(S.wsFireBonusWindows, ev.time);
    const wsAirBonus = checkWsBonusWindow(S.wsAirBonusWindows, ev.time);

    const addStrike = pfStacks * 0.02
        + (tempAriaUp ? 0.10 : 0)
        + (transcTempUp ? 0.25 : 0)
        + (elemRageUp ? 0.15 : 0)
        + empAurasStacks * 0.01
        + (relentlessFireUp ? 0.10 : 0)
        + (bountifulPowerUp ? 0.20 : 0)
        + (wsAirBonus ? 0.10 : 0)
        + fpStrike
        + (hammerFireOrbUp ? 0.05 : 0)
        + nourysStrikeAdd;
    const addCond = (tempAriaUp ? 0.05 : 0)
        + (transcTempUp ? 0.20 : 0)
        + (elemRageUp ? 0.10 : 0)
        + empAurasStacks * 0.01
        + (wsFireBonus ? 0.20 : 0)
        + fpCond
        + (hammerFireOrbUp ? 0.05 : 0)
        + nourysCondAdd;

    const baseStrike = (1 + sigilMuls.strikeAdd + addStrike) * sigilMuls.strikeMul;
    const baseCond = (1 + sigilMuls.condAdd + addCond) * sigilMuls.condMul;

    const targetHasBurning = (S._hasPyroTraining || S._hasFieryMight)
        ? targetSnapshot.targetHasBurning
        : false;
    const pyroMul = (S._hasPyroTraining && targetHasBurning) ? 1.07 : 1;
    const fieryMightMul = (S._hasFieryMight && targetHasBurning) ? 1.05 : 1;

    const hasBleeding = S._hasSerratedStones && targetSnapshot.targetHasBleeding;
    const serratedMul = hasBleeding ? 1.05 : 1;
    const stormsoulMul = S._hasStormsoul ? 1.07 : 1;
    const flowLikeWaterMul = S._hasFlowLikeWater ? 1.10 : 1;
    const boltMul = (S._hasBoltToHeart && tgtHP < Infinity
        && (S.totalStrike + S.totalCond) >= tgtHP * 0.5) ? 1.20 : 1;

    const zapMul = effectSnapshot.zapBuff ? 1.03 : 1;
    const targetHasVuln = targetSnapshot.targetHasVuln;
    const piercingShardsMul = (S._hasPiercingShards && targetHasVuln)
        ? (hitAtt === 'Water' ? 1.14 : 1.07) : 1;
    const seetheMul = ev.spearDmgBonus ? 1.2 : 1;

    const strikeMul = baseStrike * vulnMul * critCtx.relicStrikeMul
        * pyroMul * fieryMightMul * serratedMul * stormsoulMul
        * flowLikeWaterMul * boltMul * zapMul * piercingShardsMul * seetheMul;
    const cMul = baseCond * vulnMul;

    return {
        ...critCtx,
        addStrike,
        baseStrike,
        sigilStrikeAdd: sigilMuls.strikeAdd,
        sigilStrikeMul: sigilMuls.strikeMul,
        pyroMul,
        fieryMightMul,
        serratedMul,
        stormsoulMul,
        flowLikeWaterMul,
        zapMul,
        piercingShardsMul,
        boltMul,
        strikeMul,
        cMul,
    };
}

function buildCritMultiplierContext(ctx, ev, tgtHP, cc, effectiveCritDmg) {
    const critMult = ev.doubleOnCrit
        ? buildDoubleOnCritExpectedMultiplier(cc, effectiveCritDmg)
        : expectedCritMultiplier(cc, effectiveCritDmg);
    const relicStrikeMul = ctx.getRelicStrikeMul(ev, tgtHP);
    return { critMult, relicStrikeMul };
}

function buildDoubleOnCritExpectedMultiplier(critChancePct, critDamagePct) {
    const cc = Math.min(critChancePct / 100, 1);
    const critOnlyMultiplier = critDamagePct / 100;
    return 1 + cc * ((critOnlyMultiplier * 2) - 1);
}

function buildProcEvent(ctx, ev) {
    let procEv = ev;
    const resolveActions = Array.isArray(ev.onResolveActions) ? ev.onResolveActions : [];
    for (const action of resolveActions) {
        applyRuntimeAction(ctx, action);
        if (action.type === 'primordial_stance') {
            procEv = procEv === ev ? { ...ev, conds: null } : { ...procEv, conds: null };
        }
    }
    if (ev.spearCCHit && procEv === ev) procEv = { ...ev, cc: true };
    else if (ev.spearCCHit) procEv = { ...procEv, cc: true };
    return procEv;
}

export function buildHitResolutionContext(ctx, ev, {
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
}) {
    const effectSnapshot = buildHitEffectSnapshot(ctx, ev);
    const targetSnapshot = buildTargetSnapshot(ctx, ev);
    const statCtx = buildPowerAndCritContext(ctx, ev, {
        basePower,
        baseCritCh,
        critDmg,
        skipFury,
        might,
        empMul,
        condDmg,
        effectSnapshot,
    });

    const multCtx = buildStrikeAndConditionMultipliers(ctx, ev, {
        sigilMuls,
        tgtHP,
        vulnMul,
        hitAtt: statCtx.hitAtt,
        cc: statCtx.cc,
        effectiveCritDmg: statCtx.effectiveCritDmg,
        effectSnapshot,
        targetSnapshot,
    });

    return {
        procEv: buildProcEvent(ctx, ev),
        hitAtt: statCtx.hitAtt,
        hitAtt2: statCtx.hitAtt2,
        might,
        fury: statCtx.fury,
        power: statCtx.power,
        hitCondDmg: statCtx.hitCondDmg,
        effectiveCritDmg: statCtx.effectiveCritDmg,
        cc: statCtx.cc,
        critMult: multCtx.critMult,
        strikeMul: multCtx.strikeMul,
        cMul: multCtx.cMul,
        pyroMul: multCtx.pyroMul,
        stormsoulMul: multCtx.stormsoulMul,
        boltMul: multCtx.boltMul,
        serratedMul: multCtx.serratedMul,
        fieryMightMul: multCtx.fieryMightMul,
        piercingShardsMul: multCtx.piercingShardsMul,
        flowLikeWaterMul: multCtx.flowLikeWaterMul,
        zapMul: multCtx.zapMul,
        relicStrikeMul: multCtx.relicStrikeMul,
        empFlame: statCtx.empFlame,
        powOvr: statCtx.powOvr,
        polyPow: statCtx.polyPow,
        polyFer: statCtx.polyFer,
        mistburnCritBonus: statCtx.mistburnCritBonus,
        addStrike: multCtx.addStrike,
        baseStrike: multCtx.baseStrike,
        vulnMul,
    };
}

export function applyResolvedHit(ctx, ev, hitCtx, { skipVuln }) {
    const { S } = ctx;
    ctx.procHit(hitCtx.procEv, hitCtx.power, hitCtx.hitCondDmg, hitCtx.critMult, hitCtx.strikeMul, hitCtx.cMul);

    const hitLog = S.log[S.log.length - 1];
    if (hitLog && hitLog.type === 'hit') {
        hitLog.diag = {
            power: hitCtx.power,
            ws: ev.ws,
            condDmg: hitCtx.hitCondDmg,
            critCh: hitCtx.cc,
            critDmg: hitCtx.effectiveCritDmg,
            critMul: hitCtx.critMult,
            might: hitCtx.might ?? undefined,
            fury: hitCtx.fury ?? undefined,
            vulnStacks: skipVuln ? 0 : ctx.vulnStacksAt(ev.time),
            vulnMul: hitCtx.vulnMul,
            strikeMul: hitCtx.strikeMul,
            baseStrike: hitCtx.baseStrike,
            addStrike: hitCtx.addStrike,
            sigilStrikeAdd: hitCtx.sigilStrikeAdd,
            sigilStrikeMul: hitCtx.sigilStrikeMul,
            pyroMul: hitCtx.pyroMul,
            stormMul: hitCtx.stormsoulMul,
            boltMul: hitCtx.boltMul,
            serratedMul: hitCtx.serratedMul,
            fieryMightMul: hitCtx.fieryMightMul,
            piercingShardsMul: hitCtx.piercingShardsMul,
            flowLikeWaterMul: hitCtx.flowLikeWaterMul,
            zapMul: hitCtx.zapMul,
            relicStrikeMul: hitCtx.relicStrikeMul,
            condMul: hitCtx.cMul,
            att: hitCtx.hitAtt,
            att2: hitCtx.hitAtt2,
            empFlame: hitCtx.empFlame,
            powOvr: hitCtx.powOvr,
            polyPow: hitCtx.polyPow,
            polyFer: hitCtx.polyFer,
            mistburnCritBonus: hitCtx.mistburnCritBonus,
        };
    }
}
