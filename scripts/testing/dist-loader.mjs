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

      const buildRelative = path.relative(buildRoot, requested);

      if (
        buildRelative &&
        !buildRelative.startsWith('..') &&
        !path.isAbsolute(buildRelative) &&
        !(await exists(requested))
      ) {
        const source = path.join(sourceRoot, buildRelative);

        if (await exists(source)) {
          return {
            url: pathToFileURL(source).href,
            shortCircuit: true
          };
        }
      }
    }
  }

  return nextResolve(specifier, context);
}
