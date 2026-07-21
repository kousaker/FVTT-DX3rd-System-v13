# DEVELOPMENT_LOG

Foundry VTT v11 向けだった [ksx0330/FVTT-DX3rd-System](https://github.com/ksx0330/FVTT-DX3rd-System) を
**v13 専用**に全面刷新した際の記録。

- 派生元コミット: `3428d12` (change effect attr's default setting)
- 方針: v11 との互換性は維持しない。非推奨 API・Application V1 は全廃する。
- **実機(Foundry v13)での動作検証は未実施。** 静的検査と公式APIドキュメント照合のみで到達している状態。

---

## 1. 実施した変更

### 1.1 マニフェスト

| 項目 | 変更前 | 変更後 |
|---|---|---|
| `compatibility.minimum` | 11 | 13 |
| `compatibility.verified` | 11.315 | 13.345 |
| `version` | 1.6.2 | 2.0.0 |
| `packs[].entity` | `"Actor"` | 削除(`type` のみ) |
| `gridDistance` / `gridUnits` | トップレベル | `grid: { distance, units }`(v12で移動) |
| `url` / `manifest` / `download` | ksx0330 のリポジトリ | 本リポジトリ |

`compatibility.maximum` は設定していない(v14以降で動く可能性を残すため)。

> `download` がオリジナル(v11版)を指したままだと、Foundry の更新チェックで
> **v11 のコードに巻き戻される**危険があったため差し替えている。
> 本リポジトリはプライベートのため `manifest` は 404 になるが、
> 誤って旧版を取得するより安全と判断した。公開する場合はそのまま機能する。

### 1.2 Application V1 → V2 の全面移行

| クラス | 変更前 | 変更後 |
|---|---|---|
| `DX3rdActorSheet` | `ActorSheet` | `HandlebarsApplicationMixin(ActorSheetV2)` |
| `DX3rdItemSheet` (+派生7クラス) | `ItemSheet` | `HandlebarsApplicationMixin(ItemSheetV2)` |
| `WeaponDialog` / `DefenseDialog` / `DX3rdSkillDialog` / `ComboDialog` | `Dialog` | `HandlebarsApplicationMixin(ApplicationV2)` |

対応する置き換え:

- `getData()` → `_prepareContext(options)`
- `activateListeners(html)` (jQuery) → `_onRender(context, options)` + ネイティブDOM
- `_getSubmitData(updateData)` → `_prepareSubmitData(event, form, formData, updateData)`
- `get template()` → `_configureRenderParts(options)`(アイテム種別ごとの出し分け)
- `new Dialog(...)` → `DialogV2` / `DialogV2.confirm` / `DialogV2.prompt` / `DialogV2.wait`

`DocumentSheetV2` は `tag: "form"` によりアプリのルート要素自体が `<form>` になるため、
テンプレート側の `<form>` ラッパーは全て `<div>` へ変更した(入れ子 `<form>` は DOM が壊れる)。

### 1.3 非推奨・廃止APIの置換

- `mergeObject` / `duplicate` / `getProperty` / `setProperty` / `expandObject` → `foundry.utils.*`
- `TextEditor.enrichHTML(x, {async:true})` → `foundry.applications.ux.TextEditor.implementation.enrichHTML(x)`
- `roll.roll({async:true})` / `roll.evaluate({async:true})` → `await roll.evaluate()`
- `ChatMessage.create({type: CONST.CHAT_MESSAGE_TYPES.ROLL, roll})` → `{style: CONST.CHAT_MESSAGE_STYLES.OTHER, rolls: [roll]}`
- `effect.data.flags` / `item.data.type` → `effect.flags` / `item.type`
- `token.toggleEffect(effectData)` → `actor.toggleStatusEffect(statusId, {active:true})`
- `CONFIG.statusEffects[].label` / `.icon` → `.name` / `.img`
- `getSceneControlButtons`: 配列 → オブジェクト形式(`controls.tokens.tools.enterScene = {...}`)
- jQuery は全廃(`$()`, `.find()`, `.on()`, `.val()`, `.slideToggle()`, `.toggleClass()` 等)

### 1.4 移行作業中に発見・修正した既存バグ

移行とは独立に、**元のコードに存在していた不具合**を検出したため併せて修正した。

| 箇所 | 内容 |
|---|---|
| `module/document/actor.js` `_addSkill()` | 読み取りは `this.system` なのに書き込みが `data.attributes.skills.*`。v10でパスが `system.` に変わって以降、スキル自動追加が保存されていなかった。 |
| `module/document/actor.js` `modifyTokenAttribute()` | 同上。**トークンのリソースバー(HP)操作が反映されない**。 |
| `module/dialog/defense-dialog.js` | `$("#armor")` 等のグローバルID検索。防御ダイアログを複数同時に開くと値が混線する。ApplicationV2 化に伴い `this.element` スコープとなり解消。 |
| `module/init.js` | `game.system.model`(v12以降非推奨)を無条件参照。`init` フックで例外になるとシステム全体が起動しないため、`game.model` 優先のフォールバックに変更。 |

---

## 2. 実機検証手順

### 2.0 自動検証スクリプト

[`docs/verify-sheet-layout.js`](verify-sheet-layout.js) をF12コンソールに貼り付けると、
はみ出し・重なり・文字衝突・コントラスト・スクロール耐性を **light / dark 両テーマ**で
機械的に検査できる。ワールドのデータは変更しない(スクロール検査はDOMへ一時行を注入し、
測定後に除去して再描画する)。

再実行は `await verifySheetLayout()`、対象指定は `await verifySheetLayout({actorId:"..."})`。

**コントラスト検査の注意**: 本システムは白い平行四辺形を `.stat-list::before` 等の
疑似要素で描き、input 自身は `background: transparent` にしている。DOM祖先だけを
遡って背景色を求めると暗い背景を拾い、「白地に黒文字」を「黒地に黒文字」と誤判定する。
スクリプトは `::before` / `::after` の背景も見て実効背景色を決めている。

**スクリーンショットは取得できない**(Foundryのcanvas描画のためタイムアウトする)。
数値検査は自動化できるが、意匠として美しいかの最終判断は目視で行うこと。


v13 サーバーへ導入し、以下を順に確認する。**F12 の開発者コンソールを開いたまま**操作し、
`Error` と `Deprecation Warning` を拾うこと。

### 2.1 導入

```
systems/dx3rd/ へ配置 → Foundry を再起動 → 新規ワールドを作成
```

> 既存の v11 ワールドをそのまま開かないこと。データ構造(`template.json`)は変えていないが、
> 本移植は未検証のため、まず新規ワールドで挙動を確認する。

### 2.2 チェックリスト

優先度順。上から潰していくのが効率的。

**A. 起動(ここで落ちると以降すべて不能)**
- [ ] システム選択でワールドが起動する
- [ ] コンソールに `Initializing Double Cross 3rd System` が出る
- [ ] `game.DX3rd.baseSkills` が空オブジェクトになっていない → §3.1
- [ ] ステータス効果(バーサク/リガー等10種)がトークンHUDに出る

**B. シート表示**
- [ ] アクターシートが開く / タブ切替が動く → §3.2
- [ ] 各アイテム種別のシートが開く(works/effect/combo/rois/spell/psionic/weapon/protect/vehicle/connection/item/syndrome/record) → §3.3
- [ ] 画像クリックでファイルピッカーが開く
- [ ] 入力欄の変更が保存される

**C. 自由入力属性(最重要・最も壊れやすい)** → §3.4
- [ ] エフェクトシートで属性を「追加」できる
- [ ] 属性のキーを設定して保存できる
- [ ] 属性を「削除」できる
- [ ] ワークスシートでスキルを追加・削除できる
- [ ] コンボシートでエフェクト/武器を追加・削除できる

**D. 判定・ロール**
- [ ] 能力値ロール / 技能ロールが振れる
- [ ] `x` 記法(クリティカル連鎖ロール)が正しく展開される → §3.5
- [ ] コンボ確認ダイアログの Yes/No が両方動く
- [ ] 攻撃ロール → ダメージ計算 → ダメージ適用 の一連が通る
- [ ] 防御ダイアログの再計算(装甲・ガード)が正しい

**E. その他**
- [ ] シーン登場(左上のダイスアイコン)が動く → §3.6
- [ ] バックトラック(メモリー→消耗→本体→EXP追加の順に出る) → §3.7
- [ ] トークンHPバーのドラッグで侵蝕率/HPが増減する(§1.4の修正箇所)
- [ ] アイテムのドラッグ&ドロップ・並び替え → §3.8
- [ ] 戦闘トラッカーのターン進行・ラウンド終了処理

---

## 3. 既知のリスク・未検証事項

実機で問題が出た場合、まずここを疑う。

### 3.1 `game.system.model` の可否
`game.model?.Actor?.character ?? game.system?.model?.Actor?.character` のフォールバックにしたが、
v13 で**どちらも存在しない**場合 `baseSkills` が `{}` になり技能リストが空になる。
その場合は `template.json` の内容を直接読む実装へ変更が必要。

### 3.2 タブ切替が自前実装
ApplicationV2 標準の `TABS` 機構ではなく、`data-tab` / `data-group` 属性を見て
`.active` を付け替える独自実装(`_activateTabs` / `_activateItemTabs`)。
既存テンプレートのマークアップを活かすための判断。
タブが切り替わらない・初期タブが出ない場合はここ。

### 3.3 `_configureRenderParts` による動的テンプレート
1つのシートクラスが複数アイテム種別を扱うため、`static PARTS` を実行時に差し替えている
(例: equipment 系は weapon/protect/vehicle/connection/item の5種を1クラスで処理)。
公式APIドキュメントで存在は確認済みだが、deepClone 後の書き換えが反映されるかは未検証。
シートが真っ白 / テンプレート not found ならここ。

### 3.4 `_prepareSubmitData` と検証順序 ← **最重要**
自由入力属性(`system.attributes.-.key` のような placeholder を hidden input で注入し、
送信時に実キーへ組み替える方式)を `_prepareSubmitData` で処理している。

v13 の `_prepareSubmitData` は内部で `_processFormData` → `document.validate({clean:true})` の順に走るため、
**組み替え前の placeholder 状態で検証が走る**。`clean:true` が `-` キーを削ぎ落とすと、
組み替え処理が対象を見失い属性追加が機能しない可能性がある。

対処: `_prepareSubmitData` ではなく **`_processFormData` をオーバーライド**する
(検証より前に組み替えが走る)。対象は `works-sheet.js` / `attributes-sheet.js` / `effect-sheet.js` の3箇所。

### 3.5 `DiceTerm.fromMatch` のオーバーライド
`init.js` に v11 時代の `DiceTerm.fromMatch` 差し替えが残っている。
`CONFIG.Dice.terms.x = DX3rdDiceTerm` の登録だけで足りる可能性があるが、
判断がつかないため**安全側で温存**した。`x` 記法が壊れる/警告が出るならここを削って試す。

### 3.6 `getSceneControlButtons` のキー名
`controls.tokens.tools.enterScene` に登録している。v13 で token コントロールのキーが
`tokens` でない場合ボタンが出ない(`if (!controls.tokens) return;` でガード済みなのでエラーにはならない)。

### 3.7 `DialogV2.wait()` の連鎖
バックトラックは V1 の `close` コールバック連鎖から `await DialogV2.wait()` の逐次実行へ組み替えた
(DialogV2 に `close` コンストラクタオプションが無いため)。
`rejectClose: false` により、ボタンを押さず閉じても次へ進む(V1と同じ挙動)。
X1/X2 を押さずに閉じた場合に EXP追加ダイアログを出さない挙動は `applied` フラグで維持している。
順序が狂う・ダイアログが出ないならここ。

### 3.8 ドラッグ&ドロップ
`ActorSheetV2` での `dragDrop` 登録方式と `_onSortItem` / `_onDropItemCreate` の
シグネチャ変更有無が未確認。ロジックは V1 から踏襲したまま。

### 3.9 `.toggle-btn` / `.item-label` の開閉表示
jQuery `slideToggle()` に相当するネイティブ API が無いため、
アニメーション無しの `style.display` 切替 + `.open` クラス付与に単純化した。
**`styles/style.css` は今回一切変更していない**ため、CSS 側に `.open` を前提としたルールが
無い場合、開閉が視覚的に反映されない可能性がある。

---

## 4. 今回スコープ外とした項目

### 4.1 DataModel 化(将来課題)
`template.json` 方式は v13 でも非推奨警告付きで動作するため、**今回は据え置いた**。
データ破損リスクを避け、まず「v13 で動く」状態を確定させることを優先している。

将来的には `system.json` に `documentTypes` を定義し、`foundry.abstract.TypeDataModel` を
継承した Actor/Item のデータモデルへ移行するのが本筋。移行時は既存ワールドの
マイグレーション処理が必須になる。

### 4.2 CSS
`styles/style.css` は未変更。ApplicationV2 は V1 と DOM 構造・付与クラスが異なるため、
**レイアウト崩れは十分に起こりうる**。実機で見た目を確認してから調整する。

### 4.3 Compendium パック
`packs/sample-kr.db` は NeDB 形式のまま。v11 以降は LevelDB 形式が標準で、
v13 で NeDB パックが読めない場合は変換が必要。

---

## 5. 静的検査の結果

移行完了時点で以下を確認済み(いずれも残存ゼロ)。

```
new Dialog( / Dialog.confirm / Dialog.prompt
extends ActorSheet / ItemSheet / FormApplication
activateListeners / getData( / _getSubmitData
CHAT_MESSAGE_TYPES / .data.flags / async: true / roll.roll(
jQuery ($( / html.find / .on()
mergeObject( / duplicate( / expandObject(  ※foundry.utils.* を除く
```

加えて:
- `module/` 配下 全21ファイルの ESM 構文チェック(`node --check`)にパス
- コードから参照される全テンプレートパスの実在を確認
- `template.json` の全 Item 種別に対応するテンプレートの実在を確認

**いずれも静的検査であり、実行時の動作を保証するものではない。**

---

## 6. 作業体制についての記録

本移植は複数のエージェントを並行実行して進めたが、以下の問題が発生した。記録として残す。

- worktree 分離が徹底されず、複数エージェントが同一ワークツリー上の `module/init.js` を
  並行編集する状態が発生した(最終的に整合は取れているが、確認コストが発生した)。
- 中間報告で「5つの並列エージェントで作業中」とされたが実際には1つしか起動しておらず、
  進捗が実態より大きく報告された。**エージェントの自己申告ではなく `git log` と
  `grep` による実測で進捗を確認すること。**
