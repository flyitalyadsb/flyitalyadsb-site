// The aircraft map's view: a plain browser script, inlined into
// aircraft-map.html by aircraft-map.ts (not a module, not bundled, no
// dependencies but Leaflet's global `L`).
//
// It speaks MCP Apps (SEP-1865, spec 2026-01-26) to the host directly:
// JSON-RPC 2.0 over postMessage with window.parent. The spec's own example
// does the same; the SDK's App class would add ~400 KB (zod + the MCP client)
// for the same five messages. Lifecycle: ui/initialize -> hostContext ->
// ui/notifications/initialized -> tool-input -> tool-result; size-changed on
// every resize; host-context-changed (theme, locale, display mode) at any time.
(() => {
  'use strict';

  const CFG = JSON.parse(document.getElementById('fia-config').textContent);
  const PROTOCOL_VERSION = '2026-01-26';
  const APP_INFO = { name: 'flyitalyadsb-aircraft-map', version: '1.0.0' };
  // Estimated motion: an airborne aircraft moves on along its track at its
  // ground speed from the time of its position, for at most MAX_EST_S; past
  // that it stays put and is drawn faded (stale), positions aren't invented.
  const MAX_EST_S = 60;
  const MIN_EST_KT = 40;
  const LIVE = { everyS: 30, maxMinutes: 10, ...(CFG.live || {}) };
  // Read when it matters, so a change of the setting applies at once (Leaflet's
  // own animations are chosen at start).
  const RM_QUERY = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const reducedMotion = () => RM_QUERY.matches;
  const REDUCED_MOTION = reducedMotion();
  const LIVE_MAP = 'https://mappa.flyitalyadsb.com/';
  const EMERGENCY = { '7500': 'hijack', '7600': 'radio', '7700': 'emergency' };

  // ---------------------------------------------------------------- strings
  const STR = {
    en: {
      count: (n) => (n === 1 ? '1 aircraft' : `${n} aircraft`),
      within: (r, place) => `within ${r} km of ${place}`,
      ago: (time, m) => `${time}, ${m} min ago`,
      shown: (n, total) => `${n} of ${total}`,
      savedPlace: (name) => (name ? `your saved position (${name})` : 'your saved position'),
      approxPlace: (name) => (name ? `your approximate location (${name})` : 'your approximate location'),
      special: {
        military: (n) => `${n} military aircraft`,
        privacy: (n) => `${n} aircraft with a privacy address (PIA)`,
        ladd: (n) => `${n} aircraft in the FAA LADD program`,
      },
      network: 'across the FlyItalyADSB network',
      found: 'found on the FlyItalyADSB network',
      loading: 'Finding aircraft…',
      loadingWhere: 'Asking the FlyItalyADSB network',
      sortNearest: 'Nearest', sortLowest: 'Lowest', sortHighest: 'Highest',
      sortLabel: 'Sort aircraft',
      listLabel: 'Aircraft in this result',
      mapLabel: (what) => `Map: ${what}`,
      ground: 'Ground',
      ft: 'ft', kt: 'kt', km: 'km', fpm: 'ft/min',
      altitude: 'Altitude', speed: 'Speed', track: 'Track', squawk: 'Squawk',
      source: 'Source', seen: 'Last seen', distance: 'Distance', noPosition: 'No position',
      secondsAgo: (s) => `${s} s ago`, minutesAgo: (m) => `${m} min ago`, hoursAgo: (h) => `${h} h ago`,
      climbing: 'climbing', descending: 'descending',
      emergency: { hijack: 'Hijack', radio: 'Radio failure', emergency: 'Emergency' },
      military: 'Military', pia: 'PIA', ladd: 'LADD',
      piaTitle: 'Privacy ICAO Address: the aircraft changes its hex code',
      laddTitle: 'FAA LADD: the owner asked to limit the display of this aircraft',
      sources: { adsb: 'ADS-B', mlat: 'MLAT', tisb: 'TIS-B', adsr: 'ADS-R', modes: 'Mode S', adsc: 'ADS-C', other: 'Other' },
      ask: 'Ask about it',
      askText: (label, hex) => `Tell me more about the aircraft ${label} (hex ${hex}) on the FlyItalyADSB map.`,
      openLive: 'Open live map',
      close: 'Close details',
      fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
      refresh: 'Refresh', refreshed: (time) => `Updated at ${time}`,
      refreshFailed: (msg) => `Couldn’t refresh: ${msg}`,
      live: 'Live', liveResume: 'Resume',
      liveTip: (s, m) => `Live: updates the map every ${s} s while it is on screen, for up to ${m} minutes. Each update is one request on your FlyItalyADSB key.`,
      liveFirst: (s, m) => `Live: an update every ${s} s for up to ${m} minutes. Each one counts as a request on your key.`,
      liveUpdated: (s) => (s < 2 ? 'updated just now' : s < 90 ? `updated ${s} s ago` : `updated ${Math.round(s / 60)} min ago`),
      liveUpdating: 'updating…',
      livePaused: (m) => `Live paused after ${m} min`,
      liveStopped: (why) => `Live stopped: ${why}`,
      liveRate: 'too many requests, try again in a minute',
      liveTimeout: 'no answer in time',
      liveOff: 'the host stopped answering',
      liveError: 'the search returned an error',
      liveGone: (label) => `${label} is no longer in the result`,
      estimated: 'Position', estimatedValue: 'estimated',
      zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Show all aircraft',
      key: 'What the symbols mean',
      keyAdsb: 'Filled: position sent by the aircraft (ADS-B)',
      keyMlat: 'Outline: position computed by the network (MLAT)',
      keyStale: 'Faded: position more than a minute old',
      keyGround: 'Grey: on the ground or altitude unknown',
      keyMil: 'Diamond: military; ring: PIA or LADD',
      keyEmg: 'Red ring: emergency squawk',
      hintWheel: 'Hold Ctrl and scroll to zoom the map',
      hintWheelMac: 'Hold ⌘ and scroll to zoom the map',
      hintTouch: 'Pinch, or drag sideways, to move the map',
      emptyTitle: (r) => `No aircraft within ${r} km right now`,
      emptyBody: 'Ask for a wider radius in the chat, or try again in a few minutes.',
      emptySpecialTitle: 'None in the air right now',
      emptySpecialBody: 'The network sees none of these aircraft at the moment.',
      notFoundTitle: (v) => `${v} isn’t on the network right now`,
      notFoundBody: 'It may be on the ground with its transponder off, or outside coverage.',
      errorTitle: 'The search didn’t return aircraft',
      errorBody: 'The assistant explains why in the chat.',
      cancelledTitle: 'Search cancelled',
      cancelledBody: 'Nothing to show.',
      unreadableTitle: 'This result can’t be drawn on the map',
      unreadableBody: 'The aircraft are in the chat as text.',
      standaloneTitle: 'Open this map from an assistant',
      standaloneBody: 'It draws the aircraft that FlyItalyADSB’s tools return in a chat.',
      noneListed: 'No aircraft to list.',
      dataBy: '© FlyItalyADSB, CC BY-SA 4.0',
    },
    it: {
      count: (n) => (n === 1 ? '1 aereo' : `${n} aerei`),
      // "da" + "la tua posizione" is "dalla tua posizione", not "da la".
      within: (r, place) => `entro ${r} km ${String(place ?? '').startsWith('la ') ? `dal${place}` : `da ${place}`}`,
      ago: (time, m) => `${time}, ${m} min fa`,
      shown: (n, total) => `${n} su ${total}`,
      savedPlace: (name) => (name ? `la tua posizione salvata (${name})` : 'la tua posizione salvata'),
      approxPlace: (name) => (name ? `la tua posizione approssimativa (${name})` : 'la tua posizione approssimativa'),
      special: {
        military: (n) => (n === 1 ? '1 aereo militare' : `${n} aerei militari`),
        privacy: (n) => `${n === 1 ? '1 aereo' : `${n} aerei`} con indirizzo privacy (PIA)`,
        ladd: (n) => `${n === 1 ? '1 aereo' : `${n} aerei`} nel programma FAA LADD`,
      },
      network: 'su tutta la rete FlyItalyADSB',
      found: 'trovato sulla rete FlyItalyADSB',
      loading: 'Cerco gli aerei…',
      loadingWhere: 'Chiedo alla rete FlyItalyADSB',
      sortNearest: 'Più vicini', sortLowest: 'Più bassi', sortHighest: 'Più alti',
      sortLabel: 'Ordina gli aerei',
      listLabel: 'Aerei in questo risultato',
      mapLabel: (what) => `Mappa: ${what}`,
      ground: 'A terra',
      ft: 'ft', kt: 'kt', km: 'km', fpm: 'ft/min',
      altitude: 'Quota', speed: 'Velocità', track: 'Rotta', squawk: 'Squawk',
      source: 'Fonte', seen: 'Ultimo segnale', distance: 'Distanza', noPosition: 'Senza posizione',
      secondsAgo: (s) => `${s} s fa`, minutesAgo: (m) => `${m} min fa`, hoursAgo: (h) => `${h} h fa`,
      climbing: 'in salita', descending: 'in discesa',
      emergency: { hijack: 'Dirottamento', radio: 'Avaria radio', emergency: 'Emergenza' },
      military: 'Militare', pia: 'PIA', ladd: 'LADD',
      piaTitle: 'Privacy ICAO Address: l’aereo cambia il suo codice hex',
      laddTitle: 'FAA LADD: il proprietario ha chiesto di limitarne la visualizzazione',
      sources: { adsb: 'ADS-B', mlat: 'MLAT', tisb: 'TIS-B', adsr: 'ADS-R', modes: 'Mode S', adsc: 'ADS-C', other: 'Altro' },
      ask: 'Chiedi di più',
      askText: (label, hex) => `Dimmi di più sull’aereo ${label} (hex ${hex}) della mappa FlyItalyADSB.`,
      openLive: 'Apri la mappa live',
      close: 'Chiudi i dettagli',
      fullscreen: 'Schermo intero', exitFullscreen: 'Esci da schermo intero',
      refresh: 'Aggiorna', refreshed: (time) => `Aggiornato alle ${time}`,
      refreshFailed: (msg) => `Aggiornamento non riuscito: ${msg}`,
      live: 'Live', liveResume: 'Riprendi',
      liveTip: (s, m) => `Live: aggiorna la mappa ogni ${s} s mentre è sullo schermo, per al massimo ${m} minuti. Ogni aggiornamento è una richiesta sulla tua chiave FlyItalyADSB.`,
      liveFirst: (s, m) => `Live: un aggiornamento ogni ${s} s per al massimo ${m} minuti. Ognuno conta come una richiesta sulla tua chiave.`,
      liveUpdated: (s) => (s < 2 ? 'aggiornato ora' : s < 90 ? `aggiornato ${s} s fa` : `aggiornato ${Math.round(s / 60)} min fa`),
      liveUpdating: 'aggiorno…',
      livePaused: (m) => `Live in pausa dopo ${m} min`,
      liveStopped: (why) => `Live fermato: ${why}`,
      liveRate: 'troppe richieste, riprova tra un minuto',
      liveTimeout: 'nessuna risposta in tempo',
      liveOff: 'l’host non risponde più',
      liveError: 'la ricerca ha dato un errore',
      liveGone: (label) => `${label} non è più nel risultato`,
      estimated: 'Posizione', estimatedValue: 'stimata',
      zoomIn: 'Ingrandisci', zoomOut: 'Riduci', fit: 'Mostra tutti gli aerei',
      key: 'Cosa vogliono dire i simboli',
      keyAdsb: 'Pieno: posizione inviata dall’aereo (ADS-B)',
      keyMlat: 'Contorno: posizione calcolata dalla rete (MLAT)',
      keyStale: 'Sbiadito: posizione di oltre un minuto fa',
      keyGround: 'Grigio: a terra o quota sconosciuta',
      keyMil: 'Rombo: militare; anello: PIA o LADD',
      keyEmg: 'Anello rosso: squawk di emergenza',
      hintWheel: 'Tieni premuto Ctrl e scorri per lo zoom',
      hintWheelMac: 'Tieni premuto ⌘ e scorri per lo zoom',
      hintTouch: 'Pizzica, o trascina di lato, per muovere la mappa',
      emptyTitle: (r) => `Nessun aereo entro ${r} km in questo momento`,
      emptyBody: 'Chiedi in chat un raggio più ampio, o riprova tra qualche minuto.',
      emptySpecialTitle: 'Nessuno in volo adesso',
      emptySpecialBody: 'In questo momento la rete non ne vede nessuno.',
      notFoundTitle: (v) => `${v} non è sulla rete in questo momento`,
      notFoundBody: 'Potrebbe essere a terra con il transponder spento, o fuori copertura.',
      errorTitle: 'La ricerca non ha restituito aerei',
      errorBody: 'L’assistente spiega il motivo in chat.',
      cancelledTitle: 'Ricerca annullata',
      cancelledBody: 'Niente da mostrare.',
      unreadableTitle: 'Questo risultato non si può disegnare sulla mappa',
      unreadableBody: 'Gli aerei sono nella chat come testo.',
      standaloneTitle: 'Apri questa mappa da un assistente',
      standaloneBody: 'Disegna gli aerei che gli strumenti di FlyItalyADSB restituiscono in chat.',
      noneListed: 'Nessun aereo da elencare.',
      dataBy: '© FlyItalyADSB, CC BY-SA 4.0',
    },
  };

  // ------------------------------------------------------------------ state
  const S = {
    ctx: {}, caps: {}, connected: false,
    lang: 'en', locale: 'en-GB', timeZone: undefined, theme: 'dark',
    mode: 'inline', fixed: false, layout: 'strip',
    toolName: null, args: null, hostInfo: null,
    recalled: false, diag: '', desiredH: 0, desiredMapH: 0, userMoved: false,
    // Estimated motion and Live (see "motion" and "live" below).
    recvAt: 0, fresh: true, inView: true, zooming: false,
    live: { state: 'off', since: 0, last: 0, timer: 0, waiting: false, reason: '', told: false },
    order: [], stableList: false, listTouchedAt: 0,
    status: 'loading', data: null, sort: null,
    sel: null, hot: null, items: new Map(),
    touchHinted: false,
  };
  const t = (key, ...a) => {
    const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), STR[S.lang]) ??
      key.split('.').reduce((o, k) => (o == null ? o : o[k]), STR.en);
    return typeof v === 'function' ? v(...a) : v;
  };
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const fmt = (n, digits = 0) => new Intl.NumberFormat(S.locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const clock = (epochS, seconds = false) => {
    try {
      // 24-hour, as in aviation and on mappa.flyitalyadsb.com, whatever the locale.
      return new Intl.DateTimeFormat(S.locale, { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hourCycle: 'h23', timeZone: S.timeZone }).format(new Date(epochS * 1000));
    } catch {
      return new Intl.DateTimeFormat(S.locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(epochS * 1000));
    }
  };

  // ----------------------------------------------------------------- bridge
  let seq = 0;
  const pending = new Map();
  const post = (msg) => window.parent.postMessage(msg, '*');
  function request(method, params, timeoutMs = 30000) {
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, timeoutMs);
      pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      post({ jsonrpc: '2.0', id, method, params });
    });
  }
  const notify = (method, params) => post(params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params });

  window.addEventListener('message', (event) => {
    // Only the host (or its sandbox proxy, which forwards) talks to the view.
    if (event.source !== window.parent) return;
    const m = event.data;
    if (!m || typeof m !== 'object' || m.jsonrpc !== '2.0') return;
    if (typeof m.method !== 'string') {
      const p = m.id != null && pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.error) p.reject(new Error((m.error && m.error.message) || 'error'));
      else p.resolve(m.result);
      return;
    }
    if (m.id != null) {
      onRequest(m.method, m.params || {}).then(
        (result) => post({ jsonrpc: '2.0', id: m.id, result: result || {} }),
        (err) => post({ jsonrpc: '2.0', id: m.id, error: { code: -32601, message: String((err && err.message) || err) } }),
      );
      return;
    }
    onNotification(m.method, m.params || {});
  });

  async function onRequest(method) {
    if (method === 'ping') return {};
    if (method === 'ui/resource-teardown') { teardown(); return {}; }
    throw new Error(`Method not found: ${method}`);
  }

  function onNotification(method, params) {
    switch (method) {
      case 'ui/notifications/tool-input':
        S.args = params.arguments || {};
        if (S.status === 'loading') previewArgs(S.args);
        break;
      case 'ui/notifications/tool-result':
        onToolResult(params);
        break;
      case 'ui/notifications/tool-cancelled':
        if (S.status === 'loading') setStatus('cancelled');
        break;
      case 'ui/notifications/host-context-changed':
        applyContext(params);
        break;
      default:
        break;
    }
  }

  function log(level, data) {
    if (S.connected && S.caps.logging) notify('notifications/message', { level, logger: 'aircraft-map', data });
  }
  document.addEventListener('securitypolicyviolation', (e) => log('warning', `CSP blocked ${e.blockedURI} (${e.violatedDirective})`));
  window.addEventListener('error', (e) => log('error', String(e.message)));

  async function connect() {
    try {
      const res = await request('ui/initialize', {
        appInfo: APP_INFO,
        appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
        protocolVersion: PROTOCOL_VERSION,
      }, 20000);
      S.caps = (res && res.hostCapabilities) || {};
      S.hostInfo = (res && res.hostInfo) || null;
      applyContext((res && res.hostContext) || {});
      notify('ui/notifications/initialized');
      S.connected = true;
      startSizeReporting();
      renderControls();
    } catch {
      setStatus('standalone');
    }
  }

  // Inline: the height the view asks for (fitInline), not the one it was given,
  // so a host that caps or fixes the iframe can still grow it later. Fullscreen
  // and fixed: the SDK App's measurement, the document's max-content height.
  // The viewport's width; only when either changes.
  function startSizeReporting() {
    let queued = false, lastW = 0, lastH = 0;
    const send = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        let h;
        if (!S.fixed) {
          fitInline();
          h = S.desiredH;
        } else {
          const el = document.documentElement;
          const prev = el.style.height;
          el.style.height = 'max-content';
          h = Math.ceil(el.getBoundingClientRect().height);
          el.style.height = prev;
        }
        const w = Math.ceil(window.innerWidth);
        if (w !== lastW || h !== lastH) {
          lastW = w; lastH = h;
          notify('ui/notifications/size-changed', { width: w, height: h });
        }
      });
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    ro.observe(document.body);
  }

  function teardown() {
    clearInterval(ticker);
    clearTimeout(S.live.timer);
    S.live.state = 'off';
  }

  // ----------------------------------------------------------- host context
  function applyContext(patch) {
    const ctx = (S.ctx = { ...S.ctx, ...patch });
    const prevLang = S.lang, prevTheme = S.theme;
    S.theme = ctx.theme === 'light' ? 'light' : 'dark';
    S.locale = str(ctx.locale) || navigator.language || 'en-GB';
    S.lang = /^it\b/i.test(S.locale) ? 'it' : 'en';
    if (S.lang === 'en' && !/^en\b/i.test(S.locale)) S.locale = 'en-GB';
    S.timeZone = str(ctx.timeZone);
    S.mode = ctx.displayMode === 'fullscreen' ? 'fullscreen' : 'inline';
    if (ctx.toolInfo && ctx.toolInfo.tool && ctx.toolInfo.tool.name) S.toolName = ctx.toolInfo.tool.name;
    document.documentElement.dataset.theme = S.theme;
    document.documentElement.lang = S.lang;
    const vars = (ctx.styles && ctx.styles.variables) || {};
    // The host's fonts, not its palette: the map keeps FlyItalyADSB's colours.
    for (const k of ['--font-sans', '--font-mono']) if (str(vars[k])) document.documentElement.style.setProperty(k, vars[k]);
    const fontsCss = ctx.styles && ctx.styles.css && ctx.styles.css.fonts;
    if (str(fontsCss) && !$('host-fonts')) {
      const st = document.createElement('style');
      st.id = 'host-fonts';
      st.textContent = fontsCss;
      document.head.appendChild(st);
    }
    const sa = ctx.safeAreaInsets || {};
    for (const side of ['top', 'right', 'bottom', 'left']) document.documentElement.style.setProperty(`--sa-${side[0]}`, `${num(sa[side]) || 0}px`);
    relayout();
    if (prevLang !== S.lang) renderStatic();
    if (prevTheme !== S.theme || prevLang !== S.lang) rerender();
    renderControls();
  }

  // ------------------------------------------------------------------ layout
  const app = $('app'), stage = $('stage'), tray = $('tray');
  function relayout() {
    const cd = S.ctx.containerDimensions || {};
    const fixed = S.mode === 'fullscreen' || typeof cd.height === 'number';
    const w = window.innerWidth, h = window.innerHeight;
    const data = S.status === 'ready' || S.status === 'empty' || S.status === 'loading';
    const layout = fixed && data && w >= 760 && h >= 440 ? 'panel' : 'strip';
    const changed = layout !== S.layout || fixed !== S.fixed;
    S.fixed = fixed; S.layout = layout;
    app.dataset.layout = layout;
    app.dataset.mode = S.mode;
    app.dataset.fixed = String(fixed);
    const title = $('title');
    if (layout === 'panel' && title.parentElement !== $('tray-head')) $('tray-head').prepend(title);
    if (layout === 'strip' && title.parentElement !== app) app.insertBefore(title, stage);
    syncTray();
    if (!fixed) fitInline();
    else { stage.style.height = ''; S.desiredH = 0; }
    if (map) {
      attribution.setPrefix(w >= 560 ? '<a href="https://leafletjs.com">Leaflet</a>' : false);
      map.invalidateSize({ pan: false });
      if (changed && S.data) fitView(false);
    }
  }
  // Inline: the map has a height of its own, so the chat never scrolls inside
  // it, and size-changed asks the host for that (S.desiredH). The iframe the
  // host really gives can differ: capped, fixed, not resized yet. The view
  // fills that one exactly, so nothing is cut at the top or left empty below.
  function fitInline() {
    const cd = S.ctx.containerDimensions || {};
    const sa = S.ctx.safeAreaInsets || {};
    const chrome = $('title').offsetHeight + (tray.hidden ? 0 : tray.offsetHeight) + (num(sa.top) || 0) + (num(sa.bottom) || 0);
    const notice = S.status !== 'ready' && S.status !== 'empty' && S.status !== 'loading';
    let mapH = S.status === 'unreadable' ? 240 : notice ? 190 : window.innerWidth < 480 ? 290 : 340;
    const maxH = num(cd.maxHeight);
    if (maxH) mapH = Math.max(160, Math.min(mapH, maxH - chrome));
    S.desiredMapH = mapH;
    S.desiredH = Math.ceil(mapH + chrome);
    const vh = window.innerHeight;
    if (vh > 0 && Math.abs(vh - S.desiredH) > 1) mapH = Math.max(140, vh - chrome);
    const px = `${Math.round(mapH)}px`;
    if (stage.style.height !== px) {
      stage.style.height = px;
      map.invalidateSize({ pan: false });
      // The view was fitted for the other height: fit it again, unless the
      // user has moved the map since.
      if (S.data && !S.userMoved) fitView(false);
    }
  }

  // The document itself never scrolls (html and body clip): an iframe shorter
  // than the view, or a focus, would leave it scrolled and its top cut off,
  // as in a claude.ai screenshot of 22/10.
  window.addEventListener('scroll', () => {
    const el = document.scrollingElement || document.documentElement;
    if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; }
  }, { passive: true });

  // The list shows when there is something to list; a single found aircraft
  // is its card alone (docked under the map on a phone).
  function syncTray() {
    const single = S.data && S.data.kind === 'find' && S.layout === 'strip';
    if (S.sel) dockCard();
    const docked = $('card').classList.contains('docked') && !$('card').hidden;
    // The side panel holds the title, so it stays whenever there is data.
    tray.hidden = S.layout === 'panel' ? false : S.status !== 'loading' && (S.status !== 'ready' || (single && !docked));
    $('tray-head').hidden = !!single;
    $('list').hidden = !!single;
  }
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; relayout(); });
  });

  // -------------------------------------------------------------------- map
  const L = window.L;
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
    zoomSnap: 0.25,
    zoomDelta: 0.75,
    wheelPxPerZoomLevel: 110,
    minZoom: 2,
    maxZoom: CFG.tiles.maxZoom,
    worldCopyJump: true,
    boxZoom: false,
    zoomAnimation: !REDUCED_MOTION,
    fadeAnimation: !REDUCED_MOTION,
    markerZoomAnimation: !REDUCED_MOTION,
    inertia: !REDUCED_MOTION,
    tapTolerance: 14,
  }).setView([42.3, 12.6], 5);
  L.tileLayer(CFG.tiles.url, { maxZoom: CFG.tiles.maxZoom, className: 'fia-tiles', attribution: CFG.tiles.attribution }).addTo(map);
  const attribution = L.control.attribution({ position: 'bottomright', prefix: '<a href="https://leafletjs.com">Leaflet</a>' }).addTo(map);
  const DATA_ATTR = () => `<a href="https://flyitalyadsb.com/">${esc(t('dataBy'))}</a>`;
  let dataAttr = DATA_ATTR();
  attribution.addAttribution(dataAttr);

  const ringLayer = L.layerGroup().addTo(map);
  const acLayer = L.layerGroup().addTo(map);

  // Inline in a chat: a plain wheel scrolls the conversation; Ctrl/⌘ + wheel
  // (and trackpad pinch, which browsers report as Ctrl + wheel) zooms the map.
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  stage.addEventListener('wheel', (e) => {
    if (S.mode === 'fullscreen' || e.ctrlKey || e.metaKey) return;
    if (!$('map').contains(e.target)) return;
    e.stopPropagation();
    if (Math.abs(e.deltaY) > 4) showHint(isMac ? t('hintWheelMac') : t('hintWheel'));
  }, { capture: true, passive: true });
  let touch0 = null;
  stage.addEventListener('touchstart', (e) => { touch0 = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (!touch0 || S.mode === 'fullscreen' || S.touchHinted || e.touches.length !== 1) return;
    const dx = Math.abs(e.touches[0].clientX - touch0.x), dy = Math.abs(e.touches[0].clientY - touch0.y);
    if (dy > 18 && dy > dx * 1.5) { S.touchHinted = true; showHint(t('hintTouch')); }
  }, { passive: true });

  let hintTimer = 0;
  function showHint(text) {
    const el = $('hint');
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => el.classList.remove('on'), 1600);
  }
  let toastTimer = 0;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

  map.on('click', () => select(null));
  for (const ev of ['pointerdown', 'wheel', 'keydown']) $('map').addEventListener(ev, () => { S.userMoved = true; }, { passive: true });
  map.on('zoomend', scaleMarkers);

  // Links in the map (attribution) open through the host when it can.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="http"]');
    if (!a) return;
    if (S.caps.openLinks) {
      e.preventDefault();
      request('ui/open-link', { url: a.href }).catch(() => {});
    } else {
      a.target = '_blank';
      a.rel = 'noopener';
    }
  });

  // --------------------------------------------------------------- aircraft
  // tar1090's altitude scale, the one mappa.flyitalyadsb.com uses: orange on
  // the ground, through yellow and green, to blue and violet at 40,000 ft.
  const HUE = [[0, 20], [2000, 32.5], [4000, 43], [6000, 54], [8000, 72], [9000, 85], [11000, 140], [40000, 300]];
  function hueAt(alt) {
    if (alt <= 0) return HUE[0][1];
    for (let i = 1; i < HUE.length; i++) {
      const [a1, h1] = HUE[i];
      if (alt <= a1) {
        const [a0, h0] = HUE[i - 1];
        return h0 + ((h1 - h0) * (alt - a0)) / (a1 - a0);
      }
    }
    return 300;
  }
  const hueColor = (h) => {
    if (S.theme === 'light') return `hsl(${h.toFixed(1)} 82% ${h > 40 && h < 190 ? 34 : 43}%)`;
    return `hsl(${h.toFixed(1)} 90% ${h > 200 ? 68 : 60}%)`;
  };
  const colorOf = (ac) => (ac.ground ? 'var(--ground)' : ac.alt == null ? 'var(--unknown)' : hueColor(hueAt(ac.alt)));

  // Shapes: ADS-B emitter category first, then the ICAO type designator.
  const HELI = new Set('A109 A119 A139 A169 A189 ALO2 ALO3 AS32 AS3B AS50 AS55 AS65 B06 B105 B212 B222 B230 B407 B412 B427 B429 B430 B47G BK17 EC20 EC25 EC30 EC35 EC45 EC55 EC75 EH10 EXPL G2CA GAZL H125 H130 H135 H145 H155 H160 H175 H47 H500 H53 H60 H64 H72 K226 LYNX MI8 MI24 NH90 R22 R44 R66 S61 S64 S76 S92 SUCO UH1 V22'.split(' '));
  const FIGHTER = new Set('A10 AJET AMX AV8B EUFI F104 F111 F14 F15 F16 F18 F18H F18S F22 F35 F4 F5 GR4 HAR HAWK J8 JAS39 K8 L159 L39 M339 M346 MG29 MG31 MIR2 MIR4 RFAL SB39 SU24 SU25 SU27 SU30 SU34 SU35 SU57 T38 T50 TOR TYPH'.split(' '));
  const PROP = new Set('A400 AN12 AN22 AN24 AN26 AN30 AN32 AT43 AT44 AT45 AT46 AT72 AT73 AT75 AT76 ATP B190 B350 BE20 BE30 BE9L BE9T C130 C160 C208 C212 C27J C295 C30J CN35 D228 D328 DH8A DH8B DH8C DH8D DHC6 DHC7 E110 E120 E314 F27 F406 F50 JS31 JS32 JS41 L410 M28 MU2 P180 P3 P68T PAY2 PAY3 PC12 PC21 PC24 PC6T PC7 PC9 SB20 SF34 SW4 T6 TBM7 TBM8 TBM9 Y12'.split(' '));
  const REAR = new Set('B712 C25A C25B C25C C25M C500 C501 C510 C525 C550 C560 C56X C650 C680 C68A C700 C750 CL30 CL35 CL60 CRJ1 CRJ2 CRJ7 CRJ9 CRJX DC91 DC93 DC95 E135 E145 E35L E45X E50P E55P EA50 F100 F28 F2TH F70 F900 FA10 FA20 FA50 FA6X FA7X FA8X G150 G280 GA5C GA6C GALX GL5T GL7T GL8T GLEX GLF2 GLF3 GLF4 GLF5 GLF6 H25B H25C HA4T HDJT IL62 LJ31 LJ35 LJ40 LJ45 LJ55 LJ60 LJ70 LJ75 MD81 MD82 MD83 MD87 MD88 MD90 PRM1 SBR1 T154 YK40'.split(' '));
  const HEAVY = new Set('A306 A30B A310 A332 A333 A337 A338 A339 A342 A343 A345 A346 A359 A35K A388 A3ST AN124 AN225 B741 B742 B743 B744 B748 B74S B752 B753 B762 B763 B764 B772 B773 B778 B779 B77L B77W B788 B789 B78X BLCF C17 C5 C5M DC10 E3CF E3TF E6 E767 IL76 IL86 IL96 K35E K35R KC2 KC10 L101 MD11 MRTT A400 A124'.split(' '));
  const SIZE = { jet: 26, heavy: 30, biz: 23, prop: 25, light: 19, heli: 24, fighter: 23, glider: 25, balloon: 18, vehicle: 13, generic: 19 };
  function kindOf(ac) {
    const cat = ac.cat || '', type = ac.type || '';
    if (cat === 'C1' || cat === 'C2') return 'vehicle';
    if (cat === 'A7' || HELI.has(type)) return 'heli';
    if (cat === 'B1' || cat === 'B4' || cat === 'B6') return cat === 'B4' ? 'light' : 'glider';
    if (cat === 'B2') return 'balloon';
    if (FIGHTER.has(type) || cat === 'A6') return 'fighter';
    if (PROP.has(type)) return 'prop';
    if (REAR.has(type)) return 'biz';
    if (cat === 'A5' || HEAVY.has(type)) return 'heavy';
    if (cat === 'A3' || cat === 'A4') return 'jet';
    if (cat === 'A2') return 'biz';
    if (cat === 'A1') return 'light';
    if (type) return 'jet';
    return 'generic';
  }
  const acSvg = (ac, cls = '') =>
    `<svg class="ac${ac.src === 'mlat' ? ' mlat' : ''}${cls}" viewBox="0 0 64 64" style="color:${colorOf(ac)};--rot:${ac.track == null ? 0 : ac.track}deg" aria-hidden="true" focusable="false">` +
    `<use class="h" href="#s-${ac.kind}"/><use class="o" href="#s-${ac.kind}"/><use class="f" href="#s-${ac.kind}"/></svg>`;
  // A military-only result needs no military badge on every aircraft.
  const CATEGORY_FLAG = { military: 1, privacy: 4, ladd: 8 };
  const badgeHtml = (ac) => {
    const flags = ac.flags & ~((S.data && S.data.kind === 'special' && CATEGORY_FLAG[S.data.category]) || 0);
    return flags & 1 ? '<span class="badge mil"></span>' : flags & 12 ? '<span class="badge pia"></span>' : '';
  };

  function sourceOf(a) {
    const ty = str(a.type) || '';
    if (ty === 'mlat' || (Array.isArray(a.mlat) && a.mlat.includes('lat'))) return 'mlat';
    if (ty.startsWith('tisb') || (Array.isArray(a.tisb) && a.tisb.includes('lat'))) return 'tisb';
    if (ty.startsWith('adsr')) return 'adsr';
    if (ty.startsWith('adsb')) return 'adsb';
    if (ty === 'mode_s') return 'modes';
    if (ty === 'adsc') return 'adsc';
    return ty ? 'other' : 'adsb';
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const r = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(a));
  }

  function normAircraft(a, center) {
    const ground = a.alt_baro === 'ground';
    const alt = ground ? 0 : num(a.alt_baro) ?? num(a.alt_geom);
    const ac = {
      hex: String(a.hex || '').toLowerCase().replace(/^~/, ''),
      cs: str(a.flight), reg: str(a.r), type: str(a.t), desc: str(a.desc),
      lat: num(a.lat), lon: num(a.lon),
      alt, ground: ground || /^C/.test(str(a.category) || ''),
      gs: num(a.gs), track: num(a.track) ?? num(a.true_heading) ?? num(a.mag_heading),
      vr: num(a.baro_rate) ?? num(a.geom_rate),
      squawk: str(a.squawk), cat: str(a.category), flags: Number(a.dbFlags) | 0,
      src: sourceOf(a), seen: num(a.seen_pos) ?? num(a.seen) ?? 0,
    };
    ac.label = ac.cs || ac.reg || ac.hex.toUpperCase();
    ac.kind = kindOf(ac);
    ac.emg = EMERGENCY[ac.squawk] || (str(a.emergency) && a.emergency !== 'none' ? 'emergency' : undefined);
    ac.has = ac.lat !== undefined && ac.lon !== undefined;
    if (center && ac.has) ac.dist = haversineKm(center.lat, center.lon, ac.lat, ac.lon);
    return ac;
  }

  // ------------------------------------------------------------------ data
  // The analytics SDK on the Worker appends {"conversation_id":…} to every
  // result for the model to send back (mcp-worker/src/index.ts): not text for people.
  const textOf = (res) => ((res && res.content) || [])
    .filter((c) => c && c.type === 'text' && !/^\s*\{\s*"conversation_id"\s*:\s*"[^"]*"\s*\}\s*$/.test(c.text || ''))
    .map((c) => c.text).join('\n');
  // Where the payload may be. Hosts differ: claude.ai's view got a
  // structuredContent of the host's while ours was only in the text, Claude
  // Desktop strips structuredContent, the desktop Code tab replaces the text
  // with the JSON of structuredContent, replays lose either
  // (ext-apps#696, claude-ai-mcp#1158, claude-code#103809). So no field is
  // trusted for where it is: a candidate counts only if it has the shape.
  const isPayload = (d) => !!d && typeof d === 'object' && !Array.isArray(d) && (Array.isArray(d.aircraft) || d.found === true || d.found === false);
  function jsonIn(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const tries = [text.trim()];
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a >= 0 && b > a) tries.push(text.slice(a, b + 1)); // text around the JSON
    for (const chunk of tries) {
      try {
        let v = JSON.parse(chunk);
        if (typeof v === 'string') v = JSON.parse(v); // encoded twice
        if (v && typeof v === 'object') return v;
      } catch { /* the next try */ }
    }
    return null;
  }
  // { result: CallToolResult } and similar wrappers.
  function unwrap(res) {
    for (let i = 0; i < 2 && res && typeof res === 'object' && !Array.isArray(res.content) && !('structuredContent' in res) && !isPayload(res); i++) {
      const inner = res.result || res.toolResult || res.callToolResult;
      if (!inner || typeof inner !== 'object') break;
      res = inner;
    }
    return res;
  }
  function payloadOf(res) {
    const found = [];
    const add = (v) => {
      if (!v || typeof v !== 'object') return;
      if (isPayload(v)) found.push(v);
      else for (const k of ['structuredContent', 'result', 'data']) if (isPayload(v[k])) found.push(v[k]);
    };
    if (isPayload(res)) found.push(res);
    add(res.structuredContent);
    for (const c of Array.isArray(res.content) ? res.content : []) {
      if (!c || typeof c !== 'object') continue;
      add(jsonIn(c.text));
      if (c.resource && typeof c.resource === 'object') add(jsonIn(c.resource.text));
    }
    // The fullest wins: an empty list loses to the list another field has.
    const weight = (d) => (Array.isArray(d.aircraft) ? d.aircraft.length : d.found === true ? 1 : 0);
    return found.sort((x, y) => weight(y) - weight(x))[0] || null;
  }

  function parse(raw) {
    const res = unwrap(raw);
    if (!res || typeof res !== 'object') return { kind: 'unreadable' };
    if (res.isError) return { kind: 'error', message: textOf(res) };
    const d = payloadOf(res);
    if (!d) return { kind: 'unreadable' };
    const now = num(d.now) || Date.now() / 1000;
    if (d.found === false) return { kind: 'notfound', value: str(d.value) || '', now };
    if (d.found === true) {
      if (!d.aircraft || typeof d.aircraft !== 'object') return { kind: 'unreadable' };
      const ac = normAircraft(d.aircraft);
      return { kind: 'find', now, aircraft: [ac], count: 1, total: 1 };
    }
    const c = d.center && num(d.center.lat) !== undefined && num(d.center.lon) !== undefined ? d.center : null;
    const center = c ? { lat: c.lat, lon: c.lon, label: str(c.label) || '', source: str(c.source) || 'coordinates' } : null;
    const aircraft = d.aircraft.filter((a) => a && typeof a === 'object' && a.hex).map((a) => normAircraft(a, center));
    return {
      kind: center ? 'near' : d.category ? 'special' : 'list',
      now, center, radiusKm: num(d.radiusKm), category: str(d.category),
      aircraft, count: aircraft.length, total: Math.max(num(d.totalMatched) ?? aircraft.length, aircraft.length),
    };
  }

  // What arrived, without the data: field names, types, text lengths, the
  // first 40 characters of the text with digits masked. Shown under the
  // "can't be drawn" notice and logged, so a screenshot says what the host sent.
  function shapeOf(raw) {
    try {
      if (raw === null || typeof raw !== 'object') return String(raw === null ? 'null' : typeof raw);
      const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? `array[${v.length}]` : typeof v === 'object' ? `{${Object.keys(v).slice(0, 6).join(',')}}` : typeof v);
      const parts = [`keys={${Object.keys(raw).join(',')}}`];
      if ('structuredContent' in raw) parts.push(`sc=${kind(raw.structuredContent)}`);
      if (Array.isArray(raw.content)) {
        parts.push(`content=[${raw.content.map((c) => (c && typeof c === 'object' ? `${c.type || '?'}${typeof c.text === 'string' ? `:${c.text.length}` : ''}` : kind(c))).join(',')}]`);
        const first = raw.content.find((c) => c && typeof c.text === 'string');
        if (first) parts.push(`text="${first.text.slice(0, 40).replace(/\d/g, '#').replace(/\s+/g, ' ')}"`);
      } else if ('content' in raw) parts.push(`content=${kind(raw.content)}`);
      if ('isError' in raw) parts.push(`isError=${raw.isError}`);
      if (raw._meta && typeof raw._meta === 'object') parts.push(`_meta={${Object.keys(raw._meta).slice(0, 5).join(',')}}`);
      return parts.join(' ');
    } catch {
      return 'shape?';
    }
  }

  // The tool's labels are written for the model; the map writes its own.
  function placeName(center) {
    if (!center) return '';
    const inner = (/\(([^()]*)\)\s*$/.exec(center.label) || [])[1];
    if (center.source === 'saved') return t('savedPlace', inner);
    if (center.source === 'chatgpt') return t('approxPlace', inner);
    if (center.source === 'airport') return center.label;
    const ew = S.lang === 'it' ? ['E', 'O'] : ['E', 'W'];
    return `${fmt(Math.abs(center.lat), 3)}° ${center.lat >= 0 ? 'N' : 'S'} ${fmt(Math.abs(center.lon), 3)}° ${center.lon >= 0 ? ew[0] : ew[1]}`;
  }

  // ---------------------------------------------------------------- render
  function setStatus(status, extra) {
    S.status = status;
    const n = $('notice');
    const show = (title, body, error) => {
      $('notice-title').textContent = title;
      $('notice-body').textContent = body || '';
      $('notice-body').hidden = !body;
      n.classList.toggle('error', !!error);
      n.hidden = false;
    };
    n.hidden = true;
    if (status === 'error') show(t('errorTitle'), userMessage(extra), true);
    else if (status === 'unreadable') show(t('unreadableTitle'), t('unreadableBody'));
    const diag = $('notice-diag');
    diag.hidden = status !== 'unreadable' || !S.diag;
    n.classList.toggle('has-diag', !diag.hidden);
    if (!diag.hidden) diag.textContent = `${S.diag}\n${contextLine()}`;
    else if (status === 'cancelled') show(t('cancelledTitle'), t('cancelledBody'));
    else if (status === 'standalone') show(t('standaloneTitle'), t('standaloneBody'));
    else if (status === 'notfound') show(t('notFoundTitle', extra), t('notFoundBody'));
    else if (status === 'empty') {
      const d = S.data;
      if (d && d.kind === 'near') show(t('emptyTitle', fmt(d.radiusKm || 0)), t('emptyBody'));
      else show(t('emptySpecialTitle'), t('emptySpecialBody'));
    }
    const data = status === 'ready' || status === 'empty' || status === 'loading';
    $('legend').hidden = status !== 'ready';
    // Notices keep the header, with the brand only.
    $('title').classList.toggle('brand-only', !data);
    $('ctrls').hidden = !data || status === 'loading';
    relayout();
    renderTitle();
    renderList();
    renderLive();
  }

  // Tool errors are written for the model ("call aircraft_near again with
  // lat/lon"): the user gets the first sentence, unless it names tools.
  function userMessage(text) {
    const first = (String(text || '').match(/^[^.!?]*[.!?]/) || [''])[0].trim();
    return first && !/\b[a-z]+_[a-z_]+\b|lat\/lon/.test(first) ? first : t('errorBody');
  }

  function show(res, opts = {}) {
    const d = parse(res);
    if (d.kind === 'error') { S.data = null; clearMap(); setStatus('error', d.message); return; }
    if (d.kind === 'unreadable') { S.data = null; clearMap(); setStatus('unreadable'); return; }
    if (d.kind === 'notfound') { S.data = null; clearMap(); setStatus('notfound', d.value || (S.args && S.args.value) || ''); return; }
    if (opts.keepPlace && S.data && S.data.center && d.center) d.center = { ...d.center, label: S.data.center.label, source: S.data.center.source };
    // An update of what is on the map (Refresh, Live): markers move, appear and
    // fade out instead of the map being drawn again.
    const merge = !!opts.merge && !!S.data && S.status === 'ready' && d.kind === S.data.kind;
    const gone = merge && S.sel && !d.aircraft.some((a) => a.hex === S.sel) && S.items.get(S.sel);
    S.data = d;
    S.recvAt = Date.now() / 1000;
    S.fresh = Math.abs(S.recvAt - d.now) < 300;
    for (const ac of d.aircraft) ac.ageAtRecv = posAge(ac);
    S.live.last = Date.now();
    if (!S.sort || (S.sort === 'nearest' && !d.center)) S.sort = d.center ? 'nearest' : 'lowest';
    if (gone) toast(t('liveGone', gone.ac.label));
    if (S.sel && !d.aircraft.some((a) => a.hex === S.sel)) select(null, { from: merge ? 'merge' : 'auto' });
    if (merge) {
      mergeMap(d);
      // The search area doesn't move; a network-wide result is fitted again
      // unless the user has moved the map.
      if (!S.userMoved && d.kind !== 'near') fitView(false);
      S.stableList = true;
      setStatus(d.aircraft.length ? 'ready' : 'empty');
      S.stableList = false;
      renderSort();
      if (S.sel) select(S.sel, { from: 'merge', keepView: true });
      return;
    }
    drawMap();
    if (!opts.keepView) fitView(false);
    setStatus(d.aircraft.length ? 'ready' : 'empty');
    renderSort();
    if (d.kind === 'find' && d.aircraft[0] && d.aircraft[0].has) select(d.aircraft[0].hex, { from: 'auto' });
    else if (S.sel) select(S.sel, { from: 'auto', keepView: true });
    $('live').textContent = $('title-count').textContent;
  }

  // A pushed result the view can't read is asked for again, once, through the
  // host's tools/call, which returns the server's whole result (ext-apps#696).
  // Read-only and idempotent, but it is one more request on the user's key.
  function onToolResult(params) {
    if (parse(params).kind !== 'unreadable') { show(params); return; }
    const shape = shapeOf(params);
    if (S.status === 'ready' || S.status === 'empty') { log('warning', { event: 'unreadable-tool-result-ignored', shape }); return; }
    S.diag = `push: ${shape}`;
    const call = recallCall();
    if (!call || S.recalled) {
      S.diag += ` | no re-call: ${S.recalled ? 'done already' : !S.caps.serverTools ? 'host has no tools/call' : 'no tool input'}`;
      unreadable();
      return;
    }
    S.recalled = true;
    log('warning', { event: 'unreadable-tool-result', shape, recall: call.name });
    setStatus('loading');
    request('tools/call', { name: call.name, arguments: call.args }, 30000).then(
      (res) => {
        if (parse(res).kind !== 'unreadable') { show(res); return; }
        S.diag += ` | re-call: ${shapeOf(res)}`;
        unreadable();
      },
      (err) => {
        S.diag += ` | re-call failed: ${String((err && err.message) || err).slice(0, 80)}`;
        unreadable();
      },
    );
  }
  function unreadable() {
    S.data = null;
    clearMap();
    setStatus('unreadable');
    log('warning', { event: 'unreadable', shape: S.diag, context: contextLine() });
  }
  // The same call as the model's: its arguments from tool-input, its name from
  // hostContext.toolInfo or, failing that, from the arguments' shape.
  function recallCall() {
    if (!S.connected || !S.caps.serverTools || !S.args) return null;
    const a = S.args;
    const name = S.toolName || (a.by !== undefined && a.value !== undefined ? 'find_aircraft' : a.category !== undefined ? 'special_traffic' : 'aircraft_near');
    return { name, args: a };
  }
  function contextLine() {
    const sa = S.ctx.safeAreaInsets || {};
    const host = S.hostInfo ? `${S.hostInfo.name || '?'} ${S.hostInfo.version || ''}`.trim() : '?';
    return `host=${host} tool=${S.toolName || '?'} input=${S.args ? Object.keys(S.args).join('+') || 'empty' : 'none'} ` +
      `vp=${window.innerWidth}x${window.innerHeight} dm=${S.ctx.displayMode || '?'} cd=${JSON.stringify(S.ctx.containerDimensions || {})} ` +
      `sa=${['top', 'right', 'bottom', 'left'].map((k) => num(sa[k]) || 0).join(',')}`;
  }

  function previewArgs(args) {
    const lat = num(args.lat), lon = num(args.lon);
    if (lat !== undefined && lon !== undefined) {
      const r = num(args.radiusKm) || 80;
      drawRings({ lat, lon }, r);
      fitCircle({ lat, lon }, r, false);
    }
  }

  // Theme or language changed: markers carry both, so they are drawn again,
  // and the selection is put back on the new ones.
  function rerender() {
    if (S.data) drawMap();
    renderTitle();
    renderList();
    renderLegend();
    renderSort();
    if (S.sel) select(S.sel, { from: 'auto', keepView: true });
  }

  function renderStatic() {
    $('map').setAttribute('aria-label', t('mapLabel', $('title-count').textContent || ''));
    $('btn-in').setAttribute('aria-label', t('zoomIn')); $('btn-in').title = t('zoomIn');
    $('btn-out').setAttribute('aria-label', t('zoomOut')); $('btn-out').title = t('zoomOut');
    $('btn-fit').setAttribute('aria-label', t('fit')); $('btn-fit').title = t('fit');
    $('btn-refresh').setAttribute('aria-label', t('refresh')); $('btn-refresh').title = t('refresh');
    $('key-toggle').setAttribute('aria-label', t('key')); $('key-toggle').title = t('key');
    $('sort').setAttribute('aria-label', t('sortLabel'));
    $('list').setAttribute('aria-label', t('listLabel'));
    attribution.removeAttribution(dataAttr);
    dataAttr = DATA_ATTR();
    attribution.addAttribution(dataAttr);
    renderKey();
  }

  function renderControls() {
    const modes = S.ctx.availableDisplayModes || [];
    const canFull = S.connected && modes.includes('fullscreen');
    const canRefresh = S.connected && !!S.caps.serverTools;
    const full = $('btn-full');
    full.hidden = !canFull;
    const label = S.mode === 'fullscreen' ? t('exitFullscreen') : t('fullscreen');
    full.setAttribute('aria-label', label); full.title = label;
    $('ico-full').setAttribute('d', S.mode === 'fullscreen' ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5');
    $('btn-refresh').hidden = !canRefresh;
    $('ctrl-top').hidden = !canFull && !canRefresh;
    renderLive();
  }

  function renderTitle() {
    const d = S.data;
    let count = '', where = '';
    if (S.status === 'loading') { count = t('loading'); where = t('loadingWhere'); }
    else if (d && (S.status === 'ready' || S.status === 'empty')) {
      if (d.kind === 'near') { count = t('count', d.count); where = t('within', fmt(d.radiusKm || 0), placeName(d.center)); }
      else if (d.kind === 'special') { count = STR.en.special[d.category] ? t(`special.${d.category}`, d.count) : t('count', d.count); where = t('network'); }
      else if (d.kind === 'find') { const ac = d.aircraft[0]; count = ac.label; where = ac.desc || ac.type || t('found'); }
      else { count = t('count', d.count); where = t('network'); }
    }
    $('title-count').textContent = count || ' ';
    $('title-where').textContent = where;
    $('title-where').hidden = !where;
    if (!d || S.status === 'loading') $('title-time').textContent = '';
    else renderLiveTime();
    $('map').setAttribute('aria-label', t('mapLabel', `${count} ${where}`.trim()));
    const meta = d && d.total > d.count ? t('shown', fmt(d.count), fmt(d.total)) : '';
    $('tray-meta').textContent = meta;
  }
  function whenText(now) {
    const mins = Math.floor((Date.now() / 1000 - now) / 60);
    return mins >= 2 ? t('ago', clock(now), mins) : clock(now);
  }

  function renderLegend() {
    const stops = [];
    for (const [alt] of HUE) stops.push(`${hueColor(hueAt(alt))} ${(((hueAt(alt) - 20) / 280) * 100).toFixed(1)}%`);
    $('ramp-bar').style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
    const ticks = [[0, '0'], [10000, '10k'], [20000, '20k'], [40000, `40k ${t('ft')}`]];
    $('ramp-ticks').innerHTML = ticks.map(([alt, label]) => `<span${alt === 10000 || alt === 20000 ? ' class="minor"' : ''} style="left:${(((hueAt(alt) - 20) / 280) * 100).toFixed(1)}%">${label}</span>`).join('');
  }

  function renderKey() {
    const sample = (over) => ({ kind: 'jet', alt: 24000, track: 45, src: 'adsb', ...over });
    const sym = (ac, extra = '') => `<span class="sym">${acSvg(ac)}${extra}</span>`;
    const items = [
      [sym(sample()), t('keyAdsb')],
      [sym(sample({ src: 'mlat' })), t('keyMlat')],
      [`<span class="sym" style="opacity:.42">${acSvg(sample())}</span>`, t('keyStale')],
      [sym(sample({ ground: true })), t('keyGround')],
      [`<span class="sym">${acSvg(sample({ kind: 'fighter', alt: 30000 }))}<span class="badge mil" style="position:absolute;top:-1px;right:-2px;width:7px;height:7px;background:var(--ink-strong);box-shadow:0 0 0 1.5px var(--hud)"></span></span>`, t('keyMil')],
      [`<span class="sym"><span style="position:absolute;inset:0;border:2px solid var(--signal);border-radius:50%"></span></span>`, t('keyEmg')],
    ];
    $('key').innerHTML = items.map(([s, text]) => `<li>${s}<span>${esc(text)}</span></li>`).join('');
  }
  function toggleKey(open) {
    $('key').hidden = !open;
    $('key-toggle').setAttribute('aria-expanded', String(open));
    if (open) select(null);
  }
  $('key-toggle').addEventListener('click', (e) => { e.stopPropagation(); toggleKey($('key').hidden); });
  document.addEventListener('click', (e) => { if (!$('key').hidden && !$('key').contains(e.target)) toggleKey(false); });

  // ------------------------------------------------------------------- map
  function clearMap() {
    ringLayer.clearLayers();
    acLayer.clearLayers();
    S.items.clear();
    select(null);
  }

  // Point at `km` from `c` along `bearing` (degrees), on a sphere.
  function dest(c, km, bearing) {
    const r = Math.PI / 180, d = km / 6371, b = bearing * r, la = c.lat * r, lo = c.lon * r;
    const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
    return [la2 / r, lo2 / r];
  }

  function drawRings(c, km) {
    ringLayer.clearLayers();
    const ll = [c.lat, c.lon];
    L.circle(ll, { radius: km * 1000, className: 'rng rng-outer', interactive: false }).addTo(ringLayer);
    L.circle(ll, { radius: km * 500, className: 'rng rng-inner', interactive: false }).addTo(ringLayer);
    // Bezel ticks every 30°, longer at the cardinal points.
    for (let b = 0; b < 360; b += 30) {
      const len = b % 90 === 0 ? 0.075 : 0.04;
      L.polyline([dest(c, km, b), dest(c, km * (1 - len), b)], { className: 'rng-tick', interactive: false }).addTo(ringLayer);
    }
    // The outer label hangs just outside the ring, where no result can be;
    // the inner one stays under the aircraft.
    const label = (text, at, cls, z) => L.marker(at, {
      interactive: false, keyboard: false, zIndexOffset: z,
      icon: L.divIcon({ className: '', html: `<div class="rng-label ${cls}">${esc(text)}</div>`, iconSize: [0, 0] }),
    }).addTo(ringLayer);
    label(`${fmt(km)} ${t('km')}`, dest(c, km, 180), 'out', 3000);
    label(`${fmt(km / 2)} ${t('km')}`, dest(c, km / 2, 180), '', -3000);
    L.marker(ll, {
      interactive: false, keyboard: false,
      icon: L.divIcon({
        className: 'ctr', iconSize: [18, 18], iconAnchor: [9, 9],
        html: '<svg viewBox="0 0 18 18" aria-hidden="true"><g class="halo"><circle cx="9" cy="9" r="3.2"/><path d="M9 0.5v3.5M9 14v3.5M0.5 9h3.5M14 9h3.5"/></g><circle cx="9" cy="9" r="3.2"/><path d="M9 0.5v3.5M9 14v3.5M0.5 9h3.5M14 9h3.5"/></svg>',
      }),
    }).addTo(ringLayer);
  }

  const zOf = (ac) => (ac.emg ? 900 : Math.round((ac.alt || 0) / 100));
  function iconFor(ac, labeled, appear) {
    const size = SIZE[ac.kind] || 24;
    const cls = ['acm', isStale(ac) && 'stale', labeled && 'labeled', ac.emg && 'emg', appear && 'appear'].filter(Boolean).join(' ');
    const html = `${ac.emg ? '<span class="ring"></span>' : ''}<span class="sel"></span>${acSvg(ac)}${badgeHtml(ac)}<span class="tag">${esc(ac.label)}</span>`;
    return L.divIcon({ className: cls, html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  function makeMarker(ac, labeled, appear) {
    const p = estimate(ac);
    const marker = L.marker([p.lat, p.lon], { icon: iconFor(ac, labeled, appear), keyboard: false, title: '', zIndexOffset: zOf(ac), riseOffset: 1200 });
    marker.on('click', (e) => { L.DomEvent.stopPropagation(e); select(ac.hex, { from: 'map' }); });
    marker.on('mouseover', () => hover(ac.hex, true, 'map'));
    marker.on('mouseout', () => hover(ac.hex, false, 'map'));
    return marker.addTo(acLayer);
  }

  function drawMap() {
    const d = S.data;
    ringLayer.clearLayers();
    acLayer.clearLayers();
    S.items.clear();
    if (!d) return;
    if (d.center && d.radiusKm) drawRings(d.center, d.radiusKm);
    const labeled = d.aircraft.filter((a) => a.has).length <= 10;
    for (const ac of d.aircraft) {
      S.items.set(ac.hex, { ac, marker: ac.has ? makeMarker(ac, labeled, false) : null, row: null, fresh: false });
    }
    scaleMarkers();
  }

  // An update: the same aircraft keep their marker (it moves to the new
  // position), new ones fade in, the ones no longer in the result fade out.
  function mergeMap(d) {
    const old = S.items;
    S.items = new Map();
    const labeled = d.aircraft.filter((a) => a.has).length <= 10;
    for (const ac of d.aircraft) {
      const prev = old.get(ac.hex);
      const item = { ac, marker: null, row: null, fresh: !prev };
      S.items.set(ac.hex, item);
      if (!ac.has) { if (prev && prev.marker) vanish(prev.marker); continue; }
      if (!prev || !prev.marker) { item.marker = makeMarker(ac, labeled, true); continue; }
      const m = (item.marker = prev.marker);
      const p = estimate(ac);
      m.setLatLng([p.lat, p.lon]);
      m.setIcon(iconFor(ac, labeled, false));
      m.setZIndexOffset(ac.hex === S.sel ? 2000 : ac.hex === S.hot ? 1500 : zOf(ac));
      const el = m.getElement();
      if (el) { el.classList.toggle('is-sel', ac.hex === S.sel); el.classList.toggle('is-hot', ac.hex === S.hot); }
    }
    for (const [hex, prev] of old) if (!S.items.has(hex) && prev.marker) vanish(prev.marker);
    scaleMarkers();
  }
  function vanish(marker) {
    const el = marker.getElement();
    if (!el || reducedMotion()) { acLayer.removeLayer(marker); return; }
    el.classList.add('vanish');
    setTimeout(() => acLayer.removeLayer(marker), 650);
  }

  // ---------------------------------------------------------------- motion
  // The server's clock now: its `now` plus the time since the result arrived,
  // so a device clock that is off doesn't move anything. A result already
  // minutes old when it arrived (a replayed chat) keeps the wall clock.
  function serverNow() {
    const nowS = Date.now() / 1000;
    if (!S.data) return nowS;
    return S.fresh ? S.data.now + (nowS - S.recvAt) : nowS;
  }
  const posAge = (ac) => (S.data ? Math.max(0, serverNow() - (S.data.now - (ac.seen || 0))) : 0);
  const isStale = (ac) => posAge(ac) > MAX_EST_S;
  // Where the aircraft probably is: dead reckoning from its position, for an
  // airborne aircraft with a track and some speed, up to MAX_EST_S; none for a
  // position that was already older than that when it arrived.
  function estimate(ac) {
    const moving = !ac.ground && ac.gs != null && ac.gs >= MIN_EST_KT && ac.track != null;
    const age = posAge(ac);
    const tS = !moving ? 0 : age <= MAX_EST_S ? age : (ac.ageAtRecv ?? age) <= MAX_EST_S ? MAX_EST_S : 0;
    if (tS < 0.5) return { lat: ac.lat, lon: ac.lon, est: false };
    const [lat, lon] = dest({ lat: ac.lat, lon: ac.lon }, (ac.gs * 1.852 * tS) / 3600, ac.track);
    return { lat, lon, est: true };
  }
  function estDist(ac) {
    if (!S.data || !S.data.center || !ac.has) return ac.dist;
    const p = estimate(ac);
    return haversineKm(S.data.center.lat, S.data.center.lon, p.lat, p.lon);
  }
  // Once a second, while the map is on screen. Markers glide between steps
  // (a 1 s CSS transition on the marker pane), except during zooms and view
  // resets, when Leaflet places them itself; with reduced motion they step.
  function motionTick() {
    if (!S.data || S.zooming || document.visibilityState === 'hidden' || !S.inView) return;
    map.getPane('markerPane').classList.toggle('glide', !reducedMotion());
    for (const item of S.items.values()) {
      const stale = isStale(item.ac);
      if (item.row && item.row.classList.contains('stale') !== stale) item.row.classList.toggle('stale', stale);
      if (!item.marker) continue;
      const p = estimate(item.ac);
      const ll = item.marker.getLatLng();
      if (ll.lat !== p.lat || ll.lng !== p.lon) item.marker.setLatLng([p.lat, p.lon]);
      const el = item.marker.getElement();
      if (el && el.classList.contains('stale') !== stale) el.classList.toggle('stale', stale);
    }
  }
  const unglide = () => map.getPane('markerPane').classList.remove('glide');
  map.on('zoomstart', () => { S.zooming = true; unglide(); });
  map.on('zoomend', () => { S.zooming = false; });
  map.on('viewreset resize', unglide);

  // Many aircraft at a low zoom overlap less when drawn a little smaller.
  function scaleMarkers() {
    const z = map.getZoom();
    const n = S.data ? S.data.aircraft.length : 0;
    let ms = z < 6 ? 0.72 : z < 7.5 ? 0.84 : z < 9 ? 0.94 : 1;
    if (n > 120) ms *= 0.88;
    $('map').style.setProperty('--ms', ms.toFixed(2));
  }

  function circleBounds(c, km) {
    const dLat = km / 111.32, dLon = km / (111.32 * Math.max(0.05, Math.cos((c.lat * Math.PI) / 180)));
    return L.latLngBounds([c.lat - dLat, c.lon - dLon], [c.lat + dLat, c.lon + dLon]);
  }
  function padding() {
    if (S.layout === 'panel') return { tl: [24, 24], br: [64, 42] };
    // Bottom: room for the outer ring's label, which hangs below the ring.
    return { tl: [18, 18], br: [58, 40] };
  }
  function fitCircle(c, km, animate) {
    const p = padding();
    map.fitBounds(circleBounds(c, km), { paddingTopLeft: p.tl, paddingBottomRight: p.br, maxZoom: 12, animate });
  }
  function fitView(animate = true) {
    const d = S.data;
    if (!d) return;
    const pts = d.aircraft.filter((a) => a.has).map((a) => [a.lat, a.lon]);
    if (d.center && d.radiusKm) return fitCircle(d.center, d.radiusKm, animate);
    if (pts.length === 1) return map.setView(pts[0], 8, { animate });
    if (!pts.length) return map.setView([42.3, 12.6], 4.5, { animate });
    const p = padding();
    map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: p.tl, paddingBottomRight: p.br, maxZoom: 9, animate });
  }

  $('btn-in').addEventListener('click', () => map.zoomIn());
  $('btn-out').addEventListener('click', () => map.zoomOut());
  $('btn-fit').addEventListener('click', () => fitView(!reducedMotion()));
  $('btn-full').addEventListener('click', async () => {
    const want = S.mode === 'fullscreen' ? 'inline' : 'fullscreen';
    try {
      const res = await request('ui/request-display-mode', { mode: want });
      if (res && res.mode) applyContext({ displayMode: res.mode });
    } catch { /* the host said no: stay as we are */ }
  });

  // ------------------------------------------------------------------ list
  const SORTS = {
    nearest: (a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity),
    lowest: (a, b) => altKey(a, Infinity) - altKey(b, Infinity),
    highest: (a, b) => altKey(b, -Infinity) - altKey(a, -Infinity),
  };
  function altKey(ac, unknown) { return ac.ground ? -1 : ac.alt == null ? unknown : ac.alt; }
  function sorted() {
    const list = S.data ? [...S.data.aircraft] : [];
    const by = SORTS[S.sort] || SORTS.lowest;
    // Emergencies first, whatever the order.
    return list.sort((a, b) => (!!b.emg - !!a.emg) || by(a, b) || a.label.localeCompare(b.label));
  }

  function renderSort() {
    const el = $('sort');
    const opts = (S.data && S.data.center ? ['nearest'] : []).concat(['lowest', 'highest']);
    el.innerHTML = opts.map((k) => `<button type="button" role="radio" data-sort="${k}" aria-checked="${S.sort === k}" tabindex="${S.sort === k ? 0 : -1}">${esc(t(`sort${k[0].toUpperCase()}${k.slice(1)}`))}</button>`).join('');
    el.hidden = !S.data || S.data.aircraft.length < 2;
  }
  $('sort').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-sort]');
    if (!b || b.dataset.sort === S.sort) return;
    S.sort = b.dataset.sort;
    renderSort();
    renderList();
    $('sort').querySelector(`[data-sort="${S.sort}"]`).focus();
  });
  $('sort').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const btns = [...$('sort').querySelectorAll('button')];
    const i = btns.findIndex((x) => x.dataset.sort === S.sort);
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
    if (next) { e.preventDefault(); next.click(); }
  });

  function altText(ac) {
    if (ac.ground) return t('ground');
    if (ac.alt == null) return '–';
    return `${fmt(ac.alt)} ${t('ft')}`;
  }
  const trend = (ac) => (ac.ground || ac.vr == null ? '' : ac.vr > 256 ? '↑' : ac.vr < -256 ? '↓' : '');
  const distText = (ac) => (ac.dist == null ? '' : `${fmt(ac.dist, ac.dist < 10 ? 1 : 0)} ${t('km')}`);

  // The list keeps its order across updates while someone is using it (touch,
  // hover, focus, the last 5 s), so a row doesn't move under the finger; new
  // aircraft go at the end, a new emergency at the top. Otherwise it is sorted.
  const listBusy = () => Date.now() - S.listTouchedAt < 5000 || $('list').matches(':hover') || $('list').contains(document.activeElement);
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'scroll', 'touchstart']) {
    $('list').addEventListener(ev, () => { S.listTouchedAt = Date.now(); }, { passive: true });
  }
  function listOrder() {
    const ids = sorted().map((a) => a.hex);
    if (!S.stableList || !S.order.length || !listBusy()) return ids;
    const now = new Set(ids);
    const keep = S.order.filter((h) => now.has(h));
    const kept = new Set(keep);
    const added = ids.filter((h) => !kept.has(h));
    const emg = added.filter((h) => S.items.get(h) && S.items.get(h).ac.emg);
    return [...emg, ...keep, ...added.filter((h) => !emg.includes(h))];
  }

  function renderList() {
    const list = $('list');
    const empty = $('tray-empty');
    empty.hidden = true;
    if (S.status === 'loading') {
      list.innerHTML = Array.from({ length: S.layout === 'panel' ? 6 : 4 }, () =>
        '<li><div class="row skel"><span class="skel-ico"></span><span class="id"><span class="skel-bar"></span><span class="skel-bar"></span></span></div></li>').join('');
      return;
    }
    const d = S.data;
    if (!d || !d.aircraft.length) {
      list.innerHTML = '';
      S.order = [];
      empty.textContent = S.status === 'ready' || S.status === 'empty' ? t('noneListed') : '';
      empty.hidden = !empty.textContent;
      return;
    }
    const focused = document.activeElement && list.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement.dataset.hex : null;
    const scroll = [list.scrollLeft, list.scrollTop];
    const order = listOrder();
    list.innerHTML = order.map((hex) => {
      const item = S.items.get(hex);
      const ac = item.ac;
      const sub = [ac.type, ac.cs && ac.reg].filter(Boolean).join('  ');
      const tr = trend(ac);
      const aria = [ac.label, ac.desc || ac.type, altText(ac), tr === '↑' ? t('climbing') : tr === '↓' ? t('descending') : '', distText(ac),
        ac.emg ? t(`emergency.${ac.emg}`) : '', ac.has ? '' : t('noPosition')].filter(Boolean).join(', ');
      const cls = ['row', ac.emg && 'emg', isStale(ac) && 'stale', item.fresh && S.stableList && 'fresh'].filter(Boolean).join(' ');
      return `<li><button type="button" class="${cls}" data-hex="${esc(ac.hex)}" aria-pressed="${S.sel === ac.hex}" aria-label="${esc(aria)}">` +
        `<span class="ico">${acSvg(ac)}${badgeHtml(ac)}</span>` +
        `<span class="id"><span class="cs">${esc(ac.label)}${ac.emg ? `<span class="sq">${esc(ac.squawk || '')}</span>` : ''}</span><span class="sub">${esc(sub || '\u00a0')}</span></span>` +
        `<span class="vals"><span class="alt">${esc(altText(ac))}<span class="trend" aria-hidden="true">${tr}</span></span><span class="dist">${esc(ac.has ? distText(ac) : t('noPosition'))}</span></span>` +
        '</button></li>';
    }).join('');
    for (const btn of list.querySelectorAll('.row')) {
      const item = S.items.get(btn.dataset.hex);
      if (item) item.row = btn;
    }
    [list.scrollLeft, list.scrollTop] = scroll;
    S.order = order;
    if (focused) {
      const b = S.items.get(focused) && S.items.get(focused).row;
      if (b) b.focus({ preventScroll: true });
    }
  }
  $('list').addEventListener('click', (e) => {
    const b = e.target.closest('.row[data-hex]');
    if (b) select(S.sel === b.dataset.hex ? null : b.dataset.hex, { from: 'list' });
  });
  $('list').addEventListener('mouseover', (e) => {
    const b = e.target.closest('.row[data-hex]');
    if (b) hover(b.dataset.hex, true, 'list');
  });
  $('list').addEventListener('mouseout', (e) => {
    const b = e.target.closest('.row[data-hex]');
    if (b && !b.contains(e.relatedTarget)) hover(b.dataset.hex, false, 'list');
  });
  $('list').addEventListener('focusin', (e) => {
    const b = e.target.closest('.row[data-hex]');
    if (b) hover(b.dataset.hex, true, 'list');
  });
  $('list').addEventListener('focusout', (e) => {
    const b = e.target.closest('.row[data-hex]');
    if (b) hover(b.dataset.hex, false, 'list');
  });

  // ------------------------------------------------------------- selection
  function markerEl(hex) {
    const item = S.items.get(hex);
    return item && item.marker && item.marker.getElement();
  }
  function hover(hex, on, from) {
    if (on) { if (S.hot && S.hot !== hex) hover(S.hot, false); S.hot = hex; } else if (S.hot === hex) S.hot = null;
    const item = S.items.get(hex);
    if (!item) return;
    const el = markerEl(hex);
    if (el) el.classList.toggle('is-hot', on);
    if (item.marker && hex !== S.sel) item.marker.setZIndexOffset(on ? 1500 : item.ac.emg ? 900 : Math.round((item.ac.alt || 0) / 100));
    if (item.row) item.row.classList.toggle('is-hot', on && from === 'map');
  }

  let ctxTimer = 0;
  function select(hex, opts = {}) {
    const prev = S.sel;
    if (prev && prev !== hex) {
      const el = markerEl(prev);
      if (el) el.classList.remove('is-sel');
      const item = S.items.get(prev);
      if (item && item.marker) item.marker.setZIndexOffset(item.ac.emg ? 900 : Math.round((item.ac.alt || 0) / 100));
      if (item && item.row) item.row.setAttribute('aria-pressed', 'false');
    }
    S.sel = hex && S.items.has(hex) ? hex : null;
    const card = $('card');
    if (!S.sel) {
      card.hidden = true;
      syncTray();
      // An update that drops the selected aircraft says so with a toast, not
      // in the model's context: only the user's own choices go there.
      if (prev && opts.from !== 'merge') shareSelection(null);
      return;
    }
    const item = S.items.get(S.sel);
    const el = markerEl(S.sel);
    if (el) el.classList.add('is-sel');
    if (item.marker) item.marker.setZIndexOffset(2000);
    if (item.row) {
      item.row.setAttribute('aria-pressed', 'true');
      if (opts.from === 'map' || opts.from === 'auto') revealRow(item.row);
    }
    if (!$('key').hidden) toggleKey(false);
    renderCard();
    syncTray();
    if (item.ac.has && !opts.keepView && (opts.from === 'list' || opts.from === 'auto')) focusFree(item.ac, opts.from === 'list');
    if (prev !== S.sel && opts.from !== 'auto') shareSelection(item.ac);
  }

  // The part of the map the card leaves free: to its right or above it,
  // whichever is bigger (the controls take the right edge).
  function freeRect() {
    const size = map.getSize();
    const card = $('card');
    const r = { x0: 16, y0: 16, x1: size.x - 60, y1: size.y - 26 };
    if (card.hidden || card.classList.contains('docked')) return r;
    const right = { ...r, x0: card.offsetLeft + card.offsetWidth + 16 };
    const above = { ...r, y1: card.offsetTop - 16 };
    const area = (q) => Math.max(0, q.x1 - q.x0) * Math.max(0, q.y1 - q.y0);
    return area(right) >= area(above) ? right : above;
  }
  // Brings the selected aircraft into the free part of the map: centred there
  // when it is hidden, untouched when it is already in view.
  function focusFree(ac, animate) {
    const f = freeRect();
    const p = map.latLngToContainerPoint([ac.lat, ac.lon]);
    if (p.x >= f.x0 && p.x <= f.x1 && p.y >= f.y0 && p.y <= f.y1) return;
    map.panBy([p.x - (f.x0 + f.x1) / 2, p.y - (f.y0 + f.y1) / 2], { animate: animate && !reducedMotion() });
  }

  // Scrolls the list only: scrollIntoView() could also scroll the chat around
  // the iframe.
  function revealRow(row) {
    const list = $('list');
    const li = row.parentElement;
    if (S.layout === 'strip') {
      const left = li.offsetLeft, right = left + li.offsetWidth;
      if (left < list.scrollLeft + 10) list.scrollLeft = left - 10;
      else if (right > list.scrollLeft + list.clientWidth - 10) list.scrollLeft = right - list.clientWidth + 10;
    } else {
      const top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < list.scrollTop + 6) list.scrollTop = top - 6;
      else if (bottom > list.scrollTop + list.clientHeight - 6) list.scrollTop = bottom - list.clientHeight + 6;
    }
  }

  // The selection becomes context for the model's next turn (no message sent).
  function shareSelection(ac) {
    if (!S.caps.updateModelContext) return;
    clearTimeout(ctxTimer);
    ctxTimer = setTimeout(() => {
      const text = ac
        ? `On the FlyItalyADSB map the user selected ${ac.label} (hex ${ac.hex}${ac.type ? `, type ${ac.type}` : ''}${ac.reg ? `, registration ${ac.reg}` : ''}${ac.alt != null && !ac.ground ? `, ${ac.alt} ft` : ac.ground ? ', on the ground' : ''}).`
        : 'On the FlyItalyADSB map the user has no aircraft selected.';
      request('ui/update-model-context', { content: [{ type: 'text', text }] }).catch(() => {});
    }, 400);
  }

  function seenText(ac, now) {
    const s = Math.max(0, Math.round(serverNow() - (now - (ac.seen || 0))));
    if (s < 90) return t('secondsAgo', s);
    if (s < 5400) return t('minutesAgo', Math.round(s / 60));
    return t('hoursAgo', Math.round(s / 3600));
  }

  function renderCard() {
    const item = S.sel && S.items.get(S.sel);
    const card = $('card');
    if (!item) { card.hidden = true; return; }
    const ac = item.ac, d = S.data;
    const emgText = ac.emg ? t(`emergency.${ac.emg}`) : '';
    const tr = trend(ac);
    const vr = ac.vr != null && Math.abs(ac.vr) > 256 && !ac.ground ? `${tr} ${fmt(Math.abs(Math.round(ac.vr / 50) * 50))} ${t('fpm')}` : '';
    const chips = [
      ac.emg ? `<span class="chip emg">${esc(emgText)}</span>` : '',
      ac.flags & 1 ? `<span class="chip mil">${esc(t('military'))}</span>` : '',
      ac.flags & 4 ? `<span class="chip" title="${esc(t('piaTitle'))}">${esc(t('pia'))}</span>` : '',
      ac.flags & 8 ? `<span class="chip" title="${esc(t('laddTitle'))}">${esc(t('ladd'))}</span>` : '',
    ].join('');
    const sub = [
      ac.desc || ac.type ? `<span>${esc(ac.desc || ac.type)}</span>` : '',
      ac.reg && ac.reg !== ac.label ? `<span class="code">${esc(ac.reg)}</span>` : '',
      `<span class="code">${esc(ac.hex)}</span>`,
    ].join('');
    const cell = (k, v, small = '', cls = '') => `<div><dt>${esc(k)}</dt><dd class="${cls}">${v}${small ? `<small>${esc(small)}</small>` : ''}</dd></div>`;
    const readouts = [
      cell(t('altitude'), esc(altText(ac)), vr),
      cell(t('speed'), ac.gs == null ? '–' : `${fmt(ac.gs)} ${t('kt')}`),
      cell(t('track'), ac.track == null ? '–' : `${fmt(ac.track)}°`),
      cell(t('squawk'), ac.squawk ? `<span class="code">${esc(ac.squawk)}</span>` : '–', emgText, ac.emg ? 'emg' : ''),
    ].join('');
    const facts = [
      `<span>${esc(t('source'))} <b>${esc(t(`sources.${ac.src}`))}</b></span>`,
      `<span>${esc(t('seen'))} <b id="card-seen">${esc(seenText(ac, d.now))}</b></span>`,
      ac.dist != null ? `<span>${esc(t('distance'))} <b id="card-dist">${esc(distText({ dist: estDist(ac) }))}</b></span>` : '',
      // Altitude and speed are the last ones received; the position on the
      // map may be an estimate, and then the card says so.
      `<span id="card-est"${estimate(ac).est ? '' : ' hidden'}>${esc(t('estimated'))} <b>${esc(t('estimatedValue'))}</b></span>`,
    ].join('');
    const actions = [
      S.caps.message ? `<button type="button" class="btn primary" data-act="ask">${esc(t('ask'))}</button>` : '',
      S.caps.openLinks ? `<button type="button" class="btn" data-act="open">${esc(t('openLive'))}</button>` : '',
    ].join('');
    card.innerHTML =
      `<div class="card-head"><span class="ico">${acSvg(ac)}</span><div><h2 id="card-title">${esc(ac.label)}${chips}</h2><p class="sub">${sub}</p></div>` +
      `<button type="button" class="close" data-act="close" aria-label="${esc(t('close'))}" title="${esc(t('close'))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg></button></div>` +
      `<dl class="readouts">${readouts}</dl><p class="facts">${facts}</p>` +
      (actions ? `<div class="actions">${actions}</div>` : '');
    card.classList.toggle('emg', !!ac.emg);
    dockCard();
    card.hidden = false;
  }
  function dockCard() {
    const card = $('card');
    const docked = S.layout === 'strip' && !S.fixed && window.innerWidth < 520;
    card.classList.toggle('docked', docked);
    if (docked && card.parentElement !== tray) tray.appendChild(card);
    if (!docked && card.parentElement !== stage) stage.appendChild(card);
  }
  $('card').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const item = S.sel && S.items.get(S.sel);
    if (b.dataset.act === 'close') {
      const row = item && item.row;
      select(null);
      if (row) row.focus();
    } else if (b.dataset.act === 'ask' && item) {
      request('ui/message', { role: 'user', content: [{ type: 'text', text: t('askText', item.ac.label, item.ac.hex) }] }).catch(() => {});
    } else if (b.dataset.act === 'open' && item) {
      request('ui/open-link', { url: `${LIVE_MAP}?icao=${encodeURIComponent(item.ac.hex)}` }).catch(() => {});
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('key').hidden) { toggleKey(false); $('key-toggle').focus(); return; }
    if (e.key === 'Escape' && S.sel) {
      const row = S.items.get(S.sel) && S.items.get(S.sel).row;
      select(null);
      if (row) row.focus();
    }
  });

  // --------------------------------------------------------------- refresh
  // Same query again through the host (tools/call), when the host proxies
  // tool calls. "Near me" is repeated at the same centre, not re-resolved.
  function refreshCall() {
    const d = S.data;
    const name = S.toolName || (d && d.kind === 'near' ? 'aircraft_near' : d && d.kind === 'special' ? 'special_traffic' : d && d.kind === 'find' ? 'find_aircraft' : null);
    if (!name) return null;
    const args = { ...(S.args || {}) };
    if (name === 'aircraft_near' && d && d.center && args.airport === undefined && args.lat === undefined) {
      args.lat = d.center.lat; args.lon = d.center.lon;
      if (d.radiusKm) args.radiusKm = d.radiusKm;
    }
    return { name, args };
  }
  // Refresh and Live share this: the same call again, merged into the map.
  // Anything but a readable result stops Live (never a retry loop) and says why.
  let refreshing = null;
  function refreshNow(source) {
    if (refreshing) return refreshing;
    const call = refreshCall();
    if (!call) return Promise.resolve(false);
    $('btn-refresh').classList.add('is-busy');
    refreshing = (async () => {
      try {
        const res = await request('tools/call', { name: call.name, arguments: call.args }, 30000);
        const d = parse(res);
        if (d.kind === 'error' || (res && res.isError)) throw new Error(d.message || textOf(res) || 'error');
        if (d.kind === 'notfound') throw new Error(t('notFoundTitle', d.value || call.args.value || ''));
        if (d.kind === 'unreadable') throw new Error(t('unreadableTitle'));
        show(res, { keepView: true, keepPlace: true, merge: true });
        if (source === 'button') toast(t('refreshed', clock(S.data.now, true)));
        return true;
      } catch (err) {
        const why = reasonOf(err);
        if (S.live.state === 'on') setLive('stopped', why);
        toast(source === 'live' ? t('liveStopped', why) : t('refreshFailed', why));
        log('warning', { event: 'refresh-failed', source, reason: why });
        return false;
      } finally {
        $('btn-refresh').classList.remove('is-busy');
        refreshing = null;
        renderLive();
      }
    })();
    renderLive();
    return refreshing;
  }
  function reasonOf(err) {
    const msg = String((err && err.message) || err || '');
    if (/rate limit|\b429\b|too many requests/i.test(msg)) return t('liveRate');
    if (/timeout/i.test(msg)) return t('liveTimeout');
    if (!msg) return t('liveOff');
    const first = userMessage(msg);
    return (first === t('errorBody') ? t('liveError') : first).slice(0, 100);
  }
  $('btn-refresh').addEventListener('click', () => {
    const btn = $('btn-refresh');
    if (btn.disabled) return;
    btn.disabled = true;
    refreshNow('button').finally(() => {
      setTimeout(() => { btn.disabled = false; }, 4000);
      if (S.live.state === 'on') scheduleLive();
    });
  });

  // ------------------------------------------------------------------ live
  // Off until the user presses it. While on: the same call every LIVE.everyS
  // seconds, only while the tab is visible and the map is on screen, for at
  // most LIVE.maxMinutes, then paused until pressed again. Each update is one
  // request on the user's key (the tooltip and a first-time toast say so).
  // Updates don't go into the model's context: the conversation's tool result
  // stays what the model and the user both saw; asking again gives fresh data.
  const visibleNow = () => document.visibilityState !== 'hidden' && S.inView;
  function setLive(state, reason = '') {
    const lv = S.live;
    lv.state = state;
    lv.reason = reason;
    lv.waiting = false;
    clearTimeout(lv.timer);
    if (state === 'on') scheduleLive();
    renderLive();
  }
  function scheduleLive() {
    const lv = S.live;
    clearTimeout(lv.timer);
    if (lv.state !== 'on') return;
    lv.timer = setTimeout(liveTick, Math.max(0, lv.last + LIVE.everyS * 1000 - Date.now()));
  }
  async function liveTick() {
    const lv = S.live;
    if (lv.state !== 'on') return;
    if (Date.now() - lv.since >= LIVE.maxMinutes * 60000) { setLive('paused'); return; }
    if (!visibleNow()) { lv.waiting = true; return; }
    await refreshNow('live');
    scheduleLive();
  }
  function onVisible() {
    if (S.live.state === 'on' && S.live.waiting && visibleNow()) { S.live.waiting = false; scheduleLive(); }
  }
  document.addEventListener('visibilitychange', onVisible);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { S.inView = entries[entries.length - 1].isIntersecting; onVisible(); }).observe(app);
  }
  $('live-btn').addEventListener('click', () => {
    if (S.live.state === 'on') { setLive('off'); return; }
    S.live.since = Date.now();
    if (!S.live.told) { S.live.told = true; toast(t('liveFirst', LIVE.everyS, LIVE.maxMinutes)); }
    // Right away if the data is older than the interval, otherwise on time.
    setLive('on');
  });
  const liveTip = () => t('liveTip', LIVE.everyS, LIVE.maxMinutes);
  function renderLive() {
    const btn = $('live-btn');
    btn.hidden = !(S.connected && S.caps.serverTools && S.data && (S.status === 'ready' || S.status === 'empty') && refreshCall());
    const st = S.live.state;
    btn.setAttribute('aria-pressed', String(st === 'on'));
    btn.classList.toggle('paused', st === 'paused');
    btn.classList.toggle('busy', st === 'on' && !!refreshing);
    $('live-label').textContent = st === 'paused' ? t('liveResume') : t('live');
    btn.title = liveTip();
    btn.setAttribute('aria-label', `${st === 'paused' ? t('liveResume') : t('live')}. ${liveTip()}`);
    renderLiveTime();
  }
  function renderLiveTime() {
    const el = $('title-time');
    if (!S.data || S.status === 'loading') return;
    const st = S.live.state;
    el.className = `title-time${st === 'off' ? '' : ` ${st === 'on' ? 'live' : st}`}`;
    const text = st === 'on' ? (refreshing ? t('liveUpdating') : t('liveUpdated', Math.max(0, Math.round((Date.now() - S.live.last) / 1000))))
      : st === 'paused' ? t('livePaused', LIVE.maxMinutes)
      : st === 'stopped' ? t('liveStopped', S.live.reason)
      : whenText(S.data.now);
    if (el.textContent !== text) el.textContent = text;
    el.title = st === 'stopped' ? text : '';
  }

  // Once a second: estimated motion, the card's last seen and distance, the
  // Live indicator.
  const ticker = setInterval(() => {
    motionTick();
    const item = S.sel && S.items.get(S.sel);
    if (item && S.data) {
      const seen = $('card-seen');
      if (seen) seen.textContent = seenText(item.ac, S.data.now);
      const dist = $('card-dist');
      if (dist) dist.textContent = distText({ dist: estDist(item.ac) });
      const est = $('card-est');
      if (est) est.hidden = !estimate(item.ac).est;
    }
    if (S.live.state === 'on') renderLiveTime();
  }, 1000);
  setInterval(() => { if (S.data && S.live.state === 'off') renderLiveTime(); }, 30000);

  // ------------------------------------------------------------------ brand
  // The mark is a data: image, which the spec's CSP allows; if a host blocks
  // it anyway, a drawn mark (navy disc, the map's jet) takes its place.
  function brandFallback() {
    const img = $('brand-mark');
    if (!img) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('class', 'brand-fallback');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<circle cx="32" cy="32" r="32" fill="#0d2a44"/><g transform="rotate(62 32 32) translate(11 11) scale(0.66)" fill="#e8f4fb"><use href="#s-jet"/></g>';
    img.replaceWith(svg);
  }
  {
    const img = $('brand-mark');
    if (img.complete && !img.naturalWidth) brandFallback();
    else img.addEventListener('error', brandFallback);
  }
  $('brand').setAttribute('aria-label', 'FlyItalyADSB, flyitalyadsb.com');

  // ------------------------------------------------------------------ start
  renderStatic();
  renderLegend();
  relayout();
  setStatus('loading');
  if (window.parent === window) setStatus('standalone');
  else connect();
})();
