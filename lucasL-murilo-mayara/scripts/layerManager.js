function setupLayers(app) {
  const composition = app.scene.layers;

  const layersToRemove = [];
  composition.layerList.forEach((layer) => {
    if (
      layer.name !== "World" &&
      layer.name !== "Ui" &&
      layer.name !== "Skybox"
    ) {
      layersToRemove.push(layer);
    }
  });
  layersToRemove.forEach((layer) => composition.remove(layer));

  const LAYER_IDS = {
    BACKGROUND: 100,
    WORLD: 101,
    OBJECTS: 102,
    PLAYER: 103,
    ENEMIES: 104,
    VISION: 105,
    UI: 106,
  };

  const layers = {};

  layers.background = new pc.Layer({
    id: LAYER_IDS.BACKGROUND,
    name: "Background",
    opaqueSortMode: pc.SORTMODE_NONE,
    transparentSortMode: pc.SORTMODE_NONE,
  });

  layers.world = new pc.Layer({
    id: LAYER_IDS.WORLD,
    name: "World",
    opaqueSortMode: pc.SORTMODE_MANUAL,
    transparentSortMode: pc.SORTMODE_BACK2FRONT,
  });

  layers.objects = new pc.Layer({
    id: LAYER_IDS.OBJECTS,
    name: "Objects",
    opaqueSortMode: pc.SORTMODE_MANUAL,
    transparentSortMode: pc.SORTMODE_BACK2FRONT,
  });

  layers.player = new pc.Layer({
    id: LAYER_IDS.PLAYER,
    name: "Player",
    opaqueSortMode: pc.SORTMODE_MANUAL,
    transparentSortMode: pc.SORTMODE_BACK2FRONT,
  });

  layers.enemies = new pc.Layer({
    id: LAYER_IDS.ENEMIES,
    name: "Enemies",
    opaqueSortMode: pc.SORTMODE_MANUAL,
    transparentSortMode: pc.SORTMODE_BACK2FRONT,
  });

  layers.vision = new pc.Layer({
    id: LAYER_IDS.VISION,
    name: "Vision",
    opaqueSortMode: pc.SORTMODE_NONE,
    transparentSortMode: pc.SORTMODE_BACK2FRONT,
  });

  layers.ui = new pc.Layer({
    id: LAYER_IDS.UI,
    name: "UI",
    opaqueSortMode: pc.SORTMODE_MANUAL,
    transparentSortMode: pc.SORTMODE_MANUAL,
  });

  composition.push(layers.background);
  composition.push(layers.world);
  composition.push(layers.objects);
  composition.push(layers.player);
  composition.push(layers.enemies);
  composition.push(layers.vision);
  composition.push(layers.ui);

  const camera = app.root.findByName("Camera");
  if (camera && camera.camera) {
    camera.camera.layers = [
      LAYER_IDS.BACKGROUND,
      LAYER_IDS.WORLD,
      LAYER_IDS.OBJECTS,
      LAYER_IDS.PLAYER,
      LAYER_IDS.ENEMIES,
      LAYER_IDS.VISION,
    ];
  }

  return LAYER_IDS;
}

function addToLayer(entity, layerId) {
  if (entity.render) {
    entity.render.layers = [layerId];
  }
  if (entity.element) {
    entity.element.layers = [layerId];
  }
}

function addAllToLayer(entities, layerId) {
  entities.forEach((entity) => addToLayer(entity, layerId));
}

window.setupLayers = setupLayers;
window.addToLayer = addToLayer;
window.addAllToLayer = addAllToLayer;
