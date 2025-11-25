var Torch = pc.createScript("torch");

Torch.attributes.add("startLit", {
  type: "boolean",
  default: false,
  title: "Start Lit",
});
Torch.attributes.add("igniteTime", {
  type: "number",
  default: 5.0,
  title: "Ignite Hold Time (s)",
});
Torch.attributes.add("extinguishTime", {
  type: "number",
  default: 2.5,
  title: "Extinguish Time (s)",
});
Torch.attributes.add("spriteFrames", {
  type: "number",
  default: 2,
  title: "Sprite Frames (0=unlit,1=lit)",
});
Torch.attributes.add("litFrameIndex", {
  type: "number",
  default: 1,
  title: "Lit Frame Index",
});
Torch.attributes.add("unlitFrameIndex", {
  type: "number",
  default: 0,
  title: "Unlit Frame Index",
});
Torch.attributes.add("tag", {
  type: "string",
  default: "torch",
  title: "Entity Tag",
});
Torch.attributes.add("vfxOnIgnite", {
  type: "entity",
  title: "Ignite VFX (optional)",
});
Torch.attributes.add("vfxOnExtinguish", {
  type: "entity",
  title: "Extinguish VFX (optional)",
});
Torch.attributes.add("unlitTexture", {
  type: "asset",
  title: "Unlit Texture (optional)",
});
Torch.attributes.add("litTexture", {
  type: "asset",
  title: "Lit Texture (optional)",
});

Torch.prototype.initialize = function () {
  this._isLit = !!this.startLit;
  this._igniteBy = null;
  this._igniteProgress = 0;
  this._extinguishBy = null;
  this._extinguishProgress = 0;
  if (this.tag) this.entity.tags.add(this.tag);
  this.app.fire("torch:register", this.entity);
  this._applySprite();
  this._createProgressBar();
};

Torch.prototype.onDestroy = function () {
  this.app.fire("torch:unregister", this.entity);
  if (this._progressContainer && this._progressContainer.parentNode)
    this._progressContainer.parentNode.removeChild(this._progressContainer);
};

Torch.prototype._createProgressBar = function () {
  this._progressContainer = document.createElement("div");
  this._progressContainer.id = "torch-progress-container";
  this._progressContainer.style.position = "fixed";
  this._progressContainer.style.bottom = "80px";
  this._progressContainer.style.left = "50%";
  this._progressContainer.style.transform = "translateX(-50%)";
  this._progressContainer.style.width = "400px";
  this._progressContainer.style.display = "none";
  this._progressContainer.style.zIndex = "1000";
  this._progressContainer.style.fontFamily = "Arial, sans-serif";

  this._progressText = document.createElement("div");
  this._progressText.style.color = "#FFD700";
  this._progressText.style.fontSize = "18px";
  this._progressText.style.textAlign = "center";
  this._progressText.style.marginBottom = "8px";
  this._progressText.style.fontWeight = "bold";
  this._progressText.style.textShadow = "2px 2px 4px rgba(0,0,0,0.8)";
  this._progressText.textContent = "🔥 Acendendo tocha...";

  this._progressBarBg = document.createElement("div");
  this._progressBarBg.style.width = "100%";
  this._progressBarBg.style.height = "30px";
  this._progressBarBg.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  this._progressBarBg.style.border = "2px solid #FFD700";
  this._progressBarBg.style.borderRadius = "15px";
  this._progressBarBg.style.overflow = "hidden";
  this._progressBarBg.style.boxShadow = "0 0 10px rgba(255, 215, 0, 0.5)";

  this._progressBarFill = document.createElement("div");
  this._progressBarFill.style.width = "0%";
  this._progressBarFill.style.height = "100%";
  this._progressBarFill.style.background =
    "linear-gradient(90deg, #FF6B00 0%, #FFD700 50%, #FFF700 100%)";
  this._progressBarFill.style.transition = "width 0.1s ease-out";
  this._progressBarFill.style.boxShadow =
    "inset 0 2px 4px rgba(255, 255, 255, 0.3)";

  this._progressPercent = document.createElement("div");
  this._progressPercent.style.position = "absolute";
  this._progressPercent.style.width = "100%";
  this._progressPercent.style.height = "30px";
  this._progressPercent.style.lineHeight = "30px";
  this._progressPercent.style.textAlign = "center";
  this._progressPercent.style.color = "white";
  this._progressPercent.style.fontSize = "16px";
  this._progressPercent.style.fontWeight = "bold";
  this._progressPercent.style.textShadow = "1px 1px 3px rgba(0,0,0,0.9)";
  this._progressPercent.textContent = "0%";

  this._progressBarBg.appendChild(this._progressBarFill);
  var barWrapper = document.createElement("div");
  barWrapper.style.position = "relative";
  barWrapper.appendChild(this._progressBarBg);
  barWrapper.appendChild(this._progressPercent);
  this._progressContainer.appendChild(this._progressText);
  this._progressContainer.appendChild(barWrapper);
  document.body.appendChild(this._progressContainer);
};

Torch.prototype._updateProgressBar = function (percent, visible) {
  if (!this._progressContainer) return;
  if (visible) {
    this._progressContainer.style.display = "block";
    this._progressBarFill.style.width = percent + "%";
    this._progressPercent.textContent = Math.floor(percent) + "%";
    if (percent > 80) {
      this._progressBarBg.style.borderColor = "#FFF700";
      this._progressBarBg.style.boxShadow = "0 0 20px rgba(255, 247, 0, 0.8)";
    } else {
      this._progressBarBg.style.borderColor = "#FFD700";
      this._progressBarBg.style.boxShadow = "0 0 10px rgba(255, 215, 0, 0.5)";
    }
  } else {
    this._progressContainer.style.display = "none";
  }
};

Torch.prototype._applySprite = function () {
  if (this.entity.sprite) {
    this.entity.sprite.frame = this._isLit
      ? this.litFrameIndex
      : this.unlitFrameIndex;
    return;
  }
  if (this.entity.render) {
    var asset = this._isLit ? this.litTexture : this.unlitTexture;
    var tex = asset && asset.resource ? asset.resource : asset;
    if (tex) {
      var mat = this.entity.render.material;
      if (!mat) {
        mat = new pc.StandardMaterial();
        this.entity.render.material = mat;
      }
      mat.diffuseMap = tex;
      mat.opacityMap = tex;
      mat.blendType = pc.BLEND_PREMULTIPLIED;
      mat.useLighting = false;
      mat.update();
    } else {
      var mat2 =
        this.entity.render.material ||
        this.entity.render.meshInstances[0].material;
      if (!mat2) {
        mat2 = new pc.StandardMaterial();
        this.entity.render.meshInstances[0].material = mat2;
      }
      var color = this._isLit
        ? new pc.Color(1, 0.9, 0.2)
        : new pc.Color(0.6, 0.1, 0.1);
      mat2.diffuse = color;
      mat2.emissive = color;
      mat2.useLighting = false;
      mat2.update();
    }
  }
};

Torch.prototype.isLit = function () {
  return this._isLit;
};

Torch.prototype.beginIgnite = function (playerEntity) {
  if (this._isLit) return;
  if (this._igniteBy && this._igniteBy !== playerEntity) return;
  this._igniteBy = playerEntity;
};

Torch.prototype.cancelIgnite = function (playerEntity) {
  if (this._igniteBy === playerEntity) {
    this._igniteBy = null;
    this._igniteProgress = 0;
    this._updateProgressBar(0, false);
    this.app.fire("ui:hint", "");
  }
};

Torch.prototype.beginExtinguish = function (enemyEntity) {
  if (!this._isLit) return;
  this._extinguishBy = enemyEntity;
};

Torch.prototype.cancelExtinguish = function (enemyEntity) {
  if (this._extinguishBy === enemyEntity) {
    this._extinguishBy = null;
    this._extinguishProgress = 0;
  }
};

Torch.prototype.update = function (dt) {
  if (this._igniteBy && !this._isLit) {
    var pcScript =
      this._igniteBy.script && this._igniteBy.script.playerController;
    var stillHolding = pcScript && pcScript.isInteractHeld;
    var withinReach = false;
    if (this._igniteBy) {
      var a = this._igniteBy.getPosition();
      var b = this.entity.getPosition();
      var dx = a.x - b.x,
        dy = a.y - b.y;
      var dsq = dx * dx + dy * dy;
      var r = pcScript ? pcScript.interactionRadius : 1.5;
      withinReach = dsq <= r * r;
    }
    if (stillHolding && withinReach) {
      this._igniteProgress += dt;
      var percent = Math.min(
        100,
        (this._igniteProgress / this.igniteTime) * 100
      );
      this._updateProgressBar(percent, true);
      this.app.fire("ui:hint", "💡 Segure E para acender");
      this._applyIgniteEffect(percent / 100);
      if (this._igniteProgress >= this.igniteTime) {
        this._setLit(true);
        this._igniteBy = null;
        this._igniteProgress = 0;
        this._updateProgressBar(0, false);
        this.app.fire("ui:hint", "✅ Tocha acesa!");
        this._playVfx(this.vfxOnIgnite);
        var self = this;
        setTimeout(function () {
          self.app.fire("ui:hint", "");
        }, 2000);
      }
    } else {
      this._igniteBy = null;
      this._igniteProgress = 0;
      this._updateProgressBar(0, false);
      this.app.fire("ui:hint", "");
    }
  }
  if (this._extinguishBy && this._isLit) {
    var a2 = this._extinguishBy.getPosition();
    var b2 = this.entity.getPosition();
    var dx2 = a2.x - b2.x,
      dy2 = a2.y - b2.y;
    if (dx2 * dx2 + dy2 * dy2 < 1.2 * 1.2) {
      this._extinguishProgress += dt;
      if (this._extinguishProgress >= this.extinguishTime) {
        this._setLit(false);
        this._extinguishBy = null;
        this._extinguishProgress = 0;
        this._playVfx(this.vfxOnExtinguish);
      }
    } else {
      this._extinguishBy = null;
      this._extinguishProgress = 0;
    }
  }
};

Torch.prototype._applyIgniteEffect = function (progress) {
  if (!this.entity.render) return;
  var mat =
    this.entity.render.material || this.entity.render.meshInstances[0].material;
  if (!mat) return;
  var r = 0.6 + 0.4 * progress;
  var g = 0.1 + 0.8 * progress;
  var b = 0.1 + 0.1 * progress;
  var color = new pc.Color(r, g, b);
  mat.emissive = color;
  mat.emissiveIntensity = 0.5 + 0.5 * progress;
  mat.update();
};

Torch.prototype._setLit = function (lit) {
  if (this._isLit === lit) return;
  this._isLit = lit;
  this._applySprite();
  if (lit) this.app.fire("torch:lit", this);
  else this.app.fire("torch:unlit", this);
};

Torch.prototype.setLit = function (lit) {
  this._setLit(!!lit);
};

Torch.prototype._playVfx = function (vfxEntity) {
  if (!vfxEntity) return;
  if (vfxEntity.particlesystem) {
    vfxEntity.particlesystem.reset();
    vfxEntity.particlesystem.play();
  }
  if (vfxEntity.sound) {
    var slots = Object.keys(vfxEntity.sound.slots);
    if (slots.length > 0) vfxEntity.sound.play(slots[0]);
  }
};
