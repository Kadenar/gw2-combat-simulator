import { loadAllData } from '../data/csv-loader.js';
import {
    PREFIXES, PREFIX_GROUPS, GEAR_SLOTS, RUNE_NAMES, RUNE_GROUPS, FOOD_NAMES, FOOD_DATA, FOOD_GROUPS,
    UTILITY_NAMES, UTILITY_DATA, UTILITY_CONVERSION_RATES, INFUSION_STATS,
    WEAPON_DATA, SIGIL_DATA, SIGIL_NAMES, SIGIL_GROUPS, RELIC_DATA, RELIC_NAMES,
    getActiveGearSlots,
} from '../data/gear-data.js';
import { TRAITS, SPECIALIZATIONS } from '../data/traits-data.js';
import { GW2API, PLACEHOLDER_ICON } from './gw2-api.js';
import { calculateSkillDamage } from '../../../platform/gw2/damage.js';
import { SMALL_HITBOX_CAPS } from '../simulation.js';
import {
    createDefaultPermaBoons,
    createEmptySelectedSkills,
} from './app-state.js';
import {
    calcBuildAttributes,
    createSimulationEngine,
} from '../sim/run/sim-runner.js';
import {
    downloadJson,
    fetchJsonAsset,
    getRotationItems,
    loadPresetBundle,
    readJsonFile,
} from '../../../app/app-io.js';
import { chartValueAt } from '../../../platform/ui/charts.js';
import { ammoDisplayView } from '../../../platform/ui/ammo-display.js';
import {
    resultSummaryMetrics,
} from '../../../platform/ui/result-transform.js';
import {
    nextResultSortState,
    sortResultRows,
} from '../../../platform/ui/rotation-results.js';
import {
    DERIVED_ATTRIBUTES,
    groupedOptions,
    option,
    PERMANENT_TARGET_CONDITIONS,
    PRIMARY_ATTRIBUTES,
    SPECIFIC_CONDITION_DURATION_ATTRIBUTES,
    STACKING_TARGET_CONDITIONS,
} from '../../../app/app-ui.js';
import {
    convertEIRotation,
    extractLogId,
    fetchEIJson,
    findElementalistPlayers,
} from './app-dpsreport.js';
import {
    addToRotation,
    applyLoadedBuildState,
    applySnapshot,
    appendToRotation,
    autoRun,
    buildSnapshot,
    clearRotation,
    deserializeRotation,
    onBuildChange,
    persistBuild,
    refreshAfterBuildStateChange,
    insertIntoRotation,
    moveRotationItem,
    removeFromRotation,
    restoreBuild,
    serializeRotation,
    truncateRotationAfter,
    updateSpecialOptionVisibility,
} from './app-runtime.js';
import {
    applyOptimizerResult,
    bindOptimizerEvents,
    enforcePrefixMax,
    exportOptimizerResults,
    getActiveSlots,
    getChecked as getOptimizerChecked,
    infusionComboCount,
    initOptimizer,
    populateOptimizerCheckboxes,
    populateSlotConstraints,
    readSlotConstraints,
    renderOptimizerResults,
    runOptimizer,
    updateOptimizerVisibility,
} from './app-optimizer.js';
import {
    renderRotationBuilder as renderRotationBuilderUI,
    renderPalette,
    renderStartAttSelector,
    renderTimeline,
} from './app-rotation-ui.js';
import { createElementalistBuildDefaults } from '../build.js';
import { escapeHtml as esc } from '../../../platform/ui/html.js';

// ─── Consumable description helpers ──────────────────────────────────────────
const STAT_ABBR = {
    'Power': 'Pwr', 'Precision': 'Prec', 'Toughness': 'Tough',
    'Vitality': 'Vit', 'Ferocity': 'Ferc', 'Condition Damage': 'CndDmg',
    'Expertise': 'Exprt', 'Concentration': 'Conc', 'Healing Power': 'Heal',
};
const DUR_ABBR = {
    'Burning Duration': 'Burn', 'Bleeding Duration': 'Bleed',
    'Poison Duration': 'Poison', 'Torment Duration': 'Torment',
    'Confusion Duration': 'Confuse',
};
function _foodDesc(name) {
    const d = FOOD_DATA[name];
    if (!d) return '';
    return [
        ...Object.entries(d.stats).map(([k, v]) => `+${v} ${STAT_ABBR[k] || k}`),
        ...Object.entries(d.durations).map(([k, v]) => `+${v}% ${DUR_ABBR[k] || k}`),
    ].join(', ');
}
function _foodOptionLabel(name) {
    const d = FOOD_DATA[name];
    if (!d) return name;
    const parts = [];
    if (Object.keys(d.stats).length >= 6) {
        parts.push('all stats');
    } else {
        for (const [k, v] of Object.entries(d.stats)) parts.push(`${STAT_ABBR[k] || k}+${v}`);
        for (const [k, v] of Object.entries(d.durations)) parts.push(`${DUR_ABBR[k] || k}+${v}%`);
    }
    if (d.proc) parts.push('lifesteal');
    return parts.length ? `${name}  (${parts.join(', ')})` : name;
}
function _utilityDesc(name) {
    const convs = UTILITY_DATA[name];
    if (!convs) return '';
    return convs.map(c => {
        const rate = UTILITY_CONVERSION_RATES[c.from] || 0;
        return `${rate}% ${STAT_ABBR[c.from] || c.from}→${STAT_ABBR[c.to] || c.to}`;
    }).join(', ');
}

// ─── Default build (Weaver Sword/Dagger DPS) ─────────────────────────────────
const ATTUNEMENTS = ['Fire', 'Water', 'Air', 'Earth'];
const AURA_TRANSMUTE_SKILLS_UI = Object.freeze({
    'Transmute Frost': 'Frost Aura',
    'Transmute Lightning': 'Shocking Aura',
    'Transmute Earth': 'Magnetic Aura',
    'Transmute Fire': 'Fire Aura',
});
const ATTUNEMENT_COLORS = {
    Fire: '#e05530', Water: '#4488cc', Air: '#c06ad0', Earth: '#aa7744',
};
const TH_WEAPONS = new Set(
    Object.entries(WEAPON_DATA).filter(([, d]) => d.wielding === '2h').map(([k]) => k)
);
const CONJURE_MAP = {
    'Conjure Frost Bow': 'Frost Bow',
    'Conjure Lightning Hammer': 'Lightning Hammer',
    'Conjure Fiery Greatsword': 'Fiery Greatsword',
};
const CONJURE_WEAPONS = new Set(['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword']);
const DROP_BUNDLE_ICON = 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png';
const DODGE_ICON = 'https://wiki.guildwars2.com/images/b/b2/Dodge.png';
const COMBAT_START_ICON = 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png';
const WAIT_ICON = 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png';
const CATALYST_ENERGY_MAX = 30;
const SLOT_LABELS = ['heal', 'util1', 'util2', 'util3', 'elite'];
const SLOT_TYPES = { heal: 'Healing', util1: 'Utility', util2: 'Utility', util3: 'Utility', elite: 'Elite' };

const SKILL_TYPE_SPEC = {
    Shout: 'Tempest', Stance: 'Weaver', Augment: 'Catalyst',
    Meditation: 'Evoker', Familiar: 'Evoker', 'Jade Sphere': 'Catalyst',
};

// Spear Etching chains (mirrors ETCHING_CHAINS in simulation.js)
const ETCHING_CHAINS_UI = {
    'Volcano': { etching: 'Etching: Volcano', lesser: 'Lesser Volcano', full: 'Volcano' },
    'Jökulhlaup': { etching: 'Etching: Jökulhlaup', lesser: 'Lesser Jökulhlaup', full: 'Jökulhlaup' },
    'Derecho': { etching: 'Etching: Derecho', lesser: 'Lesser Derecho', full: 'Derecho' },
    'Haboob': { etching: 'Etching: Haboob', lesser: 'Lesser Haboob', full: 'Haboob' },
};
const ETCHING_LOOKUP_UI = new Map();
for (const chain of Object.values(ETCHING_CHAINS_UI)) {
    ETCHING_LOOKUP_UI.set(chain.etching, chain);
    ETCHING_LOOKUP_UI.set(chain.lesser, chain);
    ETCHING_LOOKUP_UI.set(chain.full, chain);
}

// Pistol bullet system
const PISTOL_BULLET_ICONS = {
    Fire: 'https://wiki.guildwars2.com/images/2/2e/Scorching_Shot.png',
    Water: 'https://wiki.guildwars2.com/images/8/8c/Soothing_Splash.png',
    Air: 'https://wiki.guildwars2.com/images/8/82/Electric_Exposure.png',
    Earth: 'https://wiki.guildwars2.com/images/f/f1/Piercing_Pebble.png',
};
const PISTOL_BULLET_LABELS = { Fire: 'Fire Bullet', Water: 'Ice Bullet', Air: 'Air Bullet', Earth: 'Earth Bullet' };

// Hammer orb system (mirrors simulation.js constants)
const HAMMER_ORB_SKILLS_UI = new Set(['Flame Wheel', 'Icy Coil', 'Crescent Wind', 'Rocky Loop']);
const HAMMER_DUAL_ORB_SKILLS_UI = {
    'Dual Orbits: Fire and Water': ['Fire', 'Water'],
    'Dual Orbits: Fire and Air': ['Fire', 'Air'],
    'Dual Orbits: Fire and Earth': ['Fire', 'Earth'],
    'Dual Orbits: Water and Air': ['Water', 'Air'],
    'Dual Orbits: Water and Earth': ['Water', 'Earth'],
    'Dual Orbits: Air and Earth': ['Air', 'Earth'],
};
const HAMMER_ALL_ORB_NAMES_UI = new Set([...HAMMER_ORB_SKILLS_UI, ...Object.keys(HAMMER_DUAL_ORB_SKILLS_UI)]);
const HAMMER_ORB_DURATION_MS_UI = 15000;
const HAMMER_ORB_ICD_MS_UI = 480;
const EVASIVE_ARCANA_SKILL_BY_ATTUNEMENT_UI = Object.freeze({
    Fire: 'Flame Burst (trait)',
    Water: 'Cleansing Wave (trait)',
    Air: 'Blinding Flash (trait)',
    Earth: 'Shock Wave (trait)',
});
const EVOKER_FAMILIAR_INTERRUPT_WINDOWS_UI = Object.freeze({
    Ignite: 2500,
    Splash: 2500,
    Zap: 2400,
    Calcify: 2300,
});

const INTENSITY_EFFECTS = new Set([
    'Burning', 'Bleeding', 'Poisoned', 'Poison', 'Torment', 'Confusion',
    'Might', 'Stability', 'Vulnerability',
    'Elemental Empowerment', 'Empowering Auras', 'Persisting Flames',
    'Thorns',
]);

const EFFECT_COLORS = {
    Burning: '#e05530', Bleeding: '#cc4444', Poisoned: '#55aa33', Poison: '#55aa33',
    Torment: '#c06ad0', Confusion: '#d0a040',
    Vulnerability: '#886644', Blindness: '#ccaa88', Chilled: '#66aadd',
    Cripple: '#8a7a5a', Weakness: '#997766', Fear: '#884488',
    Immobilize: '#998844', Slow: '#6688aa', Taunt: '#cc6644',
    Might: '#dd4444', Stability: '#aa8833', Fury: '#ff8833',
    Aegis: '#dddd44', Alacrity: '#bb66cc', Protection: '#44aadd',
    Regeneration: '#44bb44', Resistance: '#cc9944', Resolution: '#88aacc',
    Swiftness: '#ffcc44', Quickness: '#cc44cc', Vigor: '#44ddaa',
    Superspeed: '#dddddd',
    'Fire Aura': '#e05530',
    'Frost Aura': '#4488cc',
    'Shocking Aura': '#c06ad0',
    'Magnetic Aura': '#aa7744',
    'Light Aura': '#dddd44',
    'Elemental Empowerment': '#55ccbb',
    'Empowering Auras': '#cc88dd',
    'Persisting Flames': '#ff6644',
    'Dark Aura': '#884488',
    'Persisting Flames': '#ff8833',
    Thorns: '#6fbb46',
    'Fresh Air': '#66ccff',
    'Tempestuous Aria': '#dd6699',
    'Transcendent Tempest': '#9966ff',
    'Elements of Rage': '#ff4444',
    'Elemental Empowerment': '#44ddaa',
    'Empowering Auras': '#ffaa33',
    "Familiar's Prowess": '#aa55ff',
    'Weave Self': '#c59932',
    'Perfect Weave': '#ffe066',
    'Hammer Orb Fire': '#e05530',
    'Hammer Orb Water': '#4488cc',
    'Hammer Orb Air': '#c06ad0',
    'Hammer Orb Earth': '#aa7744',
    'Fire Bullet': '#e05530',
    'Ice Bullet': '#4488cc',
    'Air Bullet': '#c06ad0',
    'Earth Bullet': '#aa7744',
};

class App {
    constructor() {
        this.data = null;
        this.build = null;
        this.api = new GW2API();
        this.activeAttunement = 'Fire';
        this.secondaryAttunement = 'Fire';
        this.evokerElement = null;
        this.evokerStartCharges = 6;
        this.evokerStartEmpowered = 0;
        this.selectedSkills = createEmptySelectedSkills();
        this.permaBoons = createDefaultPermaBoons();
        this.permaField = '';
        this.openDropdown = null;
        this.sim = null;
        this.dragState = null;
        this.conditions = {
            might: 0, fury: false,
            primaryAtt: 'None', secondaryAtt: 'None',
            elemEmpowerment: 0,
            freshAir: false,
            superiorElements: false,
            weaversProwess: false,
            severance: false,
            ragingStorm: false,
            arcaneLightning: false,
            crescentWind: false,
            conjureFrostBow: false,
            conjureLightningHammer: false,
            conjureFieryGreatsword: false,
        };
        this.epState = this._createDefaultEpState();
    }

    async init() {
        this.setStatus('Loading CSV data...');
        try {
            this.data = await loadAllData();
        } catch (e) {
            this.setStatus('Failed to load CSV files. Make sure to run a local web server.');
            console.error(e);
            return;
        }

        this.setStatus('Fetching icons from GW2 API...');
        await this.api.init();

        this.setStatus('');
        document.getElementById('loading-overlay').style.display = 'none';

        // Initialize build state — restore from localStorage or fall back to default
        this.build = createElementalistBuildDefaults();
        this.hitboxSize = 'large';
        this.glyphBoonedElementals = false;
        this.thornsBossAuraOnly = false;
        this._restoreBuild(); // populates this.build, selectedSkills, etc. from localStorage if available
        this.data.attributes = calcBuildAttributes(this.build, this.selectedSkills);
        this.sim = createSimulationEngine(this.data, this.data.attributes, {
            hitboxSize: this.hitboxSize,
            glyphBoonedElementals: this.glyphBoonedElementals,
            thornsBossAuraOnly: this.thornsBossAuraOnly,
        });

        // Rotation couldn't be restored in _restoreBuild because this.sim didn't
        // exist yet.  Re-apply the saved rotation now that the engine is ready.
        if (this._pendingRotation) {
            this._deserializeRotation(this._pendingRotation);
            this._pendingRotation = null;
            if (this.sim.rotation.length > 0) this._autoRun();
        }

        this._initOptimizer();

        document.getElementById('btn-sim-clear').addEventListener('click', () => this._clearRotation());
        document.getElementById('btn-sim-rerun').addEventListener('click', () => {
            if (this.sim?.rotation.length > 0) this._autoRun();
            this.render();
        });
        document.getElementById('btn-export-rotation').addEventListener('click', () => this._exportRotation());
        document.getElementById('btn-import-rotation').addEventListener('click', () => {
            document.getElementById('rotation-file-input').click();
        });
        document.getElementById('rotation-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { this._importRotation(file); e.target.value = ''; }
        });

        document.getElementById('btn-dpsreport-import').addEventListener('click', () => {
            this._importFromDpsReport();
        });
        document.getElementById('dpsreport-url').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._importFromDpsReport();
        });
        document.getElementById('dpsreport-player-select').addEventListener('change', () => {
            this._runDpsReportConversion();
        });

        document.getElementById('btn-export-build').addEventListener('click', () => this._exportBuild());
        document.getElementById('btn-import-build').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });
        document.getElementById('import-file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { this._importBuild(file); e.target.value = ''; }
        });
        document.getElementById('target-hp').addEventListener('change', () => {
            if (this.sim?.rotation.length > 0) this._autoRun();
        });
        document.getElementById('hitbox-size').addEventListener('change', (e) => {
            this.hitboxSize = e.target.value;
            if (this.sim) this.sim.hitboxSize = this.hitboxSize;
            this._persistBuild();
            this.renderWeaponBar();
            if (this.sim?.rotation.length > 0) this._autoRun();
        });
        document.getElementById('perma-field').addEventListener('change', (e) => {
            this.permaField = e.target.value;
            this._persistBuild();
            if (this.sim?.rotation.length > 0) this._autoRun();
        });
        document.getElementById('glyph-booned-cb').addEventListener('change', (e) => {
            this.glyphBoonedElementals = e.target.checked;
            if (this.sim) this.sim.glyphBoonedElementals = this.glyphBoonedElementals;
            this._persistBuild();
            if (this.sim?.rotation.length > 0) this._autoRun();
        });
        document.getElementById('thorns-boss-aura-cb').addEventListener('change', (e) => {
            this.thornsBossAuraOnly = e.target.checked;
            if (this.sim) this.sim.thornsBossAuraOnly = this.thornsBossAuraOnly;
            if (this._optimizer) this._optimizer.thornsBossAuraOnly = this.thornsBossAuraOnly;
            this._persistBuild();
            if (this.sim?.rotation.length > 0) this._autoRun();
        });

        document.addEventListener('click', (e) => {
            if (this.openDropdown && !e.target.closest('.skill-bar-slot')) {
                this.closeDropdown();
            }
        });

        this.render();
        this._loadPresets();
    }

    // ─── Build change handler ───
    // _onBuildChange() {
    //     this.data.attributes = calcAttributes(
    //         this.build,
    //         Object.values(this.selectedSkills).filter(Boolean),
    //     );
    //     if (this.sim) {
    //         this.sim.attributes = this.data.attributes;
    //         this.sim.activeTraitNames = new Set(
    //             (this.data.attributes.activeTraits || []).map(t => t.name)
    //         );
    //     }
    //     this.renderTraits();
    //     this.renderAttributes();
    //     this.renderConditions();
    //     this.renderAttunementBar();
    //     this.renderWeaponBar();
    //     this.renderSkillBar();
    //     this.renderSkillInfoTable();
    //     if (this.sim?.rotation.length > 0) this._autoRun();
    //     else this._renderPalette();
    //     this._persistBuild();
    // }

    _onBuildChange() {
        onBuildChange(this);
    }

    setStatus(msg) {
        const el = document.getElementById('loading-status');
        if (el) el.textContent = msg;
    }

    render() {
        this.renderGear();
        this.renderWeaponSelect();
        this.renderAttributes();
        this.renderConditions();
        this.renderTraits();
        this.renderAttunementBar();
        this.renderWeaponBar();
        this.renderSkillBar();
        this.renderSkillInfoTable();
        this._renderPermaBoons();
        this.renderRotationBuilder();
        const hitboxEl = document.getElementById('hitbox-size');
        if (hitboxEl) hitboxEl.value = this.hitboxSize || 'large';
        const fieldEl = document.getElementById('perma-field');
        if (fieldEl) fieldEl.value = this.permaField || '';
        const glyphCb = document.getElementById('glyph-booned-cb');
        if (glyphCb) glyphCb.checked = !!this.glyphBoonedElementals;
        const thornsCb = document.getElementById('thorns-boss-aura-cb');
        if (thornsCb) thornsCb.checked = !!this.thornsBossAuraOnly;
        updateSpecialOptionVisibility(this);
    }

    // ─── Gear Panel ───
    renderGear() {
        const container = document.getElementById('gear-slots');
        const is2H = TH_WEAPONS.has(this.build.weapons?.[0] || '');

        container.innerHTML = GEAR_SLOTS.map(slot => {
            const hidden = is2H && slot === 'Weapon2';
            const label = is2H && slot === 'Weapon1' ? 'Weapon (2H)' : slot;
            const cur = this.build.gear[slot] || PREFIXES[0];
            const opts = groupedOptions(PREFIX_GROUPS, cur);
            return `<div class="gear-row"${hidden ? ' style="display:none"' : ''}>
                <span class="gear-label">${label}</span>
                <select class="gear-select" data-slot="${slot}">${opts}</select>
            </div>`;
        }).join('');

        container.querySelectorAll('.gear-select').forEach(sel => {
            sel.addEventListener('change', () => {
                this.build.gear[sel.dataset.slot] = sel.value;
                this._onBuildChange();
            });
        });
    }

    renderWeaponSelect() {
        // Weapon types (mainhand / offhand)
        const weaponContainer = document.getElementById('weapon-select');
        const mhTypes = this._getMHTypes();
        const ohTypes = this._getOHTypes();
        const isMH2H = TH_WEAPONS.has(this.build.weapons[0] || '');

        weaponContainer.innerHTML = `
            <div class="gear-row">
                <span class="gear-label">MH Type</span>
                <select class="gear-select" id="sel-mh">
                    ${mhTypes.map(type => option(type, this.build.weapons[0])).join('')}
                </select>
            </div>
            <div class="gear-row" id="oh-row" style="${isMH2H ? 'opacity:.4;pointer-events:none' : ''}">
                <span class="gear-label">OH Type</span>
                <select class="gear-select" id="sel-oh">
                    ${ohTypes.map(type => option(type, this.build.weapons[1])).join('')}
                </select>
            </div>`;

        weaponContainer.querySelector('#sel-mh').addEventListener('change', e => {
            this.build.weapons[0] = e.target.value;
            const is2H = TH_WEAPONS.has(e.target.value);
            if (is2H) this.build.weapons[1] = '';
            document.getElementById('oh-row').style.opacity = is2H ? '.4' : '';
            document.getElementById('oh-row').style.pointerEvents = is2H ? 'none' : '';
            this._onBuildChange();
            this.renderAttunementBar();
            this.renderGear();
        });
        weaponContainer.querySelector('#sel-oh').addEventListener('change', e => {
            this.build.weapons[1] = e.target.value;
            this._onBuildChange();
        });

        // Equipment info (rune, sigils, relic, food, utility, JBC, infusions)
        const eq = document.getElementById('equipment-info');
        const b = this.build;
        const sigilNames = SIGIL_NAMES;
        const relicNames = RELIC_NAMES;

        const selRow = (label, id, options, selected, cls = '', groups = null) => {
            const optionsHtml = groups
                ? groupedOptions(groups, selected)
                : options.map(value => option(value, selected)).join('');
            return `<div class="gear-row">
                <span class="gear-label">${label}</span>
                <select class="gear-select${cls ? ' ' + cls : ''}" id="${id}">
                    ${optionsHtml}
                </select>
            </div>`;
        };

        const consumableRow = (label, id, options, selected, descFn, cls = '', optLabelFn = null, groups = null) => {
            const hint = selected ? esc(descFn(selected)) : '';
            const labelFor = optLabelFn || (value => value);
            const optionsHtml = groups
                ? groupedOptions(groups, selected, labelFor)
                : options.map(value => option(value, selected, labelFor(value))).join('');
            return `<div class="gear-row consumable-row">
                <span class="gear-label">${label}</span>
                <div class="consumable-select-wrap">
                    <select class="gear-select${cls ? ' ' + cls : ''}" id="${id}">
                        ${optionsHtml}
                    </select>
                    <span class="consumable-hint" id="${id}-hint">${hint}</span>
                </div>
            </div>`;
        };

        eq.innerHTML = `
            ${selRow('Rune', 'sel-rune', RUNE_NAMES, b.rune, '', RUNE_GROUPS)}
            ${selRow('Sigil 1', 'sel-sig1', sigilNames, b.sigils[0], '', SIGIL_GROUPS)}
            ${selRow('Sigil 2', 'sel-sig2', sigilNames, b.sigils[1], '', SIGIL_GROUPS)}
            ${selRow('Relic', 'sel-relic', relicNames, b.relic)}
            ${consumableRow('Food', 'sel-food', FOOD_NAMES, b.food, _foodDesc, 'small-select', _foodOptionLabel, FOOD_GROUPS)}
            ${consumableRow('Utility', 'sel-utility', UTILITY_NAMES, b.utility, _utilityDesc)}
            <div class="gear-row">
                <span class="gear-label">Jade Bot</span>
                <input type="checkbox" id="chk-jbc" class="gear-checkbox"${b.jadeBotCore ? ' checked' : ''} />
            </div>
            ${b.infusions.map((inf, i) => `
            <div class="gear-row infusion-row">
                <span class="gear-label">Infusion ${i + 1}</span>
                <div class="infusion-controls">
                    <input type="number" class="inf-count" data-inf="${i}" value="${inf.count}" min="0" max="18" step="1" />
                    <select class="gear-select inf-stat" data-inf="${i}">
                        ${INFUSION_STATS.map(stat => option(stat, inf.stat)).join('')}
                    </select>
                </div>
            </div>`).join('')}
            <div class="gear-row infusion-total-row">
                <span class="gear-label" style="color:var(--text-dim)">Total</span>
                <span id="inf-total" class="inf-total">${b.infusions.reduce((s, x) => s + x.count, 0)}/18</span>
            </div>`;

        // Attach equipment listeners
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };
        bind('sel-rune', e => { b.rune = e.target.value; this._onBuildChange(); });
        bind('sel-sig1', e => { b.sigils[0] = e.target.value; this._onBuildChange(); });
        bind('sel-sig2', e => { b.sigils[1] = e.target.value; this._onBuildChange(); });
        bind('sel-relic', e => { b.relic = e.target.value; this._onBuildChange(); });
        bind('sel-food', e => { b.food = e.target.value; const h = document.getElementById('sel-food-hint'); if (h) h.textContent = _foodDesc(e.target.value); this._onBuildChange(); });
        bind('sel-utility', e => { b.utility = e.target.value; const h = document.getElementById('sel-utility-hint'); if (h) h.textContent = _utilityDesc(e.target.value); this._onBuildChange(); });
        bind('chk-jbc', e => { b.jadeBotCore = e.target.checked; this._onBuildChange(); });

        // Infusion listeners (3 slots, total capped at 18)
        eq.querySelectorAll('.inf-count').forEach(input => {
            input.addEventListener('change', () => {
                const idx = parseInt(input.dataset.inf);
                const raw = Math.max(0, parseInt(input.value) || 0);
                const otherTotal = b.infusions.reduce((s, inf, j) => j !== idx ? s + inf.count : s, 0);
                b.infusions[idx].count = Math.min(raw, 18 - otherTotal);
                input.value = b.infusions[idx].count;
                document.getElementById('inf-total').textContent = `${b.infusions.reduce((s, x) => s + x.count, 0)}/18`;
                const totalEl = document.getElementById('inf-total');
                const total = b.infusions.reduce((s, x) => s + x.count, 0);
                totalEl.textContent = `${total}/18`;
                totalEl.classList.toggle('over', total > 18);
                this._onBuildChange();
            });
        });
        eq.querySelectorAll('.inf-stat').forEach(sel => {
            sel.addEventListener('change', () => {
                const idx = parseInt(sel.dataset.inf);
                b.infusions[idx].stat = sel.value;
                this._onBuildChange();
            });
        });
    }

    _getMHTypes() {
        return Object.entries(WEAPON_DATA)
            .filter(([, d]) => d.wielding === 'mh' || d.wielding === 'mh+oh' || d.wielding === '2h')
            .map(([k]) => k);
    }

    _getOHTypes() {
        return Object.entries(WEAPON_DATA)
            .filter(([, d]) => d.wielding === 'oh' || d.wielding === 'mh+oh')
            .map(([k]) => k);
    }

    // ─── Attributes ───
    renderAttributes() {
        const container = document.getElementById('attributes-list');
        const baseAttrs = this.data.attributes.attributes;
        const condAttrs = this._getConditionalAttrs();
        const pctSet = new Set(['Critical Chance', 'Critical Damage', 'Condition Duration', 'Boon Duration',
            'Burning Duration', 'Bleeding Duration', 'Torment Duration', 'Confusion Duration', 'Poison Duration',
            'Quickness Duration', 'Might Duration', 'Fury Duration']);
        const fmt = (n, v) => pctSet.has(n) ? v.toFixed(2) + '%' : Math.round(v).toString();

        // Specific condition durations are additive with the general Condition Duration.
        // Show the effective combined value so displayed numbers match what the sim uses.
        const condDurBase = baseAttrs['Condition Duration']?.final ?? 0;
        const condDurCond = condAttrs?.['Condition Duration']?.final ?? condDurBase;

        const row = (n) => {
            let base = baseAttrs[n]?.final ?? 0;
            let cond = condAttrs?.[n]?.final ?? base;
            if (SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(n)) {
                base += condDurBase;
                cond += condDurCond;
            }
            const delta = cond - base;
            const hasDelta = Math.abs(delta) > 0.005;
            const sign = delta > 0 ? '+' : '';
            return `<div class="attr-row">
                <span class="attr-name">${n}</span>
                <span class="attr-val">
                    ${hasDelta
                    ? `<span class="av-base">${fmt(n, base)}</span><span class="av-arrow">→</span><span class="av-cond">${fmt(n, cond)}</span><span class="av-delta">(${sign}${pctSet.has(n) ? delta.toFixed(2) + '%' : Math.round(delta)})</span>`
                    : fmt(n, base)}
                </span>
            </div>`;
        };

        const section = (title, keys) => {
            let h = `<div class="attr-section"><h4>${title}</h4>`;
            for (const n of keys) h += row(n);
            return h + '</div>';
        };
        container.innerHTML =
            section('Primary', PRIMARY_ATTRIBUTES)
            + section('Derived', DERIVED_ATTRIBUTES);
        this.renderEffectivePower();
    }

    // ─── Conditions panel ───
    renderConditions() {
        const container = document.getElementById('conditions-panel');
        if (!container) return;
        const c = this.conditions;
        const activeTraits = this.data.attributes?.activeTraits || [];
        const specs = this.data.attributes?.specializations || [];
        const hasTrait = name => activeTraits.some(t => t.name === name);
        const selectedSkillNames = new Set(Object.values(this.selectedSkills || {}).filter(Boolean).map(s => s.name));
        const hasSeveranceSigil = (this.build?.sigils || []).includes('Severance');
        const hasArcaneLightning = hasTrait('Arcane Lightning');
        const hasHammer = (this.data.attributes?.weapons || []).includes('Hammer');
        const hasConjureFrostBow = selectedSkillNames.has('Conjure Frost Bow');
        const hasConjureLightningHammer = selectedSkillNames.has('Conjure Lightning Hammer');
        const hasConjureFieryGreatsword = selectedSkillNames.has('Conjure Fiery Greatsword');

        const hasPolyphony = hasTrait('Elemental Polyphony');
        const hasEmpoweringFlame = hasTrait('Empowering Flame');
        const hasAeroTraining = hasTrait("Aeromancer's Training");
        const hasPowerOverwhelming = hasTrait('Power Overwhelming');
        const hasRagingStorm = hasTrait('Raging Storm');
        const hasFreshAirTrait = hasTrait('Fresh Air');
        const hasBurningPrecision = hasTrait('Burning Precision');
        const hasSuperiorElements = hasTrait('Superior Elements');
        const hasEnhancedPotency = hasTrait('Enhanced Potency');
        const hasEmpEmpowerment = hasTrait('Empowered Empowerment');

        const hasCatalyst = specs.some(s => s.name === 'Catalyst');
        const isWeaver = specs.some(s => s.name === 'Weaver');

        // Show attunement section if any attunement-based effect is relevant
        const showAttunement = hasPolyphony || hasEmpoweringFlame || hasAeroTraining;

        const ATTS = ['None', 'Fire', 'Water', 'Air', 'Earth'];
        const attSel = (id, cur) =>
            `<select class="cond-select" id="${id}">${ATTS.map(a =>
                `<option${a === cur ? ' selected' : ''}>${a}</option>`).join('')}</select>`;

        // Dynamic hint showing what an attunement triggers (Polyphony + primary-only auto effects)
        const POLY_STAT = { Fire: 'Pwr', Water: 'Heal', Air: 'Ferocity', Earth: 'CndDmg' };
        const attEffects = (att, isPrimary) => {
            if (!att || att === 'None') return '';
            const parts = [];
            if (hasPolyphony && POLY_STAT[att]) parts.push(`+200 ${POLY_STAT[att]}`);
            if (isPrimary && hasEmpoweringFlame && att === 'Fire') parts.push('+150 Pwr');
            if (isPrimary && hasAeroTraining && att === 'Air') parts.push('+150 Ferocity');
            return parts.length ? parts.join(', ') : att;
        };

        const furyLabel = hasEnhancedPotency ? '+40% Crit Chance (Enhanced Potency)' : '+25% Crit Chance';
        const mightLabel = hasEnhancedPotency ? '+30 Pwr / +30–35 CondDmg (Enhanced Potency)' : '+30 Pwr/CondDmg';

        // EE multiplier description
        const eeDesc = hasEmpEmpowerment
            ? 'stacks × +1.5% (max 10 → +20%)'
            : 'stacks × +1%';

        container.innerHTML = `
            <div class="cond-header">Conditional Effects <span class="cond-hint">(for hero panel validation)</span></div>

            <div class="cond-section">Boons</div>
            <div class="cond-grid">
                <label class="cond-label">Might</label>
                <div class="cond-ctrl">
                    <input type="number" id="cond-might" class="cond-num" value="${c.might}" min="0" max="25" step="1" />
                    <span class="cond-unit">stacks × ${mightLabel}</span>
                </div>
                <label class="cond-label">Fury</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-fury"${c.fury ? ' checked' : ''} />
                    <span class="cond-unit">${furyLabel}</span>
                </div>
            </div>

            ${showAttunement ? `
            <div class="cond-section">Attunement</div>
            <div class="cond-grid">
                <label class="cond-label">${isWeaver ? 'Pri. Att.' : 'Attunement'}</label>
                <div class="cond-ctrl">
                    ${attSel('cond-att-pri', c.primaryAtt)}
                    <span class="cond-unit cond-att-hint">${attEffects(c.primaryAtt, true)}</span>
                </div>
                ${isWeaver ? `
                <label class="cond-label">Sec. Att.</label>
                <div class="cond-ctrl">
                    ${attSel('cond-att-sec', c.secondaryAtt)}
                    <span class="cond-unit cond-att-hint">${attEffects(c.secondaryAtt, false)}</span>
                </div>` : ''}
            </div>` : ''}

            ${(hasFreshAirTrait || hasSuperiorElements) ? `
            <div class="cond-section">Trait Conditionals</div>
            <div class="cond-grid">
                ${hasFreshAirTrait ? `
                <label class="cond-label">Fresh Air</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-fresh-air"${c.freshAir ? ' checked' : ''} />
                    <span class="cond-unit">+250 Ferocity (buff active)</span>
                </div>` : ''}
                ${hasSuperiorElements ? `
                <label class="cond-label">Sup. Elements</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-sup-elem"${c.superiorElements ? ' checked' : ''} />
                    <span class="cond-unit">+20% Crit Chance (vs. Weakened)</span>
                </div>` : ''}
            </div>` : ''}

            ${(hasSeveranceSigil || hasRagingStorm || hasArcaneLightning || hasHammer || hasConjureFrostBow || hasConjureLightningHammer || hasConjureFieryGreatsword) ? `
            <div class="cond-section">Other Buffs</div>
            <div class="cond-grid">
                ${hasSeveranceSigil ? `
                <label class="cond-label">Severance</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-severance"${c.severance ? ' checked' : ''} />
                    <span class="cond-unit">+250 Precision, +250 Ferocity</span>
                </div>` : ''}
                ${hasRagingStorm ? `
                <label class="cond-label">Raging Storm</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-raging-storm"${c.ragingStorm ? ' checked' : ''} />
                    <span class="cond-unit">+180 Ferocity (under Fury)</span>
                </div>` : ''}
                ${hasArcaneLightning ? `
                <label class="cond-label">Arcane Lightning</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-arcane-lightning"${c.arcaneLightning ? ' checked' : ''} />
                    <span class="cond-unit">+150 Ferocity</span>
                </div>` : ''}
                ${hasHammer ? `
                <label class="cond-label">Crescent Wind</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-crescent-wind"${c.crescentWind ? ' checked' : ''} />
                    <span class="cond-unit">+15% Crit Chance</span>
                </div>` : ''}
                ${hasConjureFrostBow ? `
                <label class="cond-label">Conjure Frost Bow</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-conjure-frost-bow"${c.conjureFrostBow ? ' checked' : ''} />
                    <span class="cond-unit">+20% Cond. Duration, +180 Healing Power</span>
                </div>` : ''}
                ${hasConjureLightningHammer ? `
                <label class="cond-label">Conjure Lightning Hammer</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-conjure-lightning-hammer"${c.conjureLightningHammer ? ' checked' : ''} />
                    <span class="cond-unit">+75 Ferocity, +180 Precision</span>
                </div>` : ''}
                ${hasConjureFieryGreatsword ? `
                <label class="cond-label">Conjure Fiery Greatsword</label>
                <div class="cond-ctrl">
                    <input type="checkbox" id="cond-conjure-fiery-greatsword"${c.conjureFieryGreatsword ? ' checked' : ''} />
                    <span class="cond-unit">+260 Power, +180 Cond. Damage</span>
                </div>` : ''}
            </div>` : ''}

            ${hasCatalyst ? `
            <div class="cond-section">Elemental Empowerment</div>
            <div class="cond-grid">
                <label class="cond-label">EE Stacks</label>
                <div class="cond-ctrl">
                    <input type="number" id="cond-ee" class="cond-num" value="${c.elemEmpowerment}" min="0" max="10" step="1" />
                    <span class="cond-unit">${eeDesc}</span>
                </div>
                ${hasEmpEmpowerment ? `
                <label class="cond-label"></label>
                <div class="cond-ctrl"><span class="cond-unit cond-trait-note">✓ Empowered Empowerment active</span></div>` : ''}
            </div>` : ''}

            `;

        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); };
        bind('cond-might', e => { c.might = Math.max(0, Math.min(25, parseInt(e.target.value) || 0)); e.target.value = c.might; this.renderAttributes(); });
        bind('cond-fury', e => { c.fury = e.target.checked; this.renderAttributes(); });
        bind('cond-att-pri', e => { c.primaryAtt = e.target.value; this.renderConditions(); this.renderAttributes(); });
        bind('cond-att-sec', e => { c.secondaryAtt = e.target.value; this.renderConditions(); this.renderAttributes(); });
        bind('cond-ee', e => { c.elemEmpowerment = Math.max(0, Math.min(10, parseInt(e.target.value) || 0)); e.target.value = c.elemEmpowerment; this.renderAttributes(); });
        bind('cond-fresh-air', e => { c.freshAir = e.target.checked; this.renderAttributes(); });
        bind('cond-sup-elem', e => { c.superiorElements = e.target.checked; this.renderAttributes(); });
        bind('cond-severance', e => { c.severance = e.target.checked; this.renderAttributes(); });
        bind('cond-raging-storm', e => { c.ragingStorm = e.target.checked; this.renderAttributes(); });
        bind('cond-arcane-lightning', e => { c.arcaneLightning = e.target.checked; this.renderAttributes(); });
        bind('cond-crescent-wind', e => { c.crescentWind = e.target.checked; this.renderAttributes(); });
        bind('cond-conjure-frost-bow', e => { c.conjureFrostBow = e.target.checked; this.renderAttributes(); });
        bind('cond-conjure-lightning-hammer', e => { c.conjureLightningHammer = e.target.checked; this.renderAttributes(); });
        bind('cond-conjure-fiery-greatsword', e => { c.conjureFieryGreatsword = e.target.checked; this.renderAttributes(); });
    }

    // ─── Compute attributes with conditions applied ───
    // Returns null if no conditions are active (→ renderAttributes shows base values only).
    // IMPORTANT: Only effects NOT already in calcAttributes are applied here.
    // The simulation also applies these same effects per-hit — this panel is for hero-panel validation only.
    _getConditionalAttrs() {
        const c = this.conditions;
        const base = this.data.attributes?.attributes;
        if (!base) return null;
        const activeTraits = this.data.attributes?.activeTraits || [];
        const specs = this.data.attributes?.specializations || [];
        const hasTrait = name => activeTraits.some(t => t.name === name);
        const selectedSkillNames = new Set(Object.values(this.selectedSkills || {}).filter(Boolean).map(s => s.name));
        const hasSeveranceSigil = (this.build?.sigils || []).includes('Severance');
        const hasHammer = (this.data.attributes?.weapons || []).includes('Hammer');
        const hasConjureFrostBow = selectedSkillNames.has('Conjure Frost Bow');
        const hasConjureLightningHammer = selectedSkillNames.has('Conjure Lightning Hammer');
        const hasConjureFieryGreatsword = selectedSkillNames.has('Conjure Fiery Greatsword');

        const hasPolyphony = hasTrait('Elemental Polyphony');
        const hasEmpoweringFlame = hasTrait('Empowering Flame');
        const hasAeroTraining = hasTrait("Aeromancer's Training");
        const hasPowerOverwhelming = hasTrait('Power Overwhelming');
        const hasRagingStorm = hasTrait('Raging Storm');
        const hasFreshAirTrait = hasTrait('Fresh Air');
        const hasSuperiorElements = hasTrait('Superior Elements');
        const hasEnhancedPotency = hasTrait('Enhanced Potency');
        const hasEmpEmpowerment = hasTrait('Empowered Empowerment');
        const hasArcaneLightning = hasTrait('Arcane Lightning');
        const isEvoker = specs.some(s => s.name === 'Evoker');

        // Determine if any condition is effectively active
        const hasAny = c.might > 0 || c.fury
            || c.primaryAtt !== 'None' || c.secondaryAtt !== 'None'
            || c.elemEmpowerment > 0
            || c.freshAir || c.superiorElements
            || (hasSeveranceSigil && c.severance)
            || (hasRagingStorm && c.ragingStorm && c.fury)
            || (hasArcaneLightning && c.arcaneLightning)
            || (hasHammer && c.crescentWind)
            || (hasConjureFrostBow && c.conjureFrostBow)
            || (hasConjureLightningHammer && c.conjureLightningHammer)
            || (hasConjureFieryGreatsword && c.conjureFieryGreatsword)
            || (hasPowerOverwhelming && c.might >= 10);
        if (!hasAny) return null;

        const PRIMARY_STATS = ['Power', 'Precision', 'Toughness', 'Vitality', 'Ferocity', 'Condition Damage', 'Expertise', 'Concentration', 'Healing Power'];
        const out = {};
        for (const [k, v] of Object.entries(base)) out[k] = { ...v };

        const addPrimary = (stat, amount) => {
            if (!out[stat]) out[stat] = { final: 0, base: 0, gear: 0, runes: 0, food: 0, utility: 0, jbc: 0, traits: 0, sigils: 0 };
            out[stat].final += amount;
        };

        // ── Might ──
        // Enhanced Potency raises stats-per-Might to +35 when familiar matches:
        // Fire familiar → +35 Power & +35 Cond Dmg per stack; Air familiar → Power stays +30
        if (c.might > 0) {
            const mightPwr = (hasEnhancedPotency && isEvoker && this.evokerElement === 'Fire') ? 35 : 30;
            const mightCond = (hasEnhancedPotency && isEvoker && this.evokerElement === 'Fire') ? 35 : 30;
            addPrimary('Power', c.might * mightPwr);
            addPrimary('Condition Damage', c.might * mightCond);
        }

        // ── Elemental Polyphony (+200 per distinct active attunement) ──
        // Set deduplication: Fire/Fire gives +200 Power once, not twice.
        // Air gives Ferocity (matches simulation: polyFer = 200/15)
        const POLY = { Fire: 'Power', Water: 'Healing Power', Air: 'Ferocity', Earth: 'Condition Damage' };
        if (hasPolyphony) {
            const atts = new Set([c.primaryAtt, c.secondaryAtt].filter(a => a && a !== 'None'));
            for (const att of atts) {
                if (POLY[att]) addPrimary(POLY[att], 200);
            }
        }

        // ── Aeromancer's Training: +150 Ferocity when PRIMARY attunement is Air ──
        // Secondary Air does not trigger this bonus.
        if (hasAeroTraining && c.primaryAtt === 'Air') {
            addPrimary('Ferocity', 150);
        }

        // ── Empowering Flame: +150 Power when PRIMARY attunement is Fire ──
        // Secondary Fire does not trigger this bonus.
        if (hasEmpoweringFlame && c.primaryAtt === 'Fire') {
            addPrimary('Power', 150);
        }

        // ── Power Overwhelming: +300 Power if PRIMARY is Fire, +150 Power otherwise (≥10 Might) ──
        // Secondary Fire does NOT give the extra +150.
        if (hasPowerOverwhelming && c.might >= 10) {
            addPrimary('Power', c.primaryAtt === 'Fire' ? 300 : 150);
        }

        // ── Fresh Air: +250 Ferocity while buff is active ──
        // Per-hit in simulation: freshAirFerocity = 250/15 (crit dmg). Not in calcAttributes.
        if (c.freshAir && hasFreshAirTrait) {
            addPrimary('Ferocity', 250);
        }

        if (c.severance && hasSeveranceSigil) {
            addPrimary('Precision', 250);
            addPrimary('Ferocity', 250);
        }

        if (c.ragingStorm && c.fury && hasRagingStorm) {
            addPrimary('Ferocity', 180);
        }

        if (c.arcaneLightning && hasArcaneLightning) {
            addPrimary('Ferocity', 150);
        }

        if (c.conjureFrostBow && hasConjureFrostBow) {
            addPrimary('Healing Power', 180);
        }

        if (c.conjureLightningHammer && hasConjureLightningHammer) {
            addPrimary('Ferocity', 75);
            addPrimary('Precision', 180);
        }

        if (c.conjureFieryGreatsword && hasConjureFieryGreatsword) {
            addPrimary('Power', 260);
            addPrimary('Condition Damage', 180);
        }

        // ── Elemental Empowerment ──
        // EE pool = base + gear + runes + infusions + food (utility and traits excluded).
        // Empowered Empowerment: stacks × 1.5%, 10-stack cap locks to flat 20%.
        if (c.elemEmpowerment > 0) {
            const stacks = c.elemEmpowerment;
            const empMul = hasEmpEmpowerment
                ? (stacks === 10 ? 0.20 : stacks * 0.015)
                : stacks * 0.01;
            for (const s of PRIMARY_STATS) {
                const attr = base[s] || {};
                const pool = (attr.base || 0) + (attr.gear || 0) + (attr.runes || 0) + (attr.infusions || 0) + (attr.food || 0);
                if (pool > 0) addPrimary(s, Math.round(pool * empMul));
            }
        }

        // ── Recompute derived stats from updated primary finals ──
        const prec = out['Precision']?.final ?? 1000;
        const fer = out['Ferocity']?.final ?? 0;
        const conc = out['Concentration']?.final ?? 0;
        const exp = out['Expertise']?.final ?? 0;

        const traitCC = base['Critical Chance']?.traits ?? 0;
        const sigilCC = base['Critical Chance']?.sigils ?? 0;
        const newPrecCC = (prec - 895) / 21;
        // Fury: +25% base; Enhanced Potency with Air familiar raises it to +40%
        const furyCC = c.fury ? ((hasEnhancedPotency && isEvoker && this.evokerElement === 'Air') ? 40 : 25) : 0;
        // Superior Elements: +20% Crit Chance vs. Weakened enemies
        const supElemCC = (c.superiorElements && hasSuperiorElements) ? 20 : 0;
        const crescentWindCC = (c.crescentWind && hasHammer) ? 15 : 0;
        out['Critical Chance'] = { ...out['Critical Chance'], final: newPrecCC + traitCC + sigilCC + furyCC + supElemCC + crescentWindCC };

        out['Critical Damage'] = { ...out['Critical Damage'], final: 150 + fer / 15 };

        // Boon Duration: non-concentration bonus preserved; concentration component updated
        const boonFixedBonus = (base['Boon Duration']?.final ?? 0) - (base['Concentration']?.final ?? 0) / 15;
        out['Boon Duration'] = { ...out['Boon Duration'], final: conc / 15 + boonFixedBonus };

        // Condition Duration: non-expertise bonus preserved; expertise component updated
        const condFixedBonus = (base['Condition Duration']?.final ?? 0) - (base['Expertise']?.final ?? 0) / 15;
        const frostBowCondBonus = (c.conjureFrostBow && hasConjureFrostBow) ? 20 : 0;
        out['Condition Duration'] = { ...out['Condition Duration'], final: exp / 15 + condFixedBonus + frostBowCondBonus };

        return out;
    }

    // ─── Effective Power Panel ───

    _createDefaultEpState() {
        return {};
    }

    _getEpRowKey(att, att2) {
        return att2 ? `${att}/${att2}` : att;
    }

    _getEpModifiers(att, att2) {
        const activeTraits = this.data?.attributes?.activeTraits || [];
        const specs = this.data?.attributes?.specializations || [];
        const hasTrait = name => activeTraits.some(t => t.name === name);
        const sigils = this.build?.sigils || [];
        const relic = this.build?.relic || '';
        const isWeaver = specs.some(s => s.name === 'Weaver');
        const attSet = att2 ? new Set([att, att2]) : new Set([att]);

        const mods = [];
        const icon = name => this.api.getTraitIcon(name) || null;

        // ── Stat modifiers (affect Power / Precision / Ferocity / CC) ──
        const enhPot = hasTrait('Enhanced Potency');
        const evokerElem = this.evokerElement;
        const furyCCBonus = (enhPot && evokerElem === 'Air') ? 40 : 25;
        mods.push({ id: 'might', label: '25 Might', cat: 'stat', effects: { power: 750 }, default: true });
        mods.push({ id: 'fury', label: `Fury (+${furyCCBonus}% CC)`, cat: 'stat', effects: { cc: furyCCBonus }, default: true });

        if (hasTrait('Empowering Flame')) {
            mods.push({ id: 'empFlame', icon: icon('Empowering Flame'), trait: 'Empowering Flame', tip: '+150 Power', cat: 'stat', effects: { power: 150 }, default: att === 'Fire' });
        }
        if (hasTrait('Power Overwhelming')) {
            const bonus = att === 'Fire' ? 300 : 150;
            mods.push({ id: 'powOvr', icon: icon('Power Overwhelming'), trait: 'Power Overwhelming', tip: `+${bonus} Power`, cat: 'stat', effects: { power: bonus }, default: true });
        }
        if (hasTrait('Elemental Polyphony')) {
            const eff = {};
            if (attSet.has('Fire')) eff.power = (eff.power || 0) + 200;
            if (attSet.has('Air')) eff.ferocity = (eff.ferocity || 0) + 200;
            const parts = [];
            if (eff.power) parts.push(`+${eff.power} Pwr`);
            if (eff.ferocity) parts.push(`+${eff.ferocity} Fer`);
            if (parts.length) {
                mods.push({ id: 'polyphony', icon: icon('Elemental Polyphony'), trait: 'Elemental Polyphony', tip: parts.join(', '), cat: 'stat', effects: eff, default: true });
            }
        }
        if (hasTrait("Aeromancer's Training")) {
            mods.push({ id: 'aeroTrain', icon: icon("Aeromancer's Training"), trait: "Aeromancer's Training", tip: '+150 Ferocity', cat: 'stat', effects: { ferocity: 150 }, default: att === 'Air' });
        }
        if (hasTrait('Fresh Air')) {
            mods.push({ id: 'freshAir', icon: icon('Fresh Air'), trait: 'Fresh Air', tip: '+250 Ferocity', cat: 'stat', effects: { ferocity: 250 }, default: true });
        }
        if (hasTrait('Raging Storm')) {
            mods.push({ id: 'ragingStorm', icon: icon('Raging Storm'), trait: 'Raging Storm', tip: '+180 Ferocity', cat: 'stat', effects: { ferocity: 180 }, default: true });
        }
        if (hasTrait('Arcane Lightning')) {
            mods.push({ id: 'arcLight', icon: icon('Arcane Lightning'), trait: 'Arcane Lightning', tip: '+150 Ferocity', cat: 'stat', effects: { ferocity: 150 }, default: att === 'Air' });
        }
        if (hasTrait('Superior Elements')) {
            mods.push({ id: 'supElem', icon: icon('Superior Elements'), trait: 'Superior Elements', tip: '+20% CC', cat: 'stat', effects: { cc: 20 }, default: true });
        }

        // Elemental Empowerment (Catalyst) — 10 stacks × 1% (or 1.5% with Empowered Empowerment, capped at 20% at 10)
        const isCatalyst = specs.some(s => s.name === 'Catalyst');
        if (isCatalyst) {
            const base = this.data?.attributes?.attributes;
            const hasEmpEmp = hasTrait('Empowered Empowerment');
            const empMul = hasEmpEmp ? 0.20 : 0.10;
            const PRIMARY_STATS = ['Power', 'Precision', 'Ferocity'];
            const eeEffects = {};
            for (const s of PRIMARY_STATS) {
                const attr = base?.[s] || {};
                const pool = (attr.base || 0) + (attr.gear || 0) + (attr.runes || 0) + (attr.infusions || 0) + (attr.food || 0);
                if (pool > 0) eeEffects[s.toLowerCase()] = Math.round(pool * empMul);
            }
            const tipParts = [];
            if (eeEffects.power) tipParts.push(`+${eeEffects.power} Pwr`);
            if (eeEffects.precision) tipParts.push(`+${eeEffects.precision} Prec`);
            if (eeEffects.ferocity) tipParts.push(`+${eeEffects.ferocity} Fer`);
            mods.push({ id: 'ee', icon: icon('Elemental Empowerment'), trait: 'Elemental Empowerment', tip: `10× (${tipParts.join(', ')})`, cat: 'stat', effects: eeEffects, default: true });
        }

        // ── Damage modifiers (additive / multiplicative) ──
        mods.push({ id: 'vuln', label: 'Vuln 25×', cat: 'mul', value: 1.25, default: true });

        for (const name of sigils) {
            const s = SIGIL_DATA[name];
            if (!s) continue;
            if (s.strikeDamageA) mods.push({ id: `sigil-${name}`, label: `${name} (+${s.strikeDamageA}%)`, cat: 'add', value: s.strikeDamageA / 100, default: true });
            if (s.strikeDamageM) mods.push({ id: `sigil-${name}-m`, label: `${name} (×${(1 + s.strikeDamageM / 100).toFixed(2)})`, cat: 'mul', value: 1 + s.strikeDamageM / 100, default: true });
        }

        if (hasTrait('Persisting Flames')) mods.push({ id: 'pf', icon: icon('Persisting Flames'), trait: 'Persisting Flames', tip: '5×2%', cat: 'add', value: 0.10, default: true });
        if (hasTrait('Tempestuous Aria')) mods.push({ id: 'tempAria', icon: icon('Tempestuous Aria'), trait: 'Tempestuous Aria', tip: '+10%', cat: 'add', value: 0.10, default: true });
        if (hasTrait('Transcendent Tempest')) mods.push({ id: 'transcTemp', icon: icon('Transcendent Tempest'), trait: 'Transcendent Tempest', tip: '+25%', cat: 'add', value: 0.25, default: true });
        if (hasTrait('Elements of Rage')) mods.push({ id: 'elemRage', icon: icon('Elements of Rage'), trait: 'Elements of Rage', tip: '+15%', cat: 'add', value: 0.15, default: true });
        if (hasTrait('Empowering Auras')) mods.push({ id: 'empAuras', icon: icon('Empowering Auras'), trait: 'Empowering Auras', tip: '5×1%', cat: 'add', value: 0.05, default: true });
        if (hasTrait('Relentless Fire')) mods.push({ id: 'relFire', icon: icon('Relentless Fire'), trait: 'Relentless Fire', tip: '+10%', cat: 'add', value: 0.10, default: att === 'Fire' });
        if (hasTrait('Bountiful Power')) mods.push({ id: 'bountiful', icon: icon('Bountiful Power'), trait: 'Bountiful Power', tip: '+20%', cat: 'add', value: 0.20, default: false });

        if (isWeaver) mods.push({ id: 'wsAir', icon: icon('Weave Self'), trait: 'Weave Self', tip: 'Air +10%', cat: 'add', value: 0.10, default: false });

        if (hasTrait("Familiar's Prowess")) {
            const pct = hasTrait("Familiar's Focus") ? 10 : 5;
            mods.push({ id: 'famProwess', icon: icon("Familiar's Prowess"), trait: "Familiar's Prowess", tip: `+${pct}%`, cat: 'add', value: pct / 100, default: true });
        }

        if (hasTrait("Pyromancer's Training")) mods.push({ id: 'pyro', icon: icon("Pyromancer's Training"), trait: "Pyromancer's Training", tip: '×1.07', cat: 'mul', value: 1.07, default: true });
        if (hasTrait('Fiery Might')) mods.push({ id: 'fieryMight', icon: icon('Fiery Might'), trait: 'Fiery Might', tip: '×1.05', cat: 'mul', value: 1.05, default: true });
        if (hasTrait('Serrated Stones')) mods.push({ id: 'serrated', icon: icon('Serrated Stones'), trait: 'Serrated Stones', tip: '×1.05', cat: 'mul', value: 1.05, default: true });
        if (hasTrait('Stormsoul')) mods.push({ id: 'stormsoul', icon: icon('Stormsoul'), trait: 'Stormsoul', tip: '×1.07', cat: 'mul', value: 1.07, default: true });
        if (hasTrait('Flow Like Water')) mods.push({ id: 'flowWater', icon: icon('Flow Like Water'), trait: 'Flow Like Water', tip: '×1.10', cat: 'mul', value: 1.10, default: true });
        if (hasTrait('Bolt to the Heart')) mods.push({ id: 'bolt', icon: icon('Bolt to the Heart'), trait: 'Bolt to the Heart', tip: '×1.20', cat: 'mul', value: 1.20, default: false });
        if (hasTrait('Piercing Shards')) {
            const mul = att === 'Water' ? 1.14 : 1.07;
            mods.push({ id: 'piercing', icon: icon('Piercing Shards'), trait: 'Piercing Shards', tip: `×${mul.toFixed(2)}`, cat: 'mul', value: mul, default: true });
        }
        if (hasTrait('Elemental Dynamo') || specs.some(s => s.name === 'Evoker')) {
            mods.push({ id: 'zap', icon: icon('Elemental Dynamo'), trait: 'Zap', tip: '×1.03', cat: 'mul', value: 1.03, default: true });
        }

        const weapons = this.data?.attributes?.weapons || [];
        if (weapons.includes('Hammer')) {
            mods.push({ id: 'hammerFire', label: 'Hammer Fire (+5%)', cat: 'add', value: 0.05, default: true });
            mods.push({ id: 'hammerAir', label: 'Hammer Air (+15% CC)', cat: 'stat', effects: { cc: 15 }, default: true });
        }

        // Signet of Fire passive: +180 Precision (already in base attrs when selected).
        // When unchecked → subtract 180 Precision (signet kept on cooldown).
        const selectedSkillNames = new Set(Object.values(this.selectedSkills || {}).filter(Boolean).map(s => s.name));
        if (selectedSkillNames.has('Signet of Fire')) {
            mods.push({ id: 'signetFire', label: 'Signet of Fire (+180 Prec)', cat: 'stat', effects: { precision: 180 }, default: true, _invertedStat: true });
        }

        const RELIC_STRIKE = { Fireworks: 1.07, Claw: 1.07, Peitha: 1.10, 'Mount Balrior': 1.15, Brawler: 1.10, Weaver: 1.10, Fire: 1.07, Bloodstone: 1.07, Eagle: 1.10 };
        if (RELIC_STRIKE[relic]) mods.push({ id: 'relic', label: `${relic} (×${RELIC_STRIKE[relic].toFixed(2)})`, cat: 'mul', value: RELIC_STRIKE[relic], default: true });
        if (relic === 'Nourys') mods.push({ id: 'relicNourys', label: 'Nourys (+25%)', cat: 'add', value: 0.25, default: true });

        return mods;
    }

    _getEpCondiModifiers() {
        const activeTraits = this.data?.attributes?.activeTraits || [];
        const hasTrait = name => activeTraits.some(t => t.name === name);
        const sigils = this.build?.sigils || [];
        const isWeaver = (this.data?.attributes?.specializations || []).some(s => s.name === 'Weaver');
        const icon = name => this.api.getTraitIcon(name) || null;

        const mods = [];

        mods.push({ id: 'cmight', label: '25 Might (+CondDmg)', cat: 'stat', value: 0, default: true });
        mods.push({ id: 'cvuln', label: 'Vuln 25×', cat: 'mul', value: 1.25, default: true });

        for (const name of sigils) {
            const s = SIGIL_DATA[name];
            if (!s) continue;
            if (s.conditionDamageA) mods.push({ id: `csigil-${name}`, label: `${name} (+${s.conditionDamageA}%)`, cat: 'add', value: s.conditionDamageA / 100, default: true });
            if (s.conditionDamageM) mods.push({ id: `csigil-${name}-m`, label: `${name} (×${(1 + s.conditionDamageM / 100).toFixed(2)})`, cat: 'mul', value: 1 + s.conditionDamageM / 100, default: true });
        }

        if (hasTrait('Tempestuous Aria')) mods.push({ id: 'ctempAria', icon: icon('Tempestuous Aria'), trait: 'Tempestuous Aria', tip: '+5%', cat: 'add', value: 0.05, default: true });
        if (hasTrait('Transcendent Tempest')) mods.push({ id: 'ctranscTemp', icon: icon('Transcendent Tempest'), trait: 'Transcendent Tempest', tip: '+20%', cat: 'add', value: 0.20, default: true });
        if (hasTrait('Elements of Rage')) mods.push({ id: 'celemRage', icon: icon('Elements of Rage'), trait: 'Elements of Rage', tip: '+10%', cat: 'add', value: 0.10, default: true });
        if (hasTrait('Empowering Auras')) mods.push({ id: 'cempAuras', icon: icon('Empowering Auras'), trait: 'Empowering Auras', tip: '5×1%', cat: 'add', value: 0.05, default: true });

        if (hasTrait("Familiar's Prowess")) {
            const pct = hasTrait("Familiar's Focus") ? 10 : 5;
            mods.push({ id: 'cfamProwess', icon: icon("Familiar's Prowess"), trait: "Familiar's Prowess", tip: `+${pct}%`, cat: 'add', value: pct / 100, default: true });
        }

        if (isWeaver) mods.push({ id: 'cwsFire', icon: icon('Weave Self'), trait: 'Weave Self', tip: 'Fire +20%', cat: 'add', value: 0.20, default: false });

        if ((this.data?.attributes?.weapons || []).includes('Hammer')) mods.push({ id: 'chammerFire', label: 'Hammer Fire (+5%)', cat: 'add', value: 0.05, default: true });

        const relic = this.build?.relic || '';
        if (relic === 'Nourys') mods.push({ id: 'crelicNourys', label: 'Nourys (+25%)', cat: 'add', value: 0.25, default: true });

        return mods;
    }

    _computeEp(att, att2, rowKey) {
        const base = this.data?.attributes?.attributes;
        if (!base) return null;

        const traitCC = base['Critical Chance']?.traits ?? 0;
        const sigilCC = base['Critical Chance']?.sigils ?? 0;

        let power = base.Power?.final ?? 1000;
        let precision = base.Precision?.final ?? 1000;
        let ferocity = base.Ferocity?.final ?? 0;
        let extraCC = 0;

        const mods = this._getEpModifiers(att, att2);
        const rowState = this.epState[rowKey] || {};
        let additive = 0;
        let multiplicative = 1;

        for (const mod of mods) {
            const checked = rowState[mod.id] !== undefined ? rowState[mod.id] : mod.default;

            // Inverted stat: already in base attrs; subtract when unchecked
            if (mod._invertedStat) {
                if (!checked) {
                    const e = mod.effects;
                    if (e.power) power -= e.power;
                    if (e.precision) precision -= e.precision;
                    if (e.ferocity) ferocity -= e.ferocity;
                    if (e.cc) extraCC -= e.cc;
                }
                continue;
            }

            if (!checked) continue;

            if (mod.cat === 'stat') {
                const e = mod.effects;
                if (e.power) power += e.power;
                if (e.precision) precision += e.precision;
                if (e.ferocity) ferocity += e.ferocity;
                if (e.cc) extraCC += e.cc;
            } else if (mod.cat === 'add') {
                additive += mod.value;
            } else if (mod.cat === 'mul') {
                multiplicative *= mod.value;
            }
        }

        const ccPct = Math.min((precision - 895) / 21 + traitCC + sigilCC + extraCC, 100);
        const cdPct = 150 + ferocity / 15;
        const cc = ccPct / 100;
        const cd = cdPct / 100;
        const critMul = cc * cd + (1 - cc);
        const modifierTotal = (1 + additive) * multiplicative;
        const ep = power * critMul * modifierTotal;

        return { power, ferocity, cc: ccPct, cd: cdPct, critMul, modifierTotal, ep };
    }

    _computeCondiEp() {
        const base = this.data?.attributes?.attributes;
        if (!base) return [];

        const condDmg = base['Condition Damage']?.final ?? 0;
        const condiState = this.epState.condi || {};
        const mightChecked = condiState['cmight'] !== undefined ? condiState['cmight'] : true;
        const activeTraitsLocal = this.data.attributes.activeTraits || [];
        const hasTrait = name => activeTraitsLocal.some(t => t.name === name);
        const hasEnhPot = hasTrait('Enhanced Potency');
        const hasInferno = hasTrait('Inferno');
        const mightPerStack = (hasEnhPot && this.evokerElement === 'Fire') ? 35 : 30;
        const mightStacks = this.permaBoons?.Might || 0;
        const mightCondDmg = mightChecked ? mightStacks * mightPerStack : 0;
        const effectiveCondDmg = condDmg + mightCondDmg;
        const baseDur = base['Condition Duration']?.final ?? 0;

        // Inferno: Burning uses Power-based formula instead of Condition Damage
        // infernoPower = Power + Might*30 + trait bonuses
        let infernoTickDmg = 0;
        if (hasInferno) {
            let infernoPower = base.Power?.final ?? 1000;
            const mightPowerPerStack = (hasEnhPot && this.evokerElement === 'Fire') ? 35 : 30;
            if (mightChecked) infernoPower += mightStacks * mightPowerPerStack;
            if (hasTrait('Empowering Flame')) infernoPower += 150;
            if (hasTrait('Power Overwhelming') && mightChecked && mightStacks >= 10) infernoPower += 300;
            if (hasTrait('Elemental Polyphony')) infernoPower += 200;
            // EE pool Power contribution
            const specs = this.data.attributes.specializations || [];
            const isCatalyst = specs.some(s => s.name === 'Catalyst');
            if (isCatalyst && this._empPool?.Power) {
                const hasEmpEmp = hasTrait('Empowered Empowerment');
                const empMul = hasEmpEmp ? 0.02 : 0.01;
                const eeChecked = condiState['cee'] !== undefined ? condiState['cee'] : true;
                if (eeChecked) infernoPower += Math.round(this._empPool.Power * 10 * empMul);
            }
            infernoTickDmg = 0.0825 * infernoPower + 131;
        }

        const FORMULAS = {
            Burning: { base: 131.0, scaling: 0.155, durKey: 'Burning Duration' },
            Bleeding: { base: 22.0, scaling: 0.06, durKey: 'Bleeding Duration' },
            Poisoned: { base: 33.5, scaling: 0.06, durKey: 'Poison Duration' },
            Torment: { base: 31.8, scaling: 0.09, durKey: 'Torment Duration' },
            Confusion: { base: 18.25, scaling: 0.05, durKey: 'Confusion Duration' },
        };

        const mods = this._getEpCondiModifiers();
        let additive = 0;
        let multiplicative = 1;
        let wpDur = 0;
        for (const mod of mods) {
            const checked = condiState[mod.id] !== undefined ? condiState[mod.id] : mod.default;
            if (!checked) continue;
            if (mod.cat === 'stat') continue;
            if (mod.id === 'cwp') { wpDur = 20; additive += mod.value; continue; }
            if (mod.cat === 'add') additive += mod.value;
            else if (mod.cat === 'mul') multiplicative *= mod.value;
        }
        const condMul = (1 + additive) * multiplicative;

        const results = [];
        for (const [cond, f] of Object.entries(FORMULAS)) {
            const tickDmg = (hasInferno && cond === 'Burning')
                ? infernoTickDmg
                : f.base + f.scaling * effectiveCondDmg;
            const specDur = base[f.durKey]?.final ?? 0;
            const totalDur = Math.min(baseDur + specDur + wpDur, 100);
            const durMul = 1 + totalDur / 100;
            const effective = tickDmg * durMul * condMul;
            results.push({ cond, tickDmg, totalDur, durMul, condMul, effective });
        }
        return results;
    }

    renderEffectivePower() {
        const container = document.getElementById('ep-content');
        if (!container || !this.data?.attributes) return;

        const specs = this.data.attributes.specializations || [];
        const isWeaver = specs.some(s => s.name === 'Weaver');
        const ATTS = ['Fire', 'Water', 'Air', 'Earth'];
        const ATT_COLORS = { Fire: '#e55', Water: '#5ae', Air: '#ce6', Earth: '#c96' };

        const rows = [];
        if (isWeaver) {
            rows.push({ att: 'Fire', att2: 'Fire', key: 'Fire/Fire', label: 'Fire/Fire' });
            rows.push({ att: 'Air', att2: 'Air', key: 'Air/Air', label: 'Air/Air' });
            rows.push({ att: 'Fire', att2: 'Air', key: 'Fire/Air', label: 'Fire/Air' });
            rows.push({ att: 'Air', att2: 'Fire', key: 'Air/Fire', label: 'Air/Fire' });
            rows.push({ att: 'Fire', att2: 'Water', key: 'Fire/WE', label: 'Fire/Water·Earth' });
            rows.push({ att: 'Air', att2: 'Water', key: 'Air/WE', label: 'Air/Water·Earth' });
            rows.push({ att: 'Water', att2: 'Fire', key: 'WE/Fire', label: 'Water·Earth/Fire' });
            rows.push({ att: 'Water', att2: 'Air', key: 'WE/Air', label: 'Water·Earth/Air' });
            rows.push({ att: 'Water', att2: 'Water', key: 'WE/WE', label: 'Water·Earth dual' });
        } else {
            for (const att of ATTS) {
                rows.push({ att, att2: null, key: att, label: att });
            }
        }

        let html = '';

        for (const row of rows) {
            const mods = this._getEpModifiers(row.att, row.att2);
            const epResult = this._computeEp(row.att, row.att2, row.key);
            if (!epResult) continue;

            const rowState = this.epState[row.key] || {};
            const priColor = ATT_COLORS[row.att];
            let nameHtml;
            if (!row.att2) {
                nameHtml = `<span style="color:${priColor}">${row.att}</span>`;
            } else if (row.label.includes('·')) {
                const parts = row.label.split('/');
                const colorPart = (p) => {
                    if (p.startsWith('Fire')) return `<span style="color:${ATT_COLORS.Fire}">${p}</span>`;
                    if (p.startsWith('Air')) return `<span style="color:${ATT_COLORS.Air}">${p}</span>`;
                    return `<span style="color:${ATT_COLORS.Water}">${p}</span>`;
                };
                nameHtml = parts.map(colorPart).join('/');
            } else {
                const secColor = ATT_COLORS[row.att2];
                nameHtml = `<span style="color:${priColor}">${row.att}</span>/<span style="color:${secColor}">${row.att2}</span>`;
            }

            html += `<div class="ep-att-row">`;
            html += `<div class="ep-att-header">`;
            html += `<span class="ep-att-name">${nameHtml}</span>`;
            html += `<span class="ep-att-result">${Math.round(epResult.ep).toLocaleString()}</span>`;
            html += `<span class="ep-att-stats">Pwr:${Math.round(epResult.power)} CC:${epResult.cc.toFixed(1)}% CD:${epResult.cd.toFixed(1)}%</span>`;
            html += `</div>`;

            html += `<div class="ep-modifiers">`;
            for (const mod of mods) {
                const checked = rowState[mod.id] !== undefined ? rowState[mod.id] : mod.default;
                const chk = checked ? 'checked' : '';
                if (mod.icon) {
                    html += `<label class="ep-mod-label ep-mod-icon" title="${esc(mod.trait || '')} (${mod.tip || ''})"><input type="checkbox" data-att="${row.key}" data-mod="${mod.id}" ${chk} /><img src="${mod.icon}" class="ep-mod-img" /></label>`;
                } else {
                    const text = mod.label || `${mod.trait} (${mod.tip})`;
                    html += `<label class="ep-mod-label"><input type="checkbox" data-att="${row.key}" data-mod="${mod.id}" ${chk} />${text}</label>`;
                }
            }
            html += `</div>`;
            html += `</div>`;
        }

        // Condition EP section
        const condiMods = this._getEpCondiModifiers();
        const condiResults = this._computeCondiEp();
        const condiState = this.epState.condi || {};

        html += `<div class="ep-condi-section">`;
        html += `<div class="ep-condi-header">Effective Condition Damage (1s × duration)</div>`;

        html += `<div class="ep-condi-modifiers">`;
        for (const mod of condiMods) {
            const checked = condiState[mod.id] !== undefined ? condiState[mod.id] : mod.default;
            const chk = checked ? 'checked' : '';
            if (mod.icon) {
                html += `<label class="ep-mod-label ep-mod-icon" title="${esc(mod.trait || '')} (${mod.tip || ''})"><input type="checkbox" data-att="condi" data-mod="${mod.id}" ${chk} /><img src="${mod.icon}" class="ep-mod-img" /></label>`;
            } else {
                const text = mod.label || `${mod.trait} (${mod.tip})`;
                html += `<label class="ep-mod-label"><input type="checkbox" data-att="condi" data-mod="${mod.id}" ${chk} />${text}</label>`;
            }
        }
        html += `</div>`;

        html += `<table class="ep-condi-table"><thead><tr>`;
        html += `<th>Condition</th><th>Tick/s</th><th>Dur%</th><th>Dur×</th><th>Mod×</th><th>Effective</th>`;
        html += `</tr></thead><tbody>`;

        const CONDI_COLORS = { Burning: '#e8a048', Bleeding: '#d44', Poisoned: '#6b4', Torment: '#b6e', Confusion: '#d8e' };
        for (const r of condiResults) {
            html += `<tr>`;
            html += `<td style="color:${CONDI_COLORS[r.cond] || '#ccc'}">${r.cond}</td>`;
            html += `<td>${r.tickDmg.toFixed(1)}</td>`;
            html += `<td>${r.totalDur.toFixed(1)}%</td>`;
            html += `<td>${r.durMul.toFixed(3)}</td>`;
            html += `<td>${r.condMul.toFixed(3)}</td>`;
            html += `<td class="ep-condi-result">${Math.round(r.effective).toLocaleString()}</td>`;
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        html += `</div>`;

        container.innerHTML = html;

        container.querySelectorAll('input[type="checkbox"][data-att][data-mod]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const att = e.target.dataset.att;
                const modId = e.target.dataset.mod;
                if (!this.epState[att]) this.epState[att] = {};
                this.epState[att][modId] = e.target.checked;
                this.renderEffectivePower();
                this.renderSkillInfoTable();
            });
        });
    }

    // ─── Traits ───
    renderTraits() {
        const container = document.getElementById('traits-panel');
        const specs = this.build.specializations;
        const usedSpecs = new Set(specs.map(s => s.name));

        container.innerHTML = specs.map((spec, slotIdx) => {
            const sd = this.api.getSpecData(spec.name);
            const bgUrl = sd?.background || '';
            const specIcon = sd?.icon || '';
            const specTraits = TRAITS.filter(t => t.specialization === spec.name);
            const choices = spec.traits.split('-').map(Number);

            const tierPairs = [
                { minor: 'Minor Adept', major: 'Major Adept', pick: choices[0] },
                { minor: 'Minor Master', major: 'Major Master', pick: choices[1] },
                { minor: 'Minor Grandmaster', major: 'Major Grandmaster', pick: choices[2] },
            ];

            const tiersHtml = tierPairs.map((tp, tierIdx) => {
                const minor = specTraits.find(t => t.tier === tp.minor);
                const majors = specTraits.filter(t => t.tier === tp.major).sort((a, b) => a.position - b.position);
                const mIcon = minor ? this.api.getTraitIcon(minor.name) : null;

                return `<div class="spec-tier">
                    <div class="spec-trait-minor" title="${esc(minor?.name || '')}">
                        <img src="${mIcon || PLACEHOLDER_ICON}" />
                    </div>
                    <div class="spec-trait-majors">
                        ${majors.map(m => {
                    const ic = this.api.getTraitIcon(m.name);
                    const sel = m.position === tp.pick;
                    return `<div class="spec-trait-major ${sel ? 'sel' : 'dim'}"
                                        data-slot="${slotIdx}" data-tier="${tierIdx}" data-pos="${m.position}"
                                        title="${esc(m.name)}">
                                <img src="${ic || PLACEHOLDER_ICON}" />
                            </div>`;
                }).join('')}
                    </div>
                </div>${tierIdx < 2 ? '<div class="spec-line"></div>' : ''}`;
            }).join('');

            // Build spec dropdown options (exclude specs used in other slots)
            const optionsHtml = SPECIALIZATIONS.map(sn => {
                const disabled = sn !== spec.name && usedSpecs.has(sn);
                return option(sn, spec.name, sn, disabled);
            }).join('');

            return `<div class="spec-row" style="--spec-bg:url('${bgUrl}')">
                <div class="spec-bg"></div>
                <div class="spec-content">
                    <div class="spec-header-col">
                        <div class="spec-icon-wrap"><img src="${specIcon || PLACEHOLDER_ICON}" /></div>
                        <select class="spec-select" data-slot="${slotIdx}">${optionsHtml}</select>
                    </div>
                    <div class="spec-tiers">${tiersHtml}</div>
                </div>
            </div>`;
        }).join('');

        // ── Major trait click: select/deselect within each tier ──
        container.querySelectorAll('.spec-trait-major').forEach(el => {
            el.addEventListener('click', () => {
                const slotIdx = parseInt(el.dataset.slot);
                const tierIdx = parseInt(el.dataset.tier);
                const pos = parseInt(el.dataset.pos);
                const picks = this.build.specializations[slotIdx].traits.split('-').map(Number);
                // Clicking the already-selected trait deselects it (sets to 0)
                picks[tierIdx] = picks[tierIdx] === pos ? 0 : pos;
                this.build.specializations[slotIdx].traits = picks.join('-');
                this._onBuildChange();
            });
        });

        // ── Spec selector: change specialization for a slot ──
        container.querySelectorAll('.spec-select').forEach(el => {
            el.addEventListener('change', () => {
                const slotIdx = parseInt(el.dataset.slot);
                const newSpec = el.value;
                this.build.specializations[slotIdx] = { name: newSpec, traits: '1-1-1' };
                this._onBuildChange();
            });
        });
    }

    // ─── Attunement Bar ───
    renderAttunementBar() {
        const container = document.getElementById('attunement-bar');
        const eliteSpec = this._getEliteSpec();
        const baseSwaps = this.data.skills.filter(s => s.type === 'Attunement' && !s.attunement && s.weapon === 'Profession mechanic');
        const overloads = eliteSpec === 'Tempest'
            ? this.data.skills.filter(s => s.type === 'Attunement' && s.attunement && s.weapon === 'Profession mechanic')
            : [];

        container.innerHTML = ATTUNEMENTS.map(att => {
            const swap = baseSwaps.find(s => s.name.startsWith(att));
            const overload = overloads.find(s => s.attunement === att);
            const isActive = att === this.activeAttunement;
            const icon = this.api.getSkillIcon(swap?.name || `${att} Attunement`);
            const olIcon = overload ? this.api.getSkillIcon(overload.name) : null;
            const color = ATTUNEMENT_COLORS[att];

            return `<div class="att-btn ${isActive ? 'active' : ''}" data-att="${att}" style="--att-c:${color}" title="${esc(att + (overload && isActive ? '\n' + overload.name : ''))}">
                <img src="${(isActive && olIcon) ? olIcon : (icon || PLACEHOLDER_ICON)}" />
                <span class="att-key">F${ATTUNEMENTS.indexOf(att) + 1}</span>
            </div>`;
        }).join('');

        container.querySelectorAll('.att-btn').forEach(el =>
            el.addEventListener('click', () => this.setAttunement(el.dataset.att)));
    }

    setAttunement(att) {
        const elite = this._getEliteSpec();
        if (elite === 'Weaver') {
            if (att === this.activeAttunement && att === this.secondaryAttunement) return;
            this.secondaryAttunement = this.activeAttunement;
        } else {
            if (att === this.activeAttunement) return;
        }
        this.activeAttunement = att;
        this.renderAttunementBar();
        this.renderWeaponBar();
        this.renderSkillBar();
        this.renderSkillInfoTable();
        this._renderStartAttSelector();
        if (this.sim?.rotation.length > 0) {
            this._autoRun();
        } else {
            this._renderPalette();
        }
    }

    // ─── Weapon Bar (active attunement skills + chains) ───
    renderWeaponBar() {
        const container = document.getElementById('weapon-bar');
        const { weapons: weps } = this.data.attributes;
        const mh = weps[0] || '';
        const oh = weps[1] || '';
        const is2h = TH_WEAPONS.has(mh);
        const att = this.activeAttunement;
        const elite = this._getEliteSpec();
        const isWeaver = elite === 'Weaver';

        const allBullets = this._allPistolBulletsHeld();
        let html = '';
        for (let slot = 1; slot <= 5; slot++) {
            const weapon = is2h ? mh : (slot <= 3 ? mh : oh);

            // Elemental Explosion replaces slot 1 for Pistol when all 4 bullets are held
            if (slot === 1 && weapon === 'Pistol' && allBullets) {
                const eeSk = this.data.skills.find(s => s.name === 'Elemental Explosion');
                const icon = eeSk ? this.api.getSkillIcon(eeSk.name) : null;
                html += `<div class="weapon-slot"><div class="wskill main" title="Elemental Explosion\n(all 4 bullets held)\nCast: ${eeSk?.castTime ?? 0}s | CD: ${eeSk?.recharge ?? 0}s">
                    <img src="${icon || PLACEHOLDER_ICON}" />
                    <span class="wslot-num">1</span>
                </div></div>`;
                continue;
            }

            let skills;
            if (isWeaver && slot === 3 && att !== this.secondaryAttunement) {
                skills = this._getWeaverSlot3Skills(weapon);
            } else if (isWeaver && slot >= 4) {
                skills = this._getSkillsForSlot(weapon, this.secondaryAttunement, String(slot));
            } else {
                skills = this._getSkillsForSlot(weapon, att, String(slot));
            }

            const chain = this._getChainOrderWithEtching(skills);
            const root = chain[0];

            if (slot === 4 && !is2h) html += '<div class="weapon-divider"></div>';

            html += '<div class="weapon-slot">';
            if (root) {
                const icon = this.api.getSkillIcon(root.name);
                html += `<div class="wskill main" title="${esc(root.name)}\nCast: ${root.castTime}s | CD: ${root.recharge}s">
                    <img src="${icon || PLACEHOLDER_ICON}" />
                    <span class="wslot-num">${slot}</span>
                </div>`;
                for (let c = 1; c < chain.length; c++) {
                    const ci = this.api.getSkillIcon(chain[c].name);
                    html += `<div class="wskill chain-skill" title="${esc(chain[c].name)}">
                        <img src="${ci || PLACEHOLDER_ICON}" />
                    </div>`;
                }
            } else {
                html += `<div class="wskill empty"><img src="${PLACEHOLDER_ICON}" /><span class="wslot-num">${slot}</span></div>`;
            }
            html += '</div>';
        }

        container.innerHTML = html;
    }

    _getWeaverSlot3Skills(weapon) {
        const pri = this.activeAttunement;
        const sec = this.secondaryAttunement;
        const key1 = `${pri}+${sec}`;
        const key2 = `${sec}+${pri}`;
        return this.data.skills.filter(s =>
            s.slot === '3' && s.weapon === weapon &&
            (s.attunement === key1 || s.attunement === key2));
    }

    _getSkillsForSlot(weapon, attunement, slot) {
        return this.data.skills.filter(s =>
            s.weapon === weapon && s.attunement === attunement && s.slot === slot
            && (s.type === 'Weapon skill' || s.type === 'Dual Wield'));
    }

    _getChainOrder(skills) {
        if (skills.length <= 1) return skills;
        const chainTargets = new Set(skills.filter(s => s.chainSkill).map(s => s.chainSkill));
        let root = skills.find(s => !chainTargets.has(s.name)) || skills[0];
        const order = [root];
        const visited = new Set([root.name]);
        let current = root;
        while (current.chainSkill && !visited.has(current.chainSkill)) {
            const next = skills.find(s => s.name === current.chainSkill);
            if (!next) break;
            order.push(next);
            visited.add(next.name);
            current = next;
        }
        return order;
    }

    // Returns chain order for a slot, appending Etching lesser/full variants when the root is an Etching skill.
    _getChainOrderWithEtching(skills) {
        const order = this._getChainOrder(skills);
        if (order.length === 0) return order;
        const root = order[0];
        const etchChain = ETCHING_LOOKUP_UI.get(root.name);
        if (!etchChain || root.name !== etchChain.etching) return order;
        // Append lesser then full, sourced from all loaded skills
        const allSkills = this.data.skills;
        const lesserSk = allSkills.find(s => s.name === etchChain.lesser);
        const fullSk = allSkills.find(s => s.name === etchChain.full);
        if (lesserSk && !order.some(s => s.name === lesserSk.name)) order.push(lesserSk);
        if (fullSk && !order.some(s => s.name === fullSk.name)) order.push(fullSk);
        return order;
    }

    // ─── Skill Bar (heal/utility/elite selection) ───
    renderSkillBar() {
        const container = document.getElementById('skill-bar');
        const labels = { heal: 'Heal', util1: 'Utility', util2: 'Utility', util3: 'Utility', elite: 'Elite' };

        container.innerHTML = SLOT_LABELS.map(slotKey => {
            const selected = this.selectedSkills[slotKey];
            const resolvedSkill = selected ? this._resolveAttunementSkill(selected) : null;
            const icon = resolvedSkill ? this.api.getSkillIcon(resolvedSkill.name) : null;
            const borderClass = slotKey === 'heal' ? 'heal-border' : slotKey === 'elite' ? 'elite-border' : '';

            return `<div class="skill-bar-slot ${borderClass}" data-slot="${slotKey}">
                <div class="sbar-icon" title="${esc(resolvedSkill?.name || labels[slotKey])}">
                    ${icon ? `<img src="${icon}" />` : `<div class="sbar-empty">${labels[slotKey][0]}</div>`}
                </div>
                <div class="sbar-arrow">▾</div>
                <div class="sbar-dropdown" id="dropdown-${slotKey}"></div>
            </div>`;
        }).join('');

        container.querySelectorAll('.skill-bar-slot').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown(el.dataset.slot);
            });
        });
    }

    toggleDropdown(slotKey) {
        if (this.openDropdown === slotKey) {
            this.closeDropdown();
            return;
        }
        this.closeDropdown();
        this.openDropdown = slotKey;

        const dd = document.getElementById(`dropdown-${slotKey}`);
        const slotType = SLOT_TYPES[slotKey];
        const available = this._getAvailableSkillsForSlot(slotType);

        dd.innerHTML = available.map(sk => {
            const icon = this.api.getSkillIcon(sk.name);
            const label = sk.displayName || sk.name;
            return `<div class="dd-item" data-skill-name="${esc(sk.name)}" title="${esc(sk.name)}">
                <img src="${icon || PLACEHOLDER_ICON}" />
                <span>${esc(label)}</span>
            </div>`;
        }).join('') || '<div class="dd-empty">No skills available</div>';

        dd.classList.add('open');
        dd.querySelectorAll('.dd-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const skillName = item.dataset.skillName;
                const skill = this.data.skills.find(s => s.name === skillName);
                if (skill) {
                    this.selectedSkills[slotKey] = skill;
                    this.closeDropdown();
                    this._onBuildChange(); // recalculates attributes (Signet of Fire passive, etc.)
                    this._renderPalette();
                }
            });
        });
    }

    closeDropdown() {
        if (this.openDropdown) {
            const dd = document.getElementById(`dropdown-${this.openDropdown}`);
            if (dd) dd.classList.remove('open');
            this.openDropdown = null;
        }
    }

    _getAvailableSkillsForSlot(slotType) {
        const selectedSpecs = new Set(this.data.attributes.specializations.map(s => s.name));
        const activeTraits = this.data.attributes?.activeTraits || [];
        const hasElementsOfRage = activeTraits.some(t => t.name === 'Elements of Rage');
        const skills = this.data.skills.filter(s => {
            if (s.slot !== slotType) return false;
            // Unravel is only accessible while Elements of Rage is traited.
            if (s.name === 'Unravel' && !hasElementsOfRage) return false;
            const requiredSpec = SKILL_TYPE_SPEC[s.type];
            if (requiredSpec && !selectedSpecs.has(requiredSpec)) return false;
            return true;
        });
        const seen = new Set();
        const result = [];

        for (const sk of skills) {
            const base = sk.name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
            if (sk.attunement && base !== sk.name) {
                if (seen.has(base)) continue;
                seen.add(base);
                const variant = skills.find(s =>
                    s.name === `${base} (${this.activeAttunement})`) || sk;
                result.push({ ...variant, displayName: base });
            } else {
                if (sk.chainSkill) {
                    // Only hide if there is a root skill (recharge > 0) that chains into this one.
                    // Cyclic pairs like Weave Self ↔ Tailored Victory: Tailored Victory has no
                    // recharge, so only it is hidden; Weave Self stays visible.
                    const isChainTarget = skills.some(s =>
                        s.chainSkill === sk.name && s.slot === slotType && (s.recharge || 0) > 0);
                    if (isChainTarget) continue;
                }
                if (seen.has(sk.name)) continue;
                seen.add(sk.name);
                result.push(sk);
            }
        }
        return result;
    }

    _resolveAttunementSkill(skill) {
        const base = skill.name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
        if (base !== skill.name || (skill.displayName && skill.displayName !== skill.name)) {
            const realBase = skill.displayName || base;
            const variant = this.data.skills.find(s => s.name === `${realBase} (${this.activeAttunement})`);
            return variant || skill;
        }
        return skill;
    }

    // ─── Skill Info Table ───
    renderSkillInfoTable() {
        const container = document.getElementById('skill-info-table');
        const { weapons: weps } = this.data.attributes;
        const mh = weps[0] || '';
        const oh = weps[1] || '';
        const is2h = TH_WEAPONS.has(mh);
        const eliteSpec = this._getEliteSpec();
        const isWeaver = eliteSpec === 'Weaver';

        const hdr = `<div class="info-header">
            <span></span><span>Name</span><span>Strike</span><span>Condi</span><span>Total</span><span>DCT</span>
        </div>`;
        let html = hdr;

        // For weapon skills under an attunement: use best EP combo for that skill
        // For Weaver, a Fire skill can be used in Fire/Fire, Fire/Air, Fire/Water, Fire/Earth (primary=Fire)
        // and also in Air/Fire, Water/Fire, Earth/Fire (secondary=Fire for slots 4-5)
        const selectedAtt = this.activeAttunement;
        const selectedAtt2 = isWeaver ? this.secondaryAttunement : null;

        for (const att of ATTUNEMENTS) {
            const color = ATTUNEMENT_COLORS[att];
            html += `<div class="info-att-header" style="color:${color}">${att}</div>`;
            html += '<div class="info-rows">';

            for (let slot = 1; slot <= 5; slot++) {
                const weapon = is2h ? mh : (slot <= 3 ? mh : oh);
                const skills = this._getSkillsForSlot(weapon, att, String(slot));
                const chain = this._getChainOrderWithEtching(skills);
                const bestCtx = this._getBestEpContext(att, slot, isWeaver);
                for (const sk of chain) {
                    html += this._renderInfoRow(sk, weapon, bestCtx);
                }
            }

            if (eliteSpec === 'Tempest') {
                const overload = this.data.skills.find(s =>
                    s.weapon === 'Profession mechanic' && s.attunement === att && s.type === 'Attunement' && s.name.startsWith('Overload'));
                if (overload) {
                    const ctx = this._getEpContextForAtt(att, null);
                    html += this._renderInfoRow(overload, 'Profession mechanic', ctx);
                }
            }
            html += '</div>';
        }

        const weaverDualSkills = this._getInfoWeaverDualSkills(mh, oh, is2h);
        if (weaverDualSkills.length > 0) {
            html += '<div class="info-att-header" style="color:#d7c06a">Weaver Dual Skills</div>';
            html += '<div class="info-rows">';
            for (const sk of weaverDualSkills) {
                const bestCtx = this._getBestEpContextForDual(sk);
                html += this._renderInfoRow(sk, sk.weapon, bestCtx);
            }
            html += '</div>';
        }

        const specialSkills = this._getInfoSpecialSkills(mh, oh);
        if (specialSkills.length > 0) {
            html += '<div class="info-att-header" style="color:var(--accent)">Special Skills</div>';
            html += '<div class="info-rows">';
            const selCtx = this._getEpContextForAtt(selectedAtt, selectedAtt2);
            for (const sk of specialSkills) html += this._renderInfoRow(sk, this._getWeaponForSkill(sk), selCtx);
            html += '</div>';
        }

        const professionMechanics = this._getInfoProfessionMechanicSkills(eliteSpec);
        if (professionMechanics.length > 0) {
            html += '<div class="info-att-header" style="color:#66c7d8">Profession Mechanics</div>';
            html += '<div class="info-rows">';
            for (const sk of professionMechanics) {
                const mechAtt = sk.attunement || selectedAtt;
                const ctx = this._getEpContextForAtt(mechAtt, isWeaver ? selectedAtt2 : null);
                html += this._renderInfoRow(sk, 'Profession mechanic', ctx);
            }
            html += '</div>';
        }

        const selectedAny = Object.values(this.selectedSkills).some(s => s);
        if (selectedAny) {
            html += '<div class="info-att-header" style="color:var(--accent)">Selected Skills</div>';
            html += '<div class="info-rows">';
            const selCtx = this._getEpContextForAtt(selectedAtt, selectedAtt2);
            for (const slotKey of SLOT_LABELS) {
                const sel = this.selectedSkills[slotKey];
                if (!sel) continue;
                const resolved = this._resolveAttunementSkill(sel);
                const wKey = this._getWeaponForSkill(resolved);
                html += this._renderInfoRow(resolved, wKey, selCtx);

                if (sel.type === 'Conjure') {
                    const conjWeapon = CONJURE_MAP[resolved.name];
                    if (conjWeapon) {
                        const conjSkills = this.data.skills.filter(s => s.weapon === conjWeapon);
                        for (const cs of conjSkills) {
                            html += this._renderInfoRow(cs, 'Conjured Weapon', selCtx);
                        }
                    }
                }
            }
            html += '</div>';
        }

        container.innerHTML = html || '<div class="placeholder-text">No weapon skills found for current weapon set</div>';
    }

    _getEpContextForAtt(att, att2) {
        const rowKey = this._getEpRowKeyForPair(att, att2);
        const result = this._computeEp(att, att2 || att, rowKey);
        if (!result) return { strikeMul: 1, condMul: 1, attrs: this.data.attributes.attributes };

        const base = this.data.attributes.attributes;
        const modifiedAttrs = {};
        for (const [k, v] of Object.entries(base)) modifiedAttrs[k] = { ...v };
        modifiedAttrs['Power'] = { ...modifiedAttrs['Power'], final: result.power };
        modifiedAttrs['Critical Chance'] = { ...modifiedAttrs['Critical Chance'], final: result.cc };
        modifiedAttrs['Critical Damage'] = { ...modifiedAttrs['Critical Damage'], final: result.cd };

        // Include Might's condition damage contribution
        const condiState = this.epState.condi || {};
        const mightChecked = condiState['cmight'] !== undefined ? condiState['cmight'] : true;
        if (mightChecked) {
            const activeTraitsLocal = this.data.attributes.activeTraits || [];
            const hasEnhPot = activeTraitsLocal.some(t => t.name === 'Enhanced Potency');
            const mightPerStack = (hasEnhPot && this.evokerElement === 'Fire') ? 35 : 30;
            const mightCondDmg = (this.permaBoons?.Might || 0) * mightPerStack;
            const baseCondDmg = base['Condition Damage']?.final ?? 0;
            modifiedAttrs['Condition Damage'] = { ...modifiedAttrs['Condition Damage'], final: baseCondDmg + mightCondDmg };
        }

        // Include Weaver's Prowess condition duration bonus
        const cwpMods = this._getEpCondiModifiers();
        const cwpMod = cwpMods.find(m => m.id === 'cwp');
        if (cwpMod) {
            const cwpChecked = condiState['cwp'] !== undefined ? condiState['cwp'] : cwpMod.default;
            if (cwpChecked) {
                const baseCondDur = base['Condition Duration']?.final ?? 0;
                modifiedAttrs['Condition Duration'] = { ...modifiedAttrs['Condition Duration'], final: Math.min(baseCondDur + 20, 100) };
            }
        }

        // Inferno: compute Power-based Burning tick for skill damage
        let infernoBurningTick = 0;
        const activeTraits = this.data.attributes.activeTraits || [];
        if (activeTraits.some(t => t.name === 'Inferno')) {
            const infernoResults = this._computeCondiEp();
            const burningRow = infernoResults.find(r => r.cond === 'Burning');
            if (burningRow) infernoBurningTick = burningRow.tickDmg;
        }

        return { strikeMul: result.modifierTotal, condMul: this._getCondiMul(), attrs: modifiedAttrs, infernoBurningTick };
    }

    _getEpRowKeyForPair(att, att2) {
        const specs = this.data?.attributes?.specializations || [];
        const isWeaver = specs.some(s => s.name === 'Weaver');
        if (!isWeaver) return att;

        const WE = new Set(['Water', 'Earth']);
        const pri = att;
        const sec = att2 || att;

        if (pri === 'Fire' && sec === 'Fire') return 'Fire/Fire';
        if (pri === 'Air' && sec === 'Air') return 'Air/Air';
        if (pri === 'Fire' && sec === 'Air') return 'Fire/Air';
        if (pri === 'Air' && sec === 'Fire') return 'Air/Fire';
        if (pri === 'Fire' && WE.has(sec)) return 'Fire/WE';
        if (pri === 'Air' && WE.has(sec)) return 'Air/WE';
        if (WE.has(pri) && sec === 'Fire') return 'WE/Fire';
        if (WE.has(pri) && sec === 'Air') return 'WE/Air';
        return 'WE/WE';
    }

    _getBestEpContext(skillAtt, slot, isWeaver) {
        if (!isWeaver) return this._getEpContextForAtt(skillAtt, null);

        // For Weaver weapon skills: the skill's attunement is fixed.
        // Slots 1-3 use primary attunement = skillAtt, secondary can be anything.
        // Slots 4-5 use secondary attunement = skillAtt, primary can be anything.
        const ATTS = ['Fire', 'Water', 'Air', 'Earth'];
        let bestCtx = null;
        let bestEp = -Infinity;

        if (slot <= 3) {
            for (const sec of ATTS) {
                const rowKey = this._getEpRowKeyForPair(skillAtt, sec);
                const result = this._computeEp(skillAtt, sec, rowKey);
                if (result && result.ep > bestEp) {
                    bestEp = result.ep;
                    bestCtx = { att: skillAtt, att2: sec, rowKey };
                }
            }
        } else {
            for (const pri of ATTS) {
                const rowKey = this._getEpRowKeyForPair(pri, skillAtt);
                const result = this._computeEp(pri, skillAtt, rowKey);
                if (result && result.ep > bestEp) {
                    bestEp = result.ep;
                    bestCtx = { att: pri, att2: skillAtt, rowKey };
                }
            }
        }

        if (!bestCtx) return this._getEpContextForAtt(skillAtt, skillAtt);
        return this._getEpContextForAtt(bestCtx.att, bestCtx.att2);
    }

    _getBestEpContextForDual(skill) {
        // Dual skills have attunement like "Fire+Air" — both attunements are fixed
        const parts = (skill.attunement || '').split('+');
        if (parts.length === 2) {
            return this._getEpContextForAtt(parts[0], parts[1]);
        }
        return this._getEpContextForAtt(this.activeAttunement, this.secondaryAttunement);
    }

    _getCondiMul() {
        const mods = this._getEpCondiModifiers();
        const condiState = this.epState.condi || {};
        let additive = 0;
        let multiplicative = 1;
        for (const mod of mods) {
            const checked = condiState[mod.id] !== undefined ? condiState[mod.id] : mod.default;
            if (!checked) continue;
            if (mod.cat === 'stat') continue;
            if (mod.id === 'cwp') { additive += mod.value; continue; }
            if (mod.cat === 'add') additive += mod.value;
            else if (mod.cat === 'mul') multiplicative *= mod.value;
        }
        return (1 + additive) * multiplicative;
    }

    _renderInfoRow(skill, weaponKey, epCtx) {
        const icon = this.api.getSkillIcon(skill.name);
        const hits = this.data.skillHits[skill.name] || [];
        const wStr = WEAPON_DATA[weaponKey]?.weaponStrength || WEAPON_DATA[this._getWeaponForSkill(skill)]?.weaponStrength || 1000;
        const attrs = epCtx ? epCtx.attrs : this.data.attributes.attributes;
        const maxHit = this.hitboxSize === 'small' ? (SMALL_HITBOX_CAPS.get(skill.name) ?? Infinity) : Infinity;
        const infernoBurningTick = epCtx ? epCtx.infernoBurningTick || 0 : 0;
        const dmg = calculateSkillDamage(skill, hits, wStr, attrs, { maxHit, infernoBurningTick });

        const strikeMul = epCtx ? epCtx.strikeMul : 1;
        const condMul = epCtx ? epCtx.condMul : 1;
        const strike = dmg.totalStrike * strikeMul;
        const condition = dmg.totalCondition * condMul;
        const total = strike + condition;
        const dps = dmg.castTime > 0 ? total / dmg.castTime : 0;

        return `<div class="info-row">
            <img class="info-icon" src="${icon || PLACEHOLDER_ICON}" title="${esc(skill.name)}" />
            <span class="info-name" title="${esc(skill.name)}">${esc(skill.name)}</span>
            <span class="info-val">${Math.round(strike)}</span>
            <span class="info-val condi">${Math.round(condition)}</span>
            <span class="info-val total">${Math.round(total)}</span>
            <span class="info-val dps">${dmg.castTime > 0 ? Math.round(dps) : '—'}</span>
        </div>`;
    }

    _uniqueSkillsByName(skills) {
        const seen = new Set();
        return skills.filter(skill => {
            if (!skill || seen.has(skill.name)) return false;
            seen.add(skill.name);
            return true;
        });
    }

    _getInfoWeaverDualSkills(mh, oh, is2h) {
        if (this._getEliteSpec() !== 'Weaver') return [];
        const weapons = is2h ? [mh] : [mh].filter(Boolean);
        return this._uniqueSkillsByName(this.data.skills.filter(skill =>
            weapons.includes(skill.weapon)
            && skill.slot === '3'
            && typeof skill.attunement === 'string'
            && skill.attunement.includes('+')
        ));
    }

    _getInfoSpecialSkills(mh, oh) {
        const skills = [];
        if (mh === 'Pistol' || oh === 'Pistol') {
            const ee = this.data.skills.find(skill => skill.name === 'Elemental Explosion');
            if (ee) skills.push(ee);
        }
        if (mh === 'Hammer' || oh === 'Hammer') {
            const gf = this.data.skills.find(skill => skill.name === 'Grand Finale' && skill.weapon === 'Hammer');
            if (gf) skills.push(gf);
        }
        return this._uniqueSkillsByName(skills);
    }

    _getInfoProfessionMechanicSkills(eliteSpec) {
        if (eliteSpec === 'Catalyst') {
            return this._uniqueSkillsByName(this.data.skills.filter(skill => skill.type === 'Jade Sphere'));
        }
        if (eliteSpec === 'Evoker') {
            return this._uniqueSkillsByName(this.data.skills.filter(skill => skill.type === 'Familiar'));
        }
        return [];
    }

    // ─── Helpers ───
    _getEliteSpec() {
        const elites = new Set(['Tempest', 'Weaver', 'Catalyst', 'Evoker']);
        return this.data.attributes.specializations.find(s => elites.has(s.name))?.name || null;
    }

    _getWeaponForSkill(skill) {
        const w = skill.weapon;
        if (w === 'Profession mechanic') return 'Profession mechanic';
        if (['Frost Bow', 'Lightning Hammer', 'Fiery Greatsword'].includes(w)) return 'Conjured Weapon';
        if (w) return w;
        if (['Healing', 'Utility', 'Elite'].includes(skill.slot)) return 'Unequipped';
        return this.data.attributes.weapons[0] || 'Sword';
    }

    // ─── Perma Boons & Conditions ───
    _renderPermaBoons() {
        const el = document.getElementById('perma-boons');
        if (!el) return;

        const PERMA_BOONS = [
            'Might', 'Fury', 'Quickness', 'Alacrity', 'Swiftness',
            'Protection', 'Resolution', 'Regeneration', 'Vigor',
            'Resistance', 'Stability', 'Aegis',
        ];
        const STACK_EFFECTS = {
            Might: 25,
            Stability: 25,
            ...Object.fromEntries(
                [...STACKING_TARGET_CONDITIONS].map(name => [name, 25]),
            ),
        };

        const renderGroup = (title, list) => {
            let h = `<div class="perma-group"><span class="perma-group-label">${title}</span>`;
            for (const name of list) {
                const col = EFFECT_COLORS[name] || '#aaa';
                const maxStacks = STACK_EFFECTS[name];
                const cur = this.permaBoons[name];
                const checked = maxStacks ? (cur > 0) : !!cur;
                h += `<label class="perma-item" style="--pc:${col}">`;
                h += `<input type="checkbox" data-effect="${esc(name)}" ${checked ? 'checked' : ''} />`;
                h += `<span class="perma-name">${name}</span>`;
                if (maxStacks) {
                    const val = cur || 0;
                    h += `<input type="number" class="perma-stacks" data-effect="${esc(name)}" min="0" max="${maxStacks}" value="${val}" ${checked ? '' : 'disabled'} />`;
                }
                h += '</label>';
            }
            h += '</div>';
            return h;
        };

        el.innerHTML =
            renderGroup('Boons', PERMA_BOONS)
            + renderGroup('Conditions', PERMANENT_TARGET_CONDITIONS);

        el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const name = cb.dataset.effect;
                const stackInput = el.querySelector(`input[type="number"][data-effect="${name}"]`);
                if (stackInput) {
                    if (cb.checked) {
                        stackInput.disabled = false;
                        const val = parseInt(stackInput.value) || 0;
                        this.permaBoons[name] = Math.max(1, val);
                        if (val < 1) stackInput.value = '1';
                    } else {
                        stackInput.disabled = true;
                        delete this.permaBoons[name];
                    }
                } else {
                    if (cb.checked) this.permaBoons[name] = true;
                    else delete this.permaBoons[name];
                }
                if (this.sim?.rotation.length > 0) this._autoRun();
            });
        });

        el.querySelectorAll('input[type="number"]').forEach(inp => {
            inp.addEventListener('change', () => {
                const name = inp.dataset.effect;
                const cb = el.querySelector(`input[type="checkbox"][data-effect="${name}"]`);
                if (!cb?.checked) return;
                const max = parseInt(inp.max) || 25;
                const val = Math.max(0, Math.min(max, parseInt(inp.value) || 0));
                inp.value = val;
                if (val === 0) {
                    cb.checked = false;
                    inp.disabled = true;
                    delete this.permaBoons[name];
                } else {
                    this.permaBoons[name] = val;
                }
                if (this.sim?.rotation.length > 0) this._autoRun();
            });
        });
    }

    // ─── Rotation Builder ───
    renderRotationBuilder() {
        renderRotationBuilderUI(this);
    }

    _renderStartAttSelector() {
        renderStartAttSelector(this, {
            ATTUNEMENTS,
            ATTUNEMENT_COLORS,
        });
    }

    _skillColor(skill, skillName) {
        if (skillName === '__combat_start') return '#d66d2f';
        if (skillName === '__wait') return '#8d7a57';
        if (skillName === '__drop_bundle' || (skillName && skillName.startsWith('__pickup_')))
            return '#ffcc44';
        if (!skill) return 'var(--border-light)';
        if (skill.type === 'Dodge' || skill.slot === 'Dodge') return '#7fb6d8';
        if (CONJURE_WEAPONS.has(skill.weapon)) return '#ffcc44';
        if (skill.attunement) {
            const a = skill.attunement.split('+')[0];
            return ATTUNEMENT_COLORS[a] || 'var(--border-light)';
        }
        for (const att of ATTUNEMENTS) {
            if (skill.name === `${att} Attunement` || skill.name === `Overload ${att}`)
                return ATTUNEMENT_COLORS[att];
        }
        return 'var(--border-light)';
    }

    _cdKey(sk) {
        if (CONJURE_WEAPONS.has(sk.weapon)) return `${sk.name}::${sk.weapon}`;
        if (sk.type === 'Jade Sphere') return sk.name;
        const base = sk.name.replace(/\s*\((?:Fire|Water|Air|Earth)\)$/, '');
        return (base !== sk.name && sk.attunement) ? base : sk.name;
    }

    _skillInContext(name) {
        const es = this.sim?.results?.endState;
        const matches = this.data.skills.filter(s => s.name === name);
        if (matches.length <= 1) return matches[0] || null;
        if (es?.conjureEquipped) {
            return matches.find(s => s.weapon === es.conjureEquipped)
                || matches.find(s => !CONJURE_WEAPONS.has(s.weapon))
                || matches[0];
        }
        return matches.find(s => !CONJURE_WEAPONS.has(s.weapon)) || matches[0];
    }

    _isSkillAvailable(skillName) {
        if (skillName === '__combat_start') {
            return !this.sim?.rotation?.some(item =>
                (typeof item === 'string' ? item : item?.name) === '__combat_start'
            );
        }
        const es = this.sim?.results?.endState;
        if (!es) return true;
        const sk = this._skillInContext(skillName);
        if (!sk) return false;
        const t = es.time;

        if (sk.type === 'Attunement' && !sk.name.startsWith('Overload')) {
            const target = sk.name.replace(' Attunement', '');
            if (es.eliteSpec === 'Weaver') {
                if (target === es.att && target === es.att2) return false;
            } else {
                if (target === es.att) return false;
            }
            return (es.attCD[target] || 0) <= t;
        }
        if (sk.name.startsWith('Overload ')) {
            if (es.eliteSpec !== 'Tempest') return false;
            const olAtt = sk.name.replace('Overload ', '');
            if (olAtt !== es.att) return false;
            if ((es.skillCD[skillName] || 0) > t) return false;
            const dwell = es._hasTranscendentTempest ? 4000 : 6000;
            const dwellReady = es.attEnteredAt + this._esAlaCd(es, dwell, es.attEnteredAt);
            if (t < dwellReady) return false;
            return true;
        }
        if (sk.type === 'Jade Sphere') {
            if (es.eliteSpec !== 'Catalyst') return false;
            if (sk.attunement !== es.att) return false;
            if (es.energy < 10) return false;
            return (es.skillCD[this._cdKey(sk)] || 0) <= t;
        }
        if (sk.type === 'Familiar') {
            if (es.eliteSpec !== 'Evoker') return false;
            const EVOKER_EL = {
                Ignite: 'Fire', Splash: 'Water', Zap: 'Air', Calcify: 'Earth',
                Conflagration: 'Fire', 'Buoyant Deluge': 'Water', 'Lightning Blitz': 'Air', 'Seismic Impact': 'Earth'
            };
            const SELECTORS = new Set(['Ignite', 'Splash', 'Zap', 'Calcify']);
            const famEl = EVOKER_EL[skillName];
            if (!famEl) return false;
            if (es.evokerElement !== famEl) return false;
            const isBasic = SELECTORS.has(skillName);
            if (isBasic) {
                if ((es.evokerEmpowered ?? 0) >= 3) return false;
                if ((es.evokerCharges ?? 0) < (es.evokerMaxCharges ?? 6)) return false;
            } else {
                if ((es.evokerEmpowered ?? 0) < 3) return false;
            }
            return (es.skillCD[skillName] || 0) <= t;
        }
        if ((sk.type === 'Dodge' || sk.slot === 'Dodge')) {
            return (es.endurance ?? 100) >= Math.abs(sk.endurance || 0);
        }

        const cdKey = this._cdKey(sk);
        if (skillName === 'Rock Barrier') {
            const pendingReadyAt = this._getPendingRockBarrierReadyAt(es);
            if (pendingReadyAt !== null && pendingReadyAt > t) return false;
        }
        if ((es.skillCD[cdKey] || 0) > t) return false;

        if (sk.maximumCount > 0 && sk.countRecharge > 0) {
            const ch = es.charges?.[cdKey];
            if (ch) {
                let count = ch.count;
                let nextAt = ch.nextChargeAt;
                const crMs = Math.round(sk.countRecharge * 1000);
                while (count < sk.maximumCount && nextAt <= t) {
                    count++;
                    nextAt = count < sk.maximumCount ? nextAt + crMs : Infinity;
                }
                if (count <= 0) return false;
            }
        }

        if (CONJURE_WEAPONS.has(sk.weapon)) {
            return es.conjureEquipped === sk.weapon;
        }
        if (es.conjureEquipped && sk.type === 'Weapon skill' && !CONJURE_WEAPONS.has(sk.weapon)) {
            return false;
        }

        if (es.aaCarryover && sk.slot === '1') {
            const carryExpected = es.chainState?.[es.aaCarryover.root];
            if (skillName === carryExpected) return true;
        }

        if (sk.attunement) {
            if (es.eliteSpec === 'Weaver') {
                if (sk.attunement.includes('+')) {
                    const [a, b] = sk.attunement.split('+');
                    if (!((a === es.att && b === es.att2) || (b === es.att && a === es.att2))) return false;
                } else {
                    const slotNum = parseInt(sk.slot);
                    if (!isNaN(slotNum) && slotNum >= 4) {
                        if (sk.attunement !== es.att2) return false;
                    } else {
                        if (sk.attunement !== es.att) return false;
                    }
                }
            } else {
                const parts = sk.attunement.split('+');
                if (!parts.includes(es.att)) return false;
            }
        }

        if (sk.chainSkill) {
            if (AURA_TRANSMUTE_SKILLS_UI[skillName]) return this._hasAuraTransmuteAccess(skillName, es);
            const chainRoot = this._getChainRootName(sk);
            let expected = es.chainState?.[chainRoot] || chainRoot;
            // Non-slot-1 chains: if the 5s window expired, treat as reset to root
            const expiry = es.chainExpiry?.[chainRoot];
            if (sk.slot !== '1' && expiry !== undefined && expiry <= (es.time ?? Infinity)) {
                expected = chainRoot;
            }
            if (skillName !== expected) return false;
        }

        // Etching chain availability
        const etchChain = ETCHING_LOOKUP_UI.get(skillName);
        if (etchChain) {
            const state = es.etchingState?.[etchChain.etching];
            if (skillName === etchChain.lesser && state !== 'lesser') return false;
            if (skillName === etchChain.full && state !== 'full') return false;
        }

        // Hammer orb ICD (480ms between any orb skill and Grand Finale)
        if (sk.weapon === 'Hammer' && sk.type === 'Weapon skill') {
            const isGF = skillName === 'Grand Finale';
            const isOrb = HAMMER_ALL_ORB_NAMES_UI.has(skillName);
            // Can't reuse the same orb skill without Grand Finale in between
            if (isOrb && (es.hammerOrbsUsed || []).includes(skillName)) return false;
            if ((isGF || isOrb) && (es.hammerOrbLastCast ?? -Infinity) > -Infinity) {
                if (t - es.hammerOrbLastCast <= HAMMER_ORB_ICD_MS_UI) return false;
            }
        }

        // Hammer Grand Finale: needs at least one active orb in current attunement context
        if (skillName === 'Grand Finale' && sk.weapon === 'Hammer') {
            const orbs = es.hammerOrbs || {};
            const activeOrbs = Object.entries(orbs).filter(([, exp]) => exp !== null && exp > t).map(([el]) => el);
            if (activeOrbs.length === 0) return false;
            // Check attunement-specific prerequisite
            const pri = es.att;
            const sec = es.att2;
            const grantedBy = es.hammerOrbGrantedBy || {};
            if (es.eliteSpec !== 'Weaver' || !sec || pri === sec) {
                if (!activeOrbs.includes(pri)) return false;
            } else {
                let qualifies = activeOrbs.includes(pri) || activeOrbs.includes(sec);
                if (!qualifies) {
                    for (const el of activeOrbs) {
                        const gb = grantedBy[el];
                        if (!gb) continue;
                        const gbSk = this.data.skills.find(s => s.name === gb);
                        if (!gbSk) continue;
                        const att = gbSk.attunement || '';
                        const parts = att.split('+');
                        if (parts.includes(pri) || parts.includes(sec)) { qualifies = true; break; }
                    }
                }
                if (!qualifies) return false;
            }
        }

        // Tailored Victory: only available while Perfect Weave is active
        if (skillName === 'Tailored Victory' && (es.perfectWeaveUntil || 0) <= t) return false;

        // Elemental Explosion: only available when all 4 bullets are held
        if (skillName === 'Elemental Explosion') {
            const b = es.pistolBullets || {};
            if (!b.Fire || !b.Water || !b.Air || !b.Earth) return false;
        }

        return true;
    }

    // Returns true if all 4 pistol bullets are currently held (live or preset)
    _allPistolBulletsHeld() {
        const liveBullets = this.sim?.results?.endState?.pistolBullets;
        const b = liveBullets || this._presetPistolBullets || {};
        return !!(b.Fire && b.Water && b.Air && b.Earth);
    }

    _getChainRootName(sk) {
        const candidates = this.data.skills.filter(s =>
            s.slot === sk.slot && s.attunement === sk.attunement && s.weapon === sk.weapon && s.chainSkill
        );
        if (candidates.length === 0) return sk.name;
        const targets = new Set(candidates.map(s => s.chainSkill));
        const root = candidates.find(s => !targets.has(s.name));
        return root ? root.name : candidates[0].name;
    }

    _hasAuraTransmuteAccess(skillName, es) {
        const auraName = AURA_TRANSMUTE_SKILLS_UI[skillName];
        const allCondStacks = this.sim?.results?.allCondStacks || [];
        if (!auraName || !es) return false;
        return allCondStacks.some(stack =>
            stack.cond === auraName && stack.t <= es.time && stack.expiresAt > es.time
        );
    }

    _isVirtualAvailable(name) {
        if (name === '__combat_start') return this._isSkillAvailable(name);
        if (name === '__wait') return true;
        const es = this.sim?.results?.endState;
        if (!es) return false;
        if (name === '__drop_bundle') return !!es.conjureEquipped;
        if (name.startsWith('__pickup_')) {
            const weapon = name.slice(9);
            return (es.conjurePickups || []).some(p => p.weapon === weapon && es.time <= p.expiresAt);
        }
        return false;
    }

    // Mirror of simulation's _alaCd: compute alacrity-reduced cooldown from endState context.
    _esAlaCd(es, baseCdMs, cdStart) {
        if (baseCdMs <= 0) return 0;
        const alaEnd = es.alacrityUntil || 0;
        if (alaEnd <= cdStart) return baseCdMs;
        const readyIfFull = Math.round(baseCdMs / 1.25);
        if (alaEnd >= cdStart + readyIfFull) return readyIfFull;
        const alaRealMs = alaEnd - cdStart;
        const alaProgress = alaRealMs * 1.25;
        const remaining = baseCdMs - alaProgress;
        return Math.round(alaRealMs + remaining);
    }

    _getPendingRockBarrierReadyAt(es) {
        if (!es) return null;
        const expiry = es.chainExpiry?.['Rock Barrier'];
        if (expiry === undefined || expiry > es.time) return null;
        const skill = this.data.skills.find(s => s.name === 'Rock Barrier');
        if (!skill || (skill.recharge || 0) <= 0) return null;
        return expiry + this._esAlaCd(es, Math.round(skill.recharge * 1000), expiry);
    }

    _getResultsCombatReferenceTime(results = this.sim?.results) {
        if (!results) return 0;
        const firstHitTime = results.log?.find(ev =>
            (ev.type === 'hit' && ev.strike > 0) || ev.type === 'cond_tick'
        )?.t ?? null;
        const explicitCombatStart = Number.isFinite(results.endState?.combatStartTime)
            ? results.endState.combatStartTime
            : (results.log?.find(ev => ev.type === 'combat_start')?.t ?? null);
        return firstHitTime ?? (results.endState?.hasExplicitCombatStart ? (explicitCombatStart ?? 0) : 0);
    }

    _formatRelativeSeconds(seconds, digits = 2) {
        const precision = 10 ** digits;
        const normalized = Math.abs(seconds) < (0.5 / precision) ? 0 : seconds;
        return `${normalized.toFixed(digits)}s`;
    }

    _formatResultsTimeMs(timeMs, digits = 2, results = this.sim?.results) {
        const refTime = this._getResultsCombatReferenceTime(results);
        return this._formatRelativeSeconds((timeMs - refTime) / 1000, digits);
    }

    _getDisplayedCooldownMs(es, readyAt, meta = null) {
        if (!es) return null;
        const t = es.time;
        const actualRemainingMs = readyAt - t;
        if (actualRemainingMs <= 0) return null;
        if (!meta || !Number.isFinite(meta.startedAt) || !Number.isFinite(meta.displayDurationMs)) {
            return actualRemainingMs;
        }

        const startedAt = meta.startedAt;
        const displayDurationMs = meta.displayDurationMs;
        const alaUntil = meta.alacrityUntil || 0;
        const elapsedMs = Math.max(0, t - startedAt);
        const alaElapsedMs = alaUntil > startedAt
            ? Math.max(0, Math.min(t, alaUntil) - startedAt)
            : 0;
        const displayElapsedMs = elapsedMs + (alaElapsedMs * 0.25);
        const displayRemainingMs = Math.max(0, displayDurationMs - displayElapsedMs);
        return displayRemainingMs > 0 ? displayRemainingMs : null;
    }

    _getSkillCD(skill) {
        const es = this.sim?.results?.endState;
        if (!es) return null;
        const t = es.time;
        const name = skill.name;

        // Attunement swap
        if (skill.type === 'Attunement' && !name.startsWith('Overload')) {
            const target = name.replace(' Attunement', '');
            const cdMs = this._getDisplayedCooldownMs(es, es.attCD[target] || 0, es.attCDMeta?.[target]);
            const cd = cdMs !== null ? (cdMs / 1000) : null;
            return cd > 0 ? cd : null;
        }

        // Overload: max of skill CD and dwell time requirement
        if (name.startsWith('Overload ')) {
            const skillCd = ((es.skillCD[name] || 0) - t) / 1000;
            const dwell = es._hasTranscendentTempest ? 4000 : 6000;
            const dwellEffMs = this._esAlaCd(es, dwell, es.attEnteredAt);
            const dwellCd = (es.attEnteredAt + dwellEffMs - t) / 1000;
            const cd = Math.max(skillCd, dwellCd);
            return cd > 0 ? cd : null;
        }
        if (skill.type === 'Dodge' || skill.slot === 'Dodge') {
            const activeTraits = this.data?.attributes?.activeTraits || [];
            const hasEvasiveArcana = activeTraits.some(trait => trait.name === 'Evasive Arcana');
            if (!hasEvasiveArcana) return null;

            const att = es.att || this.activeAttunement;
            const evasiveArcanaSkill = EVASIVE_ARCANA_SKILL_BY_ATTUNEMENT_UI[att];
            if (!evasiveArcanaSkill) return null;

            const icdKey = `EvasiveArcana:${evasiveArcanaSkill}`;
            const cd = ((es.traitICD?.[icdKey] || 0) - t) / 1000;
            return cd > 0 ? cd : null;
        }

        if (skill.type === 'Familiar' && EVOKER_FAMILIAR_INTERRUPT_WINDOWS_UI[skill.name]) {
            const lockout = es.evokerFamiliarLockouts?.[skill.name];
            if (lockout?.start !== undefined) {
                const remainingMs = (lockout.start + EVOKER_FAMILIAR_INTERRUPT_WINDOWS_UI[skill.name]) - t;
                const remaining = remainingMs / 1000;
                if (remaining > 0) return remaining;
            }
        }

        const cdKey = this._cdKey(skill);

        // Charge-based skills: show time until next charge only when fully depleted
        if (skill.maximumCount > 0 && skill.countRecharge > 0) {
            const charges = this._getChargeCount(skill);
            if (charges === null || charges > 0) return null;
            const ch = es.charges?.[cdKey];
            if (!ch || ch.nextChargeAt === Infinity) return null;
            const cd = (ch.nextChargeAt - t) / 1000;
            return cd > 0 ? cd : null;
        }

        // Regular skill
        if (name === 'Rock Barrier') {
            const pendingReadyAt = this._getPendingRockBarrierReadyAt(es);
            if (pendingReadyAt !== null) {
                const pendingCd = (pendingReadyAt - t) / 1000;
                if (pendingCd > 0) return pendingCd;
            }
        }
        const cd = ((es.skillCD[cdKey] || 0) - t) / 1000;
        const cdMs = this._getDisplayedCooldownMs(es, es.skillCD[cdKey] || 0, es.skillCDMeta?.[cdKey]);
        const displayCd = cdMs !== null ? (cdMs / 1000) : null;
        return displayCd > 0 ? displayCd : (cd > 0 ? cd : null);
    }

    _getChargeCount(sk) {
        if (!sk.maximumCount || sk.maximumCount <= 0 || !sk.countRecharge) return null;
        const es = this.sim?.results?.endState;
        if (!es) return sk.maximumCount;
        const cdKey = this._cdKey(sk);
        const ch = es.charges?.[cdKey];
        if (!ch) return sk.maximumCount;
        let count = ch.count;
        let nextAt = ch.nextChargeAt;
        const crMs = Math.round(sk.countRecharge * 1000);
        const t = es.time;
        while (count < sk.maximumCount && nextAt <= t) {
            count++;
            nextAt = count < sk.maximumCount ? nextAt + crMs : Infinity;
        }
        return count;
    }

    _palIcon(skill, available = true, opts = {}) {
        const icon = (skill.type === 'Dodge' || skill.slot === 'Dodge')
            ? DODGE_ICON
            : this.api.getSkillIcon(skill.name);
        const c = this._skillColor(skill, skill.name);
        const cls = available ? '' : ' pal-disabled';
        const charges = this._getChargeCount(skill);
        const ammoDisplay = ammoDisplayView(charges, skill.maximumCount);
        const ammoClasses = ammoDisplay
            ? ` pal-has-ammo${ammoDisplay.available ? ' pal-ammo-available' : ''}`
            : '';
        const chargeIndicator = ammoDisplay
            ? `<span class="pal-charges">${ammoDisplay.current}/${ammoDisplay.maximum}</span>
            <span class="pal-ammo-pips" aria-hidden="true">${ammoDisplay.pips.map(filled =>
                `<span class="pal-ammo-pip${filled ? ' filled' : ''}"></span>`
            ).join('')}</span>`
            : '';
        let cdSecs = this._getSkillCD(opts.cooldownSkill || skill);
        if (opts.cooldownSkill) {
            const ownCd = this._getSkillCD(skill);
            if (ownCd !== null) cdSecs = cdSecs !== null ? Math.max(cdSecs, ownCd) : ownCd;
        }
        const cdBadge = cdSecs !== null ? `<span class="pal-cd">${cdSecs.toFixed(1)}</span>` : '';
        const title = opts.title || skill.name;
        return `<div class="pal-skill${cls}${ammoClasses}" data-skill="${esc(skill.name)}" title="${esc(title)}"
            ${ammoDisplay ? `aria-label="${esc(`${skill.name}: ${ammoDisplay.label}`)}"` : ''}
            style="--att-border:${c}">
            <img src="${icon || PLACEHOLDER_ICON}" />${chargeIndicator}${cdBadge}</div>`;
    }

    _renderPalette() {
        renderPalette(this, {
            ATTUNEMENTS,
            ATTUNEMENT_COLORS,
            CATALYST_ENERGY_MAX,
            SLOT_LABELS,
            TH_WEAPONS,
            CONJURE_MAP,
            DROP_BUNDLE_ICON,
            DODGE_ICON,
            COMBAT_START_ICON,
            WAIT_ICON,
            ETCHING_CHAINS_UI,
            PISTOL_BULLET_ICONS,
            PISTOL_BULLET_LABELS,
        });
    }

    _renderTimeline() {
        renderTimeline(this, {
            ATTUNEMENT_COLORS,
            DROP_BUNDLE_ICON,
            DODGE_ICON,
            COMBAT_START_ICON,
            WAIT_ICON,
            CONJURE_MAP,
            TH_WEAPONS,
        });
    }

    _renderResults() {
        const el = document.getElementById('rotation-results');
        if (!this.sim?.results) { el.innerHTML = ''; return; }
        const r = this.sim.results;

        window._exportLogCSV = () => {
            if (!r?.log) return;
            const csv = this.sim.constructor.exportLogCSV(r.log);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'event_log.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
        const summary = resultSummaryMetrics({
            duration: r.rotationMs / 1000,
            deathTime: r.deathTime == null ? null : r.deathTime / 1000,
            totalDamage: r.totalDamage,
            dps: r.dps,
            strikeDamage: r.totalStrike,
            conditionDamage: r.totalCondition,
        });
        let h = `<div class="res-summary">${summary.map(metric => `
            <div class="res-stat">
                <span class="res-label">${metric.label}</span>
                <span class="res-val${metric.className ? ` ${metric.className}` : ''}">${metric.value}</span>
            </div>`).join('')}
        </div>`;

        if (this.benchmarkInfo) {
            const bi = this.benchmarkInfo;
            let benchHtml = '<div class="benchmark-info">';
            if (bi.benchmarkDps) {
                benchHtml += `<span class="benchmark-stat">In-game: <strong>${Number(bi.benchmarkDps).toLocaleString()}</strong> DPS</span>`;
            }
            if (bi.dpsReportUrl) {
                benchHtml += `<a class="benchmark-link" href="${esc(bi.dpsReportUrl)}" target="_blank" rel="noopener">dps.report log</a>`;
            }
            benchHtml += '</div>';
            h += benchHtml;
        }

        h += `<details class="res-log-wrap"><summary>Event Log (${r.log.length} events)</summary>`;
        h += `<button class="btn-csv-export" onclick="window._exportLogCSV()">Download CSV Log</button>`;
        h += `<div class="res-log">`;
        for (const ev of r.log) {
            const ts = this._formatResultsTimeMs(ev.t, 3, r);
            let desc = '', cls = '';
            const d = ev.diag || {};
            switch (ev.type) {
                case 'cast': desc = `CAST ${ev.skill} [${ev.att}] (${ev.dur}ms)`; break;
                case 'cast_end': desc = `END  ${ev.skill}`; break;
                case 'swap': desc = `SWAP ${ev.from} → ${ev.to}`; break;
                case 'hit': {
                    let detail = `HIT  ${ev.skill} #${ev.hit}.${ev.sub} → ${ev.strike} dmg (coeff ${ev.coeff?.toFixed(3) || 0})`;
                    if (ev.isField) detail += ' [field]';
                    if (ev.flatStrike) detail += ' [flat]';
                    if (ev.flatStrike && d.power) detail += ` | pwr:${d.power}`;
                    else if (d.power) detail += ` | pwr:${d.power} ws:${d.ws} cc:${d.critCh?.toFixed(1)}% cd:${d.critDmg?.toFixed(1)}% cMul:${d.critMul?.toFixed(3)} sMul:${d.strikeMul?.toFixed(3)}`;
                    desc = detail;
                    break;
                }
                case 'apply': desc = `EFFECT ${ev.effect} ×${ev.stacks}${ev.dur > 0 ? ` (${ev.dur}s)` : ''} [${ev.skill}]`; break;
                case 'cond_apply': {
                    let detail = `COND+ ${ev.cond} ×${ev.stacks} (${ev.durMs}ms) [${ev.skill}] total:${ev.total}`;
                    if (d.baseDurMs) detail += ` | base:${d.baseDurMs}ms +${d.bonusPct}%`;
                    desc = detail;
                    break;
                }
                case 'cond_tick': {
                    let detail = `TICK  ${ev.cond} ×${ev.stacks} → ${ev.total} dmg (${ev.perStack}/stack)`;
                    if (d.condMul) detail += ` | condDmg:${d.condDmg} base:${d.baseTick} mul:${d.condMul?.toFixed(3)} vuln:${d.vulnMul?.toFixed(2)}`;
                    desc = detail;
                    break;
                }
                case 'field': desc = `FIELD ${ev.field} (${ev.dur}ms) [${ev.skill}]`; break;
                case 'aura': desc = `AURA  ${ev.aura} (${ev.dur}ms) [${ev.skill}]`; break;
                case 'conjure': desc = `CONJURE ${ev.weapon} equipped (pickup expires ${this._formatResultsTimeMs(ev.pickupExpires, 1, r)})`; break;
                case 'jade_sphere': desc = `JADE SPHERE ${ev.att} (energy: ${ev.energy}, dur: ${ev.durMs}ms) [${ev.skill}]`; break;
                case 'familiar_select': desc = `FAMILIAR ${ev.element} selected [${ev.skill}]`; break;
                case 'familiar_basic': desc = `FAMILIAR ${ev.skill} used → charges:${ev.charges}/${ev.maxCharges} empowered:${ev.empowered}/3`; break;
                case 'familiar_empowered': desc = `FAMILIAR ${ev.skill} used → empowered:${ev.empowered}/3`; break;
                case 'evoker_charges': {
                    const sign = ev.amount > 0 ? '+' : '';
                    desc = `FAMILIAR charges ${sign}${ev.amount} → ${ev.charges}/${ev.maxCharges} [${ev.skill}]`;
                    break;
                }
                case 'skill_proc': desc = `PROC  ${ev.skill}${ev.detail ? ` (${ev.detail})` : ''}`; break;
                case 'skip': desc = `SKIP  ${ev.skill}${ev.reason ? ` (${ev.reason})` : ''}`; break;
                case 'drop': desc = `DROP ${ev.weapon}`; break;
                case 'pickup': desc = `PICKUP ${ev.weapon}`; break;
                case 'wait': desc = `WAIT ${ev.durMs}ms`; break;
                case 'sigil_proc': desc = `SIGIL ${ev.sigil} proc [${ev.skill}]`; cls = ' sigil'; break;
                case 'relic_proc': desc = `RELIC ${ev.relic} proc [${ev.skill}]`; cls = ' relic'; break;
                case 'trait_proc': desc = `TRAIT ${ev.trait} proc [${ev.skill}]`; cls = ' trait'; break;
                case 'err': desc = ev.msg; cls = ' err'; break;
                default: desc = JSON.stringify(ev);
            }
            h += `<div class="log-line"><span class="log-time">${ts}</span><span class="log-desc${cls}">${desc}</span></div>`;
        }
        h += '</div></details>';

        const dpsWindowSec = (r.dpsWindowMs ?? 0) / 1000;

        const stepIconMap = {};
        for (const s of (r.steps || [])) {
            if (s.icon && !stepIconMap[s.skill]) stepIconMap[s.skill] = s.icon;
        }
        const _lookupIcon = (name) => {
            return this.api.getSkillIcon(name)
                || this.api.getTraitIcon(name)
                || stepIconMap[name]
                || this.api.getSkillIcon(name.replace(/ (?:Proc|Bonus)$/, ''))
                || this.api.getTraitIcon(name.replace(/ (?:Proc|Bonus)$/, ''));
        };

        const SKILL_COLS = [
            { key: 'name', label: 'Skill', numeric: false },
            { key: 'strike', label: 'Strike', numeric: true },
            { key: 'condi', label: 'Condi', numeric: true },
            { key: 'total', label: 'Total', numeric: true },
            { key: 'dps', label: 'DPS', numeric: true },
            { key: 'avg', label: 'Avg/Cast', numeric: true },
            { key: 'dct', label: 'DCT', numeric: true },
            { key: 'delay', label: '1s Delay', numeric: true },
            { key: 'casts', label: 'Casts', numeric: true },
            { key: 'hits', label: 'Hits', numeric: true },
        ];

        const skillRows = Object.entries(r.perSkill)
            .map(([name, d]) => {
                const total = d.strike + d.condition;
                const skillDps = dpsWindowSec > 0 ? Math.round(total / dpsWindowSec) : 0;
                const avgPerCast = d.casts > 0 ? Math.round(total / d.casts) : 0;
                const castTimeSec = (d.castTimeMs || 0) / 1000;
                const dct = castTimeSec > 0 ? Math.round(total / castTimeSec) : null;
                const sk = this.sim._skill(name);
                const cd = sk?.recharge || 0;
                const delayCost = (avgPerCast > 0 && cd > 0) ? Math.round(avgPerCast / cd) : null;
                return {
                    name, icon: _lookupIcon(name),
                    strike: Math.round(d.strike), condi: Math.round(d.condition),
                    total: Math.round(total), dps: skillDps, avg: avgPerCast,
                    dct: dct ?? -Infinity, delay: delayCost ?? -Infinity,
                    casts: d.casts, hits: d.hits ?? 0,
                    _dctNull: dct === null, _delayNull: delayCost === null,
                };
            })
            .filter(row => row.total > 0);
        skillRows.sort((a, b) => b.total - a.total);

        const renderSkillRow = (row) =>
            `<div class="res-row">
                <span class="res-skill"><img src="${row.icon || PLACEHOLDER_ICON}" />${esc(row.name)}</span>
                <span>${row.strike.toLocaleString()}</span>
                <span class="condi">${row.condi.toLocaleString()}</span>
                <span class="total">${row.total.toLocaleString()}</span>
                <span class="dps">${row.dps.toLocaleString()}</span>
                <span>${row.avg.toLocaleString()}</span>
                <span>${!row._dctNull ? row.dct.toLocaleString() : '—'}</span>
                <span>${!row._delayNull ? row.delay.toLocaleString() : '—'}</span>
                <span>${row.casts}</span>
                <span>${row.hits}</span>
            </div>`;

        const sortIndicator = (col) => {
            if (!this._skillSortCol || this._skillSortCol !== col) return '';
            return this._skillSortDir === 'asc' ? ' ▲' : ' ▼';
        };

        h += `<div class="res-breakdown"><div class="res-hdr res-hdr-sortable">`;
        for (const col of SKILL_COLS) {
            h += `<span data-sort-col="${col.key}">${col.label}${sortIndicator(col.key)}</span>`;
        }
        h += `</div><div class="res-skill-rows">`;
        for (const row of skillRows) h += renderSkillRow(row);
        h += '</div></div>';

        this._skillBreakdownState = { skillRows, renderSkillRow, SKILL_COLS };

        // ── Per-condition damage breakdown ──
        const condEntries = Object.entries(r.condDamage || {})
            .map(([cond, dmg]) => ({ cond, dmg, avgStacks: (r.condAvgStacks || {})[cond] || 0 }))
            .filter(e => e.dmg > 0)
            .sort((a, b) => b.dmg - a.dmg);
        if (condEntries.length > 0) {
            const dws = (r.dpsWindowMs ?? 0) / 1000;
            let totalCondDmg = 0;
            for (const e of condEntries) totalCondDmg += e.dmg;
            h += `<div class="res-breakdown cond-breakdown"><div class="res-hdr cond-hdr">
                <span>Condition</span><span>Damage</span><span>DPS</span><span>Avg Stacks</span>
            </div>`;
            for (const e of condEntries) {
                const cdps = dws > 0 ? Math.round(e.dmg / dws) : 0;
                h += `<div class="res-row">
                    <span class="res-skill condi">${esc(e.cond)}</span>
                    <span class="condi">${Math.round(e.dmg).toLocaleString()}</span>
                    <span class="dps">${cdps.toLocaleString()}</span>
                    <span>${e.avgStacks.toFixed(2)}</span>
                </div>`;
            }
            const totalCondDps = dws > 0 ? Math.round(totalCondDmg / dws) : 0;
            h += `<div class="res-row res-total">
                <span class="res-skill"><b>Total Conditions</b></span>
                <span class="condi"><b>${Math.round(totalCondDmg).toLocaleString()}</b></span>
                <span class="dps"><b>${totalCondDps.toLocaleString()}</b></span>
                <span></span>
            </div>`;
            h += '</div>';
        }

        h += this._buildChartHtml(r);

        if (r.contributions && r.contributions.length > 0) {
            h += `<div class="res-contributions">
                <h4>Modifier Contributions</h4>
                <div class="contrib-table">
                    <div class="contrib-hdr"><span>Modifier</span><span>DPS Increase</span><span>% Increase</span></div>`;
            for (const c of r.contributions) {
                const sign = c.dpsIncrease >= 0 ? '+' : '';
                h += `<div class="contrib-row">
                    <span class="contrib-name">${esc(c.name)}</span>
                    <span class="contrib-val">${sign}${Math.round(c.dpsIncrease).toLocaleString()}</span>
                    <span class="contrib-pct">${sign}${c.pctIncrease.toFixed(2)}%</span>
                </div>`;
            }
            h += `</div></div>`;
        }

        el.innerHTML = h;

        this._bindChartToggles();
        this._bindSkillBreakdownSort(el);
    }

    _bindSkillBreakdownSort(el) {
        const hdr = el.querySelector('.res-hdr-sortable');
        if (!hdr) return;
        hdr.querySelectorAll('span[data-sort-col]').forEach(span => {
            span.addEventListener('click', () => {
                const col = span.dataset.sortCol;
                const next = nextResultSortState(
                    this._skillSortCol,
                    this._skillSortDir,
                    col,
                );
                this._skillSortCol = next.column;
                this._skillSortDir = next.direction;
                this._applySkillBreakdownSort(el);
            });
        });
    }

    _applySkillBreakdownSort(el) {
        const st = this._skillBreakdownState;
        if (!st) return;
        const { skillRows, renderSkillRow, SKILL_COLS } = st;

        const col = this._skillSortCol;
        const dir = this._skillSortDir;
        const sorted = sortResultRows(skillRows, SKILL_COLS, col, dir);

        const rowsEl = el.querySelector('.res-skill-rows');
        if (rowsEl) rowsEl.innerHTML = sorted.map(renderSkillRow).join('');

        const hdr = el.querySelector('.res-hdr-sortable');
        if (hdr) {
            hdr.querySelectorAll('span[data-sort-col]').forEach(span => {
                const key = span.dataset.sortCol;
                const colDef = SKILL_COLS.find(c => c.key === key);
                const indicator = (col === key && dir) ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
                span.textContent = colDef.label + indicator;
            });
        }
    }

    // ─── Chart ───
    _buildChartHtml(r) {
        const allEffects = [...new Set((r.allCondStacks || []).map(s => s.cond))];
        const intensityEffects = allEffects.filter(e => INTENSITY_EFFECTS.has(e));
        const durationEffects = allEffects.filter(e => !INTENSITY_EFFECTS.has(e));

        let h = '<div class="chart-wrap"><div class="chart-title">DPS &amp; Effects Over Time</div>';
        h += '<div class="chart-toggles">';
        h += `<label><input type="checkbox" data-series="dps" checked /><span class="swatch" style="background:#44bb44"></span> DPS</label>`;
        for (const ct of intensityEffects) {
            const col = EFFECT_COLORS[ct] || '#aaa';
            h += `<label><input type="checkbox" data-series="${esc(ct)}" checked /><span class="swatch" style="background:${col}"></span> ${ct}</label>`;
        }
        for (const ct of durationEffects) {
            const col = EFFECT_COLORS[ct] || '#aaa';
            h += `<label><input type="checkbox" data-series="${esc(ct)}" /><span class="swatch" style="background:${col}"></span> ${ct}</label>`;
        }
        h += '</div><div class="chart-panels">';
        h += '<div class="chart-panel">';
        h += '<div class="chart-panel-title">DPS</div>';
        h += '<div class="chart-canvas-wrap"><canvas id="rotation-chart"></canvas><div class="chart-tooltip" id="rotation-chart-tooltip"></div></div>';
        h += '</div>';
        h += '<div class="chart-panel">';
        h += '<div class="chart-panel-title">Effects</div>';
        h += '<div class="chart-canvas-wrap"><canvas id="rotation-effects-chart"></canvas><div class="chart-tooltip" id="rotation-effects-tooltip"></div></div>';
        h += '</div>';
        h += '</div></div>';
        return h;
    }

    _bindChartToggles() {
        const wrap = document.querySelector('.chart-toggles');
        if (!wrap) return;
        if (!wrap.dataset.bound) {
            wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', () => this._drawChart());
            });
            wrap.dataset.bound = '1';
        }
        this._bindChartHover();
        this._drawChart();
    }

    _getNiceAxisStep(maxValue, targetTicks = 6) {
        if (!(maxValue > 0)) return 1;
        const roughStep = maxValue / Math.max(1, targetTicks - 1);
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const normalized = roughStep / magnitude;
        const stepBase = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
        return stepBase * magnitude;
    }

    _getTimeTickStep(maxTimeMs) {
        const maxSec = Math.max(1, Math.ceil(maxTimeMs / 1000));
        if (maxSec <= 10) return 1;
        if (maxSec <= 20) return 2;
        if (maxSec <= 60) return 5;
        if (maxSec <= 120) return 10;
        return 20;
    }

    _showChartTooltip(tooltip, html, x, y) {
        if (!tooltip) return;
        tooltip.innerHTML = html;
        tooltip.style.left = `${x + 12}px`;
        tooltip.style.top = `${y + 12}px`;
        tooltip.style.display = 'block';
    }

    _hideChartTooltip(tooltip) {
        if (!tooltip) return;
        tooltip.style.display = 'none';
    }

    _bindChartHover() {
        const bind = (canvasId, tooltipId, kind) => {
            const canvas = document.getElementById(canvasId);
            const tooltip = document.getElementById(tooltipId);
            if (!canvas || !tooltip || canvas.dataset.hoverBound) return;

            canvas.addEventListener('mouseleave', () => this._hideChartTooltip(tooltip));
            canvas.addEventListener('mousemove', ev => {
                const state = this._chartState;
                if (!state) return;
                const layout = kind === 'dps' ? state.dpsLayout : state.effectsLayout;
                if (!layout) return;

                const rect = canvas.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const y = ev.clientY - rect.top;
                const minX = layout.pad.left;
                const maxX = layout.cssW - layout.pad.right;
                const minY = layout.pad.top;
                const maxY = kind === 'dps'
                    ? layout.pad.top + layout.plotH
                    : layout.pad.top + layout.totalPlotH;

                if (x < minX || x > maxX || y < minY || y > maxY) {
                    this._hideChartTooltip(tooltip);
                    return;
                }

                const t = Math.max(0, Math.min(state.maxTime, ((x - minX) / layout.pw) * state.maxTime));
                const timeLabel = this._formatRelativeSeconds((t - (state.displayTimeOrigin || 0)) / 1000, 2);

                if (kind === 'dps') {
                    const dps = Math.round(chartValueAt(state.dpsLine, t));
                    this._showChartTooltip(
                        tooltip,
                        `<div><b>${timeLabel}</b></div><div>DPS: ${dps.toLocaleString()}</div>`,
                        x,
                        y
                    );
                    return;
                }

                if (y <= layout.intensityBottom) {
                    const entries = [];
                    for (const [name, line] of Object.entries(state.effectLines)) {
                        if (!state.toggles[name]) continue;
                        const value = Math.round(chartValueAt(line, t));
                        if (value > 0) entries.push(`<div>${esc(name)}: ${value}</div>`);
                    }
                    const body = entries.length > 0 ? entries.join('') : '<div>No visible stack effects</div>';
                    this._showChartTooltip(tooltip, `<div><b>${timeLabel}</b></div>${body}`, x, y);
                    return;
                }

                const rowY = y - layout.durationTop;
                const rowIndex = Math.floor(rowY / layout.rowStride);
                const effect = state.activeDurEffects[rowIndex];
                if (!effect) {
                    this._hideChartTooltip(tooltip);
                    return;
                }
                const active = state.durationStacksByName[effect]?.some(s => s.t <= t && s.expiresAt > t);
                this._showChartTooltip(
                    tooltip,
                    `<div><b>${timeLabel}</b></div><div>${esc(effect)}: ${active ? 'active' : 'inactive'}</div>`,
                    x,
                    y
                );
            });

            canvas.dataset.hoverBound = '1';
        };

        bind('rotation-chart', 'rotation-chart-tooltip', 'dps');
        bind('rotation-effects-chart', 'rotation-effects-tooltip', 'effects');
    }

    _drawChart() {
        const r = this.sim.results;
        const dpsStart = this._getResultsCombatReferenceTime(r);

        const dpsCanvas = document.getElementById('rotation-chart');
        const effectsCanvas = document.getElementById('rotation-effects-chart');
        if (!dpsCanvas || !effectsCanvas || !this.sim?.results) return;
        // Cap the chart at kill time when the target died before the rotation ended,
        // so the DPS line doesn't slope downward through the post-death idle window.
        const maxTime = (r.deathTime !== null && r.deathTime !== undefined && r.deathTime < r.rotationMs)
            ? r.deathTime
            : r.rotationMs;
        if (maxTime <= 0) return;

        const allStacks = r.allCondStacks || [];
        const allEffects = [...new Set(allStacks.map(s => s.cond))];

        const toggles = {};
        document.querySelectorAll('.chart-toggles input').forEach(cb => {
            toggles[cb.dataset.series] = cb.checked;
        });

        const activeDurEffects = allEffects.filter(e => !INTENSITY_EFFECTS.has(e) && toggles[e]);
        const barRowH = 8;
        const barGap = 1;
        const durationStacksByName = Object.fromEntries(activeDurEffects.map(name => [
            name,
            allStacks.filter(s => s.cond === name),
        ]));

        const dpsWrap = dpsCanvas.parentElement;
        const effectsWrap = effectsCanvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        const dpsCssW = dpsWrap.clientWidth;
        const effectsCssW = effectsWrap.clientWidth;
        const dpsCssH = 320;
        const effectsPad = { top: 20, right: 16, bottom: 30, left: 120 };
        const effectPlotH = 150;
        const durationZoneH = activeDurEffects.length > 0
            ? activeDurEffects.length * (barRowH + barGap) + 16
            : 0;
        const effectsCssH = effectPlotH + effectsPad.top + effectsPad.bottom + durationZoneH;

        dpsCanvas.width = dpsCssW * dpr;
        dpsCanvas.height = dpsCssH * dpr;
        dpsCanvas.style.height = dpsCssH + 'px';
        effectsCanvas.width = effectsCssW * dpr;
        effectsCanvas.height = effectsCssH * dpr;
        effectsCanvas.style.height = effectsCssH + 'px';

        const dpsCtx = dpsCanvas.getContext('2d');
        const effectsCtx = effectsCanvas.getContext('2d');
        dpsCtx.scale(dpr, dpr);
        effectsCtx.scale(dpr, dpr);

        const dpsPad = { top: 20, right: 16, bottom: 30, left: 70 };
        const dpsPw = dpsCssW - dpsPad.left - dpsPad.right;
        const dpsPh = dpsCssH - dpsPad.top - dpsPad.bottom;
        const effectsPw = effectsCssW - effectsPad.left - effectsPad.right;

        const dmgEvents = [];
        for (const ev of r.log) {
            if (ev.t < dpsStart) continue;
            if (ev.type === 'hit' && ev.strike > 0) dmgEvents.push({ t: ev.t, d: ev.strike });
            if (ev.type === 'cond_tick') dmgEvents.push({ t: ev.t, d: ev.total });
        }
        dmgEvents.sort((a, b) => a.t - b.t);

        const interval = Math.max(50, Math.round(maxTime / 500));
        const n = Math.ceil(maxTime / interval) + 1;
        const dpsSampleStepMs = 500;
        const dpsLine = [{ t: 0, v: 0 }];
        if (dpsStart > 0) dpsLine.push({ t: dpsStart, v: 0 });

        let cum = 0;
        let ei = 0;
        const fullSamples = Math.floor(Math.max(0, maxTime - dpsStart) / dpsSampleStepMs);
        for (let sampleIndex = 1; sampleIndex <= fullSamples; sampleIndex++) {
            const t = dpsStart + sampleIndex * dpsSampleStepMs;
            while (ei < dmgEvents.length && dmgEvents[ei].t <= t) {
                cum += dmgEvents[ei].d;
                ei++;
            }
            dpsLine.push({ t, v: cum / (sampleIndex * (dpsSampleStepMs / 1000)) });
        }

        if (maxTime > dpsStart) {
            while (ei < dmgEvents.length && dmgEvents[ei].t <= maxTime) {
                cum += dmgEvents[ei].d;
                ei++;
            }
            const elapsedSeconds = Math.max(dpsSampleStepMs / 1000, (maxTime - dpsStart) / 1000);
            const lastValue = fullSamples > 0
                ? dpsLine[dpsLine.length - 1].v
                : (cum / elapsedSeconds);
            if (dpsLine[dpsLine.length - 1].t < maxTime) {
                dpsLine.push({ t: maxTime, v: lastValue });
            }
        }

        const STACK_CAPS = {
            Might: 25, Stability: 25, Vulnerability: 25,
            'Elemental Empowerment': 10, 'Empowering Auras': 5, 'Persisting Flames': 5,
            Thorns: 10,
        };
        const effectLines = {};
        let maxStacks = 0;
        for (const ct of allEffects) {
            if (!toggles[ct] || !INTENSITY_EFFECTS.has(ct)) continue;
            const stacks = allStacks.filter(s => s.cond === ct);
            const cap = STACK_CAPS[ct] || Infinity;
            const line = [];
            for (let i = 0; i < n; i++) {
                const t = i * interval;
                let cnt = 0;
                for (const s of stacks) { if (s.t <= t && s.expiresAt > t) cnt++; }
                cnt = Math.min(cnt, cap);
                line.push({ t, v: cnt });
                if (cnt > maxStacks) maxStacks = cnt;
            }
            effectLines[ct] = line;
        }

        const xTickStepSec = this._getTimeTickStep(maxTime);
        const maxDpsValue = Math.max(...dpsLine.map(d => d.v), 1);
        const dpsStep = this._getNiceAxisStep(maxDpsValue, 6);
        const maxDps = Math.max(dpsStep, Math.ceil(maxDpsValue / dpsStep) * dpsStep);

        dpsCtx.clearRect(0, 0, dpsCssW, dpsCssH);
        dpsCtx.fillStyle = '#0c0c14';
        dpsCtx.fillRect(0, 0, dpsCssW, dpsCssH);
        dpsCtx.strokeStyle = 'rgba(42,42,58,0.5)';
        dpsCtx.lineWidth = 1;
        for (let value = 0; value <= maxDps; value += dpsStep) {
            const y = dpsPad.top + dpsPh - (dpsPh / maxDps) * value;
            dpsCtx.beginPath(); dpsCtx.moveTo(dpsPad.left, y); dpsCtx.lineTo(dpsCssW - dpsPad.right, y); dpsCtx.stroke();
            dpsCtx.fillStyle = '#888899'; dpsCtx.font = '10px Segoe UI'; dpsCtx.textAlign = 'right';
            dpsCtx.fillText(value.toLocaleString(), dpsPad.left - 6, y + 3);
        }
        for (let sec = 0; sec <= Math.ceil(maxTime / 1000); sec += xTickStepSec) {
            const t = sec * 1000;
            const x = dpsPad.left + (dpsPw / maxTime) * Math.min(t, maxTime);
            dpsCtx.beginPath(); dpsCtx.moveTo(x, dpsPad.top); dpsCtx.lineTo(x, dpsPad.top + dpsPh);
            dpsCtx.strokeStyle = 'rgba(42,42,58,0.35)'; dpsCtx.stroke();
            dpsCtx.fillStyle = '#888899'; dpsCtx.textAlign = 'center'; dpsCtx.font = '10px Segoe UI';
            dpsCtx.fillText(this._formatRelativeSeconds((t - dpsStart) / 1000, 0), x, dpsPad.top + dpsPh + 16);
        }
        if (toggles['dps'] !== false) {
            dpsCtx.strokeStyle = '#44bb44'; dpsCtx.lineWidth = 2.5; dpsCtx.beginPath();
            for (let i = 0; i < dpsLine.length; i++) {
                const x = dpsPad.left + (dpsPw / maxTime) * dpsLine[i].t;
                const y = dpsPad.top + dpsPh - (dpsPh / maxDps) * dpsLine[i].v;
                if (i === 0) dpsCtx.moveTo(x, y); else dpsCtx.lineTo(x, y);
            }
            dpsCtx.stroke();
        }
        dpsCtx.fillStyle = '#888899';
        dpsCtx.font = 'bold 10px Segoe UI';
        dpsCtx.textAlign = 'left';
        dpsCtx.fillText('DPS ▲', dpsPad.left + 2, dpsPad.top - 6);

        const LABEL_EFFECTS = new Set(['Elemental Empowerment', 'Empowering Auras', 'Persisting Flames', 'Thorns']);
        effectsCtx.clearRect(0, 0, effectsCssW, effectsCssH);
        effectsCtx.fillStyle = '#0c0c14';
        effectsCtx.fillRect(0, 0, effectsCssW, effectsCssH);
        const intensityTop = effectsPad.top;
        const intensityBottom = effectsPad.top + effectPlotH;
        const durationTop = intensityBottom + 16;
        const stackAxisStep = maxStacks > 0 ? Math.max(1, Math.round(this._getNiceAxisStep(maxStacks, 6))) : 1;
        const stackAxisMax = maxStacks > 0
            ? Math.max(stackAxisStep, Math.ceil(maxStacks / stackAxisStep) * stackAxisStep)
            : 1;

        if (maxStacks > 0) {
            for (let value = 0; value <= stackAxisMax; value += stackAxisStep) {
                const y = intensityTop + effectPlotH - (effectPlotH / stackAxisMax) * value;
                effectsCtx.beginPath();
                effectsCtx.moveTo(effectsPad.left, y);
                effectsCtx.lineTo(effectsCssW - effectsPad.right, y);
                effectsCtx.strokeStyle = 'rgba(42,42,58,0.35)';
                effectsCtx.stroke();
                effectsCtx.fillStyle = '#888899';
                effectsCtx.font = '10px Segoe UI';
                effectsCtx.textAlign = 'right';
                effectsCtx.fillText(value.toString(), effectsPad.left - 6, y + 3);
            }
        }
        for (let sec = 0; sec <= Math.ceil(maxTime / 1000); sec += xTickStepSec) {
            const t = sec * 1000;
            const x = effectsPad.left + (effectsPw / maxTime) * Math.min(t, maxTime);
            effectsCtx.beginPath();
            effectsCtx.moveTo(x, effectsPad.top);
            effectsCtx.lineTo(x, effectsCssH - effectsPad.bottom);
            effectsCtx.strokeStyle = 'rgba(42,42,58,0.35)';
            effectsCtx.stroke();
            effectsCtx.fillStyle = '#888899';
            effectsCtx.textAlign = 'center';
            effectsCtx.font = '10px Segoe UI';
            effectsCtx.fillText(this._formatRelativeSeconds((t - dpsStart) / 1000, 0), x, effectsCssH - 8);
        }

        for (const ct of allEffects) {
            if (!effectLines[ct]) continue;
            const col = EFFECT_COLORS[ct] || '#aaa';
            const line = effectLines[ct];
            effectsCtx.strokeStyle = col; effectsCtx.lineWidth = 1.5; effectsCtx.setLineDash([4, 3]); effectsCtx.beginPath();
            for (let i = 0; i < line.length; i++) {
                const x = effectsPad.left + (effectsPw / maxTime) * line[i].t;
                const y = intensityTop + effectPlotH - (effectPlotH / stackAxisMax) * line[i].v;
                if (i === 0) effectsCtx.moveTo(x, y); else effectsCtx.lineTo(x, y);
            }
            effectsCtx.stroke(); effectsCtx.setLineDash([]);

            if (LABEL_EFFECTS.has(ct)) {
                effectsCtx.font = 'bold 9px Segoe UI';
                effectsCtx.textAlign = 'center';
                let prevVal = -1;
                for (let i = 0; i < line.length; i++) {
                    const v = line[i].v;
                    if (v === prevVal || v === 0) { prevVal = v; continue; }
                    const x = effectsPad.left + (effectsPw / maxTime) * line[i].t;
                    const y = intensityTop + effectPlotH - (effectPlotH / stackAxisMax) * v;
                    effectsCtx.fillStyle = '#0c0c14';
                    effectsCtx.fillRect(x - 6, y - 10, 12, 11);
                    effectsCtx.fillStyle = col;
                    effectsCtx.fillText(v.toString(), x, y - 1);
                    prevVal = v;
                }
            }
        }

        if (activeDurEffects.length > 0) {
            for (let di = 0; di < activeDurEffects.length; di++) {
                const ct = activeDurEffects[di];
                const col = EFFECT_COLORS[ct] || '#aaa';
                const stacks = durationStacksByName[ct] || [];
                const rowY = durationTop + di * (barRowH + barGap);

                effectsCtx.fillStyle = '#888899'; effectsCtx.font = '9px Segoe UI'; effectsCtx.textAlign = 'right';
                effectsCtx.fillText(ct, effectsPad.left - 6, rowY + barRowH - 1);

                for (let i = 0; i < n - 1; i++) {
                    const t = i * interval;
                    let active = false;
                    for (const s of stacks) { if (s.t <= t && s.expiresAt > t) { active = true; break; } }
                    if (!active) continue;
                    const x0 = effectsPad.left + (effectsPw / maxTime) * t;
                    const x1 = effectsPad.left + (effectsPw / maxTime) * Math.min((i + 1) * interval, maxTime);
                    effectsCtx.fillStyle = col;
                    effectsCtx.globalAlpha = 0.75;
                    effectsCtx.fillRect(x0, rowY, x1 - x0 + 0.5, barRowH);
                    effectsCtx.globalAlpha = 1;
                }
            }
        }

        effectsCtx.fillStyle = '#888899';
        effectsCtx.font = 'bold 10px Segoe UI';
        effectsCtx.textAlign = 'left';
        effectsCtx.fillText('Stacks ▲', effectsPad.left + 2, effectsPad.top - 6);

        this._chartState = {
            maxTime,
            displayTimeOrigin: dpsStart,
            dpsLine,
            effectLines,
            activeDurEffects,
            durationStacksByName,
            toggles,
            dpsLayout: {
                cssW: dpsCssW,
                pad: dpsPad,
                pw: dpsPw,
                plotH: dpsPh,
            },
            effectsLayout: {
                cssW: effectsCssW,
                pad: effectsPad,
                pw: effectsPw,
                totalPlotH: effectPlotH + durationZoneH,
                intensityBottom,
                durationTop,
                rowStride: barRowH + barGap,
            },
        };
    }

    // ─── Rotation actions ───
    _getTargetHP() {
        const el = document.getElementById('target-hp');
        return el ? Math.max(0, parseInt(el.value) || 0) : 0;
    }

    _autoRun() {
        autoRun(this);
    }

    _getStartPistolBullets() {
        return this._presetPistolBullets ? { ...this._presetPistolBullets } : null;
    }

    _addToRotation(skillName, options = {}) {
        addToRotation(this, skillName, options);
    }

    _insertIntoRotation(idx, skillName, options = {}) {
        insertIntoRotation(this, idx, skillName, options);
    }

    _moveRotationItem(fromIdx, toIdx) {
        moveRotationItem(this, fromIdx, toIdx);
    }

    _removeFromRotation(idx) {
        removeFromRotation(this, idx);
    }

    _truncateRotationAfter(idx) {
        truncateRotationAfter(this, idx);
    }

    _clearRotation() {
        clearRotation(this);
    }

    // ─── Build persistence ───────────────────────────────────────────────────────

    _buildSnapshot() {
        return buildSnapshot(this);
    }

    _serializeRotation() {
        return serializeRotation(this);
    }

    _deserializeRotation(items) {
        deserializeRotation(this, items);
    }

    _applySnapshot(state) {
        applySnapshot(this, state);
    }

    _persistBuild() {
        persistBuild(this);
    }

    _restoreBuild() {
        restoreBuild(this);
    }

    _exportBuild() {
        const snapshot = this._buildSnapshot();
        delete snapshot.rotation;
        downloadJson('gw2-build.json', snapshot);
    }

    _refreshAfterBuildStateChange() {
        refreshAfterBuildStateChange(this);
    }

    _applyLoadedBuildState(state, rotationItems = undefined) {
        applyLoadedBuildState(this, state, rotationItems);
    }

    // ─── Presets ─────────────────────────────────────────────────────────────

    async _loadPresets() {
        try {
            const manifest = await fetchJsonAsset('Builds/manifest.json', { optional: true });
            if (!Array.isArray(manifest) || manifest.length === 0) return;

            // Support both the old flat-array format and the new sectioned format.
            // Flat array: each entry is a preset object ({ label, build, rotation? }).
            // Sectioned: each entry is { section, presets: [...] }.
            const isSectioned = manifest[0]?.presets !== undefined;
            const sections = isSectioned
                ? manifest
                : [{ section: null, presets: manifest }];

            // Build a flat list for indexed click handling.
            const allPresets = [];

            const container = document.getElementById('presets-groups');
            container.innerHTML = sections.map(sec => {
                const btns = (sec.presets || []).map(p => {
                    const idx = allPresets.length;
                    allPresets.push(p);
                    const cls = p.upToDate ? 'btn preset-btn preset-btn--current' : 'btn preset-btn';
                    return `<button class="${cls}" data-idx="${idx}">${esc(p.label)}</button>`;
                }).join('');

                const labelHtml = sec.section
                    ? `<span class="presets-group-label">${esc(sec.section)}</span>`
                    : '';
                return `<div class="presets-group">${labelHtml}<div class="presets-group-btns">${btns}</div></div>`;
            }).join('');

            container.addEventListener('click', e => {
                const btn = e.target.closest('.preset-btn');
                if (!btn) return;
                this._loadPreset(allPresets[+btn.dataset.idx], btn);
            });

            const legend = document.createElement('div');
            legend.className = 'presets-legend';
            legend.innerHTML =
                '<span class="presets-legend-item"><span class="presets-legend-swatch presets-legend-swatch--default"></span>Outdated</span>' +
                '<span class="presets-legend-item"><span class="presets-legend-swatch presets-legend-swatch--current"></span>Up to date</span>';
            container.after(legend);

            document.getElementById('presets-bar').style.display = '';
        } catch (_) { /* silently skip if no manifest */ }
    }

    async _loadPreset(preset, btn) {
        if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
        try {
            const { buildData, rotationItems } = await loadPresetBundle(preset);
            this.benchmarkInfo = (preset.dpsReportUrl || preset.benchmarkDps)
                ? { dpsReportUrl: preset.dpsReportUrl || null, benchmarkDps: preset.benchmarkDps || null }
                : null;
            this._applyLoadedBuildState(buildData, rotationItems);
        } catch (err) {
            alert('Failed to load preset: ' + err.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = preset.label; }
        }
    }

    async _importBuild(file) {
        try {
            const state = await readJsonFile(file);
            this.benchmarkInfo = null;
            this._applyLoadedBuildState(state);
        } catch (err) {
            alert('Failed to load build file: ' + err.message);
        }
    }

    _exportRotation() {
        downloadJson('gw2-rotation.json', { rotation: this._serializeRotation() });
    }

    async _importRotation(file) {
        try {
            const parsed = await readJsonFile(file);
            const items = getRotationItems(parsed);
            if (!Array.isArray(items)) throw new Error('No rotation array found in file.');
            this._deserializeRotation(items);
            this._autoRun();
            this.render();
        } catch (err) {
            alert('Failed to load rotation file: ' + err.message);
        }
    }

    // ─── dps.report import ────────────────────────────────────────────────────

    _dpsReportStatus(msg, isError = false) {
        const el = document.getElementById('dpsreport-status');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? 'var(--condi)' : 'var(--text-dim)';
    }

    async _importFromDpsReport() {
        const url = document.getElementById('dpsreport-url').value.trim();
        if (!url) return;

        const logId = extractLogId(url);
        if (!logId) {
            this._dpsReportStatus('Invalid dps.report URL.', true);
            return;
        }

        const btn = document.getElementById('btn-dpsreport-import');
        btn.disabled = true;
        this._dpsReportStatus('Fetching log…');

        try {
            this._eiJson = await fetchEIJson(logId);
            const players = findElementalistPlayers(this._eiJson);

            if (players.length === 0) {
                this._dpsReportStatus('No Elementalist player found in this log.', true);
                return;
            }

            const sel = document.getElementById('dpsreport-player-select');
            if (players.length === 1) {
                sel.style.display = 'none';
                this._eiPlayerIndex = 0;
            } else {
                sel.innerHTML = players.map((p, i) =>
                    `<option value="${i}">${p.name} (${p.profession})</option>`
                ).join('');
                sel.value = '0';
                sel.style.display = '';
                this._eiPlayerIndex = 0;
            }

            this._runDpsReportConversion();
        } catch (err) {
            this._dpsReportStatus(err.message, true);
        } finally {
            btn.disabled = false;
        }
    }

    _runDpsReportConversion() {
        if (!this._eiJson) return;
        const sel = document.getElementById('dpsreport-player-select');
        const playerIdx = parseInt(sel.value || '0', 10);
        const players = findElementalistPlayers(this._eiJson);
        const player = players[playerIdx];
        if (!player) return;

        const toolSkillNames = new Set(this.data.skills.map(s => s.name));
        const skillAttunements = new Map(this.data.skills.map(s => [s.name, s.attunement || '']));
        const weapons = this.build?.weapons || [];
        const items = convertEIRotation(this._eiJson, player, toolSkillNames, skillAttunements, weapons);

        const waits = items.filter(i => i?.name === '__wait').length;
        const total = items.length;

        appendToRotation(this, items);
        this._autoRun();
        this.render();

        const waitsNote = waits > 0 ? ` (${waits} unknown skill${waits > 1 ? 's' : ''} → __wait)` : '';
        this._dpsReportStatus(`Appended ${total} steps from "${player.name}"${waitsNote}.`);
    }

    // ─── Gear Optimizer ──────────────────────────────────────────────────────

    _initOptimizer() {
        initOptimizer(this);
    }

    _updateOptimizerVisibility(show) {
        updateOptimizerVisibility(this, show);
    }

    _populateOptimizerCheckboxes() {
        populateOptimizerCheckboxes(this, {
            foodDesc: _foodDesc,
            utilityDesc: _utilityDesc,
        });
    }

    _populateSlotConstraints() {
        populateSlotConstraints(this);
    }

    _readSlotConstraints() {
        return readSlotConstraints();
    }

    _getActiveSlots() {
        return getActiveSlots(this);
    }

    _bindOptimizerEvents() {
        bindOptimizerEvents(this);
    }

    _enforcePrefixMax() {
        enforcePrefixMax();
    }

    _getChecked(containerId) {
        return getOptimizerChecked(containerId);
    }

    // C(total + k - 1, k - 1) — number of ways to distribute `total` among `k` bins.
    _infusionComboCount(k, total) {
        return infusionComboCount(k, total);
    }

    async _runOptimizer() {
        await runOptimizer(this);
    }

    _renderOptimizerResults(results) {
        renderOptimizerResults(this, results);
    }

    _applyOptimizerResult(r) {
        applyOptimizerResult(this, r);
    }

    _exportOptimizerResults() {
        exportOptimizerResults(this);
    }

}

window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
