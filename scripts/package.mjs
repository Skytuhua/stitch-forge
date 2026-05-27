// Builds a portable, relative-path web bundle and zips it as the release
// artifact. The bundle is a static site; serve it with any static file server
// (ES modules + the Web Worker require http(s), not file://).
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const version = pkg.version;
const stage = 'dist-zip';
const folder = `stitch-forge-${version}`;
const zipName = `stitch-forge-v${version}-web.zip`;

console.log('› type-check + build (relative base)…');
execSync('npx tsc --noEmit', { stdio: 'inherit' });
execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, BASE: './' } });

rmSync(stage, { recursive: true, force: true });
mkdirSync(`${stage}/${folder}`, { recursive: true });
cpSync('dist', `${stage}/${folder}`, { recursive: true });

writeFileSync(
  `${stage}/${folder}/HOW_TO_RUN.txt`,
  [
    'StitchForge — portable web build',
    '=================================',
    '',
    'This is a static site. Because it uses ES modules and a Web Worker, it must',
    'be served over http(s) — opening index.html directly via file:// will not',
    'work (browser module security).',
    '',
    'Quickest ways to run it locally:',
    '',
    '  • Node:    npx serve .        (then open the printed URL)',
    '  • Python:  python3 -m http.server 8080   → http://localhost:8080',
    '',
    'Everything runs in your browser. No image or data is uploaded anywhere.',
    '',
    `Version ${version} · MIT License · https://github.com/Skytuhua/stitch-forge`,
    '',
  ].join('\n'),
);

console.log('› zipping…');
rmSync(zipName, { force: true });
execSync(`cd ${stage} && zip -rq ../${zipName} ${folder}`, { stdio: 'inherit' });
execSync(`unzip -l ${zipName} | tail -3`, { stdio: 'inherit' });
console.log(`\n✓ ${zipName} ready`);
