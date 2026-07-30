// Profession-injected application shell.
// Manages UI state, coordinates rendering, handles user interactions, orchestrates simulation pipeline

import {
    FOOD_GROUPS,
    GEAR_SLOTS,
    INFUSION_STATS,
    PREFIX_GROUPS,
    RELIC_NAMES as SHARED_RELIC_NAMES,
    RUNE_GROUPS,
    SIGIL_GROUPS,
    UTILITY_NAMES,
} from '../platform/gw2/gear-data.js';
import { setWeaponSigil } from '../platform/gw2/weapon-sigils.js';
import {
    loadProfessionAppAdapter,
} from './profession-registry.js';
import {
    createDefaultBuild,
    loadBuild,
    replaceBuildConfiguration,
    saveBuild,
} from './app-state.js';
import {
    assumptionControlsForSpecialization,
} from './profession-assumptions.js';
import {
    mergeModifierContributions,
    modifierContributionWorkerCount,
    partitionModifierComparisons,
} from './modifier-contributions.js';
import {
    partitionRandomDistributionTrials,
    randomDistributionWorkerCount,
    summarizeRandomDistribution,
} from './random-distribution.js';
import {
    downloadJson,
    fetchJsonAsset,
    getBuildExportPayload,
    readJsonFile,
} from './app-io.js';
import { escapeHtml as esc, gw2ApiText } from '../platform/ui/html.js';
import {
    DERIVED_ATTRIBUTES,
    groupedOptions,
    option,
    PERCENT_ATTRIBUTES,
    PRIMARY_ATTRIBUTES,
    SPECIFIC_CONDITION_DURATION_ATTRIBUTES,
    STACKING_TARGET_CONDITIONS,
    TARGET_CONDITION_GROUPS,
} from './app-ui.js';

// Wiki specialization banners are exactly 647×136 px — matching the trait panel width,
// so they frame edge-to-edge with no vertical crop. The generated catalog ships the raw
// API backgrounds (1024×256), which get center-cropped to an inconsistent zoomed band.
// Special:FilePath redirects to the actual file regardless of internal hash paths.
const SPEC_BG = name => `https://wiki.guildwars2.com/wiki/Special:FilePath/${encodeURIComponent(name)}_specialization.png`;

const PERMANENT_BOONS = [
    ['fury', 'Fury'],
    ['quickness', 'Quickness'],
    ['alacrity', 'Alacrity'],
    ['protection', 'Protection'],
    ['resolution', 'Resolution'],
    ['regeneration', 'Regeneration'],
    ['swiftness', 'Swiftness'],
    ['vigor', 'Vigor'],
    ['aegis', 'Aegis'],
];
const EFFECT_COLORS = {
    Might: '#d9a441',
    Fury: '#d65e5e',
    Quickness: '#67c8d4',
    Alacrity: '#9069d8',
    Protection: '#4f9ec2',
    Resolution: '#d48f45',
    Regeneration: '#5ebc72',
    Swiftness: '#62a7cb',
    Vigor: '#78bd45',
    Aegis: '#d9b85f',
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
const MODIFIER_CONTRIBUTION_DEBOUNCE_MS = 750;
const RANDOM_DISTRIBUTION_DEBOUNCE_MS = 350;

// Main application controller class
// Maintains UI state, coordinates between UI and simulation engine
export class ProfessionApp {
    // Constructor initializes build from storage, loads all skills, sets up data references
    constructor(adapter) {
        if (!adapter?.profession) {
            throw new TypeError("ProfessionApp requires an app adapter.");
        }
        this.adapter = adapter;
        this.profession = adapter.profession;
        this.build = loadBuild(adapter);
        this.skills = [...this.profession.catalog.skills];
        this.skillByName = this.profession.catalog.skillsByName;
        this.skillById = this.profession.catalog.skillsById;
        this.weaponData = adapter.weaponData;
        this.relicNames = adapter.relicNames || SHARED_RELIC_NAMES;
        this.specializations = adapter.specializations;
        this.resourceDefinitions = specialization =>
            this.profession.ui.resourceViews({ specialization });
        this.resourceDefinition = specialization =>
            this.resourceDefinitions(specialization)[0] || null;
        this.attributeWeaponSet = 1;
        this.attributeData = null;
        this.results = null;
        this.dragState = null;
        this.modifierContributionTimer = null;
        this.modifierContributionWorkers = new Set();
        this.modifierContributionRequestId = 0;
        this.randomDistributionTimer = null;
        this.randomDistributionWorkers = new Set();
        this.randomDistributionRequestId = 0;
        this.defaultBuildPresets = [];
    }

    // Initialization hook: bind event listeners, trigger initial render, hide loading overlay
    init() {
        this.bindPageControls();
        this.changed();
        this.initDefaultBuilds();
        document.getElementById('loading-overlay')?.classList.add('hidden');
    }

    // Central method called when any build property changes
    // Recalculates attributes, runs simulation, persists to storage, updates UI
    // rebuildStatic: whether to rebuild trait/skill/attribute panels (false for gear rapid changes)
    // rebuildGear: whether to rebuild gear panel (false for rapid gear changes with autocomplete)
    changed(rebuildStatic = true, rebuildGear = rebuildStatic) {
        const previousContributions = this.results?.contributions;
        this.normalizeSelectedSkills();
        this.adapter.recalculate(this);
        this.adapter.runSimulation(this);
        if (Array.isArray(previousContributions)) {
            this.results.contributions = previousContributions;
        }
        this.scheduleRandomDistribution();
        this.scheduleModifierContributions();
        saveBuild(this.build, this.adapter);
        if (rebuildStatic) {
            if (rebuildGear) this.renderGear();
            this.renderTraits();
            this.renderAttributes();
            this.renderSkills();
            this.renderAssumptions();
        }
        this.adapter.renderRotationBuilder(this);
    }

    // Debounced async calculation of per-modifier damage contributions.
    // Cancels any in-flight worker pool/timer before starting a new one.
    // Uses pooled Web Workers when available so main thread stays responsive;
    // falls back to synchronous calculation in environments without Worker.
    scheduleModifierContributions() {
        const requestId = ++this.modifierContributionRequestId;
        clearTimeout(this.modifierContributionTimer);
        this.modifierContributionTimer = null;
        for (const worker of this.modifierContributionWorkers) {
            worker.terminate();
        }
        this.modifierContributionWorkers.clear();

        if (!this.build.rotation.length || !this.results) {
            if (this.results) this.results.modifierContributionsStale = false;
            return;
        }

        this.results.modifierContributionsStale = true;
        const request = this.adapter.modifierContributionRequest(this);
        const applyContributions = contributions => {
            if (requestId !== this.modifierContributionRequestId || !this.results) return;
            this.results.contributions = contributions;
            this.results.modifierContributionsStale = false;
            this.adapter.renderResults(this);
        };
        const failContributions = () => {
            if (requestId !== this.modifierContributionRequestId || !this.results) return;
            for (const worker of this.modifierContributionWorkers) {
                worker.terminate();
            }
            this.modifierContributionWorkers.clear();
            this.results.modifierContributionsStale = false;
            this.adapter.renderResults(this);
        };

        const calculateContributions = () => {
            this.modifierContributionTimer = null;
            if (requestId !== this.modifierContributionRequestId) return;
            // Give RNG sampling uncontested CPU time. Contribution comparisons
            // start as soon as the distribution worker pool finishes.
            if (this.randomDistributionWorkers.size) {
                this.modifierContributionTimer = setTimeout(
                    calculateContributions,
                    250,
                );
                return;
            }

            if (typeof Worker === 'function') {
                const workerCount = modifierContributionWorkerCount(
                    request.comparisons.length,
                    globalThis.navigator?.hardwareConcurrency,
                );
                const batches = partitionModifierComparisons(
                    request.comparisons,
                    workerCount,
                );
                if (!batches.length) {
                    applyContributions([]);
                    return;
                }
                const completed = [];
                let failed = false;
                for (const comparisons of batches) {
                    const worker = new Worker(
                        new URL('./modifier-contributions-worker.js', import.meta.url),
                        { type: 'module' },
                    );
                    this.modifierContributionWorkers.add(worker);
                    const finishWorker = () => {
                        worker.terminate();
                        this.modifierContributionWorkers.delete(worker);
                    };
                    worker.addEventListener('message', ({ data }) => {
                        if (
                            failed
                            || data.requestId !== requestId
                            || requestId !== this.modifierContributionRequestId
                        ) return;
                        finishWorker();
                        if (data.error) {
                            failed = true;
                            failContributions();
                            return;
                        }
                        completed.push(data.contributions || []);
                        if (completed.length === batches.length) {
                            applyContributions(
                                mergeModifierContributions(completed),
                            );
                        }
                    });
                    worker.addEventListener('error', () => {
                        if (failed) return;
                        failed = true;
                        finishWorker();
                        failContributions();
                    }, { once: true });
                    worker.postMessage({
                        requestId,
                        request: { ...request, comparisons },
                    });
                }
                return;
            }

            applyContributions(this.adapter.calculateModifierContributions(request));
        };
        this.modifierContributionTimer = setTimeout(
            calculateContributions,
            MODIFIER_CONTRIBUTION_DEBOUNCE_MS,
        );
    }

    // Debounced RNG sampling for random trait procs. A small worker pool splits
    // the trials across CPU cores without blocking the UI.
    scheduleRandomDistribution() {
        const requestId = ++this.randomDistributionRequestId;
        clearTimeout(this.randomDistributionTimer);
        this.randomDistributionTimer = null;
        for (const worker of this.randomDistributionWorkers) {
            worker.terminate();
        }
        this.randomDistributionWorkers.clear();

        const request = this.build.rotation.length && this.results
            ? this.adapter.randomDistributionRequest?.(this)
            : null;
        if (!request) {
            if (this.results) {
                this.results.randomDistributionRequested = false;
                this.results.randomDistributionStale = false;
            }
            return;
        }

        this.results.randomDistributionRequested = true;
        this.results.randomDistributionStale = true;
        this.results.randomDistributionTrials = request.trials;
        this.results.randomDistributionProgress = {
            completed: 0,
            total: request.trials,
            percent: 0,
        };

        const applyProgress = progress => {
            if (requestId !== this.randomDistributionRequestId || !this.results) return;
            const total = Math.max(1, Number(progress?.total || request.trials));
            const completed = Math.max(
                0,
                Math.min(total, Number(progress?.completed || 0)),
            );
            const percent = Math.max(
                0,
                Math.min(100, Number(progress?.percent ?? (completed / total) * 100)),
            );
            this.results.randomDistributionProgress = {
                completed,
                total,
                percent,
            };

            // Progress updates only touch the indicator. Remounting the full
            // result view would repeatedly rebuild tables and charts.
            const indicator = document.querySelector(
                '#rotation-results [data-role="rng-progress"]',
            );
            if (!indicator) return;
            indicator.setAttribute('aria-valuenow', String(Math.round(percent)));
            const bar = indicator.querySelector('[data-role="rng-progress-bar"]');
            if (bar) bar.style.width = `${percent}%`;
            const label = indicator.querySelector('[data-role="rng-progress-label"]');
            if (label) {
                label.textContent = `${
                    Math.round(completed).toLocaleString()
                } / ${Math.round(total).toLocaleString()} outcomes (${
                    Math.round(percent)
                }%)`;
            }
        };

        const applyDistribution = distribution => {
            if (requestId !== this.randomDistributionRequestId || !this.results) return;
            this.results.randomDistribution = distribution;
            this.results.randomDistributionStale = false;
            this.results.randomDistributionProgress = {
                completed: distribution.trials,
                total: distribution.trials,
                percent: 100,
            };
            this.results.randomDistributionError = '';
            this.adapter.renderResults(this);
        };
        const failDistribution = error => {
            if (requestId !== this.randomDistributionRequestId || !this.results) return;
            for (const worker of this.randomDistributionWorkers) {
                worker.terminate();
            }
            this.randomDistributionWorkers.clear();
            this.results.randomDistributionStale = false;
            this.results.randomDistributionError = error instanceof Error
                ? error.message
                : String(error || 'RNG distribution failed.');
            this.adapter.renderResults(this);
        };

        this.randomDistributionTimer = setTimeout(() => {
            this.randomDistributionTimer = null;
            if (requestId !== this.randomDistributionRequestId) return;

            if (typeof Worker === 'function') {
                const workerCount = randomDistributionWorkerCount(
                    request.trials,
                    globalThis.navigator?.hardwareConcurrency,
                );
                const batches = partitionRandomDistributionTrials(
                    request.trials,
                    workerCount,
                );
                const batchProgress = batches.map(() => 0);
                const completedSamples = batches.map(() => null);
                let completedWorkers = 0;
                let failed = false;

                batches.forEach((batch, batchIndex) => {
                    const worker = new Worker(
                        new URL('./random-distribution-worker.js', import.meta.url),
                        { type: 'module' },
                    );
                    this.randomDistributionWorkers.add(worker);
                    const finishWorker = () => {
                        worker.terminate();
                        this.randomDistributionWorkers.delete(worker);
                    };
                    worker.addEventListener('message', ({ data }) => {
                        if (
                            failed
                            || data.requestId !== requestId
                            || requestId !== this.randomDistributionRequestId
                        ) return;
                        if (data.progress) {
                            batchProgress[batchIndex] = Math.max(
                                0,
                                Math.min(batch.trials, Number(data.progress.completed || 0)),
                            );
                            const completed = batchProgress.reduce(
                                (sum, value) => sum + value,
                                0,
                            );
                            applyProgress({
                                completed,
                                total: request.trials,
                                percent: (completed / request.trials) * 100,
                            });
                            return;
                        }
                        finishWorker();
                        if (data.error) {
                            failed = true;
                            failDistribution(data.error);
                            return;
                        }
                        completedSamples[batchIndex] =
                            data.distribution?.samples || [];
                        completedWorkers += 1;
                        if (completedWorkers === batches.length) {
                            applyDistribution(
                                summarizeRandomDistribution(
                                    completedSamples.flat(),
                                ),
                            );
                        }
                    });
                    worker.addEventListener('error', event => {
                        if (failed) return;
                        failed = true;
                        finishWorker();
                        failDistribution(event?.message);
                    }, { once: true });
                    worker.postMessage({
                        requestId,
                        request: { ...request, ...batch },
                        includeSamples: true,
                    });
                });
                return;
            }

            try {
                applyDistribution(
                    this.adapter.calculateRandomDistribution(request, {
                        onProgress: applyProgress,
                    }),
                );
            } catch (error) {
                failDistribution(error);
            }
        }, RANDOM_DISTRIBUTION_DEBOUNCE_MS);
    }

    // Ensures selected skills are valid for current elite specialization
    // Swaps skill if it's unavailable (e.g., switching specs invalidates spec-locked skills)
    isSlotSkillSelectable(skill, specialization) {
        if (
            !skill
            || skill.flipParent
            || skill.flipParentId != null
            || skill.slotSelectable === false
        ) {
            return false;
        }
        return this.profession.ui.isSlotSkillSelectable?.(
            {
                build: this.build,
                specialization,
                catalog: this.profession.catalog,
            },
            skill,
        ) !== false;
    }

    normalizeSelectedSkills() {
        const spec = this.adapter.eliteSpecialization(this.build);
        if (this.adapter.slotLoadout) {
            Object.assign(
                this.build,
                this.adapter.slotLoadout.normalizeBuild(this.build, {
                    build: this.build,
                    specialization: spec,
                    professionState: this.results?.endState?.profession,
                    catalog: this.profession.catalog,
                }),
            );
            return;
        }
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
                && current.implemented !== false
                && current.type === type
                && this.isSlotSkillSelectable(current, spec)
                && (!current.specialization || current.specialization === spec)
                && this.adapter.isSkillAvailable(current, {
                    build: this.build,
                    specialization: spec,
                });
            if (!allowed) {
                this.build.selectedSkills[slot] = this.skills.find(skill =>
                    skill.implemented !== false
                    && skill.type === type
                    && this.isSlotSkillSelectable(skill, spec)
                    && (!skill.specialization || skill.specialization === spec)
                    && this.adapter.isSkillAvailable(skill, {
                        build: this.build,
                        specialization: spec,
                    })
                )?.name || '';
            }
        }
    }

    // Appends a skill to the rotation. If the skill defines a defaultInterruptMs
    // and none is provided in options, the default is injected so the entry
    // is stored as an object rather than a bare string.
    addRotation(name, options = {}) {
        const skillId = options.skillId == null ? null : Number(options.skillId);
        const skill = Number.isFinite(skillId)
            ? this.skillById.get(skillId)
            : this.skillByName.get(name);
        const defaultInterruptMs = skill?.defaultInterruptMs;
        const resolvedOptions = defaultInterruptMs != null && options.interruptMs == null
            ? { interruptMs: defaultInterruptMs, ...options }
            : options;
        const item = Object.keys(resolvedOptions).length
            ? { name, ...resolvedOptions }
            : name;
        this.build.rotation.push(item);
        this.changed(false);
    }

    // Renders and re-binds three sections: armor gear slots, weapon sets (MH/OH/sigils ×2),
    // and equipment (rune/relic/food/utility/jade bot/infusions).
    // Re-creating the HTML each call means event listeners must be reattached here.
    renderGear() {
        const b = this.build;
        const twoHanded = this.weaponData[b.weapons[0]]?.wielding === '2h';
        document.getElementById('gear-slots').innerHTML = GEAR_SLOTS.map(slot => {
            const hidden = twoHanded && slot === 'Weapon2';
            const label = twoHanded && slot === 'Weapon1'
                ? 'Weapon (2H)'
                : slot === 'Leggins' ? 'Leggings' : slot;
            return `<div class="gear-row"${hidden ? ' style="display:none"' : ''}>
                <span class="gear-label">${label}</span>
                <select class="gear-select gear-prefix" data-slot="${slot}">
                    ${groupedOptions(PREFIX_GROUPS, this.build.gear[slot])}
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

        const mainHands = Object.entries(this.weaponData)
            .filter(([, data]) => ['mh', 'mh+oh', '2h'].includes(data.wielding))
            .map(([name]) => name);
        const offHands = Object.entries(this.weaponData)
            .filter(([, data]) => ['oh', 'mh+oh'].includes(data.wielding))
            .map(([name]) => name);
        const weaponSetRows = (setNumber, weapons, sigils, allowEmpty = false) => {
            const setTwoHanded = this.weaponData[weapons[0]]?.wielding === '2h';
            const setUnequipped = allowEmpty && !weapons[0];
            const disabledStyle = setUnequipped
                ? 'display:none'
                : setTwoHanded ? 'opacity:.4;pointer-events:none' : '';
            return `<div class="weapon-set-heading">Weapon set ${setNumber}</div>
                <div class="gear-row"><span class="gear-label">Main hand</span>
                    <select id="sel-mh${setNumber}" class="gear-select">${
                        allowEmpty ? option('', weapons[0], 'None') : ''
                    }${mainHands.map(name => option(name, weapons[0])).join('')}</select>
                </div>
                <div class="gear-row" style="${disabledStyle}">
                    <span class="gear-label">Off hand</span>
                    <select id="sel-oh${setNumber}" class="gear-select">${offHands.map(name => option(name, weapons[1])).join('')}</select>
                </div>
                <div style="${setUnequipped ? 'display:none' : ''}">
                ${[0, 1].map(slot => this.selectRow(
                    `Sigil ${slot + 1}`,
                    `sel-sig${setNumber}-${slot + 1}`,
                    groupedOptions(
                        SIGIL_GROUPS,
                        sigils[slot],
                        name => name,
                        name => name === sigils[slot === 0 ? 1 : 0],
                    ),
                )).join('')}</div>`;
        };
        document.getElementById('weapon-select').innerHTML = `
            ${weaponSetRows(1, b.weapons, b.weaponSigils[0])}
            ${weaponSetRows(2, b.alternateWeapons, b.weaponSigils[1], true)}`;
        const bindWeaponSet = (setNumber, weapons, sigils) => {
            document.getElementById(`sel-mh${setNumber}`).addEventListener('change', event => {
                weapons[0] = event.target.value;
                if (!event.target.value) {
                    weapons[1] = '';
                    b.startingWeaponSet = 1;
                    this.attributeWeaponSet = 1;
                } else if (this.weaponData[event.target.value].wielding === '2h') weapons[1] = '';
                else if (!weapons[1]) {
                    weapons[1] = this.adapter.defaultOffhand({
                        mainHand: event.target.value,
                        offHands,
                    }) || offHands[0] || '';
                }
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
            ${this.selectRow('Relic', 'sel-relic', this.relicNames.map(name => option(name, b.relic)).join(''))}
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

    // Renders three specialization rows with wiki banner backgrounds, minor/major trait icons,
    // and spec dropdowns. Selecting an elite spec forces any other already-elite slot to fall
    // back to specializationFallback. Also clamps initialResource to the new spec's maximum.
    renderTraits() {
        const container = document.getElementById('traits-panel');
        const selectedNames = this.build.specializations.map(spec => spec.name);
        container.innerHTML = this.build.specializations.map((selection, lineIndex) => {
            const spec = this.specializations.find(candidate => candidate.name === selection.name)
                || this.specializations[0];
            const picks = selection.traits.split('-').map(Number);
            return `<div class="spec-row" style="--spec-bg:url('${esc(SPEC_BG(spec.name))}')">
                <div class="spec-bg"></div><div class="spec-content">
                    <div class="spec-header-col">
                        <div class="spec-icon-wrap"><img src="${esc(spec.icon)}" alt=""></div>
                        <select class="spec-select" data-line="${lineIndex}">
                            ${this.specializations.map(candidate => {
                                const used = selectedNames.includes(candidate.name) && candidate.name !== selection.name;
                                return `<option value="${esc(candidate.name)}"${candidate.name === selection.name ? ' selected' : ''}${used ? ' disabled' : ''}>${esc(candidate.name)}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div class="spec-tiers">${[0, 1, 2].map(tier => {
                        const minor = spec.minorTraits[tier];
                        return `${tier ? '<span class="spec-line"></span>' : ''}
                            <div class="spec-tier">
                                <div class="spec-trait-minor" title="${esc(minor.name)}\n${esc(gw2ApiText(minor.description))}"><img src="${esc(minor.icon)}" alt=""></div>
                                <div class="spec-trait-majors">${spec.majorTraits[tier].map((trait, position) =>
                                    `<div class="spec-trait-major ${picks[tier] === position + 1 ? 'sel' : 'dim'}"
                                        data-line="${lineIndex}" data-tier="${tier}" data-pick="${position + 1}"
                                        title="${esc(trait.name)}\n${esc(gw2ApiText(trait.description))}"><img src="${esc(trait.icon)}" alt=""></div>`
                                ).join('')}</div>
                            </div>`;
                    }).join('')}</div>
                </div></div>`;
        }).join('');
        container.querySelectorAll('.spec-select').forEach(select => {
            select.addEventListener('change', () => {
                this.build.specializations[Number(select.dataset.line)] = { name: select.value, traits: '1-1-1' };
                const newSpec = this.specializations.find(spec => spec.name === select.value);
                if (newSpec.elite) {
                    this.build.specializations.forEach((other, index) => {
                        if (index === Number(select.dataset.line)) return;
                        const otherSpec = this.specializations.find(spec => spec.name === other.name);
                        if (otherSpec?.elite) {
                            this.build.specializations[index] = {
                                name: this.adapter.specializationFallback,
                                traits: '1-1-1',
                            };
                        }
                    });
                }
                const definition = this.resourceDefinition(
                    this.adapter.eliteSpecialization(this.build),
                );
                if (definition) {
                    this.build.initialResource = Math.min(
                        this.build.initialResource,
                        definition.maximum,
                    );
                }
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

    // Renders Primary and Derived attribute rows. Percent attributes display with two decimals;
    // others are rounded and locale-formatted. Hover tooltip shows the per-source breakdown.
    // Specific condition duration attributes add global Condition Duration on top of their own value.
    renderAttributes() {
        document.getElementById('attribute-weapon-set').value =
            String(this.attributeWeaponSet);
        const attributes = this.attributeData.attributes;
        const section = (title, names) => `<div class="attr-section"><h4>${title}</h4>${names.map(name => {
            let value = attributes[name]?.final || 0;
            if (SPECIFIC_CONDITION_DURATION_ATTRIBUTES.has(name)) {
                value += attributes['Condition Duration']?.final || 0;
            }
            const breakdown = attributes[name]
                ? Object.entries(attributes[name]).filter(([key, amount]) => key !== 'final' && amount)
                    .map(([key, amount]) => `${key}: ${Math.round(amount * 100) / 100}`).join('\n')
                : '';
            return `<div class="attr-row" title="${esc(breakdown)}"><span class="attr-name">${name}</span>
                <span class="attr-val">${PERCENT_ATTRIBUTES.has(name) ? `${value.toFixed(2)}%` : Math.round(value).toLocaleString()}</span></div>`;
        }).join('')}</div>`;
        document.getElementById('attributes-list').innerHTML =
            section('Primary', PRIMARY_ATTRIBUTES)
            + section('Derived', DERIVED_ATTRIBUTES);
    }

    availableSlotSkills(type) {
        const spec = this.adapter.eliteSpecialization(this.build);
        return [...new Map(this.skills.filter(skill =>
            skill.implemented !== false
            && skill.type === type
            && this.isSlotSkillSelectable(skill, spec)
            && (!skill.specialization || skill.specialization === spec)
            && this.adapter.isSkillAvailable(skill, {
                build: this.build,
                specialization: spec,
            })
        ).map(skill => [skill.name, skill])).values()];
    }

    // Renders weapon bar (set 1 + set 2 previews), skill bar (Heal/Utility×3/Elite dropdowns),
    // and the skill-info table (cast time + cooldown for all skills in play).
    // Uses Map dedup so the same skill name appearing in both weapon sets shows once in the table.
    renderSkills() {
        const spec = this.adapter.eliteSpecialization(this.build);
        const skillsForSet = ([mh, oh]) => {
            return [...new Map(this.skills.filter(skill => {
                if (skill.type !== 'Weapon' || !skill.weapon) return false;
                if (!this.adapter.isSkillAvailable(skill, {
                    build: this.build,
                    specialization: spec,
                })) return false;
                return this.adapter.weaponSkillMatchesSet(
                    skill,
                    [mh, oh],
                    {
                        build: this.build,
                        specialization: spec,
                        catalog: this.profession.catalog,
                        weaponData: this.weaponData,
                        professionState: this.results?.endState?.profession,
                    },
                );
            }).map(skill => [skill.name, skill])).values()]
                .sort((a, b) => a.slot.localeCompare(b.slot));
        };
        const set1Skills = skillsForSet(this.build.weapons);
        const set2Skills = skillsForSet(this.build.alternateWeapons);
        const weaponIcon = skill => `<div class="wskill" title="${esc(skill.name)}\n${esc(gw2ApiText(skill.description))}">
            <img src="${esc(skill.icon)}" alt=""><span class="wslot-num">${esc(skill.slot.replace('Weapon_', ''))}</span>
        </div>`;
        document.getElementById('weapon-bar').innerHTML = `
            <div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 1</span>${set1Skills.map(weaponIcon).join('')}</div>
            ${this.build.alternateWeapons[0]
                ? `<div class="weapon-set-preview"><span class="weapon-set-preview-label">Set 2</span>${set2Skills.map(weaponIcon).join('')}</div>`
                : ''}`;

        if (this.adapter.slotLoadout) {
            this.renderFixedSlotLoadout(spec, set1Skills, set2Skills);
            return;
        }
        const slots = [
            ['Heal', 'Heal'], ['Utility1', 'Utility'], ['Utility2', 'Utility'], ['Utility3', 'Utility'], ['Elite', 'Elite'],
        ];
        const selectedSkillBarHtml = slots.map(([key, type]) => {
            const current = this.skillByName.get(this.build.selectedSkills[key]);
            return `<div class="skill-bar-slot ${type === 'Heal' ? 'heal-border' : type === 'Elite' ? 'elite-border' : ''}" data-key="${key}">
                <div class="sbar-icon" title="${esc(current?.name || 'Choose skill')}"><img src="${esc(current?.icon || '')}" alt=""></div>
                <div class="sbar-arrow">▼</div>
                <div class="sbar-dropdown">${this.availableSlotSkills(type).map(skill =>
                    `<div class="dd-item" data-name="${esc(skill.name)}"><img src="${esc(skill.icon)}" alt=""><span>${esc(skill.name)}</span></div>`
                ).join('')}</div>
            </div>`;
        }).join('');
        const inspectionGroups = this.profession.ui.skillBarGroups?.({
            build: this.build,
            specialization: spec,
            catalog: this.profession.catalog,
            professionState: this.results?.endState?.profession,
        }) || [];
        const inspectionSkills = inspectionGroups.flatMap(group =>
            group.skillIds.map(id => this.skillById.get(Number(id))).filter(Boolean));
        const skillBar = document.getElementById('skill-bar');
        skillBar.classList.toggle('has-inspection', inspectionGroups.length > 0);
        skillBar.innerHTML = inspectionGroups.length
            ? `<div class="skill-bar-selected">${selectedSkillBarHtml}</div>
                <div class="skill-bar-inspection">${inspectionGroups.map(group => {
                    const optionSkills = (group.optionSkillIds || [])
                        .map(id => this.skillById.get(Number(id)))
                        .filter(Boolean);
                    const selectable =
                        group.selectionKey
                        && Number.isInteger(Number(group.selectionIndex))
                        && optionSkills.length > 0;
                    return `<div class="skill-bar-inspection-group"
                        style="--inspection-color:${esc(group.color || 'var(--accent)')}">
                        <span class="skill-bar-inspection-label">${esc(group.label)}</span>
                        <div class="skill-bar-inspection-skills">${group.skillIds
                            .map(id => this.skillById.get(Number(id)))
                            .filter(Boolean)
                            .map(skill => `<div class="skill-bar-inspection-slot${
                                selectable ? ' selectable' : ''
                            }"${selectable
                                ? ` data-selection-key="${esc(group.selectionKey)}"
                                    data-selection-index="${Number(group.selectionIndex)}"`
                                : ''}>
                                <div class="sbar-icon" title="${esc(`${skill.name}\n${gw2ApiText(skill.description)}`)}">
                                    <img src="${esc(skill.icon || '')}" alt="">
                                </div>
                                ${selectable ? `<div class="sbar-arrow">▼</div>
                                    <div class="sbar-dropdown">${optionSkills.map(optionSkill =>
                                        `<div class="dd-item" data-skill-id="${optionSkill.id}">
                                            <img src="${esc(optionSkill.icon || '')}" alt="">
                                            <span>${esc(optionSkill.name)}</span>
                                        </div>`
                                    ).join('')}</div>` : ''}
                            </div>`).join('')}
                        </div>
                    </div>`;
                }).join('')}</div>`
            : selectedSkillBarHtml;
        skillBar.querySelectorAll('.skill-bar-slot').forEach(slot => {
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
        skillBar.querySelectorAll(
            '.skill-bar-inspection-slot[data-selection-key]',
        ).forEach(slot => {
            slot.querySelector('.sbar-icon').addEventListener('click', event => {
                event.stopPropagation();
                document.querySelectorAll('.sbar-dropdown.open').forEach(drop => {
                    if (drop !== slot.querySelector('.sbar-dropdown')) {
                        drop.classList.remove('open');
                    }
                });
                slot.querySelector('.sbar-dropdown').classList.toggle('open');
            });
            slot.querySelectorAll('.dd-item').forEach(item => {
                item.addEventListener('click', event => {
                    event.stopPropagation();
                    const key = slot.dataset.selectionKey;
                    const index = Number(slot.dataset.selectionIndex);
                    const skillId = Number(item.dataset.skillId);
                    if (this.profession.ui.updateSkillBarSelection) {
                        this.profession.ui.updateSkillBarSelection(
                            {
                                build: this.build,
                                specialization: spec,
                                professionState:
                                    this.results?.endState?.profession,
                                catalog: this.profession.catalog,
                            },
                            { key, index, skillId },
                        );
                    } else {
                        const values = Array.isArray(this.build[key])
                            ? [...this.build[key]]
                            : [];
                        values[index] = skillId;
                        this.build[key] = values;
                    }
                    this.changed();
                });
            });
        });

        const rows = [...new Map(
            [
                ...set1Skills,
                ...set2Skills,
                ...slots.map(([key]) => this.skillByName.get(this.build.selectedSkills[key])).filter(Boolean),
                ...inspectionSkills,
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
                <span class="skill-info-value" role="cell">${(Number(skill.castTimeMs || 0) / 1000).toFixed(2)}s</span>
                <span class="skill-info-value" role="cell">${Number(skill.cooldown || 0)}s CD</span>
            </div>`
        ).join('')}</div>`;
    }

    renderFixedSlotLoadout(spec, set1Skills, set2Skills) {
        const context = {
            build: this.build,
            specialization: spec,
            professionState: this.results?.endState?.profession,
            catalog: this.profession.catalog,
        };
        const view = this.adapter.slotLoadout.view(context);
        const skillBar = document.getElementById('skill-bar');
        const barHtml = bar => `<div class="fixed-loadout-bar${
            view.formatActiveBar
                ? bar.active ? ' active' : ' inactive'
                : ' static'
        }">
            <span class="skill-bar-label">${esc(bar.label)}</span>
            ${bar.skillIds.map(id => this.skillById.get(Number(id))).filter(Boolean).map(skill =>
                `<div class="skill-bar-slot"><div class="sbar-icon" title="${esc(skill.name)}"><img src="${esc(skill.icon || '')}" alt=""></div></div>`
            ).join('')}
        </div>`;
        const selectorHtml = selector => view.selectionControl === 'icons'
            ? `<div class="fixed-loadout-icon-selector">
                <span>${esc(selector.label)}</span>
                <div class="fixed-loadout-icon-options">${selector.options.map(entry =>
                    `<button type="button" class="fixed-loadout-icon${
                        entry.value === selector.value ? ' selected' : ''
                    }" data-loadout-key="${esc(selector.key)}"
                        data-loadout-value="${esc(entry.value)}"
                        title="${esc(entry.label)}"${entry.disabled ? ' disabled' : ''}>
                        <img src="${esc(entry.icon || '')}" alt="">
                    </button>`
                ).join('')}</div>
            </div>`
            : `<label><span>${esc(selector.label)}</span>
                <select class="gear-select" data-loadout-key="${esc(selector.key)}">
                    ${selector.options.map(entry =>
                        `<option value="${esc(entry.value)}"${entry.value === selector.value ? ' selected' : ''}${entry.disabled ? ' disabled' : ''}>${esc(entry.label)}</option>`
                    ).join('')}
                </select>
            </label>`;
        skillBar.innerHTML = `<div class="fixed-loadout-selectors">
            ${view.selectors.map(selectorHtml).join('')}
        </div>${view.bars.map(barHtml).join('')}`;
        skillBar.querySelectorAll('select[data-loadout-key]').forEach(select => {
            select.addEventListener('change', () => {
                this.adapter.slotLoadout.updateBuild(
                    this.build,
                    select.dataset.loadoutKey,
                    select.value,
                    context,
                );
                this.changed();
            });
        });
        skillBar.querySelectorAll('button[data-loadout-key]').forEach(button => {
            button.addEventListener('click', () => {
                this.adapter.slotLoadout.updateBuild(
                    this.build,
                    button.dataset.loadoutKey,
                    button.dataset.loadoutValue,
                    context,
                );
                this.changed();
            });
        });

        const rows = [...new Map([
            ...set1Skills,
            ...set2Skills,
            ...view.bars.flatMap(bar =>
                bar.skillIds.map(id => this.skillById.get(Number(id))).filter(Boolean)),
        ].map(skill => [skill.id, skill])).values()];
        document.getElementById('skill-info-table').innerHTML = `<div class="skill-info-grid">
            <div class="skill-info-header" role="row">
                <span role="columnheader">Skill</span>
                <span role="columnheader">Cast Time</span>
                <span role="columnheader">Base Cooldown</span>
            </div>
            ${rows.map(skill => `<div class="skill-info-row" role="row">
                <span class="skill-info-skill" role="cell">
                    <img src="${esc(skill.icon || '')}" alt=""><span class="skill-info-name">${esc(skill.name)}</span>
                </span>
                <span class="skill-info-value" role="cell">${(Number(skill.castTimeMs || 0) / 1000).toFixed(2)}s</span>
                <span class="skill-info-value" role="cell">${Number(skill.cooldown || 0)}s CD</span>
            </div>`).join('')}
        </div>`;
    }

    // Renders permanent boons/conditions and target-behavior assumptions.
    // Might and stackable conditions (Bleeding, Burning, Torment, Confusion, Poisoned) use a
    // numeric stack count; other boons/conditions use a boolean checkbox only.
    // Checkbox toggles enable/disable the paired stack input and keep values in sync.
    renderAssumptions() {
        const a = this.build.assumptions;
        const assumptionControls = assumptionControlsForSpecialization(
            this.adapter.assumptionControls,
            this.adapter.eliteSpecialization(this.build),
        );
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
        const conditionGroups = TARGET_CONDITION_GROUPS.map(group => {
            const conditionItems = group.conditions.map(name => {
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
            return `<div class="perma-group">
                <span class="perma-group-label">${esc(group.label)}</span>
                ${conditionItems}
            </div>`;
        }).join('');
        const assumptionOptionIcon = option =>
            option.icon
            || this.skillById.get(Number(option.skillId))?.icon
            || '';
        const professionAssumptionItem = control => {
            const value = a[control.key] ?? control.defaultValue;
            if (control.type === 'boolean') {
                return `<label class="boon-control"><input data-assumption-key="${esc(control.key)}" data-assumption-type="boolean" type="checkbox"${value ? ' checked' : ''}> ${esc(control.label)}</label>`;
            }
            if (control.type === 'select') {
                const hasIcons = control.options.some(assumptionOptionIcon);
                if (hasIcons) {
                    const selected = control.options.find(option =>
                        option.value === String(value)) || control.options[0];
                    return `<div class="boon-control assumption-icon-control">
                        <span>${esc(control.label)}</span>
                        <details class="assumption-icon-select">
                            <summary>
                                <img src="${esc(assumptionOptionIcon(selected))}" alt="">
                                <span>${esc(selected.label)}</span>
                            </summary>
                            <div class="assumption-icon-options" role="listbox"
                                aria-label="${esc(control.label)}">
                                ${control.options.map(option =>
                                    `<button type="button" role="option"
                                        aria-selected="${option.value === String(value)}"
                                        data-assumption-option-key="${esc(control.key)}"
                                        data-assumption-option-value="${esc(option.value)}">
                                        <img src="${esc(assumptionOptionIcon(option))}" alt="">
                                        <span>${esc(option.label)}</span>
                                    </button>`
                                ).join('')}
                            </div>
                        </details>
                    </div>`;
                }
                return `<label class="boon-control">${esc(control.label)}
                    <select class="gear-select" data-assumption-key="${esc(control.key)}" data-assumption-type="select">
                        ${control.options.map(option =>
                            `<option value="${esc(option.value)}"${String(value) === option.value ? ' selected' : ''}>${esc(option.label)}</option>`
                        ).join('')}
                    </select>
                </label>`;
            }
            return `<label class="boon-control">${esc(control.label)}
                <input data-assumption-key="${esc(control.key)}" data-assumption-type="number" type="number"
                    min="${control.minimum}" max="${control.maximum}" step="${control.step}" value="${Number(value)}">
            </label>`;
        };
        const professionAssumptionItems = assumptionControls
            .filter(control => control.section !== 'simulation')
            .map(professionAssumptionItem)
            .join('');
        const simulationAssumptionItems = assumptionControls
            .filter(control => control.section === 'simulation')
            .map(professionAssumptionItem)
            .join('');
        const container = document.getElementById('perma-boons');
        container.innerHTML = `
            <div class="perma-group"><span class="perma-group-label">Boons</span>${boonItems}</div>
            ${conditionGroups}
            <div class="perma-group"><span class="perma-group-label">Target</span>
                <label class="boon-control">Skill activations/s <input id="target-skill-activations" type="number" min="0" max="10" step="0.1" value="${a.targetSkillActivationsPerSecond}"></label>
                <label class="boon-control"><input id="target-moving" type="checkbox"${a.targetMoving ? ' checked' : ''}> Moving</label>
                ${professionAssumptionItems}
            </div>
            <div class="perma-group"><span class="perma-group-label">Party</span>
                <label class="boon-control">Additional allied players <input id="allied-player-count" type="number" min="0" max="4" step="1" value="${Number(a.alliedPlayerCount || 0)}"></label>
            </div>
            ${simulationAssumptionItems
                ? `<div class="perma-group"><span class="perma-group-label">Simulation</span>${simulationAssumptionItems}</div>`
                : ''}`;

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
        document.getElementById('allied-player-count').addEventListener('change', event => {
            a.alliedPlayerCount = Math.max(
                0,
                Math.min(4, Math.trunc(Number(event.target.value) || 0)),
            );
            this.changed();
        });
        container.querySelectorAll('[data-assumption-key]').forEach(control => {
            control.addEventListener('change', () => {
                const definition = assumptionControls.find(candidate =>
                    candidate.key === control.dataset.assumptionKey);
                if (!definition) return;
                if (definition.type === 'boolean') {
                    a[definition.key] = control.checked;
                } else if (definition.type === 'number') {
                    a[definition.key] = Math.max(
                        definition.minimum,
                        Math.min(definition.maximum, Number(control.value) || 0),
                    );
                } else {
                    a[definition.key] = control.value;
                }
                this.changed();
            });
        });
        container.querySelectorAll('[data-assumption-option-key]').forEach(option => {
            option.addEventListener('click', () => {
                const definition = assumptionControls.find(candidate =>
                    candidate.key === option.dataset.assumptionOptionKey);
                const value = option.dataset.assumptionOptionValue;
                if (
                    !definition
                    || !definition.options.some(candidate => candidate.value === value)
                ) return;
                a[definition.key] = value;
                this.changed();
            });
        });
        document.getElementById('target-hp').value = this.build.targetHealth;
        document.getElementById('target-armor').value = this.build.targetArmor;
    }

    async initDefaultBuilds() {
        try {
            const manifest = await fetchJsonAsset(
                `Builds/${this.adapter.id}-manifest.json`,
                { optional: true },
            );
            if (!Array.isArray(manifest) || manifest.length === 0) return;

            const sections = manifest[0]?.presets !== undefined
                ? manifest
                : [{ section: null, presets: manifest }];
            const groups = sections.map(section => {
                const buttons = (section.presets || []).map(preset => {
                    const index = this.defaultBuildPresets.push(preset) - 1;
                    return `<button type="button" class="btn preset-btn" data-preset-index="${index}">${esc(preset.label)}</button>`;
                }).join('');
                if (!buttons) return '';
                const label = section.section
                    ? `<span class="presets-group-label">${esc(section.section)}</span>`
                    : '';
                return `<div class="presets-group">${label}<div class="presets-group-btns">${buttons}</div></div>`;
            }).join('');
            if (!groups) return;

            const container = document.createElement('section');
            container.className = 'default-builds';
            container.setAttribute('aria-labelledby', 'default-builds-title');
            container.innerHTML = `
                <div class="panel default-builds-panel">
                    <div class="default-builds-header">
                        <h3 id="default-builds-title">Default builds</h3>
                        <span>Load gearing, traits, skills, and assumptions</span>
                    </div>
                    <div class="default-build-groups">${groups}</div>
                </div>`;
            document.querySelector('.build-section')?.before(container);
            container.addEventListener('click', event => {
                const button = event.target.closest('.preset-btn');
                if (!button) return;
                const preset = this.defaultBuildPresets[
                    Number(button.dataset.presetIndex)
                ];
                if (preset) this.loadDefaultBuild(preset, button);
            });
        } catch {
            // Default builds are optional; import/export remains available without them.
        }
    }

    async loadDefaultBuild(preset, button) {
        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'Loading…';
        try {
            const buildData = await fetchJsonAsset(preset.build);
            if (buildData?.profession && buildData.profession !== this.adapter.id) {
                throw new Error(`This is a ${buildData.profession} build.`);
            }
            this.build = replaceBuildConfiguration(
                buildData,
                this.build,
                this.adapter,
            );
            this.changed();
        } catch (error) {
            alert(`Failed to load default build: ${error.message}`);
        } finally {
            button.disabled = false;
            button.textContent = originalLabel;
        }
    }

    // Wires up page-level controls that live outside re-rendered panels:
    // weapon-set attribute toggle, skill-bar click-away, rotation clear/rerun,
    // build/rotation import-export, target armor/HP inputs, and build reset.
    bindPageControls() {
        document.getElementById('attribute-weapon-set').addEventListener('change', event => {
            this.attributeWeaponSet = Number(event.target.value) === 2 ? 2 : 1;
            this.adapter.recalculate(this);
            this.renderAttributes();
        });
        document.addEventListener('click', event => {
            if (!event.target.closest(
                '.skill-bar-slot, .skill-bar-inspection-slot',
            )) {
                document.querySelectorAll('.sbar-dropdown.open').forEach(drop => drop.classList.remove('open'));
            }
        });
        document.getElementById('btn-sim-clear').addEventListener('click', () => {
            this.build.rotation = [];
            this.changed(false);
        });
        document.getElementById('btn-sim-rerun').addEventListener('click', () => this.changed(false));
        document.getElementById('btn-export-build').addEventListener('click', () =>
            downloadJson(
                this.adapter.filenames.build,
                getBuildExportPayload(this.build),
            ));
        document.getElementById('btn-import-build').addEventListener('click', () =>
            document.getElementById('import-file-input').click());
        document.getElementById('import-file-input').addEventListener('change', async event => {
            if (!event.target.files[0]) return;
            try {
                this.build = replaceBuildConfiguration(
                    await readJsonFile(event.target.files[0]),
                    this.build,
                    this.adapter,
                );
                this.changed();
            } catch (error) {
                alert(error.message);
            }
        });
        document.getElementById('btn-export-rotation').addEventListener('click', () =>
            downloadJson(
                this.adapter.filenames.rotation,
                { rotation: this.build.rotation },
            ));
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
            if (!confirm(this.adapter.resetPrompt)) return;
            this.build = createDefaultBuild(this.adapter);
            this.changed();
        });
    }
}

// Bootstrap: resolve the active profession adapter from the page manifest id,
// construct the app, expose it on window for console/debugging, then init.
window.addEventListener('DOMContentLoaded', async () => {
    const professionId = document.body.dataset.profession
        || document.getElementById('profession-select')?.dataset.activeProfession;
    if (!professionId) {
        throw new Error("Profession page is missing data-profession.");
    }
    const adapter = await loadProfessionAppAdapter(professionId);
    if (!adapter) {
        throw new Error(
            `No native application adapter is registered for "${professionId}".`,
        );
    }
    const app = new ProfessionApp(adapter);
    window.professionApp = app;
    if (adapter.globalName) {
        window[adapter.globalName] = app;
    }
    app.init();
});
