const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const WHEEL_DEBOUNCE_MS = 150;

const today = new Date();
today.setHours(0, 0, 0, 0);

let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let lastWheelTime = 0;
let tooltipTimer = null;

const monthTitle = document.getElementById('month-title');
const calGrid = document.getElementById('cal-grid');
const copyTooltip = document.getElementById('copy-tooltip');

// サイドパネル用の状態
let seibanList = [];
let supplierList = [];

async function init() {
  await initHolidays();

  renderWeekdayHeader();
  renderCalendar();

  document.getElementById('prev-month').addEventListener('click', goToPrevMonth);
  document.getElementById('next-month').addEventListener('click', goToNextMonth);
  document.getElementById('today-btn').addEventListener('click', goToToday);
  document.getElementById('calendar').addEventListener('wheel', handleWheel, { passive: false });

  // 製番パネル
  document.getElementById('seiban-add').addEventListener('click', addSeiban);
  document.getElementById('seiban-value').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSeiban();
  });

  // 手配先パネル
  document.getElementById('supplier-add').addEventListener('click', addSupplier);
  document.getElementById('supplier-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSupplier();
  });

  // storageからデータ読み込み
  await loadPanelData();

  // オプションページからの変更をリアルタイム反映
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes) => {
      onStorageChanged(changes);
      if (changes.customHolidays || changes.noDeliveryDays) renderCalendar();
      if (changes.seibanList) {
        seibanList = changes.seibanList.newValue || [];
        renderSeibanList();
      }
      if (changes.supplierList) {
        supplierList = changes.supplierList.newValue || [];
        renderSupplierList();
      }
    });
  }
}

function renderWeekdayHeader() {
  const header = document.getElementById('weekday-header');
  WEEKDAYS.forEach((name, i) => {
    const el = document.createElement('div');
    el.className = 'weekday';
    if (i === 0) el.classList.add('sunday');
    if (i === 6) el.classList.add('saturday');
    el.textContent = name;
    header.appendChild(el);
  });
}

function renderCalendar() {
  monthTitle.textContent = `${currentYear}年${currentMonth + 1}月`;
  calGrid.innerHTML = '';

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startDow = firstDay.getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 前月の埋め草
  if (startDow > 0) {
    const prevLastDate = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevLastDate - i);
      calGrid.appendChild(createDayCell(d, false));
    }
  }

  // 当月
  for (let day = 1; day <= lastDate; day++) {
    const d = new Date(currentYear, currentMonth, day);
    calGrid.appendChild(createDayCell(d, true));
  }

  // 翌月の埋め草（6行=42セル）
  const totalCells = calGrid.children.length;
  const remaining = 42 - totalCells;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(currentYear, currentMonth + 1, i);
    calGrid.appendChild(createDayCell(d, false));
  }
}

function createDayCell(date, isCurrentMonth) {
  const cell = document.createElement('div');
  cell.className = 'day-cell';

  const dow = date.getDay();
  const isTodayDate = date.getTime() === today.getTime();
  const businessDay = isBusinessDay(date);
  const holidayName = getHolidayName(date);
  const isWeekend = dow === 0 || dow === 6;

  if (!isCurrentMonth) cell.classList.add('other-month');

  if (isTodayDate) {
    cell.classList.add('today');
  } else if (date < today) {
    cell.classList.add('past');
  } else {
    cell.classList.add('future');
  }

  // 祝日・休日の背景
  if (holidayName && !isWeekend) {
    cell.classList.add('holiday');
  }

  // 納品NG日（リードタイムには数えるがグレーアウト）
  if (isNoDeliveryDay(date)) {
    cell.classList.add('no-delivery');
  }

  // 日付番号
  const dateNum = document.createElement('span');
  dateNum.className = 'date-number';
  if (dow === 0) dateNum.classList.add('sunday');
  if (dow === 6) dateNum.classList.add('saturday');
  if (holidayName && dow !== 0 && dow !== 6) dateNum.classList.add('holiday-color');
  dateNum.textContent = date.getDate();
  cell.appendChild(dateNum);

  // リードタイム（営業日のみ表示）
  if (businessDay || isTodayDate) {
    const lt = document.createElement('span');
    lt.className = 'lead-time';
    if (isTodayDate) {
      lt.textContent = '今日';
    } else {
      const leadTime = calcBusinessDayLeadTime(date);
      lt.textContent = leadTime > 0 ? `+${leadTime}` : `${leadTime}`;
    }
    cell.appendChild(lt);
  }

  // 祝日名
  if (holidayName) {
    const hn = document.createElement('span');
    hn.className = 'holiday-name';
    hn.textContent = holidayName;
    cell.appendChild(hn);
  }

  // 納品NG日ラベル
  const noDeliveryLabel = getNoDeliveryDayLabel(date);
  if (noDeliveryLabel) {
    const ndl = document.createElement('span');
    ndl.className = 'no-delivery-label';
    ndl.textContent = noDeliveryLabel;
    cell.appendChild(ndl);
  }

  // クリックでコピー
  cell.addEventListener('click', () => handleDateClick(date, cell));

  return cell;
}

function calcBusinessDayLeadTime(targetDate) {
  const start = new Date(today);
  const end = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (start.getTime() === end.getTime()) return 0;

  const direction = end > start ? 1 : -1;
  let count = 0;
  const cursor = new Date(start);

  while (cursor.getTime() !== end.getTime()) {
    cursor.setDate(cursor.getDate() + direction);
    if (isBusinessDay(cursor)) {
      count += direction;
    }
  }

  return count;
}

function goToPrevMonth() {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
}

function goToNextMonth() {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
}

function goToToday() {
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  renderCalendar();
}

function handleWheel(e) {
  e.preventDefault();
  const now = Date.now();
  if (now - lastWheelTime < WHEEL_DEBOUNCE_MS) return;
  lastWheelTime = now;

  if (e.deltaY < 0) goToPrevMonth();
  else if (e.deltaY > 0) goToNextMonth();
}

function handleDateClick(date, cellElement) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const text = `${yyyy}${mm}${dd}`;

  copyToClipboard(text).then(() => {
    showTooltip(cellElement, `${text} をコピーしました`);
  });
}

async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // フォールバック: execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

function showTooltip(anchor, message) {
  if (tooltipTimer) clearTimeout(tooltipTimer);

  copyTooltip.textContent = message;
  const rect = anchor.getBoundingClientRect();
  copyTooltip.style.left = `${rect.left + rect.width / 2}px`;
  copyTooltip.style.top = `${rect.bottom + 6}px`;
  copyTooltip.className = 'visible';

  tooltipTimer = setTimeout(() => {
    copyTooltip.className = 'hidden';
  }, 2000);
}

// === 製番パネル ===

async function loadPanelData() {
  if (!hasStorage) return;
  const data = await chrome.storage.local.get(['seibanList', 'supplierList']);
  seibanList = data.seibanList || [];
  supplierList = data.supplierList || [];
  renderSeibanList();
  renderSupplierList();
}

async function saveSeibanList() {
  if (hasStorage) {
    await chrome.storage.local.set({ seibanList });
  }
}

function addSeiban() {
  const labelInput = document.getElementById('seiban-label');
  const valueInput = document.getElementById('seiban-value');
  const label = labelInput.value.trim();
  const seiban = valueInput.value.trim();
  if (!seiban) return;

  seibanList.push({ label, seiban });
  saveSeibanList();
  renderSeibanList();
  labelInput.value = '';
  valueInput.value = '';
  labelInput.focus();
}

function deleteSeiban(index) {
  seibanList.splice(index, 1);
  saveSeibanList();
  renderSeibanList();
}

function renderSeibanList() {
  const container = document.getElementById('seiban-list');
  container.innerHTML = '';

  seibanList.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'seiban-item';

    if (item.label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'seiban-label';
      labelEl.textContent = item.label;
      el.appendChild(labelEl);
    }

    const valueEl = document.createElement('div');
    valueEl.className = 'seiban-value';
    valueEl.textContent = item.seiban;
    valueEl.addEventListener('click', () => {
      copyToClipboard(item.seiban).then(() => {
        showTooltip(valueEl, `${item.seiban} をコピーしました`);
      });
    });
    el.appendChild(valueEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'item-delete';
    delBtn.textContent = '\u00d7';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSeiban(i);
    });
    el.appendChild(delBtn);

    container.appendChild(el);
  });
}

// === 手配先パネル ===

async function saveSupplierList() {
  if (hasStorage) {
    await chrome.storage.local.set({ supplierList });
  }
}

function addSupplier() {
  const codeInput = document.getElementById('supplier-code');
  const nameInput = document.getElementById('supplier-name');
  const code = codeInput.value.trim();
  const name = nameInput.value.trim();
  if (!code) return;

  supplierList.push({ code, name });
  saveSupplierList();
  renderSupplierList();
  codeInput.value = '';
  nameInput.value = '';
  codeInput.focus();
}

function deleteSupplier(index) {
  supplierList.splice(index, 1);
  saveSupplierList();
  renderSupplierList();
}

function renderSupplierList() {
  const container = document.getElementById('supplier-list');
  container.innerHTML = '';

  supplierList.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'supplier-item';

    const codeEl = document.createElement('span');
    codeEl.className = 'supplier-code';
    codeEl.textContent = item.code;
    el.appendChild(codeEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'supplier-name';
    nameEl.textContent = item.name;
    el.appendChild(nameEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'item-delete';
    delBtn.textContent = '\u00d7';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSupplier(i);
    });
    el.appendChild(delBtn);

    // クリックでコード+企業名をタブ区切りでコピー
    el.addEventListener('click', () => {
      const text = `${item.code}\t${item.name}`;
      copyToClipboard(text).then(() => {
        showTooltip(el, `${item.code}  ${item.name} をコピーしました`);
      });
    });

    container.appendChild(el);
  });
}

init();
