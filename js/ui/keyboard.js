import { NOTE_NAMES_KATA } from '../theory.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const WHITE_COUNT = 14;

export function createKeyboard({ container, onNoteOn, onNoteOff, startOctave = 3, noteStyle = 'katakana' }) {
  const root = document.createElement('div');
  root.className = 'keyboard';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'Piano keyboard');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 700 160');
  svg.setAttribute('class', 'keyboard-svg');

  const whiteW = 700 / WHITE_COUNT;
  const blackW = whiteW * 0.58;
  const blackH = 96;

  const keys = new Map();
  const startMidi = (startOctave + 1) * 12;

  const whiteMidis = [];
  let midi = startMidi;
  while (whiteMidis.length < WHITE_COUNT) {
    if (WHITE_PCS.includes(midi % 12)) whiteMidis.push(midi);
    midi++;
  }

  whiteMidis.forEach((m, i) => {
    const x = i * whiteW;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x + 1);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', whiteW - 2);
    rect.setAttribute('height', 140);
    rect.setAttribute('rx', 2);
    rect.setAttribute('class', 'key white');
    rect.dataset.midi = String(m);
    rect.dataset.pc = String(m % 12);
    svg.appendChild(rect);
    keys.set(m, rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', x + whiteW / 2);
    label.setAttribute('y', 128);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'key-label');
    const pc = m % 12;
    label.textContent = noteStyle === 'abc'
      ? ['C', 'D', 'E', 'F', 'G', 'A', 'B'][WHITE_PCS.indexOf(pc)]
      : NOTE_NAMES_KATA[pc];
    svg.appendChild(label);
  });

  whiteMidis.forEach((m, i) => {
    const nextWhite = whiteMidis[i + 1];
    if (!nextWhite || nextWhite - m !== 2) return;
    const blackMidi = m + 1;
    const x = (i + 1) * whiteW - blackW / 2;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', blackW);
    rect.setAttribute('height', blackH);
    rect.setAttribute('rx', 2);
    rect.setAttribute('class', 'key black');
    rect.dataset.midi = String(blackMidi);
    rect.dataset.pc = String(blackMidi % 12);
    svg.appendChild(rect);
    keys.set(blackMidi, rect);
  });

  root.appendChild(svg);
  container.appendChild(root);

  let pressed = new Set();

  function setHighlight(pcs, className = 'target') {
    keys.forEach((el) => {
      el.classList.remove('target', 'pressed', 'correct', 'wrong');
      const pc = Number(el.dataset.pc);
      if (pcs && pcs.includes(pc)) el.classList.add(className);
    });
  }

  function handlePointer(e) {
    const key = e.target.closest('.key');
    if (!key) return;
    const midi = Number(key.dataset.midi);
    const pc = Number(key.dataset.pc);
    if (e.type === 'pointerdown') {
      pressed.add(midi);
      key.classList.add('pressed');
      onNoteOn?.({ midi, pc });
    } else if (e.type === 'pointerup' || e.type === 'pointerleave') {
      if (pressed.has(midi)) {
        pressed.delete(midi);
        key.classList.remove('pressed');
        onNoteOff?.({ midi, pc });
      }
    }
  }

  svg.addEventListener('pointerdown', handlePointer);
  svg.addEventListener('pointerup', handlePointer);
  svg.addEventListener('pointerleave', handlePointer);

  return {
    el: root,
    setHighlight,
    flashResult(ok) {
      keys.forEach((el) => {
        if (el.classList.contains('target') || el.classList.contains('pressed')) {
          el.classList.add(ok ? 'correct' : 'wrong');
          setTimeout(() => el.classList.remove('correct', 'wrong'), 400);
        }
      });
    },
    destroy() {
      root.remove();
    },
  };
}
