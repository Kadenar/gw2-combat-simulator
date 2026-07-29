// Public simulation engine root. Owns config and app-facing methods, while
// delegating run setup, scheduling, and resolution to the folderized sim core.
import {
    applyDisabledStatAdjustments,
    createRunState,
    applyRunSetupState,
    applyPermanentField,
    restoreAdjustedStats,
} from './sim/run/sim-run-setup.js';
import {
    prepareRunContext,
    executeRunPhases,
    executeRunPhasesCapture,
    executeRunPhasesWithCache,
    buildRunDamageWindow,
    finalizeRunResults,
    getPreparedRunCleanupModel,
} from './sim/run/sim-run-orchestration.js';
import {
    scheduleRotation,
    executeScheduledStep,
} from './sim/scheduler/sim-scheduler.js';
import {
    createSchedulerPhaseState,
    getSchedulerPhaseEventQueue,
} from './sim/scheduler/sim-scheduler-phase-state.js';
import { createScheduledEventStreamFromState } from './sim/shared/sim-scheduled-event-stream.js';
import { createSchedulerContext } from './sim/scheduler/sim-scheduler-context.js';
import {
    handleJadeSphere,
    handleFamiliar,
    flushPendingEnergy,
} from './sim/scheduler/sim-special-actions.js';
import {
    handleAttunementSwap,
    handleOverload,
} from './sim/scheduler/sim-attunement-actions.js';
import {
    trackField,
    applyAura,
    trackAura,
} from './sim/mechanics/sim-field-aura-combo.js';
import {
    refreshEffect,
    grantFamiliarProwess,
    rechargeWeaponSkills,
    triggerAttunementEnterEffects,
    trackEffect,
} from './sim/mechanics/sim-effect-state.js';
import {
    applyCondition,
} from './sim/resolver/sim-condition-resolution.js';
import {
    refreshArcaneLightningBuff,
} from './sim/mechanics/sim-crit-sigil-helpers.js';
import { getProcState } from './sim/state/sim-proc-state.js';
import { getCatalystState, getEvokerState } from './sim/state/sim-specialization-state.js';
import { getRelicStrikeMultiplier } from './sim/mechanics/sim-relic-helpers.js';
import {
    getCooldownKey,
    getAdjustedWeaponRechargeMs,
    getWeaponStrength,
    computeSigilMultipliers,
} from './sim/shared/sim-stat-recharge-helpers.js';
import { pushTimedStack } from './sim/state/sim-runtime-state.js';
import { expectedCritMultiplier, strikeDamage } from '../../platform/gw2/damage.js';
import { FOOD_DATA, SIGIL_DATA } from './data/gear-data.js';

const DAMAGING_CONDITIONS = new Set([
    'Burning', 'Bleeding', 'Poisoned', 'Poison', 'Torment', 'Confusion',
]);
const BOONS = new Set([
    'Aegis', 'Alacrity', 'Fury', 'Might', 'Protection', 'Quickness',
    'Regeneration', 'Resistance', 'Resolution', 'Stability', 'Swiftness', 'Vigor',
    'Superspeed',
]);
const SIGIL_STAT_MAP = {
    criticalChance: 'Critical Chance',
    conditionDuration: 'Condition Duration',
    bleedingDuration: 'Bleeding Duration',
    burningDuration: 'Burning Duration',
    poisonDuration: 'Poison Duration',
    tormentDuration: 'Torment Duration',
};
const SIGIL_PROCS = {
    Air: {
        trigger: 'crit', icd: 3000, effect: 'strike', coeff: 1.1, ws: 690.5, canCrit: false,
        icon: SIGIL_DATA.Air.icon,
    },
    Torment: {
        trigger: 'crit', icd: 5000, effect: 'condition', cond: 'Torment', stacks: 2, dur: 5,
        icon: SIGIL_DATA.Torment.icon,
    },
    Earth: {
        trigger: 'crit', icd: 2000, effect: 'condition', cond: 'Bleeding', stacks: 1, dur: 6,
        icon: SIGIL_DATA.Earth.icon,
    },
    Blight: {
        trigger: 'crit', icd: 8000, effect: 'condition', cond: 'Poisoned', stacks: 2, dur: 4,
        icon: SIGIL_DATA.Blight.icon,
    },
    Doom: {
        trigger: 'swap', icd: 9000, effect: 'doom', cond: 'Poisoned', stacks: 3, dur: 8,
        icon: SIGIL_DATA.Doom.icon,
    },
    Hydromancy: {
        trigger: 'swap', icd: 9000, effect: 'strike_cond', coeff: 1.0, ws: 690.5, canCrit: true,
        cond: 'Chilled', stacks: 1, dur: 2,
        icon: SIGIL_DATA.Hydromancy.icon,
    },
    Geomancy: {
        trigger: 'swap', icd: 9000, effect: 'condition', cond: 'Bleeding', stacks: 1, dur: 8,
        icon: SIGIL_DATA.Geomancy.icon,
    },
    Energy: {
        trigger: 'swap', icd: 9000, effect: 'endurance', amount: 50,
        icon: SIGIL_DATA.Energy.icon,
    },
    Severance: {
        trigger: 'cc', icd: 1000, effect: 'buff',
        precision: 250, ferocity: 250, dur: 4,
        icon: SIGIL_DATA.Severance.icon,
    },
};

const TARGET_ARMOR = 2597;
const FRESH_AIR_FEROCITY_CRIT_DAMAGE = 250 / 15;

function buildEffectWindows(allCondStacks = [], effectName) {
    return allCondStacks
        .filter(stack => stack.cond === effectName)
        .map(stack => ({ start: stack.t, end: stack.expiresAt }))
        .sort((a, b) => a.start - b.start);
}

function isEffectActiveAt(windows, time) {
    for (const window of windows) {
        if (window.start > time) return false;
        if (window.start <= time && window.end > time) return true;
    }
    return false;
}

function expectedDoubleOnCritMultiplier(critChancePct, critDamagePct) {
    const cc = Math.min(critChancePct / 100, 1);
    const critOnlyMultiplier = critDamagePct / 100;
    return 1 + cc * ((critOnlyMultiplier * 2) - 1);
}

function computeFreshAirEffectContribution(results) {
    const windows = buildEffectWindows(results.allCondStacks, 'Fresh Air');
    if (windows.length === 0) return 0;

    let total = 0;
    for (const entry of (results.log || [])) {
        if (entry.type !== 'hit' || !entry.diag) continue;
        if (!isEffectActiveAt(windows, entry.t)) continue;
        if (!(entry.coeff > 0) || !(entry.diag.ws > 0) || !(entry.diag.power > 0)) continue;

        const withoutCritDmg = entry.diag.critDmg - FRESH_AIR_FEROCITY_CRIT_DAMAGE;
        const withoutCritMult = entry.skill === 'Electric Discharge'
            ? expectedDoubleOnCritMultiplier(entry.diag.critCh || 0, withoutCritDmg)
            : expectedCritMultiplier(entry.diag.critCh || 0, withoutCritDmg);
        const withCritMult = entry.diag.critMul || 0;
        const rawStrike = strikeDamage(entry.coeff, entry.diag.ws, entry.diag.power, TARGET_ARMOR);
        total += rawStrike * (withCritMult - withoutCritMult) * (entry.diag.strikeMul || 0);
    }

    return total;
}

function computeTranscendentTempestEffectContribution(results) {
    const windows = buildEffectWindows(results.allCondStacks, 'Transcendent Tempest');
    if (windows.length === 0) return 0;

    let total = 0;

    for (const entry of (results.log || [])) {
        if (entry.type === 'hit' && entry.diag && isEffectActiveAt(windows, entry.t)) {
            if (!(entry.coeff > 0) || !(entry.diag.ws > 0) || !(entry.diag.power > 0)) continue;
            const baseStrike = entry.diag.baseStrike || 0;
            const strikeMul = entry.diag.strikeMul || 0;
            const sigilStrikeAdd = entry.diag.sigilStrikeAdd || 0;
            const sigilStrikeMul = entry.diag.sigilStrikeMul || 1;
            const addStrikeWithout = (entry.diag.addStrike || 0) - 0.25;
            const baseStrikeWithout = (1 + sigilStrikeAdd + addStrikeWithout) * sigilStrikeMul;
            if (!(baseStrike > 0) || !(baseStrikeWithout >= 0)) continue;

            const rawStrike = strikeDamage(entry.coeff, entry.diag.ws, entry.diag.power, TARGET_ARMOR);
            const strikeMulWithout = strikeMul * (baseStrikeWithout / baseStrike);
            total += rawStrike * (entry.diag.critMul || 0) * (strikeMul - strikeMulWithout);
            continue;
        }

        if (entry.type === 'cond_tick' && entry.diag && isEffectActiveAt(windows, entry.t)) {
            const sigilCondAdd = entry.diag.sigilCondAdd || 0;
            const sigilCondMul = entry.diag.sigilCondMul || 1;
            const otherAdd = (entry.diag.hammerFireOrb || 0)
                + (entry.diag.tempAria || 0)
                + (entry.diag.elemRage || 0)
                + (entry.diag.empAuras || 0)
                + (entry.diag.famProwess || 0);
            const condMulWithout = (1 + sigilCondAdd + otherAdd) * sigilCondMul * (entry.diag.vulnMul || 1);
            total += (entry.diag.baseTick || 0) * (entry.stacks || 0) * ((entry.diag.condMul || 0) - condMulWithout);
        }
    }

    return total;
}
export const RELIC_PROCS = {
    Akeem: {
        trigger: 'cc_5torment_confusion', icd: 10000, strikeDmgM: 0, effectDuration: 0,
        conditions: { Confusion: { stacks: 2, dur: 10 }, Torment: { stacks: 2, dur: 10 } },
        icon: 'https://render.guildwars2.com/file/594C437E9606A167F4F372BCEB0C2B7C7828037B/3122330.png',
    },
    Fireworks: {
        trigger: 'weapon_recharge20', icd: 0, strikeDmgM: 0.07, effectDuration: 6000,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/2999CCF7C94267B2EE3DDA7459050864622927C9/3122349.png',
    },
    Mistburn: {
        trigger: 'might_crit_chance', mightThreshold: 10, criticalChance: 10,
        conditions: null, icon: null,
    },
    'Mist Stranger': {
        trigger: 'flat_on_hit', flatDamage: 105,
        conditions: null, icon: null,
    },
    Nourys: {
        trigger: 'nourys', icd: 0, strikeDmgA: 0.25, condDmgA: 0.25, effectDuration: 5000,
        stackInterval: 3000, stacksNeeded: 10,
        conditions: null,
        icon: 'https://wiki.guildwars2.com/images/3/3f/Relic_of_Nourys.png',
    },
    'Mount Balrior': {
        trigger: 'elite_delayed', icd: 30000, delay: 1000, strikeDmgM: 0.15, effectDuration: 6000,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/49A8520BDB6C5A7BA90832DB9406677473A6932F/3441973.png',
    },
    Peitha: {
        trigger: 'polaric_leap', icd: 4000, strikeDmgM: 0.10, effectDuration: 4000,
        conditions: { Torment: { stacks: 2, dur: 7 } },
        icon: 'https://render.guildwars2.com/file/949A6A4179F514FCDEF3AC3D9C292B38D5E0047D/3122365.png',
    },
    Shackles: {
        trigger: 'immobilize_tether', icd: 10000, effectDuration: 5000,
        strikeCoeff: 3.0, strikeWs: 690.5,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/7946A50DBDC2E45E004AAA801904015C50CC22B3/3745069.png',
    },
    Claw: {
        trigger: 'cc_any', icd: 0, strikeDmgM: 0.07, effectDuration: 8000,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png',
    },
    Aristocracy: {
        trigger: 'apply_weakness_vuln', icd: 1000, strikeDmgM: 0, effectDuration: 8000,
        maxStacks: 5, condDurPerStack: 3,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/BCC01F0B6616FE26ED4BE159532A6A6FBD0EA2D8/3122332.png',
    },
    Blightbringer: {
        trigger: 'poison_6th', icd: 8000, strikeDmgM: 0, effectDuration: 0,
        poisonCountNeeded: 6,
        conditions: { Poisoned: { stacks: 3, dur: 10 }, Cripple: { stacks: 1, dur: 5 }, Weakness: { stacks: 1, dur: 5 } },
        icon: 'https://render.guildwars2.com/file/286C60AC6FA239B0070293039091A44476A35E90/3375219.png',
    },
    Brawler: {
        trigger: 'gain_protection_resolution', icd: 8000, strikeDmgM: 0.10, effectDuration: 4000,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/2B5297A932F55DA3BDDD0A39C9CB0D9CF70244A1/3122334.png',
    },
    Dragonhunter: {
        trigger: 'trap_skill', icd: 0, strikeDmgM: 0.10, effectDuration: 5000,
        uncappedCondDur: 10,
        conditions: null, icon: null,
    },
    Eagle: {
        trigger: 'eagle_below50', icd: 0, strikeDmgM: 0.10, effectDuration: 0,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/DFF4EB43AD0803F60D105658052321A0BE1AF02C/3592832.png',
    },
    Fractal: {
        trigger: 'bleed_6stacks', icd: 20000, strikeDmgM: 0, effectDuration: 0,
        conditions: { Burning: { stacks: 2, dur: 8 }, Torment: { stacks: 3, dur: 8 } },
        icon: 'https://render.guildwars2.com/file/B2D409644147BF18935A95A52505ABCB9EECE142/3122351.png',
    },
    Krait: {
        trigger: 'elite_delayed', icd: 30000, delay: 1000, strikeDmgM: 0, effectDuration: 0,
        strikeCoeff: 0.5, strikeWs: 690.5,
        conditions: { Bleeding: { stacks: 1, dur: 8 }, Poisoned: { stacks: 1, dur: 8 }, Torment: { stacks: 1, dur: 8 } },
        icon: 'https://render.guildwars2.com/file/645EFCBFFBB7B1C6630CBB7C0FB268CA27B703AC/3122355.png',
    },
    Thief: {
        trigger: 'weapon_recharge_hit', icd: 0, strikeDmgM: 0, effectDuration: 6000,
        stackDmgPer: 0.01, maxStacks: 5,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/3523AC08EB04347CF371E9A91F4B985D12FB4ED3/3122371.png',
    },
    Weaver: {
        trigger: 'stance_skill', icd: 0, strikeDmgM: 0.10, effectDuration: 4000,
        conditions: null,
        icon: 'https://render.guildwars2.com/file/12997110B0509463DD9F1364A92493B2C4309BE1/3122377.png',
    },
    Fire: {
        // On healing skill (ICD 20s): grant Fire Aura 4s.
        // While Fire Aura is active: +7% strike damage (multiplicative).
        trigger: 'heal_skill', icd: 20000, strikeDmgM: 0.07, effectDuration: 4000,
        conditions: null, icon: 'https://render.guildwars2.com/file/00E5051DCC0EDD58395DF9CEA3456466EA4FD347/3592834.png',
    },
    Bloodstone: {
        trigger: 'blast_combo', icd: 0, strikeDmgM: 0.07, effectDuration: 8000,
        volatilityDuration: 10000, stacksNeeded: 4,
        explosionDelay: 680,
        strikeCoeff: 3.0, strikeWs: 690.5,
        conditions: { Bleeding: { stacks: 6, dur: 6 } },
        icon: 'https://render.guildwars2.com/file/A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png',
    },
    Steamshrieker: {
        trigger: 'water_blast_leap_combo', icd: 0,
        conditions: { Burning: { stacks: 1, dur: 5 } },
        icon: 'https://render.guildwars2.com/file/23B0F0A5BF05E05C9F527BF7EB4962C9F49C6F42/3441975.png',
    },
    Thorns: {
        trigger: 'enemy_hit', icd: 5000, conditionDamagePerStack: 30, maxStacks: 10,
        bossAuraHitInterval: 3000, defaultHitInterval: 5000,
        conditions: null,
        icon: 'https://wiki.guildwars2.com/images/8/8a/Relic_of_Thorns.png',
    },
};
const ATTUNEMENTS = ['Fire', 'Water', 'Air', 'Earth'];
const OFF_ATT_CD = 1500;
const OVERLOAD_DWELL = 6000;
const SWAP_ICON = 'https://render.guildwars2.com/file/F0C7F54A6FC70D079E1628FFE871980CAEBFD70D/1012290.png';
const CATALYST_ENERGY_MAX = 30;
const CATALYST_SPHERE_COST = 10;
const CONJURE_WEAPONS = new Set(['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword']);
const CONJURE_MAP = {
    'Conjure Frost Bow': 'Frost Bow',
    'Conjure Lightning Hammer': 'Lightning Hammer',
    'Conjure Fiery Greatsword': 'Fiery Greatsword',
};
const CONJURE_PICKUP_DURATION = 35000;
const FIRE_FIELD_SKILLS = new Set([
    'Lava Font', 'Pyroclastic Blast', 'Burning Retreat', 'Burning Speed',
    'Flamewall', 'Wildfire', 'Flame Uprising', 'Ring of Fire'
]);
const EVOKER_FAMILIAR_SELECTORS = new Set(['Ignite', 'Splash', 'Zap', 'Calcify']);
const EVOKER_NO_CHARGE_SKILLS = new Set([
    'Transmute Earth', 'Hurl', 'Transmute Frost', 'Transmute Lightning', 'Transmute Fire', 'Grand Finale'
]);
// Skills used to fill dead-time gaps before the next skill becomes available (ctrl+click).
// Keyed by the player's current attunement at gap time.
const GAP_FILL_SKILLS = { Air: 'Arc Lightning', Earth: 'Stone Shards' };
const EVOKER_ELEMENT_MAP = {
    Ignite: 'Fire', Splash: 'Water', Zap: 'Air', Calcify: 'Earth',
    Conflagration: 'Fire', 'Buoyant Deluge': 'Water', 'Lightning Blitz': 'Air', 'Seismic Impact': 'Earth'
};

// Spear Etching chains: Etching → lesser → (3 other Spear weapon casts) → full
// Casting lesser OR full resets back to Etching.
const ETCHING_CHAINS = {
    'Volcano': { etching: 'Etching: Volcano', lesser: 'Lesser Volcano', full: 'Volcano' },
    'Jökulhlaup': { etching: 'Etching: Jökulhlaup', lesser: 'Lesser Jökulhlaup', full: 'Jökulhlaup' },
    'Derecho': { etching: 'Etching: Derecho', lesser: 'Lesser Derecho', full: 'Derecho' },
    'Haboob': { etching: 'Etching: Haboob', lesser: 'Lesser Haboob', full: 'Haboob' },
};
// Map any of the three names → the chain entry
const ETCHING_LOOKUP = new Map();
for (const chain of Object.values(ETCHING_CHAINS)) {
    ETCHING_LOOKUP.set(chain.etching, chain);
    ETCHING_LOOKUP.set(chain.lesser, chain);
    ETCHING_LOOKUP.set(chain.full, chain);
}
// Skills that grant "next Spear skill" buffs
const SPEAR_NEXT_BUFF_SKILLS = new Set(['Seethe', 'Ripple', 'Energize', 'Harden']);

// ── Hammer orb system ─────────────────────────────────────────────────────────
// Each orb skill grants one elemental orb (15s duration, ticking damage).
// Grand Finale consumes all active orbs, dealing hits and applying conditions per orb.
const HAMMER_ORB_SKILLS = {
    'Flame Wheel': 'Fire',
    'Icy Coil': 'Water',
    'Crescent Wind': 'Air',
    'Rocky Loop': 'Earth',
};
// Dual orbit skills grant two orbs each
const HAMMER_DUAL_ORB_SKILLS = {
    'Dual Orbits: Fire and Water': ['Fire', 'Water'],
    'Dual Orbits: Fire and Air': ['Fire', 'Air'],
    'Dual Orbits: Fire and Earth': ['Fire', 'Earth'],
    'Dual Orbits: Water and Air': ['Water', 'Air'],
    'Dual Orbits: Water and Earth': ['Water', 'Earth'],
    'Dual Orbits: Air and Earth': ['Air', 'Earth'],
};
const HAMMER_ORB_DURATION_MS = 15000;
const HAMMER_ORB_ICD_MS = 480; // between orb skills and Grand Finale
// Per-orb conditions applied by Grand Finale when that orb is consumed
const HAMMER_GF_CONDITIONS = {
    Fire: { cond: 'Burning', stacks: 2, dur: 5 },
    Water: { cond: 'Vulnerability', stacks: 6, dur: 10 },
    Air: { cond: 'Weakness', stacks: 1, dur: 5 },
    Earth: { cond: 'Bleeding', stacks: 4, dur: 5 },
};
// Orbs that grant buffs to the caster (tracked as pseudo-effects in _condMap)
const HAMMER_ORB_BUFF_KEY = {
    Fire: 'Hammer Orb Fire',   // +5% strike and condi
    Water: 'Hammer Orb Water',  // tracked for display only
    Air: 'Hammer Orb Air',    // +15% crit chance
    Earth: 'Hammer Orb Earth',  // tracked for display only
};
// All Hammer orb-category skill names (base + dual), used for ICD and chain checks
const HAMMER_ALL_ORB_NAMES = new Set([
    ...Object.keys(HAMMER_ORB_SKILLS),
    ...Object.keys(HAMMER_DUAL_ORB_SKILLS),
]);

// ── Pistol bullet system ──────────────────────────────────────────────────────
// Slot 2 and 3 Pistol skills grant their element's bullet if not held, or consume it if held.
// "Consume" effects and "grant" effects are applied in the post-cast section of _step().
const PISTOL_BULLET_COLOR = {
    Fire: '#e05530', Water: '#4488cc', Air: '#c06ad0', Earth: '#aa7744',
};
// Which element does each base pistol skill belong to?
const PISTOL_SKILL_ELEMENT = {
    // Slot 2
    'Raging Ricochet': 'Fire',
    'Frigid Flurry': 'Water',
    'Dazing Discharge': 'Air',
    'Shattering Stone': 'Earth',
    // Slot 3 (base)
    'Searing Salvo': 'Fire',
    'Frozen Fusillade': 'Water',
    'Aerial Agility': 'Air',   // never consumes, may grant
    'Aerial Agility (chain)': 'Air',
    'Aerial Agility (dash)': 'Air',
    'Boulder Blast': 'Earth',
    // Slot 3 (Weaver dual) — handled separately, listed here for lookup convenience
    'Frostfire Flurry': null,  // Fire+Water dual
    'Purblinding Plasma': null,  // Fire+Air dual
    'Molten Meteor': null,  // Fire+Earth dual
    'Flowing Finesse': null,  // Air+Water dual
    'Echoing Erosion': null,  // Water+Earth dual
    'Enervating Earth': null,  // Air+Earth dual
};
// Dual pistol slot-3 skill → [priElement, secElement] (Fire is always listed first when present)
const PISTOL_DUAL_ELEMENTS = {
    'Frostfire Flurry': ['Fire', 'Water'],
    'Purblinding Plasma': ['Fire', 'Air'],
    'Molten Meteor': ['Fire', 'Earth'],
    'Flowing Finesse': ['Water', 'Air'],
    'Echoing Erosion': ['Water', 'Earth'],
    'Enervating Earth': ['Air', 'Earth'],
};
// Skills that NEVER consume a bullet
const PISTOL_NO_CONSUME = new Set(['Aerial Agility', 'Aerial Agility (chain)', 'Aerial Agility (dash)']);
// Skills that NEVER grant a bullet
const PISTOL_NO_GRANT = new Set(['Aerial Agility (chain)', 'Aerial Agility (dash)']);

const PERMA_EXPIRY = 999999999;

const NOOP_ARRAY = { push() { }, length: 0 };

// When hitboxSize is 'small', these skills have their hit count capped.
// Key = skill name, value = max hit index (rows with h.hit > cap are skipped).
export const SMALL_HITBOX_CAPS = new Map([
    ['Meteor Shower', 12],
    ['Lightning Orb', 11],
    ['Frost Storm', 14],
    ['Invoke Lightning', 9],
    ['Glyph of Storms (Air)', 20],
    ['Glyph of Storms (Water)', 11],
    ['Dust Storm', 6],
    ['Fiery Whirl', 4],
]);

// Duration-based skills that gain extra ticks on large hitbox.
// Key = skill name, value = bonus duration (in the same unit as the CSV Duration column).
export const LARGE_HITBOX_DURATION_BONUS = new Map([
    ['Wildfire', 2],
]);

export class SimulationEngine {
    constructor({ skills, skillHits, weapons, attributes, sigils, relics, activeTraits, hitboxSize, glyphBoonedElementals, thornsBossAuraOnly }) {
        this.skills = skills;
        this.skillHits = skillHits;
        this.weapons = weapons;
        this.attributes = attributes;
        this.sigils = sigils || {};
        this.relics = relics || {};
        this.activeTraitNames = new Set((activeTraits || []).map(t => t.name));
        this.hitboxSize = hitboxSize || 'large';
        this.glyphBoonedElementals = !!glyphBoonedElementals;
        this.thornsBossAuraOnly = !!thornsBossAuraOnly;
        this.rotation = [];
        this.results = null;
        this.fastMode = false;
    }

    _hasTrait(name) { return this.activeTraitNames.has(name); }

    addSkill(name) { this.rotation.push(name); }
    removeSkill(idx) { this.rotation.splice(idx, 1); }
    moveSkill(from, to) {
        const [item] = this.rotation.splice(from, 1);
        this.rotation.splice(to, 0, item);
    }
    clearRotation() { this.rotation = []; this.results = null; }

    _skill(name) { return this.skills.find(s => s.name === name); }

    _skillInContext(name, S) {
        const matches = this.skills.filter(s => s.name === name);
        if (matches.length <= 1) return matches[0] || null;
        if (S.conjureEquipped) {
            return matches.find(s => s.weapon === S.conjureEquipped)
                || matches.find(s => !CONJURE_WEAPONS.has(s.weapon))
                || matches[0];
        }
        return matches.find(s => !CONJURE_WEAPONS.has(s.weapon)) || matches[0];
    }

    _cdKey(sk) {
        return getCooldownKey(sk, {
            conjureWeapons: CONJURE_WEAPONS,
        });
    }

    _getEliteSpec() {
        const specs = this.attributes.specializations || [];
        const elites = new Set(['Tempest', 'Weaver', 'Catalyst', 'Evoker']);
        const found = specs.find(s => elites.has(s.name || s));
        return found ? (found.name || found) : null;
    }

    _ws(skill) {
        return getWeaponStrength(this, skill);
    }

    _createRootSchedulerContext(S) {
        let ctx = null;
        ctx = createSchedulerContext(this, S, {
            attunements: ATTUNEMENTS,
            offAttCd: OFF_ATT_CD,
            overloadDwell: OVERLOAD_DWELL,
            catalystEnergyMax: CATALYST_ENERGY_MAX,
            catalystSphereCost: CATALYST_SPHERE_COST,
            swapIcon: SWAP_ICON,
            conjureWeapons: CONJURE_WEAPONS,
            conjureMap: CONJURE_MAP,
            conjurePickupDuration: CONJURE_PICKUP_DURATION,
            fireFieldSkills: FIRE_FIELD_SKILLS,
            gapFillSkills: GAP_FILL_SKILLS,
            evokerFamiliarSelectors: EVOKER_FAMILIAR_SELECTORS,
            evokerNoChargeSkills: EVOKER_NO_CHARGE_SKILLS,
            evokerElementMap: EVOKER_ELEMENT_MAP,
            etchingLookup: ETCHING_LOOKUP,
            etchingChains: ETCHING_CHAINS,
            hammerAllOrbNames: HAMMER_ALL_ORB_NAMES,
            hammerOrbSkills: HAMMER_ORB_SKILLS,
            hammerDualOrbSkills: HAMMER_DUAL_ORB_SKILLS,
            hammerOrbDurationMs: HAMMER_ORB_DURATION_MS,
            hammerOrbIcdMs: HAMMER_ORB_ICD_MS,
            hammerOrbBuffKey: HAMMER_ORB_BUFF_KEY,
            hammerGfConditions: HAMMER_GF_CONDITIONS,
            permaExpiry: PERMA_EXPIRY,
            pistolSkillElement: PISTOL_SKILL_ELEMENT,
            pistolDualElements: PISTOL_DUAL_ELEMENTS,
            pistolNoConsume: PISTOL_NO_CONSUME,
            pistolNoGrant: PISTOL_NO_GRANT,
            boons: BOONS,
            relicProcs: RELIC_PROCS,
            sigilProcs: SIGIL_PROCS,
            runStep: (name, skipCastUntil = false, concurrents = [], rotationMeta = {}) =>
                executeScheduledStep(ctx, name, skipCastUntil, concurrents, rotationMeta),
            doSwap: (sk, isConcurrent = false, concurrents = []) =>
                handleAttunementSwap(ctx, sk, isConcurrent, concurrents, ctx),
            doOverload: (sk, concurrents = []) =>
                handleOverload(ctx, sk, concurrents, ctx),
            doJadeSphere: (sk, concurrents = []) =>
                handleJadeSphere(ctx, sk, concurrents, ctx),
            doFamiliar: (sk, concurrents = []) =>
                handleFamiliar(ctx, sk, concurrents, ctx),
        });
        return ctx;
    }

    run(
        startAtt = 'Fire',
        startAtt2 = null,
        startEvokerElement = null,
        permaBoons = {},
        disabled = null,
        targetHP = 0,
        stopAtTime = null,
        startPistolBullets = null,
        startEvokerCharges = 6,
        startEvokerEmpowered = 0,
    ) {
        const a = this.attributes.attributes;
        const runCtx = this._prepareRunContext(a, {
            startAtt,
            startAtt2,
            startEvokerElement,
            startEvokerCharges,
            startEvokerEmpowered,
            permaBoons,
            disabled,
            startPistolBullets,
        });

        try {
            const { S, rotEnd, deathTime } = this._executeRunPhases(runCtx, {
                stopAtTime,
                targetHP,
            });
            const dpsCtx = this._buildRunDamageWindow(S, rotEnd, deathTime);
            this.results = this._finalizeRunResults(S, rotEnd, deathTime, targetHP, dpsCtx);
            return this.results;
        } finally {
            const { statAdj } = getPreparedRunCleanupModel(runCtx);
            this._restoreAdjustedStats(a, statAdj);
        }
    }

    runCaptureSchedule(
        startAtt = 'Fire',
        startAtt2 = null,
        startEvokerElement = null,
        permaBoons = {},
        targetHP = 0,
        startPistolBullets = null,
        startEvokerCharges = 6,
        startEvokerEmpowered = 0,
    ) {
        const a = this.attributes.attributes;
        const runCtx = this._prepareRunContext(a, {
            startAtt, startAtt2, startEvokerElement,
            startEvokerCharges, startEvokerEmpowered,
            permaBoons, disabled: null, startPistolBullets,
        });

        try {
            const { S, rotEnd, deathTime, capturedStream } = executeRunPhasesCapture(this, runCtx, {
                stopAtTime: null, targetHP,
            });
            const dpsCtx = this._buildRunDamageWindow(S, rotEnd, deathTime);
            this.results = this._finalizeRunResults(S, rotEnd, deathTime, targetHP, dpsCtx);
            this._cachedScheduledStream = capturedStream;
            return this.results;
        } finally {
            const { statAdj } = getPreparedRunCleanupModel(runCtx);
            this._restoreAdjustedStats(a, statAdj);
        }
    }

    runWithCachedSchedule(
        startAtt = 'Fire',
        startAtt2 = null,
        startEvokerElement = null,
        permaBoons = {},
        cachedStream = null,
        targetHP = 0,
        startPistolBullets = null,
        startEvokerCharges = 6,
        startEvokerEmpowered = 0,
    ) {
        const stream = cachedStream || this._cachedScheduledStream;
        if (!stream) throw new Error('No cached scheduled stream available');

        const a = this.attributes.attributes;
        const runCtx = this._prepareRunContext(a, {
            startAtt, startAtt2, startEvokerElement,
            startEvokerCharges, startEvokerEmpowered,
            permaBoons, disabled: null, startPistolBullets,
        });

        try {
            const { S, rotEnd, deathTime } = executeRunPhasesWithCache(this, runCtx, stream, {
                stopAtTime: null, targetHP,
            });
            const dpsCtx = this._buildRunDamageWindow(S, rotEnd, deathTime);
            this.results = this._finalizeRunResults(S, rotEnd, deathTime, targetHP, dpsCtx);
            return this.results;
        } finally {
            const { statAdj } = getPreparedRunCleanupModel(runCtx);
            this._restoreAdjustedStats(a, statAdj);
        }
    }

    _prepareRunContext(a, {
        startAtt,
        startAtt2,
        startEvokerElement,
        startEvokerCharges,
        startEvokerEmpowered,
        permaBoons,
        disabled,
        startPistolBullets,
    }) {
        return prepareRunContext(this, a, {
            startAtt,
            startAtt2,
            startEvokerElement,
            startEvokerCharges,
            startEvokerEmpowered,
            permaBoons,
            disabled,
            startPistolBullets,
            fireFieldSkills: FIRE_FIELD_SKILLS,
            catalystEnergyMax: CATALYST_ENERGY_MAX,
            conjureWeapons: CONJURE_WEAPONS,
            relicProcs: RELIC_PROCS,
            boons: BOONS,
            damagingConditions: DAMAGING_CONDITIONS,
            sigilProcs: SIGIL_PROCS,
            hammerDualOrbSkills: HAMMER_DUAL_ORB_SKILLS,
        });
    }

    _applyDisabledStatAdjustments(a, disabled) {
        return applyDisabledStatAdjustments(this, a, disabled, SIGIL_STAT_MAP);
    }

    _isProcSigil(name) {
        return !!SIGIL_PROCS[name];
    }

    _normalizeStartAttunement(startAtt) {
        return ATTUNEMENTS.includes(startAtt) ? startAtt : 'Fire';
    }

    _normalizeSecondaryAttunement(eliteSpec, startAtt2, realStartAtt) {
        if (eliteSpec !== 'Weaver') return null;
        return ATTUNEMENTS.includes(startAtt2) ? startAtt2 : realStartAtt;
    }

    _executeRunPhases(runCtx, { stopAtTime, targetHP }) {
        return executeRunPhases(this, runCtx, { stopAtTime, targetHP });
    }

    _buildRunDamageWindow(S, rotEnd, deathTime) {
        return buildRunDamageWindow(S, rotEnd, deathTime);
    }

    _finalizeRunResults(S, rotEnd, deathTime, targetHP, { effectiveDmg, dpsWindowMs }) {
        return finalizeRunResults(this, S, rotEnd, deathTime, targetHP, { effectiveDmg, dpsWindowMs });
    }

    _createRunState({
        eliteSpec,
        realStartAtt,
        realStartAtt2,
        startEvokerElement,
        startEvokerCharges,
        startEvokerEmpowered,
        activeRelic,
        relicProc,
        startPistolBullets,
    }) {
        return createRunState(this, {
            eliteSpec,
            realStartAtt,
            realStartAtt2,
            startEvokerElement,
            startEvokerCharges,
            startEvokerEmpowered,
            activeRelic,
            relicProc,
            startPistolBullets,
            catalystEnergyMax: CATALYST_ENERGY_MAX,
            noopArray: NOOP_ARRAY,
        });
    }

    _applyRunSetupState(S, {
        disTrait,
        disFood,
        permaBoons,
        eliteSpec,
        a,
        realStartAtt2,
    }) {
        applyRunSetupState(this, S, {
            disTrait,
            disFood,
            permaBoons,
            eliteSpec,
            attributes: a,
            realStartAtt2,
            permaExpiry: PERMA_EXPIRY,
        });
        applyPermanentField(S, this.permaField, PERMA_EXPIRY);
    }

    _restoreAdjustedStats(a, statAdj) {
        return restoreAdjustedStats(a, statAdj);
    }

    _buildFastResults(effectiveDmg, dpsWindowMs) {
        return {
            dps: dpsWindowMs > 0 ? effectiveDmg / (dpsWindowMs / 1000) : 0,
        };
    }

    _computeCondAvgStacks(S, dpsWindowMs) {
        const windowSec = dpsWindowMs / 1000;
        if (windowSec <= 0) return {};
        const avg = {};
        for (const [cond, stackSeconds] of Object.entries(S.condStackSeconds)) {
            avg[cond] = stackSeconds / windowSec;
        }
        return avg;
    }

    _buildPerSkillSummary(S) {
        const perSkill = Object.fromEntries(
            Object.entries(S.perSkill || {}).map(([name, stats]) => [name, { ...stats }])
        );
        const skillNames = new Set(Object.keys(perSkill));
        if (skillNames.size === 0) return perSkill;

        const excludedStepTypes = new Set(['swap', 'wait', 'drop', 'pickup', 'combat_start']);
        const stepCounts = {};
        const stepCastMs = {};
        for (const step of (S.steps || [])) {
            if (!step?.skill || !skillNames.has(step.skill) || excludedStepTypes.has(step.type)) continue;
            stepCounts[step.skill] = (stepCounts[step.skill] || 0) + 1;
            stepCastMs[step.skill] = (stepCastMs[step.skill] || 0) + Math.max(0, (step.end || 0) - (step.start || 0));
        }

        const procLogCounts = {};
        const procKeys = new Set();
        const procLogTypes = new Set(['trait_proc', 'relic_proc', 'sigil_proc', 'jade_sphere', 'familiar_select', 'familiar_basic', 'familiar_empowered']);
        const fallbackEventCounts = {};
        const fallbackKeys = new Set();
        const fallbackEventTypes = new Set(['hit', 'apply', 'cond_apply']);

        for (const ev of (S.log || [])) {
            if (!ev?.skill || !skillNames.has(ev.skill)) continue;

            if (procLogTypes.has(ev.type)) {
                const key = `${ev.type}|${ev.skill}|${ev.t}`;
                if (!procKeys.has(key)) {
                    procKeys.add(key);
                    procLogCounts[ev.skill] = (procLogCounts[ev.skill] || 0) + 1;
                }
            }

            if (fallbackEventTypes.has(ev.type)) {
                const key = `${ev.skill}|${ev.t}`;
                if (!fallbackKeys.has(key)) {
                    fallbackKeys.add(key);
                    fallbackEventCounts[ev.skill] = (fallbackEventCounts[ev.skill] || 0) + 1;
                }
            }
        }

        const hitCounts = {};
        for (const ev of (S.log || [])) {
            if (ev?.type === 'hit' && ev.skill && skillNames.has(ev.skill)) {
                hitCounts[ev.skill] = (hitCounts[ev.skill] || 0) + 1;
            }
        }

        for (const [name, entry] of Object.entries(perSkill)) {
            const backfilledCasts = stepCounts[name] || procLogCounts[name] || fallbackEventCounts[name] || 0;
            if (backfilledCasts > entry.casts) entry.casts = backfilledCasts;

            const backfilledCastMs = stepCastMs[name] || 0;
            if (backfilledCastMs > entry.castTimeMs) entry.castTimeMs = backfilledCastMs;

            if (!entry.hits) entry.hits = hitCounts[name] || 0;
        }

        return perSkill;
    }

    _buildEndStateSnapshot(S, rotEnd) {
        const catalystState = getCatalystState(S);
        const evokerState = getEvokerState(S);
        return {
            time: rotEnd,
            att: S.att,
            att2: S.att2,
            attEnteredAt: S.attEnteredAt,
            attCD: { ...S.attCD },
            attCDMeta: S.attCDMeta ? JSON.parse(JSON.stringify(S.attCDMeta)) : {},
            skillCD: { ...S.skillCD },
            skillCDMeta: S.skillCDMeta ? JSON.parse(JSON.stringify(S.skillCDMeta)) : {},
            traitICD: { ...S.traitICD },
            charges: JSON.parse(JSON.stringify(S.charges)),
            chainState: { ...S.chainState },
            chainExpiry: { ...S.chainExpiry },
            conjureEquipped: S.conjureEquipped,
            conjurePickups: S.conjurePickups.filter(p => p.expiresAt > rotEnd).map(p => ({ ...p })),
            eliteSpec: S.eliteSpec,
            energy: catalystState.energy,
            sphereActiveUntil: catalystState.sphereActiveUntil,
            sphereWindows: catalystState.sphereWindows.filter(w => w.end > rotEnd).map(w => ({ ...w })),
            evokerElement: evokerState.element,
            evokerCharges: evokerState.charges,
            evokerEmpowered: evokerState.empowered,
            evokerMaxCharges: S._hasSpecializedElements ? 4 : 6,
            evokerFamiliarLockouts: JSON.parse(JSON.stringify(getProcState(S).lastEmpoweredFamiliarByBasic || {})),
            aaCarryover: S.aaCarryover ? { ...S.aaCarryover } : null,
            quicknessUntil: S.quicknessUntil,
            alacrityUntil: S.alacrityUntil,
            endurance: S.endurance,
            hasExplicitCombatStart: S.hasExplicitCombatStart,
            combatStartTime: S.combatStartTime,
            weaveSelfUntil: S.weaveSelfUntil,
            weaveSelfVisited: [...S.weaveSelfVisited],
            perfectWeaveUntil: S.perfectWeaveUntil,
            unravelUntil: S.unravelUntil,
            permaBoons: S.permaBoons || {},
            _hasTranscendentTempest: S._hasTranscendentTempest,
            etchingState: { ...S.etchingState },
            etchingOtherCasts: { ...S.etchingOtherCasts },
            hammerOrbs: { ...S.hammerOrbs },
            hammerOrbGrantedBy: { ...S.hammerOrbGrantedBy },
            hammerOrbLastCast: S.hammerOrbLastCast,
            hammerOrbsUsed: [...S.hammerOrbsUsed],
            pistolBullets: { ...S.pistolBullets },
            dazingDischargeUntil: getProcState(S).dazingDischargeUntil,
            shatteringStoneHits: getProcState(S).shatteringStoneHits,
            shatteringStoneUntil: getProcState(S).shatteringStoneUntil,
        };
    }

    _buildDetailedResults(S, rotEnd, dpsWindowMs, effectiveDmg, deathTime, targetHP) {
        return {
            rotationMs: rotEnd,
            dpsWindowMs,
            totalDamage: effectiveDmg,
            totalStrike: S.totalStrike,
            totalCondition: S.totalCond,
            dps: dpsWindowMs > 0 ? effectiveDmg / (dpsWindowMs / 1000) : 0,
            deathTime,
            targetHP: targetHP > 0 ? targetHP : null,
            perSkill: this._buildPerSkillSummary(S),
            condDamage: S.condDamage,
            condStackSeconds: S.condStackSeconds,
            condAvgStacks: this._computeCondAvgStacks(S, dpsWindowMs),
            log: S.log,
            steps: S.steps,
            allCondStacks: S.allCondStacks,
            endState: this._buildEndStateSnapshot(S, rotEnd),
        };
    }

    _scheduleRotation(S) {
        S.hasExplicitCombatStart = this.rotation.some(item =>
            (typeof item === 'string' ? item : item?.name) === '__combat_start'
        );
        S.combatStartTime = null;
        const schedulerPhaseState = createSchedulerPhaseState(S);
        const ctx = this._createRootSchedulerContext(schedulerPhaseState);
        const rotationEndTime = scheduleRotation(ctx, this.rotation);
        // Final energy catch-up: credit every direct hit that lands by the end of the last cast
        // (rotationEndTime === schedulerPhaseState.t) so the displayed end-of-rotation energy
        // reflects regen from hits after the last sphere cast (e.g. trailing auto-attacks) without
        // having to wait for the next sphere cast to flush. Hits queued for the future
        // (ev.time > t) and reactive resolver-only proc strikes are deliberately excluded, keeping
        // the displayed energy consistent with the scheduler energy model that gates sphere casts.
        flushPendingEnergy(this, schedulerPhaseState, CATALYST_ENERGY_MAX);
        const scheduledStream = createScheduledEventStreamFromState(schedulerPhaseState, rotationEndTime, {
            source: 'rotation_scheduler',
            metadata: {
                rotationLength: this.rotation.length,
                queueLength: getSchedulerPhaseEventQueue(schedulerPhaseState).length,
            },
        });

        return scheduledStream;
    }

    computeContributions(
        startAtt,
        startAtt2,
        evokerElement,
        permaBoons,
        targetHP = 0,
        startPistolBullets = null,
        startEvokerCharges = 6,
        startEvokerEmpowered = 0,
    ) {
        // Full run WITH target HP — used for the displayed DPS/kill-time results.
        this.run(
            startAtt,
            startAtt2,
            evokerElement,
            permaBoons,
            null,
            targetHP,
            null,
            startPistolBullets,
            startEvokerCharges,
            startEvokerEmpowered,
        );
        const fullResults = this.results;

        // When the target actually dies, run comparison sims with the same targetHP and cap
        // each one at the baseline's death time.  This keeps all DPS windows identical and
        // allows HP-gated mechanics (Bolt to the Heart, Eagle relic) to fire correctly.
        // When there is no kill (infinite dummy), fall back to the old no-cap approach.
        let fullDps, baselineWindowSec, baselineStop;
        let fullResultsForContrib = fullResults;
        if (targetHP > 0 && fullResults.deathTime !== null) {
            fullDps = fullResults.dps;
            baselineWindowSec = fullResults.dpsWindowMs / 1000;
            baselineStop = fullResults.deathTime;
        } else {
            // No kill — run a separate no-cap baseline so the window is independent of
            // modifier effects on kill time.
            this.run(
                startAtt,
                startAtt2,
                evokerElement,
                permaBoons,
                null,
                0,
                null,
                startPistolBullets,
                startEvokerCharges,
                startEvokerEmpowered,
            );
            fullDps = this.results.dps;
            fullResultsForContrib = this.results;
            baselineWindowSec = null;
            baselineStop = null;
        }

        // Bolt to the Heart fires once accumulated damage >= 50% of targetHP. When
        // the target doesn't die (no baselineStop), the infinite-HP re-run above acts
        // as the "without Bolt" baseline because tgtHP = Infinity keeps boltMul = 1.
        // So the contribution is simply fullResults.dps - fullDps — no extra run needed.
        const boltFires = baselineStop === null
            && targetHP > 0
            && (fullResults.totalDamage ?? 0) >= targetHP * 0.5;

        const modifiers = [];
        const ht = name => this.activeTraitNames.has(name);

        if (permaBoons.Might || fullResults.allCondStacks.some(s => s.cond === 'Might'))
            modifiers.push({ id: 'Might', name: 'Might' });
        if (permaBoons.Fury || fullResults.allCondStacks.some(s => s.cond === 'Fury'))
            modifiers.push({ id: 'Fury', name: 'Fury' });
        if (permaBoons.Vulnerability || fullResults.allCondStacks.some(s => s.cond === 'Vulnerability'))
            modifiers.push({ id: 'Vulnerability', name: 'Vulnerability' });

        for (const name of (this.attributes.sigils || [])) {
            const s = this.sigils[name];
            const hasStatEffect = s && (s.strikeDamageM || s.strikeDamageA
                || s.conditionDamageM || s.conditionDamageA
                || s.criticalChance || s.conditionDuration
                || s.bleedingDuration || s.burningDuration
                || s.poisonDuration || s.tormentDuration);
            const hasProcEffect = !!SIGIL_PROCS[name];
            if (hasStatEffect || hasProcEffect)
                modifiers.push({ id: `Sigil:${name}`, name: `Sigil of ${name}` });
        }

        const relic = this.attributes.relic;
        if (relic && RELIC_PROCS[relic])
            modifiers.push({ id: `Relic:${relic}`, name: `Relic of ${relic}` });

        const foodName = this.attributes.food;
        const foodEntry = foodName ? FOOD_DATA[foodName] : null;
        if (foodEntry?.proc)
            modifiers.push({ id: `Food:${foodEntry.proc.name}`, name: `Food: ${foodEntry.proc.name}` });

        // ── Trait contributions ──
        // Stat-based (flat bonus subtracted from attributes before running)
        if (ht('Burning Rage')) modifiers.push({ id: 'Trait:Burning Rage', name: 'Burning Rage' });
        if (ht("Zephyr's Speed")) modifiers.push({ id: "Trait:Zephyr's Speed", name: "Zephyr's Speed" });
        if (ht('Gathered Focus')) modifiers.push({ id: 'Trait:Gathered Focus', name: 'Gathered Focus' });
        if (ht('Elemental Enchantment')) modifiers.push({ id: 'Trait:Elemental Enchantment', name: 'Elemental Enchantment' });
        if (ht('Serrated Stones')) modifiers.push({ id: 'Trait:Serrated Stones', name: 'Serrated Stones' });
        // Per-hit power / ferocity bonuses (flag-based)
        if (ht("Aeromancer's Training")) modifiers.push({ id: "Trait:Aeromancer's Training", name: "Aeromancer's Training" });
        if (ht('Empowering Flame')) modifiers.push({ id: 'Trait:Empowering Flame', name: 'Empowering Flame' });
        if (ht('Power Overwhelming')) modifiers.push({ id: 'Trait:Power Overwhelming', name: 'Power Overwhelming' });
        if (ht('Raging Storm')) modifiers.push({ id: 'Trait:Raging Storm', name: 'Raging Storm' });
        if (ht('Fresh Air')) modifiers.push({ id: 'Trait:Fresh Air', name: 'Fresh Air' });
        if (ht('Elemental Polyphony')) modifiers.push({ id: 'Trait:Elemental Polyphony', name: 'Elemental Polyphony' });
        if (ht('Elemental Empowerment')) modifiers.push({ id: 'Trait:Elemental Empowerment', name: 'Elemental Empowerment' });
        if (ht('Enhanced Potency') && (permaBoons.Fury || permaBoons.Might))
            modifiers.push({ id: 'Trait:Enhanced Potency', name: 'Enhanced Potency' });
        if (ht('Superior Elements')) modifiers.push({ id: 'Trait:Superior Elements', name: 'Superior Elements' });
        if (ht('Burning Precision')) modifiers.push({ id: 'Trait:Burning Precision', name: 'Burning Precision' });
        // Weaver's Prowess no longer grants any damage bonus (patch removed cond dmg)
        // Damage multiplier traits (flag-based)
        if (ht('Persisting Flames')) modifiers.push({ id: 'Trait:Persisting Flames', name: 'Persisting Flames' });
        if (ht("Pyromancer's Training")) modifiers.push({ id: "Trait:Pyromancer's Training", name: "Pyromancer's Training" });
        if (ht('Fiery Might')) modifiers.push({ id: 'Trait:Fiery Might', name: 'Fiery Might' });
        if (ht('Stormsoul')) modifiers.push({ id: 'Trait:Stormsoul', name: 'Stormsoul' });
        // Show Bolt when it actually fires: either target dies (baselineStop path)
        // or target doesn't die but rotation crosses the 50% HP threshold (boltFires path).
        if (ht('Bolt to the Heart') && (baselineStop !== null || boltFires))
            modifiers.push({ id: 'Trait:Bolt to the Heart', name: 'Bolt to the Heart' });
        if (ht('Transcendent Tempest')) modifiers.push({ id: 'Trait:Transcendent Tempest', name: 'Transcendent Tempest' });
        if (ht('Elements of Rage')) modifiers.push({ id: 'Trait:Elements of Rage', name: 'Elements of Rage (proc)' });
        if (ht('Swift Revenge')) modifiers.push({ id: 'Trait:Swift Revenge', name: 'Swift Revenge' });
        if (ht('Empowering Auras')) modifiers.push({ id: 'Trait:Empowering Auras', name: 'Empowering Auras' });
        if (ht("Familiar's Prowess")) modifiers.push({ id: "Trait:Familiar's Prowess", name: "Familiar's Prowess" });
        if (ht('Lightning Rod')) modifiers.push({ id: 'Trait:Lightning Rod', name: 'Lightning Rod' });
        if (ht('Piercing Shards')) modifiers.push({ id: 'Trait:Piercing Shards', name: 'Piercing Shards' });
        if (ht('Flow like Water')) modifiers.push({ id: 'Trait:Flow like Water', name: 'Flow like Water' });
        if (ht('Arcane Precision')) modifiers.push({ id: 'Trait:Arcane Precision', name: 'Arcane Precision' });
        if (ht('Arcane Prowess')) modifiers.push({ id: 'Trait:Arcane Prowess', name: 'Arcane Prowess' });
        if (ht('Elemental Attunement')) modifiers.push({ id: 'Trait:Elemental Attunement', name: 'Elemental Attunement' });
        if (ht('Elemental Lockdown')) modifiers.push({ id: 'Trait:Elemental Lockdown', name: 'Elemental Lockdown' });
        if (ht('Arcane Lightning')) modifiers.push({ id: 'Trait:Arcane Lightning', name: 'Arcane Lightning' });
        if (ht('Bountiful Power')) modifiers.push({ id: 'Trait:Bountiful Power', name: 'Bountiful Power' });
        if (fullResults.allCondStacks.some(s => s.cond === 'Weave Self'))
            modifiers.push({ id: 'Trait:Weave Self Bonuses', name: 'Weave Self (Fire+Air)' });

        // When a kill occurred, run an extra infinite-HP pass to get a clean baseline for
        // all modifiers that don't need finite HP.  Using the finite-HP baseline for every
        // modifier inflates contributions because removing a buff also shrinks Bolt to the
        // Heart's window (or any other HP-gated mechanic), double-counting the interaction.
        // Bolt to the Heart itself is the exception — it must use the finite-HP window so
        // it actually fires and produces a non-zero contribution.
        let fullDpsForContrib = fullDps;
        if (baselineStop !== null) {
            this.run(
                startAtt,
                startAtt2,
                evokerElement,
                permaBoons,
                null,
                0,
                null,
                startPistolBullets,
                startEvokerCharges,
                startEvokerEmpowered,
            );
            fullDpsForContrib = this.results.dps;
            fullResultsForContrib = this.results;
        }

        const contributions = [];
        for (const mod of modifiers) {
            const isBolt = mod.id === 'Trait:Bolt to the Heart';
            if (baselineStop !== null && isBolt) {
                // Bolt to the Heart: must use finite-HP so it actually fires.
                // Stop at baseline kill time so the window is fixed.
                this.run(
                    startAtt,
                    startAtt2,
                    evokerElement,
                    permaBoons,
                    mod.id,
                    targetHP,
                    baselineStop,
                    startPistolBullets,
                    startEvokerCharges,
                    startEvokerEmpowered,
                );
                const withoutDps = this.results.totalDamage / baselineWindowSec;
                const increase = fullDps - withoutDps;
                contributions.push({
                    id: mod.id,
                    name: mod.name,
                    dpsIncrease: increase,
                    pctIncrease: withoutDps > 0 ? (increase / withoutDps) * 100 : 0,
                });
            } else if (isBolt && boltFires) {
                // Bolt fires but target didn't die. The infinite-HP re-run above already
                // computed fullDps without Bolt active (tgtHP = Infinity → boltMul = 1).
                // No extra sim needed — the difference is the pure Bolt contribution.
                const withoutDps = fullDps;
                const increase = fullResults.dps - withoutDps;
                contributions.push({
                    id: mod.id,
                    name: mod.name,
                    dpsIncrease: increase,
                    pctIncrease: withoutDps > 0 ? (increase / withoutDps) * 100 : 0,
                });
            } else {
                // All other mods (and infinite-HP mode): compare using infinite-HP runs so
                // each modifier's contribution is isolated and cannot interact with Bolt.
                this.run(
                    startAtt,
                    startAtt2,
                    evokerElement,
                    permaBoons,
                    mod.id,
                    0,
                    null,
                    startPistolBullets,
                    startEvokerCharges,
                    startEvokerEmpowered,
                );
                const withoutDps = this.results.dps;
                const increase = fullDpsForContrib - withoutDps;
                contributions.push({
                    id: mod.id,
                    name: mod.name,
                    dpsIncrease: increase,
                    pctIncrease: withoutDps > 0 ? (increase / withoutDps) * 100 : 0,
                });
            }
        }

        const contribWindowSec = (fullResultsForContrib?.dpsWindowMs || 0) / 1000;
        if (contribWindowSec > 0) {
            const effectOnlyOverrides = new Map([
                ['Trait:Fresh Air', computeFreshAirEffectContribution(fullResultsForContrib)],
                ['Trait:Transcendent Tempest', computeTranscendentTempestEffectContribution(fullResultsForContrib)],
            ]);
            for (const contribution of contributions) {
                if (!effectOnlyOverrides.has(contribution.id)) continue;
                const increase = effectOnlyOverrides.get(contribution.id) / contribWindowSec;
                const withoutDps = fullDpsForContrib - increase;
                contribution.dpsIncrease = increase;
                contribution.pctIncrease = withoutDps > 0 ? (increase / withoutDps) * 100 : 0;
            }
        }

        contributions.sort((a, b) => b.dpsIncrease - a.dpsIncrease);

        this.results = fullResults;
        this.results.contributions = contributions;
        return this.results;
    }

    _trackField(S, sk, castEnd) {
        return trackField(this, S, sk, castEnd, {
            fireFieldSkills: FIRE_FIELD_SKILLS,
            log: entry => S.log.push(entry),
        });
    }

    _refreshEffect(S, effectName, durSec, time) {
        return refreshEffect({
            S,
            trackEffect: (effect, stacks, duration, at) => trackEffect(this, S, effect, stacks, duration, at, {
                boons: BOONS,
                relicProcs: RELIC_PROCS,
            }),
        }, effectName, durSec, time);
    }

    _trackAura(S, sk, castEnd) {
        return trackAura(this, S, sk, castEnd, {
            log: entry => S.log.push(entry),
            pushCondStack: entry => pushTimedStack(S, entry),
        });
    }

    _pyroRechargeMs(S, sk, baseMs) {
        return getAdjustedWeaponRechargeMs(this, sk, baseMs);
    }

    // Arcane Lightning: 150 Ferocity buff (15s, refreshes on each Arcane cast)
    _refreshArcaneLightningBuff(S, time) {
        return refreshArcaneLightningBuff(this, S, time);
    }

    _applyCondition(S, cond, stacks, durSec, time, skillName, castStart = null, extraCondDurPct = 0) {
        return applyCondition(this, S, cond, stacks, durSec, time, skillName, castStart, extraCondDurPct, {
            relicProcs: RELIC_PROCS,
            boons: BOONS,
            damagingConditions: DAMAGING_CONDITIONS,
        });
    }

    _trackEffect(S, effect, stacks, durSec, time) {
        return trackEffect(this, S, effect, stacks, durSec, time, {
            boons: BOONS,
            relicProcs: RELIC_PROCS,
            log: entry => S.log.push(entry),
            pushCondStack: entry => pushTimedStack(S, entry),
        });
    }

    _computeSigilMuls(excludeSigil = null) {
        return computeSigilMultipliers(this, excludeSigil);
    }

    static exportLogCSV(log) {
        const CSV_COLS = [
            'Time', 'Type', 'Skill/Condition',
            'Hit#', 'Coeff', 'StrikeDmg',
            'Stacks', 'PerStack', 'CondTotal',
            'BaseDurMs', 'AdjDurMs', 'DurBonus%', 'WeaversProwess', 'ActiveTotal',
            'Power', 'WeaponStr', 'CondDmg', 'InfernoPower',
            'CritCh%', 'CritDmg%', 'CritMul',
            'Might', 'Fury', 'VulnStacks', 'VulnMul',
            'StrikeMul', 'BaseStrike', 'AddStrike',
            'PyroMul', 'StormMul', 'BoltMul', 'SerratedMul', 'FieryMightMul',
            'PiercingMul', 'FlowLikeWaterMul', 'ZapMul', 'RelicStrikeMul',
            'CondMul', 'SigilCondAdd', 'SigilCondMul', 'BaseTick',
            'TempAria', 'TranscTemp', 'ElemRage', 'EmpAuras', 'FamProwess',
            'EmpFlame', 'PowOvr', 'PolyPow', 'PolyFer',
            'Att', 'Att2', 'Extra',
        ];

        const esc = v => {
            if (v === null || v === undefined || v === '') return '';
            const s = String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const r = v => v !== undefined && v !== null ? (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v) : '';

        const rows = [CSV_COLS.join(',')];
        for (const ev of log) {
            const d = ev.diag || {};
            const time = (ev.t / 1000).toFixed(3);
            let row;
            switch (ev.type) {
                case 'hit':
                    row = [
                        time, 'HIT', esc(ev.skill),
                        `${ev.hit}.${ev.sub}`, r(ev.coeff), r(ev.strike),
                        '', '', '',
                        '', '', '', '', '',
                        r(d.power), r(d.ws), r(d.condDmg), '',
                        r(d.critCh), r(d.critDmg), r(d.critMul),
                        r(d.might), r(d.fury), r(d.vulnStacks), r(d.vulnMul),
                        r(d.strikeMul), r(d.baseStrike), r(d.addStrike),
                        r(d.pyroMul), r(d.stormMul), r(d.boltMul), r(d.serratedMul), r(d.fieryMightMul),
                        r(d.piercingShardsMul), r(d.flowLikeWaterMul), r(d.zapMul), r(d.relicStrikeMul),
                        r(d.condMul), '', '', '',
                        '', '', '', '', '',
                        r(d.empFlame), r(d.powOvr), r(d.polyPow), r(d.polyFer),
                        r(d.att), r(d.att2), ev.flatStrike ? 'flat-strike' : (ev.isField ? 'field' : ''),
                    ];
                    break;
                case 'cond_tick':
                    row = [
                        time, 'TICK', esc(ev.cond),
                        '', '', '',
                        r(ev.stacks), r(ev.perStack), r(ev.total),
                        '', '', '', '', '',
                        '', '', r(d.condDmg), r(d.infernoPower),
                        '', '', '',
                        r(d.might), '', r(d.vulnStacks), r(d.vulnMul),
                        '', '', '',
                        '', '', '', '', '',
                        '', '', '', '',
                        r(d.condMul), r(d.sigilCondAdd), r(d.sigilCondMul), r(d.baseTick),
                        r(d.tempAria), r(d.transcTemp), r(d.elemRage), r(d.empAuras), r(d.famProwess),
                        '', '', '', '',
                        '', '', '',
                    ];
                    break;
                case 'cond_apply':
                    row = [
                        time, 'APPLY', esc(ev.cond),
                        '', '', '',
                        r(ev.stacks), '', '',
                        r(d.baseDurMs), r(ev.durMs), r(d.bonusPct), r(d.weaversProwess), r(ev.total),
                        '', '', '', '',
                        '', '', '',
                        '', '', '', '',
                        '', '', '',
                        '', '', '', '', '',
                        '', '', '', '',
                        '', '', '', '',
                        '', '', '', '', '',
                        '', '', '', '',
                        '', '', esc(ev.skill),
                    ];
                    break;
                case 'cast':
                    row = [time, 'CAST', esc(ev.skill), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', r(ev.att), '', `${ev.dur}ms`];
                    break;
                case 'swap':
                    row = [time, 'SWAP', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', `${ev.from}→${ev.to}`];
                    break;
                default:
                    continue;
            }
            rows.push(row.join(','));
        }
        return rows.join('\n');
    }
}
