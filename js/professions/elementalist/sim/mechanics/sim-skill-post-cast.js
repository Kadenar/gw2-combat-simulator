import { getProcState } from '../state/sim-proc-state.js';
import { getCatalystState, getEvokerState } from '../state/sim-specialization-state.js';
import { setSkillCooldownReadyAt } from '../state/sim-cooldown-state.js';
import { pushTimedStack } from '../state/sim-runtime-state.js';

const ATTUNEMENTS = ['Fire', 'Water', 'Air', 'Earth'];
const ELECTRIC_ENCHANTMENT_ICON = 'https://wiki.guildwars2.com/images/7/7b/Hare%27s_Agility.png';

export function applySkillSpecificPostCast(ctx, sk, { start, end, scaleOff }) {
    const { S } = ctx;
    const catalystState = getCatalystState(S);
    const evokerState = getEvokerState(S);
    const procState = getProcState(S);
    if (sk.name === 'Arcane Echo') {
        ctx.armArcaneEchoWindow(end, (sk.duration || 10) * 1000);
        ctx.log({ t: end, type: 'skill_proc', skill: 'Arcane Echo', detail: 'armed' });
    }

    if (sk.name === 'Relentless Fire') {
        const durMs = (catalystState.sphereExpiry.Fire > end) ? 8000 : 5000;
        ctx.pushCondStack({ t: end, cond: 'Relentless Fire', expiresAt: end + durMs });
        ctx.log({ t: end, type: 'skill_proc', skill: 'Relentless Fire', detail: `${durMs / 1000}s` });
    }

    if (sk.name === 'Shattering Ice') {
        const durMs = (catalystState.sphereExpiry.Water > end) ? 8000 : 5000;

        ctx.queueApplyEffectEvent({
            time: end,
            effect: 'Shattering Ice',
            duration: durMs,
        });

        ctx.log({
            t: end,
            type: 'skill_proc',
            skill: 'Shattering Ice',
            detail: `${durMs / 1000}s`,
        });
    }

    if (sk.name === 'Elemental Celerity') {
        for (const wsk of ctx.skills) {
            if (wsk.type !== 'Weapon skill' || wsk.recharge <= 0) continue;
            if (!wsk.attunement) continue;
            if (!wsk.attunement.split('+').includes(S.att)) continue;
            setSkillCooldownReadyAt(S, ctx.cdKey(wsk), 0);
        }
        ctx.log({ t: end, type: 'skill_proc', skill: 'Elemental Celerity', detail: `${S.att} CDs reset` });

        if (catalystState.sphereExpiry.Fire > end) ctx.trackEffect('Might', 5, 6, end);
        if (catalystState.sphereExpiry.Water > end) ctx.trackEffect('Vigor', 1, 6, end);
        if (catalystState.sphereExpiry.Air > end) ctx.trackEffect('Fury', 1, 6, end);
        if (catalystState.sphereExpiry.Earth > end) ctx.trackEffect('Protection', 1, 4, end);
    }

    if (sk.name === "Hare's Agility") {
        procState.electricEnchantmentStacks += 5;
        ctx.log({ t: end, type: 'skill_proc', skill: "Hare's Agility", detail: '+5 electric enchantment' });
        ctx.addStep({
            skill: 'Electric Enchantment',
            start: end,
            end,
            att: S.att,
            type: 'skill_proc',
            ri: -1,
            icon: ELECTRIC_ENCHANTMENT_ICON,
            detail: '+5 stacks',
        });
    }

    if (sk.name === "Toad's Fortitude" && evokerState.element === 'Earth') {
        ctx.trackEffect('Resistance', 1, 4, end);
    }

    if (sk.name === "Fox's Fury") {
        const preFuryMight = ctx.mightStacksAt(start);
        const foxTier = preFuryMight >= 20 ? 2 : preFuryMight >= 10 ? 1 : 0;
        const foxCoeffs = [1.5, 2.25, 3.0];
        const foxBurnStacks = [1, 2, 3];
        const foxBurnDurs = [3, 5, 7];
        ctx.queueHitEvent({
            time: start + scaleOff(560),
            skill: "Fox's Fury",
            hitIdx: 1,
            sub: 1,
            totalSubs: 1,
            dmg: foxCoeffs[foxTier],
            ws: ctx.weaponStrength(sk),
            isField: false,
            cc: false,
            conds: { Burning: { stacks: foxBurnStacks[foxTier], duration: foxBurnDurs[foxTier] } },
            att: S.att,
            att2: S.att2,
            castStart: start,
            conjure: S.conjureEquipped || null,
        });
        const foxMightCount = 8 + (evokerState.element === 'Fire' ? 3 : 0);
        ctx.trackEffect('Might', foxMightCount, 10, end);
        ctx.trackEffect('Fury', 1, 10, end);
        ctx.log({ t: end, type: 'skill_proc', skill: "Fox's Fury", detail: `tier ${foxTier}, ${foxMightCount} Might` });
    }

    if (sk.name === 'Fulgor') {
        for (let i = 0; i < 6; i++) {
            ctx.queueHitEvent({
                time: start + 320 + i * 1000,
                skill: 'Fulgor',
                hitIdx: 50 + i,
                sub: 1,
                totalSubs: 1,
                dmg: 0,
                ws: 0,
                isField: false,
                cc: false,
                conds: null,
                noCrit: true,
                att: S.att,
                att2: S.att2,
                castStart: start,
                isTraitProc: true,
                flatStrikeBase: 200,
                flatStrikePowerCoeff: 0.4,
            });
        }
    }

    if (sk.name === 'Elemental Procession') {
        for (const ename of ['Conflagration', 'Lightning Blitz', 'Seismic Impact']) {
            const fsk = ctx.skill(ename);
            if (fsk) ctx.scheduleHits(fsk, end, x => x);
        }
        ctx.log({ t: end, type: 'skill_proc', skill: 'Elemental Procession', detail: 'empowered familiars released' });
    }

    if (sk.name === 'Rejuvenate') {
        const chargesNeeded = S._hasSpecializedElements ? 4 : 6;
        ctx.setEvokerCharges(chargesNeeded);
        ctx.log({ t: end, type: 'skill_proc', skill: 'Rejuvenate', detail: `charges → ${chargesNeeded}` });
    }

    if (sk.name === 'Weave Self') {
        ctx.resetWeaveSelfState();
        ctx.setWeaveSelfUntil(end + 20000);
        ctx.addWeaveSelfVisited(S.att);
        pushTimedStack(S, { t: end, cond: 'Weave Self', expiresAt: end + 20000 });
        ctx.log({ t: end, type: 'skill_proc', skill: 'Weave Self', detail: `armed, starting in ${S.att}` });
    }

    if (sk.name === 'Unravel') {
        const prevPrimary = S.att;
        const prevSecondary = S.att2;
        const durMs = Math.round((sk.duration || 5) * 1000);
        const boonByAttunement = {
            Fire: ['Might', 5, 5],
            Water: ['Vigor', 1, 5],
            Air: ['Fury', 1, 5],
            Earth: ['Protection', 1, 5],
        };

        for (const attunement of ATTUNEMENTS) {
            ctx.setAttunementCooldown(attunement, end);
        }

        ctx.setSecondaryAttunement(prevPrimary);
        ctx.pushAttunementTimeline({ t: end, att: prevPrimary, att2: prevPrimary });
        ctx.setUnravelUntil(end + durMs);

        const boonEntry = boonByAttunement[prevPrimary];
        if (boonEntry) {
            ctx.trackEffect(boonEntry[0], boonEntry[1], boonEntry[2], end);
        }

        if (S._hasElementsOfRage && prevPrimary !== prevSecondary) {
            ctx.refreshEffect('Elements of Rage', 8, end);
        }

        ctx.log({ t: end, type: 'skill_proc', skill: 'Unravel', detail: `${durMs / 1000}s single-attunement mode` });
    }

    if (sk.name === 'Tailored Victory') {
        ctx.setPerfectWeaveUntil(0);
        ctx.log({ t: end, type: 'skill_proc', skill: 'Tailored Victory', detail: 'Perfect Weave consumed' });
    }
}
