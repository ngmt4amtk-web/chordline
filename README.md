# CHORDLINE

コードを4つ並べて鳴らし、有名進行を発掘して図鑑に刻む。大人向けWebアプリ（依存ゼロ）。

https://ngmt4amtk-web.github.io/chordline/

## モード

1. **発掘**（主） — 4スロット＋パレット → 連続再生 → 微妙／良い。図鑑の進行に当たれば銘板「〇〇進行！」
2. **図鑑** — 初期18進行。未発見はシルエット。詳細で発掘形／フル形の再生と再発掘
3. **構成音** — 60秒。発掘済みコードの構成音を鍵盤で確認（0件時は発掘へ誘導）
4. **設定** — キー・音名（カタカナ）・テンポ・音量

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
- 進行判定: 移調同値・7th互換・クリシェ strict（`js/theory.js`）
- 永続化: `chordline:v2`（図鑑・マイライン・設定）。v1キーは読まない・消さない
- GitHub Pages デプロイ（ビルド不要）

## 関連

- [NOCTUNE](https://ngmt4amtk-web.github.io/noctune/) — 耳トレ（別アプリ）
- [だいちの木ピアノ](https://ngmt4amtk-web.github.io/daichi-piano/) — 子ども向け足場付き楽譜（別系統）
