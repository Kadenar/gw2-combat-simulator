// Main application controller for the Mesmer simulator
// Manages UI state, coordinates rendering, handles user interactions, orchestrates simulation pipeline

import {
    FOOD_GROUPS,
    GEAR_SLOTS,
    INFUSION_STATS,
    PREFIXES,
    RELIC_NAMES,
    RUNE_GROUPS,
    SIGIL_NAMES,
    UTILITY_NAMES,
    WEAPON_DATA,
} from '../data/gear-data.js';
import { SPECIALIZATIONS } from '../data/mesmer-catalog.js';
import { setWeaponSigil } from '../core/weapon-sigils.js';
import { activeProfession } from './composition.js';
import { createDefaultBuild, loadBuild, replaceBuild, saveBuild } from './app-state.js';
import { downloadJson, readJsonFile } from './app-io.js';
import {
    calculateModifierContributions,
    eliteSpecialization,
    modifierContributionRequest,
    recalculate,
    runSimulation,
} from './app-runtime.js';
import { renderResults, renderRotationBuilder } from './app-rotation-ui.js';

// HTML escape function to prevent XSS attacks in dynamically generated HTML
const esc = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const option = (value, selected, label = value, disabled = false) =>
    `<option value="${esc(value)}"${value === selected ? ' selected' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</option>`;

// Wiki specialization banners are exactly 647×136 px — matching the trait panel width,
// so they frame edge-to-edge with no vertical crop. The generated catalog ships the raw
// API backgrounds (1024×256), which get center-cropped to an inconsistent zoomed band.
// Special:FilePath redirects to the actual file regardless of internal hash paths.
const SPEC_BG = name => `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(name)}_specialization.png`;

// Helper to generate grouped select options (for runes, food, etc.)
const groupedOptions = (groups, selected) => groups.map(group =>
    `<optgroup label="${esc(group.label)}">${group.items.map(item => option(item, selected)).join('')}</optgroup>`
).join('');

const PERMANENT_BOONS = [
    ['fury', 'Fury'],
    ['quickness', 'Quickness'],
    ['alacrity', 'Alacrity'],
    ['regeneration', 'Regeneration'],
    ['vigor', 'Vigor'],
];
const PERMANENT_TARGET_CONDITIONS = [
    'Vulnerability', 'Weakness', 'Blindness', 'Slow',
    'Chilled', 'Cripple', 'Immobilize',
    'Burning', 'Bleeding', 'Torment', 'Confusion', 'Poisoned',
];
const STACKING_TARGET_CONDITIONS = new Set([
    'Vulnerability', 'Bleeding', 'Torment', 'Confusion',
]);
const EFFECT_COLORS = {
    Might: '#d9a441',
    Fury: '#d65e5e',
    Quickness: '#67c8d4',
    Alacrity: '#9069d8',
    Regeneration: '#5ebc72',
    Vigor: '#78bd45',
    Vulnerability: '#d67575',
    Weakness: '#9a8f62',
    Blindness: '#727272',
    Slow: '#765bab',
    Chilled: '#69a8d7',
    Cripple: '#a66e73',
    Immobilize: '#8d5c38',
    Burning: '#ed6b38',
    Bleeding: '#c84848',
    Torment: '#8f62c2',
    Confusion: '#b65db0',
    Poisoned: '#70a33e',
};

// Main application controller class
// Maintains UI state, coordinates between UI and simulation engine
class MesmerApp {
    // Constructor initializes build from storage, loads all skills, sets up data references
    constructor() {
        this.build = loadBuild();
        this.profession = activeProfession;
        this.skills = [...this.profession.catalog.skills];
        this.skillByName = this.profession.catalog.skillsByName;
        this.skillById = this.profession.catalog.skillsById;
        this.weaponData = Object.fromEntries(
            [...this.profession.catalog.weapons]
                .filter(name => WEAPON_DATA[name])
                .map(name => [name, WEAPON_DATA[name]]),
        );
        this.resourceDefinition = specialization =>
            this.profession.ui.resourceView({ specialization });
        this.attributeWeaponSet = 1;
        this.attributeData = null;
        this.results = null;
        this.dragState = null;
        this.modifierContributionTimer = null;
        this.modifierContributionWorker = null;
        this.modifierContributionRequestId = 0;
    }

    // Initialization hook: bind event listeners, trigger initial render, hide loading overlay
    init() {
        this.bindPageControls();
        this.changed();
        document.getElementById('loading-overlay')?.classList.add('hidden');
    }

    // Central method called when any build property changes
    // Recalculates attributes, runs simulation, persists to storage, updates UI
    // rebuildStatic: whether to rebuild trait/skill/attribute panels (false for gear rapid changes)
    // rebuildGear: whether to rebuild gear panel (false for rapid gear changes with autocomplete)
    changed(rebuildStatic = true, rebuildGear = rebuildStatic) {
        this.normalizeSelectedSkills();
        recalculate(this);
        runSimulation(this);
        this.scheduleModifierContributions();
        saveBuild(this.build);
        if (rebuildStatic) {
            if (rebuildGear) this.renderGear();
            this.renderTraits();
            this.renderAttributes();
            this.renderSkills();
            this.renderAssumptions();
        }
        renderRotationBuilder(this);
    }

    scheduleModifierContributions() {
        const requestId = ++this.modifierContributionRequestId;
        clearTimeout(this.modifierContributionTimer);
        this.modifierContributionTimer = null;
        this.modifierContributionWorker?.terminate();
        this.modifierContributionWorker = null;

        if (!this.build.rotation.length || !this.results) return;

        const request = modifierContributionRequest(this);
        const applyContributions = contributions => {
            if (requestId !== this.modifierContributionRequestId || !this.results) return;
            this.results.contributions = contributions;
            renderResults(this);
        };

        this.modifierContributionTimer = setTimeout(() => {
            this.modifierContributionTimer = null;
            if (requestId !== this.modifierContributionRequestId) return;

            if (typeof Worker === 'function') {
                const worker = new Worker(
                    new URL('./modifier-contributions-worker.js', import.meta.url),
                    { type: 'module' },
                );
                this.modifierContributionWorker = worker;
                worker.addEventListener('message', ({ data }) => {
                    if (data.requestId !== requestId) return;
                    worker.terminate();
                    if (this.modifierContributionWorker === worker) {
                        this.modifierContributionWorker = null;
                    }
                    if (!data.error) applyContributions(data.contributions);
                });
                worker.postMessage({ requestId, request });
                return;
            }

            applyContributions(calculateModifierContributions(request));
        }, 100);
    }

    // Ensures selected skills are valid for current elite specialization
    // Swaps skill if it's unavailable (e.g., switching specs invalidates spec-locked skills)
    normalizeSelectedSkills() {
        const spec = eliteSpecialization(this.build);
        const slotTypes = {
            Heal: 'Heal',
            Utility1: 'Utility',
            Utility2: 'Utility',
            Utility3: 'Utility',
            Elite: 'Elite',
        };
        for (const [slot, type] of Object.entries(slotTypes)) {
            const current = this.skillByName.get(this.build.selectedSkills[slot]);
            const allowed = current
                && current.type === type
                && (!current.specialization || current.specialization === spec);
            if (!allowed) {
                this.build.selectedSkills[slot] = this.skills.find(skill =>
                    skill.type === type
                    && !skill.flipParent
                    && (!skill.specialization || skill.specialization === spec)
                )?.name || '';
            }
        }
    }

    addRotation(name, options = {}) {
        const defaultInterruptMs = this.skillByName.get(name)?.defaultInterruptMs;
        const resolvedOptions = defaultInterruptMs != null && options.interruptMs == null
            ? { interruptMs: defaultInterruptMs, ...options }
            : options;
        const item = Object.keys(resolvedOptions).length
            ? { name, ...resolvedOptions }
            : name;
        this.build.rotation.push(item);
        this.changed(false);
    }

    renderGear() {
        const b = this.build;
        const twoHanded = WEAPON_DATA[b.weapons[0]]?.wielding === '2h';
        document.getElementById('gear-slots').innerHTML = GEAR_SLOTS.map(slot => {
            const hidden = twoHanded && slot === 'Weapon2';
            const label = twoHanded && slot === 'Weapon1'
                ? 'Weapon (2H)'
                : slot === 'Leggins' ? 'Leggings' : slot;
            return `<div class="gear-row"${hidden ? ' style="display:none"' : ''}>
                <span class="gear-label">${label}</span>
                <select class="gear-select gear-prefix" data-slot="${slot}">
                    ${PREFIXES.map(prefix => option(prefix, this.build.gear[slot])).join('')}
                </select>
            </div>`;
        }).join('');
        document.querySelectorAll('.gear-prefix').forEach(select => {
            select.addEventListener('change', () => {
                this.build.gear[select.dataset.slot] = select.value;
                // Keep the live selects in place so native type-ahead followed by
                // Tab advances to the next slot instead of restarting at Helm.
                this.changed(true, false);
            });
        });

        const mainHands = Object.entries(WEAPON_DATA)
            .filter(([, data]) => ['mh', 'mh+oh', '2h'].includes(data.wielding))
            .map(([name]) => name);
        const offHands = Object.entries(WEAPON_DATA)
            .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
            .map(([name]) => name);
        const weaponSetRows = (setNumber, weapons, sigils) => {
            const setTwoHanded = WEAPON_DATA[weapons[0]]?.wielding === '2h';
            return `<div class="weapon-set-heading">Weapon set ${setNumber}</div>
                <div class="gear-row"><span class="gear-label">Main hand</span>
                    <select id="sel-mh${setNumber}" class="gear-select">${mainHands.map(name => option(name, weapons[0])).join('')}</select>
                </div>
                <div class="gear-row" style="${setTwoHanded ? 'opacity:.4;pointer-events:none' : ''}">
                    <span class="gear-label">Off hand</span>
                    <select id="sel-oh${setNumber}" class="gear-select">${offHands.map(name => option(name, weapons[1])).join('')}</select>
                </div>
                ${[0, 1].map(slot => this.selectRow(
                    `Sigil ${slot + 1}`,
                    `sel-sig${setNumber}-${slot + 1}`,
                    SIGIL_NAMES.map(name =>
                        option(name, sigils[slot], name, name === sigils[slot === 0 ? 1 : 0])
                    ).join(''),
                )).join('')}`;
        };
        document.getElementById('weapon-select').innerHTML = `
            ${weaponSetRows(1, b.weapons, b.weaponSigils[0])}
            ${weaponSetRows(2, b.alternateWeapons, b.weaponSigils[1])}`;
        const bindWeaponSet = (setNumber, weapons, sigils) => {
            document.getElementById(`sel-mh${setNumber}`).addEventListener('change', event => {
                weapons[0] = event.target.value;
                if (WEAPON_DATA[event.target.value].wielding === '2h') weapons[1] = '';
                else if (!weapons[1]) weapons[1] = 'Sword';
                this.changed();
            });
            document.getElementById(`sel-oh${setNumber}`).addEventListener('change', event => {
                weapons[1] = event.target.value;
                this.changed();
            });
            for (const slot of [0, 1]) {
                document.getElementById(`sel-sig${setNumber}-${slot + 1}`)
                    .addEventListener('change', event => {
                        setWeaponSigil(b, setNumber - 1, slot, event.target.value);
                        this.changed();
                    });
            }
        };
        bindWeaponSet(1, b.weapons, b.weaponSigils[0]);
        bindWeaponSet(2, b.alternateWeapons, b.weaponSigils[1]);

        document.getElementById('equipment-info').innerHTML = `
            ${this.selectRow('Rune', 'sel-rune', groupedOptions(RUNE_GROUPS, b.rune))}
            ${this.selectRow('Relic', 'sel-relic', RELIC_NAMES.map(name => option(name, b.relic)).join(''))}
            ${this.selectRow('Food', 'sel-food', groupedOptions(FOOD_GROUPS, b.food))}
            ${this.selectRow('Utility', 'sel-utility', UTILITY_NAMES.map(name => option(name, b.utility)).join(''))}
            <div class="gear-row"><span class="gear-label">Jade Bot</span>
                <input type="checkbox" id="chk-jbc" class="gear-checkbox"${b.jadeBotCore ? ' checked' : ''}>
            </div>
            ${b.infusions.map((infusion, index) => `<div class="gear-row infusion-row">
                <span class="gear-label">Infusion ${index + 1}</span>
                <div class="infusion-controls">
                    <input class="inf-count" data-index="${index}" type="number" min="0" max="18" value="${infusion.count}">
                    <select class="gear-select inf-stat" data-index="${index}">
                        ${INFUSION_STATS.map(stat => option(stat, infusion.stat)).join('')}
                    </select>
                </div>
            </div>`).join('')}
            <div class="gear-row infusion-total-row"><span class="gear-label">Total</span>
                <span class="inf-total">${b.infusions.reduce((sum, infusion) => sum + infusion.count, 0)}/18</span>
            </div>`;
        const bindValue = (id, setter) => document.getElementById(id).addEventListener('change', event => {
            setter(event.target.value);
            this.changed();
        });
        bindValue('sel-rune', value => b.rune = value);
        bindValue('sel-relic', value => b.relic = value);
        bindValue('sel-food', value => b.food = value);
        bindValue('sel-utility', value => b.utility = value);
        document.getElementById('chk-jbc').addEventListener('change', event => {
            b.jadeBotCore = event.target.checked;
            this.changed();
        });
        document.querySelectorAll('.inf-count').forEach(input => {
            input.addEventListener('change', () => {
                const index = Number(input.dataset.index);
                const other = b.infusions.reduce((sum, infusion, i) => i === index ? sum : sum + infusion.count, 0);
                b.infusions[index].count = Math.max(0, Math.min(Number(input.value) || 0, 18 - other));
                this.changed();
            });
        });
        document.querySelectorAll('.inf-stat').forEach(select => {
            select.addEventListener('change', () => {
                b.infusions[Number(select.dataset.index)].stat = select.value;
                this.changed();
            });
        });
    }

    selectRow(label, id, optionsHtml) {
        return `<div class="gear-row"><span class="gear-label">${label}</span>
            <select class="gear-select" id="${id}">${optionsHtml}</select></div>`;
    }

    renderTraits() {
        const container = document.getElementById('traits-panel');
        const selectedNames = this.build.specializations.map(spec => spec.name);
        container.innerHTML = this.build.specializations.map((selection, lineIndex) => {
            const spec = SPECIALIZATIONS.find(candidate => candidate.name === selection.name) || SPECIALIZATIONS[0];
            const picks = selection.traits.split('-').map(Number);
            return `<div class="spec-row" style="--spec-bg:url('${esc(SPEC_BG(spec.name))}')">
                <div class="spec-bg"></div><div class="spec-content">
                    <div class="spec-header-col">
                        <div class="spec-icon-wrap"><img src="${esc(spec.icon)}" alt=""></div>
                        <select class="spec-select" data-line="${lineIndex}">
                            ${SPECIALIZATIONS.map(candidate => {
                                const used = selectedNames.includes(candidate.name) && candidate.name !== selection.name;
                                return `<option value="${esc(candidate.name)}"${candidate.name === selection.name ? ' selected' : ''}${used ? ' disabled' : ''}>${esc(candidate.name)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="spec-tiers">${[0, 1, 2].map(tier => {
                        const minor = spec.minorTraits[tier];
                        return `${tier ? '<span class="spec-line"></span>' : ''}
                            <div class="spec-tier">
                                <div class="spec-trait-minor" title="${esc(minor.name)}\n${esc(minor.description)}"><img src="${esc(minor.icon)}" alt=""></div>
                                <div class="spec-trait-majors">${spec.majorTraits[tier].map((trait, position) =>
                                    `<div class="spec-trait-major ${picks[tier] === position + 1 ? 'sel' : 'dim'}"
                                        data-line="${lineIndex}" data-tier="${tier}" data-pick="${position + 1}"
                                        title="${esc(trait.name)}\n${esc(trait.description)}"><img src="${esc(trait.icon)}" alt=""></div>`
                                ).join('')}</div>
                            </div>`;
                    }).join('')}</div>
                </div></div>`;
        }).join('');
        container.querySelectorAll('.spec-select').forEach(select => {
            select.addEventListener('change', () => {
                this.build.specializations[Number(select.dataset.line)] = { name: select.value, traits: '1-1-1' };
                const newSpec = SPECIALIZATIONS.find(spec => spec.name === select.value);
                if (newSpec.elite) {
                    this.build.specializations.forEach((other, index) => {
                        if (index === Number(select.dataset.line)) return;
                        const otherSpec = SPECIALIZATIONS.find(spec => spec.name === other.name);
                        if (otherSpec?.elite) this.build.specializations[index] = { name: 'Domination', traits: '1-1-1' };
                    });
                }
                const definition = getResourceDefinition(eliteSpecialization(this.build));
                this.build.initialResource = Math.min(this.build.initialResource, definition.maximum);
                this.changed();
            });
        });
        container.querySelectorAll('.spec-trait-major').forEach(trait => {
            trait.addEventListener('click', () => {
                const spec = this.build.specializations[Number(trait.dataset.line)];
                const picks = spec.traits.split('-');
                picks[Number(trait.dataset.tier)] = trait.dataset.pick;
                spec.traits = picks.join('-');
                this.changed();
            });
        });
    }

    renderAttributes() {
        document.getElementById('attribute-weapon-set').value =
            String(this.attributeWeaponSet);
        const attributes = this.attributeData.attributes;
        const percent = new Set([
            'Critical Chance', 'Critical Damage', 'Condition Duration', 'Boon Duration',
            'Bleeding Duration', 'Burning Duration', 'Confusion Duration', 'Poison Duration', 'Torment Duration',
        ]);
        const primary = ['Power', 'Precision', 'Toughness', 'Vitality', 'Ferocity', 'Condition Damage', 'Expertise', 'Concentration', 'Healing Power'];
        const derived = ['Critical Chance', 'Critical Damage', 'Condition Duration', 'Boon Duration',
            'Bleeding Duration', 'Burning Duration', 'Confusion Duration', 'Poison Duration', 'Torment Duration'];
        const section = (title, names) => `<div class="attr-section"><h4>${title}</h4>${names.map(name => {
            let value = attributes[name]?.final || 0;
            if (name.endsWith(' Duration') && name !== 'Condition Duration' && name !== 'Boon Duration') {
                value += attributes['Condition Duration']?.final || 0;
            }
            const breakdown = attributes[name]
                ? Object.entries(attributes[name]).filter(([key, amount]) => key !== 'final' && amount)
                    .map(([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`).join('\n')
                : '';
            return `<div class="attr-row" title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val">${percent.has(name) ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString()}</span></div>`;
        }).join('')}</div>`;
        document.getElementById('attributes-list').innerHTML = section('Primary', primary) + section('Derived', derived);
    }

    availableSlotSkills(type) {
        const spec = eliteSpecialization(this.build);
        return this.skills.filter(skill =>
            skill.type === type
            && !skill.flipParent
            && (!skill.specialization || skill.specialization === spec));
    }

    renderSkills() {
        const spec = eliteSpecialization(this.build);
        const skillsForSet = ([mh, oh]) => {
            const twoHanded = WEAPON_DATA[mh]?.wielding === '2h';
            return [...new Map(this.skills.filter(skill => {
                if (skill.type !== 'Weapon') return false;
                if (skill.ambush && spec !== 'Mirage') return false;
                const slot = Number(String(skill.slot).match(/(\d)$/)?.[1] || 0);
                return twoHanded
                    ? skill.weapon === mh
                    : (slot <= 3 ? skill.weapon === mh : skill.weapon === oh);
            }).map(skill => [skill.name, skill])).values()]
                .sort((a, b) => a.slot.localeCompare(b.slot));
        };
        const set1Skills = skillsForSet(this.build.weapons);
        const set2Skills = skillsForSet(this.build.alternateWeapons);
        const weaponIcon = skill => `<div class="wskill" title="${esc(skill.name)}\n${esc(skill.description)}">
            <img src="${esc(skill.icon)}" alt=""><span class="wslot-num">${esc(skill.slot.replace('Weapon_', ''))}</span>
        </div>`;
        document.getElementById('weapon-bar').innerHTML = `
            <div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 1</span>${set1Skills.map(weaponIcon).join('')}</div>
            <div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 2</span>${set2Skills.map(weaponIcon).join('')}</div>`;

        const slots = [
            ['Heal', 'Heal'], ['Utility1', 'Utility'], ['Utility2', 'Utility'], ['Utility3', 'Utility'], ['Elite', 'Elite'],
        ];
        document.getElementById('skill-bar').innerHTML = slots.map(([key, type]) => {
            const current = this.skillByName.get(this.build.selectedSkills[key]);
            return `<div class="skill-bar-slot ${type === 'Heal' ? 'heal-border' : type === 'Elite' ? 'elite-border' : ''}" data-key="${key}">
                <div class="sbar-icon" title="${esc(current?.name || 'Choose skill')}"><img src="${esc(current?.icon || '')}" alt=""></div>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${this.availableSlotSkills(type).map(skill =>
                    `<div class="dd-item" data-name="${esc(skill.name)}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.name)}</span></div>`
                ).join('')}</div>
            </div>`;
        }).join('');
        document.querySelectorAll('.skill-bar-slot').forEach(slot => {
            slot.querySelector('.sbar-icon').addEventListener('click', event => {
                event.stopPropagation();
                document.querySelectorAll('.sbar-dropdown.open').forEach(drop => {
                    if (drop !== slot.querySelector('.sbar-dropdown')) drop.classList.remove('open');
                });
                slot.querySelector('.sbar-dropdown').classList.toggle('open');
            });
            slot.querySelectorAll('.dd-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.build.selectedSkills[slot.dataset.key] = item.dataset.name;
                    this.changed();
                });
            });
        });

        const rows = [...new Map(
            [
                ...set1Skills,
                ...set2Skills,
                ...slots.map(([key]) => this.skillByName.get(this.build.selectedSkills[key])).filter(Boolean),
            ].map(skill => [skill.name, skill]),
        ).values()];
        document.getElementById('skill-info-table').innerHTML = `<div class="skill-info-grid">
            <div class="skill-info-header" role="row">
                <span role="columnheader">Skill</span>
                <span role="columnheader">Cast Time</span>
                <span role="columnheader">Base Cooldown</span>
            </div>
            ${rows.map(skill =>
            `<div class="skill-info-row" role="row">
                <span class="skill-info-skill" role="cell">
                    <img src="${esc(skill.icon || '')}" alt=""><span class="skill-info-name">${esc(skill.name)}</span>
                </span>
                <span class="skill-info-value" role="cell">${Number(skill.activation || 0).toFixed(2)}s</span>
                <span class="skill-info-value" role="cell">${Number(skill.cooldown || 0)}s CD</span>
            </div>`
        ).join('')}</div>`;
    }

    renderAssumptions() {
        const a = this.build.assumptions;
        const conditions = a.targetConditions ||= {};
        const item = ({
            name,
            checked,
            type,
            key = name,
            stacks = null,
        }) => `<label class="perma-item" style="--pc:${EFFECT_COLORS[name] || '#aaa'}">
            <input type="checkbox" data-effect-type="${type}" data-effect-key="${esc(key)}"${checked ? ' checked' : ''}>
            <span class="perma-name">${esc(name)}</span>
            ${stacks == null ? '' : `<input type="number" class="perma-stacks" data-effect-type="${type}" data-effect-key="${esc(key)}" min="0" max="25" value="${stacks}"${checked ? '' : ' disabled'}>`}
        </label>`;
        const boonItems = [
            item({
                name: 'Might',
                checked: Number(a.might) > 0,
                type: 'boon',
                key: 'might',
                stacks: Math.max(0, Math.min(25, Number(a.might) || 0)),
            }),
            ...PERMANENT_BOONS.map(([key, name]) => item({
                name,
                checked: !!a[key],
                type: 'boon',
                key,
            })),
        ].join('');
        const conditionItems = PERMANENT_TARGET_CONDITIONS.map(name => {
            const stackable = STACKING_TARGET_CONDITIONS.has(name);
            const value = conditions[name];
            return item({
                name,
                checked: stackable ? Number(value) > 0 : !!value,
                type: 'condition',
                stacks: stackable
                    ? Math.max(0, Math.min(25, Number(value) || 0))
                    : null,
            });
        }).join('');
        const container = document.getElementById('perma-boons');
        container.innerHTML = `
            <div class="perma-group"><span class="perma-group-label">Boons</span>${boonItems}</div>
            <div class="perma-group"><span class="perma-group-label">Conditions</span>${conditionItems}</div>
            <div class="perma-group"><span class="perma-group-label">Target</span>
                <label class="boon-control">Skill activations/s <input id="target-skill-activations" type="number" min="0" max="10" step="0.1" value="${a.targetSkillActivationsPerSecond}"></label>
                <label class="boon-control"><input id="target-moving" type="checkbox"${a.targetMoving ? ' checked' : ''}> Moving</label>
            </div>`;

        container.querySelectorAll('input[type="checkbox"][data-effect-type]')
            .forEach(check => check.addEventListener('change', () => {
                const { effectType, effectKey } = check.dataset;
                const stackInput = container.querySelector(
                    `input[type="number"][data-effect-type="${effectType}"][data-effect-key="${effectKey}"]`,
                );
                if (stackInput) {
                    stackInput.disabled = !check.checked;
                    if (check.checked && Number(stackInput.value) < 1) {
                        stackInput.value = '1';
                    }
                }
                const value = stackInput
                    ? (check.checked ? Math.max(1, Number(stackInput.value) || 1) : 0)
                    : check.checked;
                if (effectType === 'boon') {
                    a[effectKey] = value;
                } else if (value) {
                    conditions[effectKey] = value;
                } else {
                    delete conditions[effectKey];
                }
                this.changed();
            }));
        container.querySelectorAll('input[type="number"][data-effect-type]')
            .forEach(input => input.addEventListener('change', () => {
                const value = Math.max(0, Math.min(25, Number(input.value) || 0));
                const { effectType, effectKey } = input.dataset;
                input.value = value;
                if (effectType === 'boon') {
                    a[effectKey] = value;
                } else if (value) {
                    conditions[effectKey] = value;
                } else {
                    delete conditions[effectKey];
                }
                this.changed();
            }));
        document.getElementById('target-skill-activations').addEventListener('change', event => {
            a.targetSkillActivationsPerSecond = Math.max(
                0,
                Math.min(10, Number(event.target.value) || 0),
            );
            this.changed();
        });
        document.getElementById('target-moving').addEventListener('change', event => {
            a.targetMoving = event.target.checked;
            this.changed();
        });
        document.getElementById('target-hp').value = this.build.targetHealth;
        document.getElementById('target-armor').value = this.build.targetArmor;
    }

    bindPageControls() {
        document.getElementById('attribute-weapon-set').addEventListener('change', event => {
            this.attributeWeaponSet = Number(event.target.value) === 2 ? 2 : 1;
            recalculate(this);
            this.renderAttributes();
        });
        document.addEventListener('click', event => {
            if (!event.target.closest('.skill-bar-slot')) {
                document.querySelectorAll('.sbar-dropdown.open').forEach(drop => drop.classList.remove('open'));
            }
        });
        document.getElementById('btn-sim-clear').addEventListener('click', () => {
            this.build.rotation = [];
            this.changed(false);
        });
        document.getElementById('btn-sim-rerun').addEventListener('click', () => this.changed(false));
        document.getElementById('btn-export-build').addEventListener('click', () =>
            downloadJson('mesmer-build.json', this.build));
        document.getElementById('btn-import-build').addEventListener('click', () =>
            document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', async event => {
            if (!event.target.files[0]) return;
            try {
                this.build = replaceBuild(await readJsonFile(event.target.files[0]));
                this.changed();
            } catch (error) {
                alert(error.message);
            }
        });
        document.getElementById('btn-export-rotation').addEventListener('click', () =>
            downloadJson('mesmer-rotation.json', { rotation: this.build.rotation }));
        document.getElementById('btn-import-rotation').addEventListener('click', () =>
            document.getElementById('rotation-file-input').click());
        document.getElementById('rotation-file-input').addEventListener('change', async event => {
            if (!event.target.files[0]) return;
            try {
                const imported = await readJsonFile(event.target.files[0]);
                this.build.rotation = Array.isArray(imported) ? imported : imported.rotation;
                if (!Array.isArray(this.build.rotation)) throw new Error('Rotation array missing.');
                this.changed(false);
            } catch (error) {
                alert(error.message);
            }
        });
        document.getElementById('target-armor').addEventListener('change', event => {
            this.build.targetArmor = Math.max(1, Number(event.target.value) || 2597);
            this.changed(false);
        });
        document.getElementById('target-hp').addEventListener('change', event => {
            this.build.targetHealth = Math.max(0, Number(event.target.value) || 0);
            event.target.value = this.build.targetHealth;
            this.changed(false);
        });
        document.getElementById('btn-reset-build').addEventListener('click', () => {
            if (!confirm('Reset the Mesmer build, skills, and rotation?')) return;
            this.build = createDefaultBuild();
            this.changed();
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.mesmerApp = new MesmerApp();
    window.mesmerApp.init();
});
