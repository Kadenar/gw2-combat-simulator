import {
    getChainProgress,
    listChainRoots,
    getChainExpiry,
} from '../state/sim-cooldown-state.js';
import { SMALL_HITBOX_CAPS } from '../../simulation.js';

export function detectAACarryover(ctx) {
    const { S } = ctx;
    const mh = ctx.engine.attributes.weapons?.[0] || '';
    const candidates = ctx.skills.filter(s =>
        s.slot === '1' && s.weapon === mh && s.attunement === S.att && s.chainSkill
    );
    if (candidates.length === 0) return null;
    const targets = new Set(candidates.map(s => s.chainSkill));
    const root = candidates.find(s => !targets.has(s.name));
    const rootName = root ? root.name : candidates[0].name;
    const next = getChainProgress(S, rootName);
    if (next && next !== rootName) return { root: rootName, att: S.att };
    return null;
}

export function getChainRoot(ctx, sk) {
    const slot = sk.slot;
    const att = sk.attunement;
    const weapon = sk.weapon;
    const candidates = ctx.skills.filter(s =>
        s.slot === slot && s.attunement === att && s.weapon === weapon && s.chainSkill
    );
    if (candidates.length === 0) return sk.name;
    const targets = new Set(candidates.map(s => s.chainSkill));
    const root = candidates.find(s => !targets.has(s.name));
    return root ? root.name : candidates[0].name;
}

// Skills that should not reset the AA chain when cast, even though they have
// a non-zero cast time.  These are mobility or utility skills whose animation
// runs in parallel with the chain window in the actual game.
const CHAIN_PRESERVING_SKILLS = new Set([
    'Ride the Lightning', 'Relentless Fire',
]);

export function resetChainsOnCast(ctx, sk) {
    const { S } = ctx;
    if (Math.round((sk.castTime || 0) * 1000) === 0) return;
    if (CHAIN_PRESERVING_SKILLS.has(sk.name)) return;
    const ownRoot = sk.chainSkill ? getChainRoot(ctx, sk) : null;
    const isOwnChain = ownRoot !== null;
    const carryRoot = S.aaCarryover?.root || null;
    if (carryRoot && !isOwnChain) {
        ctx.clearAACarryover();
    }
    const effectiveCarryRoot = isOwnChain ? carryRoot : null;
    for (const key of listChainRoots(S)) {
        if (key === ownRoot || key === effectiveCarryRoot) continue;
        if (getChainProgress(S, key) !== key) {
            if (getChainExpiry(S, key) !== undefined && getChainExpiry(S, key) > S.t) continue;
            ctx.expireChainProgress(key);
        }
    }
}

export function propagateChainCooldown(ctx, sk, cdTime) {
    let chain = sk.chainSkill;
    const visited = new Set([sk.name]);
    while (chain && !visited.has(chain)) {
        const cs = ctx.skill(chain);
        if (!cs) break;
        ctx.setSkillCooldown(ctx.cdKey(cs), cdTime);
        visited.add(chain);
        chain = cs.chainSkill;
    }
}

export function fillGap(ctx, sk, gapMs) {
    const { S } = ctx;
    const start = S.t;
    const end = start + gapMs;
    const ws = ctx.weaponStrength(sk);
    const rows = ctx.skillHits[sk.name] || [];
    const hitboxCap = ctx.hitboxSize === 'small' ? (SMALL_HITBOX_CAPS.get(sk.name) ?? Infinity) : Infinity;

    ctx.log({ t: start, type: 'cast', skill: sk.name, att: S.att, dur: gapMs });

    for (const h of rows) {
        if (h.hit > hitboxCap) continue;
        const off = h.startOffsetMs || 0;
        if (off >= gapMs) break;
        ctx.queueHitEvent({
            time: start + off,
            skill: sk.name, hitIdx: h.hit, sub: 1, totalSubs: 1,
            dmg: h.damage, ws, isField: false, cc: h.cc,
            conds: h.conditions,
            finType: h.finisherType, finVal: h.finisherValue,
            att: S.att, att2: S.att2, castStart: start,
            conjure: S.conjureEquipped || null,
        });
    }

    ctx.log({ t: end, type: 'cast_end', skill: sk.name });
    ctx.recordSkillCast(sk.name, gapMs);

    ctx.setTime(end);
    ctx.setCastUntil(end);
    ctx.setPendingPartialFill({ skill: sk.name, durationMs: gapMs, startMs: start });
}
