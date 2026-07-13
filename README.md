# CHORDLINE

コード記号と進行を、見て・聴いて・鍵盤で触る。大人向けUIのWebアプリ（依存ゼロ）。

https://ngmt4amtk-web.github.io/chordline/

## モード

1. **進行** — プリセット進行をタイムラインで聴く（Axis / ii–V–I / 小室進行 など）
2. **コード** — 記号と構成音の対応を確認
3. **練習** — 進行を1コードずつ、画面鍵盤で構成音入力

## 起動

```bash
cd ~/Projects/chordline
python3 -m http.server 8760
# http://localhost:8760/
```

## テスト

```bash
node --test test/*.test.mjs
```

## 技術

- 純JS ESM / Web Audio
- キー移調・ローマ数字（任意表示）・機能色（T / SD / D）
- GitHub Pages デプロイ（ビルド不要）

## 関連

- [NOCTUNE](https://ngmt4amtk-web.github.io/noctune/) — 耳トレ（別アプリ）
- [だいちの木ピアノ](https://ngmt4amtk-web.github.io/daichi-piano/) — 子ども向け足場付き楽譜（別系統）
