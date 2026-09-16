/**
 * Checks out and builds the pinned gw2combat C++ reference for development comparisons.
 *
 * The reference is a local development tool only; the browser product never
 * depends on it. On Windows the build uses the installed Visual Studio C++
 * toolset (found through vswhere) because upstream's MinGW route is not
 * required there; elsewhere it runs upstream's own `make`.
 *
 * Usage: node scripts/analysis/gw2combat-reference/build-reference.mjs [--reference-dir=<dir>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const REFERENCE_REPOSITORY = 'https://github.com/Mk-Chan/gw2combat.git';
export const REFERENCE_REVISION = 'cc9a0d069350516b6daba7d80d4395f9004971d5';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
export const DEFAULT_REFERENCE_DIR = path.join(repoRoot, 'reference-repos', 'gw2combat');

export function referenceExecutable(referenceDir) {
  return path.join(referenceDir, process.platform === 'win32' ? 'gw2combat.exe' : 'gw2combat');
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

/** Fetches exactly the pinned commit so later upstream changes never alter the reference. */
function checkout(referenceDir) {
  if (!existsSync(path.join(referenceDir, '.git'))) {
    mkdirSync(referenceDir, { recursive: true });
    run('git', ['init', '--quiet'], { cwd: referenceDir });
    run('git', ['remote', 'add', 'origin', REFERENCE_REPOSITORY], { cwd: referenceDir });
  }

  run('git', ['fetch', '--quiet', '--depth', '1', 'origin', REFERENCE_REVISION], { cwd: referenceDir });
  run('git', ['checkout', '--quiet', '--detach', REFERENCE_REVISION], { cwd: referenceDir });
}

/** The makefile's source list is the authoritative CLI target, so the MSVC build reuses it. */
function makefileSources(referenceDir) {
  const makefile = readFileSync(path.join(referenceDir, 'makefile'), 'utf8');
  const line = makefile.split(/\r?\n/).find((entry) => entry.startsWith('SRCS ='));
  if (!line) throw new Error('Could not find SRCS in the reference makefile.');
  return line.slice('SRCS ='.length).trim().split(/\s+/);
}

function buildWithMsvc(referenceDir) {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = execFileSync(
    vswhere,
    [
      '-latest',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath'
    ],
    { encoding: 'utf8' }
  ).trim();
  if (!installation) throw new Error('No Visual Studio installation with the C++ x64 toolset was found.');

  const sources = makefileSources(referenceDir).map((source) => source.replaceAll('/', '\\'));
  const vcvars = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  // /MP is omitted: parallel compilation of the template-heavy headers exhausts compiler heap and faults cl.exe.
  const script = [
    '@echo off',
    `call "${vcvars}" >nul`,
    'if not exist obj mkdir obj',
    `cl /nologo /std:c++20 /EHsc /O2 /bigobj /W0 /Isrc /Iinclude /D_WIN32_WINNT=0x0A00 /Foobj\\ /Fegw2combat.exe ${sources.join(' ')} ws2_32.lib wsock32.lib`,
    'exit /b %ERRORLEVEL%'
  ].join('\r\n');
  const scriptPath = path.join(referenceDir, 'build-msvc.bat');
  writeFileSync(scriptPath, script);
  run('cmd.exe', ['/d', '/c', scriptPath], { cwd: referenceDir });
}

export function buildReference(referenceDir = DEFAULT_REFERENCE_DIR) {
  checkout(referenceDir);
  if (process.platform === 'win32') buildWithMsvc(referenceDir);
  else run('make', ['-j'], { cwd: referenceDir });

  const executable = referenceExecutable(referenceDir);
  if (!existsSync(executable)) throw new Error(`Build finished without producing ${executable}.`);
  return executable;
}

if (import.meta.main) {
  const option = process.argv.find((argument) => argument.startsWith('--reference-dir='));
  const referenceDir = option ? path.resolve(option.split('=')[1]) : DEFAULT_REFERENCE_DIR;
  console.log(`Built ${buildReference(referenceDir)} at ${REFERENCE_REVISION}.`);
}
