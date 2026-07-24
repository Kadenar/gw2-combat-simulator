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
