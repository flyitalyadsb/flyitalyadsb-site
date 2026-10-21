import type { ConsentDescription } from '@cloudflare/workers-oauth-provider';
import type { Lang } from './api';

// The authorization pages. Everything that came from the client (its name,
// domain, redirect host, scopes) is escaped: a DCR client or a CIMD document
// chooses those strings, and unescaped they would be script on this origin.
// One <style> and at most one <script>, both with the response's nonce; no
// style attributes, so the CSP needs no 'unsafe-inline'.

export const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const T = {
  it: {
    title: (c: string) => `Collega ${c} a FlyItalyADSB`,
    emailIntro: 'Scrivi la tua email: ti mandiamo un codice di 6 cifre. Se non hai ancora una chiave API, la creiamo gratis quando consenti l’accesso.',
    email: 'Email',
    sendCode: 'Mandami il codice',
    codeTitle: 'Controlla la tua email',
    codeIntro: (e: string) => `Abbiamo mandato un codice a <strong>${e}</strong>. Scrivilo qui: vale 15 minuti.`,
    code: 'Codice',
    continue: 'Continua',
    resend: 'Mandalo di nuovo',
    otherEmail: 'Usa un’altra email',
    resent: 'Ti abbiamo mandato un nuovo codice. Vale solo l’ultimo.',
    wrongCode: 'Codice sbagliato o scaduto. Dopo 5 tentativi serve un codice nuovo.',
    consentTitle: (c: string) => `Consenti a ${c} di usare i dati FlyItalyADSB?`,
    as: (e: string, p: string) => `Accesso come <strong>${e}</strong> &middot; piano <strong>${p}</strong>`,
    can: 'Potrà cercare aerei in tempo reale, vedere il traffico militare, PIA e LADD e leggere lo storico delle tracce: solo in lettura, con i limiti del tuo piano.',
    verified: (c: string, d: string) => `<strong>${c}</strong>, pubblicata da <strong>${d}</strong>.`,
    unverified: (c: string) => `<strong>${c}</strong> si è registrata da sola: il nome non è verificato.`,
    redirect: (h: string) => `L’accesso andrà a <strong>${h}</strong>.`,
    loopback: 'L’accesso andrà a un’app sul tuo computer: continua solo se hai appena iniziato il collegamento da lì.',
    terms: 'Accetto le <a href="/termini/" target="_blank" rel="noopener">condizioni</a> e la creazione di una chiave API gratuita per questa email.',
    termsNeeded: 'Per creare la chiave gratuita serve accettare le condizioni.',
    allow: 'Consenti',
    deny: 'Rifiuta',
    notYou: 'Non sei tu? Usa un’altra email',
    revoke: 'Puoi scollegarlo quando vuoi da <a href="/dati/api/account/">La mia API</a>.',
    linkTitle: 'Continua il collegamento',
    linkIntro: 'Premi «Continua» per tornare alla pagina di autorizzazione.',
    otherBrowser: 'Questo link funziona solo nel browser in cui hai iniziato il collegamento. Torna lì, oppure scrivi in quella pagina il codice dell’email.',
    expired: 'Questa pagina è scaduta o è già stata usata. Ricomincia il collegamento dal tuo assistente.',
    noFreeKey: 'Questa casella ha già una chiave gratuita con un’altra forma dell’indirizzo: collegati con quell’indirizzo.',
    disposable: 'Le email temporanee non sono accettate: usa un indirizzo che controlli.',
    unavailable: 'Il servizio non risponde in questo momento. Riprova tra poco.',
  },
  en: {
    title: (c: string) => `Connect ${c} to FlyItalyADSB`,
    emailIntro: 'Enter your email and we’ll send you a 6-digit code. If you don’t have an API key yet, we create a free one when you allow access.',
    email: 'Email',
    sendCode: 'Send me the code',
    codeTitle: 'Check your email',
    codeIntro: (e: string) => `We sent a code to <strong>${e}</strong>. Type it here: it’s valid for 15 minutes.`,
    code: 'Code',
    continue: 'Continue',
    resend: 'Send it again',
    otherEmail: 'Use another email',
    resent: 'We sent you a new code. Only the latest one works.',
    wrongCode: 'Wrong or expired code. After 5 attempts you need a new code.',
    consentTitle: (c: string) => `Allow ${c} to use FlyItalyADSB data?`,
    as: (e: string, p: string) => `Signed in as <strong>${e}</strong> &middot; <strong>${p}</strong> plan`,
    can: 'It will be able to look up live aircraft, see military, PIA and LADD traffic and read track history: read-only, within your plan’s limits.',
    verified: (c: string, d: string) => `<strong>${c}</strong>, published by <strong>${d}</strong>.`,
    unverified: (c: string) => `<strong>${c}</strong> registered itself: its name is not verified.`,
    redirect: (h: string) => `Access will be sent to <strong>${h}</strong>.`,
    loopback: 'Access will be sent to an app on your computer: continue only if you just started connecting from it.',
    terms: 'I accept the <a href="/en/terms/" target="_blank" rel="noopener">terms</a> and the creation of a free API key for this email.',
    termsNeeded: 'Creating the free key needs the terms to be accepted.',
    allow: 'Allow',
    deny: 'Deny',
    notYou: 'Not you? Use another email',
    revoke: 'You can disconnect it at any time from <a href="/en/data/api/account/">My API</a>.',
    linkTitle: 'Continue connecting',
    linkIntro: 'Press “Continue” to go back to the authorization page.',
    otherBrowser: 'This link only works in the browser where you started connecting. Go back there, or type the code from the email on that page.',
    expired: 'This page has expired or was already used. Start connecting again from your assistant.',
    noFreeKey: 'This mailbox already has a free key under another form of the address: connect with that address.',
    disposable: 'Temporary email addresses are not accepted: use an address you control.',
    unavailable: 'The service is not responding right now. Try again shortly.',
  },
} as const;

export type Texts = (typeof T)['it'];
export const texts = (lang: Lang): Texts => T[lang] as Texts;

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:#070d1a;color:#cbd5e1;font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px 16px}
main{width:100%;max-width:440px;background:#0f1929;border:1px solid #1e3048;border-radius:16px;padding:28px}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px;color:#f1f5f9;font-weight:600;font-size:15px}
.brand img{width:28px;height:28px;border-radius:50%}
h1{font-size:21px;line-height:1.3;color:#f1f5f9;margin:0 0 12px}
p{margin:0 0 14px}
.muted{color:#94a3b8;font-size:14px}
.small{color:#64748b;font-size:13px}
div.small{margin-top:16px}
strong{color:#e2e8f0}
a{color:#7dd3fc}
label{display:block;font-size:13px;color:#94a3b8;margin:4px 0 6px}
input[type=email],input[type=text]{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #1e3048;background:#0a1320;color:#f1f5f9;font-size:16px}
input.code{font:600 26px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.35em;text-align:center}
button{width:100%;margin-top:14px;padding:11px 14px;border-radius:10px;border:1px solid #38bdf866;background:#38bdf826;color:#e0f2fe;font-size:16px;font-weight:600;cursor:pointer}
button.secondary{background:transparent;border-color:#1e3048;color:#94a3b8;font-weight:500}
.row{display:flex;gap:10px}.row button{flex:1}
.links{display:flex;justify-content:space-between;gap:12px;margin-top:14px}
.links button{width:auto;margin:0;padding:0;border:0;background:none;color:#7dd3fc;font-size:14px;font-weight:500}
.box{border:1px solid #1e3048;border-radius:10px;padding:12px 14px;margin:0 0 14px;font-size:14px;color:#94a3b8}
.warn{border-color:#f59e0b66;color:#fcd34d}
.error{border-color:#f8717166;color:#fca5a5}
.check{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:#94a3b8;margin:6px 0 0}
.check input{margin-top:4px}
`;

function layout(lang: Lang, nonce: string, title: string, body: string, script = ''): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style nonce="${nonce}">${CSS}</style>
</head>
<body>
<main>
<div class="brand"><img src="/img/logo-64.png" alt="" width="28" height="28">FlyItalyADSB</div>
${body}
</main>
${script ? `<script nonce="${nonce}">${script}</script>` : ''}
</body>
</html>`;
}

function clientFacts(t: Texts, d: ConsentDescription): string {
  const name = escape(d.clientName);
  return `<div class="box">${d.clientDomain ? t.verified(name, escape(d.clientDomain)) : t.unverified(name)}
${t.redirect(escape(d.redirectHost))}</div>
${d.redirectIsLoopback ? `<div class="box warn">${t.loopback}</div>` : ''}`;
}

const alert = (kind: 'error' | 'warn', message?: string) =>
  message ? `<div class="box ${kind}">${message}</div>` : '';

export function emailPage(lang: Lang, nonce: string, d: ConsentDescription, flow: string, error?: string, email = ''): string {
  const t = texts(lang);
  return layout(lang, nonce, escape(t.title(d.clientName)), `
<h1>${escape(t.title(d.clientName))}</h1>
<p class="muted">${t.emailIntro}</p>
${alert('error', error)}
<form method="post" action="/authorize">
<input type="hidden" name="f" value="${escape(flow)}">
<input type="hidden" name="step" value="email">
<label for="email">${t.email}</label>
<input id="email" name="email" type="email" required autocomplete="email" autofocus value="${escape(email)}">
<button type="submit">${t.sendCode}</button>
</form>
<div class="small">${clientFacts(t, d)}</div>`);
}

export function codePage(lang: Lang, nonce: string, d: ConsentDescription, flow: string, email: string,
  notice?: { kind: 'error' | 'warn'; message: string }): string {
  const t = texts(lang);
  return layout(lang, nonce, escape(t.codeTitle), `
<h1>${t.codeTitle}</h1>
<p class="muted">${t.codeIntro(escape(email))}</p>
${notice ? alert(notice.kind, notice.message) : ''}
<form method="post" action="/authorize">
<input type="hidden" name="f" value="${escape(flow)}">
<input type="hidden" name="step" value="code">
<label for="code">${t.code}</label>
<input id="code" class="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code" autofocus>
<button type="submit">${t.continue}</button>
</form>
<form method="post" action="/authorize" class="links">
<input type="hidden" name="f" value="${escape(flow)}">
<button type="submit" name="step" value="resend">${t.resend}</button>
<button type="submit" name="step" value="change">${t.otherEmail}</button>
</form>`);
}

export function consentPage(lang: Lang, nonce: string, d: ConsentDescription, flow: string, handle: string,
  email: string, plan: string, needsTerms: boolean, error?: string): string {
  const t = texts(lang);
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return layout(lang, nonce, escape(t.consentTitle(d.clientName)), `
<h1>${escape(t.consentTitle(d.clientName))}</h1>
<p class="muted">${t.as(escape(email), escape(planName))}</p>
<p class="muted">${t.can}</p>
${clientFacts(t, d)}
${alert('error', error)}
<form method="post" action="/authorize">
<input type="hidden" name="f" value="${escape(flow)}">
<input type="hidden" name="step" value="consent">
<input type="hidden" name="handle" value="${escape(handle)}">
${needsTerms ? `<label class="check"><input type="checkbox" name="accept_terms" value="1" required> <span>${t.terms}</span></label>` : ''}
<div class="row"><button type="submit" name="decision" value="deny" class="secondary" formnovalidate>${t.deny}</button>
<button type="submit" name="decision" value="approve">${t.allow}</button></div>
</form>
<form method="post" action="/authorize" class="links">
<input type="hidden" name="f" value="${escape(flow)}">
<button type="submit" name="step" value="change">${t.notYou}</button>
</form>
<p class="small">${t.revoke}</p>`);
}

/** /authorize/email: the link in the email. The token and the flow are in the
 * fragment, which no server sees; the button posts them. Nothing happens on
 * load, because corporate spam filters open links and would burn this one. */
export function linkPage(lang: Lang, nonce: string): string {
  const t = texts(lang);
  return layout(lang, nonce, escape(t.linkTitle), `
<h1>${t.linkTitle}</h1>
<p class="muted">${t.linkIntro}</p>
<form method="post" action="/authorize" id="link">
<input type="hidden" name="step" value="link">
<input type="hidden" name="t" id="t">
<input type="hidden" name="f" id="f">
<button type="submit">${t.continue}</button>
</form>`, `
const p = new URLSearchParams(location.hash.slice(1));
document.getElementById('t').value = p.get('t') || '';
document.getElementById('f').value = p.get('f') || '';
history.replaceState(null, '', location.pathname);`);
}

export function errorPage(lang: Lang, nonce: string, message: string): string {
  return layout(lang, nonce, 'FlyItalyADSB', `<p>${message}</p>`);
}
