import { getSkillCooldownReadyAt } from '../state/sim-cooldown-state.js';
import { isCombatActiveAt } from '../run/sim-run-phase-state.js';

export function applyGenericPostCastHooks(ctx, sk, { key, end }) {
    const { S } = ctx;
    if (S._hasPyroPuissance && S.att === 'Fire' && isCombatActiveAt(S, end)) {
        ctx.trackEffect('Might', 1, 15, end);
    }

    if (S._hasGaleSong && sk.type === 'Healing skill') {
        ctx.trackEffect('Protection', 1, 3, end);
    }

    if (S._hasTempestuousAria && sk.type === 'Shout') {
        ctx.trackEffect('Might', 2, 10, end);
    }

    if (S._hasAltruisticAspect && sk.type === 'Meditation') {
        if (sk.name === "Fox's Fury") ctx.trackEffect('Might', 3, 10, end);
        else if (sk.name === "Hare's Agility") ctx.trackEffect('Fury', 1, 5, end);
        else if (sk.name === "Toad's Fortitude") ctx.trackEffect('Stability', 1, 5, end);
        else if (sk.name === 'Elemental Procession') ctx.trackEffect('Resistance', 1, 5, end);
    }

    if (S._hasEarthsEmbrace && sk.type === 'Healing skill'
        && ctx.traitIcdReady('EarthsEmbrace', end)) {
        ctx.armTraitIcd('EarthsEmbrace', end, 15000);
        ctx.trackEffect('Resistance', 1, 4, end);
        ctx.log({ t: end, type: 'trait_proc', trait: "Earth's Embrace", skill: "Earth's Embrace" });
    }

    if (S._hasSoothingIce && sk.type === 'Healing skill'
        && ctx.traitIcdReady('SoothingIce', end)) {
        ctx.armTraitIcd('SoothingIce', end, 15000);
        ctx.applyAura('Frost Aura', 4000, end, 'Soothing Ice');
        ctx.trackEffect('Regeneration', 1, 4, end);
    }

    if (sk.type === 'Signet') {
        if (S._hasWrittenInStone) {
            if (sk.name === 'Signet of Restoration') ctx.applyAura('Frost Aura', 4000, end, 'Written in Stone');
            else if (sk.name === 'Signet of Fire') ctx.applyAura('Fire Aura', 4000, end, 'Written in Stone');
            else if (sk.name === 'Signet of Earth') ctx.applyAura('Magnetic Aura', 3000, end, 'Written in Stone');
        }
        if (sk.name === 'Signet of Fire' && !S._hasWrittenInStone) {
            ctx.addSignetFirePassiveLostWindow(end, getSkillCooldownReadyAt(S, key));
        }
    }

    if (S._hasInscription && sk.type === 'Glyph') {
        const att = S.att;
        if (att === 'Fire') ctx.trackEffect('Might', 1, 10, end);
        else if (att === 'Water') ctx.trackEffect('Regeneration', 1, 10, end);
        else if (att === 'Air') ctx.trackEffect('Swiftness', 1, 10, end);
        else if (att === 'Earth') ctx.trackEffect('Protection', 1, 3, end);
    }

    if (S._hasBolsteredElements && sk.type === 'Stance') {
        ctx.trackEffect('Protection', 1, 3, end);
    }

    // Fervent Stance: while the stance is active, each Dual Attack grants Might.
    // The window lasts for the skill's own duration (8s in Skills_data).
    if (sk.name === 'Fervent Stance') {
        S.ferventStanceUntil = end + (sk.duration || 8) * 1000;
    }

    if (S._hasArcaneLightning && sk.type === 'Arcane') {
        ctx.refreshArcaneLightningBuff(end);
        if (sk.name === 'Arcane Brilliance') ctx.trackEffect('Protection', 1, 3.5, end);
        else if (sk.name === 'Arcane Wave') ctx.trackEffect('Immobilize', 1, 2, end);
        else if (sk.name === 'Arcane Blast') ctx.trackEffect('Blindness', 1, 5, end);
        else if (sk.name === 'Arcane Echo') ctx.trackEffect('Quickness', 1, 4, end);
    }

    const isDual = sk.slot === '3' && sk.attunement && sk.attunement.includes('+');
    if (isDual) {
        if (S._hasSuperiorElements && ctx.traitIcdReady('SuperiorElements', end)) {
            ctx.armTraitIcd('SuperiorElements', end, 4000);
            ctx.trackEffect('Weakness', 1, 5, end);
        }
        // Fervent Stance active: Dual Attacks grant 3 stacks of Might (8s).
        if (S.ferventStanceUntil && end <= S.ferventStanceUntil) {
            ctx.trackEffect('Might', 3, 8, end);
        }
        if (S._hasSwiftRevenge) {
            for (const elem of new Set(sk.attunement.split('+'))) {
                if (elem === 'Fire') ctx.trackEffect('Might', 3, 5, end);
                else if (elem === 'Air') ctx.trackEffect('Swiftness', 1, 5, end);
                else if (elem === 'Earth') ctx.gainEndurance(25, end);
                // Water: no bonus
            }
        }
    }
}
