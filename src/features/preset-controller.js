import { cloneLayout, createDefaultLayout } from "../canvas.js";
import { downloadBlob } from "../exporter.js";
import { elements, showToast, state } from "../app-context.js";

const STORAGE_KEY = "comsoc-layout-presets";

function getPresets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function setPresets(presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  renderPresetOptions();
}

export function renderPresetOptions(selected = "") {
  const presets = getPresets();
  elements.presetSelect.replaceChildren(new Option("Modelo padrão", ""));
  Object.keys(presets).sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((name) => {
    const option = new Option(name, name);
    option.selected = name === selected;
    elements.presetSelect.appendChild(option);
  });
}

export function setupPresetFeature({ onLayoutChange }) {
  document.querySelector("#savePreset").addEventListener("click", () => {
    elements.presetName.value = `Modelo personalizado ${Object.keys(getPresets()).length + 1}`;
    elements.presetDialog.showModal();
    elements.presetName.select();
  });
  document.querySelector("#confirmPreset").addEventListener("click", (event) => {
    event.preventDefault();
    const name = elements.presetName.value.trim();
    if (!name) return;
    const presets = getPresets();
    presets[name] = cloneLayout(state.layout);
    setPresets(presets);
    elements.presetSelect.value = name;
    elements.presetDialog.close();
    showToast(`Preset “${name}” salvo neste navegador.`);
  });
  elements.presetSelect.addEventListener("change", () => {
    state.layout = elements.presetSelect.value ? cloneLayout(getPresets()[elements.presetSelect.value]) : createDefaultLayout();
    state.layout.custom ||= [];
    state.selectedLayer = "identity";
    onLayoutChange();
  });
  document.querySelector("#exportPreset").addEventListener("click", () => {
    const content = JSON.stringify({ type: "comsoc-layout", layout: state.layout }, null, 2);
    downloadBlob(new Blob([content], { type: "application/json" }), "modelo-comsoc.json");
  });
  document.querySelector("#importPreset").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed.type !== "comsoc-layout" || !parsed.layout?.identity || !parsed.layout?.date) throw new Error();
      state.layout = parsed.layout;
      state.layout.custom ||= [];
      state.selectedLayer = "identity";
      onLayoutChange();
      showToast("Preset importado.");
    } catch {
      showToast("Este arquivo não é um preset válido.", "error");
    } finally {
      event.target.value = "";
    }
  });
  renderPresetOptions();
}
