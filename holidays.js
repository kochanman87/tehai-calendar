// 祝日データ層: API取得・キャッシュ・年末年始・カスタム休日・納品NG日を統合
const HOLIDAYS_API_URL = 'https://holidays-jp.github.io/api/v1/date.json';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30日

// 内部状態
let holidaySet = new Set();       // "YYYY-MM-DD" 形式
let holidayNames = new Map();     // "YYYY-MM-DD" → 祝日名
let customHolidaySet = new Set();
let customHolidayLabels = new Map();
let customHolidayEntries = [];    // yearly/range含む全エントリ
let noDeliveryDaySet = new Set();
let noDeliveryDayLabels = new Map();
let noDeliveryDayEntries = [];    // yearly/range含む全エントリ
let initialized = false;

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" → "MM-DD"
function toMonthDay(dateStr) {
  return dateStr.substring(5);
}

// エントリが指定日にマッチするか判定
function entryMatchesDate(entry, dateKey, monthDay) {
  if (entry.yearly) {
    const startMD = toMonthDay(entry.date);
    if (entry.endDate) {
      const endMD = toMonthDay(entry.endDate);
      return monthDay >= startMD && monthDay <= endMD;
    }
    return monthDay === startMD;
  } else {
    if (entry.endDate) {
      return dateKey >= entry.date && dateKey <= entry.endDate;
    }
    return dateKey === entry.date;
  }
}

// エントリリストからマッチするエントリを探す（yearly/rangeのみ）
function findMatchingEntry(entries, dateKey, monthDay) {
  for (const e of entries) {
    if ((e.yearly || e.endDate) && entryMatchesDate(e, dateKey, monthDay)) {
      return e;
    }
  }
  return null;
}

// 年末年始判定 (12/29-12/31, 1/1-1/3)
function isNenmatsuNenshi(date) {
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 11 && d >= 29) return true;
  if (m === 0 && d <= 3) return true;
  return false;
}

const hasStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

async function fetchAndCacheHolidays() {
  let stored = {};
  if (hasStorage) {
    stored = await chrome.storage.local.get(['holidaysJP', 'holidaysJPFetchedAt']);
  }
  const now = Date.now();

  if (stored.holidaysJP && stored.holidaysJPFetchedAt &&
      (now - stored.holidaysJPFetchedAt) < CACHE_TTL_MS) {
    return stored.holidaysJP;
  }

  try {
    const res = await fetch(HOLIDAYS_API_URL);
    const data = await res.json();
    if (hasStorage) {
      await chrome.storage.local.set({
        holidaysJP: data,
        holidaysJPFetchedAt: now
      });
    }
    return data;
  } catch (e) {
    return stored.holidaysJP || {};
  }
}

async function loadCustomHolidays() {
  if (!hasStorage) return [];
  try {
    const { customHolidays } = await chrome.storage.local.get('customHolidays');
    return customHolidays || [];
  } catch (e) {
    console.warn('loadCustomHolidays failed:', e);
    return [];
  }
}

async function loadNoDeliveryDays() {
  if (!hasStorage) return [];
  try {
    const { noDeliveryDays } = await chrome.storage.local.get('noDeliveryDays');
    return noDeliveryDays || [];
  } catch (e) {
    console.warn('loadNoDeliveryDays failed:', e);
    return [];
  }
}

// エントリリストからSet/Map/配列を構築
function buildEntryData(list, set, labels, entriesRef) {
  set.clear();
  labels.clear();
  entriesRef.length = 0;
  entriesRef.push(...list);
  for (const item of list) {
    if (!item.yearly && !item.endDate) {
      set.add(item.date);
      if (item.label) labels.set(item.date, item.label);
    }
  }
}

async function initHolidays() {
  try {
    const [apiData, customList, noDeliveryList] = await Promise.all([
      fetchAndCacheHolidays(),
      loadCustomHolidays(),
      loadNoDeliveryDays()
    ]);

    // API祝日
    holidaySet.clear();
    holidayNames.clear();
    for (const [dateStr, name] of Object.entries(apiData || {})) {
      holidaySet.add(dateStr);
      holidayNames.set(dateStr, name);
    }

    buildEntryData(customList || [], customHolidaySet, customHolidayLabels, customHolidayEntries);
    buildEntryData(noDeliveryList || [], noDeliveryDaySet, noDeliveryDayLabels, noDeliveryDayEntries);
  } catch (e) {
    console.warn('initHolidays failed, calendar will render without holiday data:', e);
  }

  initialized = true;
}

function isCustomHoliday(date) {
  const key = formatDateKey(date);
  if (customHolidaySet.has(key)) return true;
  return !!findMatchingEntry(customHolidayEntries, key, toMonthDay(key));
}

function isHoliday(date) {
  const key = formatDateKey(date);
  return holidaySet.has(key) || isCustomHoliday(date) || isNenmatsuNenshi(date);
}

function isBusinessDay(date) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !isHoliday(date);
}

function getHolidayName(date) {
  const key = formatDateKey(date);
  if (holidayNames.has(key)) return holidayNames.get(key);
  if (customHolidayLabels.has(key)) return customHolidayLabels.get(key);
  const entry = findMatchingEntry(customHolidayEntries, key, toMonthDay(key));
  if (entry && entry.label) return entry.label;
  if (isNenmatsuNenshi(date)) return '年末年始';
  return null;
}

function isNoDeliveryDay(date) {
  const key = formatDateKey(date);
  if (noDeliveryDaySet.has(key)) return true;
  return !!findMatchingEntry(noDeliveryDayEntries, key, toMonthDay(key));
}

function getNoDeliveryDayLabel(date) {
  const key = formatDateKey(date);
  const label = noDeliveryDayLabels.get(key);
  if (label) return label;
  const entry = findMatchingEntry(noDeliveryDayEntries, key, toMonthDay(key));
  return entry ? (entry.label || null) : null;
}

// オプションページからの変更をリアルタイム反映
function onStorageChanged(changes) {
  if (changes.customHolidays) {
    const newList = changes.customHolidays.newValue || [];
    buildEntryData(newList, customHolidaySet, customHolidayLabels, customHolidayEntries);
  }
  if (changes.noDeliveryDays) {
    const newList = changes.noDeliveryDays.newValue || [];
    buildEntryData(newList, noDeliveryDaySet, noDeliveryDayLabels, noDeliveryDayEntries);
  }
}
