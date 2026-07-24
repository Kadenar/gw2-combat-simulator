import { peekTimedStacks } from '../state/sim-runtime-state.js';
import { listActiveHammerOrbsAt, getHammerOrbGrantedBy } from '../mechanics/sim-hammer.js';

function countActiveStacks(S, effect, time) {
    const arr = peekTimedStacks(S, effect);
    if (!arr) return 0;
    let count = 0;
    for (const stack of arr) {
        if (stack.t <= time && stack.expiresAt > time) count++;
    }
    return count;
}

export function attunementAt(S, time) {
    let att = S.attTimeline[0].att;
    for (const entry of S.attTimeline) {
        if (entry.t > time) break;
        att = entry.att;
    }
    return att;
}

export function secondaryAttunementAt(S, time) {
    let att2 = S.attTimeline[0].att2 || null;
    for (const entry of S.attTimeline) {
        if (entry.t > time) break;
        if (entry.att2 !== undefined) att2 = entry.att2;
    }
    return att2;
}

export function mightStacksAt(S, time) {
    return Math.min(countActiveStacks(S, 'Might', time), 25);
}

export function attunementMatchesSkill(S, sk) {
    const req = sk.attunement;
    if (!req) return true;

    if (S.eliteSpec === 'Weaver') {
        if (req.includes('+')) {
            const [a, b] = req.split('+');
            return (a === S.att && b === S.att2) || (b === S.att && a === S.att2);
        }
        const slotNum = parseInt(sk.slot, 10);
        if (!Number.isNaN(slotNum) && slotNum >= 4) return req === S.att2;
        return req === S.att;
    }

    if (req === S.att) return true;
    if (req.includes('+')) return req.split('+').includes(S.att);
    return false;
}

export function hasFuryAt(S, time) {
    return countActiveStacks(S, 'Fury', time) > 0;
}

export function vulnerabilityStacksAt(S, time) {
    return Math.min(countActiveStacks(S, 'Vulnerability', time), 25);
}

export function effectStacksAt(S, effect, time) {
    return countActiveStacks(S, effect, time);
}

export function hammerActiveOrbsAt(S, time) {
    return listActiveHammerOrbsAt(S, time);
}

export function hammerGrandFinaleAvailable(engine, S, time) {
    const active = hammerActiveOrbsAt(S, time);
    if (active.length === 0) return false;

    const pri = S.att;
    const sec = S.att2;
    if (S.eliteSpec !== 'Weaver' || !sec || pri === sec) {
        return active.includes(pri);
    }

    for (const element of active) {
        const grantedBy = getHammerOrbGrantedBy(S, element);
        if (!grantedBy) continue;
        const grantSk = engine._skill(grantedBy);
        if (!grantSk) continue;
        const att = grantSk.attunement || '';
        if (att.includes('+')) {
            const parts = att.split('+');
            if (parts.includes(pri) || parts.includes(sec)) return true;
        } else if (att === pri || att === sec) {
            return true;
        }
    }

    return active.includes(pri) || active.includes(sec);
}
