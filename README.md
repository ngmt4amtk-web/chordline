# CHORDLINE

コードを4つ並べて聴き、有名進行を発掘して図鑑に刻む。同じアプリ内で、コード記号から構成音を取り出す練習もできる。依存ゼロのWebアプリ。

https://ngmt4amtk-web.github.io/chordline/

## 2つのモード

1. **発掘** — 4コードを選ぶ → 再生 → 「微妙／良い」。評価にかかわらず18進行と照合し、ヒットすれば同じ画面の図鑑に刻む。未登録で「良い」の並びは棚へ保存
2. **構成音** — 発掘状況に関係なく96コードから8問。無音で鍵盤回答 → 確定後に正解音。無音正解・ヒント正解・誤答を分離し、次回は弱点を優先

設定は現在の画面を保ったまま開く。進行図鑑は発掘画面の下に統合している。

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

## 技術とデータ

- 純JS ESM / Web Audio / ビルド不要
- 進行判定: 移調同値・三和音と7th系の互換・クリシェstrict（`js/theory.js`）
- 発掘データ: `chordline:v2`（既存の図鑑・棚・設定を維持）
- 構成音データ: `chordline:tones:v1`（発掘データと分離）
- GitHub Pages

## 関連

- [NOCTUNE](https://ngmt4amtk-web.github.io/noctune/) — 耳トレ
- [だいちの木ピアノ](https://ngmt4amtk-web.github.io/daichi-piano/) — 子ども向け足場付き楽譜
