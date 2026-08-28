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

async function loadNoDeliveryDayList() {
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

// === 有給・ボーナス ===
const paidLeaveInput = document.getElementById('paid-leave-input');
const dateInputBonus = document.getElementById('date-input-bonus');
const labelInputBonus = document.getElementById('label-input-bonus');
const yearlyCheckBonus = document.getElementById('yearly-check-bonus');
const addBtnBonus = document.getElementById('add-btn-bonus');
const bonusListEl = document.getElementById('bonus-list');
const emptyMsgBonus = document.getElementById('empty-msg-bonus');
const planResultEl = document.getElementById('plan-result');

const PAID_LEAVE_SAVE_DEBOUNCE_MS = 400;

let bonusDates = [];
let paidLeaveSaveTimer = null;

async function loadRetirementTab() {
  const data = await chrome.storage.local.get(['bonusDates', 'paidLeaveDays']);
  bonusDates = data.bonusDates || [];
  paidLeaveInput.value = Number(data.paidLeaveDays) || 0;
  renderBonusList();
}

async function saveBonusDates() {
  await chrome.storage.local.set({ bonusDates });
}

function renderBonusList() {
  bonusListEl.innerHTML = '';

  if (bonusDates.length === 0) {
    emptyMsgBonus.classList.remove('hidden');
    return;
  }

  emptyMsgBonus.classList.add('hidden');

  // 毎年エントリは月日、単発は日付でソートしたいので表示順は date 文字列基準
  const sorted = [...bonusDates].sort((a, b) => {
    if (!!a.yearly !== !!b.yearly) return a.yearly ? -1 : 1;
    if (a.yearly) return a.date.substring(5).localeCompare(b.date.substring(5));
    return a.date.localeCompare(b.date);
  });

  sorted.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'bonus-item';

    if (item.yearly) {
      const badge = document.createElement('span');
      badge.className = 'yearly-badge';
      badge.textContent = '毎年';
      row.appendChild(badge);
    }

    const dateEl = document.createElement('span');
    dateEl.className = 'bonus-date';
    dateEl.textContent = item.yearly ? formatMD(item.date) : item.date;
    row.appendChild(dateEl);

    const labelEl = document.createElement('span');
    labelEl.className = 'bonus-label';
    labelEl.textContent = item.label || '';
    row.appendChild(labelEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', '削除');
    const origIndex = bonusDates.indexOf(item);
    delBtn.addEventListener('click', () => deleteBonusDate(origIndex));
    row.appendChild(delBtn);

    bonusListEl.appendChild(row);
  });
}

function addBonusDate() {
  const date = dateInputBonus.value;
  if (!date) return;

  const yearly = yearlyCheckBonus.checked;

  // 重複チェック（毎年は月日、単発は日付で判定）
  const duplicated = bonusDates.some(b => {
    if (!!b.yearly !== yearly) return false;
    return yearly ? b.date.substring(5) === date.substring(5) : b.date === date;
  });
  if (duplicated) {
    alert('同じボーナス支給日が既に登録されています。');
    return;
  }

  bonusDates.push({ date, label: labelInputBonus.value.trim(), ...(yearly ? { yearly: true } : {}) });
  saveBonusDates();
  renderBonusList();

  dateInputBonus.value = '';
  labelInputBonus.value = '';
  yearlyCheckBonus.checked = false;
}

function deleteBonusDate(index) {
  bonusDates.splice(index, 1);
  saveBonusDates();
  renderBonusList();
}

function onPaidLeaveInput() {
  if (paidLeaveSaveTimer) clearTimeout(paidLeaveSaveTimer);
  paidLeaveSaveTimer = setTimeout(async () => {
    const value = Math.min(999, Math.max(0, parseInt(paidLeaveInput.value, 10) || 0));
    paidLeaveInput.value = value;
    await chrome.storage.local.set({ paidLeaveDays: value });
  }, PAID_LEAVE_SAVE_DEBOUNCE_MS);
}

// 計算結果の描画（営業日判定に holidays.js のデータが必要）
function renderPlanResult() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const plan = computeRetirementPlan(today);

  planResultEl.className = '';

  if (!plan) {
    planResultEl.classList.add('is-empty');
    planResultEl.textContent = 'ボーナス支給日を登録すると、退職スケジュールを計算します。';
    return;
  }

  const rows = [
    ['対象ボーナス', `${formatPlanDate(plan.bonus.date)}${plan.bonus.label ? '　' + plan.bonus.label : ''}`],
    ['最終出社日', formatPlanDate(plan.lastWorkDay)],
    ['有給消化期間', plan.leaveStart
      ? `${formatPlanDate(plan.leaveStart)} 〜 ${formatPlanDate(plan.retire)}　(${plan.leaveDays.length}営業日)`
      : 'なし（残り有給0日）'],
    ['退職日', formatPlanDate(plan.retire)]
  ];

  planResultEl.innerHTML = '';
  for (const [key, value] of rows) {
    const row = document.createElement('div');
    const k = document.createElement('span');
    k.className = 'plan-key';
    k.textContent = key;
    const v = document.createElement('span');
    v.className = 'plan-value';
    v.textContent = value;
    row.appendChild(k);
    row.appendChild(v);
    planResultEl.appendChild(row);
  }

  if (plan.expired) {
    planResultEl.classList.add('is-warning');
    const warn = document.createElement('div');
    warn.className = 'plan-warning';
    warn.textContent =
      '⚠ 最終出社日が今日より前になっています。この支給日に間に合わせて有給を全部消化することはできません。';
    planResultEl.appendChild(warn);
  }
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

addBtnBonus.addEventListener('click', addBonusDate);
labelInputBonus.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBonusDate();
});
dateInputBonus.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addBonusDate();
});
paidLeaveInput.addEventListener('input', onPaidLeaveInput);

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
loadNoDeliveryDayList();
loadRetirementTab();

// 営業日判定に必要な祝日データを読み込んでから計算結果を描画
initHolidays().then(renderPlanResult);

// 自ページ内の変更も onChanged で拾い、holidays.js 側の状態と計算結果を同期する
chrome.storage.onChanged.addListener((changes) => {
  onStorageChanged(changes);
  if (changes.customHolidays || changes.bonusDates || changes.paidLeaveDays) {
    renderPlanResult();
  }
});
