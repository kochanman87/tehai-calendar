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
├── holidays.js      # 祝日データ層（API取得・キャッシュ・年末年始・カスタム休日・納品NG日）
├── options.html     # カスタム休日・納品NG日設定ページ（タブUI）
├── options.css      # オプションページスタイル
├── options.js       # カスタム休日・納品NG日のCRUD
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

## パーミッション
- `storage`: 各種データの永続保存
- `host_permissions`: `https://holidays-jp.github.io/*`（祝日API）

## 開発メモ
- ホイールイベントは `passive: false` 指定（ChromeデフォルトのpassiveだとpreventDefaultが無効）
- 祝日データは `Set<"YYYY-MM-DD">` で O(1) 判定（単一日付）。yearly/rangeエントリは配列走査
- オプションページの変更は `chrome.storage.onChanged` でnewtabにリアルタイム反映
