/* KaTeX labels shared by the interactive diagrams. */
(() => {
  'use strict';

  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const escape = (value) => String(value).replace(/[&<>"']/g, (character) => escapes[character]);
  const lengthPattern = /^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?)(px|em|rem|ex|%)?$/i;
  const cssLength = (value) => {
    const match = lengthPattern.exec(value);
    return match && Number.isFinite(Number(match[1])) ? match[1] + (match[2] || 'px') : '';
  };
  const coordinate = (value) => cssLength(value) ? String(value) : '0';
  const safeColor = /^(?:#[\da-f]{3,8}|[a-z]+|(?:var|rgba?|hsla?)\([\w\s#.,%()+/-]+\))$/i;
  const anchorOffsets = new Map([['start', '0%'], ['middle', '-50%'], ['end', '-100%']]);
  const presentation = new Map([
    ['font-size', (value) => cssLength(value)],
    ['fill', (value) => safeColor.test(value)],
    ['text-anchor', (value) => anchorOffsets.has(value)],
    ['opacity', (value) => cssLength(value)],
    ['font-weight', (value) => /^(?:normal|bold|bolder|lighter|[1-9]\d{0,2}|1000)$/.test(value)]
  ]);
  const metadata = new Set(['class', 'transform', 'aria-label', 'aria-hidden']);

  function readAttributes(source) {
    const attributes = new Map();
    const declarations = new Map();
    const quotedAttribute = /\s*([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')(?=\s|$)/giy;
    const text = String(source ?? '').trim();
    let offset = 0;

    while (offset < text.length) {
      const match = quotedAttribute.exec(text);
      if (!match) return new Map();
      offset = quotedAttribute.lastIndex;
      const name = match[1].toLowerCase();
      const value = (match[2] ?? match[3]).trim();
      if (name === 'style') {
        for (const item of value.split(';')) {
          const separator = item.indexOf(':');
          if (separator < 0) continue;
          const property = item.slice(0, separator).trim().toLowerCase();
          const setting = item.slice(separator + 1).trim();
          if (presentation.get(property)?.(setting)) declarations.set(property, setting);
        }
      } else if (presentation.get(name)?.(value) ||
          metadata.has(name) || (name === 'dy' && cssLength(value))) {
        attributes.set(name, value);
      }
    }

    for (const [name, value] of declarations) attributes.set(name, value);
    if (declarations.size) {
      attributes.set('style', Array.from(declarations, ([name, value]) =>
        `${name}:${name === 'font-size' ? cssLength(value) : value}`).join(';'));
    }
    return attributes;
  }

  function render(tex, options) {
    if (!window.katex?.renderToString) return null;
    try {
      return window.katex.renderToString(tex, {
        strict: 'ignore',
        ...options,
        macros: { ...options.macros },
        output: 'html',
        throwOnError: true,
        trust: false
      });
    } catch {
      return null;
    }
  }

  function html(tex, options = {}) {
    const source = String(tex ?? '');
    const rendered = render(source, options);
    if (rendered === null) return escape(source);
    return `<span role="math" aria-label="${escape(options.ariaLabel ?? source)}">${rendered}</span>`;
  }

  function serialize(attributes) {
    return Array.from(attributes, ([name, value]) => ` ${name}="${escape(value)}"`).join('');
  }

  function svgLabel(x, y, tex, attrs = '') {
    const source = String(tex ?? '');
    const attributes = readAttributes(attrs);
    const inlineStyle = attributes.get('style');
    attributes.delete('style');
    const position = `x="${coordinate(x)}" y="${coordinate(y)}"`;
    const rendered = render(source, {});
    if (rendered === null) {
      const fallbackStyle = `${inlineStyle ? inlineStyle + ';' : ''}pointer-events:none`;
      return `<text ${position}${serialize(attributes)} style="${escape(fallbackStyle)}">${escape(source)}</text>`;
    }

    const anchor = anchorOffsets.get(attributes.get('text-anchor')) || '0%';
    const dy = cssLength(attributes.get('dy')) || '0px';
    const color = attributes.get('fill') || 'currentColor';
    const label = attributes.get('aria-label') ?? source;
    attributes.delete('dy');
    attributes.set('aria-label', label);

    // A KaTeX strut describes each unbreakable group's ascent and depth.
    // At zero line height its ascent sets the line's baseline offset.
    let ascent = 0;
    const strut = /class="katex-strut" style="height:([\d.]+)em;(?:vertical-align:([-\d.]+)em;)?"/g;
    for (const [, height, alignment] of rendered.matchAll(strut)) {
      ascent = Math.max(ascent, Number(height) + Number(alignment || 0));
    }
    const math = rendered.replace('<span class="katex">', '<span class="katex" style="font-size:1em;line-height:0">');
    const objectStyle = `${inlineStyle ? inlineStyle + ';' : ''}overflow:visible;pointer-events:none`;
    const bodyStyle = `position:absolute;left:0;top:calc(${dy} - ${ascent}em);transform:translateX(${anchor});color:${color};font-size:inherit;line-height:0;white-space:nowrap`;
    return `<foreignObject ${position} width="1" height="1"${serialize(attributes)} role="math" style="${objectStyle}"><div xmlns="http://www.w3.org/1999/xhtml" style="${escape(bodyStyle)}">${math}</div></foreignObject>`;
  }

  function setSvgLabel(group, x, y, tex, attrs = '') {
    group.innerHTML = svgLabel(x, y, tex, attrs);
  }

  window.QuasiplanarDiagramMath = { html, svgLabel, setSvgLabel };
})();
