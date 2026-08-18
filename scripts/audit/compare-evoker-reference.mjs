if (!process.argv.some((argument) => argument.startsWith('--suite='))) {
  process.argv.push('--suite=evoker');
}

await import('./compare-power-tempest-reference.mjs');
