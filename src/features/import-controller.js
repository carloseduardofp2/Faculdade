import { MONTHS, readMilitaryFile, recordsForPeriod } from "../data.js";
import { loadImageSource } from "../canvas.js";
import { capitalize, elements, makePeriod, state } from "../app-context.js";

function setNavigationAvailability() {
  const ready = Boolean(state.records.length && state.background);
  elements.navItems.forEach((item) => {
    if (item.dataset.view !== "import") item.disabled = !ready;
  });
  elements.goPeople.disabled = !ready;
}

export function renderPeriodLabel() {
  elements.periodBadge.textContent = state.periods[0].label;
}

function renderStatusError(message) {
  const wrapper = document.createElement("div");
  wrapper.className = "status-error";
  wrapper.innerHTML = '<span class="status-mark">!</span>';
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "Não foi possível analisar o arquivo";
  const detail = document.createElement("p");
  detail.textContent = message;
  copy.append(title, detail);
  wrapper.append(copy);
  elements.importStatus.append(wrapper);
}

export function renderImportStatus(error = "") {
  elements.importStatus.replaceChildren();
  if (error) return renderStatusError(error);

  const wrapper = document.createElement("div");
  if (!state.sheetFile && !state.background) {
    wrapper.className = "status-empty";
    wrapper.innerHTML = '<span class="status-mark">i</span><div><strong>Aguardando os arquivos</strong><p>A planilha precisa conter posto/graduação, nome, nome de guerra e data de nascimento.</p></div>';
  } else if (!state.records.length || !state.background) {
    wrapper.className = "status-empty";
    wrapper.innerHTML = '<span class="status-mark">i</span>';
    const copy = document.createElement("div");
    copy.innerHTML = `<strong>Falta um arquivo</strong><p>${!state.records.length ? "Carregue uma planilha válida para continuar." : "Carregue uma imagem de fundo para continuar."}</p>`;
    wrapper.append(copy);
  } else {
    wrapper.className = "status-ready";
    wrapper.innerHTML = '<span class="status-mark">✓</span>';
    const copy = document.createElement("div");
    const warnings = state.invalidRows.length ? ` ${state.invalidRows.length} linha(s) inválida(s) foram ignoradas.` : "";
    const title = document.createElement("strong");
    title.textContent = "Arquivos prontos para conferência";
    const summary = document.createElement("p");
    summary.textContent = `${state.sheetName}: ${state.records.length} registros válidos.${warnings}`;
    copy.append(title, summary);
    if (state.invalidRows.length) {
      const invalidDetails = document.createElement("details");
      invalidDetails.className = "invalid-row-details";
      const invalidTitle = document.createElement("summary");
      invalidTitle.textContent = "Ver linhas que precisam de correção";
      const invalidList = document.createElement("ul");
      invalidList.className = "invalid-row-list";
      state.invalidRows.forEach((item) => {
        const row = document.createElement("li");
        row.textContent = `Linha ${item.row}: ${item.reason}`;
        invalidList.append(row);
      });
      invalidDetails.append(invalidTitle, invalidList);
      copy.append(invalidDetails);
    }
    const details = document.createElement("div");
    details.className = "status-details";
    const period = state.periods[0];
    details.innerHTML = `<span><b>${recordsForPeriod(state.records, period).length}</b>${capitalize(period.name)}</span>`;
    wrapper.append(copy, details);
  }
  elements.importStatus.append(wrapper);
}

async function handleSheet(file) {
  if (!file) return;
  elements.sheetFileName.textContent = "Analisando planilha...";
  try {
    const result = await readMilitaryFile(file);
    Object.assign(state, {
      sheetFile: file, sheetName: result.sheetName, records: result.records,
      invalidRows: result.invalidRows, previewRecordId: result.records[0]?.id || "",
    });
    elements.sheetFileName.textContent = file.name;
    elements.sheetDrop.classList.add("ready");
    renderImportStatus();
  } catch (error) {
    Object.assign(state, { sheetFile: null, records: [], invalidRows: [] });
    elements.sheetFileName.textContent = "Selecionar arquivo";
    elements.sheetDrop.classList.remove("ready");
    renderImportStatus(error.message);
  }
  setNavigationAvailability();
}

async function handleBackground(source, name, onChange) {
  try {
    state.background = await loadImageSource(source);
    state.backgroundName = name;
    elements.imageFileName.textContent = name;
    elements.imageDrop.classList.add("ready");
    renderImportStatus();
    onChange?.();
  } catch {
    state.background = null;
    elements.imageFileName.textContent = "Selecionar arquivo";
    elements.imageDrop.classList.remove("ready");
    renderImportStatus("Não foi possível abrir a imagem selecionada.");
  }
  setNavigationAvailability();
}

function setupDropZone(label, input, handler) {
  ["dragenter", "dragover"].forEach((name) => label.addEventListener(name, (event) => {
    event.preventDefault();
    label.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => label.addEventListener(name, (event) => {
    event.preventDefault();
    label.classList.remove("dragging");
  }));
  label.addEventListener("drop", (event) => {
    const file = event.dataTransfer.files[0];
    if (file) handler(file);
  });
  input.addEventListener("change", () => handler(input.files[0]));
}

function updatePeriod() {
  const month = Number(elements.periodMonth.value);
  const year = Number(elements.periodYear.value);
  if (!Number.isInteger(month) || !Number.isInteger(year) || year < 2000 || year > 2100) return;
  const period = makePeriod(month, year);
  state.periods = [period];
  state.activePeriodId = period.id;
  state.previewPeriodId = period.id;
  renderPeriodLabel();
  renderImportStatus();
}

export async function setupImportFeature({ onBackgroundChange } = {}) {
  MONTHS.forEach((month, index) => elements.periodMonth.appendChild(new Option(capitalize(month), String(index))));
  elements.periodMonth.value = String(state.periods[0].month);
  elements.periodYear.value = String(state.periods[0].year);
  elements.periodMonth.addEventListener("change", updatePeriod);
  elements.periodYear.addEventListener("input", updatePeriod);
  elements.periodYear.addEventListener("change", updatePeriod);
  setupDropZone(elements.sheetDrop, elements.sheetInput, handleSheet);
  setupDropZone(elements.imageDrop, elements.imageInput, (file) => handleBackground(file, file.name, onBackgroundChange));
  document.querySelector("#loadExample").addEventListener("click", () => handleBackground("/templates/template.jpg", "Modelo padrão", onBackgroundChange));
  renderPeriodLabel();
  renderImportStatus();
  setNavigationAvailability();
  await handleBackground("/templates/template.jpg", "Modelo padrão", onBackgroundChange);
}
