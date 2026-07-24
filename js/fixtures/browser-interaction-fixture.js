import { createDefaultBuild } from '../app/app-state.js';

const output = document.getElementById('fixture-output');
const frame = document.getElementById('simulator');

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const icon = (document, name) =>
    [...document.querySelectorAll('.pal-skill')].find(element => element.dataset.skill === name);

const dragEvent = (window, type, dataTransfer, options = {}) => {
    const event = new window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: options.clientX || 0,
    });
    Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
    return event;
};

const dataTransfer = () => {
    const values = new Map();
    return {
        effectAllowed: 'none',
        setData(type, value) {
            values.set(type, String(value));
        },
        getData(type) {
            return values.get(type) || '';
        },
    };
};

frame.addEventListener('load', () => {
    let app;
    let originalBuild;
    try {
        const window = frame.contentWindow;
        const document = frame.contentDocument;
        app = window.mesmerApp;
        assert(app, 'application did not initialize');
        originalBuild = structuredClone(app.build);
        app.build = createDefaultBuild();
        app.changed();

        assert(document.getElementById('target-hp')?.value === '4000000', 'target HP control missing');
        assert(
            document.querySelector(
                '#perma-boons [data-effect-type="condition"][data-effect-key="Slow"]',
            )?.checked,
            'permanent target conditions are not rendered',
        );
        assert(
            document.querySelector(
                '#perma-boons [data-effect-type="condition"][data-effect-key="Vulnerability"] + .perma-name',
            ),
            'stacking target condition control missing',
        );
        const alternateMain = document.getElementById('sel-mh2');
        assert(alternateMain?.value === 'Spear', 'alternate weapon-set control missing');
        assert(
            document.getElementById('sel-sig1-1')
                && document.getElementById('sel-sig1-2')
                && document.getElementById('sel-sig2-1')
                && document.getElementById('sel-sig2-2'),
            'each weapon set does not expose two sigil controls',
        );
        assert(
            !document.getElementById('sel-sig1') && !document.getElementById('sel-sig2'),
            'global sigil controls were not removed',
        );
        assert(
            document.querySelector('#sel-sig1-1 option[value="Accuracy"]')?.disabled,
            'the other equipped sigil is not disabled in the set selector',
        );
        const attributeWeaponSet = document.getElementById('attribute-weapon-set');
        assert(attributeWeaponSet, 'attribute weapon-set selector missing');
        attributeWeaponSet.value = '2';
        attributeWeaponSet.dispatchEvent(new window.Event('change', { bubbles: true }));
        assert(app.attributeWeaponSet === 2, 'attribute weapon-set selector did not update the view');
        assert(
            icon(document, 'Swap Weapons').querySelector('img').src
                === 'https://wiki.guildwars2.com/images/c/ce/Weapon_Swap_Button.png',
            'weapon-swap icon does not use the requested Wiki image',
        );
        icon(document, 'Swap Weapons').click();
        assert(app.results.endState.activeWeaponSet === 2, 'weapon swap did not activate set 2');
        const alternateSkill = app.skills.find(skill =>
            skill.type === 'Weapon' && skill.weapon === app.build.alternateWeapons[0]);
        assert(icon(document, alternateSkill.name), 'palette did not switch to alternate weapon skills');
        app.build.rotation = ['Bladecall', 'Swap Weapons', 'Psycut'];
        app.changed(false);
        const weaponRows = [
            ...document.querySelectorAll('#rotation-timeline .rot-row:not(.rot-procs-row)'),
        ];
        assert(weaponRows.length === 2, 'weapon swap did not create a new timeline row');
        assert(
            weaponRows[0].querySelector('.rot-row-label').textContent.includes('W1')
                && weaponRows[1].querySelector('.rot-row-label').textContent.includes('W2'),
            'weapon timeline rows do not identify their weapon sets',
        );

        app.build.rotation = ['Bladecall', 'Mirror Blade', 'Mind Spike'];
        app.changed(false);
        let timelineSkills = [...document.querySelectorAll('#rotation-timeline .rot-skill')];
        const movedSkill = timelineSkills[0];
        const dropTarget = timelineSkills[2];
        const reorderTransfer = dataTransfer();
        movedSkill.dispatchEvent(dragEvent(window, 'dragstart', reorderTransfer));
        assert(movedSkill.classList.contains('dragging'), 'dragged timeline skill is not styled');
        const targetRect = dropTarget.getBoundingClientRect();
        dropTarget.dispatchEvent(dragEvent(window, 'dragover', reorderTransfer, {
            clientX: targetRect.right + 1,
        }));
        assert(
            dropTarget.classList.contains('drag-insert-after'),
            'timeline does not show an after-insertion marker',
        );
        dropTarget.dispatchEvent(dragEvent(window, 'drop', reorderTransfer, {
            clientX: targetRect.right + 1,
        }));
        movedSkill.dispatchEvent(dragEvent(window, 'dragend', reorderTransfer));
        assert(
            app.build.rotation.join('|') === 'Mirror Blade|Mind Spike|Bladecall',
            'forward timeline drag reordered to the wrong index',
        );

        app.build.rotation = [];
        app.changed(false);
        const paletteSkill = icon(document, 'Bladecall');
        const paletteTransfer = dataTransfer();
        paletteSkill.dispatchEvent(dragEvent(window, 'dragstart', paletteTransfer));
        const emptyTimeline = document.getElementById('rotation-timeline');
        emptyTimeline.dispatchEvent(dragEvent(window, 'dragover', paletteTransfer));
        assert(
            emptyTimeline.classList.contains('drag-over-empty'),
            'empty timeline does not show its drop target',
        );
        emptyTimeline.dispatchEvent(dragEvent(window, 'drop', paletteTransfer));
        paletteSkill.dispatchEvent(dragEvent(window, 'dragend', paletteTransfer));
        assert(
            app.build.rotation.length === 1 && app.build.rotation[0] === 'Bladecall',
            'palette drag did not insert into the empty timeline',
        );

        app.build.rotation = [];
        app.changed(false);
        icon(document, 'Bladecall').click();
        assert(app.build.rotation.length === 1, 'normal palette click did not queue');
        assert(icon(document, 'Bladecall').querySelector('.pal-cd'), 'cooldown badge missing after cast');
        assert(icon(document, 'Bladecall').title.includes('available at'), 'ready time missing from cooldown tooltip');
        assert(document.querySelector('.rot-procs-row'), 'relic and trait procs are missing below the rotation');
        assert(
            [...document.querySelectorAll('#rotation-results .res-label')]
                .map(label => label.textContent)
                .join('|') === 'Duration|Total Damage|DPS|Strike|Condition',
            'result summary metric order is incorrect',
        );
        assert(
            [...document.querySelectorAll('.mesmer-skill-breakdown .res-hdr span')]
                .map(label => label.textContent.trim())
                .join('|')
                === 'Skill|Strike|Condition|Total|DPS|Avg/Cast|DCT|Casts|Hits',
            'skill breakdown columns are incomplete',
        );
        assert(
            document.querySelector('.mesmer-skill-breakdown .res-skill img')?.getAttribute('src'),
            'skill breakdown icon is missing',
        );
        assert(
            document.querySelector('#rotation-chart')
                && document.querySelector('#rotation-effects-chart'),
            'DPS and effects charts are missing',
        );
        const dpsChart = document.querySelector('#rotation-chart');
        const dpsRect = dpsChart.getBoundingClientRect();
        dpsChart.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: dpsRect.left + dpsRect.width / 2,
            clientY: dpsRect.top + dpsRect.height / 2,
        }));
        assert(
            document.querySelector('#rotation-chart-tooltip')?.textContent.includes('DPS:'),
            'DPS chart hover tooltip is missing',
        );
        const effectsChart = document.querySelector('#rotation-effects-chart');
        const effectsRect = effectsChart.getBoundingClientRect();
        effectsChart.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: effectsRect.left + effectsRect.width / 2,
            clientY: effectsRect.top + effectsRect.height / 2,
        }));
        assert(
            document.querySelector('#rotation-effects-tooltip')?.textContent.includes('s'),
            'effects chart hover tooltip is missing',
        );
        icon(document, 'Bladecall').click();
        assert(app.results.steps[1].start === 4000, 'second click did not wait for cooldown');

        app.build.rotation = [];
        app.changed(false);
        icon(document, 'Bladecall').click();
        icon(document, 'Bladesong Distortion').dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            shiftKey: true,
        }));
        assert(app.build.rotation[1].offset === 100, 'Shift+click did not create concurrent command');
        assert(app.results.steps[1].start === 100, 'concurrent command did not start at 100ms');

        const originalPower = app.attributeData.attributes.Power.final;
        const helm = document.querySelector('[data-slot="Helm"]');
        helm.focus();
        helm.value = "Viper's";
        helm.dispatchEvent(new Event('change', { bubbles: true }));
        assert(app.attributeData.attributes.Power.final !== originalPower, 'gear UI did not recalculate attributes');
        assert(
            document.querySelector('[data-slot="Helm"]') === helm && helm.isConnected,
            'gear prefix change replaced the select and broke Tab navigation',
        );
        assert(icon(document, 'Dodge / Mirage Cloak').querySelector('img').naturalWidth > 0, 'action icon failed to load');
        assert(
            icon(document, 'Dodge / Mirage Cloak').querySelector('img').src
                === 'https://wiki.guildwars2.com/images/b/b2/Dodge.png',
            'Dodge icon does not use the requested Wiki image',
        );
        assert(
            icon(document, '__combat_start').querySelector('img').src
                === 'https://wiki.guildwars2.com/images/e/e9/Call_Target.png',
            'Combat Start icon is incorrect',
        );
        assert(
            icon(document, '__wait').querySelector('img').src
                === 'https://wiki.guildwars2.com/images/8/83/%22sipcoffee%22_Emote_Tome.png',
            'Wait icon is incorrect',
        );
        assert(!icon(document, 'Wait 1 second'), 'obsolete one-second action remains in the palette');

        app.build.weapons = ['Scepter', 'Sword'];
        app.build.initialResource = 0;
        app.build.rotation = [];
        app.changed();
        assert(icon(document, 'Counterspell'), 'Counterspell flip skill missing from Scepter palette');
        assert(
            icon(document, 'Counterspell').classList.contains('pal-context-disabled'),
            'Counterspell is enabled before Illusionary Counter',
        );
        icon(document, 'Counterspell').click();
        assert(app.build.rotation.length === 0, 'disabled Counterspell was queued');
        icon(document, 'Illusionary Counter').click();
        assert(app.results.endState.resource === 0, 'Illusionary Counter generated block-only clones');
        assert(
            !icon(document, 'Counterspell').classList.contains('pal-context-disabled'),
            'Counterspell did not enable after Illusionary Counter',
        );
        icon(document, 'Counterspell').click();
        app.build.rotation.push({ name: '__wait', waitMs: 1000 });
        app.changed(false);
        assert(app.results.endState.resource === 1, 'Counterspell did not generate one clone/blade');
        assert(
            [...document.querySelectorAll('.cond-breakdown .cond-hdr span')]
                .map(label => label.textContent.trim())
                .join('|') === 'Condition|Damage|DPS|Avg Stacks',
            'condition breakdown columns are incomplete',
        );
        assert(
            document.querySelector('.active-resource').dataset.resourceCount === '1',
            'active clone visualization did not update',
        );
        assert(
            icon(document, 'Counterspell').classList.contains('pal-context-disabled'),
            'Counterspell remained enabled after use',
        );

        app.build.specializations[2] = { name: 'Chronomancer', traits: '1-1-1' };
        app.build.initialResource = 3;
        app.build.rotation = [];
        app.changed();
        assert(
            icon(document, 'Split Second').querySelector('.pal-charges')?.textContent === '2/2',
            'Shatter Storm did not expose two Split Second ammo charges',
        );
        const split = icon(document, 'Continuum Split');
        const shift = icon(document, 'Continuum Shift');
        assert(split?.nextElementSibling === shift, 'Continuum Shift is not directly beside Continuum Split');
        assert(shift.classList.contains('pal-context-disabled'), 'Continuum Shift is enabled before the split');
        assert(
            shift.querySelector('img').src
                === 'https://wiki.guildwars2.com/images/d/d7/Continuum_Shift.png',
            'Continuum Shift does not use the requested Wiki image',
        );
        split.click();
        assert(app.results.endState.continuumActive, 'Continuum Split did not activate its window');
        assert(!icon(document, 'Continuum Shift').classList.contains('pal-context-disabled'), 'Continuum Shift stayed disabled');
        icon(document, 'Continuum Shift').click();
        assert(!app.results.endState.continuumActive, 'Continuum Shift did not end the split');

        output.dataset.status = 'passed';
        output.textContent = 'PASSED: drag/drop, clone display, Continuum Shift, reporting tables/charts, action icons, weapons, cooldowns, and Shift+click';
    } catch (error) {
        output.dataset.status = 'failed';
        output.textContent = `FAILED: ${error.stack}`;
    } finally {
        if (app && originalBuild) {
            app.build = originalBuild;
            app.changed();
        }
    }
});
