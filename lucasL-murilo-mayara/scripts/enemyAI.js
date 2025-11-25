// Enemy AI: wander, chase, vision cone and collisions

var EnemyAI = pc.createScript("enemyAI");

EnemyAI.attributes.add("speedWander", { type: "number", default: 1.2 });
EnemyAI.attributes.add("speedChase", { type: "number", default: 2.5 });
EnemyAI.attributes.add("sightDistance", { type: "number", default: 6.5 });
EnemyAI.attributes.add("sightAngleDeg", { type: "number", default: 85 });
EnemyAI.attributes.add("boundsMin", { type: "vec2", default: [-11, -11] });
EnemyAI.attributes.add("boundsMax", { type: "vec2", default: [11, 11] });
EnemyAI.attributes.add("wanderChangeInterval", {
  type: "number",
  default: 2.5,
});
EnemyAI.attributes.add("hitboxSize", { type: "vec2", default: [0.9, 1.0] });
EnemyAI.attributes.add("debugVision", { type: "boolean", default: false });

EnemyAI.prototype.initialize = function () {
  this._state = "wander";
  this._wanderTimer = 0;
  this._targetPos = this._randomPoint();
  this._player = this.app.root.findByName("Player");

  this._facingDirection = new pc.Vec2(0, 1);
  this._moveDirection = new pc.Vec2(0, 0);

  this._currentSprite = 1;
  this._isFlipped = false;

  this.frameTextures = window.GAME_TEXTURES?.enemy || [];

  console.log("🎨 Enemy textures loaded:", this.frameTextures.length, "frames");

  var mi = this.entity.render?.meshInstances?.[0];
  if (mi) {
    this._material = mi.material || new pc.StandardMaterial();
    mi.material = this._material;
  }

  console.log("Creating vision cone for", this.entity.name);

  var oldVision = this.entity.findByName(this.entity.name + "_vision");
  if (oldVision) oldVision.destroy();

  this._createVisionCone();

  if (!this._visionBaseScale) {
    this._visionBaseScale = new pc.Vec3(
      this.sightDistance * 0.85,
      this.sightDistance * 1.0,
      1
    );
  }

  this._hitW = this.hitboxSize.x;
  this._hitH = this.hitboxSize.y;
  this._lastHitTime = 0;
  this._hitCooldown = 0.8;

  if (window.PLAYER_HITS === undefined) window.PLAYER_HITS = 0;

  console.log("✅ Enemy initialized:", this.entity.name);
};

EnemyAI.prototype._createVisionCone = function () {
  this._vision = new pc.Entity(this.entity.name + "_vision");

  try {
    var vertices = new Float32Array([0, 0, 0, -0.42, 1, 0, 0.42, 1, 0]);

    var indices = new Uint16Array([0, 1, 2]);
    var normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    var uvs = new Float32Array([0.5, 0, 0, 1, 1, 1]);

    var mesh = new pc.Mesh(this.app.graphicsDevice);
    mesh.setPositions(vertices);
    mesh.setNormals(normals);
    mesh.setUvs(0, uvs);
    mesh.setIndices(indices);
    mesh.update(pc.PRIMITIVE_TRIANGLES);

    var material = new pc.StandardMaterial();
    material.diffuse.set(1, 1, 0);
    material.emissive.set(1, 1, 0);
    material.emissiveIntensity = 0.7;
    material.opacity = 0.4;
    material.blendType = pc.BLEND_NORMAL;
    material.depthWrite = false;
    material.cull = pc.CULLFACE_NONE;
    material.update();

    var meshInstance = new pc.MeshInstance(mesh, material);

    this._vision.addComponent("render", {
      type: "asset",
      meshInstances: [meshInstance],
    });

    this._vision.setLocalScale(
      this.sightDistance * 0.85,
      this.sightDistance * 1.0,
      1
    );

    this._visionMat = material;

    this.entity.addChild(this._vision);
    this._vision.setLocalPosition(0, 0, 0.05);

    if (window.GAME_LAYERS?.VISION) {
      this._vision.render.layers = [window.GAME_LAYERS.VISION];
    } else {
      this._vision.render.layers = [pc.LAYERID_WORLD];
    }

    console.log("Vision cone created");
  } catch (error) {
    console.error("❌ Error creating vision cone:", error);
  }
};

EnemyAI.prototype._randomPoint = function () {
  var min = this.boundsMin,
    max = this.boundsMax;
  var margin = 2;
  var x = min.x + margin + Math.random() * (max.x - min.x - margin * 2);
  var y = min.y + margin + Math.random() * (max.y - min.y - margin * 2);
  return new pc.Vec3(x, y, 0);
};

EnemyAI.prototype.update = function (dt) {
  if (!this._player) {
    this._player = this.app.root.findByName("Player");
    if (!this._player) return;
  }

  this._wanderTimer -= dt;
  if (this._wanderTimer <= 0 && this._state === "wander") {
    this._targetPos = this._randomPoint();
    this._wanderTimer =
      this.wanderChangeInterval + Math.random() * this.wanderChangeInterval;
  }

  var playerInSight = this._isPlayerInCone();

  if (playerInSight) {
    this._state = "chase";
    this._targetPos = this._player.getPosition().clone();
    this._chaseLoseTimer = 1.5;
  } else if (this._state === "chase") {
    if (!this._chaseLoseTimer) this._chaseLoseTimer = 1.5;
    this._chaseLoseTimer -= dt;
    if (this._chaseLoseTimer <= 0) {
      this._state = "wander";
      this._chaseLoseTimer = 0;
    }
  }

  var speed = this._state === "chase" ? this.speedChase : this.speedWander;
  this._moveTowardTarget(this._targetPos, speed, dt);

  this._updateVisuals();

  if (this.debugVision && this._player) {
    this._drawDebug();
  }

  this._checkPlayerCollision();
};

EnemyAI.prototype._moveTowardTarget = function (target, speed, dt) {
  var cur = this.entity.getPosition();
  var dx = target.x - cur.x;
  var dy = target.y - cur.y;
  var dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.1) {
    this._moveDirection.set(0, 0);
    return;
  }

  dx /= dist;
  dy /= dist;

  this._facingDirection.set(dx, dy);
  this._moveDirection.set(dx, dy);

  var moveX = dx * speed * dt;
  var moveY = dy * speed * dt;
  var newX = cur.x + moveX;
  var newY = cur.y + moveY;

  if (!this._collidesWithObjects(newX, newY)) {
    this.entity.translate(moveX, moveY, 0);
  } else {
    if (!this._collidesWithObjects(newX, cur.y)) {
      this.entity.translate(moveX, 0, 0);
    } else if (!this._collidesWithObjects(cur.x, newY)) {
      this.entity.translate(0, moveY, 0);
    } else if (this._state === "wander") {
      this._targetPos = this._randomPoint();
      this._wanderTimer = 0.1;
    }
  }

  var p = this.entity.getLocalPosition();
  p.x = pc.math.clamp(p.x, this.boundsMin.x, this.boundsMax.x);
  p.y = pc.math.clamp(p.y, this.boundsMin.y, this.boundsMax.y);
  this.entity.setLocalPosition(p);
};

EnemyAI.prototype._collidesWithObjects = function (x, y) {
  var enemyHalfW = this._hitW / 2;
  var enemyHalfH = this._hitH / 2;

  var enemyBox = {
    minX: x - enemyHalfW,
    maxX: x + enemyHalfW,
    minY: y - enemyHalfH,
    maxY: y + enemyHalfH,
  };

  var objects = [];

  for (var i = 0; i < 4; i++) {
    var banco = this.app.root.findByName("Banco" + i);
    if (banco) objects.push({ entity: banco, halfW: 1.0, halfH: 1.0 });
  }

  for (var j = 0; j < 2; j++) {
    var poste = this.app.root.findByName("Poste" + j);
    if (poste) objects.push({ entity: poste, halfW: 0.6, halfH: 1.1 });
  }

  var torches = this.app.root.findByTag("torch");
  for (var t = 0; t < torches.length; t++) {
    objects.push({ entity: torches[t], halfW: 0.25, halfH: 0.25 });
  }

  for (var k = 0; k < objects.length; k++) {
    var obj = objects[k];
    var pos = obj.entity.getPosition();

    var objBox = {
      minX: pos.x - obj.halfW,
      maxX: pos.x + obj.halfW,
      minY: pos.y - obj.halfH,
      maxY: pos.y + obj.halfH,
    };

    if (
      !(
        enemyBox.maxX < objBox.minX ||
        enemyBox.minX > objBox.maxX ||
        enemyBox.maxY < objBox.minY ||
        enemyBox.minY > objBox.maxY
      )
    ) {
      return true;
    }
  }

  return false;
};

EnemyAI.prototype._isPlayerInCone = function () {
  if (!this._player) return false;

  var enemyPos = this.entity.getPosition();
  var playerPos = this._player.getPosition();

  var dx = playerPos.x - enemyPos.x;
  var dy = playerPos.y - enemyPos.y;
  var distToPlayer = Math.sqrt(dx * dx + dy * dy);

  if (distToPlayer > this.sightDistance) return false;
  if (distToPlayer < 0.1) return true;

  var toPlayerX = dx / distToPlayer;
  var toPlayerY = dy / distToPlayer;

  var facingX = this._facingDirection.x;
  var facingY = this._facingDirection.y;
  var facingLen = Math.sqrt(facingX * facingX + facingY * facingY);
  if (facingLen > 0) {
    facingX /= facingLen;
    facingY /= facingLen;
  }

  var dot = facingX * toPlayerX + facingY * toPlayerY;
  var angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);

  if (angleDeg > this.sightAngleDeg * 0.5) return false;

  var angleToRotate = Math.atan2(facingY, facingX) - Math.PI / 2;
  var cos = Math.cos(-angleToRotate);
  var sin = Math.sin(-angleToRotate);

  var localX = dx * cos - dy * sin;
  var localY = dx * sin + dy * cos;

  if (localY < 0) return false;
  if (localY > this.sightDistance) return false;

  var halfAngleRad = this.sightAngleDeg * 0.5 * (Math.PI / 180);
  var maxWidthAtBase = this.sightDistance * Math.tan(halfAngleRad);
  var maxWidthAtDepth = (localY / this.sightDistance) * maxWidthAtBase;

  if (Math.abs(localX) > maxWidthAtDepth) return false;

  return true;
};

// update visuals: sprite + vision cone
EnemyAI.prototype._updateVisuals = function () {
  if (!this._vision || !this._visionMat) return;

  var fx = this._facingDirection.x;
  var fy = this._facingDirection.y;

  // Normaliza
  var len = Math.sqrt(fx * fx + fy * fy);
  if (len < 0.01) {
    // Não está se movendo, mantém última direção
    return;
  }

  fx /= len;
  fy /= len;

  var absX = Math.abs(fx);
  var absY = Math.abs(fy);

  var texIdx = 0;
  var flip = false;

  // sprite selection by movement direction

  if (absX > absY) {
    // Movimento HORIZONTAL dominante (direita/esquerda)
    texIdx = 2; // Sprite lateral
    flip = fx < 0; // Se indo para esquerda, flipar
  } else {
    // Movimento VERTICAL dominante (cima/baixo)
    if (fy > 0) {
      // Indo para CIMA (Y positivo)
      texIdx = 1; // Sprite de frente (olhando para cima)
    } else {
      // Indo para BAIXO (Y negativo)
      texIdx = 0; // Sprite de costas (olhando para baixo)
    }
  }

  // debug when sprite changes
  if (this._currentSprite !== texIdx) {
    this._currentSprite = texIdx;
    var dirs = ["BAIXO↓", "CIMA↑", "LATERAL↔"];
    console.log(
      "Enemy",
      this.entity.name,
      "→",
      dirs[texIdx],
      flip ? "(flipped)" : ""
    );
  }

  // Aplica textura do sprite
  var asset = this.frameTextures?.[texIdx];
  var tex = asset?.resource || (asset instanceof pc.Texture ? asset : null);

  if (tex && this._material && this._material.diffuseMap !== tex) {
    this._material.diffuseMap = tex;
    this._material.emissiveMap = tex;
    this._material.update();
  }

  // flip sprite horizontally
  var s = this.entity.getLocalScale();
  this.entity.setLocalScale(flip ? -Math.abs(s.x) : Math.abs(s.x), s.y, s.z);

  // rotate vision cone to match facing (compensate sprite flip)
  var parentScaleX = this.entity.getLocalScale().x;
  var flipCorrection = parentScaleX < 0 ? -1 : 1;

  var angleRad = Math.atan2(fy, fx);
  var angleDeg = angleRad * (180 / Math.PI);

  // O cone aponta para Y+ (90 graus) no espaço local.
  // A rotação deve ser (ângulo da direção - 90) * correção de flip.
  var coneRotation = (angleDeg - 90) * flipCorrection;

  this._vision.setLocalEulerAngles(0, 0, coneRotation);

  // ensure cone scale positive
  this._vision.setLocalScale(
    this._visionBaseScale.x,
    this._visionBaseScale.y,
    this._visionBaseScale.z
  );

  // Offset na direção de movimento (usando fx, fy originais)
  var offset = 0.3;
  this._vision.setLocalPosition(fx * offset, fy * offset, 0.05);

  // Cor baseada no estado
  if (this._state === "chase") {
    this._visionMat.diffuse.set(1, 0.2, 0);
    this._visionMat.emissive.set(1, 0.2, 0);
    this._visionMat.opacity = 0.6;
  } else {
    this._visionMat.diffuse.set(1, 1, 0);
    this._visionMat.emissive.set(1, 1, 0);
    this._visionMat.opacity = 0.4; // Corrigido: opacidade base
  }

  // ✅ CORREÇÃO: Atualiza o material para aplicar as mudanças de cor/opacidade
  this._visionMat.update();
};

EnemyAI.prototype.getHitboxAabb = function () {
  var pos = this.entity.getPosition();
  var halfW = this._hitW / 2;
  var halfH = this._hitH / 2;
  return {
    minX: pos.x - halfW,
    maxX: pos.x + halfW,
    minY: pos.y - halfH,
    maxY: pos.y + halfH,
  };
};

EnemyAI.prototype._checkPlayerCollision = function () {
  const player = this.app.root.findByName("Player");
  if (!player) return;

  const eBox = this.getHitboxAabb();
  const pPos = player.getPosition();
  const pHalfW = 0.4;
  const pHalfH = 0.5;
  const pBox = {
    minX: pPos.x - pHalfW,
    maxX: pPos.x + pHalfW,
    minY: pPos.y - pHalfH,
    maxY: pPos.y + pHalfH,
  };

  const isColliding = !(
    eBox.maxX < pBox.minX ||
    eBox.minX > pBox.maxX ||
    eBox.maxY < pBox.minY ||
    eBox.minY > pBox.maxY
  );

  const now = Date.now();
  if (isColliding && now - this._lastHitTime > this._hitCooldown * 1000) {
    this._lastHitTime = now;

    if (window.PLAYER_HITS == null) window.PLAYER_HITS = 0;
    window.PLAYER_HITS++;
    console.log(`💥 Player hit! ${window.PLAYER_HITS} / 4`);

    if (window.PLAYER_HITS >= 4) {
      this._triggerGameOver();
    }
  }
};

EnemyAI.prototype._triggerGameOver = function () {
  if (this._gameOverTriggered) return;
  this._gameOverTriggered = true;

  this.app.timeScale = 0;

  const gameOverDiv = document.createElement("div");
  gameOverDiv.id = "gameOverScreen";
  gameOverDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: Arial, sans-serif;">
      <h1 style="color: #ff3333; font-size: 64px; text-align: center; margin-bottom: 20px; text-shadow: 0 0 20px rgba(255,51,51,0.8);">GAME OVER</h1>
      <h3 style="color: #ff9933; font-size: 24px; text-align: center; margin-bottom: 40px; max-width: 600px;">Você foi capturado pelos Towners... e a luz da Candelária permanece.</h3>
      <button id="restartGameBtn" style="padding: 20px 50px; font-size: 22px; background: linear-gradient(to bottom, #4CAF50, #388E3C); color: white; border: none; border-radius: 10px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: all 0.3s;">
        Voltar ao Menu Inicial
      </button>
    </div>
  `;

  document.body.appendChild(gameOverDiv);

  setTimeout(() => {
    const restartBtn = document.getElementById("restartGameBtn");
    if (restartBtn) {
      restartBtn.onmouseover = function () {
        this.style.transform = "scale(1.1)";
        this.style.boxShadow = "0 6px 20px rgba(76,175,80,0.6)";
      };
      restartBtn.onmouseout = function () {
        this.style.transform = "scale(1)";
        this.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
      };
      restartBtn.onclick = () => {
        console.log("🔄 Voltando ao menu inicial...");

        window.PLAYER_HITS = 0;
        this._gameOverTriggered = false;

        if (gameOverDiv && gameOverDiv.parentNode) {
          gameOverDiv.parentNode.removeChild(gameOverDiv);
        }

        const menu = document.getElementById("menuInicial");
        if (menu) {
          menu.style.display = "flex";
        }

        const btnPause = document.getElementById("btnPause");
        if (btnPause) {
          btnPause.style.display = "none";
        }

        this.app.fire("game:restart");
        this.app.fire("game:pause");
        this.app.timeScale = 0;
      };
    }
  }, 100);
};

EnemyAI.prototype._drawDebug = function () {
  var enemyPos = this.entity.getPosition();
  var playerPos = this._player.getPosition();
  var inSight = this._isPlayerInCone();

  var color = inSight ? new pc.Color(0, 1, 0) : new pc.Color(1, 0, 0);
  if (this.app.drawLine) {
    this.app.drawLine(enemyPos, playerPos, color, false);
  }

  var facingEnd = new pc.Vec3(
    enemyPos.x + this._facingDirection.x * 2,
    enemyPos.y + this._facingDirection.y * 2,
    enemyPos.z
  );
  if (this.app.drawLine) {
    this.app.drawLine(enemyPos, facingEnd, new pc.Color(0, 0.5, 1), false);
  }

  if (!this._lastDebugLog) this._lastDebugLog = 0;
  var now = Date.now();
  if (now - this._lastDebugLog > 2000) {
    var dx = playerPos.x - enemyPos.x;
    var dy = playerPos.y - enemyPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    console.log("👁️", this.entity.name, {
      facing:
        "(" +
        this._facingDirection.x.toFixed(2) +
        ", " +
        this._facingDirection.y.toFixed(2) +
        ")",
      distance: dist.toFixed(2),
      inCone: inSight ? "✅" : "❌",
      state: this._state,
    });
    this._lastDebugLog = now;
  }
};
