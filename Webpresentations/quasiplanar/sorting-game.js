/* Sorting game: the reader puts each integer of a sequence into the row L_j,
   where j is the length of the longest decreasing subsequence ending at it. */
(() => {
  'use strict';

  const ROWS = 3;
  const FIRST_DEAL = Object.freeze([4, 2, 1, 7, 5, 3, 9, 8, 6, 10]);
  const RANDOM_LENGTH = 12;
  const BEST_KEY = 'quasiplanar-sorting-game-best-v1';
  const FLASH_MS = 600;
  const HINT_MS = 1600;
  const host = typeof window !== 'undefined' ? window : globalThis;
  const mounted = new WeakMap();

  // ℓ(a) = 1 + max{ℓ(b) : b comes before a and b > a}, and ℓ(a) = 1 if there is no such b.
  function levels(sequence) {
    const result = [];
    for (let i = 0; i < sequence.length; i++) {
      let longest = 0;
      for (let k = 0; k < i; k++) {
        if (sequence[k] > sequence[i] && result[k] > longest) longest = result[k];
      }
      result.push(longest + 1);
    }
    return result;
  }

  function longestDecreasing(sequence) {
    return levels(sequence).reduce((longest, value) => Math.max(longest, value), 0);
  }

  function normalise(input) {
    if (input === null || typeof input !== 'object' || typeof input.length !== 'number')
      throw new TypeError('Use a sequence of distinct integers.');
    const sequence = Array.from(input, Number);
    if (!sequence.length || sequence.some(value => !Number.isSafeInteger(value)) || new Set(sequence).size !== sequence.length)
      throw new TypeError('Use a nonempty sequence of distinct integers.');
    if (longestDecreasing(sequence) > ROWS)
      throw new RangeError('This sequence has a decreasing subsequence of length ' + longestDecreasing(sequence) + ', so it needs more than three rows.');
    return sequence;
  }

  // Split 1..length into three nonempty increasing groups, interleave their positions
  // at random, and keep the result once its longest decreasing subsequence has length 3.
  function randomSequence(random = Math.random, length = RANDOM_LENGTH) {
    if (!Number.isInteger(length) || length < ROWS) throw new RangeError('Use at least three integers.');
    const draw = k => Math.min(k - 1, Math.max(0, Math.floor(Number(random()) * k) || 0));
    for (let attempt = 0; attempt < 1000; attempt++) {
      const group = Array.from({length}, () => draw(ROWS));
      if (new Set(group).size < ROWS) continue;
      const members = Array.from({length: ROWS}, () => []);
      group.forEach((g, i) => members[g].push(i + 1));
      const slots = group.slice();
      for (let i = slots.length - 1; i > 0; i--) {
        const k = draw(i + 1);
        [slots[i], slots[k]] = [slots[k], slots[i]];
      }
      const used = new Array(ROWS).fill(0);
      const sequence = slots.map(g => members[g][used[g]++]);
      if (longestDecreasing(sequence) === ROWS) return sequence;
    }
    // Only reached with a degenerate random source.
    return [3, 2, 1].concat(Array.from({length: length - 3}, (_, i) => i + 4));
  }

  const escapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'};
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => escapes[character]);
  const plain = source => String(source).replace(/_\{([^{}]*)\}/g, '$1').replace(/[{}\\]/g, '');
  const plural = (count, word) => count + ' ' + word + (count === 1 ? '' : 's');
  const clock = ms => {
    const seconds = Math.max(0, Math.round(ms / 1000));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  };

  function mount(root, options = {}) {
    if (!root || root.nodeType !== 1) throw new TypeError('A container element is required.');
    if (mounted.has(root)) return mounted.get(root);
    const doc = root.ownerDocument;
    const win = doc.defaultView || host;
    const random = typeof options.random === 'function' ? options.random : Math.random;

    function tex(source, label) {
      const api = win.QuasiplanarDiagramMath;
      if (api && typeof api.html === 'function' && win.katex && typeof win.katex.renderToString === 'function')
        return api.html(String(source), {ariaLabel: label ?? plain(source)});
      return escapeHTML(plain(source));
    }
    const num = value => tex(String(value));
    const rowName = r => tex('L_{' + (r + 1) + '}', 'L' + (r + 1));

    root.classList.add('sg-root');
    root.setAttribute('data-no-edit', '');
    root.setAttribute('role', 'group');
    if (!root.hasAttribute('aria-label')) root.setAttribute('aria-label', 'Sorting game: put each integer into its chain');
    if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
    root.innerHTML =
      '<div class="sg-top"><p class="sg-label">Sequence</p><p class="sg-count"></p></div>' +
      '<ol class="sg-deck sg-track" aria-label="The sequence, read from left to right"></ol>' +
      '<div class="sg-rows">' + Array.from({length: ROWS}, (_, r) =>
        '<button type="button" class="sg-row" data-row="' + r + '"><span class="sg-track"></span></button>').join('') + '</div>' +
      '<div class="sg-message" role="status" aria-live="polite" aria-atomic="true"><p class="sg-prompt"></p><p class="sg-feedback"></p></div>' +
      '<div class="sg-foot"><div class="sg-actions">' +
      '<button type="button" class="outline-button sg-button" data-action="restart">Start again</button>' +
      '<button type="button" class="outline-button sg-button" data-action="new">New sequence</button>' +
      '</div><p class="sg-best"></p></div>';

    const deck = root.querySelector('.sg-deck');
    const rowButtons = Array.from(root.querySelectorAll('.sg-row'));
    const countNode = root.querySelector('.sg-count');
    const promptNode = root.querySelector('.sg-prompt');
    const feedbackNode = root.querySelector('.sg-feedback');
    const bestNode = root.querySelector('.sg-best');

    let sequence = [], level = [], kind = 'first', deckCells = [];
    let index = 0, rows = [], mistakes = 0, startedAt = null, finishedAt = null, feedback = '';
    let memoryBest = null, flashTimer = 0, hintTimer = 0;

    function readBest() {
      try {
        const value = Number(win.sessionStorage.getItem(BEST_KEY));
        if (Number.isFinite(value) && value > 0) return value;
      } catch (_) { /* Storage can be unavailable; the in-memory best still works. */ }
      return memoryBest;
    }
    function writeBest(ms) {
      memoryBest = ms;
      try { win.sessionStorage.setItem(BEST_KEY, String(Math.round(ms))); }
      catch (_) { /* Keep the in-memory best. */ }
    }

    function report(complete) {
      try {
        root.dispatchEvent(new win.CustomEvent('quasiplanar-sorting-progress', {
          bubbles: true,
          detail: {kind, length: sequence.length, complete, mistakes,
            elapsedMs: complete && startedAt !== null ? finishedAt - startedAt : 0}
        }));
      } catch (_) { /* Reporting is optional. */ }
    }

    // An arrow runs from the integer at position p to its successor at position q.
    // Offsets keep it clear of the digits and of the circle around the last integer.
    function arrowHTML(p, q, toHead) {
      const column = 100 / sequence.length;
      const cap = (column * 0.38).toFixed(4) + '%';
      const half = value => (String(Math.abs(value)).length * 0.25 + (value < 0 ? 0.4 : 0)).toFixed(2) + 'em';
      const start = 'min(calc(' + half(sequence[p]) + ' + 5px), ' + cap + ')';
      const end = toHead ? 'calc(min(.75em, ' + cap + ') + 3px)' : 'min(calc(' + half(sequence[q]) + ' + 5px), ' + cap + ')';
      const left = 'calc(' + ((p + 0.5) * column).toFixed(4) + '% + ' + start + ')';
      const width = 'max(0px, calc(' + ((q - p) * column).toFixed(4) + '% - ' + start + ' - ' + end + '))';
      return '<span class="sg-arrow" style="left:' + left + ';width:' + width + '"></span>';
    }

    function trackHTML(r) {
      const positions = rows[r];
      let cells = '', arrows = '';
      positions.forEach((p, k) => {
        const head = k === positions.length - 1;
        cells += '<span class="sg-cell" style="grid-column:' + (p + 2) + '"><span class="sg-num' + (head ? ' sg-head' : '') +
          '" data-pos="' + p + '">' + num(sequence[p]) + '</span></span>';
        if (k) arrows += arrowHTML(positions[k - 1], p, head);
      });
      return '<span class="sg-row-name" aria-hidden="true">' + rowName(r) + '</span>' +
        '<span class="sg-arrows" aria-hidden="true">' + arrows + '</span>' + cells;
    }

    function update() {
      const n = sequence.length, complete = index >= n, current = complete ? null : sequence[index];
      deckCells.forEach((cell, p) => {
        const state = p < index ? 'placed' : p === index ? 'current' : 'waiting';
        cell.setAttribute('data-state', state);
        if (state === 'current') cell.setAttribute('aria-current', 'step');
        else cell.removeAttribute('aria-current');
      });
      rowButtons.forEach((button, r) => {
        button.querySelector('.sg-track').innerHTML = trackHTML(r);
        const name = 'L' + (r + 1), values = rows[r].map(p => sequence[p]).join(', ');
        button.setAttribute('aria-label', complete
          ? 'Chain ' + name + ': ' + (values || 'empty')
          : 'Put ' + current + ' into chain ' + name + ' (' + (values ? 'currently ' + values : 'empty') + ')');
        if (complete) button.setAttribute('aria-disabled', 'true');
        else button.removeAttribute('aria-disabled');
      });
      countNode.textContent = (complete ? 'All ' + n + ' placed' : 'Integer ' + (index + 1) + ' of ' + n) + ' · ' + plural(mistakes, 'mistake');
      promptNode.innerHTML = complete
        ? 'Sorted: ' + plural(n, 'integer') + ', ' + plural(mistakes, 'mistake') + ', ' + clock(finishedAt - startedAt) + '.'
        : 'Where does ' + num(current) + ' go?';
      feedbackNode.innerHTML = feedback;
      const best = readBest();
      bestNode.textContent = best ? 'Best clean run: ' + clock(best) : '';
    }

    function explain(r, j, a) {
      const value = num(a);
      if (r < j) {
        const above = rows[j - 1];
        return 'Not quite. The chain ' + rowName(j - 1) + ' ends with ' + num(sequence[above[above.length - 1]]) +
          ', which is larger than ' + value + '.';
      }
      if (j === 0) return 'Not quite. No chain ends with an integer larger than ' + value + ', so ' + value + ' goes in ' + rowName(0) + '.';
      return 'Not quite. The lowest chain ending with an integer larger than ' + value + ' is ' + rowName(j - 1) +
        ', so ' + value + ' goes in ' + rowName(j) + '.';
    }

    function clearMarks() {
      win.clearTimeout(flashTimer);
      win.clearTimeout(hintTimer);
      rowButtons.forEach(button => button.classList.remove('sg-wrong'));
      root.querySelectorAll('.sg-hint').forEach(node => node.classList.remove('sg-hint'));
    }

    function flash(r) {
      const button = rowButtons[r];
      win.clearTimeout(flashTimer);
      rowButtons.forEach(other => other.classList.remove('sg-wrong'));
      void button.offsetWidth; // Restart the cue when the same row is chosen twice.
      button.classList.add('sg-wrong');
      flashTimer = win.setTimeout(() => button.classList.remove('sg-wrong'), FLASH_MS);
    }

    function hint(r) {
      const positions = rows[r];
      const node = rowButtons[r].querySelector('.sg-num[data-pos="' + positions[positions.length - 1] + '"]');
      if (!node) return;
      node.classList.add('sg-hint');
      win.clearTimeout(hintTimer);
      hintTimer = win.setTimeout(() => node.classList.remove('sg-hint'), HINT_MS);
    }

    function finish() {
      finishedAt = Date.now();
      if (mistakes === 0) {
        const elapsed = finishedAt - startedAt, best = readBest();
        if (best === null || elapsed < best) writeBest(Math.max(1, elapsed));
      }
    }

    // r is the 0-based row index. Returns null when nothing can be placed.
    function choose(r) {
      if (index >= sequence.length || !Number.isInteger(r) || r < 0 || r >= ROWS) return null;
      const firstAttempt = startedAt === null;
      if (firstAttempt) startedAt = Date.now();
      const a = sequence[index], j = level[index] - 1;
      clearMarks();
      if (r === j) {
        rows[j].push(index);
        index++;
        feedback = '';
        if (index === sequence.length) finish();
        update();
        if (firstAttempt || index === sequence.length) report(index === sequence.length);
        return {accepted: true, row: r + 1, correctRow: j + 1};
      }
      mistakes++;
      feedback = explain(r, j, a);
      update();
      flash(r);
      if (r < j) hint(j - 1);
      if (firstAttempt) report(false);
      return {accepted: false, row: r + 1, correctRow: j + 1};
    }

    function state() {
      const complete = index >= sequence.length;
      return {
        sequence: sequence.slice(),
        levels: level.slice(),
        kind,
        index,
        current: complete ? null : sequence[index],
        correctRow: complete ? null : level[index],
        rows: rows.map(row => row.map(p => sequence[p])),
        mistakes,
        complete,
        elapsedMs: startedAt === null ? 0 : (finishedAt ?? Date.now()) - startedAt,
        bestCleanMs: readBest()
      };
    }

    function reset() {
      clearMarks();
      index = 0;
      rows = Array.from({length: ROWS}, () => []);
      mistakes = 0;
      startedAt = null;
      finishedAt = null;
      feedback = '';
      update();
      return state();
    }

    function deal(input) {
      if (input === undefined || input === null) {
        sequence = randomSequence(random);
        kind = 'random';
      } else {
        sequence = normalise(input);
        kind = sequence.length === FIRST_DEAL.length && sequence.every((v, i) => v === FIRST_DEAL[i]) ? 'first' : 'custom';
      }
      level = levels(sequence);
      root.style.setProperty('--sg-n', String(sequence.length));
      deck.innerHTML = sequence.map((value, p) =>
        '<li class="sg-cell" style="grid-column:' + (p + 2) + '"><span class="sg-num">' + num(value) + '</span></li>').join('');
      deckCells = Array.from(deck.children);
      return reset();
    }

    root.addEventListener('click', event => {
      const target = event.target instanceof win.Element ? event.target : null;
      const row = target && target.closest('.sg-row');
      if (row && root.contains(row)) {
        if (row.getAttribute('aria-disabled') !== 'true') choose(Number(row.getAttribute('data-row')));
        return;
      }
      const action = target && target.closest('[data-action]');
      if (!action || !root.contains(action)) return;
      if (action.getAttribute('data-action') === 'restart') reset();
      else if (action.getAttribute('data-action') === 'new') deal();
    });

    root.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!/^[1-3]$/.test(event.key)) return;
      const target = event.target instanceof win.Element ? event.target : null;
      if (target && (target.isContentEditable || target.closest('input,textarea,select'))) return;
      event.preventDefault();
      if (!event.repeat) choose(Number(event.key) - 1);
    });

    const controller = {
      reset,
      deal,
      state,
      place: j => choose(Number(j) - 1)
    };
    mounted.set(root, controller);
    deal(options.sequence ?? FIRST_DEAL);
    return controller;
  }

  host.QuasiplanarSortingGame = {mount, levels, longestDecreasing, randomSequence, FIRST_DEAL};

  if (typeof document !== 'undefined') {
    const autoMount = () => {
      const root = document.getElementById('sorting-game');
      if (root) mount(root);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, {once: true});
    else autoMount();
  }
})();
