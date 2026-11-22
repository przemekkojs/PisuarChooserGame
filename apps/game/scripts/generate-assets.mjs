// Deterministic, idempotent generator of the PLACEHOLDER art and audio.
// Run: node apps/game/scripts/generate-assets.mjs   (outputs are committed)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const pub = fileURLToPath(new URL('../public/', import.meta.url));
mkdirSync(resolve(pub, 'assets'), { recursive: true });
mkdirSync(resolve(pub, 'audio'), { recursive: true });

const C = {
  outline: '#0b0d12', door: '#8a5a2b', doorLight: '#b97d42', doorPanel: '#a06a36', doorDark: '#5e3a17',
  skin: '#f1c27d', skinLight: '#ffe0a8', porcelain: '#eef2f5', porcelainShade: '#b9c5d0',
  floor: '#9fb3c8', wet: '#3d8fd6', wetLight: '#8cc8f5', pee: '#e3c21b', peeLight: '#fff07a',
  person: '#6b4fa0', personLight: '#9376c9', smelly: '#4f8a2b', smellyLight: '#86c05a',
  hero: '#d35400', parent: '#1f8a8a', parentLight: '#4cc3c3', child: '#e84393', childLight: '#ff8ec4',
  shy: '#5d6d9a', shyLight: '#8d9bc4', splasher: '#16a0d0', splasherLight: '#7fe0ff', oos: '#c0392b', sign: '#f5d76e', heroLight: '#ff8a3d', pants: '#2c3e50', wall: '#2c3550', wallLight: '#3d4a70', tile: '#34405f',
  shadow: '#000000',
};
const O5 = `stroke="${C.outline}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const O4 = `stroke="${C.outline}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
const O = `stroke="${C.outline}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${body}\n</svg>\n`;
const shadow = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.shadow}" opacity="0.28"/>`;

const hand = () => svg(220, 220, `
<path d="M62 120 L62 60 a14 14 0 0 1 28 0 L90 40 a14 14 0 0 1 28 0 L118 40 a14 14 0 0 1 28 0 L146 62 a14 14 0 0 1 28 0 L174 130 Q174 196 112 196 Q62 196 62 150 Z" fill="${C.skin}" ${O}/>
<path d="M76 62 L76 110 M104 46 L104 100 M132 46 L132 100 M160 66 L160 110" stroke="${C.skinLight}" stroke-width="8" fill="none" stroke-linecap="round"/>
<path d="M62 120 Q40 120 40 100 Q40 84 62 96" fill="${C.skin}" ${O}/>`);

const door = () => svg(700, 1100, `
<rect x="14" y="20" width="672" height="1068" rx="16" fill="${C.shadow}" opacity="0.3"/>
<rect x="6" y="6" width="688" height="1070" rx="16" fill="${C.door}" ${O}/>
<rect x="12" y="12" width="676" height="26" rx="10" fill="${C.doorLight}"/>
<rect x="70" y="80" width="560" height="400" rx="10" fill="${C.doorPanel}" ${O}/>
<rect x="76" y="86" width="548" height="22" rx="6" fill="${C.doorLight}"/>
<rect x="70" y="560" width="560" height="440" rx="10" fill="${C.doorPanel}" ${O}/>
<rect x="76" y="566" width="548" height="22" rx="6" fill="${C.doorLight}"/>
<circle cx="76" cy="530" r="22" fill="${C.doorDark}" ${O}/>
<circle cx="600" cy="530" r="30" fill="#d9b94a" ${O}/>
<circle cx="591" cy="521" r="9" fill="#fff3b0"/>`);

const urinal = () => svg(160, 280, `
${shadow(86, 268, 62, 10)}
<path d="M20 40 Q20 10 80 10 Q140 10 140 40 L140 200 Q140 262 80 262 Q20 262 20 200 Z" fill="${C.porcelain}" ${O}/>
<path d="M32 44 Q32 24 80 24 Q128 24 128 44" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
<path d="M46 80 Q46 60 80 60 Q114 60 114 80 L114 190 Q114 232 80 232 Q46 232 46 190 Z" fill="${C.porcelainShade}" ${O}/>
<path d="M60 220 Q80 236 100 220" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.7" stroke-linecap="round"/>
<circle cx="80" cy="160" r="9" fill="${C.outline}"/>`);

const floor = (fill, light) => svg(200, 60, `
<path d="M6 54 L22 8 L178 8 L194 54 Z" fill="${fill}" ${O}/>
<path d="M26 14 L174 14" stroke="${light}" stroke-width="8" stroke-linecap="round"/>`);

const personBody = (fill, light, extra = '', scale = 1) => svg(160, 420, `
<g transform="translate(${80 - 80 * scale} ${420 - 420 * scale}) scale(${scale})">
${shadow(80, 408, 60, 9)}
<circle cx="80" cy="62" r="46" fill="${C.skin}" ${O}/>
<path d="M40 52 Q80 8 120 52 Q80 34 40 52 Z" fill="${C.outline}"/>
<circle cx="64" cy="64" r="6" fill="${C.outline}"/><circle cx="96" cy="64" r="6" fill="${C.outline}"/>
<path d="M62 86 Q80 98 98 86" fill="none" ${O5}/>
<path d="M26 130 Q26 112 80 112 Q134 112 134 130 L142 290 L18 290 Z" fill="${fill}" ${O}/>
<path d="M40 128 Q80 118 120 128" fill="none" stroke="${light}" stroke-width="10" stroke-linecap="round"/>
<rect x="30" y="290" width="46" height="112" rx="10" fill="${C.pants}" ${O}/>
<rect x="84" y="290" width="46" height="112" rx="10" fill="${C.pants}" ${O}/>
${extra}
</g>`);

const smellLines = `<path d="M30 20 q-14 -16 0 -30 M80 6 q-14 -16 0 -30 M130 20 q-14 -16 0 -30" fill="none" stroke="${C.smellyLight}" stroke-width="7" stroke-linecap="round" transform="translate(0 28)"/>`;
// Parent: wide shoulders and a tie. Child: same figure at 55% height, pink, big cap.
const parentExtra = `<path d="M80 118 L66 150 L80 270 L94 150 Z" fill="${C.parentLight}" ${O4}/>`;
const childExtra = `<circle cx="80" cy="22" r="26" fill="${C.childLight}" ${O5}/>`;
// Shy: hands covering the face.
const shyExtra = `<rect x="34" y="50" width="38" height="30" rx="12" fill="${C.skinLight}" ${O5}/><rect x="88" y="50" width="38" height="30" rx="12" fill="${C.skinLight}" ${O5}/>`;
// Splasher: water drops around the body.
const splasherExtra = `<path d="M10 150 q-12 22 0 40 q12 -18 0 -40 Z M150 190 q-12 22 0 40 q12 -18 0 -40 Z M12 250 q-10 18 0 32 q10 -14 0 -32 Z" fill="${C.wetLight}" ${O4}/>`;

// Out-of-order urinal: the urinal with a red sign across it.
const urinalOos = () => svg(160, 280, `
${shadow(86, 268, 62, 10)}
<path d="M20 40 Q20 10 80 10 Q140 10 140 40 L140 200 Q140 262 80 262 Q20 262 20 200 Z" fill="${C.porcelainShade}" ${O}/>
<path d="M46 80 Q46 60 80 60 Q114 60 114 80 L114 190 Q114 232 80 232 Q46 232 46 190 Z" fill="${C.porcelain}" ${O}/>
<rect x="4" y="100" width="152" height="84" rx="10" fill="${C.sign}" ${O}/>
<path d="M30 118 L130 166 M130 118 L30 166" stroke="${C.oos}" stroke-width="14" stroke-linecap="round"/>`);

const heroBody = (wet) => svg(220, 420, `
${shadow(110, 408, 80, 9)}
<circle cx="110" cy="66" r="52" fill="${C.skin}" ${O}/>
<path d="M58 56 Q110 0 162 56 Q110 34 58 56 Z" fill="#6b3b14" ${O4}/>
<circle cx="92" cy="68" r="7" fill="${C.outline}"/><circle cx="128" cy="68" r="7" fill="${C.outline}"/>
<path d="M90 92 Q110 ${wet ? '86' : '106'} 130 92" fill="none" ${O5}/>
<path d="M34 140 Q34 120 110 120 Q186 120 186 140 L196 290 L24 290 Z" fill="${C.hero}" ${O}/>
<path d="M52 138 Q110 126 168 138" fill="none" stroke="${C.heroLight}" stroke-width="10" stroke-linecap="round"/>
<rect x="38" y="290" width="62" height="112" rx="12" fill="${wet ? C.wet : C.pants}" ${O}/>
<rect x="120" y="290" width="62" height="112" rx="12" fill="${wet ? C.wet : C.pants}" ${O}/>
${wet ? `<path d="M40 300 L96 300 M124 300 L178 300" stroke="${C.wetLight}" stroke-width="8" stroke-linecap="round"/><path d="M70 330 q-10 20 0 40 q10 -20 0 -40 Z M150 330 q-10 20 0 40 q10 -20 0 -40 Z" fill="${C.wet}" ${O4}/>` : ''}`);

const bgWall = () => {
  let tiles = '';
  for (let y = 0; y < 1080; y += 120) {
    for (let x = (y / 120) % 2 ? -60 : 0; x < 1920; x += 120) {
      tiles += `<rect x="${x + 3}" y="${y + 3}" width="114" height="114" rx="8" fill="${C.wall}" stroke="${C.tile}" stroke-width="4"/>`;
    }
  }
  return svg(1920, 1080, `<rect width="1920" height="1080" fill="${C.wall}"/>\n${tiles}
<rect width="1920" height="1080" fill="${C.outline}" opacity="0.18"/>
<rect y="0" width="1920" height="40" fill="${C.wallLight}" opacity="0.5"/>`);
};

const bgFloor = () => {
  let lines = '';
  for (let x = 0; x <= 1920; x += 120) lines += `<path d="M${960 + (x - 960) * 0.4} 0 L${x} 380" stroke="${C.outline}" stroke-width="4" opacity="0.5"/>`;
  for (let i = 1; i < 5; i++) lines += `<path d="M0 ${i * i * 22} L1920 ${i * i * 22}" stroke="${C.outline}" stroke-width="4" opacity="0.5"/>`;
  return svg(1920, 380, `<rect width="1920" height="380" fill="${C.floor}"/>\n${lines}
<rect width="1920" height="14" fill="${C.outline}"/><rect y="14" width="1920" height="20" fill="#d3dfeb" opacity="0.7"/>`);
};

const images = {
  door, hand, urinal,
  floor_wet: () => floor(C.wet, C.wetLight),
  floor_pee: () => floor(C.pee, C.peeLight),
  person: () => personBody(C.person, C.personLight),
  person_smelly: () => personBody(C.smelly, C.smellyLight, smellLines),
  person_parent: () => personBody(C.parent, C.parentLight, parentExtra),
  person_child: () => personBody(C.child, C.childLight, childExtra, 0.55),
  person_shy: () => personBody(C.shy, C.shyLight, shyExtra),
  person_splasher: () => personBody(C.splasher, C.splasherLight, splasherExtra),
  urinal_oos: urinalOos,
  bg_wall: bgWall, bg_floor: bgFloor,
  hero: () => heroBody(false), hero_wet: () => heroBody(true),
};
for (const [k, f] of Object.entries(images)) writeFileSync(resolve(pub, 'assets', `${k}.svg`), f());

// 0.2 s of 16-bit PCM mono 22050 Hz silence.
function wav() {
  const rate = 22050;
  const samples = Math.round(rate * 0.2);
  const dataLen = samples * 2;
  const b = Buffer.alloc(44 + dataLen);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + dataLen, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii'); b.writeUInt32LE(dataLen, 40);
  return b;
}
for (const k of ['door_open', 'pick_good', 'pick_bad', 'pick_occupied', 'timeout', 'perk', 'tick']) {
  writeFileSync(resolve(pub, 'audio', `${k}.wav`), wav());
}
console.log('assets generated');
