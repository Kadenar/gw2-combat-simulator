import { applyGenericPostCastHooks } from '../mechanics/sim-post-cast-hooks.js';
import { applySkillSpecificPostCast } from '../mechanics/sim-skill-post-cast.js';
import { handlePistolPostCast } from '../mechanics/sim-pistol-actions.js';
import { handleHammerPostCast } from '../mechanics/sim-hammer.js';
import { triggerEvasiveArcana } from '../mechanics/sim-elemental-traits.js';
import { getEvokerState } from '../state/sim-specialization-state.js';
import { expireActiveTimedStacks } from '../state/sim-runtime-state.js';

const FULL_ETCHING_CHARGE_SKILLS = new Set(['Overload Fire', 'Overload Air', 'Overload Earth']);

const AURA_TRANSMUTE_SKILLS = Object.freeze({
    'Transmute Frost': 'Frost Aura',
    'Transmute Lightning': 'Shocking Aura',
    'Transmute Earth': 'Magnetic Aura',
    'Transmute Fire': 'Fire Aura',
});

function applyConjureProgression(ctx, sk, end) {
    const { S } = ctx;
    if (sk.type !== 'Conjure') return;

    const conjureWeapon = ctx.conjureMap[sk.name];
    if (!conjureWeapon) return;

    ctx.equipConjure(conjureWeapon);
    ctx.queueConjurePickup(conjureWeapon, end + ctx.conjurePickupDuration);
    ctx.log({ t: end, type: 'conjure', weapon: conjureWeapon, pickupExpires: end + ctx.conjurePickupDuration });
    if (S._hasConjurer) ctx.applyAura('Fire Aura', 4000, end, 'Conjurer');
}

function applyEvokerChargeProgression(ctx, sk, time) {
    const { S } = ctx;
    const evokerState = getEvokerState(S);
    if (S.eliteSpec !== 'Evoker' || !evokerState.element) return;

    const slotNum = parseInt(sk.slot, 10);
    if (Number.isNaN(slotNum) || slotNum < 2 || slotNum > 5) return;
    if (ctx.conjureWeapons.has(sk.weapon) || ctx.evokerNoChargeSkills.has(sk.name)) return;
    if (sk.weapon === 'Spear') {
        const etchChain = ctx.etchingLookup.get(sk.name);
        if (etchChain && sk.name !== etchChain.etching) return;
    }

    const skillAtt = sk.attunement ? sk.attunement.split('+') : [];
    const bonus = skillAtt.includes(evokerState.element) ? 2 : 1;
    const maxCharges = S._hasSpecializedElements ? 4 : 6;
    const prevCharges = evokerState.charges;
    const nextCharges = ctx.grantEvokerCharges(bonus, maxCharges);
    if (nextCharges !== prevCharges) {
        ctx.log({
            t: time,
            type: 'evoker_charges',
            skill: sk.name,
            source: 'skill',
            amount: nextCharges - prevCharges,
            prevCharges,
            charges: nextCharges,
            maxCharges,
        });
    }
}

function applyEnduranceProgression(ctx, sk, end) {
    if ((sk.endurance || 0) <= 0) return;
    ctx.gainEndurance(sk.endurance, end);
}

export function armSpearEtchingOnCastStart(ctx, sk, name, start) {
    const etchCast = ctx.etchingLookup.get(name);
    if (!etchCast || sk.weapon !== 'Spear' || name !== etchCast.etching) return;
    ctx.setEtchingProgress(etchCast.etching, 'lesser');
    ctx.log({ t: start, type: 'skill_proc', skill: name, detail: `armed ${etchCast.lesser}` });
}

export function updateSpearEtchingProgression(ctx, sk, name, end) {
    const { S } = ctx;
    const etchCast = ctx.etchingLookup.get(name);
    if (etchCast && sk.weapon === 'Spear') {
        if (name === etchCast.etching) {
            // Already armed at cast start; nothing left to do here.
        } else {
            ctx.setEtchingProgress(etchCast.etching, null);
        }
        return;
    }

    for (const chain of Object.values(ctx.etchingChains)) {
        if (S.etchingState[chain.etching] !== 'lesser') continue;

        const amount = FULL_ETCHING_CHARGE_SKILLS.has(name) ? 3 : 1;
        const otherCasts = ctx.incrementEtchingOtherCasts(chain.etching, amount);
        if (otherCasts >= 3) {
            ctx.setEtchingProgress(chain.etching, 'full', otherCasts);
            ctx.log({ t: end, type: 'skill_proc', skill: chain.etching, detail: `upgraded to ${chain.full}` });
        }
    }
}

function armSpearNextSkillProgression(ctx, sk, name, end) {
    if (sk.weapon !== 'Spear') return;

    if (name === 'Seethe') {
        ctx.armSpearFollowup('spearNextDmgBonus');
        ctx.log({ t: end, type: 'skill_proc', skill: 'Seethe', detail: 'next Spear +20% strike armed' });
    } else if (name === 'Ripple') {
        ctx.armSpearFollowup('spearNextCdReduce');
        ctx.log({ t: end, type: 'skill_proc', skill: 'Ripple', detail: 'next Spear -33% recharge armed' });
    } else if (name === 'Energize') {
        ctx.armSpearFollowup('spearNextGuaranteedCrit');
        ctx.log({ t: end, type: 'skill_proc', skill: 'Energize', detail: 'next Spear guaranteed crit armed' });
    } else if (name === 'Harden') {
        ctx.armSpearFollowup('spearNextCCHit');
        ctx.log({ t: end, type: 'skill_proc', skill: 'Harden', detail: 'next Spear first hit CC armed' });
    }
}

function resetWeaverDualSpearCooldown(ctx, sk, name, end) {
    const { S } = ctx;
    if (S.eliteSpec !== 'Weaver' || sk.weapon !== 'Spear' || sk.slot !== '3') return;
    if (!sk.attunement || !sk.attunement.includes('+') || S.att === S.att2) return;

    ctx.setAttunementCooldown(S.att, end);
    ctx.log({ t: end, type: 'skill_proc', skill: name, detail: `${S.att} attunement CD reset` });
}

function handleElementalExplosionProgression(ctx, name, end) {
    const { S } = ctx;
    if (name !== 'Elemental Explosion') return;

    const auraMap = {
        Fire: ['Fire Aura', 4000],
        Water: ['Frost Aura', 4000],
        Air: ['Shocking Aura', 3000],
        Earth: ['Magnetic Aura', 3000],
    };
    const auraEntry = auraMap[S.att];
    if (auraEntry) ctx.applyAura(auraEntry[0], auraEntry[1], end, name);

    for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
        ctx.consumePistolBullet(element, end);
    }

    ctx.log({ t: end, type: 'skill_proc', skill: name, detail: 'all bullets consumed, aura granted' });
}

function handleDodgeTraitProgression(ctx, sk, end) {
    if (sk.type !== 'Dodge' && sk.slot !== 'Dodge') return;
    triggerEvasiveArcana(ctx, end);
}

function handleAuraTransmuteProgression(ctx, name, end) {
    const auraName = AURA_TRANSMUTE_SKILLS[name];
    if (!auraName) return;
    expireActiveTimedStacks(ctx.S, auraName, end, { includePerma: false });
}

export function applyStandardCastProgression(ctx, sk, name, {
    key,
    start,
    end,
    scaleOff,
}) {
    applyConjureProgression(ctx, sk, end);
    applyEvokerChargeProgression(ctx, sk, end);
    applyEnduranceProgression(ctx, sk, end);

    ctx.checkRelicOnCast(sk, start, end);
    updateSpearEtchingProgression(ctx, sk, name, end);
    armSpearNextSkillProgression(ctx, sk, name, end);
    resetWeaverDualSpearCooldown(ctx, sk, name, end);
    handleElementalExplosionProgression(ctx, name, end);
    handleDodgeTraitProgression(ctx, sk, end);
    handleAuraTransmuteProgression(ctx, name, end);

    handlePistolPostCast(ctx, sk, name, start, end);
    handleHammerPostCast(ctx, sk, name, start, end);

    applyGenericPostCastHooks(ctx, sk, { key, end });
    applySkillSpecificPostCast(ctx, sk, { start, end, scaleOff });
}
