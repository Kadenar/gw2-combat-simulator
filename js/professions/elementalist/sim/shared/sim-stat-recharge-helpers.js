import { ensurePerSkillRecord } from '../state/sim-reporting-state.js';
import {
    getChargeState,
    ensureChargeState,
    setChargeReadyAt,
} from '../state/sim-cooldown-state.js';

export function getCooldownKey(sk, { conjureWeapons }) {
    if (conjureWeapons.has(sk.weapon)) return `${sk.name}::${sk.weapon}`;
    if (sk.type === 'Jade Sphere') return sk.name;
    const base = sk.name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
    return (base !== sk.name && sk.attunement) ? base : sk.name;
}

export function getAdjustedCastTime(S, csvCastMs, castStart, {
    ignoreQuickness = false,
} = {}) {
    if (csvCastMs <= 0) return { castMs: 0, scaleOff: off => off };
    if (ignoreQuickness) return { castMs: csvCastMs, scaleOff: off => off };

    const hasQuickness = S.quicknessUntil > castStart;
    if (!hasQuickness) {
        const castMs = Math.round(csvCastMs * 4 / 3);
        return { castMs, scaleOff: off => Math.round(off * 4 / 3) };
    }

    if (S.quicknessUntil >= castStart + csvCastMs) {
        return { castMs: csvCastMs, scaleOff: off => off };
    }

    const quickMs = S.quicknessUntil - castStart;
    const remainingCsvMs = csvCastMs - quickMs;
    const castMs = quickMs + Math.round(remainingCsvMs * 4 / 3);

    return {
        castMs,
        scaleOff: off => {
            if (off <= quickMs) return off;
            return quickMs + Math.round((off - quickMs) * 4 / 3);
        },
    };
}

export function getAlacrityAdjustedCooldown(S, baseCdMs, cdStart) {
    if (baseCdMs <= 0) return 0;

    const alaEnd = S.alacrityUntil;
    if (alaEnd <= cdStart) return baseCdMs;

    const readyUnderFullAlacrity = Math.round(baseCdMs / 1.25);
    if (alaEnd >= cdStart + readyUnderFullAlacrity) return readyUnderFullAlacrity;

    const alaRealMs = alaEnd - cdStart;
    const alaProgressMs = alaRealMs * 1.25;
    const remainingMs = baseCdMs - alaProgressMs;
    return Math.round(alaRealMs + remainingMs);
}

export function catchUpCharges(ctx, key, sk) {
    const { S } = ctx;
    const ch = getChargeState(S, key);
    if (!ch) return;

    const baseMs = getAdjustedWeaponRechargeMs(ctx.engine, sk, Math.round(sk.countRecharge * 1000));
    while (ch.count < sk.maximumCount && ch.nextChargeAt <= S.t) {
        const gainedAt = ch.nextChargeAt;
        ch.count++;
        if (ch.count < sk.maximumCount) {
            setChargeReadyAt(S, key, gainedAt + getAlacrityAdjustedCooldown(S, baseMs, gainedAt));
        } else {
            setChargeReadyAt(S, key, Infinity);
        }
    }
}

export function initCharges(S, key, sk) {
    return ensureChargeState(S, key, sk.maximumCount);
}

export function getAdjustedWeaponRechargeMs(engine, sk, baseMs) {
    if (sk.type === 'Weapon skill') {
        if (engine._hasTrait("Pyromancer's Training") && sk.attunement === 'Fire') baseMs = Math.round(baseMs * 0.8);
        if (engine._hasTrait("Aeromancer's Training") && sk.attunement === 'Air') baseMs = Math.round(baseMs * 0.8);
        if (engine._hasTrait("Geomancer's Training") && sk.attunement === 'Earth') baseMs = Math.round(baseMs * 0.8);
        if (engine._hasTrait("Aquamancer's Training") && sk.attunement === 'Water') baseMs = Math.round(baseMs * 0.8);
        // Flow State: -20% recharge on Dual Attack skills (weaver slot 3, two elements)
        if (engine._hasTrait('Flow State') && sk.slot === '3' && sk.attunement && sk.attunement.includes('+')) {
            baseMs = Math.round(baseMs * 0.8);
        }
    }
    return baseMs;
}

export function getWeaponStrength(engine, skill) {
    const weapon = skill.weapon;
    if (weapon === 'Profession mechanic') return engine.weapons['Profession mechanic']?.weaponStrength || 1100;
    if (['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword'].includes(weapon)) {
        return engine.weapons['Conjured Weapon']?.weaponStrength || 968.5;
    }
    if (['Healing', 'Utility', 'Elite', 'Dodge'].includes(skill.slot)) {
        return engine.weapons['Unequipped']?.weaponStrength || 690.5;
    }
    if (weapon && engine.weapons[weapon]) return engine.weapons[weapon].weaponStrength;
    const equipped = engine.attributes.weapons;
    return (equipped?.[0] && engine.weapons[equipped[0]]?.weaponStrength) || 1000;
}

export function computeSigilMultipliers(engine, excludeSigil = null) {
    const sigilNames = engine.attributes.sigils || [];
    let strikeAdd = 0;
    let condAdd = 0;
    let strikeMul = 1;
    let condMul = 1;

    for (const name of sigilNames) {
        if (name === excludeSigil) continue;
        const sigil = engine.sigils[name];
        if (!sigil) continue;
        strikeAdd += (sigil.strikeDamageA || 0) / 100;
        condAdd += (sigil.conditionDamageA || 0) / 100;
        if (sigil.strikeDamageM) strikeMul *= 1 + sigil.strikeDamageM / 100;
        if (sigil.conditionDamageM) condMul *= 1 + sigil.conditionDamageM / 100;
    }

    return {
        strikeAdd,
        strikeMul,
        condAdd,
        condMul,
        strike: (1 + strikeAdd) * strikeMul,
        cond: (1 + condAdd) * condMul,
    };
}

export function ensurePerSkillEntry(S, name) {
    return ensurePerSkillRecord(S, name);
}
