import * as pc from 'playcanvas';

// Expose the engine on the global object so classic pc.createScript files work in ESM mode
// This avoids loading the engine twice and keeps compatibility with our existing scripts.
window.pc = pc;

async function loadGameScripts() {
  const base = '/scripts/';
  const files = [
    'playerController.js',
    'torch.js',
    'enemyAI.js',
    'altar.js',
    'gameManager.js',
    'uiManager.js'
  ];
  await Promise.all(files.map((f) => import(`${base}${f}`)));
}

function loadAssets(app, list) {
  return new Promise((resolve) => {
    app.assets.loadFromUrlList(list, (err, assets) => {
      if (err) console.error(err);
      resolve(assets || []);
    });
  });
}

function makeMaterial(tex) {
  const mat = new pc.StandardMaterial();
  mat.diffuseMap = tex;
  mat.opacityMap = tex;
  mat.blendType = pc.BLEND_PREMULTIPLIED;
  mat.useLighting = false;
  mat.update();
  return mat;
}

function createButton(app, screen, text, pos, size, onClick) {
  const btn = new pc.Entity('Button_' + text);
  btn.addComponent('element', {
    type: pc.ELEMENTTYPE_IMAGE,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    width: size.x, height: size.y,
    color: new pc.Color(0.15, 0.15, 0.15),
    useInput: true
  });
  btn.setLocalPosition(pos.x, pos.y, 0);
  btn.addComponent('button', { imageEntity: btn });

  const label = new pc.Entity('Label');
  label.addComponent('element', {
    type: pc.ELEMENTTYPE_TEXT,
    anchor: [0.5, 0.5, 0.5, 0.5],
    pivot: [0.5, 0.5],
    width: size.x, height: size.y,
    fontSize: 28,
    color: new pc.Color(1,1,1),
    text: text
  });
  btn.addChild(label);
  screen.addChild(btn);
  btn.button.on('click', onClick);
  return btn;
}

async function main() {
  const canvas = document.getElementById('application-canvas');
  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    elementInput: new pc.ElementInput(canvas)
  });
  app.start();
  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  window.addEventListener('resize', () => app.resizeCanvas());

  // Ensure pc.createScript definitions are loaded
  await loadGameScripts();

  // Camera
  const camera = new pc.Entity('Camera');
  camera.addComponent('camera', { clearColor: new pc.Color(0,0,0), projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: 12 });
  camera.setLocalPosition(0, 20, 0);
  camera.lookAt(0, 0, 0);
  app.root.addChild(camera);

  // World
  const world = new pc.Entity('World');
  app.root.addChild(world);

  // UI
  const ui = new pc.Entity('UI');
  ui.addComponent('screen', { screenSpace: true, referenceResolution: new pc.Vec2(1280, 720), scaleBlend: 0.5, scaleMode: pc.SCALEMODE_BLEND });
  app.root.addChild(ui);

  const menuPanel = new pc.Entity('MenuPanel');
  menuPanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1], pivot: [0.5,0.5] });
  ui.addChild(menuPanel);
  const hudPanel = new pc.Entity('HudPanel');
  hudPanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1], pivot: [0.5,0.5] });
  ui.addChild(hudPanel);
  const pausePanel = new pc.Entity('PausePanel');
  pausePanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1], pivot: [0.5,0.5] });
  pausePanel.enabled = false; ui.addChild(pausePanel);
  const winPanel = new pc.Entity('WinPanel');
  winPanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1] });
  winPanel.enabled = false; ui.addChild(winPanel);
  const losePanel = new pc.Entity('LosePanel');
  losePanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1] });
  losePanel.enabled = false; ui.addChild(losePanel);
  const creditsPanel = new pc.Entity('CreditsPanel');
  creditsPanel.addComponent('element', { type: pc.ELEMENTTYPE_GROUP, anchor: [0,0,1,1] });
  creditsPanel.enabled = false; ui.addChild(creditsPanel);

  // HUD texts
  const torchesText = new pc.Entity('TorchesText');
  torchesText.addComponent('element', { type: pc.ELEMENTTYPE_TEXT, anchor: [0,1,0,1], pivot: [0,1], fontSize: 28, color: new pc.Color(1,1,1), text: '0 / 0' });
  torchesText.setLocalPosition(20, -20, 0);
  hudPanel.addChild(torchesText);
  const difficultyText = new pc.Entity('DifficultyText');
  difficultyText.addComponent('element', { type: pc.ELEMENTTYPE_TEXT, anchor: [1,1,1,1], pivot: [1,1], fontSize: 28, color: new pc.Color(1,1,1), text: 'Normal' });
  difficultyText.setLocalPosition(-20, -20, 0);
  hudPanel.addChild(difficultyText);
  const hintText = new pc.Entity('HintText');
  hintText.addComponent('element', { type: pc.ELEMENTTYPE_TEXT, anchor: [0.5,0,0.5,0], pivot: [0.5,0], fontSize: 24, color: new pc.Color(1,1,0.5), text: '' });
  hintText.setLocalPosition(0, 20, 0);
  hudPanel.addChild(hintText);

  // Buttons
  let y = 150;
  const btnStart = createButton(app, menuPanel, 'Start Game', new pc.Vec3(0, y, 0), new pc.Vec2(280, 56), () => {});
  y -= 70;
  const btnEasy = createButton(app, menuPanel, 'Easy', new pc.Vec3(0, y, 0), new pc.Vec2(200, 48), () => {});
  y -= 60;
  const btnNormal = createButton(app, menuPanel, 'Normal', new pc.Vec3(0, y, 0), new pc.Vec2(200, 48), () => {});
  y -= 60;
  const btnHard = createButton(app, menuPanel, 'Hard', new pc.Vec3(0, y, 0), new pc.Vec2(200, 48), () => {});
  y -= 60;
  const btnCredits = createButton(app, menuPanel, 'Credits', new pc.Vec3(0, y, 0), new pc.Vec2(200, 48), () => { creditsPanel.enabled = true; menuPanel.enabled = false; });
  y -= 60;
  const btnExit = createButton(app, menuPanel, 'Exit', new pc.Vec3(0, y, 0), new pc.Vec2(200, 48), () => {});

  const btnResume = createButton(app, pausePanel, 'Resume', new pc.Vec3(0, 40, 0), new pc.Vec2(240, 52), () => {});
  const btnRestart = createButton(app, pausePanel, 'Restart', new pc.Vec3(0, -20, 0), new pc.Vec2(240, 52), () => {});
  const btnReturnToMain = createButton(app, pausePanel, 'Return to Main', new pc.Vec3(0, -80, 0), new pc.Vec2(240, 52), () => {});

  const winLabel = new pc.Entity('WinLabel');
  winLabel.addComponent('element', { type: pc.ELEMENTTYPE_TEXT, anchor: [0.5,0.5,0.5,0.5], pivot: [0.5,0.5], fontSize: 48, color: new pc.Color(0.6,1,0.6), text: 'Victory' });
  winPanel.addChild(winLabel);
  const loseLabel = new pc.Entity('LoseLabel');
  loseLabel.addComponent('element', { type: pc.ELEMENTTYPE_TEXT, anchor: [0.5,0.5,0.5,0.5], pivot: [0.5,0.5], fontSize: 48, color: new pc.Color(1,0.6,0.6), text: 'Defeat' });
  losePanel.addChild(loseLabel);

  // Load assets
  const assetList = [
    { url: 'images/mapa.jpg', type: 'texture' },
    { url: 'images/heroi1.jpg', type: 'texture' },
    { url: 'images/heroi2.jpg', type: 'texture' },
    { url: 'images/heroi3.jpg', type: 'texture' },
    { url: 'images/enemy1.jpg', type: 'texture' },
    { url: 'images/enemy2.jpg', type: 'texture' },
    { url: 'images/enemy3.jpg', type: 'texture' },
    { url: 'images/altar0.jpg', type: 'texture' },
    { url: 'images/altar1.jpg', type: 'texture' },
    { url: 'images/altar2.jpg', type: 'texture' },
    { url: 'images/altar3.jpg', type: 'texture' },
    { url: 'images/altar4.jpg', type: 'texture' },
    { url: 'fonts/ui.json', type: 'font' }
  ];

  const assets = await loadAssets(app, assetList);
  const find = (url) => assets.find((a) => a && a.file && a.file.url && a.file.url.indexOf(url) !== -1);
  const texMap = find('images/mapa.jpg')?.resource;
  const heroTex = [find('images/heroi1.jpg').resource, find('images/heroi2.jpg').resource, find('images/heroi3.jpg').resource];
  const enemyTex = [find('images/enemy1.jpg').resource, find('images/enemy2.jpg').resource, find('images/enemy3.jpg').resource];
  const torchUnlit = find('images/tocha-frente.png')?.resource;l;
  const torchLit = find('images/tocha-frente.png')?.resource;l;
  const altarTex = [
    find('images/altar0.jpg').resource,
    find('images/altar1.jpg').resource,
    find('images/altar2.jpg').resource,
    find('images/altar3.jpg').resource,
    find('images/altar4.jpg').resource
  ];
  const uiFontAsset = find('fonts/ui.json');

  // Background
  const background = new pc.Entity('Background');
  background.addComponent('render', { type: 'plane' });
  background.setLocalPosition(0, 0, 0);
  background.setLocalScale(40, 1, 40);
  if (texMap) background.render.material = makeMaterial(texMap);
  world.addChild(background);

  // GameManager
  const gm = new pc.Entity('GameManager');
  gm.addComponent('script');
  gm.script.create('gameManager');
  world.addChild(gm);

  // Player
  const player = new pc.Entity('Player');
  player.addComponent('render', { type: 'plane' });
  player.setLocalScale(1.2, 1, 1.2);
  player.addComponent('script');
  player.script.create('playerController', { attributes: { frameTextures: heroTex } });
  world.addChild(player);

  // Altar
  const altar = new pc.Entity('Altar');
  altar.addComponent('render', { type: 'plane' });
  altar.setLocalScale(2, 1, 2);
  altar.addComponent('script');
  altar.script.create('altar', { attributes: { frameTextures: altarTex } });
  altar.setLocalPosition(0, 0.01, 0);
  world.addChild(altar);

  // Torches
  const torchPositions = [ new pc.Vec3(-15, 0.01, -15), new pc.Vec3(15, 0.01, -15), new pc.Vec3(-15, 0.01, 15), new pc.Vec3(15, 0.01, 15) ];
  const torches = [];
  for (let i = 0; i < torchPositions.length; i++) {
    const t = new pc.Entity('Torch_' + (i+1));
    t.addComponent('render', { type: 'plane' });
    t.setLocalScale(1, 1, 1);
    t.addComponent('script');
    t.script.create('torch', { attributes: { startLit: false, unlitTexture: torchUnlit, litTexture: torchLit } });
    if (t.tags && t.tags.add) t.tags.add('torch');
    t.setLocalPosition(torchPositions[i]);
    world.addChild(t);
    torches.push(t);
  }

  // Enemy prefab
  const enemyPrefab = new pc.Entity('EnemyPrefab');
  enemyPrefab.addComponent('render', { type: 'plane' });
  enemyPrefab.setLocalScale(1.2, 1, 1.2);
  enemyPrefab.addComponent('script');
  enemyPrefab.script.create('enemyAI', { attributes: { frameTextures: enemyTex } });
  enemyPrefab.enabled = false;
  gm.addChild(enemyPrefab);

  // Spawn points
  const spawnPoints = [];
  for (let s = 0; s < 4; s++) {
    const sp = new pc.Entity('SpawnPoint_' + s);
    sp.setLocalPosition((Math.random()*2-1)*18, 0.01, (Math.random()*2-1)*18);
    gm.addChild(sp);
    spawnPoints.push(sp);
  }

  // UI Manager
  const uiMgr = new pc.Entity('UiManager');
  uiMgr.addComponent('script');
  uiMgr.script.create('uiManager', {
    attributes: {
      menuPanel,
      hudPanel,
      pausePanel,
      winPanel,
      losePanel,
      creditsPanel,
      torchesText,
      difficultyText,
      hintText,
      btnStart,
      btnEasy,
      btnNormal,
      btnHard,
      btnCredits,
      btnExit,
      btnResume,
      btnRestart,
      btnReturnToMain,
      menuSceneName: 'Menu',
      gameSceneName: 'TinwoodGrove'
    }
  });
  ui.addChild(uiMgr);

  // Wire GameManager
  const gms = gm.script.gameManager;
  gms.player = player;
  gms.altar = altar;
  gms.uiManager = uiMgr;
  gms.enemyPrefab = enemyPrefab;
  gms.spawnPoints = spawnPoints;

  if (uiFontAsset && uiFontAsset.resource) {
    torchesText.element.fontAsset = uiFontAsset;
    difficultyText.element.fontAsset = uiFontAsset;
    hintText.element.fontAsset = uiFontAsset;
    [btnStart, btnEasy, btnNormal, btnHard, btnCredits, btnExit, btnResume, btnRestart, btnReturnToMain].forEach((b) => {
      const lbl = b && b.findByName('Label');
      if (lbl && lbl.element) lbl.element.fontAsset = uiFontAsset;
    });
  }

  // START GAME DIRECTLY (menu disabled temporarily)
  menuPanel.enabled = false;
  hudPanel.enabled = true;
  app.fire('game:reset');
  app.fire('game:resume');

  // Difficulty buttons (still wired)
  btnEasy.button.on('click', () => { try{localStorage.setItem('ash:difficulty','Easy');}catch(e){} app.fire('hud:update',{lit:0,total:0,difficulty:'Easy'}); });
  btnNormal.button.on('click', () => { try{localStorage.setItem('ash:difficulty','Normal');}catch(e){} app.fire('hud:update',{lit:0,total:0,difficulty:'Normal'}); });
  btnHard.button.on('click', () => { try{localStorage.setItem('ash:difficulty','Hard');}catch(e){} app.fire('hud:update',{lit:0,total:0,difficulty:'Hard'}); });
  btnStart.button.on('click', () => { app.fire('game:reset'); app.fire('game:resume'); menuPanel.enabled=false; hudPanel.enabled=true; });
  btnResume.button.on('click', () => { app.fire('game:resume'); pausePanel.enabled=false; hudPanel.enabled=true; });
  btnRestart.button.on('click', () => { app.fire('game:restart'); pausePanel.enabled=false; hudPanel.enabled=true; });
  btnReturnToMain.button.on('click', () => { app.fire('game:pause'); menuPanel.enabled=true; hudPanel.enabled=false; pausePanel.enabled=false; });

  app.keyboard.on('keydown', (e) => {
    if (e.key === pc.KEY_ESCAPE) {
      if (pausePanel.enabled) {
        app.fire('game:resume'); pausePanel.enabled=false; hudPanel.enabled=true;
      } else if (hudPanel.enabled) {
        app.fire('game:pause'); pausePanel.enabled=true; hudPanel.enabled=false;
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
