/* Practice the canonical greedy decomposition without changing the article. */
(() => {
  'use strict';
  const EXAMPLE = Object.freeze([3, 1, 4, 2, 5]);
  const CHALLENGE = Object.freeze([4, 2, 1, 7, 5, 3, 9, 8, 6, 10]);
  const STORAGE_KEY = 'quasiplanar-decomposition-game-v1';
  const mounted = new WeakMap();

  function createRun(input) {
    if (!Array.isArray(input) || !input.length || Array.from(input).some(n => !Number.isInteger(n)) || new Set(input).size !== input.length)
      throw new TypeError('Use a sequence of distinct integers.');
    const sequence = input.slice();
    let index = 0, chains = [], history = [];
    const heads = () => chains.map(row => row[row.length - 1]);
    function expectedRow() {
      if (index === sequence.length) return null;
      let row = chains.length, largest = -Infinity;
      heads().forEach((head, i) => {
        if (head < sequence[index] && head > largest) { largest = head; row = i; }
      });
      return row;
    }
    function getState() {
      return {sequence: sequence.slice(), index, chains: chains.map(row => row.slice()), heads: heads(),
        positions: chains.map(row => row.map(value => sequence.indexOf(value))),
        next: sequence[index] ?? null, expectedRow: expectedRow(), complete: index === sequence.length, canUndo: history.length > 0};
    }
    function place(row) {
      const value = sequence[index], expected = expectedRow(), before = heads();
      if (expected === null) return {accepted: false, kind: 'complete'};
      if (!Number.isInteger(row) || row < 0 || row > chains.length) return {accepted: false, kind: 'unavailable'};
      if (row !== expected) return {accepted: false,
        kind: row === chains.length ? 'new-too-soon' : before[row] < value ? 'eligible-not-largest' : 'not-increasing',
        value, chosenHead: before[row], expectedHead: before[expected], expected};
      history.push({index, chains: chains.map(chain => chain.slice())});
      const started = row === chains.length;
      if (started) chains.push([]);
      chains[row].push(value); index++;
      return {accepted: true, value, row, started, previousHead: before[row], eligibleHeads: before.filter(head => head < value)};
    }
    function undo() {
      const previous = history.pop();
      if (!previous) return false;
      index = previous.index; chains = previous.chains.map(row => row.slice()); return true;
    }
    function reset() { index = 0; chains = []; history = []; }
    return {getState, place, undo, reset};
  }

  function mount(root) {
    if (!root) throw new TypeError('A game container is required.');
    if (mounted.has(root)) return mounted.get(root);
    const doc = root.ownerDocument, win = doc.defaultView;
    const math = source => win.QuasiplanarDiagramMath?.html(String(source)) ?? String(source);
    const rowName = row => math('L_{' + (row + 1) + '}');
    let mode = 'example', run = createRun(EXAMPLE), feedback = '', wrongRow = null, disposed = false;
    try {
      const saved = JSON.parse(win.sessionStorage.getItem(STORAGE_KEY));
      const sequence = saved?.mode === 'example' ? EXAMPLE : saved?.mode === 'challenge' ? CHALLENGE : null;
      if (saved?.version === 1 && sequence && Number.isInteger(saved.index) && saved.index >= 0 && saved.index <= sequence.length &&
          Array.isArray(saved.sequence) && saved.sequence.length === sequence.length && saved.sequence.every((value, i) => value === sequence[i])) {
        mode = saved.mode; run = createRun(sequence);
        for (let i = 0; i < saved.index; i++) run.place(run.getState().expectedRow);
      }
    } catch (_) { /* The exercise remains usable if this tab cannot store progress. */ }
    function saveProgress() {
      const state = run.getState();
      try { win.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, mode, index: state.index, sequence: state.sequence})); }
      catch (_) { /* In-memory progress remains intact. No author draft storage is used. */ }
    }
    root.dataset.noEdit = ''; root.classList.add('decomposition-game');
    root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Practice the increasing-chain decomposition');
    const board = doc.createElement('div'), feedbackNode = doc.createElement('p'), actions = doc.createElement('div');
    feedbackNode.className = 'dg-feedback'; feedbackNode.setAttribute('role', 'status');
    feedbackNode.setAttribute('aria-live', 'polite'); feedbackNode.setAttribute('aria-atomic', 'true');
    actions.className = 'dg-actions'; root.replaceChildren(board, feedbackNode, actions);

    function acceptedMessage(move) {
      if (move.started) return move.row === 0 ? `Start ${rowName(0)} with ${math(move.value)}.`
        : `No head is smaller than ${math(move.value)}, so start ${rowName(move.row)}.`;
      if (move.eligibleHeads.length > 1)
        return `The eligible heads were ${math(move.eligibleHeads.join(','))}. The largest was ${math(move.previousHead)}, so ${math(move.value)} extends ${rowName(move.row)}.`;
      return `${math(move.value)} follows ${math(move.previousHead)}, the largest head smaller than it.`;
    }
    function rejectedMessage(move) {
      if (move.kind === 'eligible-not-largest') return `Your row would remain increasing. The greedy rule chooses the largest eligible head, ${math(move.expectedHead)}; try that row.`;
      if (move.kind === 'new-too-soon') return `An existing head is smaller than ${math(move.value)}. Use the largest one, ${math(move.expectedHead)}, before opening a new row.`;
      if (move.kind === 'not-increasing') return move.expectedHead === undefined
        ? `${math(move.chosenHead)} is larger than ${math(move.value)}, and no current head is smaller. Start a new row.`
        : `${math(move.chosenHead)} is larger than ${math(move.value)}, so this row would decrease. Find the largest head smaller than ${math(move.value)}.`;
      return 'Choose one of the rows or start a new row.';
    }
    function render() {
      if (disposed) return;
      const state = run.getState(), focused = root.contains(doc.activeElement) ? doc.activeElement.closest('button') : null;
      const focusAction = focused?.dataset.action, focusRow = focused?.dataset.row;
      const sequence = state.sequence.map((value, i) => `<li class="dg-token" data-position="${i}" data-state="${i < state.index ? 'placed' : i === state.index ? 'next' : 'waiting'}"${i === state.index ? ' aria-current="step"' : ''}>${math(value)}</li>`).join('');
      const rows = state.chains.map((chain, i) => {
        const head = chain[chain.length - 1], interactive = mode === 'challenge' && !state.complete;
        const content = `<span class="dg-row-name">${rowName(i)}</span><span class="dg-row-values">` + chain.map((value, j) => `<span class="dg-token${j === chain.length - 1 ? ' dg-head' : ''}" data-original-position="${state.positions[i][j]}"${j === chain.length - 1 ? ' title="Current head"' : ''}>${math(value)}</span>`).join('') + '</span>';
        return interactive ? `<button type="button" class="dg-row${wrongRow === i ? ' dg-row-attempt' : ''}" data-row="${i}" aria-label="Row ${i + 1}: ${chain.join(', ')}. Head ${head}. Place ${state.next} here.">${content}</button>`
          : `<div class="dg-row dg-example-row">${content}</div>`;
      }).join('');
      let message = feedback;
      if (!message && !state.complete) message = `${state.index ? 'Continue' : 'Begin'} with ${math(state.next)} and read from left to right.`;
      if (state.complete) message = mode === 'example'
        ? `Five integers now lie in two increasing chains. Try the article’s sequence and choose each row yourself.`
        : `The ten integers form three increasing chains. Their heads are ${math(state.heads.join(','))}.`;
      const primary = mode === 'example' ? state.complete
        ? '<button type="button" class="dg-primary" data-action="challenge">Try the ten integers</button>'
        : `<button type="button" class="dg-primary" data-action="next" aria-label="Place ${state.next} using the greedy rule">Place ${math(state.next)}</button>` : '';
      board.innerHTML = `<div class="dg-topline"><p class="dg-mode">${mode === 'example' ? 'Follow five integers' : 'Choose the rows yourself'}</p><p class="dg-progress">${math(state.index)} of ${math(state.sequence.length)} placed</p></div>` +
        `<ol class="dg-sequence" aria-label="The original sequence, in its original order">${sequence}</ol>` +
        `<div class="dg-rows">${rows || '<p class="dg-empty">No rows have been started.</p>'}</div>` +
        (mode === 'challenge' && !state.complete ? `<button type="button" class="dg-new-row${wrongRow === state.chains.length ? ' dg-row-attempt' : ''}" data-action="new">Start a new row</button>` : '');
      feedbackNode.className = 'dg-feedback' + (wrongRow !== null ? ' dg-feedback-error' : '');
      feedbackNode.innerHTML = message;
      actions.innerHTML = `${primary}<button type="button" data-action="undo"${state.canUndo ? '' : ' disabled'}>Undo the last placement</button><button type="button" data-action="restart">${mode === 'example' ? 'Restart the example' : 'Start this sequence again'}</button>`;
      if (focused) {
        const target = focusRow !== undefined ? root.querySelector(`[data-row="${focusRow}"]`)
          : focusAction ? root.querySelector(`[data-action="${focusAction}"]`) : null;
        (target && !target.disabled ? target : root.querySelector('.dg-primary') || root.querySelector('[data-action="undo"]'))?.focus({preventScroll: true});
      }
    }
    function reportProgress() {
      root.dispatchEvent(new win.CustomEvent('quasiplanar-decomposition-progress', {
        bubbles: true,
        detail: {stage: mode, complete: run.getState().complete}
      }));
    }
    function choose(row) {
      if (disposed || mode !== 'challenge') return false;
      const move = run.place(row);
      if (move.kind === 'complete') return false;
      wrongRow = move.accepted ? null : row; feedback = move.accepted ? acceptedMessage(move) : rejectedMessage(move);
      if (move.accepted) { saveProgress(); reportProgress(); }
      render(); return move.accepted;
    }
    function next() {
      if (disposed || mode !== 'example' || run.getState().complete) return false;
      const move = run.place(run.getState().expectedRow); wrongRow = null; feedback = acceptedMessage(move);
      saveProgress(); reportProgress(); render(); return true;
    }
    function startChallenge() {
      if (disposed || mode !== 'example' || !run.getState().complete) return false;
      mode = 'challenge'; run = createRun(CHALLENGE); feedback = ''; wrongRow = null;
      saveProgress(); reportProgress(); render(); return true;
    }
    function undo() { if (disposed || !run.undo()) return false; feedback = 'The last placement has been undone.'; wrongRow = null; saveProgress(); render(); return true; }
    function restart() { if (disposed) return; run.reset(); feedback = ''; wrongRow = null; saveProgress(); render(); }
    function click(event) {
      const button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.row !== undefined) { choose(Number(button.dataset.row)); return; }
      const action = button.dataset.action;
      if (action === 'new') choose(run.getState().chains.length);
      else if (action === 'next') next();
      else if (action === 'challenge') startChallenge();
      else if (action === 'undo') undo();
      else if (action === 'restart') restart();
    }
    root.addEventListener('click', click);
    const controller = {getState: () => ({mode, ...run.getState()}), choose, next, startChallenge, undo, restart,
      destroy() { if (disposed) return; disposed = true; root.removeEventListener('click', click); root.replaceChildren(); mounted.delete(root); }};
    mounted.set(root, controller); render(); return controller;
  }

  window.QuasiplanarDecompositionGame = {createRun, mount, example: EXAMPLE, challenge: CHALLENGE, storageKey: STORAGE_KEY};
  const root = document.getElementById('decomposition-game');
  if (root) mount(root);
})();
