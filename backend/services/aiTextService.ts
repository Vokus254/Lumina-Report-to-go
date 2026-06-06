import Anthropic from '@anthropic-ai/sdk';
import { AiTextsSchema } from '@nexus/schema';
import type { AiTexts, JahresabschlussData } from '@nexus/schema';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

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
    bewertung_sachanlagen: 'Mock-Text: Sachanlagen werden zu Anschaffungskosten abzüglich Abschreibungen bewertet.',
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

export async function generateTexts(data: JahresabschlussData): Promise<AiTexts> {
  if (process.env['USE_MOCK_AI_TEXTS'] === 'true') {
    return MOCK_AI_TEXTS;
  }

  const { stammdaten, bilanz, guv, segmente, kennzahlen } = data;

  const umsatz      = guv.umsatzerloese || 0;
  const ebit        = guv.betriebsergebnis ||
    (umsatz + (guv.bestandsveraenderung || 0) + (guv.eigenleistungen || 0) + (guv.sonstige_ertraege || 0)
     - (guv.material_roh || 0) - (guv.material_dienst || 0)
     - (guv.loehne || 0) - (guv.sozialabgaben || 0)
     - (guv.abschreibungen || 0) - (guv.sonstige_aufwendungen || 0));
  const jahresueber = guv.jahresueberschuss || 0;
  const ebitMarge   = umsatz > 0 ? ((ebit / umsatz) * 100).toFixed(1) : '0';
  const vorUmsatz   = kennzahlen.vorjahr_umsatz || 0;
  const umsatzWachstum = vorUmsatz > 0 ? (((umsatz - vorUmsatz) / vorUmsatz) * 100).toFixed(1) : '0';

  const prompt = `Du bist Wirtschaftsprüfer. Erstelle Freitexte für einen HGB-Jahresabschluss.
Antworte NUR als gültiges JSON-Objekt, ohne Markdown, ohne Präambel.
Texte auf Deutsch, professioneller HGB-Stil, je 2-3 Sätze pro Feld.

Gesellschaft: ${stammdaten.firmenname}, ${stammdaten.sitz}, ${stammdaten.branche}
GJ: ${stammdaten.geschaeftsjahr}
Segmente: ${segmente.map(s => s.name).join(', ')}
Umsatz: ${umsatz.toLocaleString('de-DE')} TEUR, Wachstum: ${umsatzWachstum}%
EBIT: ${ebit.toLocaleString('de-DE')} TEUR, Marge: ${ebitMarge}%
Jahresüberschuss: ${jahresueber.toLocaleString('de-DE')} TEUR
Mitarbeiter: ${kennzahlen.mitarbeiter || 0}
Abschlussprufer: ${stammdaten.abschlussprufer || 'KPMG AG'}

Erstelle exakt dieses JSON (keine anderen Felder, keine Kommentare):

{"lagebericht":{"geschaeftsmodell":"...","strategie":"...","gesamtwirtschaft":"...","geschaeftsverlauf":"...","ertragslage":"...","finanzlage":"...","vermoegenslage":"...","nachtragsbericht":"...","risiken":"...","chancen":"...","prognose":"..."},"anhang":{"rechtliche_grundlagen":"...","bilanzierungsgrundsaetze_intro":"...","bewertung_immaterielle":"...","bewertung_sachanlagen":"...","bewertung_vorraete":"...","bewertung_forderungen":"...","bewertung_rueckstellungen":"...","vorraete_kommentar":"...","forderungen_kommentar":"...","eigenkapital_kommentar":"...","rueckstellungen_kommentar":"...","verbindlichkeiten_kommentar":"...","umsatz_kommentar":"...","personal_kommentar":"...","derivate_kommentar":"...","nahestehende_kommentar":"...","ereignisse_nach_stichtag":"...","bestaetigung_pruefungsurteil":"..."}}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw   = message.content.find(b => b.type === 'text')?.text || '{}';
  const clean = raw.replace(/```json[\s\S]*?```|```[\s\S]*?```/g, '').trim();

  // ── Zod-Validierung — AI-Output wird gegen AiTextsSchema geparst ──
  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch (parseErr) {
    // Salvage truncated JSON
    console.warn('JSON truncated, attempting salvage. Stop reason:', message.stop_reason);
    const lastComplete = clean.lastIndexOf('":"');
    if (lastComplete > 0) {
      const closeQuote = clean.indexOf('"', lastComplete + 3);
      if (closeQuote > 0) {
        let partial = clean.slice(0, closeQuote + 1);
        const opens  = (partial.match(/\{/g) || []).length;
        const closes = (partial.match(/\}/g) || []).length;
        partial += '}'.repeat(Math.max(0, opens - closes));
        try {
          parsed = JSON.parse(partial);
          console.warn('JSON salvage succeeded');
        } catch {
          console.error('Raw AI output (first 600 chars):\n', raw.slice(0, 600));
          throw new Error('AI returned invalid JSON: ' + String(parseErr));
        }
      }
    }
    if (!parsed) throw new Error('AI returned invalid JSON: ' + String(parseErr));
  }

  // Schema-Validierung: fehlende Felder werden mit leerem String aufgefüllt
  const validated = AiTextsSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn('AI response schema mismatch — using defaults for missing fields');
    // Fallback: parse with defaults (AiTextsSchema fills missing fields with "")
    return AiTextsSchema.parse(parsed ?? {});
  }

  return validated.data;
}
