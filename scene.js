import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// —— Determinism: every random draw goes through rand() ——
const SEED = 20261023;
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

// —— Palette: pastel clay + cyberpunk neon accents on soft gray ——
const C = {
  bg: 0xd8d8de,
  floor: 0xe6e2db,
  wall: 0xefede9,
  wallTrim: 0xd7d3cb,
  wood: 0xc9a06c,
  woodDark: 0xa87f4f,
  deskLeg: 0x8f8f99,
  gray: 0xb9b9c2,
  dark: 0x3a3a44,
  darker: 0x26262e,
  purple: 0xa06bff,
  purpleSoft: 0xc9adff,
  mint: 0x4fe3b0,
  mintSoft: 0xa9f2d8,
  pink: 0xff8fb8,
  pinkSoft: 0xffc4da,
  blue: 0x6ea8ff,
  yellow: 0xf5b942,
  plant: 0x58c47c,
  plantDark: 0x3da263,
  screen: 0x0d1220,
  bedding: 0xbfe8d8,
  blanket: 0x8fd8ff,
};

function clay(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0.0, ...opts });
}
function glow(color, intensity = 1) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.6, metalness: 0, emissive: color, emissiveIntensity: intensity,
  });
}
function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ============================================================
// Canvas texture painters
// ============================================================
function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  return tx;
}

// — editor-style code screen; the "typed" amount is driven by t ——
function paintCode(ctx, W, H, t, seed, cols) {
  const g = mulberry32(seed);
  ctx.fillStyle = '#131a30';
  ctx.fillRect(0, 0, W, H);
  // title bar
  ctx.fillStyle = '#1d2542';
  ctx.fillRect(0, 0, W, H * 0.075);
  const dots = ['#ff5f57', '#febc2e', '#28c840'];
  dots.forEach((d, i) => {
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(W * 0.035 + i * W * 0.032, H * 0.037, W * 0.009, 0, 7); ctx.fill();
  });
  // side gutter
  ctx.fillStyle = '#182038';
  ctx.fillRect(0, H * 0.075, W * 0.055, H);
  const lineH = H * 0.058;
  const lines = Math.floor((H * 0.9) / lineH);
  const cyc = (t % 10) / 10;           // 10s typing loop, full screen by 70%
  const typed = Math.min(lines, cyc * (lines / 0.7));
  const shownLines = Math.floor(typed);
  const palette = cols;
  for (let i = 0; i < shownLines; i++) {
    const y = H * 0.1 + i * lineH;
    // line number
    ctx.fillStyle = '#49538a';
    ctx.font = `600 ${Math.round(lineH * 0.55)}px monospace`;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), W * 0.012, y);
    const indent = Math.floor(g() * 4);
    let x = W * 0.075 + indent * W * 0.03;
    const segs = 2 + Math.floor(g() * 3);
    for (let s = 0; s < segs; s++) {
      const len = 3 + Math.floor(g() * 9);
      const w = len * W * 0.0125;
      // the line currently being typed fills partially
      const partial = i === shownLines - 1 ? Math.max(0.2, typed - shownLines) : 1;
      ctx.fillStyle = palette[Math.floor(g() * palette.length)];
      ctx.beginPath();
      ctx.roundRect(x, y - lineH * 0.3, w * partial, lineH * 0.6, lineH * 0.3);
      ctx.fill();
      x += w + W * 0.013;
      if (x > W * 0.94) break;
    }
  }
  // blinking caret at the active line
  if (Math.floor(t * 2) % 2 === 0 && shownLines > 0) {
    ctx.fillStyle = '#4fe3b0';
    const cy = H * 0.1 + Math.min(lines - 1, shownLines - 1) * lineH;
    ctx.fillRect(W * 0.075, cy - lineH * 0.32, W * 0.009, lineH * 0.64);
  }
}

// — animated pixel arcade screen (invaders-style), pure function of t ——
function paintArcade(ctx, W, H, t) {
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);
  const px = W / 32;
  // stars
  const g = mulberry32(7);
  ctx.fillStyle = '#26314f';
  for (let i = 0; i < 40; i++) {
    const sx = Math.floor(g() * 32), sy = Math.floor(g() * 24);
    if (Math.floor(t * 2 + i) % 3 !== 0) ctx.fillRect(sx * px, sy * px, px * 0.6, px * 0.6);
  }
  // invader rows drifting with period 6s
  const step = Math.floor(t * 2) % 4;          // 4-frame walk cycle, 2 steps per second
  const drift = Math.sin((t / 6) * Math.PI * 2) * W * 0.18;
  const invader = [
    '00100000100',
    '00010001000',
    '00111111100',
    '01101110110',
    '11111111111',
    '10111111101',
    '10100000101',
    '00011011000',
  ];
  const rows = [
    { y: 4, color: '#ff8fb8', flip: 0 },
    { y: 8, color: '#a06bff', flip: 1 },
    { y: 12, color: '#4fe3b0', flip: 0 },
  ];
  rows.forEach((r, ri) => {
    for (let c = 0; c < 3; c++) {
      const ox = W * 0.14 + c * W * 0.3 + drift * (ri % 2 ? -1 : 1);
      invader.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          if (row[xx] !== '1') continue;
          const alt = step % 2 === 1 && (yy === 6 || (yy === 7 && (xx < 3 || xx > 7)));
          if (alt && r.flip) continue;
          ctx.fillStyle = r.color;
          ctx.fillRect(ox + xx * px * 0.8, (r.y + yy * 0.8) * px, px * 0.75, px * 0.75);
        }
      });
    }
  });
  // player ship
  const ship = ['000010000', '000111000', '011111110'];
  const shipX = W / 2 + Math.sin(t * 1.4) * W * 0.22;
  ship.forEach((row, yy) => {
    for (let xx = 0; xx < row.length; xx++) {
      if (row[xx] === '1') {
        ctx.fillStyle = '#6ea8ff';
        ctx.fillRect(shipX + (xx - 4.5) * px * 0.9, H * 0.78 + yy * px * 0.9, px * 0.85, px * 0.85);
      }
    }
  });
  // laser (period 3s)
  const lt = (t % 3) / 3;
  const lx = shipX;
  ctx.fillStyle = '#f5b942';
  ctx.fillRect(lx, H * 0.78 - lt * H * 0.5, px * 0.5, H * 0.05);
}

// — retro game poster: pixel sunset over mountains ——
function paintPosterRetro(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2b2350'); sky.addColorStop(0.55, '#a06bff'); sky.addColorStop(1, '#ff8fb8');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  // sun with pixel stripes
  ctx.fillStyle = '#ffd166';
  const sr = W * 0.2, scx = W / 2, scy = H * 0.52;
  ctx.beginPath(); ctx.arc(scx, scy, sr, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff8fb8';
  for (let i = 0; i < 4; i++) ctx.fillRect(scx - sr, scy + i * sr * 0.28, sr * 2, sr * 0.09);
  // mountains
  ctx.fillStyle = '#1c1836';
  ctx.beginPath(); ctx.moveTo(0, H * 0.78); ctx.lineTo(W * 0.3, H * 0.5); ctx.lineTo(W * 0.62, H * 0.78); ctx.fill();
  ctx.fillStyle = '#141126';
  ctx.beginPath(); ctx.moveTo(W * 0.4, H * 0.8); ctx.lineTo(W * 0.72, H * 0.44); ctx.lineTo(W, H * 0.8); ctx.fill();
  // grid floor
  ctx.strokeStyle = 'rgba(79,227,176,.5)'; ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const y = H * 0.8 + i * i * 2.4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath(); ctx.moveTo(W / 2 + i * W * 0.06, H * 0.8); ctx.lineTo(W / 2 + i * W * 0.2, H); ctx.stroke();
  }
  // title
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(W * 0.11)}px "Space Grotesk",sans-serif`;
  ctx.fillText('NEON', W / 2, H * 0.16);
  ctx.fillText('VALLEY', W / 2, H * 0.27);
  ctx.font = `600 ${Math.round(W * 0.035)}px "JetBrains Mono",monospace`;
  ctx.fillStyle = '#4fe3b0';
  ctx.fillText('· PRESS START ·', W / 2, H * 0.34);
}

// — abstract UI wireframe poster ——
function paintPosterWire(ctx, W, H) {
  ctx.fillStyle = '#141726'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#2c3350'; ctx.lineWidth = 3;
  ctx.strokeRect(W * 0.06, H * 0.06, W * 0.88, H * 0.88);
  // browser dots
  ['#ff5f57', '#febc2e', '#28c840'].forEach((d, i) => {
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(W * (0.11 + i * 0.045), H * 0.115, W * 0.012, 0, 7); ctx.fill();
  });
  ctx.fillStyle = '#a06bff';
  ctx.fillRect(W * 0.09, H * 0.17, W * 0.34, H * 0.2);
  ctx.strokeStyle = '#4fe3b0';
  ctx.strokeRect(W * 0.47, H * 0.17, W * 0.42, H * 0.42);
  ctx.strokeStyle = '#2c3350';
  ctx.strokeRect(W * 0.09, H * 0.41, W * 0.34, H * 0.3);
  // skeleton lines
  ctx.fillStyle = '#3a4260';
  for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.12, H * (0.45 + i * 0.06), W * (0.24 - i * 0.04), H * 0.022);
  ctx.strokeStyle = '#ff8fb8';
  ctx.beginPath(); ctx.arc(W * 0.68, H * 0.38, W * 0.15, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W * 0.53, H * 0.62); ctx.lineTo(W * 0.83, H * 0.24); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(W * 0.07)}px "Space Grotesk",sans-serif`;
  ctx.fillText('UI/UX', W * 0.1, H * 0.86);
  ctx.fillStyle = '#4fe3b0';
  ctx.font = `600 ${Math.round(W * 0.03)}px "JetBrains Mono",monospace`;
  ctx.fillText('wireframe_02.fig', W * 0.1, H * 0.91);
}

// — tiny pixel controller poster ——
function paintPosterPad(ctx, W, H) {
  ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
  const px = W / 24;
  const pad = [
    '00001111111111110000',
    '00111111111111111100',
    '01111111111111111110',
    '11111011111111011111',
    '11111011111111011111',
    '11111111111111111111',
    '01111111111111111110',
    '00111111111111111100',
    '00001111111111110000',
  ];
  const colors = { 0: null, 1: '#3a3a44' };
  const ox = (W - pad[0].length * px) / 2, oy = H * 0.16;
  pad.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === '1') {
        ctx.fillStyle = colors[1];
        ctx.fillRect(ox + x * px, oy + y * px, px * 0.92, px * 0.92);
      }
    }
  });
  // dpad + buttons
  ctx.fillStyle = '#a06bff';
  ctx.fillRect(ox + 3 * px, oy + 3 * px, 3 * px, px); ctx.fillRect(ox + 4 * px, oy + 2 * px, px, 3 * px);
  [['#ff8fb8', 16, 3], ['#4fe3b0', 18, 2], ['#f5b942', 18, 4], ['#6ea8ff', 16, 5]].forEach(([c, x, y]) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(ox + (x + 0.5) * px, oy + (y + 0.5) * px, px * 0.62, 0, 7); ctx.fill();
  });
  ctx.fillStyle = '#3a3a44'; ctx.textAlign = 'center';
  ctx.font = `700 ${Math.round(W * 0.11)}px "Space Grotesk",sans-serif`;
  ctx.fillText('PLAY', W / 2, H * 0.82);
  ctx.font = `600 ${Math.round(W * 0.035)}px "JetBrains Mono",monospace`;
  ctx.fillStyle = '#a06bff';
  ctx.fillText('GAME JAM 2026', W / 2, H * 0.89);
}

function paintRug(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f2ece2';
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, W * 0.08); ctx.fill();
  const cells = 8;
  const cw = W / cells, ch = H / cells;
  const tints = ['#a06bff', '#4fe3b0', '#ff8fb8', '#f5b942'];
  const g = mulberry32(42);
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (g() < 0.42) {
        ctx.fillStyle = tints[Math.floor(g() * tints.length)];
        ctx.globalAlpha = 0.85;
        if (g() < 0.5) {
          ctx.beginPath(); ctx.arc(x * cw + cw / 2, y * ch + ch / 2, cw * 0.32, 0, 7); ctx.fill();
        } else {
          ctx.fillRect(x * cw + cw * 0.2, y * ch + ch * 0.2, cw * 0.6, ch * 0.6);
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  ctx.strokeStyle = '#e0d7c8'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.roundRect(5, 5, W - 10, H - 10, W * 0.07); ctx.stroke();
}

function paintSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fdf6e3'); g.addColorStop(0.5, '#ffe9c9'); g.addColorStop(1, '#ffd9e8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  const g2 = mulberry32(3);
  for (let i = 0; i < 6; i++) {
    const cx = g2() * W, cy = g2() * H * 0.6, r = W * (0.06 + g2() * 0.08);
    for (let b = 0; b < 4; b++) {
      ctx.beginPath(); ctx.arc(cx + (g2() - 0.5) * r * 2, cy + (g2() - 0.5) * r, r * (0.5 + g2() * 0.5), 0, 7); ctx.fill();
    }
  }
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(W * 0.72, H * 0.3, W * 0.09, 0, 7); ctx.fill();
}

function paintLightPatch(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(255,240,200,.26)');
  g.addColorStop(0.6, 'rgba(255,240,200,.10)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function paintMarquee(ctx, W, H) {
  ctx.fillStyle = '#1a1030'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#a06bff'; ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.fillStyle = '#4fe3b0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(H * 0.42)}px "Space Grotesk",sans-serif`;
  ctx.fillText('PIXEL', W / 2, H * 0.36);
  ctx.fillStyle = '#ff8fb8';
  ctx.fillText('QUEST', W / 2, H * 0.72);
}

// ============================================================
// Renderer / camera / lights
// ============================================================
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
} catch (e) {
  document.getElementById('fallback').style.display = 'grid';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.Fog(C.bg, 34, 90);

// frame so the whole room fits at any aspect ratio (portrait phones zoom out)
function fitView() {
  const a = innerWidth / innerHeight;
  return Math.max(6.2, 9.0 / a);
}
let aspect = innerWidth / innerHeight;
let VIEW = fitView();
const camera = new THREE.OrthographicCamera(-VIEW * aspect, VIEW * aspect, VIEW, -VIEW, -60, 120);
camera.position.set(15, 16.5, 15);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.2, 1.7, -0.4);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minZoom = 0.75;
controls.maxZoom = 2.4;
controls.minPolarAngle = 0.72;
controls.maxPolarAngle = 1.22;
controls.minAzimuthAngle = 0.35;
controls.maxAzimuthAngle = 1.25;
controls.update();

scene.add(new THREE.HemisphereLight(0xeef2ff, 0xb8ac9c, 0.75));
const key = new THREE.DirectionalLight(0xfff1d6, 1.5);
key.position.set(9, 15, 11);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -11; key.shadow.camera.right = 11;
key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
key.shadow.camera.far = 45;
key.shadow.bias = -0.0004;
scene.add(key);

// warm shaft of "sun" through the window + mint arcade spill + purple desk glow
const shaft = new THREE.SpotLight(0xffe9bb, 160, 0, 0.62, 0.9, 1.6);
shaft.position.set(-1.8, 4.2, -7.5);
shaft.target.position.set(-0.6, 0, 2.6);
scene.add(shaft, shaft.target);

const arcadeLight = new THREE.PointLight(C.mint, 26, 7, 1.9);
arcadeLight.position.set(5.1, 2.4, -3.3);
scene.add(arcadeLight);
const deskLight = new THREE.PointLight(C.purple, 20, 6.5, 1.9);
deskLight.position.set(1.2, 1.6, -3.1);
scene.add(deskLight);
const monitorLight = new THREE.PointLight(0x9fc4ff, 14, 5, 1.9);
monitorLight.position.set(1.4, 2.4, -3.2);
scene.add(monitorLight);

// infinite neutral ground so no horizon edge is ever visible
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(400, 64).rotateX(-Math.PI / 2),
  clay(0xd3d3da));
ground.position.y = -0.52;
ground.receiveShadow = true;
scene.add(ground);

// ============================================================
// Room shell  (interior x:-6..6, z:-5..5, open top/front/right)
// ============================================================
const room = new THREE.Group();
scene.add(room);

const floorMat = clay(C.floor);
const floor = box(12, 0.5, 10, floorMat);
floor.position.set(0, -0.25, 0);
room.add(floor);

const backWall = box(12, 4.8, 0.3, clay(C.wall));
backWall.position.set(0, 2.4, -5.15);
room.add(backWall);
const leftWall = box(0.3, 4.8, 10, clay(C.wall));
leftWall.position.set(-6.15, 2.4, 0);
room.add(leftWall);
// baseboards
const bb1 = box(12, 0.22, 0.1, clay(C.wallTrim)); bb1.position.set(0, 0.11, -4.97); room.add(bb1);
const bb2 = box(0.1, 0.22, 10, clay(C.wallTrim)); bb2.position.set(-5.97, 0.11, 0); room.add(bb2);

// —— window on the back wall with volumetric light ——
const winG = new THREE.Group();
winG.position.set(-1.9, 2.6, -4.98);
room.add(winG);
{
  const fw = 2.9, fh = 2.6, ft = 0.14, fd = 0.22;
  const frameMat = clay(0xfaf8f4);
  const top = box(fw, ft, fd, frameMat); top.position.set(0, fh / 2 - ft / 2, 0);
  const bot = box(fw, ft, fd, frameMat); bot.position.set(0, -fh / 2 + ft / 2, 0);
  const lft = box(ft, fh, fd, frameMat); lft.position.set(-fw / 2 + ft / 2, 0, 0);
  const rgt = box(ft, fh, fd, frameMat); rgt.position.set(fw / 2 - ft / 2, 0, 0);
  const midV = box(ft * 0.7, fh, fd * 0.8, frameMat);
  const midH = box(fw, ft * 0.7, fd * 0.8, frameMat);
  winG.add(top, bot, lft, rgt, midV, midH);
  // sill
  const sill = box(fw + 0.3, 0.09, 0.4, frameMat); sill.position.set(0, -fh / 2 - 0.045, 0.12);
  winG.add(sill);
  // glass + sky
  const skyTex = canvasTex(256, 256, paintSky);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(fw - ft, fh - ft),
    new THREE.MeshBasicMaterial({ map: skyTex }));
  sky.position.z = -0.05;
  winG.add(sky);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw - ft, fh - ft),
    new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.16 }));
  glass.position.z = 0.02;
  winG.add(glass);
}
// volumetric cone + floor patch
const coneMat = new THREE.MeshBasicMaterial({
  color: 0xffe9b8, transparent: true, opacity: 0.16,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
});
const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8.2, 32, 1, true), coneMat);
cone.position.set(-1.6, 2.1, -1.5);
cone.rotation.x = -(Math.PI - 1.12);
cone.rotation.z = 0.08;
scene.add(cone);
const patchTex = canvasTex(256, 256, paintLightPatch);
const patch = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4),
  new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, depthWrite: false }));
patch.rotation.x = -Math.PI / 2;
patch.position.set(-1.6, 0.013, -3.3);
scene.add(patch);

// dust motes drifting in the light shaft (positions are a pure function of t)
const DUST_N = 70;
const dustGeo = new THREE.BufferGeometry();
const dustBase = new Float32Array(DUST_N * 3);
{
  const g = mulberry32(99);
  for (let i = 0; i < DUST_N; i++) {
    dustBase[i * 3] = -1.6 + g() * 3.2;
    dustBase[i * 3 + 1] = g() * 4;
    dustBase[i * 3 + 2] = -3.6 + g() * 4.6;
  }
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustBase.slice(), 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xfff8e0, size: 0.1, transparent: true, opacity: 0.85,
  depthWrite: false,
}));
scene.add(dust);

// —— posters (repainted once webfonts finish loading) ——
const posterRepaints = [];
function poster(painter, w, h, pos, rotY) {
  const tex = canvasTex(256, Math.round(256 * h / w), painter);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.position.copy(pos); m.rotation.y = rotY;
  const frame = box(w + 0.12, h + 0.12, 0.05, clay(0xfbfaf7));
  frame.position.copy(pos); frame.rotation.y = rotY;
  frame.translateZ(-0.03);
  room.add(frame, m);
  posterRepaints.push(() => {
    painter(tex.image.getContext('2d'), tex.image.width, tex.image.height);
    tex.needsUpdate = true;
  });
  return m;
}
poster(paintPosterRetro, 1.35, 1.85, new THREE.Vector3(1.15, 2.9, -4.96), 0);
poster(paintPosterWire, 1.5, 1.05, new THREE.Vector3(-4.6, 2.9, -4.96), 0);
poster(paintPosterPad, 1.0, 1.35, new THREE.Vector3(-5.96, 2.7, 2.3), Math.PI / 2);

// —— neon bolt sign above the desk ——
const boltShape = new THREE.Shape();
boltShape.moveTo(0.05, 0.5); boltShape.lineTo(-0.28, -0.05); boltShape.lineTo(-0.04, -0.05);
boltShape.lineTo(-0.12, -0.5); boltShape.lineTo(0.28, 0.08); boltShape.lineTo(0.03, 0.08);
boltShape.closePath();
const boltGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.06, bevelEnabled: false });
const boltMat = glow(C.purple, 1.6);
const bolt = new THREE.Mesh(boltGeo, boltMat);
bolt.position.set(2.7, 3.6, -4.9);
room.add(bolt);

// ============================================================
// Desk area (L-shaped, back-right) — monitors, laptop, keyboard,
// controller, plant, chair, LED strip
// ============================================================
const deskG = new THREE.Group();
room.add(deskG);
{
  const wood = clay(C.wood);
  const main = box(5.2, 0.16, 1.5, wood);          // along back wall
  main.position.set(0.9, 1.16, -4.1);
  const ret = box(1.5, 0.16, 2.6, wood);           // return toward viewer
  ret.position.set(2.75, 1.16, -2.85);
  deskG.add(main, ret);
  // legs
  const legMat = clay(C.deskLeg);
  [[-1.3, -4.55], [3.1, -4.55], [-1.3, -3.65], [3.1, -3.65], [2.12, -1.75], [3.38, -1.75]]
    .forEach(([x, z]) => {
      const l = box(0.12, 1.08, 0.12, legMat); l.position.set(x, 0.54, z); deskG.add(l);
    });
  // purple LED strip under the front edge
  const strip = box(5.0, 0.035, 0.035, glow(C.purple, 2.2));
  strip.position.set(0.9, 1.06, -3.36);
  deskG.add(strip);
}

// —— dual monitors with live code ——
const codePalettes = [
  ['#a06bff', '#4fe3b0', '#6ea8ff', '#ff8fb8', '#e8e8f0'],
  ['#4fe3b0', '#f5b942', '#a06bff', '#e8e8f0', '#6ea8ff'],
];
const codeScreens = [];
function monitor(x, z, rotY, seed, palIdx, big) {
  const g = new THREE.Group();
  g.position.set(x, 1.24, z); g.rotation.y = rotY;
  const w = big ? 1.55 : 1.35, h = big ? 0.95 : 0.85;
  // stand
  const pole = cyl(0.035, 0.035, 0.5, clay(C.dark)); pole.position.y = 0.25;
  const foot = box(0.4, 0.04, 0.28, clay(C.dark)); foot.position.y = 0.02;
  // bezel + screen
  const bez = box(w + 0.07, h + 0.07, 0.05, clay(0x1c1c24));
  bez.position.y = 0.55 + h / 2;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 0.55 + h / 2, 0.028);
  g.add(pole, foot, bez, scr);
  codeScreens.push({ ctx, tex, seed, cols: codePalettes[palIdx] });
  deskG.add(g);
  return g;
}
monitor(0.35, -4.28, 0.16, 11, 0, true);
monitor(1.95, -4.3, -0.14, 23, 1, true);

// —— laptop ——
{
  const g = new THREE.Group();
  g.position.set(-0.55, 1.24, -3.95); g.rotation.y = 0.3;
  const base = box(0.78, 0.045, 0.52, clay(0x9a9aa6));
  const lid = box(0.78, 0.52, 0.03, clay(0x35353f));
  lid.position.set(0, 0.26, -0.26); lid.rotation.x = -0.32;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 170;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45),
    new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 0.26, -0.243); scr.rotation.x = -0.32;
  g.add(base, lid, scr);
  codeScreens.push({ ctx, tex, seed: 37, cols: codePalettes[1] });
  deskG.add(g);
}

// —— mechanical keyboard ——
{
  const g = new THREE.Group();
  g.position.set(0.55, 1.24, -3.42); g.rotation.y = 0.05;
  const base = box(0.95, 0.07, 0.36, clay(0xf0eef5));
  base.position.y = 0.035;
  g.add(base);
  const capCols = [C.dark, C.purpleSoft, C.mintSoft, C.pinkSoft, C.gray];
  const g2 = mulberry32(5);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 13; c++) {
      const accent = g2() < 0.14;
      const cap = box(0.058, 0.045, 0.058,
        clay(accent ? capCols[1 + Math.floor(g2() * 4)] : capCols[0]));
      cap.position.set(-0.41 + c * 0.068, 0.09, -0.115 + r * 0.075);
      g.add(cap);
    }
  }
  const space = box(0.34, 0.045, 0.058, clay(C.dark));
  space.position.set(0, 0.09, 0.14);
  g.add(space);
  deskG.add(g);
}

// —— game controller ——
{
  const g = new THREE.Group();
  g.position.set(2.75, 1.28, -3.7); g.rotation.y = -0.5;
  const body = box(0.34, 0.09, 0.2, clay(C.purpleSoft));
  body.position.y = 0.045;
  const gripL = cyl(0.07, 0.085, 0.18, clay(C.purpleSoft)); gripL.rotation.z = 0.35; gripL.position.set(-0.17, 0.02, 0.03);
  const gripR = cyl(0.07, 0.085, 0.18, clay(C.purpleSoft)); gripR.rotation.z = -0.35; gripR.position.set(0.17, 0.02, 0.03);
  g.add(body, gripL, gripR);
  // sticks
  [[-0.07, 0.05], [0.09, -0.04]].forEach(([x, z]) => {
    const st = cyl(0.016, 0.016, 0.05, clay(C.dark)); st.position.set(x, 0.11, z);
    const tp = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), clay(C.dark));
    tp.position.set(x, 0.145, z); tp.castShadow = true;
    g.add(st, tp);
  });
  // dpad + buttons
  const dp1 = box(0.075, 0.02, 0.025, clay(C.dark)); dp1.position.set(-0.115, 0.1, -0.05);
  const dp2 = box(0.025, 0.02, 0.075, clay(C.dark)); dp2.position.set(-0.115, 0.1, -0.05);
  g.add(dp1, dp2);
  [['#ff8fb8', 0.135, -0.055], ['#4fe3b0', 0.175, -0.02], ['#f5b942', 0.135, 0.015], ['#6ea8ff', 0.095, -0.02]]
    .forEach(([c, x, z]) => {
      const b = cyl(0.016, 0.016, 0.02, glow(new THREE.Color(c).getHex(), 0.25));
      b.position.set(x, 0.1, z);
      g.add(b);
    });
  deskG.add(g);
}

// —— desk plant ——
const plantG = new THREE.Group();
plantG.position.set(2.75, 1.24, -1.85);
{
  const pot = cyl(0.13, 0.1, 0.2, clay(0xd98c6a));
  pot.position.y = 0.1;
  plantG.add(pot);
  const leaves = new THREE.Group();
  leaves.position.y = 0.2;
  const g = mulberry32(17);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), clay(i % 2 ? C.plant : C.plantDark));
    leaf.scale.set(0.55, 1.35, 0.55);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.06, 0.16 + g() * 0.1, Math.sin(a) * 0.06);
    leaf.rotation.set(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45);
    leaf.castShadow = true;
    leaves.add(leaf);
  }
  plantG.add(leaves);
  plantG.userData.leaves = leaves;
  deskG.add(plantG);
}

// —— chair ——
{
  const g = new THREE.Group();
  g.position.set(1.1, 0, -2.35); g.rotation.y = 0.45;
  const seat = box(0.62, 0.09, 0.58, clay(C.mintSoft)); seat.position.y = 0.62;
  const back = box(0.58, 0.72, 0.09, clay(C.mintSoft)); back.position.set(0, 1.02, -0.27); back.rotation.x = 0.12;
  const stem = cyl(0.04, 0.04, 0.55, clay(C.dark)); stem.position.y = 0.32;
  const base = cyl(0.3, 0.34, 0.05, clay(C.dark)); base.position.y = 0.03;
  g.add(seat, back, stem, base);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), clay(C.dark));
    wheel.position.set(Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32);
    wheel.castShadow = true;
    g.add(wheel);
  }
  room.add(g);
}

// ============================================================
// Arcade cabinet (back-right corner) with animated pixel screen
// ============================================================
const arcadeG = new THREE.Group();
arcadeG.position.set(5.2, 0, -4.2);
arcadeG.rotation.y = 0.55;
room.add(arcadeG);
const arcadeScr = { ctx: null, tex: null };
{
  const body = box(1.05, 2.15, 0.85, clay(C.purpleSoft));
  body.position.y = 1.075;
  const base = box(1.1, 0.18, 0.9, clay(C.purple)); base.position.y = 0.09;
  // angled control deck
  const deck = box(1.0, 0.12, 0.5, clay(C.darker)); deck.position.set(0, 1.02, 0.42); deck.rotation.x = 0.35;
  // screen bezel + animated screen
  const bez = box(0.92, 0.78, 0.08, clay(C.darker)); bez.position.set(0, 1.62, 0.4);
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 200;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.62),
    new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(0, 1.62, 0.445);
  // marquee
  const marqTex = canvasTex(256, 96, paintMarquee);
  posterRepaints.push(() => {
    paintMarquee(marqTex.image.getContext('2d'), 256, 96);
    marqTex.needsUpdate = true;
  });
  const marq = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34),
    new THREE.MeshBasicMaterial({ map: marqTex }));
  marq.position.set(0, 2.02, 0.43); marq.rotation.x = 0.06;
  const marqBox = box(1.0, 0.42, 0.1, clay(C.darker)); marqBox.position.set(0, 2.02, 0.37); marqBox.rotation.x = 0.06;
  arcadeG.add(body, base, deck, bez, scr, marq, marqBox);
  arcadeScr.ctx = ctx; arcadeScr.tex = tex;
  // joystick + buttons on deck
  const stick = cyl(0.02, 0.02, 0.14, clay(0x888890)); stick.position.set(-0.22, 1.14, 0.48); stick.rotation.x = 0.35;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), glow(C.pink, 0.35));
  ball.position.set(-0.22, 1.22, 0.52); ball.castShadow = true;
  arcadeG.add(stick, ball);
  [['#4fe3b0', -0.02, 0.44], ['#f5b942', 0.12, 0.5], ['#6ea8ff', 0.24, 0.42]].forEach(([c, x, z]) => {
    const b = cyl(0.035, 0.035, 0.03, glow(new THREE.Color(c).getHex(), 0.3));
    b.position.set(x, 1.13, z); b.rotation.x = 0.35;
    arcadeG.add(b);
  });
  // coin slot
  const coin = box(0.16, 0.22, 0.02, clay(0x14141a)); coin.position.set(0, 0.62, 0.43);
  arcadeG.add(coin);
}
// floating pixel sparks above the cabinet
const sparks = [];
{
  const g = mulberry32(64);
  for (let i = 0; i < 6; i++) {
    const s = box(0.07, 0.07, 0.07, glow([C.mint, C.purple, C.pink][i % 3], 1.2));
    s.userData = { a: g() * Math.PI * 2, r: 0.4 + g() * 0.35, h: 2.4 + g() * 0.7, sp: 0.5 + g() * 0.8 };
    sparks.push(s);
    arcadeG.add(s);
  }
}

// ============================================================
// Bed (left, back) + bookshelf (left, front) + rug
// ============================================================
{
  const g = new THREE.Group();
  g.position.set(-5.15, 0, -3.15); g.rotation.y = -Math.PI / 2;
  const frame = box(2.7, 0.32, 1.7, clay(C.woodDark)); frame.position.y = 0.28;
  const mattress = box(2.6, 0.26, 1.6, clay(0xfbfaf6)); mattress.position.y = 0.55;
  const head = box(0.12, 1.15, 1.7, clay(C.wood)); head.position.set(-1.38, 0.7, 0);
  const pillow = box(0.55, 0.16, 0.75, clay(0xffffff)); pillow.position.set(-0.95, 0.76, 0);
  const blanket = box(1.7, 0.14, 1.66, clay(C.blanket)); blanket.position.set(0.42, 0.72, 0);
  const fold = box(0.34, 0.06, 1.66, clay(0x6fc7f2)); fold.position.set(-0.38, 0.78, 0);
  g.add(frame, mattress, head, pillow, blanket, fold);
  [[-1.3, -0.75], [-1.3, 0.75], [1.3, -0.75], [1.3, 0.75]].forEach(([x, z]) => {
    const leg = box(0.1, 0.16, 0.1, clay(C.woodDark)); leg.position.set(x, 0.08, z); g.add(leg);
  });
  room.add(g);
}
{
  const g = new THREE.Group();
  g.position.set(-5.68, 0, 0.9);
  const W = 1.05, H = 2.7, D = 0.42;
  const sideL = box(0.06, H, D, clay(C.wood)); sideL.position.set(0, H / 2, -W / 2 + 0.03);
  const sideR = box(0.06, H, D, clay(C.wood)); sideR.position.set(0, H / 2, W / 2 - 0.03);
  const backp = box(D, H, W, clay(0x9a7a52)); backp.position.set(-D / 2 + 0.02, H / 2, 0);
  g.add(sideL, sideR, backp);
  const bookCols = [C.purple, C.mint, C.pink, C.blue, C.yellow, C.dark, 0x8a8a94, C.purpleSoft];
  for (let s = 0; s < 4; s++) {
    const y = 0.28 + s * 0.66;
    const shelf = box(D, 0.05, W, clay(C.wood)); shelf.position.set(0, y, 0);
    g.add(shelf);
    if (s === 3) { // tiny plant + clock on top shelf
      const pot = cyl(0.08, 0.06, 0.13, clay(0xd98c6a)); pot.position.set(0.02, y + 0.09, -0.25);
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), clay(C.plant));
      bl.position.set(0.02, y + 0.24, -0.25); bl.castShadow = true;
      g.add(pot, bl);
      break;
    }
    const g2 = mulberry32(100 + s);
    let z = -W / 2 + 0.09;
    while (z < W / 2 - 0.14) {
      const bw = 0.05 + g2() * 0.05;
      const bh = 0.3 + g2() * 0.22;
      const lean = g2() < 0.12;
      const b = box(0.26, bh, bw, clay(bookCols[Math.floor(g2() * bookCols.length)]));
      b.position.set(0.05, y + 0.03 + bh / 2, z + bw / 2);
      if (lean) b.rotation.x = 0.18;
      g.add(b);
      z += bw + 0.015;
      if (g2() < 0.18) z += 0.08; // gap with a horizontal stack
    }
    if (s === 1) { // horizontal stack
      for (let i = 0; i < 3; i++) {
        const hb = box(0.26, 0.045, 0.4, clay(bookCols[(i + 2) % bookCols.length]));
        hb.position.set(0.05, y + 0.055 + i * 0.05, W / 2 - 0.3);
        g.add(hb);
      }
    }
  }
  const top = box(D, 0.05, W, clay(C.wood)); top.position.set(0, H, 0);
  g.add(top);
  room.add(g);
}
{
  const rugTex = canvasTex(512, 384, paintRug);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4),
    new THREE.MeshStandardMaterial({ map: rugTex, transparent: true, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.rotation.z = 0.12;
  rug.position.set(0.2, 0.015, 0.6);
  rug.receiveShadow = true;
  room.add(rug);
}

// ============================================================
// Hotspots (raycast targets + pulsing markers)
// ============================================================
const HOTSPOTS = [
  {
    id: 'desk', label: 'Dev Desk', tag: 'WebGL · Tooling', title: 'Nebula Engine',
    body: 'A tiny WebGL engine with entity-component structure, post-processing and a node-based material editor. Born at this exact desk, fueled by mint tea.',
    stack: ['Three.js', 'TypeScript', 'GLSL', 'Vite'],
    link: 'https://github.com/alexchen-dev/nebula-engine',
    anchor: new THREE.Vector3(1.2, 2.4, -3.9), cam: [7.4, 5.4, 4.6], tgt: [1.0, 1.5, -3.7], zoom: 2.1,
  },
  {
    id: 'arcade', label: 'Arcade Cabinet', tag: 'Game Dev · JS', title: 'Pixel Quest',
    body: 'A browser-native arcade run-and-gun in hand-rolled Canvas. 60 fps on a potato, chiptune soundtrack included. The cabinet itself is the level-select menu.',
    stack: ['Canvas 2D', 'Web Audio', 'PWA'],
    link: 'https://alexchen.itch.io/pixel-quest',
    anchor: new THREE.Vector3(5.2, 2.9, -3.5), cam: [9.8, 5.4, 3.4], tgt: [5.1, 1.7, -3.9], zoom: 2.1,
  },
  {
    id: 'bed', label: 'Cozy Corner', tag: 'Life · Balance', title: 'Debug & Decompress',
    body: 'Where the best bugs get solved — half asleep at 2 a.m. The blanket fold is load-bearing and the pillow has seen three game jams.',
    stack: ['REM sleep', 'Lucid dreaming', 'Speedruns'],
    link: 'https://alexchen.itch.io',
    anchor: new THREE.Vector3(-4.9, 1.9, -3.0), cam: [3.4, 6.4, 7.4], tgt: [-4.9, 0.9, -3.1], zoom: 1.9,
  },
  {
    id: 'shelf', label: 'Bookshelf', tag: 'Learning · Craft', title: 'The Library',
    body: 'Game Programming Patterns, the Dragon Book, and a very worn copy of The Art of Game Design. Re-read yearly; annotated heavily.',
    stack: ['Design patterns', 'Computer graphics', 'Level design'],
    link: 'https://github.com/alexchen-dev/reading-list',
    anchor: new THREE.Vector3(-5.3, 3.0, 0.9), cam: [2.6, 4.8, 6.4], tgt: [-5.5, 1.5, 0.9], zoom: 2.0,
  },
  {
    id: 'window', label: 'Window Light', tag: 'Studio · Mood', title: 'Golden Hour Studio',
    body: 'North-facing light from 3 to 6 p.m. — prime shader-tuning hours. Volumetric fog optional, coffee mandatory.',
    stack: ['Lighting', 'Procrastination', 'Photography'],
    link: 'mailto:hello@alexchen.dev',
    anchor: new THREE.Vector3(-1.9, 3.2, -4.6), cam: [6.2, 6.2, 6.2], tgt: [-1.9, 2.4, -4.8], zoom: 2.0,
  },
];
const spotMeshes = [];
const ringGeo = new THREE.TorusGeometry(0.16, 0.028, 10, 28);
HOTSPOTS.forEach((h, i) => {
  const ring = new THREE.Mesh(ringGeo, glow(i % 2 ? C.mint : C.purple, 1.5));
  ring.position.copy(h.anchor);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  h.ring = ring;
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.copy(h.anchor);
  hit.userData.hs = h;
  scene.add(hit);
  spotMeshes.push(hit);
});

// ============================================================
// UI wiring — tooltip, panel, hotspot buttons, camera views
// ============================================================
const tip = document.getElementById('tip');
const panel = document.getElementById('panel');
const spotsEl = document.getElementById('spots');
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
let hovered = null, activeHs = null;

HOTSPOTS.forEach((h) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span class="dot"></span>${h.label}`;
  b.addEventListener('click', () => selectHotspot(h, b));
  spotsEl.appendChild(b);
  h.btn = b;
});

function selectHotspot(h, btn) {
  activeHs = h;
  document.getElementById('panelTag').textContent = h.tag;
  document.getElementById('panelTitle').textContent = h.title;
  document.getElementById('panelBody').textContent = h.body;
  document.getElementById('panelStack').innerHTML = h.stack.map(s => `<span>${s}</span>`).join('');
  const a = document.getElementById('panelLink');
  a.href = h.link;
  a.style.display = h.link ? '' : 'none';
  panel.classList.add('open');
  HOTSPOTS.forEach(x => x.btn.setAttribute('aria-pressed', x === h ? 'true' : 'false'));
  flyTo(h.cam, h.tgt, h.zoom || 1);
}
function closePanel() {
  panel.classList.remove('open');
  activeHs = null;
  HOTSPOTS.forEach(x => x.btn.setAttribute('aria-pressed', 'false'));
}
document.getElementById('panelClose').addEventListener('click', closePanel);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

const VIEWS = {
  iso: { cam: [15, 16.5, 15], tgt: [0.2, 1.7, -0.4], zoom: 1 },
  desk: { cam: [7.4, 5.4, 4.6], tgt: [1.0, 1.5, -3.7], zoom: 2.1 },
  arcade: { cam: [9.8, 5.4, 3.4], tgt: [5.1, 1.7, -3.9], zoom: 2.1 },
  bed: { cam: [3.4, 6.4, 7.4], tgt: [-4.9, 0.9, -3.1], zoom: 1.9 },
};
let flyTarget = null;
function flyTo(cam, tgt, zoom = 1) {
  flyTarget = { cam: new THREE.Vector3(...cam), tgt: new THREE.Vector3(...tgt), zoom };
}
document.querySelectorAll('#views button').forEach(b => {
  b.addEventListener('click', () => {
    const v = VIEWS[b.dataset.view];
    flyTo(v.cam, v.tgt, v.zoom);
    document.querySelectorAll('#views button').forEach(x =>
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  });
});

renderer.domElement.addEventListener('pointermove', (e) => {
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  tip.style.left = e.clientX + 'px';
  tip.style.top = e.clientY + 'px';
});
renderer.domElement.addEventListener('pointerdown', () => {
  if (hovered) selectHotspot(hovered, hovered.btn);
});
function updateHover() {
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(spotMeshes, false)[0];
  hovered = hit ? hit.object.userData.hs : null;
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  tip.textContent = hovered ? `${hovered.label} · ${hovered.title}` : '';
  tip.classList.toggle('on', !!hovered);
}

// ============================================================
// Time model — the scene is a pure function of t (12 s loop)
// ============================================================
const DURATION = 12;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function updateCodeScreen(s, t) {
  paintCode(s.ctx, s.ctx.canvas.width, s.ctx.canvas.height, t, s.seed, s.cols);
  s.tex.needsUpdate = true;
}
function updateArcade(t) {
  paintArcade(arcadeScr.ctx, 256, 200, t);
  arcadeScr.tex.needsUpdate = true;
}

let lastCodeStep = -1, lastArcadeStep = -1;
function sample(t) {
  // screens re-paint at 8 fps (quantized so seek(t) is deterministic)
  const cs = Math.floor(t * 8);
  if (cs !== lastCodeStep) {
    lastCodeStep = cs;
    codeScreens.forEach(s => updateCodeScreen(s, t));
    updateArcade(t);
  }
  const ph = (t / DURATION) * Math.PI * 2;
  // plant sway (6 s period)
  plantG.userData.leaves.rotation.z = 0.06 * Math.sin(ph * 2);
  plantG.userData.leaves.rotation.x = 0.04 * Math.sin(ph * 2 + 1.3);
  // neon + screen glow breathing (3 s period)
  const br = 0.85 + 0.15 * Math.sin(ph * 4);
  boltMat.emissiveIntensity = 1.5 * br + 0.25;
  deskLight.intensity = 18 + 5 * Math.sin(ph * 4 + 0.6);
  arcadeLight.intensity = 22 + 8 * Math.sin(ph * 4 + 2.1);
  monitorLight.intensity = 12 + 4 * Math.sin(ph * 4 + 4);
  // dust drifts down the light shaft, loops seamlessly
  const pos = dustGeo.attributes.position;
  for (let i = 0; i < DUST_N; i++) {
    const bx = dustBase[i * 3], by = dustBase[i * 3 + 1], bz = dustBase[i * 3 + 2];
    pos.array[i * 3] = bx + Math.sin(ph * 3 + i) * 0.12;
    pos.array[i * 3 + 1] = 0.3 + ((by - t * 0.22 + 4) % 4);
    pos.array[i * 3 + 2] = bz + Math.cos(ph * 2 + i * 1.7) * 0.1;
  }
  pos.needsUpdate = true;
  // hotspot rings pulse (2 s period)
  HOTSPOTS.forEach((h, i) => {
    const p = 1 + 0.22 * Math.sin(ph * 6 + i * 1.1);
    h.ring.scale.setScalar(p);
    h.ring.rotation.z = ph * 3 + i;
    h.ring.material.emissiveIntensity = activeHs === h ? 2.6 : 1.4 + 0.3 * Math.sin(ph * 6 + i);
  });
  // arcade sparks orbit (period divides 12)
  sparks.forEach(s => {
    const u = s.userData;
    const a = ph * u.sp * 3 + u.a;
    s.position.set(Math.cos(a) * u.r, u.h + Math.sin(ph * 6 + u.a) * 0.16, Math.sin(a) * u.r * 0.6);
    s.rotation.y = a;
  });
}

// first paint before the loop starts
codeScreens.forEach(s => updateCodeScreen(s, 0));
updateArcade(0);
sample(0);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => posterRepaints.forEach(rp => rp()));
}

const clock = new THREE.Clock();
const STEP = 1 / 60;
let acc = 0, simT = 0, paused = false;

let lastDt = 0;
function draw() {
  controls.update();
  if (flyTarget) {
    const k = 1 - Math.exp(-4.5 * Math.max(lastDt, 0.016)); // time-based, fps-independent
    camera.position.lerp(flyTarget.cam, k);
    controls.target.lerp(flyTarget.tgt, k);
    camera.zoom += (flyTarget.zoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
    if (camera.position.distanceTo(flyTarget.cam) < 0.04 &&
        Math.abs(camera.zoom - flyTarget.zoom) < 0.01) flyTarget = null;
  }
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  lastDt = dt;
  if (!paused) {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; simT += STEP; }
    sample(simT % DURATION);
    updateHover();
  }
  draw();
});

window.__seek = (t) => {
  const v = Number(t);
  paused = true; acc = 0;
  simT = Number.isFinite(v) && v > 0 ? v : 0;
  lastCodeStep = -1; lastArcadeStep = -1;
  sample(simT % DURATION);
  draw();
};
window.__play = () => { paused = false; clock.getDelta(); };
if (reduced) window.__play && (() => { renderer.setAnimationLoop(null); draw(); })();

addEventListener('resize', () => {
  aspect = innerWidth / innerHeight;
  VIEW = fitView();
  camera.left = -VIEW * aspect; camera.right = VIEW * aspect;
  camera.top = VIEW; camera.bottom = -VIEW;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if (paused) draw();
});

window.__SCENE_READY__ = true;
