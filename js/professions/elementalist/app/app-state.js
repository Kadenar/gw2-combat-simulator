export function createEmptySelectedSkills() {
    return { heal: null, util1: null, util2: null, util3: null, elite: null };
}

export function createDefaultPermaBoons() {
    return {
        Might: 25,
        Fury: true,
        Protection: true,
        Resolution: true,
        Alacrity: true,
        Quickness: true,
        Regeneration: true,
        Vigor: true,
        Swiftness: true,
        Bleeding: 5,
        Burning: true,
        Torment: 5,
        Confusion: 5,
        Poisoned: true,
        Chilled: true,
        Cripple: true,
        Slow: true,
        Weakness: true,
        Vulnerability: 25,
    };
}

export function cloneRotationItems(items = []) {
    return items.map(item => (typeof item === 'string' ? item : { ...item }));
}

export function serializeSelectedSkills(selectedSkills = {}) {
    const savedSkills = {};
    for (const [slot, skill] of Object.entries(selectedSkills)) {
        savedSkills[slot] = skill ? skill.name : null;
    }
    return savedSkills;
}

export function resolveSelectedSkills(selectedSkills = {}, skillDefs = []) {
    const resolved = createEmptySelectedSkills();
    for (const [slot, name] of Object.entries(selectedSkills || {})) {
        if (!name) continue;
        const skill = skillDefs.find(s => s.name === name);
        if (skill) resolved[slot] = skill;
    }
    return resolved;
}

export function buildSnapshotFromState({
    build,
    selectedSkills,
    activeAttunement,
    secondaryAttunement,
    evokerElement,
    evokerStartCharges,
    evokerStartEmpowered,
    permaBoons,
    permaField,
    rotation,
    hitboxSize,
    glyphBoonedElementals,
    thornsBossAuraOnly,
}) {
    return {
        build: JSON.parse(JSON.stringify(build)),
        selectedSkills: serializeSelectedSkills(selectedSkills),
        activeAttunement,
        secondaryAttunement,
        evokerElement,
        evokerStartCharges,
        evokerStartEmpowered,
        permaBoons: JSON.parse(JSON.stringify(permaBoons)),
        permaField: permaField || '',
        rotation: cloneRotationItems(rotation),
        hitboxSize: hitboxSize || 'large',
        glyphBoonedElementals: !!glyphBoonedElementals,
        thornsBossAuraOnly: !!thornsBossAuraOnly,
    };
}

export function mergeSnapshotIntoState(currentState, snapshot, skillDefs = null) {
    const nextState = {
        build: currentState.build,
        activeAttunement: currentState.activeAttunement,
        secondaryAttunement: currentState.secondaryAttunement,
        evokerElement: currentState.evokerElement,
        evokerStartCharges: currentState.evokerStartCharges,
        evokerStartEmpowered: currentState.evokerStartEmpowered,
        permaBoons: currentState.permaBoons,
        permaField: currentState.permaField || '',
        selectedSkills: currentState.selectedSkills,
        hitboxSize: currentState.hitboxSize || 'large',
        glyphBoonedElementals: !!currentState.glyphBoonedElementals,
        thornsBossAuraOnly: !!currentState.thornsBossAuraOnly,
        rotation: null,
    };

    if (snapshot.build) nextState.build = JSON.parse(JSON.stringify(snapshot.build));
    if (snapshot.activeAttunement) nextState.activeAttunement = snapshot.activeAttunement;
    if (snapshot.secondaryAttunement) nextState.secondaryAttunement = snapshot.secondaryAttunement;
    if ('evokerElement' in snapshot) nextState.evokerElement = snapshot.evokerElement;
    if ('evokerStartCharges' in snapshot) nextState.evokerStartCharges = snapshot.evokerStartCharges;
    if ('evokerStartEmpowered' in snapshot) nextState.evokerStartEmpowered = snapshot.evokerStartEmpowered;
    if (snapshot.hitboxSize) nextState.hitboxSize = snapshot.hitboxSize;
    if ('glyphBoonedElementals' in snapshot) nextState.glyphBoonedElementals = !!snapshot.glyphBoonedElementals;
    if ('thornsBossAuraOnly' in snapshot) nextState.thornsBossAuraOnly = !!snapshot.thornsBossAuraOnly;
    if ('permaField' in snapshot) nextState.permaField = snapshot.permaField || '';
    if (snapshot.permaBoons && Object.keys(snapshot.permaBoons).length > 0) {
        nextState.permaBoons = JSON.parse(JSON.stringify(snapshot.permaBoons));
    }
    if (snapshot.selectedSkills && skillDefs) {
        nextState.selectedSkills = resolveSelectedSkills(snapshot.selectedSkills, skillDefs);
    }
    if (snapshot.rotation) {
        nextState.rotation = cloneRotationItems(snapshot.rotation);
    }

    return nextState;
}
