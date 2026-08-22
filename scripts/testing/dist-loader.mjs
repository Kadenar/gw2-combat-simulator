import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sourceRoot = path.join(root, 'js');
const buildRoot = path.join(root, 'dist', 'js');

async function exists(file) {
  try {
    await access(file);

    return true;
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  // Redirect source-facing JavaScript specifiers to their compiled TypeScript
  // outputs so tests and tools execute the exact modules produced by tsc.
  if ((specifier.startsWith('.') || specifier.startsWith('file:')) && context.parentURL) {
    const requestedUrl = new URL(specifier, context.parentURL);

    if (requestedUrl.protocol === 'file:') {
      const requested = fileURLToPath(requestedUrl);
      const sourceRelative = path.relative(sourceRoot, requested);

      if (sourceRelative && !sourceRelative.startsWith('..') && !path.isAbsolute(sourceRelative)) {
        const built = path.join(buildRoot, sourceRelative);

        if (await exists(built)) {
          return {
            url: pathToFileURL(built).href,
            shortCircuit: true
          };
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
