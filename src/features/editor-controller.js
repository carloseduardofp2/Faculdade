import { cloneLayout, createDefaultLayout, renderCard } from "../canvas.js";
import { currentPeriod, elements, selectedMonthRecords, showToast, state, $, $$ } from "../app-context.js";
import { setupEditorInteractions } from "./editor-interactions.js";
import { setupPresetFeature } from "./preset-controller.js";

function previewRecords() {
  return selectedMonthRecords().filter((record) => record.included);
}

function selectedPreviewRecord() {
  return state.records.find((record) => record.id === state.previewRecordId) || previewRecords()[0];
}

export function renderEditor() {
  const record = selectedPreviewRecord();
  if (!record || !state.background) return;
  state.editorBoxes = renderCard(elements.cardCanvas, state.background, record, currentPeriod(), state.layout, {
    selection: state.selectedLayer,
    snapped: state.snapped,
  });
}

function getSelectedLayer() {
  if (state.selectedLayer === "identity" || state.selectedLayer === "date") return state.layout[state.selectedLayer];
  return (state.layout.custom || []).find((layer) => layer.id === state.selectedLayer) || state.layout.identity;
}

function layerDefinitions() {
  return [
    { id: "identity", title: "Identificação", subtitle: "P/Grad e nome" },
    { id: "date", title: "Data", subtitle: "Local e aniversário" },
    ...(state.layout.custom || []).map((layer, index) => ({
      id: layer.id, title: layer.text || `Texto ${index + 1}`, subtitle: "Texto adicional",
    })),
  ];
}

function selectLayer(id) {
  state.selectedLayer = id;
  syncEditorControls();
  renderEditor();
}

function renderLayersList() {
  state.layout.custom ||= [];
  elements.layersList.replaceChildren();
  layerDefinitions().forEach((definition) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `layer-item ${definition.id === state.selectedLayer ? "active" : ""}`;
    button.dataset.layer = definition.id;
    button.innerHTML = '<span class="layer-symbol">T</span><span></span><span>⋮⋮</span>';
    const copy = button.children[1];
    const title = document.createElement("strong");
    title.textContent = definition.title;
    const subtitle = document.createElement("small");
    subtitle.textContent = definition.subtitle;
    copy.append(title, subtitle);
    button.addEventListener("click", () => selectLayer(definition.id));
    elements.layersList.appendChild(button);
  });
}

function syncEditorControls() {
  if (!state.background) return;
  renderLayersList();
  const layer = getSelectedLayer();
  const width = state.background.naturalWidth;
  const fontPixels = Math.round(layer.fontRatio * width);
  const widthPixels = Math.round(layer.maxWidthRatio * width);
  Object.assign(elements.fontSize, { min: Math.max(12, Math.round(width * 0.012)), max: Math.max(120, Math.round(width * 0.07)), value: fontPixels });
  Object.assign(elements.maxWidth, { min: Math.round(width * 0.2), max: Math.round(width * 0.98), value: widthPixels });
  elements.fontSizeValue.textContent = `${fontPixels}px`;
  elements.maxWidthValue.textContent = `${widthPixels}px`;
  elements.textColor.value = layer.color;
  elements.textColorHex.value = layer.color.toUpperCase();
  elements.autoFit.checked = layer.autoFit;
  const custom = !["identity", "date"].includes(state.selectedLayer);
  elements.customTextControls.hidden = !custom;
  if (custom) {
    elements.customText.value = layer.text || "";
    elements.customBold.checked = Boolean(layer.bold);
  }
  $$("#alignControls button").forEach((button) => button.classList.toggle("active", button.dataset.align === layer.align));
}

function updateHistoryButtons() {
  $("#undoLayout").disabled = state.historyIndex <= 0;
  $("#redoLayout").disabled = state.historyIndex >= state.history.length - 1;
}

function resetHistory() {
  state.history = [cloneLayout(state.layout)];
  state.historyIndex = 0;
  updateHistoryButtons();
}

function commitLayout() {
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(cloneLayout(state.layout));
  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function restoreHistory(index) {
  if (index < 0 || index >= state.history.length) return;
  state.historyIndex = index;
  state.layout = cloneLayout(state.history[index]);
  syncEditorControls();
  renderEditor();
  updateHistoryButtons();
}

export function showEditorPage() {
  const records = previewRecords();
  if (!records.some((record) => record.id === state.previewRecordId)) state.previewRecordId = records[0]?.id || "";
  elements.previewPerson.replaceChildren(...records.map((record) => {
    const label = `${String(record.birthDate.getDate()).padStart(2, "0")} — ${record.pgrad} ${record.fullName}`;
    return new Option(label, record.id, false, record.id === state.previewRecordId);
  }));
  if (!state.history.length) resetHistory();
  syncEditorControls();
  renderEditor();
}

function bindTextControls() {
  elements.fontSize.addEventListener("input", () => {
    getSelectedLayer().fontRatio = Number(elements.fontSize.value) / state.background.naturalWidth;
    elements.fontSizeValue.textContent = `${elements.fontSize.value}px`;
    renderEditor();
  });
  elements.fontSize.addEventListener("change", commitLayout);
  elements.maxWidth.addEventListener("input", () => {
    getSelectedLayer().maxWidthRatio = Number(elements.maxWidth.value) / state.background.naturalWidth;
    elements.maxWidthValue.textContent = `${elements.maxWidth.value}px`;
    renderEditor();
  });
  elements.maxWidth.addEventListener("change", commitLayout);
  elements.textColor.addEventListener("input", () => {
    getSelectedLayer().color = elements.textColor.value;
    elements.textColorHex.value = elements.textColor.value.toUpperCase();
    renderEditor();
  });
  elements.textColor.addEventListener("change", commitLayout);
  elements.textColorHex.addEventListener("change", () => {
    if (!/^#[0-9a-f]{6}$/i.test(elements.textColorHex.value)) return syncEditorControls();
    getSelectedLayer().color = elements.textColorHex.value;
    syncEditorControls(); renderEditor(); commitLayout();
  });
  elements.autoFit.addEventListener("change", () => {
    getSelectedLayer().autoFit = elements.autoFit.checked;
    renderEditor(); commitLayout();
  });
  $$("#alignControls button").forEach((button) => button.addEventListener("click", () => {
    getSelectedLayer().align = button.dataset.align;
    syncEditorControls(); renderEditor(); commitLayout();
  }));
}

function bindCustomTextControls() {
  $("#addTextLayer").addEventListener("click", () => {
    const id = `custom-${Date.now()}`;
    state.layout.custom ||= [];
    state.layout.custom.push({ id, text: "Novo texto", bold: false, x: 0.5, y: 0.5,
      fontRatio: 46 / state.background.naturalWidth, maxWidthRatio: 0.8,
      color: "#000000", align: "center", autoFit: true });
    selectLayer(id); commitLayout();
  });
  elements.customText.addEventListener("input", () => {
    getSelectedLayer().text = elements.customText.value;
    renderLayersList(); renderEditor();
  });
  elements.customText.addEventListener("change", commitLayout);
  elements.customBold.addEventListener("change", () => {
    getSelectedLayer().bold = elements.customBold.checked;
    renderEditor(); commitLayout();
  });
  $("#removeTextLayer").addEventListener("click", () => {
    state.layout.custom = state.layout.custom.filter((layer) => layer.id !== state.selectedLayer);
    state.selectedLayer = "identity";
    syncEditorControls(); renderEditor(); commitLayout();
  });
}

export function setupEditorFeature() {
  bindTextControls();
  bindCustomTextControls();
  setupEditorInteractions({ getSelectedLayer, syncControls: syncEditorControls, renderEditor, commitLayout });
  setupPresetFeature({ onLayoutChange: () => { syncEditorControls(); renderEditor(); commitLayout(); } });
  elements.previewPerson.addEventListener("change", () => { state.previewRecordId = elements.previewPerson.value; renderEditor(); });
  $("#showLongest").addEventListener("click", () => {
    const longest = previewRecords().sort((a, b) => (`${b.pgrad} ${b.fullName}`).length - (`${a.pgrad} ${a.fullName}`).length)[0];
    if (!longest) return;
    state.previewRecordId = longest.id;
    elements.previewPerson.value = longest.id;
    renderEditor(); showToast("Prévia alterada para o nome mais longo selecionado.");
  });
  $("#undoLayout").addEventListener("click", () => restoreHistory(state.historyIndex - 1));
  $("#redoLayout").addEventListener("click", () => restoreHistory(state.historyIndex + 1));
  $("#resetLayout").addEventListener("click", () => {
    state.layout = createDefaultLayout(); state.selectedLayer = "identity";
    syncEditorControls(); renderEditor(); commitLayout();
  });
}
