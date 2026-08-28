// 退職プラン計算層
// 前提: ボーナスは「支給日に在籍していれば受給できる」。
// 有給消化中も在籍扱いなので、消化期間の最終日を支給日に合わせるのが最短ライン。
//
//   最終出社日 ─ 翌営業日から有給消化開始 ─ 残有給N営業日を消化 ─ 消化最終日 = 支給日 = 退職日
//
// 依存: holidays.js (isBusinessDay / formatDateKey / parseDateKey / getBonusEntries / getPaidLeaveDays)

const PLAN_MAX_SCAN_DAYS = 4000; // 無限ループ安全弁

// 今日以降で直近のボーナス支給日を求める
// yearly エントリは今年・来年の同月日を候補にする
function resolveNextBonusDate(fromDate) {
  const entries = getBonusEntries();
  let best = null;

  for (const entry of entries) {
    if (!entry || !entry.date) continue;
    const candidates = [];

    if (entry.yearly) {
      const monthDay = entry.date.substring(5);
      const baseYear = fromDate.getFullYear();
      for (const y of [baseYear, baseYear + 1]) {
        candidates.push(parseDateKey(`${y}-${monthDay}`));
      }
    } else {
      candidates.push(parseDateKey(entry.date));
    }

    for (const d of candidates) {
      if (!d || d < fromDate) continue;
      if (!best || d < best.date) {
        best = { date: d, label: entry.label || '' };
      }
    }
  }

  return best;
}

// 退職プランを計算する。ボーナス未登録なら null
function computeRetirementPlan(fromDate) {
  const bonus = resolveNextBonusDate(fromDate);
  if (!bonus) return null;

  const remaining = Math.max(0, getPaidLeaveDays());
  const retire = new Date(bonus.date);

  // 支給日から過去方向に営業日を remaining 個拾う
  const leaveDays = [];
  const cursor = new Date(retire);
  let scanned = 0;
  while (leaveDays.length < remaining && scanned < PLAN_MAX_SCAN_DAYS) {
    if (isBusinessDay(cursor)) leaveDays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
    scanned++;
  }
  leaveDays.reverse();

  // 有給0日なら消化期間なし。最終出社日は支給日当日（非営業日ならその直前の営業日）
  if (leaveDays.length === 0) {
    const lastWorkDay = new Date(retire);
    let back = 0;
    while (!isBusinessDay(lastWorkDay) && back < PLAN_MAX_SCAN_DAYS) {
      lastWorkDay.setDate(lastWorkDay.getDate() - 1);
      back++;
    }
    return {
      bonus,
      retire,
      leaveDays: [],
      leaveStart: null,
      lastWorkDay,
      expired: lastWorkDay < fromDate
    };
  }

  const leaveStart = new Date(leaveDays[0]);

  // 最終出社日 = 有給消化開始日の直前の営業日
  const lastWorkDay = new Date(leaveStart);
  let back = 0;
  do {
    lastWorkDay.setDate(lastWorkDay.getDate() - 1);
    back++;
  } while (!isBusinessDay(lastWorkDay) && back < PLAN_MAX_SCAN_DAYS);

  return {
    bonus,
    retire,
    leaveDays,
    leaveStart,
    lastWorkDay,
    // 最終出社日が今日より前 = 有給を全部使い切る最短ラインを過ぎている
    expired: lastWorkDay < fromDate
  };
}

// "YYYY-MM-DD" → プラン上の役割 のマップを作る
// { type: 'lastwork' | 'leave' | 'retire', index?: 消化N日目(非営業日は0) }
function buildPlanRoleMap(plan) {
  const map = new Map();
  if (!plan) return map;

  plan.leaveDays.forEach((d, i) => {
    map.set(formatDateKey(d), { type: 'leave', index: i + 1 });
  });

  // 消化期間中の土日祝（有給は消費しないが休み期間には含まれる）
  if (plan.leaveStart) {
    const cursor = new Date(plan.leaveStart);
    let scanned = 0;
    while (cursor <= plan.retire && scanned < PLAN_MAX_SCAN_DAYS) {
      const key = formatDateKey(cursor);
      if (!map.has(key)) map.set(key, { type: 'leave', index: 0 });
      cursor.setDate(cursor.getDate() + 1);
      scanned++;
    }
  }

  // 最終出社日・退職日は消化期間より優先（退職日は消化最終日と同日）
  map.set(formatDateKey(plan.lastWorkDay), { type: 'lastwork' });
  map.set(formatDateKey(plan.retire), { type: 'retire' });

  return map;
}

// Date → "2026/12/10(木)"
function formatPlanDate(date) {
  const dow = '日月火水木金土'[date.getDay()];
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}(${dow})`;
}
