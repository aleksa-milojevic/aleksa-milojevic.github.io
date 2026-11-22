/* Measures the presentation. The transport decides where to send these events. */
(() => {
  'use strict';
  const transport = window.QuasiplanarAnalyticsTransport;
  if (!transport?.enabled || typeof window.crypto?.randomUUID !== 'function') return;

  const DWELL_MS = 2000;
  const CHECKPOINT_MS = 45000;
  const EVENT_LIMIT = 50;
  const OPTIONAL_EVENT_LIMIT = 16;
  const CHECKPOINT_LIMIT = 8;
  const routes = new Set(['curious', 'mathematician', 'expert']);
  const {surface = 'quasiplanar'} = transport;
  const hasRoutes = surface === 'quasiplanar';
  const tracksSections = surface !== 'homepage';
  const root = document.documentElement;
  const masthead = document.querySelector('.masthead');
  const navigation = document.querySelector(hasRoutes ? '.chapter-nav' : '.section-nav');
  const routeDialog = document.getElementById('route-dialog');
  const sections = new Map();
  if (tracksSections) {
    const selector = hasRoutes ? 'main > .hero, #choose, #story .chapter[id], #punchline'
      : 'section.hero, section.chapter[id], #coda';
    for (const element of document.querySelectorAll(selector)) {
      sections.set(element.matches('section.hero') ? 'hero' : element.id, element);
    }
  }
  const visitId = window.crypto.randomUUID();
  const parameters = new URLSearchParams(window.location.search);
  const tag = name => {
    const value = parameters.get(name)?.toLowerCase() ?? '';
    return /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(value) ? value : '';
  };
  let referrerHost = '';
  try {
    const referrer = new URL(document.referrer);
    if (['http:', 'https:'].includes(referrer.protocol)) referrerHost = referrer.hostname;
  } catch (_) { /* Direct arrivals have no referrer. */ }
  const entry = window.location.hash.slice(1);
  const attribution = {
    referrer_host: referrerHost,
    source: tag('utm_source') || referrerHost || 'direct',
    medium: tag('utm_medium'),
    campaign: tag('utm_campaign'),
    content: tag('utm_content'),
    entry_section: !tracksSections ? 'none' : sections.has(entry) ? entry : 'hero',
    viewport_class: window.innerWidth <= 760 ? 'narrow' : 'wide',
    test_visit: parameters.get('analytics_test') === '1'
  };

  let route = hasRoutes && routes.has(root.dataset.route) && !root.hasAttribute('data-route-pending') ? root.dataset.route : 'none';
  let seq = 0, selectionNumber = 0, optionalEvents = 0, checkpoints = 0;
  let measuredSections = [], active = null, frame = null, suspended = false;
  const reached = new Set();
  const interactions = new Set();

  function send(name, props, urgent = false) {
    if (seq >= EVENT_LIMIT) return false;
    transport.send({
      name,
      timestamp: new Date().toISOString(),
      visit_id: visitId,
      event_id: window.crypto.randomUUID(),
      seq: ++seq,
      schema_version: 1,
      presentation_version: transport.presentationVersion,
      surface,
      ...attribution,
      ...props
    }, {urgent});
    return true;
  }

  function sendInteraction(name, props, id, urgent = false) {
    const key = `${name}:${id}`;
    if (optionalEvents >= OPTIONAL_EVENT_LIMIT || interactions.has(key)) return;
    if (send(name, props, urgent)) {
      optionalEvents += 1;
      interactions.add(key);
    }
  }

  function refreshSections() {
    if (!hasRoutes) {
      measuredSections = [...sections];
      return;
    }
    const ids = ['hero', 'choose'];
    if (route !== 'none') {
      ids.push(...(window.QuasiplanarSectionNav?.sections() ?? []), 'punchline');
    }
    measuredSections = ids.filter(id => sections.has(id)).map(id => [id, sections.get(id)]);
  }

  function sectionContaining(node) {
    for (const [id, element] of measuredSections) {
      if (element.contains(node)) return id;
    }
    return null;
  }

  function sectionOnScreen() {
    if (routeDialog?.open) return 'choose';
    const headerBottom = masthead?.getBoundingClientRect().bottom ?? 0;
    const navRect = navigation && !navigation.hidden ? navigation.getBoundingClientRect() : null;
    const top = navRect && navRect.top <= headerBottom + 1 ? navRect.bottom : headerBottom;
    const bottom = window.innerHeight;
    const readingLine = top + (bottom - top) * 0.38;
    let nearest = null, mostVisible = 0;
    for (const [id, element] of measuredSections) {
      const rect = element.getBoundingClientRect();
      if (rect.top <= readingLine && readingLine < rect.bottom) return id;
      const visible = Math.min(rect.bottom, bottom) - Math.max(rect.top, top);
      if (visible > mostVisible) {
        nearest = id;
        mostVisible = visible;
      }
    }
    // Short chapters and gaps can leave the reading line outside the text.
    return mostVisible >= Math.min(80, (bottom - top) / 4) ? nearest : null;
  }

  function recordActive(now, close = false, urgent = false) {
    if (!active) return;
    const elapsed = now - active.start;
    if (elapsed >= DWELL_MS) {
      const properties = {route: active.route, section_id: active.id};
      if (!reached.has(active.key) && send('section_reached', properties, urgent)) {
        reached.add(active.key);
      }
      const unreported = elapsed - active.reported;
      const checkpoint = !close && checkpoints < CHECKPOINT_LIMIT && seq < EVENT_LIMIT - 12 && unreported >= CHECKPOINT_MS;
      if ((checkpoint || close) && unreported >= 1 && send('section_time', {
        ...properties,
        active_seconds: Math.round(unreported) / 1000
      }, urgent)) {
        active.reported = elapsed;
        if (checkpoint) checkpoints += 1;
      }
    }
    if (close) active = null;
  }

  function canMeasure() {
    return !suspended && document.visibilityState === 'visible';
  }

  function measure() {
    if (!canMeasure()) return;
    if (seq === 0) send('presentation_visit', {route});
    if (!tracksSections) return;
    const now = performance.now();
    const id = sectionOnScreen();
    if (active?.id !== id || (active && active.route !== route)) {
      recordActive(now, true);
      if (id) active = {id, route, key: `${route}:${id}`, start: now, reported: 0};
    }
    recordActive(now);
  }

  function scheduleMeasure() {
    if (frame !== null || !canMeasure()) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      measure();
    });
  }

  function pause() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    recordActive(performance.now(), true, true);
    transport.flush?.({urgent: true});
  }

  document.addEventListener('visibilitychange', () => {
    if (canMeasure()) scheduleMeasure();
    else pause();
  });
  window.addEventListener('pagehide', () => { suspended = true; pause(); });
  window.addEventListener('pageshow', () => { suspended = false; scheduleMeasure(); });

  if (!tracksSections) {
    measure();
    return;
  }

  document.addEventListener('quasiplanar-route-change', event => {
    const next = event.detail?.route;
    if (!hasRoutes || !routes.has(next) || next === route) return;
    const from = route;
    recordActive(performance.now(), true);
    route = next;
    refreshSections();
    ++selectionNumber;
    if (canMeasure()) {
      if (seq === 0) send('presentation_visit', {route: from});
      send('route_selected', {route, from_route: from, selection_number: selectionNumber});
      scheduleMeasure();
    }
  });

  document.addEventListener('click', event => {
    if (!event.isTrusted || !canMeasure()) return;
    const summary = event.target.closest?.('summary');
    const proof = summary?.parentElement;
    if (!proof?.matches('details[data-analytics-proof]:not([open])')) return;
    const sectionId = sectionContaining(proof);
    if (!sectionId) return;
    const proofId = proof.dataset.analyticsProof;
    const properties = {route, section_id: sectionId, proof_id: proofId};
    // Mouse and keyboard both activate a native summary through a click.
    // Wait for its default action so the bulk-toggle control stays uncounted.
    window.setTimeout(() => {
      if (!event.defaultPrevented && proof.open) {
        sendInteraction('proof_opened', properties, `${properties.route}:${proofId}`);
      }
    }, 0);
  }, true);

  document.addEventListener('quasiplanar-decomposition-progress', event => {
    const {stage, complete} = event.detail ?? {};
    if (!canMeasure() || !routes.has(route) || (stage !== 'example' && stage !== 'challenge')) return;
    const props = {route, section_id: 'sequences', stage};
    sendInteraction('game_started', props, stage);
    if (complete) sendInteraction('game_completed', props, stage);
  });

  function trackLink(event) {
    if (!canMeasure() || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest?.('a[data-analytics-link]');
    if (!link) return;
    const linkId = link.dataset.analyticsLink;
    const sectionId = sectionContaining(link) ?? 'footer';
    sendInteraction('presentation_outbound', {route, section_id: sectionId, link_id: linkId}, `${route}:${linkId}`, true);
  }

  document.addEventListener('click', trackLink, true);
  document.addEventListener('auxclick', trackLink, true);
  window.addEventListener('scroll', scheduleMeasure, {passive: true});
  window.addEventListener('resize', scheduleMeasure, {passive: true});
  window.addEventListener('hashchange', scheduleMeasure);
  window.setInterval(measure, 1000);

  refreshSections();
  measure();
})();
