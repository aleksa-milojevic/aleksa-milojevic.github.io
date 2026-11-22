// PostHog is a delivery adapter. The presentation records its own event schema.
(() => {
  'use strict';

  const config = window.QuasiplanarAnalyticsConfig;
  const hosts = {eu: 'https://eu.i.posthog.com', us: 'https://us.i.posthog.com'};
  if (!config || !/^phc_[A-Za-z0-9_-]+$/.test(config.projectToken) ||
      !Object.hasOwn(hosts, config.region) || location.origin !== config.targetOrigin) return;

  const markedSurface = document.currentScript?.dataset.analyticsSurface;
  let surface;
  if ([config.basePath, config.basePath + 'index.html'].includes(location.pathname)) {
    surface = 'quasiplanar';
  } else if (markedSurface === 'straight-line' ||
      (markedSurface === 'homepage' && ['/', '/index.html'].includes(location.pathname))) {
    surface = markedSurface;
  }
  if (!surface) return;

  const params = new URLSearchParams(location.search);
  const optedOut = params.get('analytics') === 'off' ||
    navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const notice = document.getElementById('analytics-notice');
  if (notice) {
    notice.hidden = false;
    if (optedOut) {
      notice.querySelector('[data-analytics-opt-out]').hidden = true;
      notice.querySelector('[data-analytics-opted-out]').hidden = false;
    }
    if (params.get('analytics') === 'off') notice.open = true;
  }
  if (optedOut || !window.crypto?.randomUUID) return;

  const testVisit = params.get('analytics_test') === '1';
  const endpoint = hosts[config.region] + '/i/v1/analytics/events';
  const pending = [];
  let flushTimer;

  function report(reason) {
    if (testVisit) console.info('Presentation analytics:', reason);
  }

  function retryDelay(response, attempt) {
    const header = response?.headers.get('Retry-After');
    const seconds = /^\d+$/.test(header || '') ? Number(header) : 0;
    const dateDelay = header && !seconds ? Date.parse(header) - Date.now() : 0;
    return Math.max(attempt * 2000, seconds * 1000, dateDelay || 0);
  }

  function retry(batch, requestId, createdAt, attempt, response) {
    if (attempt >= 3) {
      report('delivery failed after three attempts');
      return;
    }
    const delay = retryDelay(response, attempt);
    if (delay <= 30_000) setTimeout(() => deliver(batch, requestId, createdAt, attempt + 1), delay);
  }

  async function deliver(batch, requestId, createdAt, attempt) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
        headers: {
          'Authorization': 'Bearer ' + config.projectToken,
          'Content-Type': 'application/json',
          'PostHog-Sdk-Info': 'quasiplanar-presentation/1.0.0',
          'PostHog-Request-Id': requestId,
          'PostHog-Attempt': String(attempt),
          'PostHog-Request-Timestamp': new Date().toISOString()
        },
        body: JSON.stringify({created_at: createdAt, batch})
      });
    } catch {
      retry(batch, requestId, createdAt, attempt);
      return;
    }
    if ([404, 408, 429, 500, 502, 503, 504].includes(response.status)) {
      retry(batch, requestId, createdAt, attempt, response);
      return;
    }
    if (!response.ok) {
      report('PostHog returned HTTP ' + response.status);
      return;
    }
    const {results} = await response.json().catch(() => ({}));
    if (!results) {
      report('PostHog did not return event results');
      return;
    }
    const retryBatch = batch.filter(item => results[item.uuid]?.result === 'retry');
    if (retryBatch.length) {
      const nextId = retryBatch.length === batch.length ? requestId : crypto.randomUUID();
      retry(retryBatch, nextId, createdAt, attempt, response);
    }
    const accepted = batch.filter(item => results[item.uuid]?.result === 'ok').length;
    report(`PostHog accepted ${accepted} of ${batch.length} events`);
  }

  function flush() {
    clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!pending.length) return;
    deliver(pending.splice(0), crypto.randomUUID(), new Date().toISOString(), 1);
  }

  function send(event, {urgent = false} = {}) {
    const {name, timestamp, ...properties} = event;
    pending.push({
      event: name,
      uuid: properties.event_id,
      timestamp,
      distinct_id: properties.visit_id,
      options: {process_person_profile: false},
      properties: {...properties, test_visit: testVisit, $geoip_disable: name !== 'presentation_visit'}
    });
    if (urgent || pending.length >= 10) flush();
    else if (flushTimer === undefined) flushTimer = setTimeout(flush, 1000);
  }

  window.QuasiplanarAnalyticsTransport = {
    enabled: true,
    surface,
    presentationVersion: config.presentationVersion,
    send,
    flush
  };
})();
