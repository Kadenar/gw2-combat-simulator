import { getProcState } from '../state/sim-proc-state.js';
import { getAttunementCooldownReadyAt } from '../state/sim-cooldown-state.js';

export function advanceSwapToReadyTime(ctx, target) {
    const { S } = ctx;
    const procState = getProcState(S);
    let cdReady = getAttunementCooldownReadyAt(S, target);

    if (target === 'Air' && S.t < cdReady) {
        if (procState.freshAirResetAt >= 0 && procState.freshAirResetAt <= S.t) {
            cdReady = procState.freshAirResetAt;
        } else {
            const faTime = ctx.freshAirResetTimeInRange(0, cdReady);
            if (faTime !== null) cdReady = faTime;
        }
    }

    ctx.advanceTimeTo(cdReady);
}

export function applySharedSwapElementEffects(ctx, {
    prevPrimary,
    target,
    allowFreshAirBuff,
}) {
    const { S } = ctx;
    if (target === 'Fire') ctx.triggerSunspot(S.t);
    if (prevPrimary === 'Fire' && target !== 'Fire') ctx.triggerFlameExpulsion(S.t);

    if (target === 'Air') {
        ctx.triggerElectricDischarge(S.t);
        if (S._hasOneWithAir) ctx.trackEffect('Superspeed', 1, 3, S.t);
        if (S._hasInscription) ctx.trackEffect('Resistance', 1, 3, S.t);
        if (allowFreshAirBuff && S._hasFreshAir) ctx.applyFreshAirBuff(S.t);
    }

    if (target === 'Water') {
        if (S._hasLatentStamina && ctx.traitIcdReady('LatentStamina', S.t)) {
            ctx.armTraitIcd('LatentStamina', S.t, 10000);
            ctx.trackEffect('Vigor', 1, 3, S.t);
        }
    }

    if (target === 'Earth') {
        ctx.triggerEarthenBlast(S.t);
        if (S._hasRockSolid) ctx.grantRockSolid(S.t);
    }

    if (S._hasArcaneProwess) ctx.trackEffect('Might', 1, 8, S.t);
}
