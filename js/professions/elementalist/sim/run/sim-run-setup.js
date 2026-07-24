import { initializeRunPhaseState } from './sim-run-phase-state.js';
import { createProcState } from '../state/sim-proc-state.js';
import { createRelicState } from '../state/sim-relic-state.js';
import { createCatalystState, createEvokerState, getEvokerState } from '../state/sim-specialization-state.js';
import { createRuntimeWindowState } from '../state/sim-timing-window-state.js';
import { createHammerOrbState } from '../mechanics/sim-hammer.js';
import { pushTimedStack, ensureConditionState } from '../state/sim-runtime-state.js';
import { ENDURANCE_MAX } from '../state/sim-endurance-state.js';
import { FOOD_DATA } from '../../data/gear-data.js';

export function applyDisabledStatAdjustments(engine, attributes, disabled, sigilStatMap) {
    const disSigil = disabled?.startsWith('Sigil:') ? disabled.slice(6) : null;
    const disRelic = disabled?.startsWith('Relic:') ? disabled.slice(6) : null;
    const disTrait = disabled?.startsWith('Trait:') ? disabled.slice(6) : null;
    const disFood  = disabled?.startsWith('Food:')  ? disabled.slice(5) : null;
    const dsStat = disSigil ? (engine.sigils[disSigil] || {}) : {};
    const statAdj = {};

    if (disSigil) {
        for (const [sk, an] of Object.entries(sigilStatMap)) {
            const v = dsStat[sk];
            if (v && attributes[an]) {
                attributes[an].final -= v;
                statAdj[an] = v;
            }
        }
    }

    if (disTrait) {
        const activeTraits = engine.attributes.activeTraits || [];
        const traitObj = name => activeTraits.find(t => t.name === name);
        const subStat = (stat, val) => {
            if (val && attributes[stat]) {
                attributes[stat].final -= val;
                statAdj[stat] = (statAdj[stat] || 0) + val;
            }
        };
        if (disTrait === 'Burning Rage') subStat('Condition Damage', traitObj('Burning Rage')?.conditionDamage);
        if (disTrait === "Aeromancer's Training") subStat('Ferocity', traitObj("Aeromancer's Training")?.ferocity);
        if (disTrait === "Zephyr's Speed") subStat('Critical Chance', traitObj("Zephyr's Speed")?.criticalChance);
        if (disTrait === 'Serrated Stones') subStat('Bleeding Duration', traitObj('Serrated Stones')?.bleedingDuration);
        if (disTrait === 'Gathered Focus' || disTrait === 'Elemental Enchantment') {
            const name = disTrait;
            const delta = traitObj(name)?.concentration || 0;
            subStat('Concentration', delta);
            subStat('Boon Duration', delta / 15);
        }
    }

    return {
        disSigil,
        disRelic,
        disTrait,
        disFood,
        statAdj,
    };
}

export function createRunState(engine, {
    eliteSpec,
    realStartAtt,
    realStartAtt2,
    startEvokerElement,
    startEvokerCharges,
    startEvokerEmpowered,
    activeRelic,
    relicProc,
    startPistolBullets,
    catalystEnergyMax,
    noopArray,
}) {
    const S = {
        t: 0,
        att: realStartAtt,
        att2: realStartAtt2,
        attEnteredAt: -999999,
        attCD: {},
        skillCD: {},
        charges: {},
        chainState: {},
        chainExpiry: {},
        eq: [],
        condState: {},
        fields: [],
        comboAccum: {},
        auras: [],
        boons: {},
        log: engine.fastMode ? noopArray : [],
        steps: engine.fastMode ? noopArray : [],
        allCondStacks: engine.fastMode ? noopArray : [],
        _condMap: new Map(),
        conjureEquipped: null,
        conjurePickups: [],
        catalystState: createCatalystState(eliteSpec, catalystEnergyMax),
        evokerState: createEvokerState(
            eliteSpec,
            startEvokerElement,
            startEvokerCharges,
            startEvokerEmpowered,
        ),
        weaveSelfUntil: 0,
        weaveSelfVisited: new Set(),
        perfectWeaveUntil: 0,
        wsFireBonusWindows: [],
        wsAirBonusWindows: [],
        unravelUntil: 0,
        hasExplicitCombatStart: false,
        combatStartTime: null,
        aaCarryover: null,
        quicknessUntil: 0,
        alacrityUntil: 0,
        endurance: ENDURANCE_MAX,
        enduranceUpdatedAt: 0,
        runtimeWindowState: createRuntimeWindowState(),
        procState: createProcState(),
        relicState: createRelicState(),
        sigilICD: {},
        relicICD: {},
        activeRelic,
        relicProc,
        totalStrike: 0,
        totalCond: 0,
        condDamage: {},
        condStackSeconds: {},
        firstHitTime: null,
        lastHitTime: null,
        perSkill: {},
        _pendingPartialFill: null,
        eliteSpec,
        _hasEmpoweringFlame: engine._hasTrait('Empowering Flame'),
        _hasBurningPrecision: engine._hasTrait('Burning Precision'),
        _hasConjurer: engine._hasTrait('Conjurer'),
        _hasSunspot: engine._hasTrait('Sunspot'),
        _hasBurningRage: engine._hasTrait('Burning Rage'),
        _hasSmothering: engine._hasTrait('Smothering Auras'),
        _hasPowerOverwhelming: engine._hasTrait('Power Overwhelming'),
        _hasPyroTraining: engine._hasTrait("Pyromancer's Training"),
        _hasPersistingFlames: engine._hasTrait('Persisting Flames'),
        _hasPyroPuissance: engine._hasTrait("Pyromancer's Puissance"),
        _hasInferno: engine._hasTrait('Inferno'),
        _hasZephyrsBoon: engine._hasTrait("Zephyr's Boon"),
        _hasOneWithAir: engine._hasTrait('One with Air'),
        _hasElectricDischarge: engine._hasTrait('Electric Discharge'),
        _hasInscription: engine._hasTrait('Inscription'),
        _hasRagingStorm: engine._hasTrait('Raging Storm'),
        _hasStormsoul: engine._hasTrait('Stormsoul'),
        _hasAeroTraining: engine._hasTrait("Aeromancer's Training"),
        _hasBoltToHeart: engine._hasTrait('Bolt to the Heart'),
        _hasFreshAir: engine._hasTrait('Fresh Air'),
        _suppressFreshAirContributionBuff: false,
        _hasLightningRod: engine._hasTrait('Lightning Rod'),
        _hasEarthsEmbrace: engine._hasTrait("Earth's Embrace"),
        _hasSerratedStones: engine._hasTrait('Serrated Stones'),
        _hasElementalShielding: engine._hasTrait('Elemental Shielding'),
        _hasEarthenBlast: engine._hasTrait('Earthen Blast'),
        _hasStrengthOfStone: engine._hasTrait('Strength of Stone'),
        _hasRockSolid: engine._hasTrait('Rock Solid'),
        _hasGeoTraining: engine._hasTrait("Geomancer's Training"),
        _hasWrittenInStone: engine._hasTrait('Written in Stone'),
        _hasSoothingIce: engine._hasTrait('Soothing Ice'),
        _hasPiercingShards: engine._hasTrait('Piercing Shards'),
        _hasFlowLikeWater: engine._hasTrait('Flow like Water'),
        _hasAquamancerTraining: engine._hasTrait("Aquamancer's Training"),
        _hasArcaneProwess: engine._hasTrait('Arcane Prowess'),
        _hasArcanePrecision: engine._hasTrait('Arcane Precision'),
        _hasRenewingStamina: engine._hasTrait('Renewing Stamina'),
        _hasEvasiveArcana: engine._hasTrait('Evasive Arcana'),
        _hasElemAttunement: engine._hasTrait('Elemental Attunement'),
        _hasElemLockdown: engine._hasTrait('Elemental Lockdown'),
        _hasElemEnchantment: engine._hasTrait('Elemental Enchantment'),
        _hasArcaneLightning: engine._hasTrait('Arcane Lightning'),
        _hasBountifulPower: engine._hasTrait('Bountiful Power'),
        _hasGaleSong: engine._hasTrait('Gale Song'),
        _hasLatentStamina: engine._hasTrait('Latent Stamina'),
        _hasUnstableConduit: engine._hasTrait('Unstable Conduit'),
        _hasTempestuousAria: engine._hasTrait('Tempestuous Aria'),
        _hasHarmoniousConduit: engine._hasTrait('Harmonious Conduit'),
        _hasInvigoratingTorrents: engine._hasTrait('Invigorating Torrents'),
        _hasHardyConduit: engine._hasTrait('Hardy Conduit'),
        _hasTranscendentTempest: engine._hasTrait('Transcendent Tempest'),
        _suppressTranscendentTempestContributionBuff: false,
        _disableWeaveSelfBonuses: false,
        _hasLucidSingularity: engine._hasTrait('Lucid Singularity'),
        _hasElementalBastion: engine._hasTrait('Elemental Bastion'),
        _hasSuperiorElements: engine._hasTrait('Superior Elements'),
        _hasElementalPursuit: engine._hasTrait('Elemental Pursuit'),
        _hasWeaversProwess: engine._hasTrait("Weaver's Prowess"),
        _hasSwiftRevenge: engine._hasTrait('Swift Revenge'),
        _hasBolsteredElements: engine._hasTrait('Bolstered Elements'),
        _hasElemPolyphony: engine._hasTrait('Elemental Polyphony'),
        _hasElementsOfRage: engine._hasTrait('Elements of Rage'),
        _hasFlowState: engine._hasTrait('Flow State'),
        _hasViciousEmpowerment: engine._hasTrait('Vicious Empowerment'),
        _hasEnergizedElements: engine._hasTrait('Energized Elements'),
        _hasElemEmpowermentTrait: engine._hasTrait('Elemental Empowerment'),
        _hasEmpoweringAuras: engine._hasTrait('Empowering Auras'),
        _hasSpectacularSphere: engine._hasTrait('Spectacular Sphere'),
        _hasElemEpitome: engine._hasTrait('Elemental Epitome'),
        _hasElemSynergy: engine._hasTrait('Elemental Synergy'),
        _hasEmpoweredEmpowerment: engine._hasTrait('Empowered Empowerment'),
        _hasSphereSpecialist: engine._hasTrait('Sphere Specialist'),
        _hasFieryMight: engine._hasTrait('Fiery Might'),
        _hasAltruisticAspect: engine._hasTrait('Altruistic Aspect'),
        _hasEnhancedPotency: engine._hasTrait('Enhanced Potency'),
        _hasFamiliarsProwess: engine._hasTrait("Familiar's Prowess"),
        _hasFamiliarsFocus: engine._hasTrait("Familiar's Focus"),
        _hasFamiliarsBlessing: engine._hasTrait("Familiar's Blessing"),
        _hasElemDynamo: engine._hasTrait('Elemental Dynamo'),
        _hasGalvanicEnchantment: engine._hasTrait('Galvanic Enchantment'),
        _hasElemBalance: engine._hasTrait('Elemental Balance'),
        _hasSpecializedElements: engine._hasTrait('Specialized Elements'),
        attTimeline: [{ t: 0, att: realStartAtt, att2: realStartAtt2 }],
        traitICD: {},
        etchingState: {},
        etchingOtherCasts: {},
        ...createHammerOrbState(),
        pistolBullets: startPistolBullets
            ? { Fire: !!startPistolBullets.Fire, Water: !!startPistolBullets.Water, Air: !!startPistolBullets.Air, Earth: !!startPistolBullets.Earth }
            : { Fire: false, Water: false, Air: false, Earth: false },
        _pistolBulletMapEntry: {},
        _frigidFlurryProcActive: false,
        _purblindingCDReduce: false,
        spearNextDmgBonus: false,
        spearNextCdReduce: false,
        spearNextGuaranteedCrit: false,
        spearNextCCHit: false,
        _mightCondDmgBonus: 30,
        _furyCritBonus: 25,
        _foodProc: (FOOD_DATA[engine.attributes?.food] || {}).proc || null,
    };

    initializeRunPhaseState(S);
    return S;
}

export function applyDisabledFoodProc(S, disFood) {
    if (disFood) S._foodProc = null;
}

export function applyDisabledTraitFlags(S, disTrait) {
    if (!disTrait) return;

    if (disTrait === 'Fresh Air') {
        S._suppressFreshAirContributionBuff = true;
        return;
    }
    if (disTrait === 'Transcendent Tempest') {
        S._suppressTranscendentTempestContributionBuff = true;
        return;
    }
    if (disTrait === 'Weave Self Bonuses') {
        S._disableWeaveSelfBonuses = true;
        return;
    }

    const traitFlags = {
        'Empowering Flame': '_hasEmpoweringFlame',
        'Power Overwhelming': '_hasPowerOverwhelming',
        "Aeromancer's Training": '_hasAeroTraining',
        'Raging Storm': '_hasRagingStorm',
        'Elemental Polyphony': '_hasElemPolyphony',
        'Elemental Empowerment': '_hasElemEmpowermentTrait',
        'Enhanced Potency': '_hasEnhancedPotency',
        'Superior Elements': '_hasSuperiorElements',
        "Weaver's Prowess": '_hasWeaversProwess',
        'Burning Precision': '_hasBurningPrecision',
        'Persisting Flames': '_hasPersistingFlames',
        "Pyromancer's Training": '_hasPyroTraining',
        'Stormsoul': '_hasStormsoul',
        'Bolt to the Heart': '_hasBoltToHeart',
        'Elements of Rage': '_hasElementsOfRage',
        'Swift Revenge': '_hasSwiftRevenge',
        'Empowering Auras': '_hasEmpoweringAuras',
        "Familiar's Prowess": '_hasFamiliarsProwess',
        'Fiery Might': '_hasFieryMight',
        'Lightning Rod': '_hasLightningRod',
        'Burning Rage': '_hasBurningRage',
        'Serrated Stones': '_hasSerratedStones',
        'Piercing Shards': '_hasPiercingShards',
        'Flow like Water': '_hasFlowLikeWater',
        'Arcane Precision': '_hasArcanePrecision',
        'Arcane Prowess': '_hasArcaneProwess',
        'Elemental Attunement': '_hasElemAttunement',
        'Elemental Lockdown': '_hasElemLockdown',
        'Arcane Lightning': '_hasArcaneLightning',
        'Bountiful Power': '_hasBountifulPower',
    };
    const flag = traitFlags[disTrait];
    if (flag) S[flag] = false;
}

const PERMA_DAMAGING_CONDITIONS = new Set([
    'Burning', 'Bleeding', 'Poisoned', 'Poison', 'Torment', 'Confusion',
]);

export function applyPermanentBoons(engine, S, permaBoons, permaExpiry) {
    for (const [effect, val] of Object.entries(permaBoons)) {
        if (!val) continue;
        const count = typeof val === 'number' ? val : 1;
        for (let i = 0; i < count; i++) {
            pushTimedStack(S, { t: 0, cond: effect, expiresAt: permaExpiry, perma: true });
        }
        if (PERMA_DAMAGING_CONDITIONS.has(effect)) {
            const cs = ensureConditionState(S, effect);
            for (let i = 0; i < count; i++) {
                cs.stacks.push({ t: 0, expiresAt: permaExpiry, appliedBy: null, perma: true });
            }
        }
    }
    if (permaBoons.Quickness) S.quicknessUntil = permaExpiry;
    if (permaBoons.Alacrity) S.alacrityUntil = permaExpiry;
    S.permaBoons = permaBoons;
}

export function initializeEmpowermentPool(S, attributes, eliteSpec) {
    S._empPool = {};
    if (eliteSpec !== 'Catalyst') return;

    for (const stat of ['Power', 'Precision', 'Ferocity', 'Condition Damage', 'Expertise', 'Concentration']) {
        const s = attributes[stat] || {};
        S._empPool[stat] = (s.base || 0) + (s.gear || 0) + (s.runes || 0) + (s.infusions || 0) + (s.food || 0);
    }
}

export function initializeElementalEmpowerment(engine, S, permaExpiry) {
    if (!S._hasElemEmpowermentTrait) return;
    if (S.hasExplicitCombatStart) return;

    for (let i = 0; i < 3; i++) {
        pushTimedStack(S, { t: 0, cond: 'Elemental Empowerment', expiresAt: permaExpiry, perma: true });
    }
}

export function initializeStartingPistolBullets(engine, S, permaExpiry) {
    for (const el of ['Fire', 'Water', 'Air', 'Earth']) {
        if (!S.pistolBullets[el]) continue;

        const condName = el === 'Water' ? 'Ice Bullet' : `${el} Bullet`;
        const entry = { t: 0, cond: condName, expiresAt: permaExpiry };
        pushTimedStack(S, entry);
        S._pistolBulletMapEntry[el] = entry;
    }
}

export function applyPermanentField(S, permaField, permaExpiry) {
    if (!permaField) return;
    S.fields.push({ type: permaField, start: 0, end: permaExpiry, skill: 'Permanent Field', perma: true });
}

export function applyRunSetupState(engine, S, {
    disTrait,
    disFood,
    permaBoons,
    eliteSpec,
    attributes,
    realStartAtt2,
    permaExpiry,
}) {
    const evokerState = getEvokerState(S);
    applyDisabledTraitFlags(S, disTrait);
    applyDisabledFoodProc(S, disFood);

    if (S._hasEnhancedPotency && evokerState.element === 'Fire') S._mightCondDmgBonus = 35;
    if (S._hasEnhancedPotency && evokerState.element === 'Air') S._furyCritBonus = 40;
    if (S._hasSpecializedElements && evokerState.element) {
        S.att = evokerState.element;
        S.attTimeline = [{ t: 0, att: evokerState.element, att2: realStartAtt2 }];
    }

    applyPermanentBoons(engine, S, permaBoons, permaExpiry);
    initializeEmpowermentPool(S, attributes, eliteSpec);
    initializeElementalEmpowerment(engine, S, permaExpiry);
    initializeStartingPistolBullets(engine, S, permaExpiry);
}

export function restoreAdjustedStats(attributes, statAdj) {
    for (const [an, v] of Object.entries(statAdj)) {
        attributes[an].final += v;
    }
}
