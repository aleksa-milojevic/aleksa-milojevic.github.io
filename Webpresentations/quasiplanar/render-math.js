/* Website copy only: typesets the mathematics exactly as text-editor.js does, without
   any editing. The local presentation keeps the full editor. */
(() => {
  'use strict';
  // Same delimiters, exclusions and KaTeX options as text-editor.js.
  const mathPattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|(?<!\\)\$([^\n$]+?)(?<!\\)\$/g;
  const skipped = 'script,style,textarea,svg,math,.katex,.tex-math,[data-no-math]';
  let observer = null;

  function renderMath(root = document.body) {
    if (!window.katex || !root || (root.nodeType === 1 && root.closest(skipped))) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement && !node.parentElement.closest(skipped)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const source = node.nodeValue;
      mathPattern.lastIndex = 0;
      if (!mathPattern.test(source)) return;
      mathPattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let at = 0;
      let match;
      while ((match = mathPattern.exec(source))) {
        fragment.append(document.createTextNode(source.slice(at, match.index)));
        const formula = match[1] ?? match[2] ?? match[3] ?? match[4];
        const display = match[2] !== undefined || match[3] !== undefined;
        const span = document.createElement('span');
        span.className = 'tex-math' + (display ? ' tex-display' : '');
        span.dataset.tex = formula;
        span.dataset.display = display ? 'true' : 'false';
        window.katex.render(formula, span, {displayMode: display, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000});
        fragment.append(span);
        at = mathPattern.lastIndex;
      }
      fragment.append(document.createTextNode(source.slice(at)));
      node.replaceWith(fragment);
    });
  }

  function withoutObserver(fn) {
    if (observer) observer.disconnect();
    try { return fn(); }
    finally { if (observer) observer.observe(document.body, {childList: true, subtree: true}); }
  }

  function start() {
    withoutObserver(() => renderMath());
    // Widgets insert new text with mathematics; typeset it as it appears.
    observer = new MutationObserver(records => withoutObserver(() => {
      const roots = new Set();
      records.forEach(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target && !target.closest(skipped)) roots.add(target);
      });
      roots.forEach(root => renderMath(root));
    }));
    observer.observe(document.body, {childList: true, subtree: true});
    window.QuasiplanarText = {renderMath: root => withoutObserver(() => renderMath(root))};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
