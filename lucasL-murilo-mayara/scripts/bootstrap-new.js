// Bootstrap v7 — Music, layers and menu controller
(function () {
  "use strict";

  console.log("Bootstrap v7 - Música e cone de visão corrigidos");

  // Menu and audio/pause controller
  function setupMenuController(app) {
    var btnStart = document.getElementById("btnStart");
    var btnQuit = document.getElementById("btnQuit");
    var btnMute = document.getElementById("btnMute");
    var btnPause = document.getElementById("btnPause");
    var menu = document.getElementById("menuInicial");
    var pauseOverlay = document.getElementById("pauseOverlay");

    var bgMusic = new Audio();
    bgMusic.loop = true;
    bgMusic.volume = 0.3;
    bgMusic.src = "game_assets/audio/bg-theme.mp3";

    var musicEnabled = localStorage.getItem("ash:music") !== "false";
    var isGamePaused = false;
    var wasMusicPlayingBeforePause = false;

    function playMusic() {
      if (musicEnabled)
        bgMusic.play().catch(function (err) {
          console.warn("Não foi possível tocar música:", err);
        });
    }

    function stopMusic() {
      bgMusic.pause();
    }

    function toggleMusic() {
      musicEnabled = !musicEnabled;
      localStorage.setItem("ash:music", musicEnabled.toString());
      if (musicEnabled) playMusic();
      else stopMusic();
      if (btnMute)
        btnMute.textContent = musicEnabled ? "🔊 Som: ON" : "🔇 Som: OFF";
    }

    function setupPauseButton() {
      if (!btnPause) return;
      btnPause.addEventListener("click", function () {
        isGamePaused = !isGamePaused;
        if (isGamePaused) {
          wasMusicPlayingBeforePause = !bgMusic.paused;
          app.timeScale = 0;
          app.fire("game:pause");
          btnPause.innerHTML = "Retomar";
          if (pauseOverlay) pauseOverlay.style.display = "flex";
          stopMusic();
        } else {
          app.timeScale = 1;
          app.fire("game:resume");
          btnPause.innerHTML = "Pausar";
          if (pauseOverlay) pauseOverlay.style.display = "none";
          if (wasMusicPlayingBeforePause && musicEnabled) playMusic();
        }
      });
    }

    function setupKeyboardPause() {
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) {
          if (btnPause && menu && menu.style.display === "none") {
            btnPause.click();
            e.preventDefault();
          }
        }
      });
    }

    if (btnMute) btnMute.addEventListener("click", toggleMusic);
    setupPauseButton();
    setupKeyboardPause();

    // Start paused, show HTML menu
    app.timeScale = 0;
    if (menu) menu.style.display = "flex";
    if (pauseOverlay) pauseOverlay.style.display = "none";

    if (btnStart) {
      btnStart.addEventListener("click", function () {
        if (menu) menu.style.display = "none";
        app.timeScale = 1;
        app.fire("game:resume");
        if (btnPause) btnPause.style.display = "block";
        if (pauseOverlay) pauseOverlay.style.display = "none";
        playMusic();
        wasMusicPlayingBeforePause = true;
      });
    }

    if (btnQuit) {
      btnQuit.addEventListener("click", function () {
        stopMusic();
        if (app.timeScale === 0) {
          window.close();
          history.back();
          return;
        }
        if (menu) {
          menu.style.display = "flex";
          app.timeScale = 0;
          app.fire("game:pause");
          if (btnPause) btnPause.style.display = "none";
        }
      });
    }

    if (btnPause) btnPause.style.display = "none";

    // Expose helpers
    window.GAME_AUDIO = {
      music: bgMusic,
      isPlaying: function () {
        return !bgMusic.paused;
      },
      play: playMusic,
      stop: stopMusic,
      toggle: toggleMusic,
    };

    window.GAME_PAUSE = {
      isPaused: function () {
        return isGamePaused;
      },
      pause: function () {
        if (btnPause && !isGamePaused) btnPause.click();
      },
      resume: function () {
        if (btnPause && isGamePaused) btnPause.click();
      },
      toggle: function () {
        if (btnPause) btnPause.click();
      },
    };
  }

  // Load game scripts into the page
  function loadGameScripts(callback) {
    var scripts = [
      "scripts/layerManager.js",
      "scripts/assetLoader.js",
      "scripts/playerController.js",
      "scripts/enemyAI.js",
      "scripts/torch.js",
      "scripts/altar.js",
      "scripts/gameManager.js",
      "scripts/uiManager.js",
    ];
    var loaded = 0;
    function checkComplete() {
      loaded++;
      if (loaded === scripts.length) callback();
    }
    scripts.forEach(function (src) {
      var script = document.createElement("script");
      script.src = src + "?v=" + Date.now();
      script.onload = checkComplete;
      script.onerror = function () {
        console.error("Failed to load:", src);
        checkComplete();
      };
      document.head.appendChild(script);
    });
  }

  // Create a material with alpha support
  function makeMaterial(tex) {
    var mat = new pc.StandardMaterial();
    mat.diffuseMap = tex;
    mat.emissive = new pc.Color(1, 1, 1);
    mat.emissiveMap = tex;
    mat.opacityMap = tex;
    mat.blendType = pc.BLEND_PREMULTIPLIED;
    mat.useLighting = false;
    mat.cull = pc.CULLFACE_NONE;
    mat.update();
    return mat;
  }

  // Main initializer
  function main() {
    console.log("🎮 Starting game with layer system...");
    var canvas = document.getElementById("application-canvas");
    var app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      keyboard: new pc.Keyboard(window),
      elementInput: new pc.ElementInput(canvas),
    });
    app.start();
    app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    window.addEventListener("resize", function () {
      app.resizeCanvas();
    });

    loadGameScripts(function () {
      if (typeof loadGameAssets === "function") {
        loadGameAssets(app).then(function () {
          buildScene(app);
          setTimeout(function () {
            setupMenuController(app);
          }, 100);
        });
      } else {
        buildScene(app);
        setTimeout(function () {
          setupMenuController(app);
        }, 100);
      }
    });
  }

  // Build the scene: layers, world, UI, player, torches, decorations and game manager
  function buildScene(app) {
    var LAYERS = window.setupLayers(app);
    console.log("🎨 Layers configuradas:", LAYERS);

    var world = new pc.Entity("World");
    app.root.addChild(world);

    var ui = new pc.Entity("UI");
    ui.addComponent("screen", {
      screenSpace: true,
      referenceResolution: new pc.Vec2(1280, 720),
      scaleBlend: 0.5,
      scaleMode: pc.SCALEMODE_BLEND,
    });
    app.root.addChild(ui);

    var camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0.1, 0.1, 0.1),
      projection: pc.PROJECTION_ORTHOGRAPHIC,
      orthoHeight: 14,
      nearClip: 0.1,
      farClip: 100,
      layers: [
        LAYERS.BACKGROUND,
        LAYERS.WORLD,
        LAYERS.OBJECTS,
        LAYERS.PLAYER,
        LAYERS.ENEMIES,
        LAYERS.VISION,
      ],
    });
    camera.setLocalPosition(0, 0, 20);
    camera.lookAt(0, 0, 0);
    app.root.addChild(camera);

    var light = new pc.Entity("Light");
    light.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 1, 1),
      intensity: 1,
    });
    light.setLocalEulerAngles(45, 30, 0);
    app.root.addChild(light);

    var menuPanel = new pc.Entity("MenuPanel");
    menuPanel.addComponent("element", {
      type: pc.ELEMENTTYPE_IMAGE,
      anchor: [0, 0, 1, 1],
      pivot: [0.5, 0.5],
      color: new pc.Color(0, 0, 0, 0.95),
      opacity: 0.95,
      layers: [LAYERS.UI],
    });
    ui.addChild(menuPanel);

    var hudPanel = new pc.Entity("HudPanel");
    hudPanel.addComponent("element", {
      type: pc.ELEMENTTYPE_GROUP,
      anchor: [0, 0, 1, 1],
      pivot: [0.5, 0.5],
      layers: [LAYERS.UI],
    });
    ui.addChild(hudPanel);

    var pausePanel = new pc.Entity("PausePanel");
    pausePanel.addComponent("element", {
      type: pc.ELEMENTTYPE_GROUP,
      anchor: [0, 0, 1, 1],
      pivot: [0.5, 0.5],
      layers: [LAYERS.UI],
    });
    pausePanel.enabled = false;
    ui.addChild(pausePanel);

    var enemyCountText = new pc.Entity("EnemyCountText");
    enemyCountText.addComponent("element", {
      type: pc.ELEMENTTYPE_TEXT,
      anchor: [0, 1, 0, 1],
      pivot: [0, 1],
      fontSize: 28,
      color: new pc.Color(1, 0.5, 0.5),
      text: "0",
      outlineColor: new pc.Color(0, 0, 0),
      outlineThickness: 0.3,
      layers: [LAYERS.UI],
    });
    enemyCountText.setLocalPosition(25, -25, 0);
    hudPanel.addChild(enemyCountText);

    var hintText = new pc.Entity("HintText");
    hintText.addComponent("element", {
      type: pc.ELEMENTTYPE_TEXT,
      anchor: [0.5, 0, 0.5, 0],
      pivot: [0.5, 0],
      fontSize: 24,
      color: new pc.Color(1, 1, 1),
      text: "",
      outlineColor: new pc.Color(0, 0, 0),
      outlineThickness: 0.3,
      layers: [LAYERS.UI],
    });
    hintText.setLocalPosition(0, 25, 0);
    hudPanel.addChild(hintText);

    var progressBar = new pc.Entity("ProgressBar");
    progressBar.addComponent("element", {
      type: pc.ELEMENTTYPE_TEXT,
      anchor: [0.5, 0, 0.5, 0],
      pivot: [0.5, 0],
      fontSize: 24,
      color: new pc.Color(0, 1, 0),
      text: "",
      outlineColor: new pc.Color(0, 0, 0),
      outlineThickness: 0.3,
      layers: [LAYERS.UI],
    });
    progressBar.setLocalPosition(0, 60, 0);
    progressBar.enabled = false;
    hudPanel.addChild(progressBar);

    var heroTex = window.GAME_TEXTURES?.player || [];
    var enemyTex = window.GAME_TEXTURES?.enemy || [];
    var torchTex = window.GAME_TEXTURES?.torch || [];
    var altarTex = window.GAME_TEXTURES?.altar || [];
    var mapTex = window.GAME_TEXTURES?.world?.scenario;

    var background = new pc.Entity("Background");
    background.addComponent("render", {
      type: "box",
      layers: [LAYERS.BACKGROUND],
    });
    background.setLocalScale(24, 24, 0.1);
    background.setLocalPosition(0, 0, -1);
    if (mapTex)
      background.render.meshInstances[0].material = makeMaterial(mapTex);
    world.addChild(background);

    var player = new pc.Entity("Player");
    player.addComponent("render", { type: "box", layers: [LAYERS.PLAYER] });
    player.setLocalScale(1, 1, 0.1);
    player.setLocalPosition(0, -5, 0.02);
    if (heroTex[0])
      player.render.meshInstances[0].material = makeMaterial(heroTex[0]);
    player._heroTextures = heroTex;
    player.addComponent("script");
    player.script.create("playerController", {
      attributes: {
        boundsMin: new pc.Vec2(-11, -11),
        boundsMax: new pc.Vec2(11, 11),
      },
    });
    world.addChild(player);

    var torchPositions = [
      new pc.Vec3(-11, -11, 0.01),
      new pc.Vec3(-11, 11, 0.01),
      new pc.Vec3(11, -11, 0.01),
      new pc.Vec3(11, 11, 0.01),
    ];
    torchPositions.forEach(function (pos, index) {
      var torch = new pc.Entity("Torch" + index);
      torch.addComponent("render", { type: "box", layers: [LAYERS.WORLD] });
      torch.setLocalScale(0.5, 0.5, 0.1);
      torch.setLocalPosition(pos.x, pos.y, pos.z);
      var mat = makeMaterial(torchTex[0] || null);
      if (!torchTex[0]) {
        mat.diffuse.set(0.6, 0.1, 0.1);
        mat.emissive.set(0.6, 0.1, 0.1);
        mat.useLighting = false;
        mat.update();
      }
      torch.render.meshInstances[0].material = mat;
      torch.addComponent("script");
      torch.script.create("torch", {
        attributes: {
          unlitTexture: torchTex[0]
            ? new pc.Asset("torch_unlit", "texture", {
                url: "./game_assets/world/tocha-frente.png",
              })
            : null,
          litTexture: torchTex[1]
            ? new pc.Asset("torch_lit", "texture", {
                url: "./game_assets/world/tocha-lateral.png",
              })
            : null,
          startLit: false,
        },
      });
      world.addChild(torch);
    });

    var altar = new pc.Entity("Altar");
    altar.addComponent("render", {
      type: "box",
      layers: [LAYERS.WORLD],
    });

    // Tamanho do altar
    altar.setLocalScale(2, 2, 0.1);
    altar.setLocalPosition(0, 0, 0.02);

    // ✅ APLICAR TEXTURA CORRETAMENTE
    if (altarTex && altarTex.length > 0 && altarTex[0]) {
      console.log("✅ Aplicando textura do altar_0");

      // Extrai a textura do asset
      var tex = altarTex[0].resource || altarTex[0];

      // Cria material com a textura
      var matAltar = new pc.StandardMaterial();
      matAltar.diffuseMap = tex;
      matAltar.emissive = new pc.Color(1, 1, 1);
      matAltar.emissiveMap = tex;
      matAltar.emissiveIntensity = 0.8;
      matAltar.opacityMap = tex;
      matAltar.blendType = pc.BLEND_PREMULTIPLIED;
      matAltar.useLighting = false;
      matAltar.cull = pc.CULLFACE_NONE;
      matAltar.depthWrite = true;
      matAltar.update();

      // Aplica ao mesh
      altar.render.meshInstances[0].material = matAltar;

      console.log("✅ Material do altar aplicado");
    } else {
      console.warn("⚠ Textura do altar não encontrada");
      // Usa makeMaterial como fallback
      if (altarTex[0]) {
        altar.render.meshInstances[0].material = makeMaterial(altarTex[0]);
      }
    }

    // Passa as texturas para o script poder trocar depois
    altar._altarTextures = altarTex;

    // Adiciona script
    altar.addComponent("script");
    altar.script.create("altar");

    // Adiciona ao mundo
    world.addChild(altar);

    console.log("✅ Altar criado na posição:", altar.getPosition());

    var bancoTex = window.GAME_TEXTURES?.world?.banco;
    var portalTex = window.GAME_TEXTURES?.world?.portal;
    var posteTex = window.GAME_TEXTURES?.world?.poste;

    var bancoData = [
      { pos: new pc.Vec3(-9, 9, 0.01), flipX: true },
      { pos: new pc.Vec3(9, 9, 0.01), flipX: false },
      { pos: new pc.Vec3(-9, -9, 0.01), flipX: true },
      { pos: new pc.Vec3(9, -9, 0.01), flipX: false },
    ];
    bancoData.forEach(function (data, i) {
      var banco = new pc.Entity("Banco" + i);
      banco.addComponent("render", { type: "box", layers: [LAYERS.OBJECTS] });
      var scaleX = data.flipX ? -2.0 : 2.0;
      banco.setLocalScale(scaleX, 2.0, 0.1);
      banco.setLocalPosition(data.pos.x, data.pos.y, data.pos.z);
      if (bancoTex)
        banco.render.meshInstances[0].material = makeMaterial(bancoTex);
      else {
        var mat = new pc.StandardMaterial();
        mat.diffuse.set(0.4, 0.3, 0.2);
        mat.update();
        banco.render.meshInstances[0].material = mat;
      }
      world.addChild(banco);
    });

    var portal = new pc.Entity("Portal");
    portal.addComponent("render", { type: "box", layers: [LAYERS.OBJECTS] });
    portal.setLocalScale(3.5, 3.5, 0.1);
    portal.setLocalPosition(0, 100, 0.01);
    if (portalTex)
      portal.render.meshInstances[0].material = makeMaterial(portalTex);
    else {
      var matPortal = new pc.StandardMaterial();
      matPortal.diffuse.set(0.5, 0.2, 0.8);
      matPortal.emissive.set(0.5, 0.2, 0.8);
      matPortal.emissiveIntensity = 0.5;
      matPortal.update();
      portal.render.meshInstances[0].material = matPortal;
    }
    world.addChild(portal);

    var postePositions = [new pc.Vec3(-9, 0, 0.01), new pc.Vec3(9, 0, 0.01)];
    postePositions.forEach(function (pos, i) {
      var poste = new pc.Entity("Poste" + i);
      poste.addComponent("render", { type: "box", layers: [LAYERS.OBJECTS] });
      poste.setLocalScale(1.2, 2.2, 0.1);
      poste.setLocalPosition(pos.x, pos.y, pos.z);
      if (posteTex)
        poste.render.meshInstances[0].material = makeMaterial(posteTex);
      else {
        var mat = new pc.StandardMaterial();
        mat.diffuse.set(0.3, 0.3, 0.3);
        mat.update();
        poste.render.meshInstances[0].material = mat;
      }
      world.addChild(poste);
    });

    var gm = new pc.Entity("GameManager");
    gm.addComponent("script");
    gm.script.create("gameManager");
    world.addChild(gm);

    var enemyPrefab = new pc.Entity("EnemyPrefab");
    enemyPrefab.addComponent("render", {
      type: "box",
      layers: [LAYERS.ENEMIES],
    });
    enemyPrefab.setLocalScale(0.9, 0.9, 0.1);
    if (enemyTex[0])
      enemyPrefab.render.meshInstances[0].material = makeMaterial(enemyTex[0]);
    enemyPrefab._enemyTextures = enemyTex;
    enemyPrefab.addComponent("script");
    enemyPrefab.script.create("enemyAI");
    enemyPrefab.enabled = false;
    gm.addChild(enemyPrefab);

    window.GAME_LAYERS = LAYERS;

    var spawnPointTop = new pc.Entity("SpawnPointTop");
    spawnPointTop.setLocalPosition(0, 11, 0);
    world.addChild(spawnPointTop);

    var uiMgr = new pc.Entity("UiManager");
    uiMgr.addComponent("script");
    uiMgr.script.create("uiManager", {
      attributes: {
        menuPanel: menuPanel,
        hudPanel: hudPanel,
        pausePanel: pausePanel,
        enemyCountText: enemyCountText,
        hintText: hintText,
        progressBar: progressBar,
      },
    });
    ui.addChild(uiMgr);

    gm.script.gameManager.player = player;
    gm.script.gameManager.altar = altar;
    gm.script.gameManager.uiManager = uiMgr;
    gm.script.gameManager.enemyPrefab = enemyPrefab;
    gm.script.gameManager.spawnPoints = [spawnPointTop];

    menuPanel.enabled = false;
    hudPanel.enabled = false;
    console.log("✅ Scene built successfully!");
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", main);
  else main();
})();
