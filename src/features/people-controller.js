import { cloneTokenModes, matchWarName } from "../data.js";
import { elements, selectedMonthRecords, state } from "../app-context.js";

function boldCharacters(record) {
  const map = new Array(record.fullName.length).fill(false);
  record.match.tokens.forEach((token) => {
    if (token.mode === "initial") map[token.start] = true;
    if (token.mode === "full") {
      for (let index = token.start; index < token.end; index += 1) map[index] = true;
    }
  });
  return map;
}

function appendHighlightedName(container, record) {
  const boldMap = boldCharacters(record);
  let text = "";
  let bold = boldMap[0] || false;
  const flush = () => {
    if (!text) return;
    if (bold) {
      const strong = document.createElement("strong");
      strong.textContent = text;
      container.appendChild(strong);
    } else container.appendChild(document.createTextNode(text));
    text = "";
  };
  for (let index = 0; index < record.fullName.length; index += 1) {
    if (boldMap[index] !== bold) {
      flush();
      bold = boldMap[index];
    }
    text += record.fullName[index];
  }
  flush();
}

function visibleRecords() {
  const query = elements.peopleSearch.value.trim().toLocaleUpperCase("pt-BR");
  return selectedMonthRecords().filter((record) => {
    if (!query) return true;
    return `${record.pgrad} ${record.fullName} ${record.warName}`.toLocaleUpperCase("pt-BR").includes(query);
  });
}

function statusChip(record) {
  const chip = document.createElement("span");
  chip.className = `status-chip ${record.match.matched ? "ok" : "warning"}`;
  chip.textContent = record.match.matched ? (record.manualMatch ? "Ajustado" : "Reconhecido") : "Revisar";
  return chip;
}

function createRow(record) {
  const row = document.createElement("tr");
  row.classList.toggle("excluded", !record.included);
  const values = [
    String(record.birthDate.getDate()).padStart(2, "0"), record.pgrad, "", record.warName, "", "",
  ];
  const checkCell = document.createElement("td");
  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "row-check";
  check.checked = record.included;
  check.setAttribute("aria-label", `Incluir cartão de ${record.fullName}`);
  check.addEventListener("change", () => {
    record.included = check.checked;
    renderPeoplePage();
  });
  checkCell.appendChild(check);

  const cells = values.map((value) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
  });
  cells[0].className = "day-cell";
  cells[2].className = "war-preview";
  appendHighlightedName(cells[2], record);
  cells[4].appendChild(statusChip(record));
  const action = document.createElement("button");
  action.type = "button";
  action.className = "text-button";
  action.textContent = "Ajustar negrito";
  action.addEventListener("click", () => openNameDialog(record));
  cells[5].appendChild(action);
  row.append(checkCell, ...cells);
  return row;
}

function renderMonthLabel() {
  elements.monthTabs.replaceChildren();
  const period = state.periods[0];
  const button = document.createElement("button");
  button.type = "button";
  button.className = "month-tab active";
  button.innerHTML = `${period.label} <em>${selectedMonthRecords().length}</em>`;
  elements.monthTabs.appendChild(button);
}

function renderTable() {
  const records = visibleRecords();
  elements.peopleBody.replaceChildren(...records.map(createRow));
  elements.emptyPeople.hidden = records.length > 0;
  const allSelected = selectedMonthRecords().length > 0 && selectedMonthRecords().every((record) => record.included);
  elements.selectAll.textContent = allSelected ? "Desmarcar todos" : "Selecionar todos";
}

function renderNameTokens() {
  elements.nameTokenEditor.replaceChildren();
  state.draftTokens.forEach((token, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `token-button ${token.mode}`;
    button.textContent = token.text;
    button.title = token.mode === "none" ? "Sem destaque" : token.mode === "initial" ? "Inicial em negrito" : "Palavra inteira em negrito";
    button.addEventListener("click", () => {
      state.draftTokens[index].mode = { none: "initial", initial: "full", full: "none" }[token.mode];
      renderNameTokens();
    });
    elements.nameTokenEditor.appendChild(button);
  });
}

function openNameDialog(record) {
  state.editingRecord = record;
  state.draftTokens = cloneTokenModes(record.match.tokens);
  renderNameTokens();
  elements.nameDialog.showModal();
}

export function renderPeoplePage() {
  renderMonthLabel();
  renderTable();
  elements.includedCount.textContent = selectedMonthRecords().filter((record) => record.included).length;
}

export function setupPeopleFeature() {
  elements.peopleSearch.addEventListener("input", renderTable);
  elements.selectAll.addEventListener("click", () => {
    const records = selectedMonthRecords();
    const select = !records.every((record) => record.included);
    records.forEach((record) => { record.included = select; });
    renderPeoplePage();
  });
  document.querySelector("#saveNameMatch").addEventListener("click", (event) => {
    event.preventDefault();
    state.editingRecord.match.tokens = cloneTokenModes(state.draftTokens);
    state.editingRecord.match.matched = state.draftTokens.some((token) => token.mode !== "none");
    state.editingRecord.match.warning = state.editingRecord.match.matched ? "" : "Nenhuma parte do nome foi destacada";
    state.editingRecord.manualMatch = true;
    elements.nameDialog.close();
    renderTable();
  });
  document.querySelector("#restoreNameMatch").addEventListener("click", () => {
    state.draftTokens = cloneTokenModes(matchWarName(state.editingRecord.fullName, state.editingRecord.warName).tokens);
    renderNameTokens();
  });
}
