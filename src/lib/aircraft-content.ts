// Localized copy + schema.org structured data for the programmatic aircraft-type
// pages. Shared by the IT and EN variants.

import type { AircraftType, CategoryKey } from '../data/aircraftTypes';
import { fullName } from '../data/aircraftTypes';

export type Lang = 'it' | 'en';

const SITE = 'https://flyitalyadsb.com';

const CATEGORY_LABELS: Record<CategoryKey, { it: string; en: string }> = {
  'airliner-narrow': { it: 'Jet di linea narrow-body', en: 'Narrow-body airliner' },
  'airliner-wide': { it: 'Jet di linea wide-body', en: 'Wide-body airliner' },
  regional: { it: 'Jet regionale', en: 'Regional jet' },
  turboprop: { it: 'Turboelica', en: 'Turboprop' },
  bizjet: { it: 'Jet executive', en: 'Business jet' },
  ga: { it: 'Aviazione generale', en: 'General aviation' },
  military: { it: 'Militare', en: 'Military' },
};

export function categoryLabel(c: CategoryKey, lang: Lang): string {
  return CATEGORY_LABELS[c][lang];
}

/** Canonical URL of a type page (trailing slash = directory build format). */
export function typeUrl(t: AircraftType, lang: Lang): string {
  return lang === 'en'
    ? `${SITE}/en/aeromobili/${t.slug}/`
    : `${SITE}/aeromobili/${t.slug}/`;
}

export function pageTitle(t: AircraftType, lang: Lang): string {
  return lang === 'en'
    ? `${fullName(t)} (${t.code}) — aircraft flying now`
    : `${fullName(t)} (${t.code}) — aerei in volo ora`;
}

export function metaDescription(t: AircraftType, lang: Lang): string {
  return lang === 'en'
    ? `The ${fullName(t)} (ICAO type ${t.code}): specs, engines, capacity, and how many FlyItalyADSB is tracking right now via ADS-B and MLAT over Italy.`
    : `Il ${fullName(t)} (codice ICAO ${t.code}): caratteristiche, motori, capacità e quanti ne sta tracciando ora FlyItalyADSB via ADS-B e MLAT sull'Italia.`;
}

export interface Faq {
  q: string;
  a: string;
}

export function faqs(t: AircraftType, lang: Lang): Faq[] {
  const name = fullName(t);
  if (lang === 'en') {
    const specs =
      `The ${name} is powered by ${t.engines}` +
      (t.seats ? ` and typically carries ${t.seats} passengers.` : '.') +
      ` It first flew in ${t.firstFlight}.`;
    return [
      {
        q: `How many ${name} are flying right now?`,
        a: `The live count at the top of this page filters the FlyItalyADSB feed by the ICAO type code ${t.code}, so it shows how many ${t.model} are currently within the network's coverage. It changes minute by minute.`,
      },
      { q: `What is the ${t.code} code?`, a: `${t.code} is the ICAO type designator of the ${name} — the code that identifies the model in the ADS-B and Mode-S messages received by the network.` },
      { q: `How many engines and seats does the ${name} have?`, a: specs },
      { q: `Is the flight data free and open?`, a: `Yes. FlyItalyADSB is a non-profit project and the data is published under the open CC BY-SA 4.0 licence.` },
    ];
  }
  const specs =
    `Il ${name} è equipaggiato con ${t.engines}` +
    (t.seats ? ` e trasporta tipicamente ${t.seats} passeggeri.` : '.') +
    ` Ha volato per la prima volta nel ${t.firstFlight}.`;
  return [
    {
      q: `Quanti ${name} ci sono in volo ora?`,
      a: `Il contatore in cima a questa pagina filtra il feed live di FlyItalyADSB per il codice tipo ICAO ${t.code}, quindi mostra quanti ${t.model} si trovano ora nella copertura della rete. Cambia di minuto in minuto.`,
    },
    { q: `Cos'è il codice ${t.code}?`, a: `${t.code} è il designatore di tipo ICAO del ${name}: è il codice che identifica il modello nei messaggi ADS-B e Mode-S ricevuti dalla rete.` },
    { q: `Quanti motori e posti ha il ${name}?`, a: specs },
    { q: `I dati di volo sono gratuiti e aperti?`, a: `Sì. FlyItalyADSB è un progetto no-profit e i dati sono pubblicati con licenza aperta CC BY-SA 4.0.` },
  ];
}

export function faqJsonLd(t: AircraftType, lang: Lang): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs(t, lang).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbJsonLd(t: AircraftType, lang: Lang): Record<string, unknown> {
  const home = lang === 'en' ? `${SITE}/en/` : `${SITE}/`;
  const index = lang === 'en' ? `${SITE}/en/aeromobili/` : `${SITE}/aeromobili/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: home },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Aircraft' : 'Aeromobili', item: index },
      { '@type': 'ListItem', position: 3, name: `${fullName(t)} (${t.code})`, item: typeUrl(t, lang) },
    ],
  };
}
