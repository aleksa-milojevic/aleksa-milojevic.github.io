/*!
 * heads-lab.js — "missing heads" lab for the paired greedy argument
 * (heads interpretation of paper-2026-11-05/proofs/lemma-3-2-run/final-body.tex).
 *
 *   X = 4 2 1 7 5 3 9 8 6 10   position = reading order, size = the integer
 *   S = the integers of X that are at most 6, i.e. 4 2 1 5 3 6 in the same order
 *
 * The full run applies greedy to X in its natural order; the kept-only run applies
 * greedy to S alone. Greedy appends an integer to the chain whose head (last
 * integer) is the largest head below it, and opens a new chain if there is none.
 *
 * API
 *   const lab = window.QuasiplanarHeads.mount(rootOrSelector, { timeline: true, step: 0 });
 *   lab.next(); lab.prev(); lab.restart(); lab.go(n);
 *   lab.step (current step, 0..10); lab.steps (10); lab.snapshot(); lab.destroy();
 *   window.QuasiplanarHeads.simulate() -> 11 frozen snapshots (steps 0..10)
 *
 * Styling lives in heads-lab.css; every class is prefixed "hdl-".
 */
(function (global) {
  'use strict';

  const X = Object.freeze([4, 2, 1, 7, 5, 3, 9, 8, 6, 10]);
  const CUT = 6;                      // S = integers of X that are at most CUT
  const K = 4;                        // no 4 integers of X decrease, so each run has at most K - 1 = 3 chains
  const ROWS = K - 1;
  const LAST = X.length;
  const BUDGET = (K - 1) * (K - 1);   // at most 3 removals, each raising Phi by at most 3
  const DIGITS = '₀₁₂₃₄₅₆₇₈₉';

  const inS = (v) => v <= CUT;
  const last = (a) => a[a.length - 1];
  const sub = (n) => String(n).replace(/\d/g, (d) => DIGITS[Number(d)]);
  const Cj = (j) => 'C' + sub(j);
  const posOf = (v) => X.indexOf(v) + 1;
  const list = (a) => a.join(', ');
  const setText = (a) => (a.length ? '{' + a.join(', ') + '}' : '∅');
  const signed = (d) => (d > 0 ? '+' + d : d < 0 ? '−' + -d : '0');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const math = (tex, fallback = tex) => global.QuasiplanarDiagramMath
    ? global.QuasiplanarDiagramMath.html(String(tex))
    : esc(fallback);
  // Keep the narration unchanged while rendering its mathematical tokens.
  const mathText = (value) => {
    const source = String(value), tokens = /F = F′ = ∅|F′ ⊆ F|F′ = \{[\d, ]+\}|Φ = \d+(?: ≥ \d+)?|C[₀₁₂₃₄₅₆₇₈₉]+|[−-]?\d+(?:\s*[−+×=<>≤≥→]\s*[−-]?\d+)+|[≤≥<>]\s*\d+|[−-]?\d+|F′|\b[FSX]\b|[Φφψγ∅∈⊆×→]/g;
    let html = '', offset = 0;
    for (const match of source.matchAll(tokens)) {
      let tex = match[0].replace(/C([₀₁₂₃₄₅₆₇₈₉]+)/g, (_, digits) => 'C_{' + [...digits].map(d => DIGITS.indexOf(d)).join('') + '}');
      const symbols = { '′': "'", 'Φ': '\\Phi ', 'φ': '\\varphi ', 'ψ': '\\psi ', 'γ': '\\gamma ', '∅': '\\varnothing ', '⊆': '\\subseteq ', '∈': '\\in ', '≤': '\\le ', '≥': '\\ge ', '−': '-', '×': '\\times ', '→': '\\to ' };
      tex = tex.replace(/[′Φφψγ∅⊆∈≤≥−×→]/g, symbol => symbols[symbol]).replace(/([{}])/g, '\\$1');
      // Braces inserted for a chain subscript are syntax, rather than a set.
      tex = tex.replace(/C_\\\{(\d+)\\\}/g, 'C_{$1}');
      html += esc(source.slice(offset, match.index)) + math(tex, match[0]);
      offset = match.index + match[0].length;
    }
    return html + esc(source.slice(offset));
  };
  const sequenceMath = (values) => math(values.join('\\ '), values.join(' '));
  const chainMath = (j) => math('C_{' + j + '}', Cj(j));
  const svgMath = (x, y, tex, attrs, fallback = tex) => global.QuasiplanarDiagramMath
    ? global.QuasiplanarDiagramMath.svgLabel(x, y, String(tex), attrs)
    : '<text x="' + x + '" y="' + y + '" ' + attrs + '>' + esc(fallback) + '</text>';

  /** Index of the chain whose head is the largest head below v, or -1. */
  function pick(heads, v) {
    let best = -1;
    for (let i = 0; i < heads.length; i += 1) {
      if (heads[i] < v && (best < 0 || heads[i] > heads[best])) best = i;
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* The paired algorithm                                                */
  /* ------------------------------------------------------------------ */

  function simulate() {
    const full = [];          // chains of the full run (all of X)
    const kept = [];          // chains of the kept-only run (S only)
    const closedBy = {};      // full-chain number -> { by, step } (first integer above 6 on it)
    const missingWhy = {};    // integer -> why it left F' while staying in F
    const disagree = [];      // kept integers with different predecessors in the two runs
    const lostLinks = [];     // kept-only links phi -> gamma that the full run does not have
    const ledger = [];        // every change of Phi
    const snaps = [];
    let removals = 0;
    let up = 0;
    let down = 0;

    const headsOf = (chains) => chains.map(last);

    function sets() {
      const F = headsOf(kept);
      const Fp = headsOf(full).filter(inS);
      const missing = [];
      F.forEach((h, idx) => {
        if (!Fp.includes(h)) missing.push({ value: h, chain: idx + 1, weight: K - (idx + 1) });
      });
      return {
        F,
        Fp,
        missing,
        phi: missing.reduce((s, m) => s + m.weight, 0),
        subset: Fp.every((h) => F.includes(h)),
      };
    }

    function record(step, ev) {
      const s = sets();
      snaps.push(Object.freeze({
        step,
        processed: X.slice(0, step),
        keptSeen: X.slice(0, step).filter(inS),
        full: full.map((c) => c.slice()),
        kept: kept.map((c) => c.slice()),
        F: s.F,
        Fp: s.Fp,
        missing: s.missing,
        phi: s.phi,
        subset: s.subset,
        removals,
        up,
        down,
        disagree: disagree.slice(),
        lostLinks: lostLinks.map((l) => l.slice()),
        ledger: ledger.slice(),
        closedBy: Object.assign({}, closedBy),
        event: ev ? Object.freeze(ev) : null,
      }));
    }

    record(0, null);

    X.forEach((v, idx) => {
      const step = idx + 1;
      const before = sets();
      const fullHeads = headsOf(full);
      const keptHeads = headsOf(kept);
      const t = pick(fullHeads, v);
      const ev = {
        step,
        value: v,
        kept: inS(v),
        fullChain: t >= 0 ? t + 1 : full.length + 1,
        fullHeads,
        keptHeads,
        Fp: before.Fp,
      };

      if (inS(v)) {
        const i = pick(keptHeads, v);
        ev.keptChain = i >= 0 ? i + 1 : kept.length + 1;
        if (i < 0) {
          ev.kind = 'new';
        } else {
          ev.varphi = keptHeads[i];
          if (before.Fp.includes(ev.varphi)) {
            ev.kind = 'agree';
          } else {
            ev.why = missingWhy[ev.varphi];
            if (t < 0) {
              ev.kind = 'split';
            } else {
              ev.kind = 'move';
              ev.psi = fullHeads[t];
              ev.psiChain = keptHeads.indexOf(ev.psi) + 1;
            }
          }
        }
        if (i < 0) kept.push([v]); else kept[i].push(v);
        if (t < 0) full.push([v]); else full[t].push(v);
        if (ev.kind === 'move') missingWhy[ev.psi] = { kind: 'link', by: v, step };
        if (ev.kind === 'move' || ev.kind === 'split') {
          disagree.push(v);
          lostLinks.push([ev.varphi, v]);
          ev.count = disagree.length;
        }
      } else if (t < 0) {
        ev.kind = 'outside-new';
        full.push([v]);
        closedBy[full.length] = { by: v, step };
      } else {
        ev.onto = fullHeads[t];
        if (inS(ev.onto)) {
          ev.kind = 'removal';
          ev.removedChain = keptHeads.indexOf(ev.onto) + 1;
          removals += 1;
          ev.count = removals;
          missingWhy[ev.onto] = { kind: 'removal', by: v, step };
          closedBy[t + 1] = { by: v, step };
        } else {
          ev.kind = 'closed';
          ev.closed = closedBy[t + 1];
        }
        full[t].push(v);
      }

      const after = sets();
      ev.phiBefore = before.phi;
      ev.phiAfter = after.phi;
      ev.delta = after.phi - before.phi;
      if (ev.delta > 0) up += ev.delta;
      if (ev.delta < 0) down -= ev.delta;
      if (ev.delta !== 0 || ev.kind === 'removal' || ev.kind === 'move' || ev.kind === 'split') {
        ledger.push(Object.freeze({
          step,
          value: v,
          kind: ev.kind,
          delta: ev.delta,
          varphi: ev.varphi,
          psi: ev.psi,
          onto: ev.onto,
          chain: ev.removedChain,
        }));
      }
      record(step, ev);
    });

    return snaps;
  }

  /* ------------------------------------------------------------------ */
  /* Prose                                                               */
  /* ------------------------------------------------------------------ */

  function whyText(why) {
    if (!why) return 'the full run no longer ends a chain with it';
    return why.kind === 'removal'
      ? `at step ${why.step} the full run capped it with the outside integer ${why.by}`
      : `at step ${why.step} the full run already gave it the successor ${why.by}`;
  }

  function stepLabel(sn) {
    return sn.event ? `Step ${sn.step} of ${LAST} · ${sn.event.value}` : `Step 0 of ${LAST} · start`;
  }

  function describe(sn) {
    const ev = sn.event;
    if (!ev) {
      return 'Nothing has been processed yet. Both runs start with no chains, so F = F′ = ∅ and Φ = 0. ' +
        `Next reads X from left to right; the kept-only run will see only the kept integers ${list(X.filter(inS))}.`;
    }
    const v = ev.value;
    let text = '';
    switch (ev.kind) {
      case 'new':
        text = `${v} is kept (≤ 6), and no head of the kept-only run lies below it ` +
          `(${ev.keptHeads.length ? 'heads ' + list(ev.keptHeads) : 'there are no heads yet'}). ` +
          `Because F′ ⊆ F and any closed head exceeds 6, no head of the full run lies below ${v} either, ` +
          `so both runs open a new chain: ${Cj(ev.keptChain)} in the kept-only run and full chain ${ev.fullChain}. ` +
          `${v} enters F and F′ together, and Φ stays ${ev.phiAfter}.`;
        break;
      case 'agree':
        text = `${v} is kept. The largest head of the kept-only run below ${v} is ${ev.varphi}, the head of ${Cj(ev.keptChain)}, ` +
          `and ${ev.varphi} is still a head of the full run (it lies in F′). Because F′ ⊆ F, it is also the largest element of F′ below ${v}, ` +
          `so both runs append ${v} to ${ev.varphi}: same predecessor, and Φ stays ${ev.phiAfter}.`;
        break;
      case 'move': {
        const i = ev.keptChain;
        const j = ev.psiChain;
        text = `${v} is kept. The kept-only run appends it to ${ev.varphi}, the largest head below ${v} (head of ${Cj(i)}). ` +
          `But ${ev.varphi} is a missing head: ${whyText(ev.why)}. ` +
          `So the full run appends ${v} to ${ev.psi} instead, the largest element of F′ = ${setText(ev.Fp)} below ${v}; ` +
          `${ev.psi} < ${ev.varphi}, and ${ev.psi} is the head of ${Cj(j)}. ` +
          `Predecessor disagreement ${ev.count}: ${ev.varphi} in the kept-only run, ${ev.psi} in the full run, ` +
          `so the kept-only link ${ev.varphi} → ${v} is lost in the full run. ` +
          `${Cj(i)} now ends in ${v} ∈ F′, so its weight ${K - i} leaves Φ; ${ev.psi} stays the head of ${Cj(j)} ` +
          `but is no longer a full-run head, so it becomes missing and its weight ${K - j} enters. ` +
          `Φ goes from ${ev.phiBefore} to ${ev.phiAfter}, a change of ${i} − ${j} = ${signed(i - j)}.`;
        break;
      }
      case 'split': {
        const i = ev.keptChain;
        text = `${v} is kept. The kept-only run appends it to ${ev.varphi} (head of ${Cj(i)}), but ${ev.varphi} is a missing head: ` +
          `${whyText(ev.why)}. No element of F′ = ${setText(ev.Fp)} lies below ${v}, so the full run opens full chain ${ev.fullChain}. ` +
          `Predecessor disagreement ${ev.count}: ${ev.varphi} in the kept-only run, none in the full run, so the kept-only link ` +
          `${ev.varphi} → ${v} is lost. ${Cj(i)} now ends in ${v} ∈ F′, so Φ drops by ${K} − ${i} = ${K - i}, ` +
          `from ${ev.phiBefore} to ${ev.phiAfter}.`;
        break;
      }
      case 'removal':
        text = `${v} is outside S (> 6), so only the full run sees it. The largest full-run head below ${v} ` +
          `(heads ${list(ev.fullHeads)}) is the kept integer ${ev.onto}, so ${v} is appended to ${ev.onto}: ` +
          `full chain ${ev.fullChain} now ends above 6 and is closed to S for good, because every kept integer is smaller than ${v} ` +
          `and a head only grows. This is removal ${ev.count}: ${ev.onto} leaves F′ but is still the head of ${Cj(ev.removedChain)} ` +
          `in the kept-only run, so it becomes a missing head and Φ rises by ${K} − ${ev.removedChain} = ${ev.delta}, ` +
          `from ${ev.phiBefore} to ${ev.phiAfter}. No removal can raise Φ by more than ${K - 1}.`;
        break;
      case 'closed':
        text = `${v} is outside S. The largest full-run head below ${v} (heads ${list(ev.fullHeads)}) is ${ev.onto}, ` +
          `which is already outside S, so ${v} extends full chain ${ev.fullChain}, closed to S since ${ev.closed.by} ` +
          `arrived at step ${ev.closed.step}. F′ does not change, so there is no removal and Φ stays ${ev.phiAfter}. ` +
          `Each full chain is closed only once and the full run has at most ${K - 1} chains, so there are at most ${K - 1} removals.`;
        break;
      case 'outside-new':
        text = `${v} is outside S and no full-run head lies below it, so the full run opens full chain ${ev.fullChain}, ` +
          `closed to S from the start. F′ does not change, and Φ stays ${ev.phiAfter}.`;
        break;
      default:
        text = '';
    }
    if (sn.step === LAST) {
      const d = sn.disagree.length;
      text += ` That was the last integer. ${plural(sn.removals, 'removal', 'removals')} raised Φ by ${sn.up} in total ` +
        `(${K - 1} removals × ${K - 1} = ${BUDGET} is the most possible); ${plural(d, 'predecessor disagreement', 'predecessor disagreements')} ` +
        `lowered it by ${sn.down}, leaving Φ = ${sn.phi} ≥ 0. ` +
        (d ? `The disagreements locate the lost kept-only links ${list(sn.lostLinks.map((l) => l[0] + ' → ' + l[1]))}.` : '');
    }
    return text;
  }

  /* ------------------------------------------------------------------ */
  /* Markup                                                              */
  /* ------------------------------------------------------------------ */

  function notesHTML() {
    return `
<div class="hdl-notes">
  <section>
    <h4>Why there are at most ${math(9)} predecessor disagreements</h4>
    <p>The inclusion ${math("F' \\subseteq F", 'F′ ⊆ F')} holds at every step. A kept integer ${math('\\gamma', 'γ')} gets different predecessors in the two runs
    exactly when its kept-only predecessor ${math('\\varphi', 'φ')} is a missing head, ${math("\\varphi \\in F \\setminus F'", 'φ ∈ F ∖ F′')}, at that moment. The full run then appends ${math('\\gamma', 'γ')} to
    the largest ${math("\\psi \\in F'", 'ψ ∈ F′')} below ${math('\\gamma', 'γ')}. Since ${math('\\psi < \\varphi', 'ψ < φ')}, ${math('\\psi', 'ψ')} is the head of a later chain ${chainMath('j')} with ${math('j > i')}. If there is no such ${math('\\psi', 'ψ')},
    the full run opens a new chain.</p>
    <p>${math('\\Phi', 'Φ')} adds the weight ${math('4 - j', '4 − j')} for every chain ${chainMath('j')} of the kept-only run whose head is missing, so the weights are ${math('3, 2, 1')}.
    A removal raises ${math('\\Phi', 'Φ')} by at most ${math(3)}. A predecessor disagreement changes ${math('\\Phi', 'Φ')} by ${math('i - j \\le -1', 'i − j ≤ −1')}, or by ${math('-(4 - i)', '−(4 − i)')} when the full run
    opens a new chain, so it lowers ${math('\\Phi', 'Φ')} by at least ${math(1)}. Each full chain is closed to ${math('S')} at most once and the full run has at most
    ${math(3)} chains, so there are at most ${math(3)} removals and ${math('\\Phi', 'Φ')} rises by at most ${math(9)} in total. Since ${math('\\Phi \\ge 0', 'Φ ≥ 0')}, there are at most
    ${math(9)} predecessor disagreements. For general ${math('k')} the same bookkeeping gives at most ${math('(k - 1)^2', '(k − 1)²')}.</p>
  </section>
  <section>
    <h4>Predecessors, not successors</h4>
    <p>The count above is of predecessor disagreements. It is not a count of exact successor changes, and this argument does
    not give the sharp constant ${math('\\binom{4}{2} = 6', '(4 choose 2) = 6')}.</p>
    <p>Here is what it does give. A link ${math('\\varphi \\to \\gamma', 'φ → γ')} of the kept-only run is missing from the full run exactly when ${math('\\gamma', 'γ')} is a predecessor
    disagreement (dashed orange), so the disagreements locate every lost successor link. A kept integer whose successor
    changes is the kept-only or the full-run predecessor of some disagreement. If a successor outside ${math('S')} also counts as a change,
    it can instead be one of the at most ${math(3)} heads capped by a removal. So at most ${math('2(k - 1)^2 + (k - 1)', '2(k − 1)² + (k − 1)')} integers change
    successor. That bound is quadratic in ${math('k')}, which is all the ${math('O(k^2n)', 'O(k²n)')} count needs. The shared manuscript's Lemma 2.5 gets
    sharper four-cut constants; this lab follows the heads argument on purpose.</p>
  </section>
</div>`;
  }

  function compactDescription(sn) {
    if(!sn.event) return 'Both runs begin with no chains. Read the same sequence from left to right and watch for orange missing heads.';
    const e=sn.event,v=e.value;
    if(e.kind==='new') return `${v} is smaller than every current head, so both runs open a new chain for it.`;
    if(e.kind==='removal') return `${v} is omitted from the smaller run. In the full run it replaces head ${e.onto}, closing that chain to all integers at most 6; ${e.onto} is now a missing head.`;
    if(e.kind==='move') return `${v} is appended to ${e.varphi} in the smaller run and to ${e.psi} in the full run. The available head of full chain ${e.fullChain} moves from position ${e.psiChain} to the earlier position ${e.keptChain}.`;
    if(e.kind==='split') return `${v} follows missing head ${e.varphi} in the smaller run. The full run must start a new chain, giving one predecessor disagreement.`;
    if(e.kind==='agree') return `Both runs append ${v} to the same head ${e.varphi}. The two predecessor choices agree.`;
    if(sn.step===LAST) return `The sequence is complete. The predecessor choices disagreed at ${sn.disagree.join(', ')}; the head-position paths below record the three disagreements.`;
    return `${v} extends a full-run chain that was already closed to the smaller integers. The available heads stay the same.`;
  }

  function tracksHTML(sn) {
    const history=Array.from({length:ROWS},()=>[]);
    SNAPS.slice(0,sn.step+1).forEach(s=>s.full.forEach((chain,t)=>{
      const h=last(chain);
      if(!inS(h)) return;
      const j=s.F.indexOf(h)+1;
      if(history[t].at(-1)!==j) history[t].push(j);
    }));
    return '<p class="hdl-track-label">Positions of the available full-run heads</p>'+
      '<p class="hdl-track-help">A head’s position is the chain in the smaller run ending at that same integer.</p>'+
      history.map((positions,t)=>{
        const closed=sn.full[t]&&!inS(last(sn.full[t]));
        return '<div class="hdl-track"><span>Full chain '+math(t+1)+'</span><strong>'+
          (positions.length?math(positions.map(j => 'C_{' + j + '}').join(' \\to '), positions.map(Cj).join(' → ')):'—')+'</strong><small>'+(closed?'closed':positions.length?'available':'not opened')+'</small></div>';
      }).join('');
  }

  function shell(id, opts) {
    if(opts.compact) return `
<h3 class="hdl-sr" id="${id}-title">Two greedy runs on the same distinct-integer sequence</h3>
<div class="hdl-compact-console">
  <p class="hdl-sr" id="${id}-seqcap">Read the distinct integers from left to right. Grey integers above 6 are omitted from the smaller run.</p>
  <ol class="hdl-seq" data-ref="seq" aria-labelledby="${id}-seqcap"></ol>
  <div class="hdl-controls" role="group" aria-label="Step through the paired algorithm">
    <button type="button" class="hdl-btn" data-act="restart">Restart</button>
    <button type="button" class="hdl-btn" data-act="prev">Previous</button>
    <button type="button" class="hdl-btn hdl-btn--primary" data-act="next">Next integer →</button>
    <span class="hdl-out" data-ref="out"></span>
  </div>
  <p class="hdl-sr" data-ref="snapshot"></p>
  <p class="hdl-msg" data-ref="msg" role="status" aria-live="polite" aria-atomic="true"></p>
</div>
<div class="hdl-runs">
  <section class="hdl-run hdl-run--full" aria-labelledby="${id}-full">
    <h4 class="hdl-runtitle" id="${id}-full">Read every integer <span class="hdl-run-subtitle">Full run on ${math('X')}</span></h4>
    <ol class="hdl-rows" data-ref="full"></ol>
  </section>
  <section class="hdl-run hdl-run--kept" aria-labelledby="${id}-kept">
    <h4 class="hdl-runtitle" id="${id}-kept">Keep only integers ${math('\\le 6', '≤ 6')} <span class="hdl-run-subtitle">Smaller run on ${math(list(X.filter(inS)))}</span></h4>
    <ol class="hdl-rows" data-ref="kept"></ol>
  </section>
</div>
<div class="hdl-head-tracks" data-ref="tracks"></div>
<details class="hdl-extra"><summary>Inspect the head sets and an alternative potential</summary>
  <div class="hdl-state"><section class="hdl-box"><h4>Available and missing heads</h4><dl class="hdl-sets" data-ref="sets"></dl></section>
  <section class="hdl-box"><h4>The missing-head potential</h4><div data-ref="phi"></div><ol class="hdl-ledger" data-ref="ledger"></ol></section></div>
  <div class="hdl-plot" data-ref="plot"></div>
</details>`;
    const timeline = opts.timeline
      ? `<div class="hdl-timeline">
          <label for="${id}-range">Timeline</label>
          <input type="range" class="hdl-range" id="${id}-range" min="0" max="${LAST}" step="1" value="0" data-ref="range">
          <output class="hdl-out" for="${id}-range" data-ref="out"></output>
        </div>`
      : '<p class="hdl-out hdl-out--solo" data-ref="out"></p>';

    return `
<header class="hdl-header">
  <p class="hdl-kicker">Paired greedy runs · missing heads</p>
  <h3 class="hdl-title" id="${id}-title">What the full run hides from the kept integers</h3>
  <p class="hdl-lede">${math('X = ' + X.join('\\ '), 'X = ' + X.join(' '))} is read left to right: position is the reading order, size is the integer.
  ${math('S')} keeps the integers ${math('\\le 6', '≤ 6')} (${sequenceMath(X.filter(inS))}, in the same order). No four integers of ${math('X')} appear in decreasing order,
  so ${math('k = 4')} and each run uses at most ${math(3)} chains. Greedy appends each integer to the chain with the largest head below it,
  and opens a new chain if there is none. The <strong>full run</strong> applies greedy to all of ${math('X')}, and the
  <strong>kept-only run</strong> applies it to ${math('S')} alone. ${math('F')} is the set of heads of the kept-only run, and ${math("F'", 'F′')} is the set of
  full-run heads that lie in ${math('S')}. The <span class="hdl-ink-miss">missing heads ${math("F \\setminus F'", 'F ∖ F′')}</span> are orange.</p>
</header>

<div class="hdl-top">
  <div class="hdl-console">
    <p class="hdl-seqcap" id="${id}-seqcap">${math('X')} in position order. The integer is the size; the small number below it is the position.</p>
    <ol class="hdl-seq" data-ref="seq" aria-labelledby="${id}-seqcap"></ol>
    <div class="hdl-controls" role="group" aria-label="Step through the paired algorithm">
      <button type="button" class="hdl-btn" data-act="restart" aria-keyshortcuts="Home">Restart</button>
      <button type="button" class="hdl-btn" data-act="prev" aria-keyshortcuts="ArrowLeft">Previous</button>
      <button type="button" class="hdl-btn hdl-btn--primary" data-act="next" aria-keyshortcuts="ArrowRight">Next</button>
    </div>
    ${timeline}
    <p class="hdl-snapshot" data-ref="snapshot"></p>
    <p class="hdl-msg" data-ref="msg" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>
  <figure class="hdl-plot">
    <div class="hdl-plot-svg" data-ref="plot"></div>
    <figcaption class="hdl-legend">
      <span><i class="hdl-key hdl-key--band" aria-hidden="true"></i>${math('S')}: sizes ${math('\\le 6', '≤ 6')}</span>
      <span><i class="hdl-key hdl-key--link" aria-hidden="true"></i>full-run chains</span>
      <span><i class="hdl-key hdl-key--lost" aria-hidden="true"></i>kept-only links lost in the full run</span>
    </figcaption>
  </figure>
</div>

<div class="hdl-runs">
  <section class="hdl-run hdl-run--full" aria-labelledby="${id}-full">
    <h4 class="hdl-runtitle" id="${id}-full">Full run on ${math('X')} <span class="hdl-run-subtitle">all ten integers, in position order</span></h4>
    <ol class="hdl-rows" data-ref="full"></ol>
  </section>
  <section class="hdl-run hdl-run--kept" aria-labelledby="${id}-kept">
    <h4 class="hdl-runtitle" id="${id}-kept">Kept-only run on ${math('S')} <span class="hdl-run-subtitle">only ${sequenceMath(X.filter(inS))}; chain ${chainMath('j')} has weight ${math('4 - j', '4 − j')}</span></h4>
    <ol class="hdl-rows" data-ref="kept"></ol>
  </section>
</div>
<ul class="hdl-keys" aria-label="How to read the chain rows">
  <li><span class="hdl-chip hdl-chip--xs is-kept is-head is-inFp" aria-hidden="true">${math(3)}</span>head in ${math("F'", 'F′')}</li>
  <li><span class="hdl-chip hdl-chip--xs is-kept is-head is-miss" aria-hidden="true">${math(3)}</span>missing head (in ${math('F')}, not in ${math("F'", 'F′')})</li>
  <li><span class="hdl-chip hdl-chip--xs is-out" aria-hidden="true">${math(7)}</span>outside ${math('S')} (${math('> 6')})</li>
  <li><i class="hdl-key hdl-key--wall" aria-hidden="true"></i>full chain closed to ${math('S')}</li>
  <li><span class="hdl-chip hdl-chip--xs is-kept is-dis" aria-hidden="true">${math(5)}</span>predecessor disagreement</li>
  <li><i class="hdl-key hdl-key--lost" aria-hidden="true"></i>kept-only link lost in the full run</li>
</ul>

<div class="hdl-state">
  <section class="hdl-box" aria-labelledby="${id}-sets">
    <h4 id="${id}-sets">Heads</h4>
    <dl class="hdl-sets" data-ref="sets"></dl>
  </section>
  <section class="hdl-box" aria-labelledby="${id}-phi">
    <h4 id="${id}-phi">Potential ${math('\\Phi = \\sum (4 - j)', 'Φ = Σ (4 − j)')} over missing heads of ${chainMath('j')}</h4>
    <div data-ref="phi"></div>
    <p class="hdl-ledger-title" id="${id}-ledger">Changes of ${math('\\Phi', 'Φ')} so far</p>
    <ol class="hdl-ledger" data-ref="ledger" aria-labelledby="${id}-ledger"></ol>
  </section>
</div>
${notesHTML()}`;
  }

  function chipHTML(v, o) {
    const cls = ['hdl-chip', inS(v) ? 'is-kept' : 'is-out'];
    const sr = [];
    if (!inS(v)) sr.push('outside S');
    if (o.head) {
      cls.push('is-head', 'is-' + o.head);
      sr.push(o.head === 'miss' ? 'head, missing from F′' : o.head === 'closed' ? 'head, chain closed to S' : 'head, in F′');
    }
    if (o.isNew) { cls.push('is-new'); sr.push('just processed'); }
    if (o.dis) { cls.push('is-dis'); sr.push('predecessor disagreement'); }
    const tag = o.head ? ' data-tag="head"' : '';
    const srText = sr.length ? `<span class="hdl-sr"> (${sr.join('; ')})</span>` : '';
    return `<span class="${cls.join(' ')}"${tag}>${math(v)}${srText}</span>`;
  }

  function seqHTML(sn) {
    return X.map((v, idx) => {
      const p = idx + 1;
      const done = p <= sn.step;
      const cur = p === sn.step;
      const cls = ['hdl-seqitem', inS(v) ? 'is-kept' : 'is-out', done ? 'is-done' : 'is-todo'];
      if (cur) cls.push('is-current');
      const state = cur ? 'just processed' : done ? 'processed' : 'not yet processed';
      return `<li class="${cls.join(' ')}">` +
        `<span class="hdl-chip ${inS(v) ? 'is-kept' : 'is-out'}" aria-hidden="true">${math(v)}</span>` +
        `<span class="hdl-pos" aria-hidden="true">${math(p)}</span>` +
        `<span class="hdl-sr">${v} at position ${p}, ${inS(v) ? 'kept' : 'outside S'}, ${state}</span></li>`;
    }).join('');
  }

  function snapshotHTML(sn) {
    if (!sn.step) return '<strong>Snapshot:</strong> before any integer is processed.';
    return `<strong>Snapshot after processing</strong> ${math(list(sn.processed))}` +
      ` <span class="hdl-snapshot-kept">· the kept-only run has seen ${sn.keptSeen.length ? math(list(sn.keptSeen)) : 'nothing yet'}</span>`;
  }

  function rowsHTML(sn, which) {
    const chains = which === 'full' ? sn.full : sn.kept;
    const ev = sn.event;
    const missing = sn.missing.map((m) => m.value);
    const landed = ev ? (which === 'full' ? ev.fullChain : ev.kept ? ev.keptChain : 0) : 0;
    let out = '';
    for (let r = 1; r <= ROWS; r += 1) {
      const ch = chains[r - 1];
      const name = which === 'full'
        ? `<span class="hdl-rowname">${math('X_{' + r + '}', 'X' + sub(r))}</span>`
        : `<span class="hdl-rowname">${chainMath(r)}</span><span class="hdl-rowmeta">weight ${math(K - r)}</span>`;
      if (!ch) {
        out += `<li class="hdl-row is-unopened"><span class="hdl-rowlabel">${name}</span>` +
          '<span class="hdl-chain"><span class="hdl-placeholder">not opened yet</span></span></li>';
        continue;
      }
      const head = last(ch);
      const headState = which === 'full'
        ? (inS(head) ? 'inFp' : 'closed')
        : (missing.includes(head) ? 'miss' : 'inFp');
      let chips = '';
      ch.forEach((v, idx) => {
        if (idx > 0) {
          const lost = which === 'kept' && sn.disagree.includes(v);
          chips += lost
            ? `<span class="hdl-link is-lost" title="The link ${ch[idx - 1]} → ${v} is not in the full run"><span class="hdl-sr">, link lost in the full run,</span></span>`
            : '<span class="hdl-link" aria-hidden="true"></span>';
        }
        chips += chipHTML(v, {
          head: idx === ch.length - 1 ? headState : null,
          isNew: !!ev && ev.value === v,
          dis: sn.disagree.includes(v),
        });
      });
      let badge;
      if (headState === 'closed') {
        const c = sn.closedBy[r];
        badge = `<span class="hdl-badge is-closed">closed to ${math('S')} since ${math(c ? c.by : head)}</span>`;
      } else if (headState === 'miss') {
        badge = `<span class="hdl-badge is-miss">missing head ${math(head)}</span>`;
      } else {
        badge = `<span class="hdl-badge is-open">head ${math(head + " \\in F'", head + ' ∈ F′')}</span>`;
      }
      const cls = ['hdl-row', 'is-' + headState];
      if (landed === r) cls.push('is-touched');
      out += `<li class="${cls.join(' ')}"><span class="hdl-rowlabel">${name}</span>` +
        `<span class="hdl-chain">${chips}</span>${badge}</li>`;
    }
    return out;
  }

  function setsHTML(sn) {
    const miss = sn.missing.map((m) => m.value);
    const empty = `<span class="hdl-empty">${math('\\varnothing', '∅')}</span>`;
    const small = (v, state) => `<span class="hdl-chip hdl-chip--sm is-kept is-head is-${state}">${math(v)}` +
      (state === 'miss' ? '<span class="hdl-sr"> (missing)</span>' : '') + '</span>';
    const F = sn.F.length ? sn.F.map((v) => small(v, miss.includes(v) ? 'miss' : 'inFp')).join('') : empty;
    const Fp = sn.Fp.length ? sn.Fp.map((v) => small(v, 'inFp')).join('') : empty;
    const M = sn.missing.length
      ? sn.missing.map((m) => `<span class="hdl-missitem">${small(m.value, 'miss')}` +
        `<span class="hdl-misstag">heads ${chainMath(m.chain)} · weight ${math(m.weight)}</span></span>`).join('')
      : empty;
    return `
      <div class="hdl-set"><dt><span class="hdl-setname">${math('F')}</span>heads of the kept-only run</dt><dd>${F}</dd></div>
      <div class="hdl-set"><dt><span class="hdl-setname">${math("F'", 'F′')}</span>full-run heads that are kept</dt><dd>${Fp}</dd></div>
      <div class="hdl-set is-missing"><dt><span class="hdl-setname">${math("F \\setminus F'", 'F ∖ F′')}</span>missing heads</dt><dd>${M}</dd></div>
      <div class="hdl-set is-check${sn.subset ? '' : ' is-fail'}"><dt><span class="hdl-setname">${math("F' \\subseteq F", 'F′ ⊆ F')}</span>invariant</dt>` +
      `<dd>${sn.subset ? 'holds at this step' : 'FAILS at this step'}</dd></div>`;
  }

  function phiHTML(sn) {
    const m = sn.missing;
    const formula = m.length
      ? `Φ = ${m.map((x) => `(${K} − ${x.chain})`).join(' + ')}` +
        `${m.length > 1 ? ' = ' + m.map((x) => x.weight).join(' + ') : ''} = ${sn.phi}`
      : 'Φ = 0';
    const where = m.length
      ? m.map((x) => `${math(x.value)} is the missing head of ${chainMath(x.chain)}`).join('; ')
      : 'no missing heads';
    let groups = '';
    for (let g = 0; g < K - 1; g += 1) {
      let cells = '';
      for (let c = 0; c < K - 1; c += 1) {
        const n = g * (K - 1) + c;
        const kind = n < sn.down ? 'spent' : n < sn.up ? 'live' : 'free';
        cells += `<span class="hdl-cell is-${kind}"></span>`;
      }
      groups += `<span class="hdl-mgroup">${cells}</span>`;
    }
    const d = sn.disagree.length;
    return `
      <p class="hdl-formula"><span class="hdl-formula-main">${math(formula.replace('Φ', '\\Phi').replace(/−/g, '-'), formula)}</span>
        <span class="hdl-formula-note">${where}. Weights ${math('3, 2, 1')} for ${math('C_1, C_2, C_3', 'C₁, C₂, C₃')}.</span></p>
      <div class="hdl-meter" role="img" aria-label="Budget of ${BUDGET}: removals have raised Φ by ${sn.up}; predecessor disagreements have lowered it by ${sn.down}; ${sn.phi} is still in Φ.">${groups}</div>
      <p class="hdl-meter-key">
        <span><i class="hdl-key hdl-key--spent" aria-hidden="true"></i>lowered by disagreements (${math(sn.down)})</span>
        <span><i class="hdl-key hdl-key--live" aria-hidden="true"></i>current ${math('\\Phi', 'Φ')} (${math(sn.phi)})</span>
        <span><i class="hdl-key hdl-key--free" aria-hidden="true"></i>unused of ${math(K - 1)} removals ${math('\\times ' + (K - 1), '× ' + (K - 1))}</span>
      </p>
      <dl class="hdl-counts">
        <div><dt>removals</dt><dd>${math(sn.removals)}<small>at most ${math(K - 1)}</small></dd></div>
        <div><dt>${math('\\Phi', 'Φ')} raised</dt><dd>${math('+' + sn.up)}<small>at most ${math(K - 1)} per removal</small></dd></div>
        <div><dt>predecessor disagreements</dt><dd>${math(d)}<small>each lowers ${math('\\Phi', 'Φ')} by ${math('\\ge 1', '≥ 1')}</small></dd></div>
      </dl>
      <p class="hdl-bound">${math(d)} ${d === 1 ? 'disagreement' : 'disagreements'} ${math('\\le', '≤')} total drop ${math(sn.down)} ${math('=')} total rise
      ${math(`${sn.up} - \\Phi\\ ${sn.phi} \\le ${K - 1} \\times ${K - 1} = ${BUDGET}`,
        `${sn.up} − Φ ${sn.phi} ≤ ${K - 1} × ${K - 1} = ${BUDGET}`)}</p>`;
  }

  function ledgerHTML(sn) {
    if (!sn.ledger.length) return `<li class="hdl-ledger-empty">${math('\\Phi', 'Φ')} has not changed yet.</li>`;
    return sn.ledger.map((e) => {
      let txt;
      if (e.kind === 'removal') {
        txt = `${math(e.value)} closes a full chain; ${math(e.onto)} turns missing at ${chainMath(e.chain)}`;
      } else if (e.kind === 'move' || e.kind === 'split') {
        txt = `${math(e.value)}: predecessor ${math(e.varphi)} (kept-only) vs ${e.psi == null ? 'none' : math(e.psi)} (full)`;
      } else {
        txt = math(e.value);
      }
      const cls = (e.delta > 0 ? 'is-up' : 'is-down') + (e.step === sn.step ? ' is-current' : '');
      return `<li class="${cls}"><span class="hdl-lstep">step ${math(e.step)}</span>` +
        `<span class="hdl-ltext">${txt}</span><span class="hdl-ldelta">${math(e.delta > 0 ? '+' + e.delta : e.delta, signed(e.delta))}</span></li>`;
    }).join('');
  }

  function plotHTML(sn, id) {
    const W = 300;
    const H = 232;
    const L = 34;
    const R = 10;
    const T = 12;
    const B = 38;
    const pw = W - L - R;
    const ph = H - T - B;
    const f = (n) => (Math.round(n * 10) / 10).toString();
    const xp = (p) => L + ((p - 0.5) * pw) / LAST;
    const yv = (v) => T + ((LAST + 0.5 - v) * ph) / LAST;
    const pt = (v) => [xp(posOf(v)), yv(v)];
    const cutY = yv(CUT + 0.5);
    let g = '';

    g += `<rect class="hdl-pband" x="${L}" y="${f(cutY)}" width="${pw}" height="${f(T + ph - cutY)}"/>`;
    g += `<line class="hdl-pcut" x1="${L}" x2="${L + pw}" y1="${f(cutY)}" y2="${f(cutY)}"/>`;
    if (global.QuasiplanarDiagramMath) {
      const labelAttrs = 'class="hdl-pcutlabel" font-size="8.5" fill="var(--hdl-teal)"';
      const labelY = f(cutY + 11);
      g += svgMath(L + 4, labelY, 'S', labelAttrs);
      g += `<text class="hdl-pcutlabel" x="${L + 9.5}" y="${labelY}">: sizes</text>`;
      g += svgMath(L + 37, labelY, '\\le 6', labelAttrs);
    } else {
      g += `<text class="hdl-pcutlabel" x="${L + 4}" y="${f(cutY + 11)}">S: sizes ≤ 6</text>`;
    }
    g += `<path class="hdl-paxis" d="M${L} ${T} V${T + ph} H${L + pw}"/>`;
    for (let p = 1; p <= LAST; p += 1) {
      g += svgMath(f(xp(p)), T + ph + 12, p,
        'class="hdl-ptick" font-size="8" fill="var(--hdl-muted-ink)" text-anchor="middle"');
    }
    for (let v = 1; v <= LAST; v += 1) {
      g += svgMath(L - 6, f(yv(v) + 3), v,
        'class="hdl-ptick" font-size="8" fill="var(--hdl-muted-ink)" text-anchor="end"');
    }
    g += `<text class="hdl-plabel" x="${f(L + pw / 2)}" y="${H - 6}" text-anchor="middle">position</text>`;
    g += `<text class="hdl-plabel" transform="translate(10 ${f(T + ph / 2)}) rotate(-90)" text-anchor="middle">size</text>`;

    sn.full.forEach((ch) => {
      ch.forEach((v, idx) => {
        if (!idx) return;
        const [x1, y1] = pt(ch[idx - 1]);
        const [x2, y2] = pt(v);
        g += `<line class="hdl-plink${inS(v) ? '' : ' is-out'}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
      });
    });
    sn.lostLinks.forEach(([a, b]) => {
      const [x1, y1] = pt(a);
      const [x2, y2] = pt(b);
      g += `<line class="hdl-plost" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    });
    X.forEach((v, idx) => {
      const p = idx + 1;
      const [cx, cy] = pt(v);
      const st = p < sn.step ? 'done' : p === sn.step ? 'current' : 'todo';
      const cls = ['hdl-pt', 'is-' + st, inS(v) ? 'is-kept' : 'is-out'];
      const ink = inS(v) ? (st === 'todo' ? 'ink' : 'ivory') : 'muted-ink';
      if (sn.disagree.includes(v)) cls.push('is-dis');
      g += `<g class="${cls.join(' ')}">` +
        (st === 'current' ? `<circle class="hdl-pring" cx="${f(cx)}" cy="${f(cy)}" r="12.5"/>` : '') +
        `<circle class="hdl-pdot" cx="${f(cx)}" cy="${f(cy)}" r="8.5"/>` +
        svgMath(f(cx), f(cy + 3.2), v, `font-size="9" fill="var(--hdl-${ink})" text-anchor="middle"`) + '</g>';
    });

    const label = `Position versus size of X. ${sn.step ? `Processed so far: ${list(sn.processed)}.` : 'Nothing processed yet.'} ` +
      `Integers up to 6 form S. ${sn.lostLinks.length ? `Kept-only links lost in the full run: ${list(sn.lostLinks.map((l) => l[0] + ' to ' + l[1]))}.` : ''}`;
    return `<svg class="hdl-psvg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${id}-ptitle" focusable="false">` +
      `<title id="${id}-ptitle">${esc(label)}</title>${g}</svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Mounting                                                            */
  /* ------------------------------------------------------------------ */

  let SNAPS = null;
  let uid = 0;
  const instances = new WeakMap();

  function mount(root, options) {
    if (typeof root === 'string') root = document.querySelector(root);
    if (!root || root.nodeType !== 1) {
      throw new TypeError('QuasiplanarHeads.mount: expected an element, or a selector that matches one');
    }
    const previous = instances.get(root);
    if (previous) previous.destroy();
    if (!SNAPS) SNAPS = simulate();

    const opts = Object.assign({ timeline: true, step: 0, compact:false }, options || {});
    const id = 'hdl-' + (uid += 1);
    const el = document.createElement('section');
    el.className = 'hdl';
    if(opts.compact) el.classList.add('hdl-compact');
    el.setAttribute('aria-labelledby', id + '-title');
    el.innerHTML = shell(id, opts);

    const ref = {};
    el.querySelectorAll('[data-ref]').forEach((n) => { ref[n.getAttribute('data-ref')] = n; });
    const btn = {};
    el.querySelectorAll('[data-act]').forEach((n) => { btn[n.getAttribute('data-act')] = n; });

    function clamp(n) {
      const m = Math.round(Number(n));
      return Number.isFinite(m) ? Math.min(LAST, Math.max(0, m)) : 0;
    }

    let step = clamp(opts.step);

    function setDisabled(b, off) {
      if (b) b.setAttribute('aria-disabled', off ? 'true' : 'false');
    }

    function render() {
      const sn = SNAPS[step];
      ref.seq.innerHTML = seqHTML(sn);
      ref.snapshot.innerHTML = snapshotHTML(sn);
      ref.msg.setAttribute('data-kind', sn.event ? sn.event.kind : 'start');
      ref.msg.innerHTML = `<strong class="hdl-msg-step">${mathText(stepLabel(sn))}</strong> ${mathText(opts.compact ? compactDescription(sn) : describe(sn))}`;
      ref.plot.innerHTML = plotHTML(sn, id);
      ref.full.innerHTML = rowsHTML(sn, 'full');
      ref.kept.innerHTML = rowsHTML(sn, 'kept');
      ref.sets.innerHTML = setsHTML(sn);
      ref.phi.innerHTML = phiHTML(sn);
      ref.ledger.innerHTML = ledgerHTML(sn);
      if(ref.tracks) ref.tracks.innerHTML=tracksHTML(sn);
      setDisabled(btn.restart, step === 0);
      setDisabled(btn.prev, step === 0);
      setDisabled(btn.next, step === LAST);
      if (ref.range) {
        ref.range.value = String(step);
        ref.range.setAttribute('aria-valuetext',
          `Step ${step} of ${LAST}` + (step ? `, after ${list(sn.processed)}` : ', nothing processed'));
      }
      ref.out.innerHTML = math(step + ' / ' + LAST);
      el.setAttribute('data-step', String(step));
    }

    function go(n) {
      const m = clamp(n);
      if (m !== step) {
        step = m;
        render();
      }
      return api;
    }
    const next = () => go(step + 1);
    const prev = () => go(step - 1);
    const restart = () => go(0);
    const actions = { next, prev, restart };

    function onClick(e) {
      const b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || !el.contains(b) || b.getAttribute('aria-disabled') === 'true') return;
      const act = actions[b.getAttribute('data-act')];
      if (act) act();
    }
    function onInput() {
      go(ref.range.value);
    }
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!e.target.closest || !e.target.closest('.hdl-controls')) return;
      const map = { ArrowRight: next, ArrowLeft: prev, Home: restart, End: () => go(LAST) };
      const fn = map[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    }

    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    if (ref.range) ref.range.addEventListener('input', onInput);

    const api = {
      element: el,
      steps: LAST,
      get step() { return step; },
      go,
      next,
      prev,
      restart,
      snapshot: () => SNAPS[step],
      destroy() {
        el.removeEventListener('click', onClick);
        el.removeEventListener('keydown', onKey);
        if (ref.range) ref.range.removeEventListener('input', onInput);
        if (el.parentNode) el.parentNode.removeChild(el);
        if (instances.get(root) === api) instances.delete(root);
      },
    };

    render();                 // fill before insertion so the live region does not announce on load
    root.replaceChildren(el);
    instances.set(root, api);
    return api;
  }

  global.QuasiplanarHeads = {
    version: '1.0.0',
    sequence: X,
    cut: CUT,
    k: K,
    mount,
    simulate,
  };
}(typeof window !== 'undefined' ? window : this));
