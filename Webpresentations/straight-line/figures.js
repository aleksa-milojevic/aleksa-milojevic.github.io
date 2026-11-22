/* Figures, scroll steps and small helpers for the straight-line presentation.
   Every figure is drawn once; scrolling only changes which parts are shown. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const r1 = v => Math.round(v * 10) / 10;
  const C = {ink: '#252b2b', muted: '#686c65', line: '#d8d9ce', grey: '#9ba298', faint: '#c9cbc0',
    orange: '#bb4b2e', teal: '#276b7c', violet: '#6c647d', paper: '#f7f5ee', wash: '#eeeee5', fill: '#e4e2d6'};

  /* ---------- mathematics ---------- */
  const tex = (src, display = false) => {
    try { return window.katex.renderToString(src, {displayMode: display, throwOnError: false, strict: 'ignore'}); }
    catch { return src; }
  };
  // A KaTeX label centred vertically at (x, y).
  function label(x, y, src, {size = 17, color = C.ink, anchor = 'middle', cls = '', data = ''} = {}) {
    const tx = anchor === 'middle' ? '-50%' : anchor === 'end' ? '-100%' : '0';
    return `<foreignObject x="${r1(x)}" y="${r1(y)}" width="1" height="1" class="${cls}" ${data} style="overflow:visible;pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" style="position:absolute;left:0;top:0;transform:translate(${tx},-50%);font-size:${size}px;line-height:1.1;white-space:nowrap;color:${color}">${tex(src)}</div></foreignObject>`;
  }
  function renderMath(root = document.body) {
    const re = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('script,style,svg,.katex') || !/\\[([]/.test(n.nodeValue)
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const s = node.nodeValue, frag = document.createDocumentFragment();
      let at = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        frag.append(s.slice(at, m.index));
        const span = document.createElement('span');
        window.katex.render(m[1] ?? m[2], span, {displayMode: m[2] !== undefined, throwOnError: false, strict: 'ignore'});
        frag.append(span);
        at = re.lastIndex;
      }
      frag.append(s.slice(at));
      node.replaceWith(frag);
    }
  }

  /* ---------- small geometry ---------- */
  const orient = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const crosses = (a, b, c, d) => orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  const show = (el, on, value = 1) => { if (el) el.style.opacity = on ? String(value) : '0'; };
  function clipLine(slope, p, box) {
    // the line of the given slope through p, clipped to box = [x0, x1, y0, y1]
    const [x0, x1, y0, y1] = box, pts = [];
    for (const x of [x0, x1]) { const y = p[1] + slope * (x - p[0]); if (y >= y0 && y <= y1) pts.push([x, y]); }
    if (Math.abs(slope) > 1e-9) for (const y of [y0, y1]) { const x = p[0] + (y - p[1]) / slope; if (x > x0 && x < x1) pts.push([x, y]); }
    return pts.length >= 2 ? [pts[0], pts[1]] : null;
  }
  const arrowHead = (x, y, dx, dy, s = 7) => {
    const l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l], n = [-u[1], u[0]];
    return `M${r1(x - u[0] * s + n[0] * s * .55)} ${r1(y - u[1] * s + n[1] * s * .55)}L${r1(x)} ${r1(y)}L${r1(x - u[0] * s - n[0] * s * .55)} ${r1(y - u[1] * s - n[1] * s * .55)}`;
  };

  /* ---------- the running example ---------- */
  const EX = {
    names: ['s1', 's2', 'v1', 'v2'],
    tex: {s1: 's_1', s2: 's_2', v1: 'v_1', v2: 'v_2'},
    P: {s1: [0, 0], s2: [1, 1.9], v1: [4, 2], v2: [5, 1]},
    color: {s1: C.teal, s2: '#5d98a5', v1: C.orange, v2: '#c98a3a'},
    edges: [['s1', 'v1', 'e'], ['s2', 'v2', 'f'], ['s1', 'v2', '']],
    a: 2.5
  };
  {
    const names = EX.names, P = EX.P;
    let gamma = Infinity;
    for (const u of names) for (const v of names) for (const w of names) {
      if (u >= v || w === u || w === v) continue;
      const s = (P[v][1] - P[u][1]) / (P[v][0] - P[u][0]);
      gamma = Math.min(gamma, Math.abs(P[w][1] - (P[u][1] + s * (P[w][0] - P[u][0]))));
    }
    EX.eps = Object.fromEntries(names.map((v, i) => [v, gamma / 4 * (0.9 - 0.07 * i)]));
  }
  const height = (p, X) => p[1] + X * (EX.a - p[0]);
  const twinOf = v => [EX.P[v][0], EX.P[v][1] - EX.eps[v]];
  const slopeOf = (u, v) => (EX.P[v][1] - EX.P[u][1]) / (EX.P[v][0] - EX.P[u][0]);
  // all tracks: own and twin
  const TRACKS = EX.names.flatMap(v => [{v, twin: false, p: EX.P[v]}, {v, twin: true, p: twinOf(v)}]);
  const isEdge = (u, v) => EX.edges.some(([a, b]) => (a === u && b === v) || (a === v && b === u));
  function trackEvents() {
    const ev = [];
    TRACKS.forEach((A, i) => TRACKS.forEach((B, j) => {
      if (j <= i || A.v === B.v) return;
      const X = (B.p[1] - A.p[1]) / (B.p[0] - A.p[0]);
      ev.push({X, c: height(A.p, X), i, j, own: !A.twin && !B.twin, edge: !A.twin && !B.twin && isEdge(A.v, B.v)});
    }));
    return ev.sort((a, b) => a.X - b.X);
  }

  /* Plane and diagram panels shared by the ruler, twin and crossing figures. */
  const PLANE = {box: [-0.7, 5.7, -1.0, 3.0], x0: 30, y0: 392, s: 65.6};
  const px = x => PLANE.x0 + (x - PLANE.box[0]) * PLANE.s;
  const py = y => PLANE.y0 - (y - PLANE.box[2]) * PLANE.s;
  const DIAG = {X0: -1.6, X1: 2.2, c0: -4.7, c1: 5.6, left: 560, right: 975, top: 40, bottom: 482};
  const dx = X => DIAG.left + (X - DIAG.X0) / (DIAG.X1 - DIAG.X0) * (DIAG.right - DIAG.left);
  const dy = c => DIAG.bottom - (c - DIAG.c0) / (DIAG.c1 - DIAG.c0) * (DIAG.bottom - DIAG.top);
  function diagramFrame(caption = true) {
    let s = `<g fill="none" stroke="${C.ink}" stroke-width="1.1"><path d="M${DIAG.left} ${DIAG.bottom}H${DIAG.right + 8}"/><path d="${arrowHead(DIAG.right + 10, DIAG.bottom, 1, 0, 7)}"/></g>`;
    if (caption) s += `<text class="sans" x="${DIAG.right}" y="${DIAG.bottom + 24}" text-anchor="end">slope of the lines</text><text class="sans" x="${DIAG.left - 30}" y="${DIAG.top - 14}">height on the stick</text>`;
    return s;
  }
  const trackLine = p => `M${r1(dx(DIAG.X0))} ${r1(dy(height(p, DIAG.X0)))}L${r1(dx(DIAG.X1))} ${r1(dy(height(p, DIAG.X1)))}`;

  /* ------------------------------------------------------------------ */
  function mountHero(host) {
    const A = [[0.4, 1.0], [0.8, 2.0], [1.2, 3.0], [1.6, 4.0]];
    const B = [[6.2, 4.4], [6.6, 3.4], [7.0, 2.4], [7.4, 1.4]];
    const O = [[3.0, 0.3], [3.7, 4.9], [4.4, 0.7], [2.5, 5.1], [5.1, 5.0], [5.5, 0.2]];
    const pts = [...A, ...B, ...O];
    const family = A.map((a, i) => [a, B[i]]);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
      if (!crosses(...family[i], ...family[j])) console.warn('hero family pair does not cross', i, j);
    const other = [[A[0], O[0]], [O[0], O[2]], [O[2], B[3]], [O[2], O[5]], [A[3], O[3]], [O[3], O[1]], [O[1], O[4]], [O[4], B[0]], [A[1], O[3]], [O[1], B[1]], [O[5], B[3]], [O[0], O[5]]];
    const X = x => 30 + x * 70, Y = y => 400 - y * 70;
    let s = `<svg viewBox="0 0 580 430" role="img" aria-label="A drawing with straight edges. Four orange edges cross each other pairwise.">`;
    s += `<g stroke="${C.teal}" stroke-width="1.5" stroke-linecap="round" opacity=".75">${other.map(([a, b]) => `<path d="M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}"/>`).join('')}</g>`;
    s += `<g stroke="${C.orange}" stroke-width="2.6" stroke-linecap="round">${family.map(([a, b]) => `<path d="M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}"/>`).join('')}</g>`;
    s += `<g fill="${C.ink}">${pts.map(p => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="5"/>`).join('')}</g></svg>`;
    host.innerHTML = s;
  }

  /* ------------------------------------------------------------------ */
  function mountEnds(host) {
    const P = {a: [0, 1.0], b: [2.2, 3.0], c: [3.2, 0.4], d: [5, 2.6], e: [6.6, 1.0]};
    const E = [['a', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'c'], ['b', 'd'], ['c', 'd'], ['c', 'e'], ['d', 'e']];
    const X = x => 50 + (x + 0.4) * 76, Y = y => 400 - (y + 0.1) * 92;
    const del = 0.32;
    const hasLeft = v => E.some(([u, w]) => w === v), hasRight = v => E.some(([u, w]) => u === v);
    const copy = (v, side) => {
      if (hasLeft(v) && hasRight(v)) return [P[v][0] + (side === 'in' ? -del : del), P[v][1]];
      return P[v];
    };
    let s = `<svg viewBox="0 0 640 420" role="img" aria-label="A drawing whose vertices with edges on both sides are split into two nearby vertices.">`;
    s += `<g class="orig">${E.map(([u, v]) => `<path data-b="${u === 'b' || v === 'b' ? 1 : 0}" d="M${X(P[u][0])} ${Y(P[u][1])}L${X(P[v][0])} ${Y(P[v][1])}" stroke="#4d5552" stroke-width="1.8" stroke-linecap="round"/>`).join('')}</g>`;
    s += `<g class="split">${E.map(([u, v]) => { const a = copy(u, 'out'), b = copy(v, 'in'); return `<path d="M${r1(X(a[0]))} ${r1(Y(a[1]))}L${r1(X(b[0]))} ${r1(Y(b[1]))}" stroke="#4d5552" stroke-width="1.8" stroke-linecap="round"/>`; }).join('')}</g>`;
    s += `<g class="orig-dots">${Object.entries(P).map(([v, p]) => `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="6" fill="${C.ink}"/>`).join('')}</g>`;
    let dots = '';
    for (const [v, p] of Object.entries(P)) {
      if (hasLeft(v)) { const q = copy(v, 'in'); dots += `<circle class="role" data-role="right" cx="${r1(X(q[0]))}" cy="${r1(Y(q[1]))}" r="6" fill="${C.ink}"/>`; }
      if (hasRight(v)) { const q = copy(v, 'out'); dots += `<circle class="role" data-role="left" cx="${r1(X(q[0]))}" cy="${r1(Y(q[1]))}" r="6" fill="${C.ink}"/>`; }
    }
    s += `<g class="split-dots">${dots}</g>`;
    const offs = {a: [-16, 18], b: [0, -22], c: [0, 24], d: [0, -22], e: [16, 20]};
    s += Object.entries(P).map(([v, p]) => label(X(p[0]) + offs[v][0], Y(p[1]) + offs[v][1], v, {size: 19, cls: 'name', data: `data-v="${v}"`})).join('');
    s += `</svg>`;
    host.innerHTML = s;
    const stages = {drawing: {}, mixed: {focus: true}, split: {split: true}, colors: {split: true, colors: true}};
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const o = stages[stage] || stages.colors;
      show($('.orig', host), !o.split); show($('.orig-dots', host), !o.split);
      show($('.split', host), o.split); show($('.split-dots', host), o.split);
      $$('.orig path', host).forEach(p => { p.style.opacity = o.focus && p.dataset.b !== '1' ? '.2' : '1'; p.setAttribute('stroke-width', o.focus && p.dataset.b === '1' ? '2.8' : '1.8'); });
      $$('.orig-dots circle', host).forEach((c, i) => { c.style.opacity = o.focus && i !== 1 ? '.3' : '1'; });
      $$('.split-dots .role', host).forEach(c => c.setAttribute('fill', o.colors ? (c.dataset.role === 'left' ? C.teal : C.orange) : C.ink));
    }, final: 'colors'};
  }

  /* ------------------------------------------------------------------ */
  function planeBase({twins = false, edges = 'none'} = {}) {
    let s = '';
    if (edges !== 'none') s += `<g class="pl-edges">${EX.edges.map(([u, v, name]) => `<path data-edge="${name || 'g'}" d="M${r1(px(EX.P[u][0]))} ${r1(py(EX.P[u][1]))}L${r1(px(EX.P[v][0]))} ${r1(py(EX.P[v][1]))}" stroke="${C.ink}" stroke-width="2" stroke-linecap="round"/>`).join('')}</g>`;
    for (const v of EX.names) {
      const p = EX.P[v];
      if (twins) { const t = twinOf(v); s += `<g class="pl-twin" data-v="${v}"><path d="M${r1(px(p[0]))} ${r1(py(p[1]))}V${r1(py(t[1]))}" stroke="${EX.color[v]}" stroke-width="1.5"/><circle cx="${r1(px(t[0]))}" cy="${r1(py(t[1]))}" r="3.6" fill="${C.paper}" stroke="${EX.color[v]}" stroke-width="1.6"/></g>`; }
      s += `<circle class="pl-dot" data-v="${v}" cx="${r1(px(p[0]))}" cy="${r1(py(p[1]))}" r="6" fill="${EX.color[v]}"/>`;
      const off = {s1: [-12, 20], s2: [-14, -18], v1: [6, -22], v2: [18, 18]}[v];
      s += label(px(p[0]) + off[0], py(p[1]) + off[1], EX.tex[v], {size: 18, color: EX.color[v], cls: 'pl-label', data: `data-v="${v}"`});
    }
    return s;
  }
  function stickLines(X) {
    // lines of slope X through every vertex, and the stick
    let s = '';
    for (const v of EX.names) {
      const seg = clipLine(X, EX.P[v], PLANE.box);
      if (seg) s += `<path data-v="${v}" d="M${r1(px(seg[0][0]))} ${r1(py(seg[0][1]))}L${r1(px(seg[1][0]))} ${r1(py(seg[1][1]))}" stroke="${EX.color[v]}" stroke-width="1.4" opacity=".7"/>`;
      const c = height(EX.P[v], X);
      if (c > PLANE.box[2] && c < PLANE.box[3]) s += `<circle cx="${r1(px(EX.a))}" cy="${r1(py(c))}" r="3.5" fill="${EX.color[v]}"/>`;
    }
    return s;
  }

  function mountRuler(host) {
    let s = `<svg viewBox="0 0 1000 520" role="img" aria-label="Left: four vertices and parallel lines through them. Right: the height of each line on a vertical stick, as the lines turn. Each vertex leaves a straight track, and every two tracks cross once.">`;
    s += `<g class="pl-lines"></g><path class="pl-stick" d="M${r1(px(EX.a))} ${py(PLANE.box[3])}V${py(PLANE.box[2])}" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    s += planeBase({edges: 'all'});
    s += diagramFrame();
    s += `<clipPath id="ruler-clip"><rect x="${DIAG.left - 5}" y="0" width="0" height="520"/></clipPath>`;
    s += `<g class="tracks" clip-path="url(#ruler-clip)">${EX.names.map(v => `<path data-v="${v}" d="${trackLine(EX.P[v])}" stroke="${EX.color[v]}" stroke-width="2.2" fill="none"/>`).join('')}</g>`;
    s += `<g class="track-labels">${EX.names.map(v => label(dx(DIAG.X0) - 14, dy(height(EX.P[v], DIAG.X0)), EX.tex[v], {size: 16, color: EX.color[v], anchor: 'end'})).join('')}</g>`;
    const own = trackEvents().filter(e => e.own);
    s += `<g class="crossings">${own.map(e => `<circle data-edge="${e.edge ? 1 : 0}" data-pair="${TRACKS[e.i].v}-${TRACKS[e.j].v}" cx="${r1(dx(e.X))}" cy="${r1(dy(e.c))}" r="4.5" fill="${C.ink}"/>`).join('')}</g>`;
    s += `<g class="edge-rings">${own.filter(e => e.edge).map(e => `<circle cx="${r1(dx(e.X))}" cy="${r1(dy(e.c))}" r="11" fill="none" stroke="${C.orange}" stroke-width="1.8"/>`).join('')}</g>`;
    const ePair = own.find(e => TRACKS[e.i].v === 's1' && TRACKS[e.j].v === 'v1');
    s += `<circle class="swap-ring" cx="${r1(dx(ePair.X))}" cy="${r1(dy(ePair.c))}" r="12" fill="none" stroke="${C.ink}" stroke-width="1.6"/>`;
    s += `<g class="now"><path d="" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="5 4"/><g class="marks"></g></g>`;
    s += `</svg>`;
    host.innerHTML = s;
    const clip = $('#ruler-clip rect', host), lines = $('.pl-lines', host), now = $('.now', host);
    function setX(X, drawTracksTo) {
      lines.innerHTML = stickLines(X);
      $('path', now).setAttribute('d', `M${r1(dx(X))} ${DIAG.top}V${DIAG.bottom}`);
      $('.marks', now).innerHTML = EX.names.map(v => `<circle cx="${r1(dx(X))}" cy="${r1(dy(height(EX.P[v], X)))}" r="4.5" fill="${EX.color[v]}"/>`).join('');
      clip.setAttribute('width', String(Math.max(0, dx(drawTracksTo) - DIAG.left + 5)));
    }
    let current = '';
    return {set(stage, p = 1) {
      const key = stage + (stage === 'sweep' ? r1(p * 100) : '');
      if (key === current) return; current = key;
      const X = {points: 0, stick: -0.45, swap: slopeOf('s1', 'v1')}[stage];
      const sweepX = DIAG.X0 + p * (DIAG.X1 - DIAG.X0);
      const tracksOn = ['sweep', 'swap', 'all', 'edges'].includes(stage);
      show(lines, ['points', 'stick', 'sweep', 'swap'].includes(stage));
      show($('.pl-stick', host), ['stick', 'sweep', 'swap'].includes(stage));
      show(now, ['stick', 'sweep', 'swap'].includes(stage));
      show($('.tracks', host), tracksOn); show($('.track-labels', host), tracksOn);
      show($('.crossings', host), ['all', 'edges'].includes(stage));
      show($('.edge-rings', host), stage === 'edges');
      show($('.swap-ring', host), stage === 'swap');
      show($('.pl-edges', host), stage === 'edges');
      $$('.crossings circle', host).forEach(c => c.setAttribute('fill', stage === 'edges' && c.dataset.edge !== '1' ? C.faint : C.ink));
      if (stage === 'sweep') setX(sweepX, sweepX);
      else if (stage in {points: 1, stick: 1, swap: 1}) setX(X, stage === 'swap' ? DIAG.X1 : DIAG.X0);
      else setX(0, DIAG.X1);
      if (stage === 'swap') $$('.pl-lines path', host).forEach(pth => pth.setAttribute('stroke-width', ['s1', 'v1'].includes(pth.dataset.v) ? '2.6' : '1.4'));
    }, final: 'edges'};
  }

  /* ------------------------------------------------------------------ */
  function bands(focus) {
    let s = '';
    for (const v of EX.names) {
      const p = EX.P[v], t = twinOf(v);
      const a0 = [dx(DIAG.X0), dy(height(p, DIAG.X0))], a1 = [dx(DIAG.X1), dy(height(p, DIAG.X1))];
      const b0 = [dx(DIAG.X0), dy(height(t, DIAG.X0))], b1 = [dx(DIAG.X1), dy(height(t, DIAG.X1))];
      s += `<g class="band" data-v="${v}"><path d="M${r1(a0[0])} ${r1(a0[1])}L${r1(a1[0])} ${r1(a1[1])}L${r1(b1[0])} ${r1(b1[1])}L${r1(b0[0])} ${r1(b0[1])}Z" fill="${EX.color[v]}" fill-opacity=".18"/><path d="${trackLine(p)}" stroke="${EX.color[v]}" stroke-width="2.2" fill="none"/><path d="${trackLine(t)}" stroke="${EX.color[v]}" stroke-width="1.2" fill="none"/></g>`;
    }
    s += `<g class="track-labels">${EX.names.map(v => label(dx(DIAG.X0) - 14, dy(height(EX.P[v], DIAG.X0)) + 2, EX.tex[v], {size: 16, color: EX.color[v], anchor: 'end'})).join('')}</g>`;
    return s;
  }
  function mountTwins(host) {
    const ev = trackEvents();
    let s = `<svg viewBox="0 0 1000 520" role="img" aria-label="Left: every vertex with its twin just below it. Right: the tracks of a vertex and its twin form a thin band; two bands cross in four places.">`;
    const eLine = clipLine(slopeOf('s1', 'v1'), EX.P.s1, PLANE.box);
    s += `<path class="e-line" d="M${r1(px(eLine[0][0]))} ${r1(py(eLine[0][1]))}L${r1(px(eLine[1][0]))} ${r1(py(eLine[1][1]))}" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="6 4"/>`;
    s += planeBase({twins: true, edges: 'all'});
    s += diagramFrame() + bands();
    s += `<g class="all-cross">${ev.map(e => `<circle cx="${r1(dx(e.X))}" cy="${r1(dy(e.c))}" r="3" fill="${C.ink}"/>`).join('')}</g>`;
    // zoom on the four crossings of s1 and v1
    const four = ev.filter(e => [TRACKS[e.i].v, TRACKS[e.j].v].sort().join() === 's1,v1');
    const Xm = four.reduce((a, e) => a + e.X, 0) / 4, cm = four.reduce((a, e) => a + e.c, 0) / 4;
    const Z = {x: 600, y: 60, w: 230, h: 170, sx: 1500, sy: 260};
    const zx = X => Z.x + Z.w / 2 + (X - Xm) * Z.sx, zy = c => Z.y + Z.h / 2 - (c - cm) * Z.sy;
    let zoom = `<rect x="${Z.x}" y="${Z.y}" width="${Z.w}" height="${Z.h}" fill="${C.paper}" stroke="${C.muted}" stroke-width="1"/><clipPath id="twin-zoom-clip"><rect x="${Z.x}" y="${Z.y}" width="${Z.w}" height="${Z.h}"/></clipPath><g clip-path="url(#twin-zoom-clip)">`;
    for (const tr of TRACKS.filter(t => t.v === 's1' || t.v === 'v1')) {
      const Xa = Xm - Z.w / Z.sx, Xb = Xm + Z.w / Z.sx;
      zoom += `<path d="M${r1(zx(Xa))} ${r1(zy(height(tr.p, Xa)))}L${r1(zx(Xb))} ${r1(zy(height(tr.p, Xb)))}" stroke="${EX.color[tr.v]}" stroke-width="${tr.twin ? 1.4 : 2.4}"/>`;
    }
    four.forEach((e, n) => {
      zoom += `<circle cx="${r1(zx(e.X))}" cy="${r1(zy(e.c))}" r="${e.own ? 9 : 4}" fill="${e.own ? 'none' : C.ink}" stroke="${e.own ? C.ink : 'none'}" stroke-width="1.6"/>`;
      const off = [[0, -14], [-16, -16], [14, 24], [0, 24]][n];
      zoom += `<text class="sans" x="${r1(zx(e.X) + off[0])}" y="${r1(zy(e.c) + off[1])}" text-anchor="middle" style="fill:${C.ink};font-size:13px">${n + 1}</text>`;
    });
    zoom += `</g>`;
    const zone = [dx(Xm), dy(cm)];
    zoom += `<path d="M${r1(zone[0])} ${r1(zone[1])}L${Z.x + Z.w / 2} ${Z.y + Z.h}" stroke="${C.muted}" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${r1(zone[0])}" cy="${r1(zone[1])}" r="9" fill="none" stroke="${C.muted}"/>`;
    s += `<g class="zoom">${zoom}</g></svg>`;
    host.innerHTML = s;
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const pair = stage === 'pair';
      $$('.band', host).forEach(b => { b.style.opacity = pair && !['s1', 'v1'].includes(b.dataset.v) ? '.2' : '1'; });
      show($('.zoom', host), pair);
      show($('.all-cross', host), stage === 'count');
      show($('.e-line', host), stage === 'thin');
      show($('.pl-edges', host), stage === 'thin' || pair);
      $$('.pl-edges path', host).forEach(p => { p.style.opacity = (stage === 'thin' || pair) && p.dataset.edge !== 'e' ? '.25' : '1'; });
    }, final: 'count'};
  }

  /* ------------------------------------------------------------------ */
  function mountMachine(host) {
    const ev = trackEvents(), L = TRACKS.length, k = 2;
    const X0 = ev[0].X - 1;
    let order = TRACKS.map((t, i) => i).sort((a, b) => height(TRACKS[b].p, X0) - height(TRACKS[a].p, X0));
    const Y = l => 58 + l * 52, Xg = g => 95 + g * (830 / (ev.length - 1)), d = 11;
    const paths = TRACKS.map((t, i) => [[40, Y(order.indexOf(i))]]);
    const gates = [];
    ev.forEach((e, g) => {
      const li = order.indexOf(e.i), lj = order.indexOf(e.j), top = Math.min(li, lj);
      [order[li], order[lj]] = [order[lj], order[li]];
      for (const [t, from, to] of [[e.i, li, lj], [e.j, lj, li]]) paths[t].push([Xg(g) - d, Y(from)], [Xg(g) + d, Y(to)]);
      gates.push({g, top, edge: e.edge, x: Xg(g)});
    });
    paths.forEach((p, i) => p.push([960, Y(order.indexOf(i))]));
    // run the middle levels
    const w = L - 2 * k, vals = Array.from({length: L}, (_, l) => (l >= k && l < k + w) ? w - (l - k) : null);
    const valPaths = {};
    for (let l = k; l < k + w; l++) valPaths[vals[l]] = [[40, Y(l)]];
    gates.forEach(gt => {
      const a = gt.top, b = a + 1;
      if (a < k || b >= k + w || gt.edge) return;
      if (vals[a] > vals[b]) {
        valPaths[vals[a]].push([gt.x - d, Y(a)], [gt.x + d, Y(b)]);
        valPaths[vals[b]].push([gt.x - d, Y(b)], [gt.x + d, Y(a)]);
        [vals[a], vals[b]] = [vals[b], vals[a]];
      }
    });
    for (let l = k; l < k + w; l++) valPaths[vals[l]].push([960, Y(l)]);
    let s = `<svg viewBox="0 0 1000 480" role="img" aria-label="The tracks drawn on eight horizontal levels, with a gate at every crossing. Three gates, one for each edge, are switched off. The middle four levels sort the numbers 4, 3, 2, 1.">`;
    s += `<g class="wires" stroke="${C.line}" stroke-width="1">${Array.from({length: L}, (_, l) => `<path d="M40 ${Y(l)}H960"/>`).join('')}</g>`;
    s += `<g class="mtracks" fill="none" stroke-linejoin="round">${paths.map((p, i) => `<polyline points="${p.map(q => q.map(r1).join(',')).join(' ')}" stroke="${EX.color[TRACKS[i].v]}" stroke-width="${TRACKS[i].twin ? 1.3 : 2.3}"/>`).join('')}</g>`;
    s += `<g class="mlabels">${TRACKS.map((t, i) => t.twin ? '' : label(26, paths[i][0][1], EX.tex[t.v], {size: 15, color: EX.color[t.v], anchor: 'end'})).join('')}</g>`;
    s += `<g class="gates">${gates.map(gt => `<g data-edge="${gt.edge ? 1 : 0}" data-out="${gt.top < k || gt.top + 1 >= k + w ? 1 : 0}"><path d="M${r1(gt.x)} ${Y(gt.top)}V${Y(gt.top + 1)}" stroke="${C.ink}" stroke-width="1.8"/><circle cx="${r1(gt.x)}" cy="${Y(gt.top)}" r="3.6" fill="${C.ink}"/><circle cx="${r1(gt.x)}" cy="${Y(gt.top + 1)}" r="3.6" fill="${C.ink}"/></g>`).join('')}</g>`;
    s += `<g class="veil"><rect x="0" y="${Y(0) - 26}" width="1000" height="${Y(k) - Y(0)}" fill="${C.wash}" opacity=".86"/><rect x="0" y="${Y(k + w) - 26}" width="1000" height="${Y(L) - Y(k + w)}" fill="${C.wash}" opacity=".86"/></g>`;
    s += `<g class="vals" fill="none" stroke-linejoin="round">${Object.entries(valPaths).map(([v, p]) => `<polyline points="${p.map(q => q.map(r1).join(',')).join(' ')}" stroke="${C.violet}" stroke-width="${1 + Number(v) * .55}" opacity=".85"/>`).join('')}</g>`;
    let nums = '';
    for (let l = k; l < k + w; l++) nums += `<text x="24" y="${Y(l) + 6}" text-anchor="middle" style="font-size:18px">${w - (l - k)}</text><text x="978" y="${Y(l) + 6}" text-anchor="middle" style="font-size:18px">${vals[l]}</text>`;
    s += `<g class="nums">${nums}</g></svg>`;
    host.innerHTML = s;
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const st = ['levels', 'gates', 'broken', 'middle', 'run'].indexOf(stage);
      const i = st < 0 ? 4 : st;
      $('.mtracks', host).style.opacity = i === 0 ? '1' : '.18';
      show($('.mlabels', host), i <= 1);
      show($('.gates', host), i >= 1);
      $$('.gates > g', host).forEach(g => {
        const broken = i >= 2 && g.dataset.edge === '1', out = i >= 3 && g.dataset.out === '1';
        g.style.opacity = out ? '.15' : '1';
        g.querySelector('path').setAttribute('stroke', broken ? C.orange : C.ink);
        g.querySelector('path').setAttribute('stroke-dasharray', broken ? '4 3' : 'none');
        g.querySelectorAll('circle').forEach(c => { c.setAttribute('fill', broken ? C.paper : C.ink); c.setAttribute('stroke', broken ? C.orange : 'none'); c.setAttribute('stroke-width', '1.6'); });
      });
      show($('.veil', host), i >= 3);
      show($('.vals', host), i >= 4); show($('.nums', host), i >= 4);
    }, final: 'run'};
  }

  /* ------------------------------------------------------------------ */
  /* The small abstract machine: six levels, odd-even rounds. */
  const TOY = {W: 6, rounds: 8};
  TOY.gates = [];
  for (let r = 0; r < TOY.rounds; r++) for (let t = r % 2; t < TOY.W - 1; t += 2) TOY.gates.push({r, t});
  const toyX = g => 112 + g * 38, toyY = l => 40 + l * 46;
  function toyRun(broken) {
    const vals = Array.from({length: TOY.W}, (_, l) => TOY.W - l), paths = {}, swapped = [];
    vals.forEach((v, l) => { paths[v] = [[60, toyY(l)]]; });
    TOY.gates.forEach((gt, g) => {
      const a = gt.t, b = a + 1;
      if (broken.has(g) || vals[a] <= vals[b]) { swapped.push(false); return; }
      paths[vals[a]].push([toyX(g) - 12, toyY(a)], [toyX(g) + 12, toyY(b)]);
      paths[vals[b]].push([toyX(g) - 12, toyY(b)], [toyX(g) + 12, toyY(a)]);
      [vals[a], vals[b]] = [vals[b], vals[a]];
      swapped.push(true);
    });
    vals.forEach((v, l) => paths[v].push([880, toyY(l)]));
    let left = 0;
    for (let i = 0; i < TOY.W; i++) for (let j = i + 1; j < TOY.W; j++) if (vals[i] > vals[j]) left++;
    return {vals, paths, swapped, left};
  }
  function toyGate(g, gt) {
    return `<g class="toy-gate" data-g="${g}" role="button" tabindex="0" aria-label="Gate ${g + 1} between levels ${gt.t + 1} and ${gt.t + 2}"><rect x="${toyX(g) - 14}" y="${toyY(gt.t) - 10}" width="28" height="${toyY(gt.t + 1) - toyY(gt.t) + 20}" fill="transparent"/><path class="toy-bar" d="M${toyX(g)} ${toyY(gt.t)}V${toyY(gt.t + 1)}" stroke-width="1.8"/><circle cx="${toyX(g)}" cy="${toyY(gt.t)}" r="4"/><circle cx="${toyX(g)}" cy="${toyY(gt.t + 1)}" r="4"/></g>`;
  }
  function styleGate(el, broken, swapped) {
    const bar = $('.toy-bar', el);
    bar.setAttribute('stroke', broken ? C.orange : swapped ? C.ink : C.grey);
    bar.setAttribute('stroke-dasharray', broken ? '4 3' : 'none');
    $$('circle', el).forEach(c => { c.setAttribute('fill', broken ? C.paper : swapped ? C.ink : C.grey); c.setAttribute('stroke', broken ? C.orange : 'none'); c.setAttribute('stroke-width', '1.6'); });
  }
  const valueColor = v => ['#9fbcc2', '#7ba5ae', '#57899a', '#3f6f80', '#334f59', '#252b2b'][v - 1] || C.ink;
  function mountToy(host, readout, reset) {
    const broken = new Set();
    function render() {
      const run = toyRun(broken);
      let s = `<svg viewBox="0 0 940 300" role="img" aria-label="A machine with six levels and twenty gates. Click a gate to switch it off.">`;
      s += `<g stroke="${C.line}">${Array.from({length: TOY.W}, (_, l) => `<path d="M60 ${toyY(l)}H880"/>`).join('')}</g>`;
      s += `<g fill="none" stroke-linejoin="round">${Object.entries(run.paths).map(([v, p]) => `<polyline points="${p.map(q => q.map(r1).join(',')).join(' ')}" stroke="${valueColor(Number(v))}" stroke-width="3" opacity=".75"/>`).join('')}</g>`;
      s += TOY.gates.map((gt, g) => toyGate(g, gt)).join('');
      for (let l = 0; l < TOY.W; l++) s += `<text x="38" y="${toyY(l) + 6}" text-anchor="middle" style="font-size:18px">${TOY.W - l}</text><text x="905" y="${toyY(l) + 6}" text-anchor="middle" style="font-size:18px;fill:${run.vals[l] === l + 1 ? C.ink : C.orange}">${run.vals[l]}</text>`;
      s += `</svg>`;
      host.innerHTML = s;
      $$('.toy-gate', host).forEach(el => { const g = Number(el.dataset.g); styleGate(el, broken.has(g), run.swapped[g]); });
      const swaps = run.swapped.filter(Boolean).length, total = TOY.gates.length;
      readout.innerHTML = `Working gates: <b>${total - broken.size}</b> of ${total}. Swaps made: <b>${swaps}</b>. Pairs still out of order: <b>${run.left}</b>. ` +
        (run.left ? `The machine is stuck.` : `The numbers are sorted.`) + ` Always: swaps + pairs left = 15.`;
    }
    host.addEventListener('click', e => {
      const el = e.target.closest('.toy-gate'); if (!el) return;
      const g = Number(el.dataset.g); broken.has(g) ? broken.delete(g) : broken.add(g); render();
    });
    host.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.toy-gate')) { e.preventDefault(); e.target.closest('.toy-gate').dispatchEvent(new MouseEvent('click', {bubbles: true})); } });
    reset?.addEventListener('click', () => { broken.clear(); render(); });
    render();
  }

  /* The same machine, stuck: blocked spots, the shaded region and the front. */
  function stuckData(broken, h) {
    const W = TOY.W, G = TOY.gates, S = G.length;
    const ok = g => !broken.has(g);
    // maximum number of disjoint routes, with unit capacity at every (slice, level)
    const id = (i, l, side) => (i * W + l) * 2 + side, SRC = (S + 1) * W * 2, SNK = SRC + 1;
    const cap = new Map(), adj = new Map();
    const add = (u, v, c) => { const k1 = u + ',' + v, k2 = v + ',' + u; cap.set(k1, (cap.get(k1) || 0) + c); if (!cap.has(k2)) cap.set(k2, 0); (adj.get(u) || adj.set(u, []).get(u)).push(v); (adj.get(v) || adj.set(v, []).get(v)).push(u); };
    for (let i = 0; i <= S; i++) for (let l = 0; l < W; l++) {
      add(id(i, l, 0), id(i, l, 1), 1);
      if (i < S) { add(id(i, l, 1), id(i + 1, l, 0), 99); if (ok(i) && G[i].t === l) add(id(i, l, 1), id(i + 1, l + 1, 0), 99); }
    }
    for (let l = 0; l < h; l++) add(SRC, id(0, l, 0), 99);
    for (let l = W - h; l < W; l++) add(id(S, l, 1), SNK, 99);
    let flow = 0, seen;
    for (;;) {
      const par = new Map([[SRC, -1]]), q = [SRC];
      while (q.length && !par.has(SNK)) { const u = q.shift(); for (const v of adj.get(u) || []) if (!par.has(v) && cap.get(u + ',' + v) > 0) { par.set(v, u); q.push(v); } }
      seen = par;
      if (!par.has(SNK)) break;
      for (let v = SNK; par.get(v) !== -1; v = par.get(v)) { const u = par.get(v); cap.set(u + ',' + v, cap.get(u + ',' + v) - 1); cap.set(v + ',' + u, cap.get(v + ',' + u) + 1); }
      flow++;
    }
    const cut = [];
    for (let i = 0; i <= S; i++) for (let l = 0; l < W; l++) if (seen.has(id(i, l, 0)) && !seen.has(id(i, l, 1))) cut.push([i, l]);
    const blocked = new Set(cut.map(([i, l]) => i + ',' + l));
    const reach = [new Set([...Array(h).keys()].filter(l => !blocked.has('0,' + l)))];
    for (let g = 0; g < S; g++) {
      const A = new Set(reach[g]);
      if (ok(g) && A.has(G[g].t)) A.add(G[g].t + 1);
      reach.push(new Set([...A].filter(l => !blocked.has((g + 1) + ',' + l))));
    }
    return {flow, cut, reach, front: reach.map(A => Math.max(...A))};
  }
  function mountStuck(host) {
    const broken = new Set([3, 7, 19]), h = 2, W = TOY.W, G = TOY.gates;
    const data = stuckData(broken, h), run = toyRun(broken);
    const slx = i => i === 0 ? 78 : toyX(i - 1) + 19;
    let s = `<svg viewBox="0 0 940 300" role="img" aria-label="The machine with three gates switched off. Two heavy numbers start on the top levels and do not reach the bottom. One blocked spot separates top from bottom. The front is the lowest level reachable from the top.">`;
    s += `<rect class="target" x="60" y="${toyY(W - h) - 16}" width="820" height="${toyY(W - 1) - toyY(W - h) + 32}" fill="${C.wash}"/>`;
    s += `<g stroke="${C.line}">${Array.from({length: W}, (_, l) => `<path d="M60 ${toyY(l)}H880"/>`).join('')}</g>`;
    let reach = '';
    data.reach.forEach((A, i) => {
      for (const l of A) reach += `<path d="M${r1(slx(i))} ${toyY(l)}H${r1(i < G.length ? toyX(i) : 880)}"/>`;
      if (i < G.length && !broken.has(i) && A.has(G[i].t)) reach += `<path d="M${r1(toyX(i))} ${toyY(G[i].t)}L${r1(slx(i + 1))} ${toyY(G[i].t + 1)}"/>`;
      if (i < G.length) for (const l of data.reach[i + 1]) if (A.has(l) || (l === G[i].t + 1 && !broken.has(i))) reach += `<path d="M${r1(toyX(i))} ${toyY(l)}H${r1(slx(i + 1))}"/>`;
    });
    s += `<g class="reach" stroke="${C.teal}" stroke-width="9" stroke-linecap="round" opacity=".22" fill="none">${reach}</g>`;
    s += G.map((gt, g) => toyGate(g, gt)).join('');
    // the front: lowest reachable level, slice by slice
    let fp = `M${slx(0) - 18} ${toyY(data.front[0])}`;
    for (let i = 0; i < G.length; i++) {
      const a = data.front[i], b = data.front[i + 1];
      if (b > a) fp += `L${r1(toyX(i))} ${toyY(a)}L${r1(slx(i + 1))} ${toyY(b)}`;
      else if (b < a) fp += `L${r1(slx(i + 1))} ${toyY(a)}L${r1(slx(i + 1))} ${toyY(b)}`;
    }
    fp += `L880 ${toyY(data.front[G.length])}`;
    s += `<path class="front" d="${fp}" fill="none" stroke="${C.ink}" stroke-width="3.2" stroke-linejoin="round"/>`;
    s += `<g class="blocked">${data.cut.map(([i, l]) => { const x = slx(i), y = toyY(l); return `<path d="M${r1(x - 8)} ${y - 8}L${r1(x + 8)} ${y + 8}M${r1(x - 8)} ${y + 8}L${r1(x + 8)} ${y - 8}" stroke="${C.orange}" stroke-width="3" stroke-linecap="round"/>`; }).join('')}</g>`;
    let tok = '';
    for (let l = 0; l < W; l++) {
      tok += `<circle cx="38" cy="${toyY(l)}" r="8" fill="${l < h ? C.ink : C.paper}" stroke="${C.ink}" stroke-width="1.5"/>`;
      tok += `<circle cx="905" cy="${toyY(l)}" r="8" fill="${run.vals[l] > W - h ? C.ink : C.paper}" stroke="${C.ink}" stroke-width="1.5"/>`;
    }
    s += `<g class="tokens">${tok}</g></svg>`;
    host.innerHTML = s;
    $$('.toy-gate', host).forEach(el => { const g = Number(el.dataset.g); styleGate(el, broken.has(g), !broken.has(g)); el.removeAttribute('tabindex'); el.removeAttribute('role'); el.style.cursor = 'default'; });
    if (data.flow >= h || data.cut.length > h - 1) console.warn('stuck example is not stuck as expected', data);
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const i = ['tokens', 'blocked', 'reach', 'front'].indexOf(stage), n = i < 0 ? 3 : i;
      show($('.blocked', host), n >= 1); show($('.reach', host), n >= 2, .22); show($('.front', host), n >= 3);
    }, final: 'front'};
  }

  /* ------------------------------------------------------------------ */
  /* An imagined piece of the picture of tracks, to show the rules of the front. */
  function mountFront(host) {
    const T = {
      g1: x => 164, twin: x => 74 + .55 * x, v: x => 40 + .55 * x, s: x => 420 - .6 * x, g2: x => 60 + .25 * x
    };
    // Events, in order: the twin meets g1 (163.6), v meets g1 (225.5), blocked spot (262),
    // the twin meets s below the front (300.9), the edge sv (330.4), s meets g2 (423.5).
    const X = x => 40 + x, line = f => `M${X(0)} ${r1(f(0))}L${X(600)} ${r1(f(600))}`;
    const JUMP = 262, LIFT = 380 / 1.15, DOWN = 360 / .85;
    const pts = [[0, 164], [90 / .55, 164], [JUMP, T.twin(JUMP)], [JUMP, T.v(JUMP)], [LIFT, T.v(LIFT)], [DOWN, T.s(DOWN)], [600, T.g2(600)]];
    const fpath = 'M' + pts.map(([x, y]) => `${X(x)} ${r1(y)}`).join('L');
    let s = `<svg viewBox="0 0 700 440" role="img" aria-label="Tracks over time. The band of a right end v descends and the track of a left end s rises. The front follows the twin of v down, jumps up at a blocked spot, is lifted at the switched-off gate of the edge sv, and then goes down again.">`;
    s += `<g fill="none" stroke-width="2"><path d="${line(T.g1)}" stroke="${C.grey}"/><path d="${line(T.g2)}" stroke="${C.grey}"/>`;
    s += `<path d="M${X(0)} ${r1(T.v(0))}L${X(600)} ${r1(T.v(600))}L${X(600)} ${r1(T.twin(600))}L${X(0)} ${r1(T.twin(0))}Z" fill="${C.orange}" fill-opacity=".14" stroke="none"/>`;
    s += `<path d="${line(T.v)}" stroke="${C.orange}" stroke-width="2.4"/><path d="${line(T.twin)}" stroke="${C.orange}" stroke-width="1.3"/><path d="${line(T.s)}" stroke="${C.teal}" stroke-width="2.4"/></g>`;
    s += label(X(4), T.v(0) - 16, 'v', {size: 18, color: C.orange, anchor: 'start'});
    s += `<text class="sans" x="${X(70)}" y="${r1(T.twin(70) + 22)}">twin of v</text>`;
    s += label(X(4), T.s(0) - 16, 's', {size: 18, color: C.teal, anchor: 'start'});
    s += `<clipPath id="front-clip"><rect x="0" y="0" width="0" height="440"/></clipPath>`;
    s += `<path class="fpath" d="${fpath}" clip-path="url(#front-clip)" fill="none" stroke="${C.ink}" stroke-width="4.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<g class="mk-follow"><circle cx="${r1(X(pts[1][0]))}" cy="164" r="5" fill="${C.ink}"/></g>`;
    s += `<g class="mk-jump"><path d="M${X(JUMP) - 8} ${r1(T.twin(JUMP) - 8)}l16 16m0 -16l-16 16" stroke="${C.orange}" stroke-width="3" stroke-linecap="round"/><text class="sans" x="${X(JUMP) - 14}" y="${r1(T.twin(JUMP) + 6)}" text-anchor="end">blocked spot</text></g>`;
    s += `<g class="mk-lift"><circle cx="${r1(X(LIFT))}" cy="${r1(T.v(LIFT))}" r="7" fill="${C.paper}" stroke="${C.orange}" stroke-width="2"/><text class="sans" x="${r1(X(LIFT) + 14)}" y="${r1(T.v(LIFT) - 14)}">switched-off gate of the edge sv</text></g>`;
    s += `<g class="mk-down"><circle cx="${r1(X(DOWN))}" cy="${r1(T.s(DOWN))}" r="5" fill="${C.ink}"/></g>`;
    s += `<g class="mk-front">${label(X(150), 140, '\\text{front}', {size: 16, color: C.ink})}</g>`;
    s += `</svg>`;
    host.innerHTML = s;
    const clip = $('#front-clip rect', host);
    const reveal = {follow: 240, jump: 300, lift: 380, down: 600, pass: 600};
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const to = reveal[stage] ?? 600;
      clip.setAttribute('width', String(X(to) + 6));
      show($('.mk-jump', host), to >= 300); show($('.mk-lift', host), to >= 380); show($('.mk-down', host), to >= 600);
    }, final: 'pass'};
  }

  /* ------------------------------------------------------------------ */
  function mountCrossing(host) {
    const ev = trackEvents();
    const moment = name => ev.find(e => e.edge && EX.edges.find(([u, v, n]) => n === name && [u, v].includes(TRACKS[e.i].v) && [u, v].includes(TRACKS[e.j].v)));
    const mf = moment('f'), me = moment('e');
    let s = `<svg viewBox="0 0 1000 520" role="img" aria-label="Left: the edges e and f and the lines through them. Right: the bands of the four vertices; at the moment of each edge, the bands of the other edge's ends lie on opposite sides of the crossing point.">`;
    for (const [name, a, b] of [['f', 's2', 'v2'], ['e', 's1', 'v1']]) {
      const seg = clipLine(slopeOf(a, b), EX.P[a], PLANE.box);
      s += `<path class="pl-line" data-edge="${name}" d="M${r1(px(seg[0][0]))} ${r1(py(seg[0][1]))}L${r1(px(seg[1][0]))} ${r1(py(seg[1][1]))}" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="6 4"/>`;
    }
    // drop lines from the other edge's ends to each line
    for (const [name, a, b, others] of [['f', 's2', 'v2', ['s1', 'v1']], ['e', 's1', 'v1', ['s2', 'v2']]]) {
      const sl = slopeOf(a, b);
      s += `<g class="drops" data-edge="${name}">${others.map(o => { const p = EX.P[o], yl = EX.P[a][1] + sl * (p[0] - EX.P[a][0]); return `<path d="M${r1(px(p[0]))} ${r1(py(p[1]))}V${r1(py(yl))}" stroke="${EX.color[o]}" stroke-width="1.6" stroke-dasharray="3 3"/>`; }).join('')}</g>`;
    }
    s += planeBase({twins: true, edges: 'all'});
    const ix = (() => { const A = EX.P.s1, B = EX.P.v1, Cc = EX.P.s2, D = EX.P.v2; const t = orient(Cc, D, A) / (orient(Cc, D, A) - orient(Cc, D, B)); return [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])]; })();
    s += `<circle class="x-point" cx="${r1(px(ix[0]))}" cy="${r1(py(ix[1]))}" r="9" fill="none" stroke="${C.ink}" stroke-width="1.8"/>`;
    s += diagramFrame() + bands();
    for (const [name, m] of [['f', mf], ['e', me]]) {
      s += `<g class="moment" data-edge="${name}"><path d="M${r1(dx(m.X))} ${DIAG.top}V${DIAG.bottom}" stroke="${C.muted}" stroke-width="1.2" stroke-dasharray="5 4"/><circle cx="${r1(dx(m.X))}" cy="${r1(dy(m.c))}" r="7" fill="${C.ink}"/>${label(dx(m.X) + 10, dy(m.c) - 18, '\\text{front}', {size: 14, color: C.ink, anchor: 'start'})}${label(dx(m.X), DIAG.top - 14, '\\text{moment of } ' + name, {size: 14, color: C.muted})}</g>`;
    }
    s += `</svg>`;
    host.innerHTML = s;
    const stages = {
      moment: {m: 'f', line: 'f', focus: ['s2', 'v2']},
      sides: {m: 'f', line: 'f', focus: ['s1', 'v1'], drops: 'f'},
      bands: {m: 'f', line: 'f', focus: ['s1', 'v1'], drops: 'f', twins: true},
      other: {m: 'e', line: 'e', focus: ['s2', 'v2'], drops: 'e', twins: true},
      cross: {cross: true, twins: true}
    };
    let current;
    return {set(stage) {
      if (stage === current) return; current = stage;
      const o = stages[stage] || stages.cross;
      $$('.moment', host).forEach(g => show(g, g.dataset.edge === o.m));
      $$('.pl-line', host).forEach(g => show(g, g.dataset.edge === o.line, .9));
      $$('.drops', host).forEach(g => show(g, g.dataset.edge === o.drops));
      $$('.pl-twin', host).forEach(g => show(g, o.twins));
      $$('.band', host).forEach(b => {
        const on = !o.focus || o.focus.includes(b.dataset.v) || (o.m === 'f' ? ['s2', 'v2'] : ['s1', 'v1']).includes(b.dataset.v);
        b.style.opacity = on ? '1' : '.2';
        $('path', b).style.opacity = o.twins ? '1' : '0';
        $$('path', b)[2].style.opacity = o.twins ? '1' : '0';
      });
      $$('.pl-edges path', host).forEach(p => {
        const name = p.dataset.edge;
        p.style.opacity = name === 'g' ? '.15' : (o.cross || name === o.line || (o.focus && ((name === 'e' && o.focus.includes('s1')) || (name === 'f' && o.focus.includes('s2'))))) ? '1' : '.3';
        p.setAttribute('stroke-width', o.cross && name !== 'g' ? '3' : '2');
      });
      show($('.x-point', host), o.cross);
    }, final: 'cross'};
  }

  /* ------------------------------------------------------------------ */
  /* Scroll steps: the paragraph nearest the middle of the screen chooses the stage. */
  const scrollies = [];
  const wide = window.matchMedia('(min-width:901px)');
  function updateSteps() {
    queued = false;
    for (const s of scrollies) {
      if (!wide.matches) { s.steps.forEach(st => st.classList.add('is-active')); s.figure.set(s.figure.final, 1); continue; }
      const target = window.innerHeight * .5;
      let best = Infinity, active = s.steps[0];
      for (const st of s.steps) {
        const r = st.getBoundingClientRect();
        const c = st.classList.contains('sweep') ? clamp(target, r.top, r.bottom) : r.top + r.height / 2;
        const d = Math.abs(c - target);
        if (d < best) { best = d; active = st; }
      }
      s.steps.forEach(st => st.classList.toggle('is-active', st === active));
      let progress = 1;
      if (active.classList.contains('sweep')) { const r = active.getBoundingClientRect(); progress = clamp((target - r.top) / Math.max(1, r.height - window.innerHeight * .2)); }
      s.figure.set(active.dataset.stage, progress);
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    $('.reading-progress span').style.transform = `scaleX(${max > 0 ? clamp(window.scrollY / max) : 0})`;
    updateNav();
  }
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(updateSteps); } };

  /* Questions: the chosen answer stays visible. */
  function mountQuiz(quiz) {
    const buttons = $$('button', quiz);
    buttons.forEach(choice => choice.addEventListener('click', () => buttons.forEach(b => {
      const on = b === choice;
      b.setAttribute('aria-pressed', String(on));
      document.getElementById(b.getAttribute('aria-controls'))?.setAttribute('aria-hidden', String(!on));
    })));
  }

  /* Section overview */
  let navLinks = [];
  function buildNav() {
    const nav = $('.section-nav');
    $$('#story > section.chapter').forEach((sec, i) => {
      const a = document.createElement('a');
      a.href = '#' + sec.id;
      a.innerHTML = `<span>${String(i + 1).padStart(2, '0')}</span>${sec.dataset.label}`;
      nav.append(a);
      navLinks.push([a, sec]);
    });
  }
  function updateNav() {
    let active = null;
    for (const [a, sec] of navLinks) if (sec.getBoundingClientRect().top < 160) active = a;
    navLinks.forEach(([a]) => a === active ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'));
  }

  function init() {
    renderMath();
    buildNav();
    mountHero($('#hero-figure'));
    const figures = [['#ends-walk', '#ends-figure', mountEnds], ['#ruler-walk', '#ruler-figure', mountRuler],
      ['#twins-walk', '#twins-figure', mountTwins], ['#machine-walk', '#machine-figure', mountMachine],
      ['#stuck-walk', '#stuck-figure', mountStuck], ['#front-walk', '#front-figure', mountFront],
      ['#crossing-walk', '#crossing-figure', mountCrossing]];
    for (const [walk, plot, mount] of figures) {
      const node = $(walk), host = $(plot);
      if (!node || !host) continue;
      try { scrollies.push({node, steps: $$('.step', node), figure: mount(host)}); }
      catch (err) { console.error('figure failed', plot, err); }
    }
    mountToy($('#toy-machine'), $('#toy-readout'), $('#toy-reset'));
    $$('.quiz').forEach(mountQuiz);
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    wide.addEventListener?.('change', schedule);
    updateSteps();
    window.StraightLine = {EX, TRACKS, trackEvents, toyRun, stuckData};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
