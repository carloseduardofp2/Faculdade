import { elements, state } from "../app-context.js";

function pointerPosition(event) {
  const rect = elements.cardCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (elements.cardCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (elements.cardCanvas.height / rect.height),
  };
}

function hitLayer(point) {
  const keys = [...(state.layout.custom || []).map((layer) => layer.id).reverse(), "date", "identity"];
  return keys.find((key) => {
    const box = state.editorBoxes[key];
    if (!box) return false;
    const pad = Math.max(18, elements.cardCanvas.width * 0.012);
    return point.x >= box.x - pad && point.x <= box.x + box.width + pad
      && point.y >= box.y - pad && point.y <= box.y + box.height + pad;
  });
}

export function setupEditorInteractions({ getSelectedLayer, syncControls, renderEditor, commitLayout }) {
  elements.cardCanvas.addEventListener("pointerdown", (event) => {
    const point = pointerPosition(event);
    const layerKey = hitLayer(point);
    if (!layerKey) return;
    state.selectedLayer = layerKey;
    const layer = getSelectedLayer();
    state.dragging = {
      offsetX: point.x - layer.x * elements.cardCanvas.width,
      offsetY: point.y - layer.y * elements.cardCanvas.height,
    };
    elements.cardCanvas.setPointerCapture(event.pointerId);
    elements.cardCanvas.classList.add("dragging");
    syncControls();
    renderEditor();
  });

  elements.cardCanvas.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    const point = pointerPosition(event);
    const layer = getSelectedLayer();
    let x = (point.x - state.dragging.offsetX) / elements.cardCanvas.width;
    const y = (point.y - state.dragging.offsetY) / elements.cardCanvas.height;
    state.snapped = Math.abs(x - 0.5) < 0.012;
    if (state.snapped) x = 0.5;
    layer.x = Math.min(1, Math.max(0, x));
    layer.y = Math.min(0.98, Math.max(0, y));
    renderEditor();
  });

  const endDrag = () => {
    if (!state.dragging) return;
    state.dragging = null;
    state.snapped = false;
    elements.cardCanvas.classList.remove("dragging");
    renderEditor();
    commitLayout();
  };
  elements.cardCanvas.addEventListener("pointerup", endDrag);
  elements.cardCanvas.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", (event) => {
    if (!document.querySelector("#view-editor").classList.contains("active") || !event.key.startsWith("Arrow")) return;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    event.preventDefault();
    const layer = getSelectedLayer();
    const pixels = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") layer.x -= pixels / elements.cardCanvas.width;
    if (event.key === "ArrowRight") layer.x += pixels / elements.cardCanvas.width;
    if (event.key === "ArrowUp") layer.y -= pixels / elements.cardCanvas.height;
    if (event.key === "ArrowDown") layer.y += pixels / elements.cardCanvas.height;
    layer.x = Math.min(1, Math.max(0, layer.x));
    layer.y = Math.min(0.98, Math.max(0, layer.y));
    renderEditor();
    if (!event.repeat) commitLayout();
  });
}
