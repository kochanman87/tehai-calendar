# 手配カレンダー (tehai-calendar)

## 概要
職場で物品購入時の納期リードタイムを営業日数で表示するChrome拡張機能。
新しいタブページとしてカレンダーを大画面表示する。

## 技術スタック
- Chrome Extension Manifest V3
- 純粋なHTML/CSS/JS（フレームワークなし）
- newtab override（新しいタブページをカレンダーに置き換え）

## ファイル構成
```
tehai-calendar/
├── manifest.json    # Manifest V3設定（newtab, storage, host_permissions）
├── newtab.html      # 新しいタブのカレンダーUI
├── newtab.css       # 大画面用スタイル
├── newtab.js        # カレンダーロジック（営業日リードタイム、コピー機能）
├── holidays.js      # 祝日データ層（API取得・キャッシュ・年末年始・カスタム休日・納品NG日・ボーナス/有給設定）
├── retirement.js    # 退職プラン計算層（newtab/optionsで共用）
├── options.html     # 設定ページ（カスタム休日・納品NG日・有給/ボーナスの3タブ）
├── options.css      # オプションページスタイル
├── options.js       # 各タブのCRUDと退職プラン結果表示
└── icons/           # 拡張機能アイコン (16/48/128px)
```

## 機能
1. **営業日リードタイム**: 土日祝・年末年始・カスタム休日を飛ばして営業日のみを連番表示
2. **祝日自動取得**: holidays-jp.github.io API（MITライセンス）から日本の祝日を取得・30日キャッシュ
3. **年末年始ビルトイン**: 12/29-1/3を自動的に休日扱い
4. **カスタム休日**: オプションページで任意の休日を追加/削除可能（範囲指定・毎年繰り返し対応）
5. **納品NG日**: リードタイムには数えるが納品不可の日をグレー表示。オプションページで追加/削除可能（範囲指定・毎年繰り返し対応）
6. **マウスホイールナビゲーション**: 上=前月、下=翌月（150msデバウンス）
7. **「今日」ボタン**: 当月に即座に戻る
8. **日付コピー**: 日付クリックでYYYYMMDD形式をクリップボードにコピー
9. **製番メモ（左パネル）**: 品名+製番をスタック登録。製番クリックでコピー
10. **手配先メモ（右パネル）**: コード+企業名をスタック登録。クリックで「コード\t企業名」(タブ区切り)コピー

## レイアウト
3カラム構成: 左(製番パネル 240px) | 中央(カレンダー flex) | 右(手配先パネル 240px)

## ストレージキー (chrome.storage.local)
- `holidaysJP`: 祝日APIキャッシュ
- `holidaysJPFetchedAt`: キャッシュ取得時刻
- `customHolidays`: カスタム休日 `[{ date, endDate?, label, yearly? }]`
- `noDeliveryDays`: 納品NG日 `[{ date, endDate?, label, yearly? }]`
- `seibanList`: 製番リスト `[{ label, seiban }]`
- `supplierList`: 手配先リスト `[{ code, name }]`
- `countAllDays`: 土日祝カウントトグルの状態 (boolean)
- `showRetirementPlan`: 退職プラン表示トグルの状態 (boolean)
- `paidLeaveDays`: 残り有給日数 (number)
- `bonusDates`: ボーナス支給日 `[{ date, label, yearly? }]`

## パーミッション
- `storage`: 各種データの永続保存
- `host_permissions`: `https://holidays-jp.github.io/*`（祝日API）

## 開発メモ
- ホイールイベントは `passive: false` 指定（ChromeデフォルトのpassiveだとpreventDefaultが無効）
- 祝日データは `Set<"YYYY-MM-DD">` で O(1) 判定（単一日付）。yearly/rangeエントリは配列走査
- オプションページの変更は `chrome.storage.onChanged` でnewtabにリアルタイム反映
- **options.html は holidays.js / retirement.js も読み込む**（営業日判定に祝日データが必要なため）。
  classic scriptはグローバルスコープを共有するので、**同名のトップレベル関数/変数を作らないこと**
  （options.js の `loadNoDeliveryDayList` は holidays.js の `loadNoDeliveryDays` との衝突を避けた名前）
- `hasStorage` は holidays.js の読み込み時に一度だけ評価される `const`。拡張外（file://等）では常にfalse
- 退職プランのハイライト色: 最終出社=バイオレット `#7c3aed` / 有給消化=アンバー `#fef3c7` / 賞与・退職=グリーン `#16a34a`
