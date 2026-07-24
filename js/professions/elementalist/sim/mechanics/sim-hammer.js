import { pushTimedStack } from '../state/sim-runtime-state.js';
import { peekTimedStacks } from '../state/sim-runtime-state.js';

const HAMMER_ORB_ELEMENTS = Object.freeze(['Fire', 'Water', 'Air', 'Earth']);
const HAMMER_ORB_BUFF_LINGER_MS = 1000;

export function createHammerOrbState() {
    return {
        hammerOrbs: { Fire: null, Water: null, Air: null, Earth: null },
        hammerOrbGrantedBy: { Fire: null, Water: null, Air: null, Earth: null },
        hammerOrbDamageWindows: { Fire: [], Water: [], Air: [], Earth: [] },
        hammerOrbLastCast: -Infinity,
        hammerOrbsUsed: new Set(),
    };
}

export function getHammerOrbExpiry(S, element) {
    return S.hammerOrbs[element] ?? null;
}

export function getHammerOrbGrantedBy(S, element) {
    return S.hammerOrbGrantedBy[element] ?? null;
}

export function isHammerOrbActiveAt(S, element, time) {
    const expiryAt = getHammerOrbExpiry(S, element);
    return expiryAt !== null && expiryAt >= time;
}

function getHammerOrbDamageWindows(S, element) {
    if (!S.hammerOrbDamageWindows) {
        S.hammerOrbDamageWindows = { Fire: [], Water: [], Air: [], Earth: [] };
    }
    if (!Array.isArray(S.hammerOrbDamageWindows[element])) {
        S.hammerOrbDamageWindows[element] = [];
    }
    return S.hammerOrbDamageWindows[element];
}

function findActiveHammerOrbDamageWindow(S, element, time) {
    const windows = getHammerOrbDamageWindows(S, element);
    for (let i = windows.length - 1; i >= 0; i--) {
        const window = windows[i];
        if (window.start <= time && window.end >= time) return window;
    }
    return null;
}

export function isHammerOrbDamageActiveAt(S, element, time) {
    return !!findActiveHammerOrbDamageWindow(S, element, time);
}

export function listActiveHammerOrbsAt(S, time) {
    const active = [];
    for (const element of HAMMER_ORB_ELEMENTS) {
        if (isHammerOrbActiveAt(S, element, time)) active.push(element);
    }
    return active;
}

export function setHammerOrb(S, element, expiresAt, grantedBy = null) {
    S.hammerOrbs[element] = expiresAt;
    S.hammerOrbGrantedBy[element] = grantedBy;
    return expiresAt;
}

export function clearHammerOrb(S, element) {
    S.hammerOrbs[element] = null;
    S.hammerOrbGrantedBy[element] = null;
    return true;
}

export function refreshActiveHammerOrbs(S, time, durationMs) {
    const expiresAt = time + durationMs;
    const refreshed = [];
    for (const element of HAMMER_ORB_ELEMENTS) {
        if (!isHammerOrbActiveAt(S, element, time)) continue;
        S.hammerOrbs[element] = expiresAt;
        refreshed.push(element);
    }
    return refreshed;
}

export function getHammerOrbLastCast(S, fallback = -Infinity) {
    return S.hammerOrbLastCast ?? fallback;
}

export function setHammerOrbLastCast(S, time) {
    S.hammerOrbLastCast = time;
    return time;
}

export function hasUsedHammerOrbSkill(S, skillName) {
    return S.hammerOrbsUsed.has(skillName);
}

export function markHammerOrbSkillUsed(S, skillName) {
    S.hammerOrbsUsed.add(skillName);
    return true;
}

export function clearUsedHammerOrbSkills(S) {
    S.hammerOrbsUsed.clear();
    return true;
}

function refreshActiveOrbs(S, end, durationMs, buffKeys) {
    const expiresAt = end + durationMs;
    for (const element of refreshActiveHammerOrbs(S, end, durationMs)) {
        const damageWindow = findActiveHammerOrbDamageWindow(S, element, end);
        if (damageWindow) damageWindow.end = expiresAt;

        const buffKey = buffKeys[element];
        if (!buffKey) continue;
        const arr = peekTimedStacks(S, buffKey);
        if (!arr) continue;
        for (const stack of arr) {
            if (stack.t <= end && stack.expiresAt >= end) stack.expiresAt = expiresAt;
        }
    }
}

function grantOrbs(ctx, granted, skillName, end, durationMs, buffKeys) {
    const { S } = ctx;
    for (const element of granted) {
        setHammerOrb(S, element, end + durationMs, skillName);
        const existingDamageWindow = findActiveHammerOrbDamageWindow(S, element, end);
        if (existingDamageWindow) existingDamageWindow.end = end;
        getHammerOrbDamageWindows(S, element).push({ start: end, end: end + durationMs });

        const buffKey = buffKeys[element];
        if (buffKey) {
            const old = peekTimedStacks(S, buffKey);
            if (old) {
                for (const stack of old) {
                    if (stack.t <= end && stack.expiresAt >= end) {
                        stack.expiresAt = end;
                    }
                }
            }
            pushTimedStack(S, { t: end, cond: buffKey, expiresAt: end + durationMs });
        }
        ctx.log({
            t: end,
            type: 'skill_proc',
            skill: skillName,
            detail: `${element} orb granted (until +${durationMs / 1000}s)`,
        });
    }
}

function expireConsumedOrbDamage(S, consumed, start) {
    for (const element of consumed) {
        clearHammerOrb(S, element);
        const damageWindow = findActiveHammerOrbDamageWindow(S, element, start);
        if (damageWindow) damageWindow.end = start;
    }
}

function expireConsumedOrbBuffs(S, consumed, start, end, buffKeys) {
    for (const element of consumed) {
        const buffKey = buffKeys[element];
        if (!buffKey) continue;
        const arr = peekTimedStacks(S, buffKey);
        if (!arr) continue;
        for (const stack of arr) {
            if (stack.t <= start && stack.expiresAt >= start) {
                stack.expiresAt = end + HAMMER_ORB_BUFF_LINGER_MS;
            }
        }
    }
}

function scheduleGrandFinaleHits(ctx, consumed, start, end, gfConditions) {
    const { S } = ctx;
    const gfSk = ctx.skill('Grand Finale');
    const gfHits = ctx.skillHits['Grand Finale'] || [];
    const gfHit = gfHits[0];
    if (!gfSk || !gfHit) return;

    const ws = ctx.weaponStrength(gfSk);
    for (let i = 0; i < consumed.length; i++) {
        const element = consumed[i];
        const condData = gfConditions[element];
        ctx.queueHitEvent({
            time: end + (gfHit.startOffsetMs || 680),
            skill: 'Grand Finale',
            hitIdx: 1,
            sub: i + 1,
            totalSubs: consumed.length,
            dmg: gfHit.damage,
            ws,
            isField: false,
            cc: false,
            conds: condData ? { [condData.cond]: { stacks: condData.stacks, duration: condData.dur } } : null,
            finType: gfHit.finisherType,
            finVal: gfHit.finisherValue,
            att: S.att,
            att2: S.att2,
            castStart: start,
            conjure: S.conjureEquipped || null,
        });
    }
}

export function handleHammerPostCast(ctx, sk, name, start, end) {
    const { S } = ctx;
    if (sk.weapon !== 'Hammer' || sk.type !== 'Weapon skill') return;

    const singleEl = ctx.hammerOrbSkills[name];
    const dualEls = ctx.hammerDualOrbSkills[name];
    const isGrandFinale = name === 'Grand Finale';

    if (singleEl || dualEls) {
        const granted = singleEl ? [singleEl] : dualEls;
        refreshActiveOrbs(S, end, ctx.hammerOrbDurationMs, ctx.hammerOrbBuffKey);
        grantOrbs(ctx, granted, name, end, ctx.hammerOrbDurationMs, ctx.hammerOrbBuffKey);
        setHammerOrbLastCast(S, end);
        markHammerOrbSkillUsed(S, name);
        return;
    }

    if (!isGrandFinale) return;

    setHammerOrbLastCast(S, end);
    clearUsedHammerOrbSkills(S);
    const consumed = ctx.hammerActiveOrbs(start);
    expireConsumedOrbDamage(S, consumed, start);
    expireConsumedOrbBuffs(S, consumed, start, end, ctx.hammerOrbBuffKey);
    scheduleGrandFinaleHits(ctx, consumed, start, end, ctx.hammerGfConditions);
    ctx.log({
        t: end,
        type: 'skill_proc',
        skill: 'Grand Finale',
        detail: `consumed ${consumed.length} orbs: ${consumed.join(', ')}`,
    });
}
