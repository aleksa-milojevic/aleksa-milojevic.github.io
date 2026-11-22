/* Browser-local, reversible text drafts. The article remains the source baseline. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const version = document.documentElement.dataset.textVersion || '2026-11-17-routes-latex-v1';
  const storageKey = 'quasiplanar-edits-v1';
  const journalBaseKey = storageKey + ':baseline';
  const journalPrefix = storageKey + ':change:';
  const tabId = Date.now().toString(36) + ':' + Math.random().toString(36).slice(2);
  const blocks = new Map();
  const aliases = new Map();
  const stableAliases = new Map();
  const edits = new Map();
  const routeNames = {curious: 'The Explorer', mathematician: 'The Scientist', expert: 'The Expert'};
  const mathPattern = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|(?<!\\)\$([^\n$]+?)(?<!\\)\$/g;
  const skipped = 'script,style,textarea,svg,math,.katex,.tex-math,[data-no-math],#text-edit-dialog,#draft-reset-dialog';
  const excluded = 'button,a,summary,nav,.route-choices,.route-dialog-choices,.route-status,.figure-toolbar,.scene-dots,.reading-progress,#heads-lab,#stability-lab,#setup-caption,#chain-caption,.drawing,[data-no-edit],#text-edit-dialog,#text-edit-toolbar,#draft-reset-dialog';
  let editing = false;
  let reviewingCopies = false;
  let active = null;
  let activeRoute = null;
  let resetRoute = null;
  let returnFocus = null;
  let savedAt = null;
  let storageWarning = '';
  const unresolvedEdits = [];
  const recoveryCopies = [];
  const workingCopies = [];
  let activeWorkingId = null;
  let activePreviousSource = null;
  let activeWorkingSource = null;
  let lastSnapshot = null;
  let hasUnwrittenChanges = false;
  let awaitingProjectSave = null;
  let observer;

  function isRoute(route) { return typeof route === 'string' && Object.hasOwn(routeNames, route); }

  function currentRoute() {
    const root = document.documentElement;
    return !root.hasAttribute('data-route-pending') && isRoute(root.dataset.route) ? root.dataset.route : null;
  }

  function scopeFor(block) { return block.route ? null : currentRoute(); }
  function scopedKey(key, route) { return route ? route + '\0' + key : key; }

  function editLocation(key) {
    const separator = key.indexOf('\0');
    return separator < 0 ? {block: blocks.get(key), route: null} :
      {block: blocks.get(key.slice(separator + 1)), route: key.slice(0, separator)};
  }

  function recordKey(record) { return scopedKey(record.key, record.route); }
  function recordValue(record) { return record?.route && record.useOriginal === true ? null : record?.source; }

  function passageRecord(key, value) {
    const {block, route} = editLocation(key);
    return {key: block.key, ...(route ? {route} : {}),
      ...(block.node.id ? {stableId: '#' + block.node.id} : {}),
      originalHash: block.originalHash, originalSource: block.original,
      ...(value === null ? {source: block.original, useOriginal: true} : {source: value})};
  }

  function passageSource(block, route = scopeFor(block)) {
    const value = edits.get(scopedKey(block.key, route));
    return value === null ? block.original : value ?? edits.get(block.key) ?? block.original;
  }

  function hasVisibleEdit(block) {
    return edits.has(scopedKey(block.key, scopeFor(block))) || edits.has(block.key);
  }

  function routeLabel(route) {
    if (!isRoute(route)) return '';
    return $(`.route-choices [data-route-choice="${route}"] > strong`)?.textContent || routeNames[route];
  }

  function hash(value) {
    let n = 2166136261;
    for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
    return (n >>> 0).toString(36);
  }

  function keyFor(node) {
    if (node.dataset.editKey) return node.dataset.editKey;
    const parts = [];
    for (let el = node; el && el !== document.body; el = el.parentElement) {
      if (el.id) { parts.unshift('#' + el.id); break; }
      let part = el.tagName.toLowerCase();
      if (el.dataset.for) part += ':' + el.dataset.for;
      const siblings = el.parentElement ? [...el.parentElement.children].filter(x => x.tagName === el.tagName) : [el];
      part += ':' + (siblings.indexOf(el) + 1);
      parts.unshift(part);
    }
    return parts.join('/');
  }

  function addAlias(key, block, stable = false) {
    if (!key) return;
    if (!aliases.has(key)) aliases.set(key, new Set());
    aliases.get(key).add(block);
    if (stable) {
      if (!stableAliases.has(key)) stableAliases.set(key, new Set());
      stableAliases.get(key).add(block);
    }
  }

  function sameBaseline(block, record) {
    return (typeof record.originalHash === 'string' ? block.originalHash === record.originalHash
      : typeof record.originalSource === 'string') &&
      (typeof record.originalSource !== 'string' || block.original === record.originalSource);
  }

  function comparableText(source) {
    const template = document.createElement('template');
    template.innerHTML = source;
    return template.content.textContent.replace(/\s+/g, ' ').trim();
  }

  function resolveRecord(record) {
    if (!record || typeof record !== 'object') return {reason: 'This saved record needs review.'};
    if (record.route != null && !isRoute(record.route))
      return {reason: 'This copy has an unfamiliar reading route.'};
    const match = block => ({block, key: scopedKey(block.key, record.route),
      merged: !record.route && record.source === block.original});
    // A declared key or permanent ID has precedence over structural addresses.
    const stable = new Set();
    for (const key of [record.stableId, record.key])
      stableAliases.get(key)?.forEach(block => stable.add(block));
    if (stable.size > 1) return {reason: 'The saved anchors identify different passages; this text is kept for review.'};
    if (stable.size === 1) {
      const block = [...stable][0];
      return match(block);
    }
    const direct = aliases.get(record.key);
    if (direct?.size === 1) {
      const block = [...direct][0];
      if (sameBaseline(block, record) || (typeof record.originalSource === 'string' &&
        comparableText(record.originalSource) === comparableText(block.original)))
        return match(block);
    }
    const originals = [...blocks.values()].filter(block => sameBaseline(block, record));
    const merged = record.route ? [] : [...blocks.values()].filter(block => block.original === record.source);
    if (originals.length === 1 && (!merged.length || (merged.length === 1 && merged[0] === originals[0])))
      return match(originals[0]);
    if (!originals.length && merged.length === 1) return match(merged[0]);
    if (originals.length > 1 || merged.length > 1 || (originals.length && merged.length))
      return {reason: 'More than one passage could match this saved text; every copy is kept for review.'};
    return {reason: 'This passage no longer has a matching place in the article.'};
  }

  function retryableRecord(edit) {
    return edit?.archived !== true && edit?.reanchorPending !== false && (edit?.reanchorPending === true || !edit?.reason || [
      'This passage no longer has a matching place in the article.',
      'The original text changed in a different presentation version.',
      'The original text changed after this draft was made.'
    ].includes(edit.reason));
  }

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

  function safeHref(value) {
    const href = value.trim();
    if (/^(?:https?:|mailto:|#|\.\.?\/)/i.test(href)) return href;
    if (/^[\w-][\w./-]*(?:#[\w-]+)?$/.test(href)) return href;
    return null;
  }

  function sanitizeSource(source) {
    // Protect TeX before interpreting optional inline formatting, including < in formulas.
    const math = [];
    const prefix = 'QPTEX' + Math.random().toString(36).slice(2) + 'TOKEN';
    const protectedSource = source.replace(mathPattern, value => {
      math.push(value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
      return prefix + (math.length - 1) + 'END';
    });
    const template = document.createElement('template');
    // Treat incomplete or unfamiliar angle text literally, including unfinished $x<y.
    template.innerHTML = protectedSource.replace(/<[^>]*>|<[^>]*$/g, token =>
      /^<\/?(?:em|strong|i|b|sub|sup|br|a|cite|span|small|code|script|style|iframe|object|embed|svg|math|template|link|meta)(?:\s[^<>]*?)?\/?>$/i.test(token)
        ? token : token.replace(/</g, '&lt;'));
    const allowed = new Set(['EM','STRONG','I','B','SUB','SUP','BR','A','CITE','SPAN','SMALL','CODE']);
    const discard = new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','LINK','META']);
    function clean(parent) {
      [...parent.childNodes].forEach(node => {
        if (node.nodeType === 8) { node.remove(); return; }
        if (node.nodeType !== 1) return;
        if (discard.has(node.tagName)) { node.remove(); return; }
        clean(node);
        if (!allowed.has(node.tagName)) { node.replaceWith(...node.childNodes); return; }
        const href = node.tagName === 'A' ? safeHref(node.getAttribute('href') || '') : null;
        const classes = node.tagName === 'SPAN' ? (node.getAttribute('class') || '').split(/\s+/).filter(x => ['accent','math-symbol','small-label','integer-pair'].includes(x)) : [];
        [...node.attributes].forEach(attr => node.removeAttribute(attr.name));
        if (href) node.setAttribute('href', href);
        if (classes.length) node.className = classes.join(' ');
      });
    }
    clean(template.content);
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const tokenPattern = new RegExp(prefix + '(\\d+)END', 'g');
    nodes.forEach(node => { node.nodeValue = node.nodeValue.replace(tokenPattern, (_, i) => math[Number(i)] || ''); });
    return template.innerHTML;
  }

  function applySource(block, source) {
    block.node.innerHTML = source === block.original ? source : sanitizeSource(source);
    block.appliedSource = source;
    renderMath(block.node);
    block.rendered = block.node.innerHTML;
    block.node.classList.toggle('has-text-draft', hasVisibleEdit(block));
    if (block.route) document.dispatchEvent(new CustomEvent('quasiplanar-text-change', {
      detail: {key: block.key, route: block.route, field: block.field, source, text: block.node.textContent}
    }));
  }

  function renderPassages() {
    let headingChanged = false;
    withoutObserver(() => blocks.forEach(block => {
      const source = passageSource(block);
      if (source !== block.appliedSource) {
        applySource(block, source);
        headingChanged ||= block.node.matches('h1,h2,h3,.section-number');
      }
      else block.node.classList.toggle('has-text-draft', hasVisibleEdit(block));
    }));
    if (headingChanged) document.dispatchEvent(new CustomEvent('quasiplanar-text-change'));
  }

  function draftPayload() {
    return {
      format: 'quasiplanar-text-draft', version: 1, baseVersion: version,
      savedAt: savedAt || new Date().toISOString(),
      edits: [...edits].map(([key, source]) => passageRecord(key, source)),
      unresolvedEdits: unresolvedEdits.map(entry => ({...entry})),
      recoveryCopies: JSON.parse(JSON.stringify(recoveryCopies)),
      workingCopies: JSON.parse(JSON.stringify(workingCopies))
    };
  }

  function workingBlock(copy) {
    const block = blocks.get(copy.key);
    return block && block.originalHash === copy.originalHash &&
      (copy.route == null || isRoute(copy.route)) ? block : null;
  }

  function matchingWorkingCopies() {
    return workingCopies.filter(copy => {
      const block = workingBlock(copy);
      return block && (copy.route ?? null) === scopeFor(block);
    });
  }

  function workingCopyNeedsReview(copy) {
    const block = workingBlock(copy);
    return !block || (copy.route == null && scopeFor(block) !== null);
  }

  function copyIdentity(copy) {
    return JSON.stringify([copy.route ?? null, copy.key, copy.originalHash ?? null, copy.source, copy.useOriginal === true]);
  }

  function markArchived(copy) { return {...copy, archived: true, reanchorPending: false}; }

  function updateStatus() {
    const count = edits.size;
    const resumable = matchingWorkingCopies();
    const pending = unresolvedEdits.filter(copy => copy.archived !== true).length + recoveryCopies.length + workingCopies.filter(workingCopyNeedsReview).length;
    const hasDraft = count || unresolvedEdits.length || recoveryCopies.length || workingCopies.length;
    const status = $('#text-edit-status');
    const notices = [];
    if (count) notices.push(`${count} ${count === 1 ? 'passage' : 'passages'} ${hasUnwrittenChanges ? 'in this draft' : 'saved in this browser'}.`);
    if (workingCopies.length) notices.push(`${workingCopies.length} unfinished ${workingCopies.length === 1 ? 'passage' : 'passages'} ${hasUnwrittenChanges ? 'in this draft' : 'protected in this browser'}.`);
    if (pending) notices.push(`${pending} earlier ${pending === 1 ? 'passage is' : 'passages are'} protected. Review saved copies to read and copy the text; Export edits includes every version.`);
    if (storageWarning) notices.push(storageWarning);
    if (status) status.textContent = notices.join(' ') || 'Click a passage to rewrite it.';
    editButton.textContent = editing ? 'Done editing' : storageWarning ? 'Edit text · review draft' : pending ? `Edit text · ${pending} to review` : resumable.length ? 'Edit text · unfinished passage' : 'Edit text';
    editButton.classList.toggle('has-unmerged-draft', pending > 0 || !!storageWarning);
    editButton.dataset.unresolvedCount = String(pending);
    editButton.dataset.workingCount = String(workingCopies.length);
    if (storageWarning) editButton.setAttribute('aria-description', storageWarning);
    else if (pending) editButton.setAttribute('aria-description', 'Earlier text is protected. Choose Review saved copies while editing to read and copy it.');
    else editButton.removeAttribute('aria-description');
    const exportButton = $('#export-text-draft');
    if (exportButton) exportButton.disabled = !hasDraft;
    const resetButton = $('#reset-text-draft');
    if (resetButton) {
      const route = currentRoute();
      resetButton.textContent = route ? 'Reset this route' : 'Reset all edits';
      resetButton.disabled = route ? ![...edits.keys()].some(key => editLocation(key).route === route) &&
        !unresolvedEdits.some(copy => copy.route === route) && !workingCopies.some(copy => copy.route === route) :
        !hasDraft;
    }
    const resumeButton = $('#resume-text-draft');
    if (resumeButton) resumeButton.hidden = !resumable.length;
    const reviewButton = $('#review-text-draft');
    if (reviewButton) { reviewButton.hidden = !pending; reviewButton.textContent = `Review saved copies (${pending})`; }
    const workingStatus = $('#text-working-status');
    if (workingStatus && !reviewingCopies) workingStatus.textContent = storageWarning ? 'Export a copy before closing this passage.' : activeWorkingId ? 'Your unfinished text is protected in this browser.' : 'Your text is protected in this browser as you type.';
    $('#cancel-text-edit').hidden = reviewingCopies || !activeWorkingId;
    if (active) $('#restore-passage').disabled = passageSource(active, activeRoute) === active.original && !activeWorkingId;
    if (dialog?.open) $('#text-edit-error').textContent = storageWarning;
  }

  function emptyState() { return {edits: new Map(), unresolvedEdits: [], recoveryCopies: [], workingCopies: []}; }

  function stateFromRaw(raw, archives) {
    if (!raw) return emptyState();
    try { return validateDraft(JSON.parse(raw), archives); }
    catch (_) {
      const state = emptyState();
      state.recoveryCopies.push({reason: 'This saved draft could not be read and is retained without changing it.', raw});
      return state;
    }
  }

  function retainConcurrent(state, key, source, reason) {
    retainUnique(state.unresolvedEdits, {...passageRecord(key, source), baseVersion: version, reason});
  }

  function keepEarlierForReview(state, key, reason) {
    state.unresolvedEdits = state.unresolvedEdits.map(copy => {
      if (!retryableRecord(copy) || resolveRecord(copy).key !== key) return copy;
      return {...copy, reanchorPending: false, previousReason: copy.reason, reason};
    });
  }

  function applyChange(state, event) {
    const patch = event.patch;
    if (patch.reset) return emptyState();
    if (isRoute(patch.resetRoute)) {
      const route = patch.resetRoute;
      for (const key of state.edits.keys()) if (editLocation(key).route === route) state.edits.delete(key);
      state.unresolvedEdits = state.unresolvedEdits.filter(copy => copy?.route !== route);
      state.workingCopies = state.workingCopies.filter(copy => copy?.route !== route);
    }
    (patch.editsSet || []).forEach(({record, previous}) => {
      const checked = validateDraft({format: 'quasiplanar-text-draft', version: 1, baseVersion: event.baseVersion, edits: [record]});
      checked.unresolvedEdits.forEach(entry => retainUnique(state.unresolvedEdits, entry));
      checked.recoveryCopies.forEach(entry => retainUnique(state.recoveryCopies, entry));
      checked.edits.forEach((source, key) => {
        const current = state.edits.get(key);
        if (current !== undefined && current !== source && current !== previous)
          retainConcurrent(state, key, current, 'Another window saved different wording for this passage. Both versions are kept for review.');
        state.edits.set(key, source);
      });
      const match = resolveRecord(record);
      if (match.merged) {
        const key = match.key;
        const current = state.edits.get(key);
        if (current !== undefined && current !== previous)
          retainConcurrent(state, key, current, 'Another window saved different wording for this passage. Both versions are kept for review.');
        state.edits.delete(key);
        keepEarlierForReview(state, key, 'Newer saved wording is already in the article. This earlier copy is kept for review.');
      }
    });
    (patch.editsDelete || []).forEach(record => {
      const {previous} = record;
      const resolved = resolveRecord({...record, source: previous});
      const direct = aliases.get(record.key);
      const legacy = !record.route && !record.originalHash && direct?.size === 1 ? [...direct][0] : null;
      const key = resolved.key || (legacy && state.edits.get(legacy.key) === previous ? legacy.key : null);
      if (!key) return;
      keepEarlierForReview(state, key, 'This saved wording was explicitly restored. Its copy remains available for review.');
      const current = state.edits.get(key);
      if (current !== undefined && current !== previous)
        retainConcurrent(state, key, current, 'Another window had different wording when this passage was restored. It is kept for review.');
      state.edits.delete(key);
    });
    (patch.unresolvedAdd || []).forEach(entry => retainUnique(state.unresolvedEdits, entry));
    (patch.recoveryAdd || []).forEach(entry => retainUnique(state.recoveryCopies, entry));
    (patch.workingSet || []).forEach(({record, previous}) => {
      const checked = validateDraft({format: 'quasiplanar-text-draft', version: 1, baseVersion: event.baseVersion, edits: [], workingCopies: [record]});
      checked.recoveryCopies.forEach(entry => retainUnique(state.recoveryCopies, entry));
      if (!checked.workingCopies.length) return;
      const index = state.workingCopies.findIndex(copy => copy.id === record.id);
      const current = state.workingCopies[index];
      if (current && current.source !== record.source && current.source !== previous)
        retainUnique(state.workingCopies, {...current, id: current.id + ':alternative:' + event.id,
          reason: 'Another window edited this unfinished passage. Both versions are kept for review.'});
      if (index === -1) state.workingCopies.push(checked.workingCopies[0]);
      else state.workingCopies[index] = checked.workingCopies[0];
    });
    (patch.workingDelete || []).forEach(({id, previous}) => {
      const index = state.workingCopies.findIndex(copy => copy.id === id);
      const current = state.workingCopies[index];
      if (current && current.source !== previous)
        retainUnique(state.workingCopies, {...current, id: current.id + ':alternative:' + event.id,
          reason: 'Another window changed this unfinished passage before it was closed. That wording is kept for review.'});
      if (index !== -1) state.workingCopies.splice(index, 1);
      // Discard the same wording if another window had retained it under a conflict id.
      state.workingCopies = state.workingCopies.filter(copy =>
        !(copy.source === previous && copy.id.startsWith(id + ':alternative:')));
    });
    return state;
  }

  function readJournal() {
    const seed = localStorage.getItem(journalBaseKey);
    if (seed === null) return null;
    let baseRaw;
    try { baseRaw = JSON.parse(seed).raw; }
    catch (_) { baseRaw = seed; }
    const externalCopies = [];
    const projection = localStorage.getItem(storageKey);
    if (projection && projection !== baseRaw) {
      try {
        if (!Number.isFinite(JSON.parse(projection).journalRevision)) externalCopies.push({
          reason: 'Text saved by an older presentation window is kept for review.', raw: projection});
      } catch (_) { externalCopies.push({reason: 'An unreadable browser draft is kept without changing it.', raw: projection}); }
    }
    const events = [], seen = new Set(), brokenEvents = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(journalPrefix) || seen.has(key)) continue;
      seen.add(key);
      const raw = localStorage.getItem(key);
      try {
        const event = JSON.parse(raw);
        if (!event || !Number.isFinite(event.order) || !event.patch || typeof event.id !== 'string') throw new Error('Unfamiliar browser change');
        events.push(event);
      } catch (_) { brokenEvents.push({reason: 'An earlier browser change is kept without changing it.', raw, key}); }
    }
    events.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    // Protect archived copies from reanchoring when the oldest snapshot is read.
    const archives = events.flatMap(event => Array.isArray(event.patch.unresolvedAdd) ? event.patch.unresolvedAdd : []);
    let state = stateFromRaw(baseRaw, archives);
    [...externalCopies, ...brokenEvents].forEach(entry => retainUnique(state.recoveryCopies, entry));
    events.forEach(event => { state = applyChange(state, event); });
    // Reconsider missing-location copies together after replay, so two retained
    // alternatives cannot be mistaken for one unique pending edit.
    state = validateDraft({format: 'quasiplanar-text-draft', version: 1, baseVersion: version,
      edits: [...state.edits].map(([key, source]) => passageRecord(key, source)),
      unresolvedEdits: state.unresolvedEdits, recoveryCopies: state.recoveryCopies, workingCopies: state.workingCopies});
    return {state, order: events.at(-1)?.order || 0, externalCopies};
  }

  function makePatch(before, after, options = {}) {
    if (options.reset) return {reset: true};
    if (options.resetRoute) return {resetRoute: options.resetRoute};
    const oldEdits = new Map((before?.edits || []).map(entry => [recordKey(entry), entry]));
    const newEdits = new Map(after.edits.map(entry => [recordKey(entry), entry]));
    const oldWork = new Map((before?.workingCopies || []).map(entry => [entry.id, entry]));
    const newWork = new Map(after.workingCopies.map(entry => [entry.id, entry]));
    const expected = (kind, key, fallback) => options[kind] && Object.hasOwn(options[kind], key) ? options[kind][key] : fallback;
    const additions = name => after[name].filter(entry => !(before?.[name] || []).some(old => JSON.stringify(old) === JSON.stringify(entry)));
    return {
      editsSet: [...newEdits].filter(([key, record]) => recordValue(oldEdits.get(key)) !== recordValue(record))
        .map(([key, record]) => ({record, previous: expected('expectedEdits', key, recordValue(oldEdits.get(key)))})),
      editsDelete: [...oldEdits].filter(([key]) => !newEdits.has(key))
        .map(([key, old]) => ({...old, previous: expected('expectedEdits', key, recordValue(old))})),
      workingSet: after.workingCopies.filter(entry => JSON.stringify(oldWork.get(entry.id)) !== JSON.stringify(entry))
        .map(record => ({record, previous: expected('expectedWorking', record.id, oldWork.get(record.id)?.source)})),
      workingDelete: [...oldWork].filter(([id]) => !newWork.has(id)).map(([id, old]) => ({id, previous: expected('expectedWorking', id, old.source)})),
      unresolvedAdd: additions('unresolvedEdits'), recoveryAdd: additions('recoveryCopies')
    };
  }

  function adoptState(state, remember = true) {
    edits.clear(); state.edits.forEach((source, key) => edits.set(key, source));
    for (const [target, incoming] of [[unresolvedEdits, state.unresolvedEdits], [recoveryCopies, state.recoveryCopies], [workingCopies, state.workingCopies]]) {
      target.length = 0; target.push(...incoming);
    }
    if (activeWorkingId && !workingCopies.some(copy => copy.id === activeWorkingId))
      activeWorkingId = workingCopies.find(copy => copy.key === active?.key && (copy.route ?? null) === activeRoute && copy.source === sourceField.value)?.id || null;
    renderPassages();
    if (remember) lastSnapshot = draftPayload();
  }

  function refreshJournal() {
    try {
      const journal = readJournal();
      if (!journal) return;
      let state = journal.state;
      if (hasUnwrittenChanges) state = applyChange(state, {id: 'unwritten:' + tabId, baseVersion: version, patch: makePatch(lastSnapshot, draftPayload())});
      adoptState(state, !hasUnwrittenChanges);
    } catch (_) { /* In-memory work remains available when browser storage is inaccessible. */ }
  }

  function persist(options = {}) {
    savedAt = new Date().toISOString();
    const patch = makePatch(lastSnapshot, draftPayload(), options);
    let recorded = false;
    try {
      if (localStorage.getItem(journalBaseKey) === null)
        localStorage.setItem(journalBaseKey, JSON.stringify({raw: localStorage.getItem(storageKey)}));
      const prior = readJournal();
      prior.externalCopies.forEach(entry => retainUnique(patch.recoveryAdd || (patch.recoveryAdd = []), entry));
      const event = {id: tabId + ':' + Math.random().toString(36).slice(2),
        order: Math.max(Date.now(), prior.order + 1), baseVersion: version, patch};
      const onlyWorking = options.reason === 'working-copy' && patch.workingSet?.length === 1 && !patch.workingDelete.length && !patch.editsSet.length && !patch.editsDelete.length && !patch.unresolvedAdd.length && !patch.recoveryAdd.length;
      // Coalesce typing within this window; explicit saves and deletions remain separate changes.
      const key = onlyWorking ? journalPrefix + 'typing:' + tabId + ':' + patch.workingSet[0].record.id : journalPrefix + event.id;
      localStorage.setItem(key, JSON.stringify(event));
      recorded = true;
      const journal = readJournal();
      adoptState(journal.state);
      hasUnwrittenChanges = false;
      // The journal is authoritative. An older viewer's projection is optional.
      if (!onlyWorking) try {
        localStorage.setItem(storageKey, JSON.stringify({...draftPayload(), journalRevision: journal.order}));
      } catch (_) { /* A full projection must not turn a journal save into a failure. */ }
      storageWarning = '';
    } catch (_) {
      hasUnwrittenChanges = !recorded;
      storageWarning = recorded ? 'Your change was recorded. Reopen the page to refresh the draft.' :
        'Browser saving is unavailable. Keep this page open or export your edits.';
    }
    updateStatus();
    // A local preview may listen to make an additional project copy; the static site does no networking.
    if (options.mirror !== false) try {
      document.dispatchEvent(new CustomEvent('quasiplanar-draft-change', {detail: {
        payload: draftPayload(), reason: options.reason || (options.reset ? 'reset' : 'save'), flush: options.flush !== false,
        browserSaved: recorded, saveId: options.saveId
      }}));
    } catch (_) { /* Optional listeners cannot interrupt browser draft protection. */ }
    return recorded;
  }

  function retainUnique(list, entry) {
    const signature = JSON.stringify(entry);
    if (!list.some(existing => JSON.stringify(existing) === signature)) list.push(entry);
  }

  function validateDraft(payload, knownCopies = []) {
    const result = {edits: new Map(), unresolvedEdits: [], recoveryCopies: [], workingCopies: []};
    if (!payload || payload.format !== 'quasiplanar-text-draft' || payload.version !== 1 || !Array.isArray(payload.edits)) {
      result.recoveryCopies.push({reason: 'This draft uses an unfamiliar format and is retained without changing it.', payload});
      return result;
    }
    const retryable = retryableRecord;
    const retrySources = new Map();
    const mergedPassages = new Set();
    const earlierCopies = Array.isArray(payload.unresolvedEdits) ? payload.unresolvedEdits : [];
    const archives = new Set([...knownCopies, ...earlierCopies].filter(copy => copy?.archived === true).map(copyIdentity));
    const retainedArchives = new Set();
    for (const edit of earlierCopies) {
      if (!edit || typeof edit.source !== 'string' || !retryable(edit)) continue;
      if (archives.has(copyIdentity(edit))) continue;
      const match = resolveRecord(edit);
      if (!match.block || match.merged) continue;
      if (!retrySources.has(match.key)) retrySources.set(match.key, new Set());
      retrySources.get(match.key).add(recordValue(edit));
    }
    const inspect = (edit, baseVersion, retained = false) => {
      if (!edit || typeof edit.key !== 'string' || typeof edit.source !== 'string' || edit.source.length > 100000) {
        result.recoveryCopies.push({reason: 'This passage could not be applied and is retained without changing it.', baseVersion, payload: edit});
        return;
      }
      const identity = retained ? copyIdentity(edit) : null;
      if (archives.has(identity)) {
        if (!retainedArchives.has(identity)) {
          result.unresolvedEdits.push(markArchived({...edit, baseVersion}));
          retainedArchives.add(identity);
        }
        return;
      }
      const match = resolveRecord(edit), {block, key} = match;
      // A source already present in the article has been merged, even if its old hash differs.
      if (match.merged) {
        if (!retained) mergedPassages.add(key);
        return;
      }
      const source = recordValue(edit);
      const conflict = block && ((retained && mergedPassages.has(key)) ||
        (result.edits.has(key) && result.edits.get(key) !== source));
      const canRetry = retryable(edit) && (!block || (retrySources.get(key)?.size || 0) <= 1);
      if (block && (!retained || canRetry) && !conflict) {
        result.edits.set(key, source);
        return;
      }
      const reason = match.reason || (!block ? 'This passage no longer has a matching place in the article.'
        : conflict ? 'Another saved wording occupies this passage.'
        : baseVersion !== version ? 'The original text changed in a different presentation version.'
        : 'The original text changed after this draft was made.');
      retainUnique(result.unresolvedEdits, {
        ...edit, baseVersion, reason: typeof edit.reason === 'string' ? edit.reason : reason,
        reanchorPending: !conflict && (!retained || retryable(edit))
      });
    };
    payload.edits.forEach(edit => inspect(edit, payload.baseVersion));
    if (Array.isArray(payload.unresolvedEdits)) payload.unresolvedEdits.forEach(edit => inspect(edit, edit?.baseVersion ?? payload.baseVersion, true));
    else if (payload.unresolvedEdits !== undefined) result.recoveryCopies.push({reason: 'An earlier passage list could not be read.', payload: payload.unresolvedEdits});
    if (Array.isArray(payload.recoveryCopies)) payload.recoveryCopies.forEach(entry => retainUnique(result.recoveryCopies, entry));
    else if (payload.recoveryCopies !== undefined) result.recoveryCopies.push({reason: 'An earlier recovery copy could not be read.', payload: payload.recoveryCopies});
    if (Array.isArray(payload.workingCopies)) payload.workingCopies.forEach(copy => {
      if (!copy || typeof copy.key !== 'string' || typeof copy.source !== 'string') {
        result.recoveryCopies.push({reason: 'This unfinished passage could not be matched and is retained without changing it.', payload: copy});
        return;
      }
      const match = resolveRecord(copy), block = match.block;
      const moved = block && (block.key !== copy.key || block.originalHash !== copy.originalHash);
      const retained = {...copy, id: typeof copy.id === 'string' ? copy.id : 'unfinished:' + hash(JSON.stringify(copy)),
        ...(block ? {key: block.key, originalHash: block.originalHash, originalSource: block.original,
          ...(block.node.id ? {stableId: '#' + block.node.id} : {})} : {}),
        ...(moved ? {previousAnchor: copy.previousAnchor || {key: copy.key, originalHash: copy.originalHash, originalSource: copy.originalSource, stableId: copy.stableId}} : {})};
      if (!block && !retained.reason) retained.reason = match.reason || 'The original passage changed; this unfinished text is kept for review.';
      retainUnique(result.workingCopies, retained);
    });
    else if (payload.workingCopies !== undefined) result.recoveryCopies.push({reason: 'An unfinished-passage list could not be read.', payload: payload.workingCopies});
    return result;
  }

  function mergeDraft(restored) {
    restored.unresolvedEdits.forEach(entry => retainUnique(unresolvedEdits, entry));
    restored.recoveryCopies.forEach(entry => retainUnique(recoveryCopies, entry));
    restored.workingCopies.forEach(copy => {
      const existing = workingCopies.find(item => item.id === copy.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(copy)) copy = {...copy, id: copy.id + ':alternative:' + hash(JSON.stringify(copy))};
      retainUnique(workingCopies, copy);
    });
    restored.edits.forEach((source, key) => {
      const previous = edits.get(key);
      if (previous !== undefined && previous !== source) retainUnique(unresolvedEdits, {
        ...passageRecord(key, previous), baseVersion: version,
        reason: 'This wording was replaced by an imported version and is retained as an alternative.'
      });
      edits.set(key, source);
    });
  }

  function exportDraft() {
    refreshJournal();
    updateStatus();
    const data = JSON.stringify(draftPayload(), null, 2);
    const url = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `quasiplanar-text-edits-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setEditing(on) {
    if (on) refreshJournal();
    editing = on;
    document.body.classList.toggle('text-editing', on);
    editButton.setAttribute('aria-pressed', String(on));
    toolbar.hidden = !on;
    blocks.forEach(block => {
      if (on) {
        block.node.setAttribute('tabindex', '0');
        block.node.setAttribute('aria-description', 'Click or press Enter to edit this passage.');
      } else {
        if (block.tabindex === null) block.node.removeAttribute('tabindex');
        else block.node.setAttribute('tabindex', block.tabindex);
        block.node.removeAttribute('aria-description');
      }
    });
    updateStatus();
  }

  function setReviewMode(on) {
    reviewingCopies = on;
    sourceField.readOnly = on;
    $('#text-edit-title').textContent = on ? 'Saved text copies' : 'Rewrite this passage';
    $('label[for="text-edit-source"]').textContent = on ? 'Saved text — select and copy any part' : 'Your text';
    $('#draft-review-controls').hidden = !on;
    $('#select-reviewed-text').hidden = !on;
    $('#save-text-edit').hidden = $('#restore-passage').hidden = on;
    $('#cancel-text-edit').hidden = on || !activeWorkingId;
    $$('.text-edit-help', dialog).forEach(node => { node.hidden = on; });
  }

  function reviewSavedCopies() {
    refreshJournal(); updateStatus();
    if (dialog.open || !showReviewEntries()) return;
    active = null; activeWorkingId = null; returnFocus = document.activeElement;
    setReviewMode(true);
    $('#text-edit-context').textContent = 'Earlier wording is kept here until you decide what to use.';
    $('#draft-review-status').textContent = '';
    dialog.showModal(); sourceField.focus();
  }

  function archiveReviewCopies(copies, preferredIndex) {
    const identities = new Set(copies.map(copyIdentity));
    refreshJournal();
    let archived = 0;
    unresolvedEdits.forEach((record, index) => {
      if (record.archived === true || !identities.has(copyIdentity(record))) return;
      unresolvedEdits[index] = markArchived(record);
      archived++;
    });
    if (archived) persist({reason: 'save'});
    else updateStatus();
    showReviewEntries(preferredIndex);
    $('#draft-review-status').textContent = archived ?
      `${archived} ${archived === 1 ? 'copy' : 'copies'} archived. Export edits includes the archived text.` :
      'The review list was refreshed.';
    const select = $('#draft-review-select');
    (select.disabled ? $('#close-text-edit') : select).focus();
  }

  function showReviewEntries(preferredIndex = 0) {
    const labelFor = copy => [routeLabel(copy.route) || 'Shared text', copy.key].join(' · ');
    const entries = [
      ...unresolvedEdits.filter(copy => copy.archived !== true).map(copy => ({label: 'Saved passage · ' + labelFor(copy), source: copy.source, reason: copy.reason, copy})),
      ...workingCopies.filter(workingCopyNeedsReview).map(copy => ({label: 'Unfinished passage · ' + labelFor(copy), source: copy.source, reason: copy.reason})),
      ...recoveryCopies.map((copy, i) => ({label: 'Recovery copy ' + (i + 1),
        source: typeof copy === 'string' ? copy : typeof copy?.raw === 'string' ? copy.raw : typeof copy?.payload?.source === 'string' ? copy.payload.source : JSON.stringify(copy?.payload ?? copy, null, 2) ?? '', reason: copy?.reason}))
    ];
    const select = $('#draft-review-select');
    const archive = $('#archive-reviewed-copy');
    const archiveAll = $('#archive-all-reviewed-copies');
    const savedCopies = entries.filter(entry => entry.copy).map(entry => entry.copy);
    select.replaceChildren(...entries.map((entry, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = (i + 1) + '. ' + entry.label;
      if (entry.copy) {
        option.dataset.copyKey = entry.copy.key;
        option.dataset.copyRoute = entry.copy.route || '';
        option.dataset.copyId = hash(copyIdentity(entry.copy));
      }
      return option;
    }));
    select.disabled = !entries.length;
    select.selectedIndex = Math.min(preferredIndex, entries.length - 1);
    const show = () => {
      const entry = entries[select.selectedIndex];
      sourceField.value = entry?.source || '';
      $('#draft-review-reason').textContent = entry ? entry.reason || 'This copy was not applied automatically.' : '';
      archive.hidden = !entry?.copy;
    };
    select.onchange = show;
    archive.onclick = () => {
      const copy = entries[select.selectedIndex]?.copy;
      if (copy && reviewingCopies) archiveReviewCopies([copy], select.selectedIndex);
    };
    archiveAll.hidden = savedCopies.length < 2;
    archiveAll.onclick = () => { if (reviewingCopies) archiveReviewCopies(savedCopies, 0); };
    show();
    return entries.length > 0;
  }

  function openBlock(block, workingCopy = null) {
    refreshJournal();
    setReviewMode(false);
    active = block;
    activeRoute = scopeFor(block);
    returnFocus = document.activeElement;
    const unfinished = workingCopy || matchingWorkingCopies().filter(copy => copy.key === block.key).at(-1);
    activeWorkingId = unfinished?.id || null;
    activePreviousSource = unfinished && Object.hasOwn(unfinished, 'previousSource') ? unfinished.previousSource : edits.get(scopedKey(block.key, activeRoute));
    activeWorkingSource = unfinished?.source ?? null;
    sourceField.value = unfinished ? unfinished.source : passageSource(block, activeRoute);
    $('#text-edit-context').textContent = routeLabel(block.route || activeRoute) || 'All reading routes';
    $('#text-edit-error').textContent = '';
    dialog.showModal();
    updateStatus();
    sourceField.focus();
  }

  function removeWorkingCopy(id) {
    const index = workingCopies.findIndex(copy => copy.id === id);
    if (index === -1) return false;
    workingCopies.splice(index, 1);
    return true;
  }

  function protectWorkingCopy() {
    if (!active) return;
    if (!activeWorkingId && sourceField.value === passageSource(active, activeRoute)) return;
    let copy = workingCopies.find(item => item.id === activeWorkingId);
    if (copy?.source === sourceField.value && !hasUnwrittenChanges) return;
    if (!copy) {
      copy = {
        id: 'unfinished:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2),
        ...passageRecord(scopedKey(active.key, activeRoute), sourceField.value),
        baseVersion: version, previousSource: activePreviousSource === undefined ? false : activePreviousSource
      };
      workingCopies.push(copy);
      activeWorkingId = copy.id;
    }
    copy.source = sourceField.value;
    copy.savedAt = new Date().toISOString();
    persist({reason: 'working-copy', flush: false, expectedWorking: {[copy.id]: activeWorkingSource}});
    activeWorkingSource = sourceField.value;
  }

  function closeBlock(discardWorking = false) {
    awaitingProjectSave = null;
    const workId = activeWorkingId, previous = activeWorkingSource;
    const removed = discardWorking && activeWorkingId && removeWorkingCopy(activeWorkingId);
    dialog.close();
    if (reviewingCopies) setReviewMode(false);
    active = null;
    activeRoute = null;
    activeWorkingId = null;
    if (removed) persist({reason: 'cancel', expectedWorking: {[workId]: previous}});
    else updateStatus();
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll: true});
  }

  function saveBlock() {
    if (!active) return;
    const key = scopedKey(active.key, activeRoute), previous = activePreviousSource;
    const workId = activeWorkingId, previousWork = activeWorkingSource;
    const source = sourceField.value;
    const saveId = tabId + ':save:' + Math.random().toString(36).slice(2);
    const inherited = activeRoute ? passageSource(active, null) : active.original;
    if (source === inherited) edits.delete(key);
    else edits.set(key, activeRoute && source === active.original ? null : source);
    renderPassages();
    removeWorkingCopy(activeWorkingId);
    activeWorkingId = null;
    const recorded = persist({reason: source === active.original ? 'restore' : 'save', saveId,
      expectedEdits: {[key]: previous}, expectedWorking: workId ? {[workId]: previousWork} : {}});
    if (recorded) closeBlock();
    else awaitingProjectSave = {saveId, block: active, source};
  }

  function registerBlock(node, key = keyFor(node), metadata = {}) {
    if (blocks.has(key)) return;
    const original = node.innerHTML;
    const block = {key, node, original, originalHash: hash(original), tabindex: node.getAttribute('tabindex'), rendered: '', ...metadata};
    blocks.set(key, block);
    addAlias(key, block, !!node.dataset.editKey || !!metadata.route || key === '#' + node.id);
    if (node.id) addAlias('#' + node.id, block, true);
    node.dataset.editBlock = key;
  }

  // Capture original prose before KaTeX adds its accessibility and layout markup.
  $$('main p,main h1,main h2,main h3,main figcaption,main .head-count,main .count-factor,main .count-capacity,main .count-total,main .open-question,main .theorem-note,main .proof-body td,main .proof-body th').forEach(node => {
    if (node.closest(excluded) || !node.textContent.trim()) return;
    registerBlock(node);
  });
  $$('main .section-number,main summary > span,main .theorem-line > .small-label,main .count-labels > span').forEach(node => {
    if (node.textContent.trim()) registerBlock(node);
  });
  // Route controls keep their native button behavior outside editing mode.
  $$('.route-choices > [data-route-choice]').forEach(panel => {
    const route = panel.dataset.routeChoice;
    const title = $(':scope > strong', panel);
    const description = $(':scope > span:not(.route-number):not(.route-check)', panel);
    if (title) registerBlock(title, `route-panel:${route}:title`, {route, field: 'title'});
    if (description) registerBlock(description, `route-panel:${route}:description`, {route, field: 'description'});
  });

  const toolbar = document.createElement('aside');
  toolbar.id = 'text-edit-toolbar';
  toolbar.hidden = true;
  toolbar.setAttribute('aria-label', 'Text editing');
  toolbar.innerHTML = '<div><strong>Make this your draft</strong><span id="text-edit-status" role="status"></span></div><div class="text-edit-actions"><button id="resume-text-draft" type="button" hidden>Resume unfinished passage</button><button id="review-text-draft" type="button" hidden>Review saved copies</button><button id="export-text-draft" type="button">Export edits</button><button id="open-import-text-draft" type="button">Import edits</button><input id="import-text-draft" type="file" accept="application/json,.json" hidden><button id="reset-text-draft" type="button">Reset my edits</button></div><p>Click a passage, route title, or description to rewrite it. Finish editing to choose another route. Export your edits to bring them back into the source later.</p>';
  document.body.append(toolbar);
  let editButton = $('#edit-text');
  if (!editButton) {
    editButton = document.createElement('button');
    editButton.id = 'edit-text';
    editButton.type = 'button';
    editButton.className = 'text-button';
    editButton.textContent = 'Edit text';
    ($('.masthead') || document.body).append(editButton);
  }
  editButton.setAttribute('aria-pressed', 'false');

  const dialog = document.createElement('dialog');
  dialog.id = 'text-edit-dialog';
  dialog.setAttribute('aria-labelledby', 'text-edit-title');
  dialog.innerHTML = '<p id="text-edit-context" class="small-label"></p><h2 id="text-edit-title">Rewrite this passage</h2><label class="text-source-label" for="text-edit-source">Your text</label><textarea id="text-edit-source" spellcheck="true"></textarea><p class="text-edit-help">Use <code>$x^2$</code> for inline mathematics or <code>$$x^2$$</code> for a displayed equation. Backslash parentheses and brackets also work. Existing emphasis and links are kept as inline markup.</p><p class="text-edit-help"><span id="text-working-status"></span> Close or press Esc to keep it for later.</p><p id="text-edit-error" role="alert"></p><div class="text-dialog-actions"><button id="restore-passage" type="button">Use original text</button><button id="export-open-draft" type="button">Export draft</button><span></span><button id="cancel-text-edit" type="button" hidden>Discard unfinished text</button><button id="close-text-edit" type="button">Close</button><button id="save-text-edit" type="button">Save passage</button></div>';
  document.body.append(dialog);
  const sourceField = $('#text-edit-source');
  const reviewControls = document.createElement('div');
  reviewControls.id = 'draft-review-controls'; reviewControls.hidden = true;
  reviewControls.innerHTML = '<label class="text-source-label" for="draft-review-select">Choose a saved copy</label><select id="draft-review-select" style="max-width:100%;width:100%"></select><p id="draft-review-reason"></p><button id="archive-reviewed-copy" type="button" hidden>Archive this copy</button> <button id="archive-all-reviewed-copies" type="button" aria-description="Archive the saved passages listed here." hidden>Archive all saved copies</button><p id="draft-review-status" role="status"></p>';
  $('label[for="text-edit-source"]', dialog).before(reviewControls);
  const selectReviewed = document.createElement('button');
  selectReviewed.id = 'select-reviewed-text'; selectReviewed.type = 'button'; selectReviewed.hidden = true; selectReviewed.textContent = 'Select all text';
  $('#export-open-draft').after(selectReviewed);

  const resetDialog = document.createElement('dialog');
  resetDialog.id = 'draft-reset-dialog';
  resetDialog.setAttribute('aria-labelledby', 'draft-reset-title');
  resetDialog.innerHTML = '<h2 id="draft-reset-title"></h2><p id="draft-reset-description"></p><div class="text-dialog-actions"><button id="export-before-reset" type="button">Export edits</button><span></span><button id="cancel-draft-reset" type="button">Keep editing</button><button id="confirm-draft-reset" type="button">Reset edits</button></div>';
  document.body.append(resetDialog);

  try {
    const journal = readJournal();
    if (journal) adoptState(journal.state);
    else mergeDraft(stateFromRaw(localStorage.getItem(storageKey)));
  } catch (error) { storageWarning = error instanceof Error ? error.message : 'Your saved draft could not be loaded.'; }
  renderPassages();
  renderMath();
  lastSnapshot = draftPayload();
  updateStatus();

  editButton.addEventListener('click', () => setEditing(!editing));
  document.addEventListener('quasiplanar-route-change', () => { renderPassages(); updateStatus(); });
  function controlBlockFor(target) {
    const subtitle = target.closest('summary > [data-edit-block]');
    if (subtitle) return blocks.get(subtitle.dataset.editBlock);
    const panel = target.closest('.route-choices > [data-route-choice]');
    if (!panel) return null;
    const field = target.closest('[data-edit-block]') || $(':scope > strong[data-edit-block]', panel);
    return field ? blocks.get(field.dataset.editBlock) : null;
  }
  function editControl(event) {
    if (!editing) return;
    const block = controlBlockFor(event.target);
    if (!block) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openBlock(block);
  }
  // Capture before route selection or a proof subtitle's native toggle can run.
  document.addEventListener('click', editControl, true);
  document.addEventListener('keydown', event => {
    if (['Enter', ' '].includes(event.key)) editControl(event);
  }, true);
  document.addEventListener('click', event => {
    if (!editing || event.target.closest('a,button,input,summary,textarea,dialog')) return;
    const node = event.target.closest('[data-edit-block]');
    if (node) { event.preventDefault(); openBlock(blocks.get(node.dataset.editBlock)); }
  });
  document.addEventListener('keydown', event => {
    if (!editing || !['Enter', ' '].includes(event.key) || event.target.closest('dialog')) return;
    const key = event.target.dataset?.editBlock;
    if (key && blocks.has(key)) { event.preventDefault(); openBlock(blocks.get(key)); }
  });
  $('#save-text-edit').addEventListener('click', saveBlock);
  document.addEventListener('quasiplanar-project-draft-saved', event => {
    const pending = awaitingProjectSave;
    if (!pending || pending.saveId !== event.detail?.saveId || pending.block !== active || pending.source !== sourceField.value) return;
    storageWarning = 'Your passage is saved in the project. Browser saving is unavailable.';
    closeBlock();
  });
  $('#cancel-text-edit').addEventListener('click', () => closeBlock(true));
  const keepUnfinished = () => { protectWorkingCopy(); closeBlock(); };
  $('#close-text-edit').addEventListener('click', keepUnfinished);
  $('#restore-passage').addEventListener('click', () => {
    if (active) { sourceField.value = active.original; protectWorkingCopy(); }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); keepUnfinished(); });
  sourceField.addEventListener('input', protectWorkingCopy);
  window.addEventListener('pagehide', protectWorkingCopy);
  sourceField.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); saveBlock(); }
  });
  $('#export-text-draft').addEventListener('click', exportDraft);
  $('#review-text-draft').addEventListener('click', reviewSavedCopies);
  selectReviewed.addEventListener('click', () => { sourceField.focus(); sourceField.select(); });
  $('#export-open-draft').addEventListener('click', () => { protectWorkingCopy(); exportDraft(); });
  $('#resume-text-draft').addEventListener('click', () => {
    const copy = matchingWorkingCopies().at(-1);
    if (copy) openBlock(blocks.get(copy.key), copy);
  });
  $('#open-import-text-draft').addEventListener('click', () => $('#import-text-draft').click());
  $('#export-before-reset').addEventListener('click', exportDraft);
  $('#reset-text-draft').addEventListener('click', () => {
    resetRoute = currentRoute();
    $('#draft-reset-title').textContent = resetRoute ? `Reset edits for ${routeLabel(resetRoute)}?` : 'Reset all edits?';
    $('#draft-reset-description').textContent = resetRoute ?
      'This clears the saved and unfinished text edits made in this route.' :
      'This clears all saved and unfinished text edits, including earlier copies kept for review.';
    resetDialog.showModal();
  });
  $('#cancel-draft-reset').addEventListener('click', () => resetDialog.close());
  $('#confirm-draft-reset').addEventListener('click', () => {
    const patch = resetRoute ? {resetRoute} : {reset: true};
    const state = {edits: new Map(edits), unresolvedEdits: [...unresolvedEdits],
      recoveryCopies: [...recoveryCopies], workingCopies: [...workingCopies]};
    adoptState(applyChange(state, {patch}), false);
    persist({...patch, reason: 'reset'});
    resetDialog.close();
  });
  $('#import-text-draft').addEventListener('change', async event => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 4000000) throw new Error('This file is too large for a text draft.');
      const raw = await file.text();
      try { mergeDraft(validateDraft(JSON.parse(raw), unresolvedEdits)); }
      catch (error) { recoveryCopies.push({reason: 'This imported draft could not be read and is retained without changing it.', raw}); }
      renderPassages();
      persist({reason: 'import'});
    } catch (error) {
      storageWarning = error instanceof Error ? error.message : 'This draft could not be imported.';
      updateStatus();
    }
    input.value = '';
  });

  observer = new MutationObserver(records => {
    withoutObserver(() => {
      const roots = new Set();
      records.forEach(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (!target || target.closest(skipped) || target.closest('#text-edit-toolbar')) return;
        const editable = target.closest('[data-edit-block]');
        const block = editable && blocks.get(editable.dataset.editBlock);
        if (block && hasVisibleEdit(block) && block.node.innerHTML !== block.rendered) applySource(block, passageSource(block));
        else roots.add(target);
      });
      roots.forEach(root => renderMath(root));
    });
  });
  observer.observe(document.body, {childList: true, subtree: true});
  window.QuasiplanarText = {
    renderMath: root => withoutObserver(() => renderMath(root)),
    getEdits: () => { refreshJournal(); updateStatus(); return draftPayload(); },
    exportDraft,
    setEditing,
    recoverProjectDraft(payload) {
      if (editing || hasUnwrittenChanges || edits.size || unresolvedEdits.length || recoveryCopies.length || workingCopies.length) return false;
      try {
        if (localStorage.getItem(storageKey) !== null || readJournal()?.order) return false;
      } catch (_) { /* The project copy can still be displayed when browser storage is unavailable. */ }
      if (payload?.format !== 'quasiplanar-text-draft' || payload.version !== 1 || !Array.isArray(payload.edits)) return false;
      mergeDraft(validateDraft(payload));
      renderPassages();
      if (!persist({mirror: false})) {
        storageWarning = 'Your draft is saved in the project. Browser saving is unavailable.';
        updateStatus();
      }
      return true;
    },
    version
  };
})();
