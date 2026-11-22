/*!
 * Quasiplanar stability lab.
 *
 * A dependency-free SVG comparison of the Erdős–Szekeres decomposition of a
 * finite set S′ with the decomposition of a subset S cut out as in one of the
 * four cases of the successor-change lemma (lemma:erdos-szekeres in main.tex).
 *
 * API
 *   window.QuasiplanarStability.mount(root[, options]) -> controller
 *     root     Element, selector string, or omitted (defaults to #stability-lab)
 *     options  { cut: 'smallest' | 'largest' | 'first' | 'last',
 *                retained: 1..9, showTitle: true, lemmaName: string }
 *   controller.setCut(key), controller.setRetained(m), controller.getState(),
 *   controller.destroy()
 *   window.QuasiplanarStability.compute(cutKey, m)   pure computation
 *   window.QuasiplanarStability.decompose(ids)       pure computation
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Data and pure computation                                           */
  /* ------------------------------------------------------------------ */

  // Position i (1-based) in the left order holds value PERMUTATION[i-1];
  // the value is the element's place in the right order. Values are distinct,
  // so the value doubles as the element's identifier.
  var PERMUTATION = [4, 2, 1, 7, 5, 3, 9, 8, 6, 10];
  var N = PERMUTATION.length;
  var M_MIN = 1;
  var M_MAX = N - 1;
  var DEFAULT_M = 5;
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function math(tex) { return global.QuasiplanarDiagramMath ? global.QuasiplanarDiagramMath.html(String(tex)) : escapeHTML(tex); }
  function mathText(value) {
    var source = String(value), tokens = /\d+(?:[–−]\d+)?|S′|\b[DSk]\b|[≤≥=]/g, output = '', offset = 0, match;
    while ((match = tokens.exec(source))) {
      output += escapeHTML(source.slice(offset, match.index)) + math(match[0].replace('S′', "S'").replace(/[–−]/g, '-').replace('≤', '\\le').replace('≥', '\\ge'));
      offset = match.index + match[0].length;
    }
    return output + escapeHTML(source.slice(offset));
  }

  var ELEMENTS = PERMUTATION.map(function (value, index) {
    return { id: value, pos: index + 1, val: value };
  });
  var BY_ID = {};
  ELEMENTS.forEach(function (e) { BY_ID[e.id] = e; });
  var BY_POS = ELEMENTS.slice();
  var BY_VAL = ELEMENTS.slice().sort(function (a, b) { return a.val - b.val; });

  function binom2(k) { return k * (k - 1) / 2; }

  function clampM(m) {
    m = Math.round(Number(m));
    if (!isFinite(m)) return DEFAULT_M;
    return Math.min(M_MAX, Math.max(M_MIN, m));
  }

  // Erdős–Szekeres decomposition of the elements with the given ids.
  // rank(x) = 1 + max rank(y) over earlier y with larger value (1 if none),
  // i.e. the length of the longest decreasing sequence ending at x.
  // The successor of x is the next element (in the left order) of equal rank.
  function decompose(ids) {
    var els = ids.map(function (id) { return BY_ID[id]; })
      .sort(function (a, b) { return a.pos - b.pos; });
    var rank = {};
    var width = 0;
    els.forEach(function (e, i) {
      var best = 0;
      for (var j = 0; j < i; j++) {
        var f = els[j];
        if (f.val > e.val && rank[f.id] > best) best = rank[f.id];
      }
      rank[e.id] = best + 1;
      if (best + 1 > width) width = best + 1;
    });
    var layers = [];
    for (var r = 0; r < width; r++) layers.push([]);
    els.forEach(function (e) { layers[rank[e.id] - 1].push(e.id); });
    var succ = {};
    layers.forEach(function (layer) {
      layer.forEach(function (id, i) {
        succ[id] = i + 1 < layer.length ? layer[i + 1] : null;
      });
    });
    return {
      order: els.map(function (e) { return e.id; }),
      rank: rank,
      layers: layers,
      succ: succ,
      width: width
    };
  }

  var FULL = decompose(ELEMENTS.map(function (e) { return e.id; }));
  // Smallest k for which S′ has no decreasing sequence of length k.
  var K = FULL.width + 1;

  function rangeText(noun, lo, hi) {
    return lo === hi ? noun + ' ' + lo : noun + 's ' + lo + '–' + hi;
  }

  function binomHTML(n, r) {
    return math('\\binom{' + n + '}{' + r + '}');
  }

  function binomBound(k) {
    return {
      relation: 'le',
      value: binom2(k),
      tex: '\\le \\binom{' + k + '}{2} = ' + binom2(k),
      html: math('\\le \\binom{' + k + '}{2} = ' + binom2(k)),
      text: 'at most ' + k + ' choose 2, which is ' + binom2(k)
    };
  }

  function theElements(m) { return m === 1 ? 'the element that is' : 'the ' + m + ' elements that are'; }
  function firstLast(word, m) { return m === 1 ? 'the ' + word + ' element' : 'the ' + word + ' ' + m + ' elements'; }

  var CUTS = [
    {
      key: 'smallest', label: 'Smallest values', clause: 1,
      metaHTML: 'case ' + math('(1)') + ', smallest under ' + math('\\prec_R'),
      pick: function (m) { return BY_VAL.slice(0, m); },
      describe: function (m) {
        return theElements(m) + ' smallest in the right order (' + rangeText('value', 1, m) + ')';
      },
      bound: binomBound
    },
    {
      key: 'largest', label: 'Largest values', clause: 2,
      metaHTML: 'case ' + math('(2)') + ', largest under ' + math('\\prec_R'),
      pick: function (m) { return BY_VAL.slice(N - m); },
      describe: function (m) {
        return theElements(m) + ' largest in the right order (' + rangeText('value', N - m + 1, N) + ')';
      },
      bound: function () {
        return { relation: 'eq', value: 0, tex: '= 0', html: math('= 0'), text: 'exactly 0' };
      }
    },
    {
      key: 'first', label: 'First positions', clause: 3,
      metaHTML: 'case ' + math('(3)') + ', first under ' + math('\\prec_L'),
      pick: function (m) { return BY_POS.slice(0, m); },
      describe: function (m) {
        return firstLast('first', m) + ' in the left order (' + rangeText('position', 1, m) + ')';
      },
      bound: function (k) {
        return {
          relation: 'le',
          value: k - 1,
          tex: '\\le k - 1 = ' + (k - 1),
          html: math('\\le k - 1 = ' + (k - 1)),
          text: 'at most k minus 1, which is ' + (k - 1)
        };
      }
    },
    {
      key: 'last', label: 'Last positions', clause: 4,
      metaHTML: 'case ' + math('(4)') + ', last under ' + math('\\prec_L'),
      pick: function (m) { return BY_POS.slice(N - m); },
      describe: function (m) {
        return firstLast('last', m) + ' in the left order (' + rangeText('position', N - m + 1, N) + ')';
      },
      bound: binomBound
    }
  ];
  var CUT_BY_KEY = {};
  CUTS.forEach(function (c) { CUT_BY_KEY[c.key] = c; });

  // Compare successors (by element id, with null meaning "no successor")
  // of every common element x in S under the decompositions of S and S′.
  function compute(cutKey, m) {
    var cut = CUT_BY_KEY[cutKey] || CUTS[0];
    m = clampM(m);
    var picked = cut.pick(m).map(function (e) { return e.id; });
    var inS = {};
    picked.forEach(function (id) { inS[id] = true; });
    var sub = decompose(picked);
    var rows = sub.order.map(function (id) {
      var e = BY_ID[id];
      var sf = FULL.succ[id];
      var ss = sub.succ[id];
      return {
        id: id, pos: e.pos, val: e.val,
        rankFull: FULL.rank[id], rankSub: sub.rank[id],
        succFull: sf, succSub: ss,
        changed: sf !== ss
      };
    });
    var changed = rows.filter(function (r) { return r.changed; }).map(function (r) { return r.id; });
    var bound = cut.bound(K);
    var D = changed.length;
    return {
      cut: cut.key,
      clause: cut.clause,
      m: m,
      inS: inS,
      full: FULL,
      sub: sub,
      rows: rows,
      changed: changed,
      D: D,
      k: K,
      bound: bound,
      holds: bound.relation === 'le' ? D <= bound.value : D === bound.value,
      attained: D === bound.value
    };
  }

  /* ------------------------------------------------------------------ */
  /* Geometry (shared by both plots, so a dot never moves between them)   */
  /* ------------------------------------------------------------------ */

  var G = { W: 400, H: 374, l: 50, r: 58, t: 26, b: 54, dot: 10.5 };
  G.pw = G.W - G.l - G.r;
  G.ph = G.H - G.t - G.b;
  function sx(pos) { return G.l + (pos - 0.5) * G.pw / N; }
  function sy(val) { return G.t + G.ph - (val - 0.5) * G.ph / N; }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var instanceCount = 0;

  function svgEl(tag, attrs, parent) {
    var node = document.createElementNS(SVGNS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (a) { node.setAttribute(a, attrs[a]); });
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function svgMath(parent, x, y, tex, attrs) {
    var group = svgEl('g', null, parent);
    if (global.QuasiplanarDiagramMath) global.QuasiplanarDiagramMath.setSvgLabel(group, x, y, String(tex), attrs || '');
    else {
      var t = svgEl('text', { x: x, y: y }, group);
      var holder = document.createElement('div');
      holder.innerHTML = '<svg><text ' + (attrs || '') + '></text></svg>';
      var fallback = holder.querySelector('text');
      if (fallback) Array.from(fallback.attributes).forEach(function (a) { t.setAttribute(a.name, a.value); });
      t.textContent = String(tex);
    }
    return group;
  }

  function axisLabel(parent, x, y, html, transform) {
    var group = svgEl('g', transform ? { transform: transform } : null, parent);
    var object = svgEl('foreignObject', { x: x - 160, y: y - 13, width: 320, height: 28, 'class': 'sl-axis-title', 'pointer-events': 'none' }, group);
    var text = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    text.style.cssText = 'text-align:center;white-space:nowrap;line-height:1.3';
    text.innerHTML = html; object.appendChild(text);
    return group;
  }

  function htmlEl(tag, attrs, html, parent) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (a) { node.setAttribute(a, attrs[a]); });
    }
    if (html != null) node.innerHTML = html;
    if (parent) parent.appendChild(node);
    return node;
  }

  function succText(id) { return id == null ? 'no successor' : 'successor ' + id; }
  function succShort(id) { return id == null ? 'none' : String(id); }

  var SP = 'S′';
  var SP_HTML = math("S'");
  var S_HTML = math('S');

  /* ------------------------------------------------------------------ */
  /* Mount                                                                */
  /* ------------------------------------------------------------------ */

  function mount(root, options) {
    if (typeof root === 'string') root = document.querySelector(root);
    if (!root) root = document.getElementById('stability-lab');
    if (!root) throw new Error('QuasiplanarStability.mount: root element not found');
    if (root.__quasiplanarStability) return root.__quasiplanarStability;

    options = options || {};
    var uid = 'sl' + (++instanceCount);
    var lemmaName = options.lemmaName || 'the successor-change lemma';
    var state = {
      cut: CUT_BY_KEY[options.cut] ? options.cut : 'smallest',
      m: options.retained != null ? clampM(options.retained) : DEFAULT_M,
      pinned: null,
      hover: null,
      focus: null,
      active: ELEMENTS[0].id
    };
    var result = null;

    root.classList.add('sl');
    root.innerHTML = '';
    var app = htmlEl('div', { 'class': 'sl-app' }, null, root);

    /* Intro ------------------------------------------------------------ */
    if (options.showTitle !== false) {
      htmlEl('h3', { 'class': 'sl-title' },
        'How stable is the Erdős–Szekeres decomposition under a cut?', app);
    }
    htmlEl('p', { 'class': 'sl-lead' },
      'Choose which integers to retain. Compare their successors in the full sequence and in the ' +
      'shorter sequence, with the original positions kept fixed in both diagrams.', app);

    /* Controls --------------------------------------------------------- */
    var controls = htmlEl('div', { 'class': 'sl-controls' }, null, app);
    var cutGroup = htmlEl('div', {
      'class': 'sl-control', role: 'group', 'aria-labelledby': uid + '-cut-label'
    }, null, controls);
    htmlEl('p', { 'class': 'sl-control-label', id: uid + '-cut-label' },
      'Which elements of ' + SP_HTML + ' does ' + S_HTML + ' keep?', cutGroup);
    var cutRow = htmlEl('div', { 'class': 'sl-cuts' }, null, cutGroup);
    var cutButtons = {};
    CUTS.forEach(function (cut) {
      var b = htmlEl('button', {
        type: 'button', 'class': 'sl-cut', 'data-cut': cut.key, 'aria-pressed': 'false'
      }, '<span class="sl-cut-name">' + cut.label + '</span>' +
        '<span class="sl-cut-meta" aria-hidden="true">' + cut.metaHTML + '</span>', cutRow);
      b.addEventListener('click', function () { setCut(cut.key); });
      cutButtons[cut.key] = b;
    });

    var rangeWrap = htmlEl('div', { 'class': 'sl-control sl-range' }, null, controls);
    htmlEl('label', { 'class': 'sl-control-label', 'for': uid + '-m' },
      'Retained elements ' + math('|S|'), rangeWrap);
    var rangeRow = htmlEl('div', { 'class': 'sl-range-row' }, null, rangeWrap);
    var slider = htmlEl('input', {
      type: 'range', id: uid + '-m', min: String(M_MIN), max: String(M_MAX), step: '1',
      value: String(state.m)
    }, null, rangeRow);
    var sliderOut = htmlEl('output', { 'for': uid + '-m', 'class': 'sl-range-out' }, null, rangeRow);
    slider.addEventListener('input', function () { setRetained(slider.value); });

    /* Stats and live summary -------------------------------------------- */
    var stats = htmlEl('div', { 'class': 'sl-stats' }, null, app);
    function stat(cls, key) {
      var box = htmlEl('div', { 'class': 'sl-stat ' + cls }, null, stats);
      var k = htmlEl('span', { 'class': 'sl-stat-k' }, key, box);
      var v = htmlEl('span', { 'class': 'sl-stat-v' }, null, box);
      return { box: box, key: k, val: v };
    }
    var statCommon = stat('sl-stat--common', 'Common elements ' + math('|S|'));
    var statD = stat('sl-stat--d', 'Changed successors ' + math("D(S,S')"));
    var statBound = stat('sl-stat--bound', '');
    var summary = htmlEl('p', {
      'class': 'sl-summary', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true'
    }, null, app);

    /* Plots ------------------------------------------------------------ */
    htmlEl('p', { 'class': 'sl-sr', id: uid + '-kbd' },
      'Each point is a button. Use the left and right arrow keys to move along the left order, ' +
      'the up and down arrow keys to move along the right order, Home and End to jump to the ends, ' +
      'Enter or Space to keep a point selected, and Escape to clear the selection.', app);
    var plotsWrap = htmlEl('div', { 'class': 'sl-plots' }, null, app);
    var plots = [buildPlot('full'), buildPlot('sub')];
    var plotFull = plots[0];
    var plotSub = plots[1];

    var readout = htmlEl('p', { 'class': 'sl-readout' }, null, app);

    /* Legend ----------------------------------------------------------- */
    var guide = htmlEl('details', { 'class': 'sl-details sl-guide' }, null, app);
    htmlEl('summary', null, 'How to read the diagrams', guide);
    var legend = htmlEl('ul', { 'class': 'sl-legend', 'aria-label': 'Legend' }, null, guide);
    legendItem('<line x1="3" y1="9" x2="27" y2="9" class="sl-link is-stable" />' +
      '<path d="M22 5 L28 9 L22 13 z" class="sl-arrow-stable" />',
      'Successor link of a common element whose successor is the same in ' + SP_HTML + ' and ' + S_HTML + '.');
    legendItem('<line x1="3" y1="9" x2="27" y2="9" class="sl-link is-changed" />' +
      '<path d="M22 5 L28 9 L22 13 z" class="sl-arrow-changed" />',
      'Successor link of a common element whose successor differs between the two plots.');
    legendItem('<circle cx="15" cy="9" r="6.5" class="sl-swatch-dot" />' +
      '<circle cx="15" cy="9" r="8.6" class="sl-swatch-ring" />',
      'An orange ring marks an element counted in ' + math("D(S,S')") + ', ' +
      'including one that gains or loses a successor.');
    legendItem('<circle cx="15" cy="9" r="6.5" class="sl-swatch-out" />',
      'In the left plot, a hollow dot lies in ' + SP_HTML + ' but not in ' + S_HTML +
      '; grey dashed arrows leave such elements and are not compared.');
    legendItem('<circle cx="15" cy="9" r="6.5" class="sl-swatch-ghost" />',
      'In the right plot, a ghosted dot was removed from ' + S_HTML + ' and is kept only for reference.');

    /* Table ------------------------------------------------------------ */
    var details = htmlEl('details', { 'class': 'sl-details' }, null, app);
    htmlEl('summary', null, 'Successor table for the common elements', details);
    var tableWrap = htmlEl('div', { 'class': 'sl-table-wrap' }, null, details);

    /* Notes ------------------------------------------------------------ */
    var notes = htmlEl('div', { 'class': 'sl-notes' }, null, guide);
    htmlEl('p', null,
      '<strong>How the plots are computed.</strong> The horizontal coordinate of a dot is its position in ' +
      'the left order ' + math('\\prec_L') + ', and its vertical coordinate is its value, which records the right ' +
      'order ' + math('\\prec_R') + '. The rank ' + math('\\ell(x)') + ' is one more than the largest rank of an earlier element ' +
      'with a larger value, or ' + math(1) + ' if there is none; equivalently, it is the length of the longest ' +
      'decreasing sequence ending at ' + math('x') + '. Elements of rank ' + math('i') + ' form the increasing layer ' +
      math('L(i)') + ', the successor of ' + math('x') + ' is the next element of its layer in the left order, ' +
      'and the last element of a layer has no successor. ' + math("D(S,S')") + ' counts ' +
      'the elements of ' + S_HTML + ' whose successor in ' + S_HTML + ' is a different element from their ' +
      'successor in ' + SP_HTML + ', where having no successor counts as a value of its own.', notes);
    htmlEl('p', null,
      '<strong>Where the cuts come from.</strong> In the proof that a triangle receives few charges, the ' +
      'curves joining two sides of the triangle form a set that is a cut of type ' + math('(3)') + ' on one side and of ' +
      'type ' + math('(1)') + ' on the other, or of type ' + math('(4)') + ' on one side and of type ' + math('(2)') + ' on the other. Adding the two ' +
      'counts gives at most ' + math('\\binom{k}{2} + k - 1 \\le k^2') + ' switches for each ' +
      'pair of sides.', notes);
    htmlEl('p', { 'class': 'sl-caveat' },
      '<strong>Scope of this example.</strong> This is a finite illustrative example: one fixed set ' +
      SP_HTML + ' of ten elements, the sequence ' + math(PERMUTATION.join(', ')) + ' from the decomposition ' +
      'figure, together with its restricted subsets. It is not a model of all curves in a drawing. Its ' +
      'longest decreasing sequence has length ' + math(FULL.width) + ' (for instance ' + math('4, 2, 1') + '), so ' +
      math("k = \\operatorname{width}(S') + 1 = " + K) + ' is the smallest value allowed by the hypothesis, and the ' +
      'bounds shown are the lemma’s bounds for that ' + math('k') + '. A count that stays below a bound here says ' +
      'nothing about whether the bound is sharp in general.', notes);

    /* Behaviour -------------------------------------------------------- */

    function legendItem(swatchSVG, html) {
      var li = htmlEl('li', null, null, legend);
      htmlEl('span', { 'class': 'sl-legend-swatch', 'aria-hidden': 'true' },
        '<svg viewBox="0 0 30 18" width="30" height="18" focusable="false">' + swatchSVG + '</svg>', li);
      htmlEl('span', null, html, li);
    }

    function buildPlot(kind) {
      var isFull = kind === 'full';
      var fig = htmlEl('figure', { 'class': 'sl-figure sl-figure--' + kind }, null, plotsWrap);
      var cap = htmlEl('figcaption', { 'class': 'sl-figcap' }, null, fig);
      var capTitle = htmlEl('span', { 'class': 'sl-fig-title', id: uid + '-' + kind + '-title' },
        isFull ? 'The full integer sequence' : 'The retained integer sequence', cap);
      var capSub = htmlEl('span', { 'class': 'sl-fig-sub' }, null, cap);
      var sequenceLine = htmlEl('div', { 'class': 'sl-sequence-row', 'aria-label': 'Integers in sequence order' }, null, fig);

      var svg = svgEl('svg', {
        'class': 'sl-svg', viewBox: '0 0 ' + G.W + ' ' + G.H, role: 'group',
        'aria-labelledby': uid + '-' + kind + '-title',
        'aria-describedby': uid + '-kbd'
      }, fig);
      var defs = svgEl('defs', null, svg);
      ['stable', 'changed', 'context', 'axis'].forEach(function (name) {
        var mk = svgEl('marker', {
          id: uid + '-' + kind + '-arrow-' + name, viewBox: '0 0 10 10', refX: '8.5', refY: '5',
          markerWidth: name === 'axis' ? '7' : '8', markerHeight: name === 'axis' ? '7' : '8',
          markerUnits: 'userSpaceOnUse', orient: 'auto'
        }, defs);
        svgEl('path', { d: 'M0,0 L10,5 L0,10 z', 'class': 'sl-arrow-' + name }, mk);
      });

      // Grid, ticks, axes.
      var gGrid = svgEl('g', { 'class': 'sl-grid', 'aria-hidden': 'true' }, svg);
      for (var i = 1; i <= N; i++) {
        svgEl('line', { x1: sx(i), y1: G.t, x2: sx(i), y2: G.t + G.ph }, gGrid);
        svgEl('line', { x1: G.l, y1: sy(i), x2: G.l + G.pw, y2: sy(i) }, gGrid);
        svgMath(gGrid, sx(i), G.t + G.ph + 15, i, 'class="sl-tick" font-size="10" fill="var(--sl-ink-soft)" text-anchor="middle"');
        svgMath(gGrid, G.l - 9, sy(i), i, 'class="sl-tick" font-size="10" fill="var(--sl-ink-soft)" dy="0.35em" text-anchor="end"');
      }
      var gAxes = svgEl('g', { 'aria-hidden': 'true' }, svg);
      svgEl('line', {
        'class': 'sl-axis', x1: G.l, y1: G.t + G.ph, x2: G.l + G.pw + 12, y2: G.t + G.ph,
        'marker-end': 'url(#' + uid + '-' + kind + '-arrow-axis)'
      }, gAxes);
      svgEl('line', {
        'class': 'sl-axis', x1: G.l, y1: G.t + G.ph, x2: G.l, y2: G.t - 14,
        'marker-end': 'url(#' + uid + '-' + kind + '-arrow-axis)'
      }, gAxes);
      axisLabel(gAxes, G.l + G.pw / 2, G.H - 12,
        math('x') + ': left order ' + math('\\prec_L') + ' (position) ' + math('\\to'));
      axisLabel(gAxes, 0, 0,
        math('y') + ': right order ' + math('\\prec_R') + ' (value) ' + math('\\to'),
        'translate(14 ' + (G.t + G.ph / 2) + ') rotate(-90)');

      var gLinks = svgEl('g', { 'class': 'sl-links', 'aria-hidden': 'true' }, svg);
      var gLayers = svgEl('g', { 'class': 'sl-layers', 'aria-hidden': 'true' }, svg);
      var gPoints = svgEl('g', { 'class': 'sl-points' }, svg);

      var points = {};
      BY_POS.forEach(function (e) {
        var g = svgEl('g', {
          'class': 'sl-pt', role: 'button', tabindex: e.id === state.active ? '0' : '-1',
          'aria-pressed': 'false', 'data-id': String(e.id),
          transform: 'translate(' + sx(e.pos) + ' ' + sy(e.val) + ')'
        }, gPoints);
        svgEl('circle', { 'class': 'sl-pt-hit', r: '15' }, g);
        svgEl('circle', { 'class': 'sl-pt-focus', r: '17.5' }, g);
        svgEl('circle', { 'class': 'sl-pt-ring', r: '14.2' }, g);
        svgEl('circle', { 'class': 'sl-pt-dot', r: String(G.dot) }, g);
        svgMath(g, 0, 0, e.val, 'class="sl-pt-label" font-size="11" dy="0.35em" text-anchor="middle"');
        points[e.id] = { g: g };
      });

      var plot = {
        kind: kind, isFull: isFull, svg: svg, capSub: capSub, capTitle: capTitle, sequenceLine: sequenceLine,
        gLinks: gLinks, gLayers: gLayers, points: points, links: {}
      };

      svg.addEventListener('keydown', function (ev) { onKey(plot, ev); });
      svg.addEventListener('click', function (ev) {
        var id = pointId(ev.target);
        if (id == null) return;
        state.pinned = state.pinned === id ? null : id;
        state.active = id;
        renderSelection();
      });
      // Focus that comes from a mouse or touch press is not treated as a
      // selection; the click handler pins instead, so a second click can unpin.
      // Touch input focuses only after pointerup, so a short time window is used.
      var lastPointerDown = -Infinity;
      svg.addEventListener('pointerdown', function () { lastPointerDown = Date.now(); });
      svg.addEventListener('focusin', function (ev) {
        var id = pointId(ev.target);
        if (id == null) return;
        var fromPointer = Date.now() - lastPointerDown < 1000;
        state.focus = fromPointer ? null : id;
        state.active = id;
        renderSelection();
      });
      svg.addEventListener('focusout', function () {
        state.focus = null;
        renderSelection();
      });
      svg.addEventListener('pointerover', function (ev) {
        var id = pointId(ev.target);
        if (id == null || state.hover === id) return;
        state.hover = id;
        renderSelection();
      });
      svg.addEventListener('pointerleave', function () {
        if (state.hover == null) return;
        state.hover = null;
        renderSelection();
      });
      svg.addEventListener('pointerout', function (ev) {
        var from = pointId(ev.target);
        var to = pointId(ev.relatedTarget);
        if (from != null && to == null) {
          state.hover = null;
          renderSelection();
        }
      });
      return plot;
    }

    function pointId(node) {
      while (node && node !== root) {
        if (node.getAttribute && node.classList && node.classList.contains('sl-pt')) {
          return Number(node.getAttribute('data-id'));
        }
        node = node.parentNode;
      }
      return null;
    }

    function onKey(plot, ev) {
      var id = pointId(ev.target);
      if (id == null) return;
      var e = BY_ID[id];
      var next = null;
      switch (ev.key) {
        case 'ArrowRight': next = BY_POS[Math.min(N - 1, e.pos)]; break;
        case 'ArrowLeft': next = BY_POS[Math.max(0, e.pos - 2)]; break;
        case 'ArrowUp': next = BY_VAL[Math.min(N - 1, e.val)]; break;
        case 'ArrowDown': next = BY_VAL[Math.max(0, e.val - 2)]; break;
        case 'Home': next = BY_POS[0]; break;
        case 'End': next = BY_POS[N - 1]; break;
        case 'Enter':
        case ' ':
        case 'Spacebar':
          ev.preventDefault();
          state.pinned = state.pinned === id ? null : id;
          renderSelection();
          return;
        case 'Escape':
          if (state.pinned != null) {
            ev.preventDefault();
            state.pinned = null;
            renderSelection();
          }
          return;
        default:
          return;
      }
      ev.preventDefault();
      state.active = next.id;
      renderSelection();
      plot.points[next.id].g.focus();
    }

    function setCut(key) {
      if (!CUT_BY_KEY[key]) return;
      state.cut = key;
      render();
    }

    function setRetained(m) {
      state.m = clampM(m);
      render();
    }

    function linkGeometry(a, b) {
      var x1 = sx(a.pos), y1 = sy(a.val), x2 = sx(b.pos), y2 = sy(b.val);
      var dx = x2 - x1, dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var ux = dx / len, uy = dy / len;
      // Start and stop just outside the orange ring (radius 14.2) of a counted element.
      var s0 = G.dot + 5, s1 = G.dot + 6.5;
      return {
        x1: (x1 + ux * s0).toFixed(2), y1: (y1 + uy * s0).toFixed(2),
        x2: (x2 - ux * s1).toFixed(2), y2: (y2 - uy * s1).toFixed(2)
      };
    }

    function syncLinks(plot, specs) {
      var seen = {};
      specs.forEach(function (sp) {
        var key = sp.from + '>' + sp.to;
        seen[key] = true;
        var line = plot.links[key];
        if (!line) {
          var geo = linkGeometry(BY_ID[sp.from], BY_ID[sp.to]);
          line = svgEl('line', {
            x1: geo.x1, y1: geo.y1, x2: geo.x2, y2: geo.y2, 'data-from': String(sp.from)
          }, plot.gLinks);
          plot.links[key] = line;
        }
        line.setAttribute('class', 'sl-link is-' + sp.status);
        line.setAttribute('marker-end', 'url(#' + uid + '-' + plot.kind + '-arrow-' + sp.status + ')');
      });
      Object.keys(plot.links).forEach(function (key) {
        if (!seen[key]) {
          plot.links[key].parentNode.removeChild(plot.links[key]);
          delete plot.links[key];
        }
      });
    }

    function renderLayers(plot, decomposition) {
      var g = plot.gLayers;
      while (g.firstChild) g.removeChild(g.firstChild);
      decomposition.layers.forEach(function (layer, i) {
        var last = BY_ID[layer[layer.length - 1]];
        svgMath(g, (sx(last.pos) + G.dot + 3).toFixed(2), (sy(last.val) - G.dot - 3).toFixed(2),
          'L_{' + (plot.isFull ? "S'" : 'S') + '}(' + (i + 1) + ')',
          'class="sl-layer" font-size="11" fill="var(--sl-ink)"');
      });
    }

    function pointLabel(id) {
      var e = BY_ID[id];
      var base = 'Element ' + id + ' at position ' + e.pos + ', value ' + e.val + '. ';
      var full = 'In ' + SP + ': rank ' + FULL.rank[id] + ', ' + succText(FULL.succ[id]) + '. ';
      if (!result.inS[id]) return base + full + 'It is not in S under this cut, so it is not compared.';
      var subTxt = 'In S: rank ' + result.sub.rank[id] + ', ' + succText(result.sub.succ[id]) + '. ';
      var verdict = FULL.succ[id] !== result.sub.succ[id]
        ? 'The successor changes, so it is counted.' : 'The successor is unchanged.';
      return base + full + subTxt + verdict;
    }

    function succHTML(id) {
      return id == null ? 'no successor' : 'successor <strong>' + math(id) + '</strong>';
    }

    function readoutHTML(id) {
      var e = BY_ID[id];
      var head = '<strong>Element ' + math(id) + '</strong> (position ' + math(e.pos) + ', value ' + math(e.val) + '). ';
      var full = 'In ' + SP_HTML + ' it lies in ' + math("L_{S'}(" + FULL.rank[id] + ')') +
        ' with ' + succHTML(FULL.succ[id]);
      if (!result.inS[id]) {
        return head + 'It is not in ' + S_HTML + ' under this cut, so it is not compared. ' + full + '.';
      }
      var sub = 'in ' + S_HTML + ' it lies in ' + math('L_S(' + result.sub.rank[id] + ')') +
        ' with ' + succHTML(result.sub.succ[id]);
      var changed = FULL.succ[id] !== result.sub.succ[id];
      return head + full + ', and ' + sub + '. ' + (changed
        ? '<span class="sl-tag sl-tag--changed">The successor changes, so this element is counted in ' +
          math("D(S,S')") + '.</span>'
        : '<span class="sl-tag sl-tag--stable">The successor is unchanged.</span>');
    }

    var DEFAULT_READOUT = 'Hover over or tap a dot, or Tab into a plot and use the arrow keys, to compare ' +
      'the successor of one element in ' + SP_HTML + ' and in ' + S_HTML + '. Enter or a click keeps the ' +
      'element selected.';

    function renderSelection() {
      var cur = state.hover != null ? state.hover : (state.focus != null ? state.focus : state.pinned);
      plots.forEach(function (plot) {
        plot.svg.classList.toggle('has-current', cur != null);
        ELEMENTS.forEach(function (e) {
          var g = plot.points[e.id].g;
          g.classList.toggle('is-current', e.id === cur);
          g.setAttribute('aria-pressed', e.id === state.pinned ? 'true' : 'false');
          g.setAttribute('tabindex', e.id === state.active ? '0' : '-1');
        });
        Object.keys(plot.links).forEach(function (key) {
          var line = plot.links[key];
          line.classList.toggle('is-active', Number(line.getAttribute('data-from')) === cur);
        });
      });
      readout.innerHTML = cur != null ? readoutHTML(cur) : DEFAULT_READOUT;
    }

    function render() {
      result = compute(state.cut, state.m);
      var cut = CUT_BY_KEY[result.cut];

      // Controls.
      CUTS.forEach(function (c) {
        cutButtons[c.key].setAttribute('aria-pressed', c.key === result.cut ? 'true' : 'false');
      });
      slider.value = String(result.m);
      slider.setAttribute('aria-valuetext', result.m + ' of ' + N + ' elements');
      sliderOut.innerHTML = math(result.m) + ' of ' + math(N);

      // Captions.
      plotFull.capSub.innerHTML = SP_HTML + ' has ' + math(N) + ' elements, and its longest decreasing sequence ' +
        'has length ' + math(FULL.width) + ', so ' + math('k = ' + K) + '. Solid dots also lie in ' + S_HTML + '.';
      plotSub.capSub.innerHTML = S_HTML + ' keeps ' + mathText(cut.describe(result.m)) +
        ' and is decomposed on its own.';
      plotFull.sequenceLine.innerHTML = math(PERMUTATION.join('\\quad '));
      plotSub.sequenceLine.innerHTML = PERMUTATION.map(function (v) {
        return '<span' + (result.inS[v] ? '' : ' class="is-removed"') + '>' + math(v) + '</span>';
      }).join(' ');

      // Points.
      plots.forEach(function (plot) {
        ELEMENTS.forEach(function (e) {
          var g = plot.points[e.id].g;
          var inS = !!result.inS[e.id];
          var changed = inS && FULL.succ[e.id] !== result.sub.succ[e.id];
          g.classList.toggle('is-out', plot.isFull && !inS);
          g.classList.toggle('is-ghost', !plot.isFull && !inS);
          g.classList.toggle('is-changed', changed);
          g.setAttribute('aria-label', pointLabel(e.id));
        });
      });

      // Links: compare actual successor ids, with null meaning no successor.
      syncLinks(plotFull, FULL.order.filter(function (id) { return FULL.succ[id] != null; }).map(function (id) {
        var status = !result.inS[id] ? 'context' : (FULL.succ[id] !== result.sub.succ[id] ? 'changed' : 'stable');
        return { from: id, to: FULL.succ[id], status: status };
      }));
      syncLinks(plotSub, result.sub.order.filter(function (id) { return result.sub.succ[id] != null; }).map(function (id) {
        return { from: id, to: result.sub.succ[id], status: FULL.succ[id] !== result.sub.succ[id] ? 'changed' : 'stable' };
      }));
      renderLayers(plotFull, FULL);
      renderLayers(plotSub, result.sub);

      // Stats.
      statCommon.val.innerHTML = math(result.m);
      statD.val.innerHTML = math(result.D);
      statD.box.classList.toggle('is-zero', result.D === 0);
      statBound.key.innerHTML = 'Lemma bound, case ' + math('(' + result.clause + ')');
      statBound.val.innerHTML = math('D ' + result.bound.tex);

      // Live summary.
      var changedList = result.rows.filter(function (r) { return r.changed; }).map(function (r) {
        return r.id + ' (' + succShort(r.succFull) + ' in ' + SP + ', ' + succShort(r.succSub) + ' in S)';
      });
      var lead = 'Case (' + result.clause + '): ' + S_HTML + ' keeps ' + cut.describe(result.m) + '. ';
      var count;
      var list = changedList.join('; ') + '. ';
      if (result.m === 1) {
        count = result.D === 0
          ? 'The single common element keeps its successor. '
          : 'The single common element changes its successor: ' + list;
      } else if (result.D === 0) {
        count = 'None of the ' + result.m + ' common elements changes its successor. ';
      } else if (result.D === result.m) {
        count = 'All ' + result.m + ' common elements change their successors: ' + list;
      } else {
        count = result.D + ' of the ' + result.m + ' common elements ' +
          (result.D === 1 ? 'changes its successor: ' : 'change their successors: ') + list;
      }
      var verdict;
      var caseName = 'Case (' + result.clause + ') of the lemma';
      if (result.bound.relation === 'eq') {
        verdict = result.holds
          ? caseName + ' states that <i>D</i> = 0, and this example agrees.'
          : caseName + ' states that <i>D</i> = 0, but this example gives ' + result.D +
            ', which indicates an error in the computation.';
      } else if (!result.holds) {
        verdict = 'Here <i>D</i> = ' + result.D + ' exceeds the bound ' + result.bound.value +
          ' from ' + caseName.toLowerCase() + ', which indicates an error in the computation.';
      } else if (result.attained) {
        verdict = caseName + ' gives <i>D</i> ≤ ' + result.bound.value + ' for <i>k</i> = ' + result.k +
          '; here <i>D</i> = ' + result.D + ', so this choice attains the bound.';
      } else {
        verdict = caseName + ' gives <i>D</i> ≤ ' + result.bound.value + ' for <i>k</i> = ' + result.k +
          '; here <i>D</i> = ' + result.D + ', strictly below the bound, so this choice does not attain it.';
      }
      summary.innerHTML = result.holds
        ? 'Here, ' + math(result.D) + ' of the ' + math(result.m) + ' retained integers ' +
          (result.D === 1 ? 'changes its successor. ' : 'change their successors. ') +
          (result.bound.relation === 'eq'
            ? 'Keeping the largest values always preserves every successor.'
            : 'The lemma allows at most ' + math(result.bound.value) + ' changes when ' + math('k = ' + result.k) + '.')
        : mathText(verdict.replace(/<i>(.*?)<\/i>/g, '$1'));

      // Table.
      var rowsHTML = result.rows.map(function (r) {
        return '<tr class="' + (r.changed ? 'is-changed' : 'is-stable') + '">' +
          '<th scope="row">' + math(r.id) + '</th><td>' + math(r.pos) + '</td>' +
          '<td>' + math(r.rankFull) + '</td><td>' + math(r.rankSub) + '</td>' +
          '<td>' + (r.succFull == null ? 'none' : math(r.succFull)) + '</td><td>' + (r.succSub == null ? 'none' : math(r.succSub)) + '</td>' +
          '<td>' + (r.changed ? 'changed' : 'same') + '</td></tr>';
      }).join('');
      tableWrap.innerHTML = '<table class="sl-table"><caption>' +
        (result.m === 1 ? 'The single common element' : 'The ' + math(result.m) + ' common elements in left order') + '; ' +
        '“none” means the element is last in its layer.</caption><thead><tr>' +
        '<th scope="col">Element</th><th scope="col">Position</th>' +
        '<th scope="col">' + math('\\ell') + ' in ' + SP_HTML + '</th><th scope="col">' + math('\\ell') + ' in ' + S_HTML + '</th>' +
        '<th scope="col">Successor in ' + SP_HTML + '</th><th scope="col">Successor in ' + S_HTML + '</th>' +
        '<th scope="col">Status</th></tr></thead><tbody>' + rowsHTML + '</tbody></table>';

      renderSelection();
    }

    render();

    var controller = {
      root: root,
      setCut: setCut,
      setRetained: setRetained,
      getState: function () {
        return { cut: state.cut, retained: state.m, D: result.D, bound: result.bound.value, k: result.k };
      },
      destroy: function () {
        root.innerHTML = '';
        root.classList.remove('sl');
        delete root.__quasiplanarStability;
      }
    };
    root.__quasiplanarStability = controller;
    return controller;
  }

  global.QuasiplanarStability = {
    mount: mount,
    compute: compute,
    decompose: decompose,
    PERMUTATION: PERMUTATION.slice(),
    CUTS: CUTS.map(function (c) { return { key: c.key, label: c.label, clause: c.clause }; }),
    k: K
  };
})(typeof window !== 'undefined' ? window : this);
