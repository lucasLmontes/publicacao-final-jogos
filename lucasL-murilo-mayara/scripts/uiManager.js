// UI Manager: panel and HUD control
var UiManager = pc.createScript("uiManager");

// Panels
UiManager.attributes.add("menuPanel", { type: "entity", title: "Menu Panel" });
UiManager.attributes.add("hudPanel", { type: "entity", title: "HUD Panel" });
UiManager.attributes.add("pausePanel", {
  type: "entity",
  title: "Pause Panel",
});

// HUD elements
UiManager.attributes.add("torchesText", {
  type: "entity",
  title: "Torches Text Element",
});
UiManager.attributes.add("difficultyText", {
  type: "entity",
  title: "Difficulty Text Element",
});
UiManager.attributes.add("hintText", {
  type: "entity",
  title: "Hint Text Element (optional)",
});
UiManager.attributes.add("enemyCountText", {
  type: "entity",
  title: "Enemy Count Text (optional)",
});

// Buttons (Menu)
UiManager.attributes.add("btnStart", { type: "entity", title: "Start Button" });
UiManager.attributes.add("btnEasy", { type: "entity", title: "Easy Button" });
UiManager.attributes.add("btnNormal", {
  type: "entity",
  title: "Normal Button",
});
UiManager.attributes.add("btnHard", { type: "entity", title: "Hard Button" });
UiManager.attributes.add("btnCredits", {
  type: "entity",
  title: "Credits Button",
});
UiManager.attributes.add("btnExit", {
  type: "entity",
  title: "Exit Button (web: back to menu)",
});

// Buttons
UiManager.attributes.add("btnResume", {
  type: "entity",
  title: "Resume Button",
});
UiManager.attributes.add("btnRestart", {
  type: "entity",
  title: "Restart Button",
});
UiManager.attributes.add("btnReturnToMain", {
  type: "entity",
  title: "Return to Main Button",
});

// Scene names
UiManager.attributes.add("menuSceneName", {
  type: "string",
  default: "Menu",
  title: "Menu Scene Name",
});
UiManager.attributes.add("gameSceneName", {
  type: "string",
  default: "TinwoodGrove",
  title: "Game Scene Name",
});

// Optional audio master volume element (slider)
UiManager.attributes.add("audioSlider", {
  type: "entity",
  title: "Audio Slider (0..1)",
});

UiManager.prototype.initialize = function () {
  this._state = "menu"; // menu | playing | paused | victory | defeat

  this._bindButton(this.btnStart, this._onStart, this);
  this._bindButton(this.btnEasy, this._onSetDifficulty.bind(this, "Easy"));
  this._bindButton(this.btnNormal, this._onSetDifficulty.bind(this, "Normal"));
  this._bindButton(this.btnHard, this._onSetDifficulty.bind(this, "Hard"));
  this._bindButton(this.btnCredits, this._onCredits, this);
  this._bindButton(this.btnExit, this._onExit, this);

  this._bindButton(this.btnResume, this._onResume, this);
  this._bindButton(this.btnRestart, this._onRestart, this);
  this._bindButton(this.btnReturnToMain, this._onReturnToMain, this);

  // eventos HUD / estado
  this.app.on("hud:update", this._onHudUpdate, this);
  this.app.on("game:state", this._onGameState, this);
  this.app.on("ui:hint", this._onHint, this);

  // teclado: toggle pause
  this.app.keyboard.on("keydown", this._onKeyDown, this);

  this._showOnly(this.menuPanel);
};

UiManager.prototype.onDestroy = function () {
  this.app.off("hud:update", this._onHudUpdate, this);
  this.app.off("game:state", this._onGameState, this);
  this.app.off("ui:hint", this._onHint, this);
  this.app.keyboard.off("keydown", this._onKeyDown, this);
};

UiManager.prototype._bindButton = function (btnEntity, handler, scope) {
  if (!btnEntity || !btnEntity.button) return;
  btnEntity.button.on("click", handler, scope || this);
};

UiManager.prototype._onHudUpdate = function (data) {
  if (this.torchesText && this.torchesText.element) {
    this.torchesText.element.text = "Fogo" + data.lit + " / " + data.total;
  }
  if (this.difficultyText && this.difficultyText.element) {
    this.difficultyText.element.text = data.difficulty;
  }
  if (
    this.enemyCountText &&
    this.enemyCountText.element &&
    data.enemies !== undefined
  ) {
    this.enemyCountText.element.text = "Inimigo" + data.enemies;
  }
  // DOM fallback
  if (typeof document !== "undefined") {
    var t = document.getElementById("hud-torches");
    var d = document.getElementById("hud-difficulty");
    if (t) t.textContent = data.lit + " / " + data.total;
    if (d) d.textContent = data.difficulty;
  }
};

UiManager.prototype._onGameState = function (data) {
  var s = data && data.state;
  if (!s) return;
  if (s === "victory") {
    this._state = "victory";
    this._showOnly(this.winPanel);
  } else if (s === "defeat") {
    this._state = "defeat";
    this._showOnly(this.losePanel);
  }
};

UiManager.prototype._onProgress = function (percent) {
  if (this.progressBar && this.progressBar.element) {
    if (percent > 0) {
      this.progressBar.element.text = "Progress: " + percent + "%";
      this.progressBar.enabled = true;
    } else {
      this.progressBar.element.text = "";
      this.progressBar.enabled = false;
    }
  }
};

UiManager.prototype._onKeyDown = function (e) {
  if (e.key === pc.KEY_ESCAPE) {
    if (this._state === "playing") {
      this._onPause();
    } else if (this._state === "paused") {
      this._onResume();
    }
  }
};

UiManager.prototype._onSetDifficulty = function (level) {
  try {
    window.localStorage.setItem("ash:difficulty", level);
  } catch (e) {}
  // update UI immediately if visible
  this.app.fire("hud:update", { lit: 0, total: 0, difficulty: level });
};

UiManager.prototype._onStart = function () {
  console.log("Start button clicked!");
  this._state = "playing";
  this._showOnly(this.hudPanel);
  this.app.fire("game:reset");
  this.app.fire("game:resume");
};

UiManager.prototype._onExit = function () {
  // Engine-only: Return to menu panels
  this._state = "menu";
  this._showOnly(this.menuPanel);
  this.app.fire("game:pause");
};

UiManager.prototype._onCredits = function () {
  if (this.creditsPanel) {
    this._showOnly(this.creditsPanel);
  }
};

UiManager.prototype._onPause = function () {
  this._state = "paused";
  this._showOnly(this.pausePanel);
  this.app.fire("game:pause");
};

UiManager.prototype._onResume = function () {
  this._state = "playing";
  this._showOnly(this.hudPanel);
  this.app.fire("game:resume");
};

UiManager.prototype._onRestart = function () {
  this.app.fire("game:restart");
};

UiManager.prototype._onReturnToMain = function () {
  this._state = "menu";
  this._showOnly(this.menuPanel);
  this.app.fire("game:pause");
};

UiManager.prototype._showOnly = function (panel) {
  var panels = [this.menuPanel, this.hudPanel, this.pausePanel];
  for (var i = 0; i < panels.length; i++) {
    if (!panels[i]) continue;
    panels[i].enabled = panels[i] === panel;
  }
};
