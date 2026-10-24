import * as THREE from './vendor/three.module.min.js';
import { SnakeGame } from './engine.js';

const $ = (id) => document.getElementById(id);
const game = new SnakeGame();
const modes = { relaxed: { tick: 230, note: '慢一点，享受每一步' }, classic: { tick: 160, note: '刚刚好的挑战' }, fast: { tick: 100, note: '心跳加速，手速跟上' } };
let difficulty = 'classic';
let best = 0;
let soundEnabled = false;
let audio;
let sceneView;
let lastStep = 0;
let frameTime = 0;
let previousSnake = game.snake.map(p => ({ ...p }));
let newRecord = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

try { best = Math.max(0, Number(localStorage.getItem('neon-snake-best')) || 0); } catch { /* Storage can be unavailable in private browser modes. */ }
const digits = (value) => String(value).padStart(3, '0');
$('best-score').textContent = digits(best);

function tone(frequency, duration = .09, type = 'sine', volume = .055) {
  if (!soundEnabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume().catch(() => {});
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    envelope.gain.setValueAtTime(volume, audio.currentTime);
    envelope.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    oscillator.connect(envelope);
    envelope.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  } catch { /* Sound is optional and never blocks gameplay. */ }
}

function rememberScore() {
  if (game.score <= best) return;
  best = game.score;
  newRecord = true;
  $('best-score').textContent = digits(best);
  $('record-caption').textContent = '新纪录，就在这一局。';
  try { localStorage.setItem('neon-snake-best', String(best)); } catch { /* Keep the best score in memory. */ }
}

function updateUI(reason) {
  $('score').textContent = digits(game.score);
  $('length-value').replaceChildren(document.createTextNode(String(game.snake.length).padStart(2, '0')));
  const unit = document.createElement('span');
  unit.className = 'hud-unit'; unit.textContent = '格'; $('length-value').append(unit);
  const stateNames = { ready: '准备就绪', running: '正在游戏', paused: '已暂停', over: '本局结束', won: '完美通关' };
  $('state-badge').textContent = stateNames[game.status];
  $('state-badge').classList.toggle('running', game.status === 'running');
  $('pause-button').disabled = !['running', 'paused'].includes(game.status);
  $('pause-button').querySelector('span').textContent = game.status === 'paused' ? '继续' : '暂停';
  $('pause-icon').innerHTML = game.status === 'paused' ? '<path d="m6 3 10 7-10 7V3Z"/>' : '<path d="M7 4v12M13 4v12"/>';
  document.querySelectorAll('[data-difficulty]').forEach(button => { button.disabled = game.status === 'running' || game.status === 'paused'; });
  const overlay = $('game-overlay');
  overlay.classList.toggle('hidden', game.status === 'running');
  overlay.dataset.state = game.status;
  if (game.status === 'running') return;
  const content = {
    ready: ['READY WHEN YOU ARE', '来一局？', '收集能量，保持前进。', '开始游戏', '开始'],
    paused: ['TAKE A BREATHER', '歇一口气。', '棋盘在等你，随时回来。', '继续游戏', '继续'],
    over: [newRecord ? 'A NEW PERSONAL BEST' : 'ONE MORE ROUND?', newRecord ? '新的个人纪录！' : '再来，就会更好。', `${reason === 'self' ? '不小心撞到了自己' : '碰到棋盘边界了'} · 本局 ${game.score} 分`, '再来一局', '再玩'],
    won: ['ABSOLUTELY LEGENDARY', '整个棋盘，都是你。', `完美通关 · ${game.score} 分`, '再来一局', '再玩']
  }[game.status];
  $('overlay-kicker').textContent = content[0];
  $('overlay-title').textContent = content[1];
  $('overlay-description').textContent = content[2];
  $('play-label').textContent = content[3];
  $('overlay-hint').replaceChildren(document.createTextNode('或按 '));
  const key = document.createElement('kbd'); key.textContent = '空格';
  $('overlay-hint').append(key, document.createTextNode(` ${content[4]}`));
}

function resetRound(start = false) {
  game.reset();
  newRecord = false;
  previousSnake = game.snake.map(p => ({ ...p }));
  lastStep = performance.now();
  if (start) { game.start(); tone(330, .12); }
  sceneView?.reset();
  updateUI();
}

function play() {
  if (!sceneView?.available) return;
  if (game.status === 'paused') game.resume();
  else if (game.status === 'ready') game.start();
  else if (game.status === 'over' || game.status === 'won') { resetRound(true); return; }
  lastStep = performance.now();
  previousSnake = game.snake.map(p => ({ ...p }));
  tone(330, .1);
  updateUI();
}

function togglePause() {
  if (game.status === 'running') { game.pause(); updateUI(); }
  else play();
}

function steer(direction) {
  if ($('help-dialog').open || !sceneView?.available) return;
  if (game.status === 'ready') play();
  if (game.status === 'running') game.turn(direction);
}

$('play-button').addEventListener('click', play);
$('pause-button').addEventListener('click', togglePause);
$('restart-button').addEventListener('click', () => resetRound(true));
$('sound-button').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
  $('sound-button').setAttribute('aria-label', soundEnabled ? '关闭音效' : '开启音效');
  $('sound-button').title = soundEnabled ? '关闭音效' : '开启音效';
  if (soundEnabled) tone(660, .15);
});

document.querySelectorAll('[data-difficulty]').forEach(button => button.addEventListener('click', () => {
  if (['running', 'paused'].includes(game.status)) return;
  difficulty = button.dataset.difficulty;
  document.querySelectorAll('[data-difficulty]').forEach(item => {
    const selected = item === button;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  $('pace-note').textContent = modes[difficulty].note;
  $('pace-bars').className = `pace-bars ${difficulty}`;
}));

const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right' };
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || $('help-dialog').open) return;
  if (keyDirections[event.key]) { event.preventDefault(); if (!event.repeat) steer(keyDirections[event.key]); }
  else if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) togglePause(); }
  else if ((event.key === 'r' || event.key === 'R') && !event.repeat && sceneView?.available) { event.preventDefault(); resetRound(true); }
  else if (event.key === 'Escape' && game.status === 'running') { event.preventDefault(); game.pause(); updateUI(); }
});

document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
  steer(button.dataset.direction);
}));
let touchStart;
$('scene').addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse') return;
  touchStart = { x: event.clientX, y: event.clientY };
  $('scene').setPointerCapture(event.pointerId);
});
$('scene').addEventListener('pointermove', event => {
  if (!touchStart || event.pointerType === 'mouse') return;
  const dx = event.clientX - touchStart.x, dy = event.clientY - touchStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  touchStart = { x: event.clientX, y: event.clientY };
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('scene').addEventListener(event, () => { touchStart = null; });

$('help-button').addEventListener('click', () => {
  if (game.status === 'running') { game.pause(); updateUI(); }
  $('help-dialog').showModal();
});
for (const id of ['close-help', 'help-done']) $(id).addEventListener('click', () => $('help-dialog').close());
$('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) $('help-dialog').close(); });
const autoPause = () => { if (game.status === 'running') { game.pause(); updateUI(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
window.addEventListener('blur', autoPause);

function roundedBox(width, height, depth, radius) {
  const geometry = new THREE.BoxGeometry(width, height, depth, 6, 4, 6);
  const positions = geometry.attributes.position, normals = geometry.attributes.normal;
  const center = new THREE.Vector3(), point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    center.set(THREE.MathUtils.clamp(point.x, -width / 2 + radius, width / 2 - radius), THREE.MathUtils.clamp(point.y, -height / 2 + radius, height / 2 - radius), THREE.MathUtils.clamp(point.z, -depth / 2 + radius, depth / 2 - radius));
    normal.subVectors(point, center).normalize();
    point.copy(center).addScaledVector(normal, radius);
    positions.setXYZ(i, point.x, point.y, point.z);
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  return geometry;
}

class SceneView {
  constructor(container) {
    this.available = false;
    this.container = container;
    this.topView = false;
    this.particles = [];
    this.cameraBlend = 0;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x151a10, .013);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.OrthographicCamera(-17, 17, 17, -17, .1, 120);
    this.scene.add(new THREE.AmbientLight(0xb7cda5, 1.1));
    const hemisphere = new THREE.HemisphereLight(0xd9edb8, 0x1b2416, 2.4);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight(0xf2ffd8, 3.5);
    key.position.set(-8, 20, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    key.shadow.bias = -.001;
    key.shadow.normalBias = .03;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x91f742, 2);
    rim.position.set(5, 6, -9);
    this.scene.add(rim);
    this.board = new THREE.Group();
    this.scene.add(this.board);
    const base = new THREE.Mesh(roundedBox(19.2, .75, 19.2, .25), new THREE.MeshStandardMaterial({ color: 0x252e1c, roughness: .72, metalness: .25 }));
    base.position.y = -.54; base.receiveShadow = true; base.castShadow = true; this.board.add(base);
    const top = new THREE.Mesh(roundedBox(18.25, .13, 18.25, .055), new THREE.MeshStandardMaterial({ color: 0x202c19, roughness: .82, metalness: .12 }));
    top.position.y = -.09; top.receiveShadow = true; this.board.add(top);
    const gridPositions = [];
    for (let i = -9; i <= 9; i++) gridPositions.push(i, -.017, -9, i, -.017, 9, -9, -.017, i, 9, -.017, i);
    const grid = new THREE.BufferGeometry(); grid.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    this.board.add(new THREE.LineSegments(grid, new THREE.LineBasicMaterial({ color: 0x637a44, transparent: true, opacity: .23 })));
    const edgeGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-9.1, .005, -9.1), new THREE.Vector3(9.1, .005, -9.1), new THREE.Vector3(9.1, .005, 9.1), new THREE.Vector3(-9.1, .005, 9.1)]);
    this.board.add(new THREE.LineLoop(edgeGeometry, new THREE.LineBasicMaterial({ color: 0x809f56, transparent: true, opacity: .8 })));
    const trimGeometry = new THREE.BoxGeometry(2, .025, .035);
    const trimMaterial = new THREE.MeshBasicMaterial({ color: 0xc1f76a });
    for (const z of [-9.38, 9.38]) for (const x of [-7.9, 7.9]) { const trim = new THREE.Mesh(trimGeometry, trimMaterial); trim.position.set(x, -.37, z); this.board.add(trim); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.ShadowMaterial({ color: 0x000000, opacity: .28 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; floor.receiveShadow = true; this.scene.add(floor);
    const dotPositions = [];
    for (let x = -28; x <= 28; x += 2) for (let z = -28; z <= 28; z += 2) {
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      dotPositions.push(x, -1.15, z);
    }
    const dots = new THREE.BufferGeometry(); dots.setAttribute('position', new THREE.Float32BufferAttribute(dotPositions, 3));
    this.scene.add(new THREE.Points(dots, new THREE.PointsMaterial({ color: 0x6b804b, size: .045, transparent: true, opacity: .38 })));
    this.snakeGeometry = roundedBox(.9, .63, .9, .14);
    this.headMaterial = new THREE.MeshStandardMaterial({ color: 0xc5ff79, emissive: 0x75c82c, emissiveIntensity: .22, roughness: .32, metalness: .06 });
    this.snakeMaterials = Array.from({ length: 8 }, (_, i) => new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(.24, .69, .5 - i * .025), emissive: 0x508b1b, emissiveIntensity: .14, roughness: .4, metalness: .1 }));
    this.segments = [];
    this.eyes = new THREE.Group();
    const eyeGeo = new THREE.SphereGeometry(.065, 10, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c2c10 });
    for (const z of [-.2, .2]) { const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(.3, .66, z); this.eyes.add(eye); }
    this.board.add(this.eyes);
    this.foodGroup = new THREE.Group();
    const foodMaterial = new THREE.MeshStandardMaterial({ color: 0xffb65a, emissive: 0xf87d20, emissiveIntensity: .75, roughness: .28, metalness: .12 });
    const fruit = new THREE.Mesh(new THREE.OctahedronGeometry(.43, 0), foodMaterial); fruit.castShadow = true; this.foodGroup.add(fruit);
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(.67, .015, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffb96a, transparent: true, opacity: .55 }));
    orbit.rotation.x = Math.PI / 2; orbit.position.y = -.28; this.foodGroup.add(orbit);
    this.foodLight = new THREE.PointLight(0xffa43f, 2.7, 4); this.foodLight.position.y = .8; this.foodGroup.add(this.foodLight);
    this.board.add(this.foodGroup);
    const marker = new THREE.Mesh(new THREE.RingGeometry(.24, .42, 32), new THREE.MeshBasicMaterial({ color: 0xffac53, side: THREE.DoubleSide, transparent: true, opacity: .2 }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = .015; this.foodMarker = marker; this.board.add(marker);
    this.particleGeometry = new THREE.BoxGeometry(.1, .1, .1);
    this.particleMaterial = new THREE.MeshBasicMaterial({ color: 0xe3ffab, transparent: true, opacity: 1 });
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize); this.observer.observe(container);
    this.available = true;
    this.resize();
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); autoPause(); this.available = false; this.showError('3D 画面暂时断开了', '请刷新页面，重新连接棋盘。');
    });
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width; this.height = height;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const halfHeight = aspect < .9 ? 21 / aspect * .67 : 16.7;
    this.camera.left = -halfHeight * aspect; this.camera.right = halfHeight * aspect;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  reset() { this.particles.forEach(p => this.board.remove(p.mesh)); this.particles = []; }

  burst(position) {
    if (reducedMotion) return;
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, this.particleMaterial);
      mesh.position.set(position.x - 8.5, .5, position.z - 8.5);
      this.board.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({ mesh, velocity: new THREE.Vector3(Math.cos(angle) * (1 + Math.random() * 2), 2 + Math.random() * 3, Math.sin(angle) * (1 + Math.random() * 2)), life: .7 });
    }
  }

  render(now, delta, interpolation) {
    const time = now / 1000;
    const targetBlend = this.topView ? 1 : 0;
    this.cameraBlend += (targetBlend - this.cameraBlend) * (reducedMotion ? 1 : Math.min(1, delta * 7));
    const blend = this.cameraBlend;
    this.camera.position.set(16 * (1 - blend), 25 + blend * 11, 25 * (1 - blend) + .01);
    this.camera.lookAt(0, -2.3 + blend * .8, 0);
    while (this.segments.length < game.snake.length) {
      const segment = new THREE.Mesh(this.snakeGeometry, this.snakeMaterials[0]);
      segment.castShadow = true; segment.receiveShadow = true; this.board.add(segment); this.segments.push(segment);
    }
    this.segments.forEach((segment, i) => {
      segment.visible = i < game.snake.length;
      if (!segment.visible) return;
      const current = game.snake[i]; const previous = previousSnake[i] ?? previousSnake.at(-1) ?? current;
      segment.position.set(THREE.MathUtils.lerp(previous.x, current.x, interpolation) - 8.5, .33, THREE.MathUtils.lerp(previous.z, current.z, interpolation) - 8.5);
      segment.material = i === 0 ? this.headMaterial : this.snakeMaterials[Math.min(7, Math.floor((i - 1) / 3))];
      const scale = i === 0 ? 1.02 : Math.max(.69, 1 - i * .006);
      segment.scale.set(scale, i === 0 ? 1.04 : 1, scale);
    });
    const head = this.segments[0];
    if (head) {
      this.eyes.position.set(head.position.x, 0, head.position.z);
      this.eyes.rotation.y = -Math.atan2(game.direction.z, game.direction.x);
    }
    this.foodGroup.visible = !!game.food; this.foodMarker.visible = !!game.food;
    if (game.food) {
      this.foodGroup.position.set(game.food.x - 8.5, .72 + (reducedMotion ? 0 : Math.sin(time * 2.7) * .1), game.food.z - 8.5);
      if (!reducedMotion) this.foodGroup.rotation.y = time * .65;
      this.foodMarker.position.x = game.food.x - 8.5; this.foodMarker.position.z = game.food.z - 8.5;
      this.foodMarker.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(time * 2.7) * .12);
    }
    this.particles = this.particles.filter(p => {
      p.life -= delta;
      if (p.life <= 0) { this.board.remove(p.mesh); return false; }
      p.mesh.position.addScaledVector(p.velocity, delta); p.velocity.y -= delta * 8;
      p.mesh.rotation.x += delta * 3; p.mesh.scale.setScalar(p.life / .7);
      return true;
    });
    this.renderer.render(this.scene, this.camera);
  }

  showError(title, description) {
    $('game-overlay').classList.add('hidden');
    const error = document.createElement('div'); error.className = 'render-fallback';
    const heading = document.createElement('h2'); heading.textContent = title;
    const text = document.createElement('p'); text.textContent = description;
    error.append(heading, text); this.container.append(error);
    $('play-button').disabled = true; $('pause-button').disabled = true; $('restart-button').disabled = true; $('camera-button').disabled = true;
  }
}

try {
  sceneView = new SceneView($('scene'));
  $('camera-button').addEventListener('click', () => {
    sceneView.topView = !sceneView.topView;
    $('camera-label').textContent = sceneView.topView ? '俯视视角' : '立体视角';
    $('camera-button').setAttribute('aria-label', sceneView.topView ? '切换为立体视角' : '切换为俯视视角');
  });
  updateUI();
  function animate(now) {
    requestAnimationFrame(animate);
    if (document.hidden || !sceneView.available) { frameTime = now; return; }
    const delta = Math.min((now - (frameTime || now)) / 1000, .05);
    frameTime = now;
    const interval = Math.max(70, modes[difficulty].tick - Math.floor(game.foodsEaten / 5) * 7);
    if (game.status === 'running' && now - lastStep >= interval) {
      previousSnake = game.snake.map(p => ({ ...p }));
      const oldFood = game.food ? { ...game.food } : null;
      const result = game.step();
      lastStep = now;
      if (result.ate) {
        rememberScore(); sceneView.burst(oldFood); tone(620 + (game.foodsEaten % 5) * 80, .16, 'triangle');
        document.querySelector('.arena').classList.add('scored');
        setTimeout(() => document.querySelector('.arena').classList.remove('scored'), 250);
      }
      if (result.ended) {
        previousSnake = game.snake.map(p => ({ ...p }));
        tone(game.status === 'won' ? 880 : 130, .3, 'triangle', .07);
      }
      updateUI(result.reason);
    }
    const interpolation = game.status === 'running' && !reducedMotion ? Math.min(1, (now - lastStep) / interval) : 1;
    sceneView.render(now, delta, interpolation);
  }
  requestAnimationFrame(animate);
} catch (error) {
  console.error('Unable to initialize the 3D scene:', error);
  SceneView.prototype.showError.call({ container: $('scene') }, '当前浏览器无法启动 3D 画面', '请使用支持 WebGL 的浏览器，并在浏览器设置中开启硬件加速，然后刷新页面。');
}
