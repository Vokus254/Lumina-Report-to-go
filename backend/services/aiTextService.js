const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

async function generateTexts(data) {
  const { stammdaten, bilanz, guv, segmente, kennzahlen } = data;

  const umsatz      = guv.umsatzerloese || 0;
  const ebit        = guv.betriebsergebnis ||
    (umsatz + (guv.bestandsveraenderung||0) + (guv.eigenleistungen||0) + (guv.sonstige_ertraege||0)
     - (guv.material_roh||0) - (guv.material_dienst||0)
     - (guv.loehne||0) - (guv.sozialabgaben||0)
     - (guv.abschreibungen||0) - (guv.sonstige_aufwendungen||0));
  const jahresueber = guv.jahresueberschuss || 0;
  const ebitMarge   = umsatz > 0 ? ((ebit / umsatz) * 100).toFixed(1) : 0;
  const vorUmsatz   = kennzahlen.vorjahr_umsatz || 0;
  const umsatzWachstum = vorUmsatz > 0 ? (((umsatz - vorUmsatz) / vorUmsatz) * 100).toFixed(1) : 0;
  const bsSumme     = bilanz.bilanzsumme || 0;
  const ek          = bilanz.eigenkapital_gesamt || 0;
  const ekQuote     = bsSumme > 0 ? ((ek / bsSumme) * 100).toFixed(1) : 0;

  // Shorter prompt to stay within token budget
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

  const raw = message.content.find(b => b.type === 'text')?.text || '{}';
  const clean = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Attempt to salvage truncated JSON by finding the last complete string value
    console.warn('JSON truncated, attempting salvage. Stop reason:', message.stop_reason);
    try {
      // Find last fully closed string value (ends with ": "...")
      const lastComplete = clean.lastIndexOf('":"');
      if (lastComplete > 0) {
        // Find the closing quote after that position
        const closeQuote = clean.indexOf('"', lastComplete + 3);
        if (closeQuote > 0) {
          let partial = clean.slice(0, closeQuote + 1);
          // Count open braces and close them
          const opens  = (partial.match(/{/g) || []).length;
          const closes = (partial.match(/}/g) || []).length;
          partial += '}'.repeat(Math.max(0, opens - closes));
          const result = JSON.parse(partial);
          console.warn('JSON salvage succeeded');
          return result;
        }
      }
      throw new Error('Could not salvage');
    } catch {
      console.error('Raw AI output (first 600 chars):\n', raw.slice(0, 600));
      throw new Error('AI returned invalid JSON: ' + e.message);
    }
  }
}

module.exports = { generateTexts };
