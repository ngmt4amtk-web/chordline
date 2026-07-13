import { NOTE_NAMES_KATA } from '../theory.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const ABC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

function labelFor(pc, style) {
  return style === 'abc' ? ABC[pc] : NOTE_NAMES_KATA[pc];
}

/** 1オクターブ12音。白鍵は約50px、黒鍵は透明ヒット領域を44px以上にする。 */
export function createKeyboard({ container, onNoteOn, onNoteOff, startOctave = 3, noteStyle = 'katakana' }) {
  const root = document.createElement('div');
  root.className = 'keyboard';
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'ピアノ鍵盤');

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 700 200');
  svg.setAttribute('class', 'keyboard-svg');

  const whiteW = 100;
  const blackVisualW = 58;
  const blackHitW = 100;
  const startMidi = (startOctave + 1) * 12;
  const keys = new Map();

  WHITE_PCS.forEach((pc, i) => {
    const midi = startMidi + pc;
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', i * whiteW + 1);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', whiteW - 2);
    rect.setAttribute('height', 184);
    rect.setAttribute('rx', 3);
    rect.setAttribute('class', 'key white');
    rect.dataset.midi = String(midi);
    rect.dataset.pc = String(pc);
    rect.setAttribute('role', 'button');
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('aria-label', labelFor(pc, noteStyle));
    svg.appendChild(rect);
    keys.set(midi, rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', i * whiteW + whiteW / 2);
    label.setAttribute('y', 166);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'key-label');
    label.textContent = labelFor(pc, noteStyle);
    svg.appendChild(label);
  });

  const blackPcs = [1, 3, 6, 8, 10];
  const blackCenters = [100, 200, 400, 500, 600];
  blackPcs.forEach((pc, i) => {
    const midi = startMidi + pc;
    const center = blackCenters[i];
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', center - blackVisualW / 2);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', blackVisualW);
    rect.setAttribute('height', 116);
    rect.setAttribute('rx', 3);
    rect.setAttribute('class', 'key black');
    rect.dataset.pc = String(pc);
    svg.appendChild(rect);
    keys.set(midi, rect);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', center);
    label.setAttribute('y', 102);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'key-label black-label');
    label.textContent = labelFor(pc, noteStyle);
    svg.appendChild(label);

    const hit = document.createElementNS(SVG_NS, 'rect');
    hit.setAttribute('x', center - blackHitW / 2);
    hit.setAttribute('y', 0);
    hit.setAttribute('width', blackHitW);
    hit.setAttribute('height', 132);
    hit.setAttribute('class', 'key-hit');
    hit.dataset.midi = String(midi);
    hit.dataset.pc = String(pc);
    hit.setAttribute('role', 'button');
    hit.setAttribute('tabindex', '0');
    hit.setAttribute('aria-label', labelFor(pc, noteStyle));
    svg.appendChild(hit);
  });

  root.appendChild(svg);
  container.appendChild(root);

  const pressed = new Set();

  function visualFor(target) {
    return keys.get(Number(target.dataset.midi));
  }

  function activate(target) {
    const midi = Number(target.dataset.midi);
    const pc = Number(target.dataset.pc);
    const visual = visualFor(target);
    pressed.add(midi);
    visual?.classList.add('pressed');
    onNoteOn?.({ midi, pc });
  }

  function release(target) {
    const midi = Number(target.dataset.midi);
    const pc = Number(target.dataset.pc);
    if (!pressed.has(midi)) return;
    pressed.delete(midi);
    visualFor(target)?.classList.remove('pressed');
    onNoteOff?.({ midi, pc });
  }

  function keyTarget(event) {
    return event.target.closest('[data-midi]');
  }

  svg.addEventListener('pointerdown', (event) => {
    const target = keyTarget(event);
    if (!target) return;
    event.preventDefault();
    activate(target);
  });
  svg.addEventListener('pointerup', (event) => {
    const target = keyTarget(event);
    if (target) release(target);
  });
  svg.addEventListener('pointerleave', () => {
    for (const midi of pressed) {
      keys.get(midi)?.classList.remove('pressed');
      onNoteOff?.({ midi, pc: midi % 12 });
    }
    pressed.clear();
  });
  svg.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = keyTarget(event);
    if (!target) return;
    event.preventDefault();
    activate(target);
    release(target);
  });

  function clearClasses() {
    keys.forEach((key) => key.classList.remove('target', 'pressed', 'correct', 'wrong'));
  }

  function setHighlight(pcs, className = 'target') {
    clearClasses();
    keys.forEach((key) => {
      const pc = Number(key.dataset.pc);
      if (pcs?.includes(pc)) key.classList.add(className);
    });
  }

  return {
    el: root,
    setHighlight,
    setSelection(pcs) {
      setHighlight(pcs, 'target');
    },
    showResult(correctPcs, selectedPcs) {
      clearClasses();
      keys.forEach((key) => {
        const pc = Number(key.dataset.pc);
        if (correctPcs?.includes(pc)) key.classList.add('correct');
        else if (selectedPcs?.includes(pc)) key.classList.add('wrong');
      });
    },
    flashResult(ok) {
      keys.forEach((key) => {
        if (key.classList.contains('target')) key.classList.add(ok ? 'correct' : 'wrong');
      });
    },
    destroy() {
      root.remove();
    },
  };
}
