# FVTT-DX3rd-System (v13)

Foundry VTT **v13 専用**の『ダブルクロス The 3rd Edition』システム。

[ksx0330/FVTT-DX3rd-System](https://github.com/ksx0330/FVTT-DX3rd-System)(v11対応)を
v13 向けに全面刷新したもの。オリジナルの作者は **ltaeng (ksx0330)** 氏。

> [!WARNING]
> **本移植は実機での動作検証が未実施です。** Application V1 → V2 への全面書き換えを含む
> 大規模な変更のため、不具合が残っている可能性があります。
> 既存ワールドで使う前に、必ず新規ワールドで動作を確認してください。
> 既知のリスクと検証手順は [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) を参照。

## 対応バージョン

| | |
|---|---|
| Foundry VTT | v13 以降(`minimum: 13` / `verified: 13.345`) |
| v11 / v12 | **非対応**(互換性は維持していません) |

v11 で使う場合は[オリジナル版](https://github.com/ksx0330/FVTT-DX3rd-System)を利用してください。

## インストール

本リポジトリはプライベートのため、Manifest URL からの直接インストールはできません。
リポジトリを zip でダウンロードし、Foundry のデータフォルダ配下 `Data/systems/dx3rd/` へ
展開してから Foundry を再起動してください。

```
Data/systems/dx3rd/
├── system.json
├── template.json
├── module/
├── templates/
├── styles/
├── lang/
├── lib/
└── packs/
```

将来リポジトリを公開する場合は、`system.json` の `manifest` / `download` を
公開URLに合わせて更新してください。

## 対応言語

한국어(Korean), 日本語(Japanese), English

## 機能

- キャラクターの能力値を自動計算
- エフェクトの Attributes に `@level` を入力するとエフェクトのレベルを参照
  (例: コンセントレイト → `-@level`)
- 他のアクターをドラッグしてロイスを作成

## v11版からの主な変更点

- Application V1 → **ApplicationV2 / DialogV2** へ全面移行、jQuery 依存を全廃
- v13 で廃止・変更された API へ追随
  (`CHAT_MESSAGE_STYLES`、`rolls` 配列、`toggleStatusEffect`、`getSceneControlButtons` のオブジェクト形式 ほか)
- 移行過程で発見した既存バグを修正
  - トークンのリソースバー(HP)操作が反映されない不具合
  - スキル自動追加が保存されない不具合
  - 防御ダイアログを複数開くと入力値が混線する不具合

詳細は [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md)。

## Legal

本作は、「F.E.A.R」が権利を有する『ダブルクロス』の二次創作物です。
(C) F.E.A.R

オリジナルのシステム実装は ltaeng (ksx0330) 氏によるものです。
ライセンスは [LICENSE.txt](LICENSE.txt) を参照してください。
