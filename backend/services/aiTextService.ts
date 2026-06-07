import { AiTextsSchema } from '../../packages/schema/src';
import type { AiTexts, JahresabschlussData } from '../../packages/schema/src';

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const OPENAI_RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const OPENAI_RETRY_DELAYS_MS = [1000, 3000, 6000];
const OPENAI_TIMEOUT_MS = 45000;

const MOCK_AI_TEXTS = AiTextsSchema.parse({
  lagebericht: {
    geschaeftsmodell: 'Mock-Text: Die Gesellschaft betreibt ein lokal getestetes Geschaeftsmodell.',
    strategie: 'Mock-Text: Die strategische Ausrichtung bleibt auf stabile Entwicklung und Risikobegrenzung fokussiert.',
    gesamtwirtschaft: 'Mock-Text: Das gesamtwirtschaftliche Umfeld wird fuer Testzwecke neutral beschrieben.',
    geschaeftsverlauf: 'Mock-Text: Der Geschaeftsverlauf verlief im lokalen Test planmaessig.',
    ertragslage: 'Mock-Text: Die Ertragslage wird anhand der eingegebenen Kennzahlen zusammenfassend dargestellt.',
    finanzlage: 'Mock-Text: Die Finanzlage ist im Mock-Modus deterministisch und ohne externe KI bewertet.',
    vermoegenslage: 'Mock-Text: Die Vermoegenslage ergibt sich aus den bereitgestellten Bilanzdaten.',
    nachtragsbericht: 'Mock-Text: Nach dem Bilanzstichtag sind keine wesentlichen Ereignisse im Test bekannt.',
    risiken: 'Mock-Text: Wesentliche Risiken werden fuer den lokalen Exporttest pauschal beschrieben.',
    chancen: 'Mock-Text: Chancen ergeben sich aus operativer Stabilitaet und Marktpositionierung.',
    prognose: 'Mock-Text: Die Prognose wird im Mock-Modus vorsichtig und deterministisch formuliert.',
  },
  anhang: {
    rechtliche_grundlagen: 'Mock-Text: Der Jahresabschluss wurde zu lokalen Testzwecken nach HGB-Grundsaetzen erstellt.',
    bilanzierungsgrundsaetze_intro: 'Mock-Text: Die Bilanzierungs- und Bewertungsmethoden werden stetig angewendet.',
    bewertung_immaterielle: 'Mock-Text: Immaterielle Vermoegensgegenstaende werden planmaessig abgeschrieben.',
    bewertung_sachanlagen: 'Mock-Text: Sachanlagen werden zu Anschaffungskosten abzueglich Abschreibungen bewertet.',
    bewertung_vorraete: 'Mock-Text: Vorraete werden unter Beachtung des Niederstwertprinzips angesetzt.',
    bewertung_forderungen: 'Mock-Text: Forderungen werden zum Nennwert unter Beruecksichtigung erkennbarer Risiken bewertet.',
    bewertung_rueckstellungen: 'Mock-Text: Rueckstellungen decken erkennbare Verpflichtungen angemessen ab.',
    vorraete_kommentar: 'Mock-Text: Die Vorraete entsprechen den im Testdatensatz erfassten Werten.',
    forderungen_kommentar: 'Mock-Text: Die Forderungen werden im Mock-Anhang zusammenfassend erlaeutert.',
    eigenkapital_kommentar: 'Mock-Text: Das Eigenkapital wird gemaess den eingegebenen Bilanzpositionen dargestellt.',
    rueckstellungen_kommentar: 'Mock-Text: Die Rueckstellungen werden nach Art und Umfang testweise beschrieben.',
    verbindlichkeiten_kommentar: 'Mock-Text: Die Verbindlichkeiten entsprechen den lokalen Eingabedaten.',
    umsatz_kommentar: 'Mock-Text: Die Umsatzerloese werden segmentuebergreifend zusammengefasst.',
    personal_kommentar: 'Mock-Text: Der Personalaufwand wird anhand der GuV-Angaben erlaeutert.',
    derivate_kommentar: 'Mock-Text: Derivative Finanzinstrumente werden im lokalen Test nicht gesondert bewertet.',
    nahestehende_kommentar: 'Mock-Text: Geschaeftsvorfaelle mit nahestehenden Personen werden neutral beschrieben.',
    ereignisse_nach_stichtag: 'Mock-Text: Wesentliche Ereignisse nach dem Stichtag sind im Mock-Modus nicht bekannt.',
    bestaetigung_pruefungsurteil: 'Mock-Text: Der Bestaetigungsvermerk wird als Platzhalter fuer den Exporttest gefuehrt.',
  },
});

const lageberichtFields = [
  'geschaeftsmodell',
  'strategie',
  'gesamtwirtschaft',
  'geschaeftsverlauf',
  'ertragslage',
  'finanzlage',
  'vermoegenslage',
  'nachtragsbericht',
  'risiken',
  'chancen',
  'prognose',
] as const;

const anhangFields = [
  'rechtliche_grundlagen',
  'bilanzierungsgrundsaetze_intro',
  'bewertung_immaterielle',
  'bewertung_sachanlagen',
  'bewertung_vorraete',
  'bewertung_forderungen',
  'bewertung_rueckstellungen',
  'vorraete_kommentar',
  'forderungen_kommentar',
  'eigenkapital_kommentar',
  'rueckstellungen_kommentar',
  'verbindlichkeiten_kommentar',
  'umsatz_kommentar',
  'personal_kommentar',
  'derivate_kommentar',
  'nahestehende_kommentar',
  'ereignisse_nach_stichtag',
  'bestaetigung_pruefungsurteil',
] as const;

const stringField = { type: 'string' };
const aiTextsJsonSchema = {
  type: 'object',
  properties: {
    lagebericht: {
      type: 'object',
      properties: Object.fromEntries(lageberichtFields.map(field => [field, stringField])),
      required: [...lageberichtFields],
      additionalProperties: false,
    },
    anhang: {
      type: 'object',
      properties: Object.fromEntries(anhangFields.map(field => [field, stringField])),
      required: [...anhangFields],
      additionalProperties: false,
    },
  },
  required: ['lagebericht', 'anhang'],
  additionalProperties: false,
};

function extractOpenAiOutputText(response: unknown): string {
  const data = response as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown }> }>;
  };

  if (typeof data.output_text === 'string') return data.output_text;

  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === 'string') return content.text;
    }
  }

  throw new Error('OpenAI response did not contain JSON text.');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableOpenAiError(error: unknown): boolean {
  const err = error as { status?: number; name?: string; message?: string };
  const msg = String(err?.message ?? '').toLowerCase();
  return (
    err?.name === 'AbortError' ||
    msg.includes('timeout') ||
    msg.includes('connection timeout') ||
    msg.includes('disconnect/reset') ||
    (typeof err?.status === 'number' && OPENAI_RETRY_STATUSES.has(err.status))
  );
}

async function fetchOpenAiWithRetry(requestBody: unknown, apiKey: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`OpenAI text generation error response (attempt ${attempt}/3):`, errorBody);
        const details = errorBody ? ` ${errorBody.slice(0, 800)}` : '';
        const error = new Error(`OpenAI request failed with status ${response.status}.${details}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
      }

      return response.json();
    } catch (err) {
      lastError = err;
      console.error(`OpenAI text generation failed (attempt ${attempt}/3):`, err);
      if (attempt >= 3 || !isRetryableOpenAiError(err)) break;
      await sleep(OPENAI_RETRY_DELAYS_MS[attempt - 1] ?? 6000);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function generateFallbackTexts(data: JahresabschlussData, reason: unknown): AiTexts {
  const company = data.stammdaten.firmenname || 'die Gesellschaft';
  const year = data.stammdaten.geschaeftsjahr || 'das Geschaeftsjahr';
  const umsatz = Math.round(data.guv.umsatzerloese || 0).toLocaleString('de-DE');
  const jahresueber = Math.round(data.guv.jahresueberschuss || 0).toLocaleString('de-DE');
  const reasonText = reason instanceof Error ? reason.message : String(reason);
  console.error('Fallback AI texts used:', reasonText);

  return AiTextsSchema.parse({
    lagebericht: {
      geschaeftsmodell: `${company} wird auf Grundlage der vorliegenden Eingabedaten beschrieben. Der Text ist als Fallback erstellt und im Rahmen der Abschlussarbeiten fachlich zu pruefen.`,
      strategie: 'Die strategische Ausrichtung ist anhand der Unternehmensangaben zu ergaenzen und fachlich zu plausibilisieren.',
      gesamtwirtschaft: 'Das gesamtwirtschaftliche Umfeld ist fuer den Bericht anhand aktueller Quellen und Unternehmensangaben zu ergaenzen.',
      geschaeftsverlauf: `Der Geschaeftsverlauf ${year} ist anhand der Finanzdaten und wesentlicher operativer Ereignisse zu erlaeutern.`,
      ertragslage: `Die Umsatzerloese beliefen sich auf ${umsatz} TEUR. Der Jahresueberschuss betrug ${jahresueber} TEUR; die Entwicklung ist fachlich zu analysieren.`,
      finanzlage: 'Die Finanzlage ist anhand der Liquiditaet, Finanzierung und wesentlichen Zahlungsstroeme weiter zu erlaeutern.',
      vermoegenslage: 'Die Vermoegenslage ist anhand der Bilanzstruktur und wesentlichen Veraenderungen weiter zu analysieren.',
      nachtragsbericht: 'Ereignisse nach dem Bilanzstichtag sind zu pruefen und bei Bedarf zu ergaenzen.',
      risiken: 'Wesentliche Risiken sind anhand der Unternehmensangaben zu identifizieren und zu beschreiben.',
      chancen: 'Wesentliche Chancen sind anhand der Unternehmensplanung und Marktentwicklung zu ergaenzen.',
      prognose: 'Die Prognose ist auf Grundlage der Planung und erwarteten Entwicklung fachlich zu ergaenzen.',
    },
    anhang: {
      rechtliche_grundlagen: 'Der Jahresabschluss wurde auf Grundlage der vorliegenden Daten erstellt. Dieser Fallback-Text ist fachlich zu pruefen.',
      bilanzierungsgrundsaetze_intro: 'Die Bilanzierungs- und Bewertungsgrundsaetze sind anhand der Unternehmensangaben zu ergaenzen und freizugeben.',
      bewertung_immaterielle: 'Die Bewertung immaterieller Vermoegensgegenstaende ist anhand der angewendeten Bewertungsparameter zu ergaenzen.',
      bewertung_sachanlagen: 'Die Bewertung der Sachanlagen ist anhand der angewendeten Abschreibungsmethoden und Nutzungsdauern zu ergaenzen.',
      bewertung_vorraete: 'Die Bewertung der Vorraete ist anhand der angewendeten Bewertungsmethode und moeglicher Abwertungen zu pruefen.',
      bewertung_forderungen: 'Die Bewertung der Forderungen ist anhand von Restlaufzeiten, Wertberichtigungen und Sicherheiten zu ergaenzen.',
      bewertung_rueckstellungen: 'Die Bewertung der Rueckstellungen ist anhand der Bewertungsmethoden und wesentlichen Einzelposten zu ergaenzen.',
      vorraete_kommentar: 'Die Vorratsentwicklung ist anhand der Tabellenwerte und wesentlicher Einzelposten zu analysieren.',
      forderungen_kommentar: 'Die Forderungsentwicklung ist anhand der Tabellenwerte und wesentlicher Einzelposten zu analysieren.',
      eigenkapital_kommentar: 'Die Eigenkapitalentwicklung ist anhand der Tabellenwerte und Ergebnisverwendung zu analysieren.',
      rueckstellungen_kommentar: 'Die Rueckstellungsentwicklung ist anhand der Tabellenwerte und wesentlicher Einzelposten zu analysieren.',
      verbindlichkeiten_kommentar: 'Die Verbindlichkeitenentwicklung ist anhand der Tabellenwerte und Restlaufzeiten zu analysieren.',
      umsatz_kommentar: 'Die Umsatzentwicklung ist anhand der Tabellenwerte und wesentlicher Treiber zu analysieren.',
      personal_kommentar: 'Der Personalaufwand ist anhand der Tabellenwerte und Personalentwicklung zu analysieren.',
      derivate_kommentar: 'Derivative Finanzinstrumente sind zu pruefen und bei Bedarf zu ergaenzen.',
      nahestehende_kommentar: 'Geschaeftsvorfaelle mit nahestehenden Personen sind zu pruefen und bei Bedarf zu ergaenzen.',
      ereignisse_nach_stichtag: 'Ereignisse nach dem Bilanzstichtag sind zu pruefen und bei Bedarf zu ergaenzen.',
      bestaetigung_pruefungsurteil: '[Der Bestaetigungsvermerk wird nach Abschluss der Pruefung eingefuegt.]',
    },
  });
}

export async function generateTexts(data: JahresabschlussData): Promise<AiTexts> {
  if (process.env['USE_MOCK_AI_TEXTS'] === 'true') {
    return MOCK_AI_TEXTS;
  }

  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    return generateFallbackTexts(data, new Error('OPENAI_API_KEY fehlt auf dem Server.'));
  }

  const { stammdaten, guv, segmente, kennzahlen } = data;
  const umsatz = guv.umsatzerloese || 0;
  const ebit = guv.betriebsergebnis ||
    (umsatz + (guv.bestandsveraenderung || 0) + (guv.eigenleistungen || 0) + (guv.sonstige_ertraege || 0)
     - (guv.material_roh || 0) - (guv.material_dienst || 0)
     - (guv.loehne || 0) - (guv.sozialabgaben || 0)
     - (guv.abschreibungen || 0) - (guv.sonstige_aufwendungen || 0));
  const jahresueber = guv.jahresueberschuss || 0;
  const ebitMarge = umsatz > 0 ? ((ebit / umsatz) * 100).toFixed(1) : '0';
  const vorUmsatz = kennzahlen.vorjahr_umsatz || 0;
  const umsatzWachstum = vorUmsatz > 0 ? (((umsatz - vorUmsatz) / vorUmsatz) * 100).toFixed(1) : '0';

  const prompt = [
    'Erstelle Freitexte fuer einen HGB-Jahresabschluss.',
    'Antworte nur als gueltiges JSON-Objekt entsprechend dem Schema.',
    'Texte auf Deutsch, professioneller HGB-Stil, je 2-3 Saetze pro Feld.',
    `Gesellschaft: ${stammdaten.firmenname}, ${stammdaten.sitz}, ${stammdaten.branche}`,
    `GJ: ${stammdaten.geschaeftsjahr}`,
    `Segmente: ${segmente.map(segment => segment.name).join(', ')}`,
    `Umsatz: ${umsatz.toLocaleString('de-DE')} TEUR, Wachstum: ${umsatzWachstum}%`,
    `EBIT: ${ebit.toLocaleString('de-DE')} TEUR, Marge: ${ebitMarge}%`,
    `Jahresueberschuss: ${jahresueber.toLocaleString('de-DE')} TEUR`,
    `Mitarbeiter: ${kennzahlen.mitarbeiter || 0}`,
    `Abschlusspruefer: ${stammdaten.abschlussprufer || 'KPMG AG'}`,
  ].join('\n');

  const requestBody = {
    model: process.env['OPENAI_MODEL'] || DEFAULT_OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          'Du erstellst deutsche, sachliche und prueferorientierte Freitexte fuer HGB-Jahresabschlussdokumente.',
          'Antworte ausschliesslich als JSON gemaess Schema.',
          'Keine Markdown-Ausgabe, keine zusaetzlichen Felder.',
          'Alle Betragsangaben in TEUR.',
        ].join(' '),
      },
      { role: 'user', content: prompt },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'ai_texts',
        strict: true,
        schema: aiTextsJsonSchema,
      },
    },
    temperature: 0.3,
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractOpenAiOutputText(await fetchOpenAiWithRetry(requestBody, apiKey)));
  } catch (err) {
    return generateFallbackTexts(data, err);
  }

  const validated = AiTextsSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn('OpenAI response schema mismatch - using defaults for missing fields');
    return AiTextsSchema.parse(parsed ?? {});
  }

  return validated.data;
}
