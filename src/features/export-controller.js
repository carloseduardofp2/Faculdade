import { downloadBlob, generatePackage } from "../exporter.js";
import { currentPeriod, elements, selectedCardItems, showToast, state, $, $$ } from "../app-context.js";

function exportItems() {
  const enabled = $("#periodChecks input")?.checked;
  return enabled ? selectedCardItems() : [];
}

function updateSummary() {
  const items = exportItems();
  elements.exportCardCount.textContent = items.length;
  elements.exportPageCount.textContent = Math.ceil(items.length / 2);
  elements.generatePackage.disabled = items.length === 0;
}

export function showExportPage() {
  const period = currentPeriod();
  const count = selectedCardItems().length;
  const label = document.createElement("label");
  label.className = "period-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = period.id;
  input.checked = count > 0;
  input.disabled = count === 0;
  input.addEventListener("change", updateSummary);
  const copy = document.createElement("span");
  copy.textContent = `${period.label} (${count})`;
  label.append(input, copy);
  elements.periodChecks.replaceChildren(label);
  updateSummary();
}

export function setupExportFeature() {
  $$("#formatControls button").forEach((button) => button.addEventListener("click", () => {
    state.exportFormat = button.dataset.format;
    $$("#formatControls button").forEach((item) => item.classList.toggle("active", item === button));
  }));
  elements.generatePackage.addEventListener("click", async () => {
    const items = exportItems();
    if (!items.length) return;
    elements.generatePackage.disabled = true;
    elements.progressBox.hidden = false;
    try {
      const result = await generatePackage({
        items, background: state.background, layout: state.layout,
        format: state.exportFormat, cropMarks: $("#cropMarks").checked,
        onProgress: ({ percent, label }) => {
          elements.exportProgress.value = percent;
          elements.progressPercent.textContent = `${percent}%`;
          elements.progressLabel.textContent = label;
        },
      });
      downloadBlob(result.blob, result.filename);
      showToast("Pacote gerado com sucesso.");
    } catch (error) {
      showToast(error.message || "Não foi possível gerar o pacote.", "error");
    } finally {
      elements.generatePackage.disabled = false;
    }
  });
}
