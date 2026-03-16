// === ユーティリティ ===

// "YYYY-MM-DD" → "M/D"
function formatMD(dateStr) {
  const parts = dateStr.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// エントリの表示用日付フォーマット
function formatDisplayDate(item) {
  if (item.yearly) {
    const startMD = formatMD(item.date);
    if (item.endDate) {
      return `毎年 ${startMD} ～ ${formatMD(item.endDate)}`;
    }
    return `毎年 ${startMD}`;
  } else {
    if (item.endDate) {
      return `${item.date} ～ ${item.endDate}`;
    }
    return item.date;
  }
}

// 範囲重複チェック
function hasOverlapWithList(date, endDate, yearly, targetList) {
  const end = endDate || date;
  for (const item of targetList) {
    const itemEnd = item.endDate || item.date;
    if (yearly && item.yearly) {
      const sMD = date.substring(5), eMD = end.substring(5);
      const isMD = item.date.substring(5), ieMD = itemEnd.substring(5);
      if (sMD <= ieMD && eMD >= isMD) return true;
    } else if (!yearly && !item.yearly) {
      if (date <= itemEnd && end >= item.date) return true;
    }
  }
  return false;
}

// === カスタム休日 ===
const dateInputHolidays = document.getElementById('date-input-holidays');
const endDateInputHolidays = document.getElementById('end-date-input-holidays');
const labelInputHolidays = document.getElementById('label-input-holidays');
const yearlyCheckHolidays = document.getElementById('yearly-check-holidays');
const addBtnHolidays = document.getElementById('add-btn-holidays');
const holidayList = document.getElementById('holiday-list');
const emptyMsgHolidays = document.getElementById('empty-msg-holidays');

let holidays = [];

async function loadHolidays() {
  const { customHolidays } = await chrome.storage.local.get('customHolidays');
  holidays = customHolidays || [];
  renderHolidayList();
}

async function saveHolidays() {
  await chrome.storage.local.set({ customHolidays: holidays });
}

function renderHolidayList() {
  holidayList.innerHTML = '';

  if (holidays.length === 0) {
    emptyMsgHolidays.classList.remove('hidden');
    return;
  }

  emptyMsgHolidays.classList.add('hidden');

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  sorted.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'holiday-item';

    if (item.yearly) {
      const badge = document.createElement('span');
      badge.className = 'yearly-badge';
      badge.textContent = '毎年';
      row.appendChild(badge);
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'holiday-date';
    dateEl.textContent = formatDisplayDate(item);
    row.appendChild(dateEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'holiday-label';
    labelEl.textContent = item.label || '';
    row.appendChild(labelEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '\u00d7';
    delBtn.setAttribute('aria-label', '削除');
    const origIndex = holidays.indexOf(item);
    delBtn.addEventListener('click', () => deleteHoliday(origIndex));
    row.appendChild(delBtn);

    holidayList.appendChild(row);
  });
}

function addHoliday() {
  const date = dateInputHolidays.value;
  if (!date) return;

  const endDate = endDateInputHolidays.value || null;
  const yearly = yearlyCheckHolidays.checked;

  if (endDate && endDate < date) {
    alert('終了日は開始日以降にしてください。');
    return;
  }

  if (yearly && endDate) {
    const startMD = date.substring(5);
    const endMD = endDate.substring(5);
    if (endMD < startMD) {
      alert('毎年繰り返しの範囲指定では年をまたぐ指定はできません。');
      return;
    }
  }

  // 重複チェック
  if (holidays.some(h => h.date === date && (h.endDate || null) === endDate && !!h.yearly === yearly)) return;

  // 納品NG日との相互排他チェック
  if (hasOverlapWithList(date, endDate, yearly, noDeliveryDays)) {
    alert('この日付範囲は納品NG日と重複しています。先に納品NG日から削除してください。');
    return;
  }

  const label = labelInputHolidays.value.trim();
  const entry = { date, label };
  if (endDate) entry.endDate = endDate;
  if (yearly) entry.yearly = true;

  holidays.push(entry);
  saveHolidays();
  renderHolidayList();

  dateInputHolidays.value = '';
  endDateInputHolidays.value = '';
  labelInputHolidays.value = '';
  yearlyCheckHolidays.checked = false;
}

function deleteHoliday(index) {
  holidays.splice(index, 1);
  saveHolidays();
  renderHolidayList();
}

// === 納品NG日 ===
const dateInputNoDelivery = document.getElementById('date-input-no-delivery');
const endDateInputNoDelivery = document.getElementById('end-date-input-no-delivery');
const labelInputNoDelivery = document.getElementById('label-input-no-delivery');
const yearlyCheckNoDelivery = document.getElementById('yearly-check-no-delivery');
const addBtnNoDelivery = document.getElementById('add-btn-no-delivery');
const noDeliveryList = document.getElementById('no-delivery-list');
const emptyMsgNoDelivery = document.getElementById('empty-msg-no-delivery');

let noDeliveryDays = [];

async function loadNoDeliveryDays() {
  const data = await chrome.storage.local.get('noDeliveryDays');
  noDeliveryDays = data.noDeliveryDays || [];
  renderNoDeliveryList();
}

async function saveNoDeliveryDays() {
  await chrome.storage.local.set({ noDeliveryDays });
}

function renderNoDeliveryList() {
  noDeliveryList.innerHTML = '';

  if (noDeliveryDays.length === 0) {
    emptyMsgNoDelivery.classList.remove('hidden');
    return;
  }

  emptyMsgNoDelivery.classList.add('hidden');

  const sorted = [...noDeliveryDays].sort((a, b) => a.date.localeCompare(b.date));

  sorted.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'no-delivery-item';

    if (item.yearly) {
      const badge = document.createElement('span');
      badge.className = 'yearly-badge';
      badge.textContent = '毎年';
      row.appendChild(badge);
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'no-delivery-date';
    dateEl.textContent = formatDisplayDate(item);
    row.appendChild(dateEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'no-delivery-label';
    labelEl.textContent = item.label || '';
    row.appendChild(labelEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '\u00d7';
    delBtn.setAttribute('aria-label', '削除');
    const origIndex = noDeliveryDays.indexOf(item);
    delBtn.addEventListener('click', () => deleteNoDeliveryDay(origIndex));
    row.appendChild(delBtn);

    noDeliveryList.appendChild(row);
  });
}

function addNoDeliveryDay() {
  const date = dateInputNoDelivery.value;
  if (!date) return;

  const endDate = endDateInputNoDelivery.value || null;
  const yearly = yearlyCheckNoDelivery.checked;

  if (endDate && endDate < date) {
    alert('終了日は開始日以降にしてください。');
    return;
  }

  if (yearly && endDate) {
    const startMD = date.substring(5);
    const endMD = endDate.substring(5);
    if (endMD < startMD) {
      alert('毎年繰り返しの範囲指定では年をまたぐ指定はできません。');
      return;
    }
  }

  // 重複チェック
  if (noDeliveryDays.some(d => d.date === date && (d.endDate || null) === endDate && !!d.yearly === yearly)) return;

  // カスタム休日との相互排他チェック
  if (hasOverlapWithList(date, endDate, yearly, holidays)) {
    alert('この日付範囲はカスタム休日と重複しています。先にカスタム休日から削除してください。');
    return;
  }

  const label = labelInputNoDelivery.value.trim();
  const entry = { date, label };
  if (endDate) entry.endDate = endDate;
  if (yearly) entry.yearly = true;

  noDeliveryDays.push(entry);
  saveNoDeliveryDays();
  renderNoDeliveryList();

  dateInputNoDelivery.value = '';
  endDateInputNoDelivery.value = '';
  labelInputNoDelivery.value = '';
  yearlyCheckNoDelivery.checked = false;
}

function deleteNoDeliveryDay(index) {
  noDeliveryDays.splice(index, 1);
  saveNoDeliveryDays();
  renderNoDeliveryList();
}

// === タブ切り替え ===
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// === イベントリスナー ===
addBtnHolidays.addEventListener('click', addHoliday);
labelInputHolidays.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addHoliday();
});
dateInputHolidays.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addHoliday();
});
endDateInputHolidays.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addHoliday();
});

addBtnNoDelivery.addEventListener('click', addNoDeliveryDay);
labelInputNoDelivery.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addNoDeliveryDay();
});
dateInputNoDelivery.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addNoDeliveryDay();
});
endDateInputNoDelivery.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addNoDeliveryDay();
});

// === 初期化 ===
loadHolidays();
loadNoDeliveryDays();
