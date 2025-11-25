var GameManager = pc.createScript("gameManager");

GameManager.attributes.add("difficulty", {
  type: "string",
  enum: [{ Easy: "Easy" }, { Normal: "Normal" }, { Hard: "Hard" }],
  default: "Normal",
  title: "Start Difficulty",
});
GameManager.attributes.add("player", { type: "entity", title: "Player" });
GameManager.attributes.add("altar", { type: "entity", title: "Altar" });
GameManager.attributes.add("uiManager", {
  type: "entity",
  title: "UI Manager",
});
GameManager.attributes.add("enemyPrefab", {
  type: "entity",
  title: "Enemy Prefab",
});
GameManager.attributes.add("spawnPoints", {
  type: "entity",
  array: true,
  title: "Spawn Points",
});
GameManager.attributes.add("torchTag", {
  type: "string",
  default: "torch",
  title: "Torch Tag",
});
GameManager.attributes.add("requireAllLitForWin", {
  type: "boolean",
  default: true,
  title: "Win When All Lit",
});
GameManager.attributes.add("victoryHoldSeconds", {
  type: "number",
  default: 5.0,
  title: "Hold All Lit For (s)",
});

GameManager.prototype._getDifficultyTable = function () {
  return {
    Easy: {
      enemySpeed: 1.6,
      detectRange: 5.5,
      spawnInterval: 10,
      maxEnemies: 3,
      extinguishTime: 3.0,
    },
    Normal: {
      enemySpeed: 2.1,
      detectRange: 6.5,
      spawnInterval: 7,
      maxEnemies: 5,
      extinguishTime: 2.2,
    },
    Hard: {
      enemySpeed: 2.7,
      detectRange: 7.5,
      spawnInterval: 5,
      maxEnemies: 7,
      extinguishTime: 1.6,
    },
  };
};

GameManager.prototype.initialize = function () {
  try {
    var saved = window.localStorage?.getItem("ash:difficulty");
    if (saved) this.difficulty = saved;
  } catch (e) {}
  this._state = "paused";
  this._difficultyParams =
    this._getDifficultyTable()[this.difficulty] ||
    this._getDifficultyTable().Normal;
  this._torchEntities = [];
  this._litCount = 0;
  this._totalTorches = 0;
  this._currentMaxEnemies = 2;
  this._collisionObjects = [];
  this._cacheCollisionObjects();
  this.app.on("torch:lit", this._onTorchLit, this);
  this.app.on("torch:unlit", this._onTorchUnlit, this);
  this.app.on("game:pause", this._onPause, this);
  this.app.on("game:resume", this._onResume, this);
  this.app.on("game:restart", this._onRestart, this);
  this.app.on("game:reset", this.resetGame, this);
  this.app.on("game:victory", this._onVictory, this);
  this.app.on("game:defeat", this._onDefeat, this);
  this._collectTorches();
  this._updateHUD();
  this._enemies = [];
  this._spawnTimer = 3.0;
  this._spawnAttempts = 0;
  this._updateAltar();
};

GameManager.prototype.onDestroy = function () {
  this.app.off("torch:lit", this._onTorchLit, this);
  this.app.off("torch:unlit", this._onTorchUnlit, this);
  this.app.off("game:pause", this._onPause, this);
  this.app.off("game:resume", this._onResume, this);
  this.app.off("game:restart", this._onRestart, this);
  this.app.off("game:victory", this._onVictory, this);
  this.app.off("game:defeat", this._onDefeat, this);
};

GameManager.prototype._cacheCollisionObjects = function () {
  this._collisionObjects = [];
  for (var i = 0; i < 4; i++) {
    var banco = this.app.root.findByName("Banco" + i);
    if (banco)
      this._collisionObjects.push({
        entity: banco,
        halfW: 1.2,
        halfH: 1.2,
        type: "banco",
      });
  }
  for (var j = 0; j < 4; j++) {
    var poste = this.app.root.findByName("Poste" + j);
    if (poste)
      this._collisionObjects.push({
        entity: poste,
        halfW: 0.8,
        halfH: 1.3,
        type: "poste",
      });
  }
};

GameManager.prototype._collectTorches = function () {
  var tagged = this.app.root.findByTag(this.torchTag);
  this._torchEntities = tagged || [];
  this._totalTorches = this._torchEntities.length;
  this._litCount = 0;
  for (var i = 0; i < this._torchEntities.length; i++) {
    var t = this._torchEntities[i];
    var ts = t.script?.torch;
    if (ts && ts.isLit()) this._litCount++;
  }
};

GameManager.prototype._onTorchLit = function (torchScript) {
  this._litCount++;
  this._updateHUD();
  this._updateAltar();
  if (this._litCount <= 4) this._currentMaxEnemies = 2 + this._litCount;
  if (
    this.requireAllLitForWin &&
    this._litCount >= this._totalTorches &&
    this._totalTorches > 0
  ) {
    this._victoryCheckTime = this.victoryHoldSeconds;
    this._pendingVictory = true;
  }
};

GameManager.prototype._onTorchUnlit = function (torchScript) {
  this._litCount = Math.max(0, this._litCount - 1);
  this._pendingVictory = false;
  this._updateHUD();
  this._updateAltar();
  if (this._litCount === 0 && this._totalTorches > 0) this._onDefeat();
};

GameManager.prototype._updateAltar = function () {
  if (this.altar?.script?.altar)
    this.app.fire("altar:update", this._litCount, this._totalTorches);
};

GameManager.prototype._updateHUD = function () {
  this.app.fire("hud:update", {
    lit: this._litCount,
    total: this._totalTorches,
    difficulty: this.difficulty,
    enemies: this._enemies ? this._enemies.length : 0,
  });
};

GameManager.prototype._onPause = function () {
  this._state = "paused";
};
GameManager.prototype._onResume = function () {
  this._state = "playing";
};
GameManager.prototype._onRestart = function () {
  this.resetGame();
  this.app.fire("game:resume");
};

GameManager.prototype._onVictory = function () {
  if (this._state === "victory") return;
  this._state = "victory";
  this.app.fire("game:state", { state: "victory" });
  this.app.fire("game:pause");
};

GameManager.prototype._onDefeat = function () {
  if (this._state === "defeat") return;
  this._state = "defeat";
  this.app.fire("game:state", { state: "defeat" });
  this.app.fire("game:pause");
};

GameManager.prototype.update = function (dt) {
  if (this._state !== "playing") return;
  if (this._pendingVictory) {
    this._victoryCheckTime -= dt;
    if (this._victoryCheckTime <= 0) {
      var allLit = true;
      for (var i = 0; i < this._torchEntities.length; i++) {
        var ts = this._torchEntities[i].script?.torch;
        if (!ts || !ts.isLit()) {
          allLit = false;
          break;
        }
      }
      if (allLit) this._onVictory();
      this._pendingVictory = false;
    }
  }
  this._spawnTimer -= dt;
  if (this._spawnTimer <= 0) {
    this._spawnTimer = this._difficultyParams.spawnInterval;
    this._enemies = this._enemies.filter(function (e) {
      return e && e.parent;
    });
    if (this._enemies.length < this._currentMaxEnemies) {
      this._spawnEnemySafe();
      this._updateHUD();
    }
  }
};

GameManager.prototype._spawnEnemySafe = function () {
  if (!this.enemyPrefab) {
    console.error("No enemy prefab!");
    return;
  }
  var maxAttempts = 30;
  var attempt = 0;
  var validPos = null;
  while (attempt < maxAttempts && !validPos) {
    attempt++;
    var testPos = this._getRandomSpawnPosition();
    if (this._isPositionValid(testPos)) {
      validPos = testPos;
      break;
    }
  }
  if (!validPos) {
    console.warn("Could not find valid spawn position");
    return;
  }
  var clone = this.enemyPrefab.clone();
  clone.enabled = true;
  clone.name = "Enemy_" + Date.now();
  this.entity.addChild(clone);
  clone.setPosition(validPos);
  if (window.GAME_LAYERS && clone.render)
    clone.render.layers = [window.GAME_LAYERS.ENEMIES];
  if (!clone.script?.enemyAI) {
    if (!clone.script) clone.addComponent("script");
    clone.script.create("enemyAI");
  }
  if (clone.script?.enemyAI) {
    clone.script.enemyAI.gameManager = this.entity;
    clone.script.enemyAI.extinguishTime = this._difficultyParams.extinguishTime;
    clone.script.enemyAI.sightDistance = this._difficultyParams.detectRange;
    clone.script.enemyAI.speedWander = this._difficultyParams.enemySpeed * 0.6;
    clone.script.enemyAI.speedChase = this._difficultyParams.enemySpeed;
  }
  this._enemies.push(clone);
};

GameManager.prototype._getRandomSpawnPosition = function () {
  var spawnMethods = [
    this._spawnFromPoints.bind(this),
    this._spawnAtEdge.bind(this),
    this._spawnRandom.bind(this),
  ];
  var method = spawnMethods[Math.floor(Math.random() * spawnMethods.length)];
  return method();
};

GameManager.prototype._spawnFromPoints = function () {
  if (this.spawnPoints && this.spawnPoints.length > 0) {
    var sp =
      this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    return sp.getPosition().clone();
  }
  return this._spawnAtEdge();
};

GameManager.prototype._spawnAtEdge = function () {
  var edge = Math.floor(Math.random() * 4);
  var x, y;
  switch (edge) {
    case 0:
      x = this.player
        ? this.player.getPosition().x + (Math.random() - 0.5) * 10
        : 0;
      y = 10;
      break;
    case 1:
      x = 10;
      y = this.player
        ? this.player.getPosition().y + (Math.random() - 0.5) * 10
        : 0;
      break;
    case 2:
      x = this.player
        ? this.player.getPosition().x + (Math.random() - 0.5) * 10
        : 0;
      y = -10;
      break;
    case 3:
      x = -10;
      y = this.player
        ? this.player.getPosition().y + (Math.random() - 0.5) * 10
        : 0;
      break;
  }
  return new pc.Vec3(
    pc.math.clamp(x, -10, 10),
    pc.math.clamp(y, -10, 10),
    0.02
  );
};

GameManager.prototype._spawnRandom = function () {
  return new pc.Vec3(
    (Math.random() - 0.5) * 18,
    (Math.random() - 0.5) * 18,
    0.02
  );
};

GameManager.prototype._isPositionValid = function (pos) {
  var minDistance = 3.5;
  var minEnemyDistance = 2.5;
  var minTorchDistance = 2.0;
  var minObjectDistance = 2.5;
  if (this.player) {
    var pPos = this.player.getPosition();
    var dx = pos.x - pPos.x;
    var dy = pos.y - pPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) return false;
  }
  for (var i = 0; i < this._enemies.length; i++) {
    var e = this._enemies[i];
    if (!e || !e.parent) continue;
    var ePos = e.getPosition();
    var dx2 = pos.x - ePos.x;
    var dy2 = pos.y - ePos.y;
    var dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (dist2 < minEnemyDistance) return false;
  }
  for (var j = 0; j < this._torchEntities.length; j++) {
    var torch = this._torchEntities[j];
    var tPos = torch.getPosition();
    var dx3 = pos.x - tPos.x;
    var dy3 = pos.y - tPos.y;
    var dist3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
    if (dist3 < minTorchDistance) return false;
  }
  if (this.altar) {
    var aPos = this.altar.getPosition();
    var dx4 = pos.x - aPos.x;
    var dy4 = pos.y - aPos.y;
    var dist4 = Math.sqrt(dx4 * dx4 + dy4 * dy4);
    if (dist4 < 2.5) return false;
  }
  for (var k = 0; k < this._collisionObjects.length; k++) {
    var obj = this._collisionObjects[k];
    var objPos = obj.entity.getPosition();
    var dx5 = pos.x - objPos.x;
    var dy5 = pos.y - objPos.y;
    var dist5 = Math.sqrt(dx5 * dx5 + dy5 * dy5);
    var minDist = Math.max(obj.halfW, obj.halfH) + minObjectDistance;
    if (dist5 < minDist) return false;
  }
  return true;
};

GameManager.prototype.resetGame = function () {
  try {
    var saved = window.localStorage?.getItem("ash:difficulty");
    if (saved) this.difficulty = saved;
  } catch (e) {}
  this._difficultyParams =
    this._getDifficultyTable()[this.difficulty] ||
    this._getDifficultyTable().Normal;
  this._currentMaxEnemies = 2;
  if (window.PLAYER_HITS !== undefined) window.PLAYER_HITS = 0;
  this.app.fire("player:reset");
  if (this._enemies) {
    for (var i = 0; i < this._enemies.length; i++) {
      if (this._enemies[i]?.destroy) this._enemies[i].destroy();
    }
  }
  this._enemies = [];
  this._spawnTimer = 3.0;
  this._collectTorches();
  for (var t = 0; t < this._torchEntities.length; t++) {
    var te = this._torchEntities[t];
    var ts = te.script?.torch;
    if (ts) ts.setLit(!!ts.startLit);
  }
  this._litCount = 0;
  for (var j = 0; j < this._torchEntities.length; j++) {
    var ts2 = this._torchEntities[j].script?.torch;
    if (ts2 && ts2.isLit()) this._litCount++;
  }
  this._pendingVictory = false;
  this._updateHUD();
  this._updateAltar();
};
