import { enqueueHitEvent, isHitEvent } from '../shared/sim-events.js';
import {
    addCatalystEnergy,
    getCatalystState,
    getEvokerState,
} from '../state/sim-specialization-state.js';
import { getProcState } from '../state/sim-proc-state.js';
import {
    buildCastWindow,
    runConcurrentSteps,
} from './sim-cast-window.js';
import { updateSpearEtchingProgression } from './sim-cast-followups.js';
import { getSkillCooldownReadyAt } from '../state/sim-cooldown-state.js';
import { isCombatActiveAt } from '../run/sim-run-phase-state.js';

const ELECTRIC_ENCHANTMENT_ICON = 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png';
const FAMILIAR_INTERRUPT_WINDOWS = Object.freeze({
    Ignite: { empowered: 'Conflagration', windowMs: 2400 },
    Zap: { empowered: 'Lightning Blitz', windowMs: 2300 },
    Splash: { empowered: 'Buoyant Deluge', windowMs: 2400 },
    Calcify: { empowered: 'Seismic Impact', windowMs: 2200 },
});
const FAMILIAR_FLIP_DELAYS = Object.freeze({
    Ignite: { empowered: 'Conflagration', delayMs: 960 },
    Zap: { empowered: 'Lightning Blitz', delayMs: 680 },
    Splash: { empowered: 'Buoyant Deluge', delayMs: 840 },
    Calcify: { empowered: 'Seismic Impact', delayMs: 280 },
});
const FAMILIAR_BASIC_BY_EMPOWERED = Object.freeze(Object.fromEntries(
    Object.entries(FAMILIAR_INTERRUPT_WINDOWS).map(([basic, value]) => [value.empowered, basic]),
));

function removeFutureFamiliarFieldRecords(state, skillName, fromTime) {
    const combatState = state.schedulerCombatState || state;
    const reportingState = state.schedulerReportingState || state;

    if (Array.isArray(combatState.fields)) {
        combatState.fields = combatState.fields.filter(field =>
            !(field.skill === skillName && field.start >= fromTime)
        );
    }
    if (Array.isArray(reportingState.log)) {
        reportingState.log = reportingState.log.filter(entry =>
            !(entry.type === 'field' && entry.skill === skillName && entry.t >= fromTime)
        );
    }
}

export function anySphereActiveAt(S, time) {
    const catalystState = getCatalystState(S);
    for (const w of catalystState.sphereWindows) {
        if (w.start <= time && w.end > time) return true;
    }
    return false;
}

export function flushPendingEnergy(engine, S, catalystEnergyMax) {
    const catalystState = getCatalystState(S);
    if (catalystState.energy === null) return;
    for (const ev of S.eq) {
        if (!isHitEvent(ev) || ev.dmg <= 0 || ev.ws <= 0) continue;
        if (ev.time > S.t) continue;
        if (ev._energyCredited) continue;
        // Hits that land while a Jade Sphere is active grant no energy (unless Sphere Specialist).
        if (anySphereActiveAt(S, ev.time) && !S._hasSphereSpecialist) continue;
        // Mark every eligible past hit as accounted for — even when energy is capped — so the
        // overflow is wasted instead of being stored and released after the next spend.
        ev._energyCredited = true;
        addCatalystEnergy(S, 1, catalystEnergyMax);
    }
}

export function handleJadeSphere(ctx, sk, concurrents, {
    catalystEnergyMax,
    catalystSphereCost,
}) {
    const state = ctx.S;
    const catalystState = getCatalystState(state);

    if (state.eliteSpec !== 'Catalyst') {
        ctx.log({ t: state.t, type: 'err', msg: `Jade Sphere requires Catalyst specialization` });
        return;
    }
    if (sk.attunement !== state.att) {
        ctx.log({ t: state.t, type: 'err', msg: `Need ${sk.attunement} for ${sk.name}` });
        return;
    }

    flushPendingEnergy(ctx.engine, state, catalystEnergyMax);
    if (catalystState.energy < catalystSphereCost) {
        ctx.log({ t: state.t, type: 'err', msg: `Not enough energy (${catalystState.energy}/${catalystSphereCost})` });
        return;
    }

    const cdKey = ctx.cdKey(sk);
    const cdReady = getSkillCooldownReadyAt(state, cdKey);
    ctx.advanceTimeTo(cdReady);

    ctx.spendCatalystEnergy(catalystSphereCost);
    const durMs = Math.round((sk.duration || 5) * 1000);
    ctx.activateCatalystSphere(sk.attunement, state.t, durMs);

    ctx.scheduleHits(sk, state.t, x => x);
    ctx.trackField(sk, state.t);

    if (sk.recharge > 0) {
        const baseCdMs = ctx.attunementCooldownMs(Math.round(sk.recharge * 1000));
        ctx.setSkillCooldown(cdKey, state.t + ctx.alacrityAdjustedCooldown(baseCdMs, state.t), {
            startedAt: state.t,
            displayDurationMs: baseCdMs,
            alacrityUntil: state.alacrityUntil || 0,
        });
    }

    ctx.log({ t: state.t, type: 'jade_sphere', skill: sk.name, att: sk.attunement, energy: catalystState.energy, durMs });
    ctx.recordSkillCast(sk.name, 0);
    ctx.addStep({ skill: sk.name, start: state.t, end: state.t, att: state.att, type: 'jade_sphere', ri: state._ri });
    updateSpearEtchingProgression(ctx, sk, sk.name, state.t);

    if (state._hasSpectacularSphere) {
        const durMul = state._hasSphereSpecialist ? 2 : 1;
        ctx.trackEffect('Quickness', 1, 1 * durMul, state.t);
        const att = sk.attunement;
        if (att === 'Fire') ctx.trackEffect('Might', 5, 10 * durMul, state.t);
        else if (att === 'Water') ctx.trackEffect('Vigor', 1, 5 * durMul, state.t);
        else if (att === 'Air') ctx.trackEffect('Fury', 1, 5 * durMul, state.t);
        else if (att === 'Earth') ctx.trackEffect('Aegis', 1, 3 * durMul, state.t);
    }

    if (state._hasPyroPuissance && state.att === 'Fire' && isCombatActiveAt(state, state.t)) {
        ctx.trackEffect('Might', 1, 15, state.t);
    }

    runConcurrentSteps(ctx, concurrents, {
        anchorTime: state.t,
        restoreTime: state.t,
    });
}

export function handleFamiliar(ctx, sk, concurrents, {
    evokerElementMap,
    evokerFamiliarSelectors,
}) {
    const state = ctx.S;
    const evokerState = getEvokerState(state);
    const procState = getProcState(state);

    if (state.eliteSpec !== 'Evoker') {
        ctx.log({ t: state.t, type: 'err', msg: `Familiar skills require Evoker specialization` });
        return;
    }
    const famElement = evokerElementMap[sk.name];
    if (!famElement) {
        ctx.log({ t: state.t, type: 'err', msg: `Unknown familiar: ${sk.name}` });
        return;
    }

    if (evokerState.element !== famElement) {
        ctx.log({ t: state.t, type: 'err', msg: `Need ${famElement} familiar selected for ${sk.name} (have ${evokerState.element || 'none'})` });
        return;
    }

    const isBasic = evokerFamiliarSelectors.has(sk.name);
    const chargesNeeded = state._hasSpecializedElements ? 4 : 6;
    if (isBasic) {
        if (evokerState.empowered >= 3) {
            ctx.log({ t: state.t, type: 'err', msg: `Empowered skill ready — cannot use ${sk.name}` });
            return;
        }
        if (evokerState.charges < chargesNeeded) {
            ctx.log({ t: state.t, type: 'err', msg: `Need ${chargesNeeded} familiar charges for ${sk.name} (have ${evokerState.charges})` });
            return;
        }
    } else if (evokerState.empowered < 3) {
        ctx.log({ t: state.t, type: 'err', msg: `Need 3 empowered charges for ${sk.name} (have ${evokerState.empowered})` });
        return;
    }

    const cdReady = getSkillCooldownReadyAt(state, sk.name);
    ctx.advanceTimeTo(cdReady);

    const { castMs, scaleOff, start, end } = buildCastWindow(ctx, sk, state.t);
    const familiarCastId = ++procState.familiarCastSeq;
    const interruptRule = isBasic ? FAMILIAR_INTERRUPT_WINDOWS[sk.name] : null;
    const recentEmpowered = interruptRule ? procState.lastEmpoweredFamiliarByBasic?.[sk.name] : null;
    const interruptedByRecentEmpowered = !!(interruptRule
        && recentEmpowered
        && recentEmpowered.skill === interruptRule.empowered
        && (start - recentEmpowered.start) < interruptRule.windowMs);

    if (castMs > 0) {
        ctx.beginCast(sk.name, start, castMs);
        ctx.setCastUntil(end);
    }

    if (!interruptedByRecentEmpowered && sk.name === 'Ignite') {
        const igniteDurations = [2, 0.5, 1, 1.5];
        const igniteTier = ctx.consumeEvokerIgniteTier(start, { staleAfterMs: 15000, maxTier: 3 });
        const burnDur = igniteDurations[igniteTier];
        const igniteHit = sk.hits?.[0];
        const off = igniteHit?.startOffsetMs || 880;
        enqueueHitEvent(state.eq, {
            time: start + off,
            skill: 'Ignite',
            hitIdx: 1,
            sub: 1,
            totalSubs: 1,
            dmg: 0.63,
            ws: ctx.weaponStrength(sk),
            isField: false,
            cc: false,
            conds: { Burning: { stacks: 1, duration: burnDur } },
            att: state.att,
            att2: state.att2,
            castStart: start,
            conjure: state.conjureEquipped || null,
            familiarCastId,
        });
    } else if (!interruptedByRecentEmpowered) {
        ctx.scheduleHits(sk, start, scaleOff, null, { familiarCastId });
    }

    if (castMs > 0) ctx.finishCast(sk.name, end);
    else ctx.setTime(end);

    const fieldSpawnTime = sk.name === 'Buoyant Deluge'
        ? Math.max(
            end,
            start + ((ctx.skillHits?.[sk.name]?.find(hit => (hit.hit || 0) === 1)?.startOffsetMs) || 0),
        )
        : end;
    if (!interruptedByRecentEmpowered) {
        ctx.trackField(sk, fieldSpawnTime);
    } else if (recentEmpowered) {
        procState.familiarCanceledCastIds[recentEmpowered.castId] = sk.name;
        delete procState.lastEmpoweredFamiliarByBasic[sk.name];
        removeFutureFamiliarFieldRecords(state, recentEmpowered.skill, start);
        ctx.log({
            t: end,
            type: 'skip',
            skill: recentEmpowered.skill,
            reason: `interrupted by ${sk.name}`,
        });
        ctx.log({
            t: end,
            type: 'skip',
            skill: sk.name,
            reason: `canceled by recent ${recentEmpowered.skill}`,
        });
    }

    if (isBasic) {
        ctx.setEvokerCharges(0);
        ctx.addEvokerEmpowered(1, 3);
        const flipDelay = FAMILIAR_FLIP_DELAYS[sk.name];
        if (flipDelay) {
            const flipReadyAt = end + flipDelay.delayMs;
            const currentCD = getSkillCooldownReadyAt(state, flipDelay.empowered);
            if (flipReadyAt > currentCD) {
                ctx.setSkillCooldown(flipDelay.empowered, flipReadyAt, {
                    startedAt: end,
                    displayDurationMs: flipDelay.delayMs,
                    alacrityUntil: 0,
                });
            }
        }
        ctx.log({
            t: end,
            type: 'familiar_basic',
            skill: sk.name,
            charges: 0,
            maxCharges: chargesNeeded,
            empowered: evokerState.empowered,
        });
    } else {
        ctx.setEvokerEmpowered(0);
        ctx.log({ t: end, type: 'familiar_empowered', skill: sk.name, empowered: 0 });
    }

    if (sk.recharge > 0) {
        const baseCdMs = Math.round(sk.recharge * 1000);
        ctx.setSkillCooldown(sk.name, end + ctx.alacrityAdjustedCooldown(baseCdMs, end), {
            startedAt: end,
            displayDurationMs: baseCdMs,
            alacrityUntil: state.alacrityUntil || 0,
        });
    }

    ctx.recordSkillCast(sk.name, castMs);
    ctx.addStep({ skill: sk.name, start, end, att: state.att, type: 'familiar', ri: state._ri });
    updateSpearEtchingProgression(ctx, sk, sk.name, end);

    if (!isBasic) {
        const basicSkill = FAMILIAR_BASIC_BY_EMPOWERED[sk.name];
        if (basicSkill) {
            procState.lastEmpoweredFamiliarByBasic[basicSkill] = {
                castId: familiarCastId,
                skill: sk.name,
                start,
            };
        }
    }

    if (state._hasPyroPuissance && state.att === 'Fire' && isCombatActiveAt(state, end)) {
        ctx.trackEffect('Might', 1, 15, end);
    }

    if (state._hasFamiliarsProwess) {
        ctx.grantFamiliarProwess(end);
    }
    if (state._hasFamiliarsBlessing) {
        if (famElement === 'Fire' || famElement === 'Air') {
            ctx.trackEffect('Quickness', 1, 1.75, end);
        } else {
            ctx.trackEffect('Alacrity', 1, 4, end);
        }
    }
    if (state._hasGalvanicEnchantment) {
        ctx.adjustProcCounter('electricEnchantmentStacks', 2);
        ctx.log({ t: end, type: 'trait_proc', trait: 'Galvanic Enchantment', skill: 'Electric Enchantment', detail: '+2 stacks' });
        ctx.addStep({
            skill: 'Electric Enchantment',
            start: end,
            end,
            att: state.att,
            type: 'trait_proc',
            ri: -1,
            icon: ELECTRIC_ENCHANTMENT_ICON,
            detail: '+2 stacks',
        });
    }
    if (sk.name === 'Lightning Blitz') {
        ctx.adjustProcCounter('electricEnchantmentStacks', 1);
        ctx.log({ t: end, type: 'skill_proc', skill: 'Electric Enchantment', detail: '+1 stack' });
        ctx.addStep({
            skill: 'Electric Enchantment',
            start: end,
            end,
            att: state.att,
            type: 'skill_proc',
            ri: -1,
            icon: ELECTRIC_ENCHANTMENT_ICON,
            detail: '+1 stack',
        });
    }
    if (sk.name === 'Zap') {
        ctx.trackEffect('Zap Buff', 1, 5, end);
        ctx.log({ t: end, type: 'skill_proc', skill: 'Zap', detail: 'Zap Buff 10s' });
    }

    if (state._hasSpecializedElements) {
        const pct = isBasic ? 0.10 : 0.33;
        ctx.rechargeWeaponSkills(pct, end);
        if (!isBasic) {
            ctx.triggerAttunementEnterEffects(evokerState.element, end);
        }
    }

    runConcurrentSteps(ctx, concurrents, {
        anchorTime: end,
        restoreTime: end,
    });
}
