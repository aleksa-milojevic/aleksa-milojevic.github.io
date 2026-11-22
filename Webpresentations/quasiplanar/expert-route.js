/* The Expert route from Increasing chains onwards.
   Each figure is drawn once; ordinary scrolling only changes which parts are shown. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const C = {ink: '#252b2b', muted: '#686c65', line: '#d8d9ce', orange: '#bb4b2e', teal: '#276b7c',
    paper: '#f7f5ee', grey: '#9ba298', fill: '#e4e2d6'};
  const CHAIN = [null, C.ink, C.teal, C.orange];

  const tex = (x, y, source, attrs = '') => window.QuasiplanarDiagramMath?.svgLabel
    ? window.QuasiplanarDiagramMath.svgLabel(x, y, source, attrs)
    : `<text x="${x}" y="${y}" ${attrs}>${source}</text>`;
  const htmlTex = source => window.QuasiplanarDiagramMath?.html ? window.QuasiplanarDiagramMath.html(source) : source;
  const r1 = v => Math.round(v * 10) / 10;
  const pt = p => r1(p[0]) + ' ' + r1(p[1]);

  /* Sequences: positions in the left order, values in the right order. */
  function analyse(seq) {
    const n = seq.length, ell = new Array(n).fill(1);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < i; j++) if (seq[j] > seq[i]) ell[i] = Math.max(ell[i], ell[j] + 1);
    const chains = new Map();
    ell.forEach((l, i) => { if (!chains.has(l)) chains.set(l, []); chains.get(l).push(i); });
    const succ = new Array(n).fill(-1);
    for (const members of chains.values())
      for (let t = 0; t + 1 < members.length; t++) succ[members[t]] = members[t + 1];
    return {ell, chains, succ};
  }

  /* An arrow from p to q, stopping short of both dots. */
  function arrow(p, q, gap = 9, head = 7) {
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const u = [dx / len, dy / len], n = [-u[1], u[0]];
    const a = [p[0] + u[0] * gap, p[1] + u[1] * gap], b = [q[0] - u[0] * gap, q[1] - u[1] * gap];
    const w = head * .55;
    return {line: `M${pt(a)} L${pt(b)}`,
      head: `M${pt([b[0] - u[0] * head + n[0] * w, b[1] - u[1] * head + n[1] * w])} L${pt(b)} L${pt([b[0] - u[0] * head - n[0] * w, b[1] - u[1] * head - n[1] * w])}`};
  }
  /* A slightly wiggly, densely dashed path through several points. */
  function wiggle(points, bend = 7) {
    let d = `M${pt(points[0])}`;
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1], q = points[i], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
      const s = i % 2 ? bend : -bend;
      d += ` Q${pt([(p[0] + q[0]) / 2 - dy / len * s, (p[1] + q[1]) / 2 + dx / len * s])} ${pt(q)}`;
    }
    return d;
  }
  /* A dashed arc between two points of a side, bulging to one side, with a small head. */
  function sideArc(p, q, bulge, head = 6) {
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const n = [-dy / len * bulge, dx / len * bulge];
    const c = [(p[0] + q[0]) / 2 + n[0], (p[1] + q[1]) / 2 + n[1]];
    const tx = q[0] - c[0], ty = q[1] - c[1], tl = Math.hypot(tx, ty) || 1, u = [tx / tl, ty / tl], m = [-u[1], u[0]];
    const end = [q[0] - u[0] * 5, q[1] - u[1] * 5], w = head * .55;
    return {line: `M${pt(p)} Q${pt(c)} ${pt(end)}`,
      head: `M${pt([end[0] - u[0] * head + m[0] * w, end[1] - u[1] * head + m[1] * w])} L${pt(end)} L${pt([end[0] - u[0] * head - m[0] * w, end[1] - u[1] * head - m[1] * w])}`};
  }

  /* Cubic curves and their crossings with straight sides. */
  const bez = (s, t) => { const u = 1 - t; return [0, 1].map(k => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]); };
  const curvePath = segs => 'M' + pt(segs[0][0]) + segs.map(s => ` C${pt(s[1])} ${pt(s[2])} ${pt(s[3])}`).join('');
  function samples(segs, n = 160) {
    const out = [];
    segs.forEach((s, k) => { for (let i = k ? 1 : 0; i <= n; i++) out.push(bez(s, i / n)); });
    return out;
  }
  function meet(points, a, b) {
    for (let i = 0; i + 1 < points.length; i++) {
      const p = points[i], q = points[i + 1];
      const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [b[0] - a[0], b[1] - a[1]];
      const den = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den;
      const s = ((a[0] - p[0]) * d1[1] - (a[1] - p[1]) * d1[0]) / den;
      if (t >= 0 && t < 1 && s >= 0 && s <= 1) return [p[0] + t * d1[0], p[1] + t * d1[1]];
    }
    return null;
  }
  const lerp = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];
  function chevron(a, b, s = .62, size = 6) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), u = [dx / len, dy / len], n = [-u[1], u[0]];
    const c = lerp(a, b, s), w = size * .7;
    return `M${pt([c[0] - u[0] * size + n[0] * w, c[1] - u[1] * size + n[1] * w])} L${pt(c)} L${pt([c[0] - u[0] * size - n[0] * w, c[1] - u[1] * size - n[1] * w])}`;
  }
  const show = (node, on, value = 1) => { if (node) node.style.opacity = on ? String(value) : '0'; };

  /* ------------------------------------------------------------------ */
  /* Figure 1: a sequence as points, its chains and successors.          */
  function mountChainPlot(host) {
    const seq = [4, 2, 1, 7, 5, 3, 9, 8, 6, 10];
    const {ell, succ} = analyse(seq);
    const W = 560, H = 500, x0 = 56, y0 = 410;
    const X = i => x0 + 40 + i * 42, Y = v => y0 - v * 34;
    const at = v => { const i = seq.indexOf(v); return [X(i), Y(v)]; };
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ten points: the sequence 4, 2, 1, 7, 5, 3, 9, 8, 6, 10, with the left order from left to right and the right order from bottom to top. The chains are 4, 7, 9, 10; then 2, 5, 8; then 1, 3, 6.">`;
    s += `<g fill="none" stroke="${C.ink}" stroke-width="1.3" stroke-linejoin="round"><path d="M${x0} ${y0}H520M512 ${y0 - 5}L520 ${y0}L512 ${y0 + 5}"/><path d="M${x0} ${y0}V36M${x0 - 5} 44L${x0} 36L${x0 + 5} 44"/></g>`;
    s += tex(530, y0 + 6, '\\prec_L', 'style="font-size:19px"');
    s += tex(x0, 24, '\\prec_R', 'text-anchor="middle" style="font-size:19px"');
    s += tex(76, y0 + 37, 'a', 'text-anchor="end" style="font-size:16px;fill:#686c65"');
    seq.forEach((v, i) => { s += `<text class="xr-seq" data-v="${v}" x="${X(i)}" y="${y0 + 37}" text-anchor="middle">${v}</text>`; });
    s += `<g class="xr-ell-row">${tex(76, y0 + 72, '\\ell(a)', 'text-anchor="end" style="font-size:16px;fill:#686c65"')}`;
    seq.forEach((v, i) => { s += `<text class="xr-ell" data-v="${v}" x="${X(i)}" y="${y0 + 72}" text-anchor="middle" style="font-family:var(--sans);font-size:14px">${ell[i]}</text>`; });
    s += `</g>`;
    const paths = {753: [7, 5, 3], 986: [9, 8, 6]};
    for (const [key, values] of Object.entries(paths))
      s += `<path class="xr-dec" data-path="${key}" d="${wiggle(values.map(at), 6)}" fill="none" stroke="${C.orange}" stroke-width="1.8" stroke-dasharray="4 3" stroke-linecap="round"/>`;
    seq.forEach((v, i) => {
      if (succ[i] < 0) return;
      const a = arrow([X(i), Y(v)], [X(succ[i]), Y(seq[succ[i]])], 10, 8);
      s += `<g class="xr-link" data-from="${v}" data-to="${seq[succ[i]]}" fill="none" stroke="${CHAIN[ell[i]]}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="${a.line}"/><path d="${a.head}"/></g>`;
    });
    seq.forEach((v, i) => {
      if (succ[i] >= 0) return;
      s += `<circle class="xr-ring" data-v="${v}" cx="${X(i)}" cy="${Y(v)}" r="12.5" fill="none" stroke="${CHAIN[ell[i]]}" stroke-width="1.3"/>`;
      s += `<g class="xr-chain-label" data-chain="${ell[i]}">${tex(X(i) + 20, Y(v) + 6, 'L_' + ell[i], `style="font-size:18px;fill:${CHAIN[ell[i]]}"`)}</g>`;
    });
    seq.forEach((v, i) => {
      s += `<circle class="xr-dot" data-v="${v}" data-chain="${ell[i]}" cx="${X(i)}" cy="${Y(v)}" r="5.5" fill="${C.ink}"/>`;
      s += `<text class="xr-value" data-v="${v}" x="${X(i) - 11}" y="${Y(v) - 9}" text-anchor="end" style="font-size:16px;fill:${C.orange}">${v}</text>`;
    });
    s += `</svg>`;
    host.innerHTML = s;

    const stages = {
      points: {},
      decreasing: {fade: true, hi: [7, 5, 3], path: '753'},
      ell: {ellRow: true, hi: [7, 5, 3], path: '753'},
      chains: {ellRow: true, color: true, links: 1, labels: true},
      successor: {ellRow: true, color: true, links: .18, emph: [[5, 8]], rings: true, labels: true},
      quiz: {ellRow: true, color: true, links: .18, hi: [3], labels: true},
      'quiz-done': {ellRow: true, color: true, links: .18, hi: [3, 6], emph: [[3, 6]], path: '986', labels: true},
      visits: {ellRow: true, color: true, links: 1, rings: true, labels: true}
    };
    stages.full = stages.visits;
    let current = null;
    function set(stage) {
      const o = stages[stage] || stages.full;
      if (current === stage) return;
      current = stage;
      const hi = new Set(o.hi || []);
      $$('.xr-dot', host).forEach(dot => {
        const v = Number(dot.dataset.v), chain = Number(dot.dataset.chain);
        dot.setAttribute('fill', o.color ? CHAIN[chain] : hi.has(v) ? C.orange : C.ink);
        dot.setAttribute('r', hi.has(v) ? '6.5' : '5.5');
        dot.style.opacity = o.fade && !hi.has(v) ? '.22' : '1';
      });
      $$('.xr-value', host).forEach(t => show(t, hi.has(Number(t.dataset.v))));
      $$('.xr-seq', host).forEach(t => {
        const v = Number(t.dataset.v);
        t.style.fill = hi.has(v) ? C.orange : C.ink;
        t.style.opacity = o.fade && !hi.has(v) ? '.3' : '1';
      });
      show($('.xr-ell-row', host), o.ellRow);
      $$('.xr-ell', host).forEach(t => {
        const chain = Number(t.textContent);
        t.style.fill = o.color ? CHAIN[chain] : hi.has(Number(t.dataset.v)) ? C.orange : C.muted;
      });
      $$('.xr-dec', host).forEach(p => show(p, p.dataset.path === o.path));
      const emph = new Set((o.emph || []).map(pair => pair.join('-')));
      $$('.xr-link', host).forEach(g => {
        const on = emph.has(g.dataset.from + '-' + g.dataset.to);
        g.style.opacity = on ? '1' : String(o.links || 0);
        g.setAttribute('stroke-width', on ? '2.6' : '1.5');
      });
      $$('.xr-ring', host).forEach(c => show(c, o.rings));
      $$('.xr-chain-label', host).forEach(g => show(g, o.labels));
    }
    set('full');
    return {set};
  }

  /* ------------------------------------------------------------------ */
  /* Figure 2: following a curve through a corridor of triangles.        */
  function mountCorridor(host) {
    const P = [70, 120], Q = [70, 240], R = [24, 180], T1 = [230, 70], T2 = [420, 64],
      B1 = [180, 300], B2 = [370, 306], P2 = [570, 120], Q2 = [570, 240], R2 = [616, 180];
    const U = [50, 180], V = [590, 180];
    const sides = [[P, Q], [P, B1], [T1, B1], [T1, B2], [T2, B2], [T2, Q2], [P2, Q2]];
    const boundary = [[Q, B1], [P, T1], [B1, B2], [T1, T2], [B2, Q2], [T2, P2]];
    const alpha = [[U, [120, 188], [170, 170], [250, 178]], [[250, 178], [330, 186], [420, 190], [500, 179]], [[500, 179], [540, 174], [566, 178], V]];
    const beta = [[U, [62, 216], [150, 222], [195, 238]], [[195, 238], [230, 250], [250, 280], [262, 340]]];
    const gamma = [[[130, 34], [150, 70], [170, 110], [215, 140]], [[215, 140], [260, 160], [400, 160], [485, 140]], [[485, 140], [515, 132], [535, 115], [560, 56]]];
    const ghost = [[U, [100, 215], [160, 222], [250, 214]], [[250, 214], [340, 206], [440, 222], [510, 206]], [[510, 206], [550, 198], [570, 192], V]];
    const pts = {alpha: samples(alpha), beta: samples(beta), gamma: samples(gamma), ghost: samples(ghost)};
    const hit = (name, i) => meet(pts[name], sides[i][0], sides[i][1]);
    const succ = {beta: [0, 1, 2], gamma: [3, 4, 5]};
    let s = `<svg viewBox="0 0 640 360" role="img" aria-label="A curve alpha runs through a corridor of triangles from the hole around u to the hole around v, crossing the sides e1 to es. Its successor is a visit of beta at the first three sides and of gamma at the next three; the triangle between e3 and e4 is shaded. At the last side there is no successor.">`;
    s += `<path class="xr-tri" d="M${pt(T1)}L${pt(B1)}L${pt(B2)}Z" fill="${C.orange}" fill-opacity=".15" stroke="none"/>`;
    s += `<g fill="none" stroke="${C.grey}" stroke-width="1.1">${boundary.map(([a, b]) => `<path d="M${pt(a)}L${pt(b)}"/>`).join('')}</g>`;
    s += `<g class="xr-holes" fill="${C.fill}" stroke="${C.ink}" stroke-width="1.2"><path d="M${pt(P)}L${pt(Q)}L${pt(R)}Z"/><path d="M${pt(P2)}L${pt(Q2)}L${pt(R2)}Z"/></g>`;
    sides.forEach(([a, b], i) => {
      s += `<g class="xr-side" data-side="${i}" fill="none" stroke="${C.grey}" stroke-width="1.5" stroke-linejoin="round"><path d="M${pt(a)}L${pt(b)}"/><path d="${chevron(a, b, i === 0 || i === 6 ? .8 : .7)}"/></g>`;
    });
    s += `<path class="xr-curve" data-curve="ghost" d="${curvePath(ghost)}" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-dasharray="5 3"/>`;
    s += `<path class="xr-curve" data-curve="beta" d="${curvePath(beta)}" fill="none" stroke="${C.ink}" stroke-width="2.4"/>`;
    s += `<path class="xr-curve" data-curve="gamma" d="${curvePath(gamma)}" fill="none" stroke="${C.teal}" stroke-width="2.4"/>`;
    s += `<path class="xr-curve" data-curve="alpha" d="${curvePath(alpha)}" fill="none" stroke="${C.orange}" stroke-width="3"/>`;
    // Successor pointers along each side, and the crossings they join.
    const markers = [];
    for (const [name, list] of [['beta', succ.beta], ['gamma', succ.gamma], ['ghost', [0, 1, 2, 3, 4, 5, 6]]]) {
      for (const i of list) {
        const a = hit('alpha', i), b = hit(name, i);
        if (!a || !b) continue;
        const arc = sideArc(a, b, b[1] > a[1] ? -12 : 12);
        const color = name === 'gamma' ? C.teal : C.ink;
        markers.push(`<g class="xr-mark" data-curve="${name}" data-side="${i}"><path d="${arc.line}" fill="none" stroke="${color}" stroke-width="1.3" stroke-dasharray="3 2.4"/><path d="${arc.head}" fill="none" stroke="${color}" stroke-width="1.3" stroke-linejoin="round"/><circle cx="${r1(b[0])}" cy="${r1(b[1])}" r="3.6" fill="${color}" stroke="${C.paper}" stroke-width="1"/></g>`);
      }
    }
    s += markers.join('');
    sides.forEach((side, i) => {
      const a = hit('alpha', i);
      s += `<circle class="xr-adot" data-side="${i}" cx="${r1(a[0])}" cy="${r1(a[1])}" r="4.2" fill="${C.orange}" stroke="${C.paper}" stroke-width="1"/>`;
      if (i === 6) s += `<circle class="xr-noring" cx="${r1(a[0])}" cy="${r1(a[1])}" r="10" fill="none" stroke="${C.orange}" stroke-width="1.4"/>`;
    });
    s += `<g fill="${C.ink}"><circle cx="${U[0]}" cy="${U[1]}" r="4"/><circle cx="${V[0]}" cy="${V[1]}" r="4"/></g>`;
    s += tex(16, 212, 'u', 'text-anchor="middle" style="font-size:18px"') + tex(624, 212, 'v', 'text-anchor="middle" style="font-size:18px"');
    s += `<g class="xr-label" data-curve="alpha">${tex(118, 168, '\\alpha', `style="font-size:20px;fill:${C.orange}"`)}</g>`;
    s += `<g class="xr-label" data-curve="beta">${tex(276, 338, '\\beta', 'style="font-size:20px"')}</g>`;
    s += `<g class="xr-label" data-curve="gamma">${tex(146, 34, '\\gamma', `style="font-size:20px;fill:${C.teal}"`)}</g>`;
    s += `<g class="xr-label" data-curve="ghost">${tex(300, 238, '\\beta', 'style="font-size:20px"')}</g>`;
    const sideLabels = [[54, 262, 'e_1'], [144, 286, 'e_2'], [210, 292, 'e_3'], [350, 274, 'e_4'], [584, 264, 'e_s']];
    s += `<g class="xr-side-labels">${sideLabels.map(([x, y, l]) => tex(x, y, l, 'text-anchor="middle" style="font-size:17px;fill:#686c65"')).join('')}</g>`;
    s += `</svg>`;
    host.innerHTML = s;

    const stages = {
      walk: {},
      beta: {curves: ['beta'], marks: {beta: [0]}},
      same: {curves: ['beta'], marks: {beta: [0, 1, 2]}},
      switch: {curves: ['beta', 'gamma'], marks: {beta: [0, 1, 2], gamma: [3, 4, 5]}, tri: true},
      noside: {curves: ['beta', 'gamma'], marks: {beta: [0, 1, 2], gamma: [3, 4, 5]}, tri: true, side: [6], ring: true},
      why: {curves: ['ghost'], marks: {ghost: [0, 1, 2, 3, 4, 5, 6]}},
      contradiction: {curves: ['ghost'], marks: {ghost: [0, 1, 2, 3, 4, 5, 6]}, side: [0, 6], holes: true}
    };
    stages.full = stages.noside;
    let current = null;
    function set(stage) {
      if (current === stage) return;
      current = stage;
      const o = stages[stage] || stages.full, curves = new Set(['alpha', ...(o.curves || [])]);
      $$('.xr-curve', host).forEach(p => show(p, curves.has(p.dataset.curve)));
      $$('.xr-label', host).forEach(g => show(g, curves.has(g.dataset.curve)));
      $$('.xr-mark', host).forEach(g => show(g, (o.marks?.[g.dataset.curve] || []).includes(Number(g.dataset.side))));
      show($('.xr-tri', host), o.tri);
      show($('.xr-noring', host), o.ring);
      $$('.xr-side', host).forEach(g => {
        const on = (o.side || []).includes(Number(g.dataset.side));
        g.setAttribute('stroke', on ? C.orange : C.grey);
        g.setAttribute('stroke-width', on ? '3' : '1.5');
      });
      $('.xr-holes', host).setAttribute('stroke', o.holes ? C.orange : C.ink);
      $('.xr-holes', host).setAttribute('stroke-width', o.holes ? '2.4' : '1.2');
    }
    set('full');
    return {set};
  }

  /* ------------------------------------------------------------------ */
  /* Figure 3: the passages between two sides of a triangle.             */
  function mountTriangle(host) {
    const x = [280, 396], y = [490, 66], z = [70, 66];
    const onXY = sv => lerp(x, y, sv), onXZ = sv => lerp(x, z, sv), onYZ = sv => lerp(y, z, sv);
    const passages = [.17, .3, .43].map((sv, k) => {
      const a = onXY(sv), b = onXZ(sv), depth = 40 - k * 6;
      const mid = [x[0], Math.min(a[1], b[1]) + depth * .25 + 6];
      return {k, a, b, d: `M548 ${r1(a[1] + 18 - k * 4)} C${r1(a[0] + 70)} ${r1(a[1] + 10)} ${r1(a[0] + 22)} ${r1(a[1] + 2)} ${pt(a)} C${r1(a[0] - 26)} ${r1(mid[1] + 4)} ${r1(mid[0] + 40)} ${r1(mid[1] + depth * .2)} ${pt(mid)} C${r1(mid[0] - 40)} ${r1(mid[1] + depth * .2)} ${r1(b[0] + 26)} ${r1(mid[1] + 4)} ${pt(b)} C${r1(b[0] - 22)} ${r1(b[1] + 2)} ${r1(b[0] - 70)} ${r1(b[1] + 10)} 12 ${r1(b[1] + 18 - k * 4)}`};
    });
    const right = [.58, .7, .82].map((sv, k) => {
      const a = onXY(sv), t = onYZ(.16 + (2 - k) * .11);
      return {a, d: `M552 ${r1(a[1] + 26)} C${r1(a[0] + 50)} ${r1(a[1] + 14)} ${r1(a[0] + 16)} ${r1(a[1] + 6)} ${pt(a)} C${r1(a[0] - 40)} ${r1(a[1] - 12)} ${r1(t[0] + 6)} ${r1(t[1] + 50)} ${pt(t)} C${r1(t[0] - 3)} ${r1(t[1] - 20)} ${r1(t[0] - 6)} ${r1(t[1] - 34)} ${r1(t[0] - 8)} 14`};
    });
    const left = [.58, .7, .82].map((sv, k) => {
      const b = onXZ(sv), t = onYZ(.84 - (2 - k) * .11);
      return {b, d: `M8 ${r1(b[1] + 26)} C${r1(b[0] - 50)} ${r1(b[1] + 14)} ${r1(b[0] - 16)} ${r1(b[1] + 6)} ${pt(b)} C${r1(b[0] + 40)} ${r1(b[1] - 12)} ${r1(t[0] - 6)} ${r1(t[1] + 50)} ${pt(t)} C${r1(t[0] + 3)} ${r1(t[1] - 20)} ${r1(t[0] + 6)} ${r1(t[1] - 34)} ${r1(t[0] + 8)} 14`};
    });
    let s = `<svg viewBox="0 0 560 440" role="img" aria-label="A triangle xyz with x at the bottom. The highlighted set S consists of three passages from xy to xz near the corner x. Other curves cross xy or xz higher up and leave through yz.">`;
    s += `<clipPath id="xr-tri-clip"><path d="M${pt(x)}L${pt(y)}L${pt(z)}Z"/></clipPath>`;
    s += `<path d="M${pt(x)}L${pt(y)}L${pt(z)}Z" fill="${C.fill}" fill-opacity=".45" stroke="none"/>`;
    s += `<g class="xr-others" fill="none" stroke="${C.grey}" stroke-width="1.8">${right.map(c => `<path d="${c.d}"/>`).join('')}${left.map(c => `<path d="${c.d}"/>`).join('')}</g>`;
    s += `<g class="xr-s-outside" fill="none" stroke="${C.orange}" stroke-width="2.4" stroke-opacity=".45">${passages.map(c => `<path d="${c.d}"/>`).join('')}</g>`;
    s += `<g class="xr-s-inside" fill="none" stroke="${C.orange}" stroke-width="2.8" clip-path="url(#xr-tri-clip)">${passages.map(c => `<path data-k="${c.k}" d="${c.d}"/>`).join('')}</g>`;
    s += `<g fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round"><path d="M${pt(x)}L${pt(y)}L${pt(z)}Z"/><path d="${chevron(x, y, .42, 8)}"/><path d="${chevron(x, z, .42, 8)}"/></g>`;
    // brackets for the first elements at xy and the smallest elements at xz
    const off = (p, q, d) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [-dy / l * d, dx / l * d]; };
    const oxy = off(x, y, 14), oxz = off(x, z, -14);
    const bxy = [onXY(.1), onXY(.5)].map(p => [p[0] + oxy[0], p[1] + oxy[1]]);
    const bxz = [onXZ(.1), onXZ(.5)].map(p => [p[0] + oxz[0], p[1] + oxz[1]]);
    s += `<path class="xr-bracket" data-b="xy" d="M${pt(bxy[0])}L${pt(bxy[1])}" stroke="${C.orange}" stroke-width="5" stroke-opacity=".5" stroke-linecap="round"/>`;
    s += `<path class="xr-bracket" data-b="xz" d="M${pt(bxz[0])}L${pt(bxz[1])}" stroke="${C.orange}" stroke-width="5" stroke-opacity=".5" stroke-linecap="round"/>`;
    s += `<g class="xr-bracket-label" data-b="xy">${tex(bxy[1][0] + 16, bxy[1][1] - 4, '\\text{first in }\\prec_L', 'style="font-size:15px;fill:#686c65"')}</g>`;
    s += `<g class="xr-bracket-label" data-b="xz">${tex(bxz[1][0] - 16, bxz[1][1] - 4, '\\text{smallest in }\\prec_R', 'text-anchor="end" style="font-size:15px;fill:#686c65"')}</g>`;
    // crossings of the curves with the two sides
    passages.forEach(c => {
      s += `<circle class="xr-tdot" data-side="xy" data-s="1" data-k="${c.k}" cx="${r1(c.a[0])}" cy="${r1(c.a[1])}" r="4.4" fill="${C.orange}" stroke="${C.paper}" stroke-width="1"/>`;
      s += `<circle class="xr-tdot" data-side="xz" data-s="1" data-k="${c.k}" cx="${r1(c.b[0])}" cy="${r1(c.b[1])}" r="4.4" fill="${C.orange}" stroke="${C.paper}" stroke-width="1"/>`;
    });
    right.forEach((c, k) => { s += `<circle class="xr-tdot" data-side="xy" data-k="${k + 3}" cx="${r1(c.a[0])}" cy="${r1(c.a[1])}" r="4.4" fill="${C.grey}" stroke="${C.paper}" stroke-width="1"/>`; });
    left.forEach((c, k) => { s += `<circle class="xr-tdot" data-side="xz" data-k="${k + 3}" cx="${r1(c.b[0])}" cy="${r1(c.b[1])}" r="4.4" fill="${C.grey}" stroke="${C.paper}" stroke-width="1"/>`; });
    // a passage whose successors at the two sides come from different curves
    const alpha = passages[1], toB = sideArc(alpha.a, passages[2].a, -13), toG = sideArc(alpha.b, left[0].b, 13);
    s += `<g class="xr-change"><path d="${passages[1].d}" fill="none" stroke="${C.orange}" stroke-width="4.2"/>`;
    s += `<path d="${passages[2].d}" fill="none" stroke="${C.ink}" stroke-width="2.6"/><path d="${left[0].d}" fill="none" stroke="${C.teal}" stroke-width="2.6"/>`;
    for (const [arc, col, p] of [[toB, C.ink, passages[2].a], [toG, C.teal, left[0].b]])
      s += `<path d="${arc.line}" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="3 2.4"/><path d="${arc.head}" fill="none" stroke="${col}" stroke-width="1.4"/><circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="4.6" fill="${col}" stroke="${C.paper}" stroke-width="1"/>`;
    s += `<circle cx="${r1(alpha.a[0])}" cy="${r1(alpha.a[1])}" r="4.8" fill="${C.orange}" stroke="${C.paper}" stroke-width="1"/><circle cx="${r1(alpha.b[0])}" cy="${r1(alpha.b[1])}" r="4.8" fill="${C.orange}" stroke="${C.paper}" stroke-width="1"/>`;
    s += tex(540, 300, '\\alpha', `style="font-size:19px;fill:${C.orange}"`) + tex(548, 262, '\\beta', 'style="font-size:19px"') + tex(14, 236, '\\gamma', `style="font-size:19px;fill:${C.teal}"`) + `</g>`;
    s += tex(x[0], x[1] + 30, 'x', 'text-anchor="middle" style="font-size:20px"') + tex(y[0] + 14, y[1] - 8, 'y', 'style="font-size:20px"') + tex(z[0] - 14, z[1] - 8, 'z', 'text-anchor="end" style="font-size:20px"');
    s += `<g class="xr-s-label">${tex(x[0], 312, 'S',`text-anchor="middle" style="font-size:20px;fill:${C.orange}"`)}</g>`;
    s += `<g class="xr-c-label" data-b="xy">${tex(486, 176, 'C_{xy}', 'style="font-size:18px"')}</g>`;
    s += `<g class="xr-c-label" data-b="xz">${tex(74, 176, 'C_{xz}', 'text-anchor="end" style="font-size:18px"')}</g>`;
    s += `</svg>`;
    host.innerHTML = s;

    const stages = {
      triangle: {},
      passages: {S: true},
      first: {S: true, dots: ['xy'], brackets: ['xy']},
      smallest: {S: true, dots: ['xz'], brackets: ['xz']},
      same: {S: true, outside: true, dots: ['xy', 'xz'], brackets: ['xy', 'xz']},
      change: {S: true, outside: true, change: true, dots: ['xy', 'xz']}
    };
    stages.full = stages.same;
    let current = null;
    function set(stage) {
      if (current === stage) return;
      current = stage;
      const o = stages[stage] || stages.full, dots = new Set(o.dots || []), brackets = new Set(o.brackets || []);
      show($('.xr-s-inside', host), o.S, o.change ? .35 : 1);
      show($('.xr-s-outside', host), o.outside, o.change ? .35 : 1);
      show($('.xr-s-label', host), o.S && !o.change);
      $('.xr-others', host).style.opacity = o.S ? '.45' : '1';
      $$('.xr-tdot', host).forEach(d => show(d, dots.has(d.dataset.side) && !(o.change && d.dataset.s)));
      $$('.xr-bracket,.xr-bracket-label', host).forEach(b => show(b, brackets.has(b.dataset.b)));
      $$('.xr-c-label', host).forEach(b => show(b, dots.has(b.dataset.b) && !o.change));
      show($('.xr-change', host), o.change);
    }
    set('full');
    return {set};
  }

  /* ------------------------------------------------------------------ */
  /* Figure 4: restricting a sequence, and the successors that change.   */
  const BIG = [5, 9, 1, 11, 4, 2, 12, 7, 10, 3, 14, 6, 15, 8, 13];
  function restriction(kind, size, seq = BIG) {
    const n = seq.length, keep = new Set();
    const byValue = [...seq.keys()].sort((a, b) => seq[a] - seq[b]);
    for (let r = 0; r < size; r++) {
      if (kind === 'smallest') keep.add(byValue[r]);
      if (kind === 'largest') keep.add(byValue[n - 1 - r]);
      if (kind === 'first') keep.add(r);
      if (kind === 'last') keep.add(n - 1 - r);
    }
    const kept = [...keep].sort((a, b) => a - b);
    const small = analyse(kept.map(i => seq[i])), full = analyse(seq);
    const succS = new Map(), ellS = new Map();
    kept.forEach((i, t) => { succS.set(i, small.succ[t] < 0 ? -1 : kept[small.succ[t]]); ellS.set(i, small.ell[t]); });
    const changed = new Set(kept.filter(i => succS.get(i) !== full.succ[i]));
    return {kept, keep, succS, ellS, full, changed};
  }
  function mountRestriction(figure) {
    const host = $('#xr-restriction', figure);
    const k = Math.max(...analyse(BIG).ell) + 1;
    const binom = k * (k - 1) / 2;
    const bounds = {smallest: binom, largest: 0, first: k - 1, last: binom};
    let kind = 'smallest', size = 8;
    const toolbar = document.createElement('div');
    toolbar.innerHTML = `<div class="branch-buttons" role="group" aria-label="Choose the restriction">
      <button type="button" data-kind="smallest" aria-pressed="true">Smallest values</button>
      <button type="button" data-kind="largest" aria-pressed="false">Largest values</button>
      <button type="button" data-kind="first" aria-pressed="false">First positions</button>
      <button type="button" data-kind="last" aria-pressed="false">Last positions</button></div>`;
    figure.insertBefore(toolbar.firstElementChild, host);
    const controls = document.createElement('div');
    controls.className = 'xr-restriction-controls';
    controls.innerHTML = `<label for="xr-restriction-size">Keep elements <output id="xr-restriction-output">8 of 15</output></label><input id="xr-restriction-size" type="range" min="1" max="14" value="8"><div class="xr-restriction-readout" aria-live="polite"></div>`;
    figure.append(controls);
    const W = 720, H = 360;
    function panel(ox, data, own) {
      const X = i => ox + 34 + i * 18.5, Y = v => 318 - v * 18.5;
      let s = `<g fill="none" stroke="${C.ink}" stroke-width="1.2"><path d="M${ox + 14} 330H${ox + 330}M${ox + 323} 325L${ox + 330} 330L${ox + 323} 335"/><path d="M${ox + 14} 330V28M${ox + 9} 35L${ox + 14} 28L${ox + 19} 35"/></g>`;
      s += tex(ox + 338, 336, '\\prec_L', 'style="font-size:16px"') + tex(ox + 14, 18, '\\prec_R', 'text-anchor="middle" style="font-size:16px"');
      s += tex(ox + 60, 40, own ? 'S' : "S'", `style="font-size:20px;fill:${own ? C.orange : C.ink}"`);
      // the cut between kept and removed elements
      const m = data.kept.length;
      let cut = '';
      if (kind === 'smallest') cut = `M${ox + 14} ${r1(Y(m + .5))}H${ox + 320}`;
      if (kind === 'largest') cut = `M${ox + 14} ${r1(Y(15 - m + .5))}H${ox + 320}`;
      if (kind === 'first') cut = `M${r1(X(m - .5))} 330V36`;
      if (kind === 'last') cut = `M${r1(X(15 - m - .5))} 330V36`;
      s += `<path d="${cut}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="4 3" fill="none"/>`;
      const links = [];
      if (own) data.kept.forEach(i => { const j = data.succS.get(i); if (j >= 0) links.push([i, j]); });
      else BIG.forEach((v, i) => { const j = data.full.succ[i]; if (j >= 0) links.push([i, j]); });
      for (const [i, j] of links) {
        const a = arrow([X(i), Y(BIG[i])], [X(j), Y(BIG[j])], 7, 6);
        s += `<g fill="none" stroke="${own ? C.orange : C.ink}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"><path d="${a.line}"/><path d="${a.head}"/></g>`;
      }
      BIG.forEach((v, i) => {
        const inS = data.keep.has(i);
        if (own && !inS) { s += `<circle cx="${r1(X(i))}" cy="${r1(Y(v))}" r="3.4" fill="${C.ink}" opacity=".18"/>`; return; }
        if (data.changed.has(i)) s += `<circle cx="${r1(X(i))}" cy="${r1(Y(v))}" r="9" fill="none" stroke="${C.ink}" stroke-width="1.1"/>`;
        s += `<circle cx="${r1(X(i))}" cy="${r1(Y(v))}" r="4.2" fill="${inS ? C.orange : C.ink}"/>`;
      });
      return s;
    }
    function render() {
      const data = restriction(kind, size);
      host.innerHTML = `<div class="xr-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fifteen points. Left: the kept set S with its chains. Right: all of S prime with its chains. ${data.changed.size} kept elements have different successors.">${panel(10, data, true)}${panel(372, data, false)}</svg></div>`;
      $('#xr-restriction-output', figure).textContent = `${size} of 15`;
      const d = data.changed.size, b = bounds[kind];
      $('.xr-restriction-readout', figure).innerHTML = `${htmlTex(`D(S,S')=${d}`)}, and the lemma gives at most ${htmlTex(String(b))}.`;
      $$('[data-kind]', figure).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
    }
    figure.addEventListener('click', event => {
      const button = event.target.closest('[data-kind]');
      if (!button) return;
      kind = button.dataset.kind;
      render();
    });
    $('#xr-restriction-size', figure).addEventListener('input', event => { size = Number(event.target.value); render(); });
    render();
  }

  /* ------------------------------------------------------------------ */
  /* Figure 5: along each chain of S, the values of l_{S'} increase.     */
  function mountLadder(host) {
    const data = restriction('smallest', 8);
    const rows = [...new Set(data.kept.map(i => data.ellS.get(i)))].sort((a, b) => a - b);
    const X = i => 150 + i * 36;
    let s = `<svg viewBox="0 0 720 ${rows.length * 82 + 30}" role="img" aria-label="The chains of S. Under each element is its value of l in S prime. Circled elements have different successors in S and S prime; along each chain their values increase.">`;
    rows.forEach((j, r) => {
      const y = 46 + r * 82, members = data.kept.filter(i => data.ellS.get(i) === j);
      s += tex(92, y + 6, `L_S(${j})`, `text-anchor="end" style="font-size:18px;fill:${CHAIN[j]}"`);
      s += tex(92, y + 36, "\\ell_{S'}", 'text-anchor="end" style="font-size:15px;fill:#686c65"');
      for (let t = 0; t + 1 < members.length; t++) {
        const a = arrow([X(members[t]), y], [X(members[t + 1]), y], 15, 6);
        s += `<g fill="none" stroke="${CHAIN[j]}" stroke-width="1.3" stroke-linejoin="round"><path d="${a.line}"/><path d="${a.head}"/></g>`;
      }
      members.forEach(i => {
        if (data.changed.has(i)) s += `<circle cx="${X(i)}" cy="${y}" r="15" fill="none" stroke="${C.ink}" stroke-width="1.2"/>`;
        s += `<text x="${X(i)}" y="${y + 6}" text-anchor="middle" style="font-size:19px">${BIG[i]}</text>`;
        s += `<text x="${X(i)}" y="${y + 36}" text-anchor="middle" style="font-family:var(--sans);font-size:14px;fill:${data.changed.has(i) ? C.teal : C.muted}">${data.full.ell[i]}</text>`;
      });
    });
    s += `</svg>`;
    host.innerHTML = `<div class="xr-plot">${s}</div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Questions: the answer stays visible and the figure shows it.        */
  function mountQuiz(quiz, onAnswer) {
    const buttons = $$('button', quiz);
    buttons.forEach(choice => choice.addEventListener('click', () => {
      buttons.forEach(button => {
        const selected = button === choice;
        button.setAttribute('aria-pressed', String(selected));
        document.getElementById(button.getAttribute('aria-controls'))?.setAttribute('aria-hidden', String(!selected));
      });
      const step = quiz.closest('[data-xr-step]');
      if (step && quiz.dataset.xrDone) step.dataset.xrStep = quiz.dataset.xrDone;
      onAnswer();
    }));
  }

  /* Ordinary scrolling picks the paragraph nearest the middle of the screen. */
  const scrollies = [];
  const layout = window.matchMedia('screen and (min-width:761px) and (min-height:460px)');
  function update() {
    queued = false;
    const expert = root.dataset.route === 'expert' && !root.hasAttribute('data-route-pending');
    for (const {node, figure} of scrollies) {
      const steps = $$('.xr-step', node);
      if (!expert || !layout.matches) {
        steps.forEach(step => step.classList.add('is-active'));
        figure.set('full');
        continue;
      }
      const target = window.innerHeight * .5;
      let best = Infinity, active = steps[0];
      for (const step of steps) {
        const r = step.getBoundingClientRect();
        if (!r.height) continue;
        const d = Math.abs(r.top + r.height / 2 - target);
        if (d < best) { best = d; active = step; }
      }
      steps.forEach(step => step.classList.toggle('is-active', step === active));
      figure.set(active.dataset.xrStep);
    }
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  function init() {
    const figures = [
      ['#xr-chains-walk', '#xr-chain-plot', mountChainPlot],
      ['#xr-assign-walk', '#xr-corridor', mountCorridor],
      ['#xr-triangle-walk', '#xr-triangle', mountTriangle]
    ];
    for (const [walk, plot, mount] of figures) {
      const node = $(walk), host = $(plot);
      if (!node || !host) continue;
      const figure = mount(host);
      scrollies.push({node, figure});
      $$('.xr-quiz', node).forEach(quiz => mountQuiz(quiz, schedule));
    }
    const restrictionFigure = $('.xr-restriction');
    if (restrictionFigure && $('#xr-restriction')) mountRestriction(restrictionFigure);
    if ($('#xr-ladder')) mountLadder($('#xr-ladder'));
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    layout.addEventListener?.('change', schedule);
    document.addEventListener('quasiplanar-route-change', schedule);
    new MutationObserver(schedule).observe(root, {attributes: true, attributeFilter: ['data-route', 'data-route-pending']});
    update();
    window.QuasiplanarExpert = {analyse, restriction, update};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
