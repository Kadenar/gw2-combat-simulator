// File I/O utilities for import/export of builds and rotations

// Triggers browser download of JSON-serialized payload
// Creates blob, generates temporary object URL, clicks download link, cleans up
export function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Async function to read File from <input> element and parse JSON
// Rejects with error message if JSON is malformed
export function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(reader.result));
            } catch (error) {
                reject(new Error(`Invalid JSON: ${error.message}`));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

export async function fetchJsonAsset(path, { optional = false } = {}) {
    const response = await fetch(`${path}?t=${Date.now()}`);
    if (!response.ok) {
        if (optional) return null;
        throw new Error(`Could not load ${path}`);
    }
    return response.json();
}

export function getRotationItems(payload) {
    return Array.isArray(payload) ? payload : payload?.rotation;
}

export function getBuildExportPayload(build) {
    const { rotation: _rotation, ...payload } = build;
    return payload;
}

export async function loadPresetBundle(preset) {
    const buildData = await fetchJsonAsset(preset.build);
    let rotationItems;
    if (preset.rotation) {
        const rotationData = await fetchJsonAsset(preset.rotation, { optional: true });
        const items = getRotationItems(rotationData);
        if (Array.isArray(items)) rotationItems = items;
    }
    return { buildData, rotationItems };
}
