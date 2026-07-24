import { enqueueHitEvent } from '../shared/sim-events.js';
import { getTraitIcd, setTraitIcd } from '../state/sim-icd-state.js';
import { effectStacksAt } from '../shared/sim-state-queries.js';
import { isHammerOrbDamageActiveAt } from '../mechanics/sim-hammer.js';
import { pushReportingLog } from '../state/sim-reporting-state.js';

export function canTriggerShatteringIceProc(S, ev) {
    return effectStacksAt(S, 'Shattering Ice', ev.time) > 0
        && !ev.isTraitProc
        && !ev.isField
        && ev.dmg > 0
        && ev.ws > 0
        && ev.time >= getTraitIcd(S, 'ShatteringIce', 0);
}

export function queueShatteringIceProc(S, ev, { queueHit = null } = {}) {
    setTraitIcd(S, 'ShatteringIce', ev.time + 1000);

    const hitEvent = {
        time: ev.time,
        skill: 'Shattering Ice Proc',
        hitIdx: 1,
        sub: 1,
        totalSubs: 1,
        dmg: 0.6,
        ws: 690.5,
        isField: false,
        cc: false,
        conds: { Chilled: { stacks: 1, duration: 1 } },
        noCrit: false,
        att: ev.att,
        att2: ev.att2 || null,
        isTraitProc: true,
    };
    if (queueHit) queueHit(hitEvent);
    else enqueueHitEvent(S.eq, hitEvent);

    pushReportingLog(S, {
        t: ev.time,
        type: 'skill_proc',
        skill: 'Shattering Ice Proc',
    });
}

export function shouldSkipHammerOrbHit(S, ev, { hammerDualOrbSkills }) {
    if (!ev.hammerOrbElement) return false;

    if (ev.hammerOrbElement === 'Dual') {
        const dualEls = hammerDualOrbSkills[ev.skill];
        return !!(dualEls && dualEls.every(el => !isHammerOrbDamageActiveAt(S, el, ev.time)));
    }

    return !isHammerOrbDamageActiveAt(S, ev.hammerOrbElement, ev.time);
}
