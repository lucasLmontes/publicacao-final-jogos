var PlayerController = pc.createScript("playerController");

PlayerController.attributes.add("speed", {
  type: "number",
  default: 5,
  title: "Speed",
});
PlayerController.attributes.add("boundsMin", {
  type: "vec2",
  default: [-11, -11],
  title: "Bounds Min",
});
PlayerController.attributes.add("boundsMax", {
  type: "vec2",
  default: [11, 11],
  title: "Bounds Max",
});
PlayerController.attributes.add("hitboxSize", {
  type: "vec2",
  default: [1.0, 1.2],
  title: "Hitbox Size (w,h)",
});
PlayerController.attributes.add("interactionRadius", {
  type: "number",
  default: 1.5,
  title: "Interaction Radius (tochas)",
});
PlayerController.attributes.add("startPosition", {
  type: "vec3",
  default: [0, -5, 0.02],
  title: "Start Position",
});

PlayerController.prototype.initialize = function () {
  this.app.keyboard = this.app.keyboard || new pc.Keyboard(window);

  this._dir = new pc.Vec2(0, 0);
  this._lastDir = new pc.Vec2(0, -1);

  this.frameTextures =
    window.GAME_TEXTURES?.player || window.GAME_TEXTURES?.hero || [];

  var mi =
    this.entity.render &&
    this.entity.render.meshInstances &&
    this.entity.render.meshInstances[0];
  if (mi) {
    this._material = mi.material || new pc.StandardMaterial();
    mi.material = this._material;
  } else {
    this._material = null;
  }

  this._hitW = this.hitboxSize.x;
  this._hitH = this.hitboxSize.y;

  this.isInteractHeld = false;
  this._nearbyTorch = null;
  this._interactingTorch = null;

  this._startPosition = this.startPosition.clone();

  this.app.on("player:reset", this.resetToStart, this);
};

PlayerController.prototype.onDestroy = function () {
  this.app.off("player:reset", this.resetToStart, this);
};

PlayerController.prototype.resetToStart = function () {
  this.entity.setPosition(this._startPosition.clone());
  this._dir.set(0, 0);
  this._lastDir.set(0, -1);
  this.isInteractHeld = false;
  this._nearbyTorch = null;
  this._interactingTorch = null;
};

PlayerController.prototype.update = function (dt) {
  this._readInput();
  this._move(dt);
  this._clampToBounds();
  this._updateSprite();
  this._checkTorchInteraction();
};

PlayerController.prototype._readInput = function () {
  var x = 0,
    y = 0;
  if (
    this.app.keyboard.isPressed(pc.KEY_LEFT) ||
    this.app.keyboard.isPressed(pc.KEY_A)
  )
    x -= 1;
  if (
    this.app.keyboard.isPressed(pc.KEY_RIGHT) ||
    this.app.keyboard.isPressed(pc.KEY_D)
  )
    x += 1;
  if (
    this.app.keyboard.isPressed(pc.KEY_UP) ||
    this.app.keyboard.isPressed(pc.KEY_W)
  )
    y += 1;
  if (
    this.app.keyboard.isPressed(pc.KEY_DOWN) ||
    this.app.keyboard.isPressed(pc.KEY_S)
  )
    y -= 1;

  if (x !== 0 || y !== 0) {
    var len = Math.sqrt(x * x + y * y);
    this._dir.set(x / len, y / len);
    this._lastDir.copy(this._dir);
  } else {
    this._dir.set(0, 0);
  }

  this.isInteractHeld = this.app.keyboard.isPressed(pc.KEY_E);
};

PlayerController.prototype._move = function (dt) {
  if (this._dir.lengthSq() === 0) return;
  var dx = this._dir.x * this.speed * dt;
  var dy = this._dir.y * this.speed * dt;
  var currentPos = this.entity.getLocalPosition();
  var newX = currentPos.x + dx;
  var newY = currentPos.y + dy;
  if (!this._collidesWithObjects(newX, newY)) {
    this.entity.setLocalPosition(newX, newY, currentPos.z);
  } else {
    if (!this._collidesWithObjects(newX, currentPos.y)) {
      this.entity.setLocalPosition(newX, currentPos.y, currentPos.z);
    } else if (!this._collidesWithObjects(currentPos.x, newY)) {
      this.entity.setLocalPosition(currentPos.x, newY, currentPos.z);
    }
  }
};

PlayerController.prototype._collidesWithObjects = function (x, y) {
  if (this._collidesWithTorches(x, y)) return true;
  if (this._collidesWithDecorations(x, y)) return true;
  return false;
};

PlayerController.prototype._collidesWithTorches = function (x, y) {
  var torches = this.app.root.findByTag("torch");
  var playerRadius = 0.5;
  var torchRadius = 0.25;
  var minDist = playerRadius + torchRadius;
  for (var i = 0; i < torches.length; i++) {
    var torchPos = torches[i].getPosition();
    var dx = x - torchPos.x;
    var dy = y - torchPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) return true;
  }
  return false;
};

PlayerController.prototype._collidesWithDecorations = function (x, y) {
  var playerHalfW = this._hitW / 2;
  var playerHalfH = this._hitH / 2;
  var playerBox = {
    minX: x - playerHalfW,
    maxX: x + playerHalfW,
    minY: y - playerHalfH,
    maxY: y + playerHalfH,
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
  var portal = this.app.root.findByName("Portal");
  if (portal) objects.push({ entity: portal, halfW: 1.75, halfH: 1.75 });
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
        playerBox.maxX < objBox.minX ||
        playerBox.minX > objBox.maxX ||
        playerBox.maxY < objBox.minY ||
        playerBox.minY > objBox.maxY
      )
    )
      return true;
  }
  return false;
};

PlayerController.prototype._clampToBounds = function () {
  var p = this.entity.getLocalPosition();
  p.x = pc.math.clamp(p.x, this.boundsMin.x, this.boundsMax.x);
  p.y = pc.math.clamp(p.y, this.boundsMin.y, this.boundsMax.y);
  this.entity.setLocalPosition(p);
};

PlayerController.prototype._checkTorchInteraction = function () {
  var playerPos = this.entity.getPosition();
  var torches = this.app.root.findByTag("torch");
  var closestTorch = null;
  var closestDist = Infinity;
  for (var i = 0; i < torches.length; i++) {
    var torch = torches[i];
    var torchPos = torch.getPosition();
    var dx = playerPos.x - torchPos.x;
    var dy = playerPos.y - torchPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= this.interactionRadius && dist < closestDist) {
      closestDist = dist;
      closestTorch = torch;
    }
  }

  if (closestTorch && !this.isInteractHeld) {
    var torchScript = closestTorch.script && closestTorch.script.torch;
    if (torchScript && !torchScript.isLit())
      this.app.fire("ui:hint", "Pressione E para acender a tocha");
  }

  if (this._nearbyTorch !== closestTorch) {
    if (this._nearbyTorch) {
      var oldScript =
        this._nearbyTorch.script && this._nearbyTorch.script.torch;
      if (oldScript) oldScript.cancelIgnite(this.entity);
    }
    this._nearbyTorch = closestTorch;
  }

  if (this.isInteractHeld && this._nearbyTorch) {
    var torchScript =
      this._nearbyTorch.script && this._nearbyTorch.script.torch;
    if (torchScript && !torchScript.isLit()) {
      if (this._interactingTorch !== this._nearbyTorch) {
        torchScript.beginIgnite(this.entity);
        this._interactingTorch = this._nearbyTorch;
      }
    }
  } else {
    if (this._interactingTorch) {
      var script =
        this._interactingTorch.script && this._interactingTorch.script.torch;
      if (script) script.cancelIgnite(this.entity);
      this._interactingTorch = null;
    }
    if (!closestTorch) this.app.fire("ui:hint", "");
  }
};

PlayerController.prototype.getHitboxAabb = function () {
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

PlayerController.prototype._updateSprite = function () {
  if (!this.frameTextures || this.frameTextures.length < 3) return;
  if (!this._material) return;
  var absX = Math.abs(this._lastDir.x);
  var absY = Math.abs(this._lastDir.y);
  var texIdx = 1;
  var flip = false;
  if (absX > absY) {
    texIdx = 2;
    flip = this._lastDir.x < 0;
  } else {
    texIdx = this._lastDir.y > 0 ? 1 : 0;
  }
  var asset = this.frameTextures[texIdx];
  var tex =
    asset && asset.resource
      ? asset.resource
      : asset instanceof pc.Texture
      ? asset
      : null;
  if (tex) {
    if (this._material.diffuseMap !== tex) {
      this._material.diffuseMap = tex;
      this._material.emissiveMap = tex;
      this._material.update();
    }
  }
  var s = this.entity.getLocalScale();
  this.entity.setLocalScale(flip ? -Math.abs(s.x) : Math.abs(s.x), s.y, s.z);
};
