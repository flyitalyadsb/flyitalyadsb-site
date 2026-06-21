// Localized copy + schema.org structured data for the programmatic airport pages.
// Shared by the IT and EN page variants so wording stays in one place.

import type { Airport } from '../data/airports';
import { fullName, RADIUS_KM } from '../data/airports';

export type Lang = 'it' | 'en';

const SITE = 'https://flyitalyadsb.com';

/** Canonical URL of an airport page (trailing slash = directory build format). */
export function airportUrl(a: Airport, lang: Lang): string {
  return lang === 'en'
    ? `${SITE}/en/aeroporti/${a.slug}/`
    : `${SITE}/aeroporti/${a.slug}/`;
}

export function pageTitle(a: Airport, lang: Lang): string {
  return lang === 'en'
    ? `Live flights over ${fullName(a)} (${a.iata})`
    : `Voli in tempo reale su ${fullName(a)} (${a.iata})`;
}

export function metaDescription(a: Airport, lang: Lang): string {
  return lang === 'en'
    ? `Track aircraft over ${fullName(a)} (${a.iata}/${a.icao}) live on the FlyItalyADSB map: real-time ADS-B and MLAT coverage within ${RADIUS_KM} km of ${a.city}, ${a.region}.`
    : `Segui in tempo reale gli aerei su ${fullName(a)} (${a.iata}/${a.icao}) sulla mappa FlyItalyADSB: copertura ADS-B e MLAT live entro ${RADIUS_KM} km da ${a.city}, ${a.region}.`;
}

export interface Faq {
  q: string;
  a: string;
}

export function faqs(a: Airport, lang: Lang): Faq[] {
  const name = fullName(a);
  if (lang === 'en') {
    return [
      {
        q: `How can I see live flights over ${name}?`,
        a: `Open the FlyItalyADSB live map centred on ${a.city}: it shows every aircraft picked up via ADS-B and MLAT within about ${RADIUS_KM} km of ${a.iata}, refreshed every few seconds.`,
      },
      {
        q: `Does FlyItalyADSB also track military aircraft around ${a.city}?`,
        a: `Yes. Thanks to multilateration (MLAT) — the only such service active in Italy — the network reconstructs the position of aircraft without full ADS-B too, including military and state flights, whenever they are received by feeders in the area.`,
      },
      {
        q: `What are the codes for ${name}?`,
        a: `${name} has IATA code ${a.iata} and ICAO code ${a.icao}. It lies in ${a.region}, at coordinates ${a.lat}, ${a.lon}.`,
      },
      {
        q: `Is the flight data free and open?`,
        a: `Yes. FlyItalyADSB is a non-profit project and the data is published under the open CC BY-SA 4.0 licence.`,
      },
    ];
  }
  return [
    {
      q: `Come posso vedere gli aerei in tempo reale su ${name}?`,
      a: `Apri la mappa live di FlyItalyADSB centrata su ${a.city}: mostra tutti gli aeromobili captati via ADS-B e MLAT entro circa ${RADIUS_KM} km da ${a.iata}, aggiornati ogni pochi secondi.`,
    },
    {
      q: `FlyItalyADSB traccia anche gli aerei militari intorno a ${a.city}?`,
      a: `Sì. Grazie alla multilaterazione (MLAT) — unica attiva in Italia — la rete ricostruisce la posizione anche dei velivoli senza ADS-B completo, inclusi mezzi militari e di Stato, quando ricevuti dai feeder dell'area.`,
    },
    {
      q: `Quali sono i codici dell'aeroporto di ${a.city}?`,
      a: `${name} ha codice IATA ${a.iata} e codice ICAO ${a.icao}. Si trova in ${a.region}, alle coordinate ${a.lat}, ${a.lon}.`,
    },
    {
      q: `I dati di volo sono gratuiti e aperti?`,
      a: `Sì. FlyItalyADSB è un progetto no-profit e i dati sono pubblicati con licenza aperta CC BY-SA 4.0.`,
    },
  ];
}

export function airportJsonLd(a: Airport, lang: Lang): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Airport',
    name: fullName(a),
    iataCode: a.iata,
    icaoCode: a.icao,
    url: airportUrl(a, lang),
    address: {
      '@type': 'PostalAddress',
      addressLocality: a.city,
      addressRegion: a.region,
      addressCountry: 'IT',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: a.lat,
      longitude: a.lon,
    },
  };
}

export function faqJsonLd(a: Airport, lang: Lang): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs(a, lang).map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function breadcrumbJsonLd(a: Airport, lang: Lang): Record<string, unknown> {
  const home = lang === 'en' ? `${SITE}/en/` : `${SITE}/`;
  const index = lang === 'en' ? `${SITE}/en/aeroporti/` : `${SITE}/aeroporti/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: lang === 'en' ? 'Home' : 'Home', item: home },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Airports' : 'Aeroporti', item: index },
      { '@type': 'ListItem', position: 3, name: fullName(a), item: airportUrl(a, lang) },
    ],
  };
}
