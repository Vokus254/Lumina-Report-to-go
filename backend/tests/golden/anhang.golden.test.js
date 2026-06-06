/**
 * Golden-File-Test: Anhang Renderer
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';

const require = createRequire(import.meta.url);
const { renderAnhang } = require('../../dist/renderers/anhangRenderer');
const { SECTION_PROMPT_RULES } = require('../../dist/services/openAiSectionTextService');
const { JahresabschlussSchema } = require('@nexus/schema');

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

let docxBuffer;
let documentXml;

beforeAll(async () => {
  const baseTestData = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'testData.json'), 'utf8'));
  const testData = {
    ...baseTestData,
    reportTexts: {
      'anhang.bewertungsgrundsaetze': {
        sectionId: 'anhang.bewertungsgrundsaetze',
        status: 'transferred',
        text: 'Uebernommener Bewertungsgrundsatztext bestaetigt. Uebernommener Bewertungsgrundsatztext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Bewertungsgrundsatztext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Bewertungsgrundsatztext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
      'anhang.bewertung.vorraete': {
        sectionId: 'anhang.bewertung.vorraete',
        status: 'transferred',
        text: 'Uebernommener A2-Vorratsbewertungstext bestaetigt. Uebernommener A2-Vorratsbewertungstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener A2-Vorratsbewertungstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener A2-Vorratsbewertungstext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.immaterielle_vermoegenswerte': {
        sectionId: 'anhang.immaterielle_vermoegenswerte',
        status: 'transferred',
        text: 'Uebernommener Immateriellentext bestaetigt. Uebernommener Immateriellentext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Immateriellentext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Immateriellentext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.sachanlagen': {
        sectionId: 'anhang.sachanlagen',
        status: 'transferred',
        text: 'Uebernommener Sachanlagentext bestaetigt. Uebernommener Sachanlagentext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Sachanlagentext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Sachanlagentext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.finanzanlagen': {
        sectionId: 'anhang.finanzanlagen',
        status: 'transferred',
        text: 'Uebernommener Finanzanlagentext bestaetigt. Uebernommener Finanzanlagentext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Finanzanlagentext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Finanzanlagentext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
      'anhang.wertpapiere_uv': {
        sectionId: 'anhang.wertpapiere_uv',
        status: 'transferred',
        text: 'Uebernommener Wertpapiertext bestaetigt. Uebernommener Wertpapiertext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Wertpapiertext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Wertpapiertext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.liquide_mittel': {
        sectionId: 'anhang.liquide_mittel',
        status: 'transferred',
        text: 'Uebernommener Liquiditaetstext bestaetigt. Uebernommener Liquiditaetstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Liquiditaetstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Liquiditaetstext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.vorraete': {
        sectionId: 'anhang.vorraete',
        status: 'transferred',
        text: 'Uebernommener Vorratstext bestaetigt. Uebernommener Vorratstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Vorratstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Vorratstext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.forderungen': {
        sectionId: 'anhang.forderungen',
        status: 'transferred',
        text: 'Uebernommener Forderungstext bestaetigt. Uebernommener Forderungstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Forderungstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Forderungstext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
      'anhang.eigenkapital': {
        sectionId: 'anhang.eigenkapital',
        status: 'transferred',
        text: 'Uebernommener Eigenkapitaltext bestaetigt. Uebernommener Eigenkapitaltext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Eigenkapitaltext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Eigenkapitaltext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.rueckstellungen': {
        sectionId: 'anhang.rueckstellungen',
        status: 'transferred',
        text: 'Uebernommener Rueckstellungstext bestaetigt. Uebernommener Rueckstellungstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Rueckstellungstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Rueckstellungstext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
      'anhang.verbindlichkeiten': {
        sectionId: 'anhang.verbindlichkeiten',
        status: 'transferred',
        text: 'Die Verbindlichkeiten betragen 45.199 TEUR nach 50.247 TEUR im Vorjahr und verminderten sich um 5.047 TEUR bzw. 10,0 %. Uebernommener Verbindlichkeitentext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Die Verbindlichkeiten betragen 45.199 TEUR nach 50.247 TEUR im Vorjahr und verminderten sich um 5.047 TEUR bzw. 10,0 %.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Verbindlichkeitentext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.guv.umsatzerloese': {
        sectionId: 'anhang.guv.umsatzerloese',
        status: 'transferred',
        text: 'Uebernommener Umsatztext bestaetigt. Uebernommener Umsatztext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Umsatztext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Umsatztext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.guv.materialaufwand': {
        sectionId: 'anhang.guv.materialaufwand',
        status: 'transferred',
        text: 'Uebernommener Materialtext bestaetigt. Uebernommener Materialtext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Materialtext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Materialtext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
      'anhang.guv.personalaufwand': {
        sectionId: 'anhang.guv.personalaufwand',
        status: 'transferred',
        text: 'Uebernommener Personaltext bestaetigt. Uebernommener Personaltext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Personaltext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Personaltext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.guv.abschreibungen': {
        sectionId: 'anhang.guv.abschreibungen',
        status: 'transferred',
        text: 'Uebernommener Abschreibungstext bestaetigt. Uebernommener Abschreibungstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener Abschreibungstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener Abschreibungstext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.guv.sonstige_betriebliche_ertraege': {
        sectionId: 'anhang.guv.sonstige_betriebliche_ertraege',
        status: 'transferred',
        text: 'Uebernommener sonstiger Ertragstext bestaetigt. Uebernommener sonstiger Ertragstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener sonstiger Ertragstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener sonstiger Ertragstext unbestaetigt.', source: 'usual_text_block', requiresConfirmation: true },
        ],
      },
      'anhang.guv.sonstige_betriebliche_aufwendungen': {
        sectionId: 'anhang.guv.sonstige_betriebliche_aufwendungen',
        status: 'transferred',
        text: 'Uebernommener sonstiger Aufwandstext bestaetigt. Uebernommener sonstiger Aufwandstext unbestaetigt.',
        paragraphs: [
          { type: 'confirmed', text: 'Uebernommener sonstiger Aufwandstext bestaetigt.', source: 'facts', requiresConfirmation: false },
          { type: 'unconfirmed', text: 'Uebernommener sonstiger Aufwandstext unbestaetigt.', source: 'missing_input_notice', requiresConfirmation: true },
        ],
      },
    },
  };
  const aiTexts  = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'aiTexts.json'),  'utf8'));
  const sectionTexts = {
    'anhang.immaterielle_vermoegenswerte': {
      sectionId: 'anhang.immaterielle_vermoegenswerte',
      status: 'draft',
      text: 'Alter SectionText Immaterielle darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Immaterielle darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.sachanlagen': {
      sectionId: 'anhang.sachanlagen',
      status: 'draft',
      text: 'Alter SectionText Sachanlagen darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Sachanlagen darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.finanzanlagen': {
      sectionId: 'anhang.finanzanlagen',
      status: 'draft',
      text: 'Alter SectionText Finanzanlagen darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Finanzanlagen darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.wertpapiere_uv': {
      sectionId: 'anhang.wertpapiere_uv',
      status: 'draft',
      text: 'Alter SectionText Wertpapiere darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Wertpapiere darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.liquide_mittel': {
      sectionId: 'anhang.liquide_mittel',
      status: 'draft',
      text: 'Alter SectionText Liquide Mittel darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Liquide Mittel darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.vorraete': {
      sectionId: 'anhang.vorraete',
      status: 'draft',
      text: 'Test-Abschnitt Vorräte bestätigt. Test-Abschnitt Vorräte unbestätigt.',
      paragraphs: [
        { type: 'confirmed', text: 'Test-Abschnitt Vorräte bestätigt.', source: 'facts', requiresConfirmation: false },
        { type: 'unconfirmed', text: 'Test-Abschnitt Vorräte unbestätigt.', source: 'missing_input_notice', requiresConfirmation: true },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.forderungen': {
      sectionId: 'anhang.forderungen',
      status: 'draft',
      text: 'Test-Abschnitt Forderungen bestätigt.',
      paragraphs: [
        { type: 'confirmed', text: 'Test-Abschnitt Forderungen bestätigt.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.verbindlichkeiten': {
      sectionId: 'anhang.verbindlichkeiten',
      status: 'draft',
      text: 'Alter SectionText Verbindlichkeiten darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Verbindlichkeiten darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.umsatzerloese': {
      sectionId: 'anhang.guv.umsatzerloese',
      status: 'draft',
      text: 'Alter SectionText Umsatz darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Umsatz darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.materialaufwand': {
      sectionId: 'anhang.guv.materialaufwand',
      status: 'draft',
      text: 'Alter SectionText Material darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Material darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.personalaufwand': {
      sectionId: 'anhang.guv.personalaufwand',
      status: 'draft',
      text: 'Alter SectionText Personal darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Personal darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.abschreibungen': {
      sectionId: 'anhang.guv.abschreibungen',
      status: 'draft',
      text: 'Alter SectionText Abschreibungen darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText Abschreibungen darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.sonstige_betriebliche_ertraege': {
      sectionId: 'anhang.guv.sonstige_betriebliche_ertraege',
      status: 'draft',
      text: 'Alter SectionText sonstige Ertraege darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText sonstige Ertraege darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
    'anhang.guv.sonstige_betriebliche_aufwendungen': {
      sectionId: 'anhang.guv.sonstige_betriebliche_aufwendungen',
      status: 'draft',
      text: 'Alter SectionText sonstige Aufwendungen darf nicht erscheinen.',
      paragraphs: [
        { type: 'confirmed', text: 'Alter SectionText sonstige Aufwendungen darf nicht erscheinen.', source: 'facts', requiresConfirmation: false },
      ],
      warnings: [],
      missingInputs: [],
      reviewQuestions: [],
      usedFacts: ['currentTotal'],
    },
  };
  const parsedData = JahresabschlussSchema.parse(testData);
  const preservedKennzahlen = Object.fromEntries(
    ['vj_material_roh', 'vj_material_dienst', 'vj_sonstige_aufwend', 'vj_sonstige_aufwendungen']
      .filter(key => typeof testData.kennzahlen[key] === 'number')
      .map(key => [key, testData.kennzahlen[key]])
  );
  const renderData = {
    ...parsedData,
    kennzahlen: { ...parsedData.kennzahlen, ...preservedKennzahlen },
    reportTexts: testData.reportTexts,
  };
  docxBuffer = await renderAnhang(renderData, aiTexts, sectionTexts);

  const zip   = new AdmZip(docxBuffer);
  const entry = zip.getEntry('word/document.xml');
  if (!entry) throw new Error('word/document.xml nicht im DOCX gefunden');
  documentXml = entry.getData().toString('utf8');
}, 30000);

describe('Anhang DOCX Buffer', () => {
  it('ist nicht leer', () => expect(docxBuffer.length).toBeGreaterThan(5_000));
  it('ist valides ZIP', () => {
    expect(docxBuffer[0]).toBe(0x50);
    expect(docxBuffer[1]).toBe(0x4B);
  });
  it('Groesse in plausiblem Bereich (10k–30k Bytes)', () => {
    expect(docxBuffer.length).toBeGreaterThan(10_000);
    expect(docxBuffer.length).toBeLessThan(30_000);
  });
});

describe('Anhang DOCX Encoding', () => {
  it('enthaelt echte UTF-8-Umlaute und Paragraphenzeichen', () => {
    [
      'für',
      'Geschäftsjahr',
      'Gemäß § 284 ff. HGB',
      'Bilanzierungs- und Bewertungsgrundsätze',
      'Immaterielle Vermögenswerte',
      'Vorräte',
      'Rückstellungen',
      'Umsatzerlöse',
      'Abschlussprüferhonorar',
      'Bestätigungsvermerk des Abschlussprüfers',
    ].forEach(value => expect(documentXml).toContain(value));
  });

  it('enthaelt keine Mojibake-Muster', () => {
    ['Ã', 'Â', 'â', 'Äœ', 'fÃ', 'Â§', 'VermÃ', 'RÃ¼', 'Ã¤', 'Ã¶', 'Ã¼']
      .forEach(value => expect(documentXml).not.toContain(value));
  });
});

describe('Anhang Vorraete (B.2) – VJ-Werte', () => {
  it('VJ RHB (5.735)',               () => expect(documentXml).toContain('5.735'));
  it('VJ Unfertige (6.751)',         () => expect(documentXml).toContain('6.751'));
  it('VJ Fertige (138)',             () => expect(documentXml).toContain('138'));
  it('VJ Anzahlungen (7.394)',       () => expect(documentXml).toContain('7.394'));
  it('VJ Vorraete Summe (20.018)',   () => expect(documentXml).toContain('20.018'));
});

describe('Anhang KI-Abschnittstexte', () => {
  it('gibt A.2 aus einzelnen Bewertungsabschnitten aus', () => {
    expect(documentXml).toContain('1. Allgemeine');
    expect(documentXml).toContain('2. Immaterielle');
    expect(documentXml).toContain('5. Vorr');
  });
  it('SECTION_PROMPT_RULES enthalten Bewertungsabschnitte', () => {
    expect(SECTION_PROMPT_RULES).toHaveProperty('anhang.bewertung.allgemeine_grundlagen');
    expect(SECTION_PROMPT_RULES).toHaveProperty('anhang.bewertung.vorraete');
    expect(SECTION_PROMPT_RULES).toHaveProperty('anhang.bewertung.jahresueberschuss');
  });
  it('nutzt Mustertext, wenn kein Bewertungs-reportText vorhanden ist', () => {
    expect(documentXml).toContain('Sachanlagen werden zu Anschaffungs- oder Herstellungskosten');
  });
  it('ueberschreibt Mustertext je Bewertungsposition durch reportText', () => {
    expect(documentXml).toContain('Uebernommener A2-Vorratsbewertungstext bestaetigt.');
    expect(documentXml).not.toContain('Bestandsrisiken aus Lagerdauer');
  });
  it('enthaelt kein falsches Geschaeftsjahr 2026 in A.2', () => expect(documentXml).not.toContain('31.12.2026'));
  it('nutzt Normverweise mit Paragraphenzeichen statt ausgeschriebenem Paragraph', () => {
    expect(documentXml).toContain('§ 266 HGB');
    expect(documentXml).not.toContain('Paragraph 266 HGB');
  });
  it('enthaelt uebernommenen Immateriellentext', () => expect(documentXml).toContain('Uebernommener Immateriellentext bestaetigt.'));
  it('enthaelt uebernommenen Sachanlagentext', () => expect(documentXml).toContain('Uebernommener Sachanlagentext bestaetigt.'));
  it('enthaelt uebernommenen Finanzanlagentext', () => expect(documentXml).toContain('Uebernommener Finanzanlagentext bestaetigt.'));
  it('enthaelt uebernommenen Wertpapiertext', () => expect(documentXml).toContain('Uebernommener Wertpapiertext bestaetigt.'));
  it('enthaelt uebernommenen Liquiditaetstext', () => expect(documentXml).toContain('Uebernommener Liquiditaetstext bestaetigt.'));
  it('enthaelt uebernommenen Vorratstext', () => expect(documentXml).toContain('Uebernommener Vorratstext bestaetigt.'));
  it('enthaelt uebernommenen Forderungstext', () => expect(documentXml).toContain('Uebernommener Forderungstext bestaetigt.'));
  it('enthaelt uebernommenen Verbindlichkeitentext', () => expect(documentXml).toContain('Die Verbindlichkeiten betragen 45.199 TEUR nach 50.247 TEUR'));
  it('enthaelt uebernommenen Umsatztext', () => expect(documentXml).toContain('Uebernommener Umsatztext bestaetigt.'));
  it('enthaelt uebernommenen Materialtext', () => expect(documentXml).toContain('Uebernommener Materialtext bestaetigt.'));
  it('enthaelt uebernommenen Personaltext', () => expect(documentXml).toContain('Uebernommener Personaltext bestaetigt.'));
  it('enthaelt uebernommenen Abschreibungstext', () => expect(documentXml).toContain('Uebernommener Abschreibungstext bestaetigt.'));
  it('enthaelt uebernommenen sonstigen Ertragstext', () => expect(documentXml).toContain('Uebernommener sonstiger Ertragstext bestaetigt.'));
  it('enthaelt uebernommenen sonstigen Aufwandstext', () => expect(documentXml).toContain('Uebernommener sonstiger Aufwandstext bestaetigt.'));
  it('markiert unconfirmed paragraphs gelb', () => expect(documentXml).toContain('w:highlight'));
  it('enthaelt uebernommenen Eigenkapitaltext', () => expect(documentXml).toContain('Uebernommener Eigenkapitaltext bestaetigt.'));
  it('enthaelt uebernommenen Rueckstellungstext', () => expect(documentXml).toContain('Uebernommener Rueckstellungstext bestaetigt.'));
  it('ersetzt alte harte A.2-Standardformulierungen bei reportText', () => {
    expect(documentXml).not.toContain('Nutzungsdauer von drei bis fuenf Jahren');
    expect(documentXml).not.toContain('Pauschalwertberichtigung');
    expect(documentXml).not.toContain('AfA-Tabellen');
    expect(documentXml).not.toContain('Geringwertige Wirtschaftsgueter bis 800 EUR');
  });
  it('enthaelt keine sichtbaren gelb-Tags', () => {
    expect(documentXml).not.toContain('[gelb]');
    expect(documentXml).not.toContain('[/gelb]');
  });
  it('enthaelt keine unbestaetigte Abwertungsaussage im Vorratstext', () => {
    expect(documentXml).not.toContain('ohne dass Abwertungen vorgenommen wurden');
  });
  it('ersetzt den automatisch formulierten Bestaetigungsvermerk durch einen Platzhalter', () => {
    expect(documentXml).toContain('[Der Bestätigungsvermerk wird nach Abschluss der Prüfung eingefügt.]');
    expect(documentXml).not.toContain('Prüfungsurteil');
    expect(documentXml).not.toContain('Wir haben den Jahresabschluss');
  });
  it('ueberschreibt alte Section-Texte bei Vorraeten, Forderungen und Verbindlichkeiten', () => {
    expect(documentXml).not.toContain('Alter SectionText Immaterielle');
    expect(documentXml).not.toContain('Alter SectionText Sachanlagen');
    expect(documentXml).not.toContain('Alter SectionText Finanzanlagen');
    expect(documentXml).not.toContain('Alter SectionText Wertpapiere');
    expect(documentXml).not.toContain('Alter SectionText Liquide Mittel');
    expect(documentXml).not.toContain('Test-Abschnitt Vorr');
    expect(documentXml).not.toContain('Test-Abschnitt Forderungen');
    expect(documentXml).not.toContain('Alter SectionText Verbindlichkeiten');
    expect(documentXml).not.toContain('Alter SectionText Umsatz');
    expect(documentXml).not.toContain('Alter SectionText Material');
    expect(documentXml).not.toContain('Alter SectionText Personal');
    expect(documentXml).not.toContain('Alter SectionText Abschreibungen');
    expect(documentXml).not.toContain('Alter SectionText sonstige Ertraege');
    expect(documentXml).not.toContain('Alter SectionText sonstige Aufwendungen');
  });
  it('ueberschreibt alte Standardtexte bei Vorraeten, Forderungen und Verbindlichkeiten', () => {
    expect(documentXml).not.toContain('Der Bestand an Vorr');
    expect(documentXml).not.toContain('Fremdwaehrungsforderungen');
    expect(documentXml).not.toContain('bankuebliche Sicherheiten');
    expect(documentXml).not.toContain('Alle Segmente trugen zum Wachstum bei');
    expect(documentXml).not.toContain('Die durchschnittliche Mitarbeiterzahl betrug 345');
  });
  it('ersetzt alte kritische Standardtexte bei Eigenkapital und Rueckstellungen', () => {
    expect(documentXml).not.toContain('durch den Jahres');
    expect(documentXml).not.toContain('Jahresueberschuss von 0 TEUR');
    expect(documentXml).not.toContain('gezeichnetes Kapital unver');
    expect(documentXml).not.toContain('Projected-Unit-Credit-Methode');
    expect(documentXml).not.toContain('Teilwertverfahren');
    expect(documentXml).not.toContain('Rechnungszinssatz');
    expect(documentXml).not.toContain('vollstaendig ab');
  });
});

describe('Anhang Eigenkapital (B.4) – VJ-Eroeffnungswerte', () => {
  it('VJ Gezeichnetes Kapital (7.534)', () => expect(documentXml).toContain('7.534'));
  it('VJ Kapitalruecklage (2.229)',      () => expect(documentXml).toContain('2.229'));
  it('VJ Bilanzgewinn (~5.951)',         () => expect(documentXml).toContain('5.951'));
  it('enthaelt keine Veraenderungsspalte', () => expect(documentXml).not.toContain('Veränderung TEUR'));
});

describe('Anhang Rueckstellungen (B.5) – VJ-Eroeffnungswerte', () => {
  it('VJ Pensionsrueckstellungen (8.778)', () => expect(documentXml).toContain('8.778'));
  it('VJ Steuerrueckstellungen (7.619)',   () => expect(documentXml).toContain('7.619'));
  it('VJ Sonstige Rueckst. (11.687)',      () => expect(documentXml).toContain('11.687'));
  it('enthaelt keine Bewegungsspalten ohne Bewegungsdaten', () => {
    expect(documentXml).not.toContain('Zugang TEUR');
    expect(documentXml).not.toContain('Verbrauch/Aufl');
  });
  it('enthaelt keine Veraenderung-Prozent-Spalte', () => expect(documentXml).not.toContain('Veränderung %'));
});

describe('Anhang Verbindlichkeiten (B.6) – Excel-Werte', () => {
  it('enthaelt erhaltene Anzahlungen', () => expect(documentXml).toContain('Erhaltene Anzahlungen'));
  it('enthaelt Summe Verbindlichkeiten 2025 (45.199)', () => expect(documentXml).toContain('45.199'));
  it('enthaelt Summe Verbindlichkeiten 2024 (50.247)', () => expect(documentXml).toContain('50.247'));
  it('enthaelt korrigierten Verbindlichkeitentext mit Veraenderung (5.047)', () => expect(documentXml).toContain('5.047'));
  it('enthaelt keine alte Verbindlichkeitensumme ohne erhaltene Anzahlungen', () => expect(documentXml).not.toContain('38.833'));
});

describe('Anhang Materialaufwand und sonstige Aufwendungen – VJ-Werte', () => {
  it('enthaelt VJ Material Roh/Hilfs/Betriebsstoffe (34.999)', () => expect(documentXml).toContain('34.999'));
  it('enthaelt VJ bezogene Leistungen (3.000)', () => expect(documentXml).toContain('3.000'));
  it('enthaelt VJ sonstige betriebliche Aufwendungen (43.000)', () => expect(documentXml).toContain('43.000'));
});

describe('Anhang Haupttabellen – einheitliches Zwei-Jahres-Format', () => {
  it('enthaelt einheitliche Header Position, 2025 TEUR und 2024 TEUR', () => {
    expect(documentXml).toContain('Position');
    expect(documentXml).toContain('2025 TEUR');
    expect(documentXml).toContain('2024 TEUR');
  });
  it('enthaelt keine alten Haupttabellen-Zusatzspalten', () => {
    expect(documentXml).not.toContain('davon &gt; 1 Jahr TEUR');
    expect(documentXml).not.toContain('davon > 1 Jahr TEUR');
    expect(documentXml).not.toContain('Veränderung TEUR');
    expect(documentXml).not.toContain('Veränderung %');
    expect(documentXml).not.toContain('Segment / Region');
  });
  it('Forderungen enthalten 2024-Werte', () => {
    expect(documentXml).toContain('3.551');
    expect(documentXml).toContain('3.567');
    expect(documentXml).toContain('6.696');
    expect(documentXml).toContain('13.814');
  });
});

describe('Anhang GuV-Texte – keine falschen Kein-Vorjahr-Aussagen', () => {
  it('enthaelt Umsatz-Vorjahr', () => {
    expect(documentXml).toContain('100.889');
  });
  it('behauptet bei vorhandenen Vorjahreswerten nicht fehlende Vorjahre', () => {
    expect(documentXml).not.toContain('im Vorjahr kein entsprechender Betrag ausgewiesen');
    expect(documentXml).not.toContain('im Vorjahr wurde kein');
    expect(documentXml).not.toContain('während im Vorjahr kein entsprechender Betrag ausgewiesen wurde');
    expect(documentXml).not.toContain('während im Vorjahr kein entsprechender Betrag ausgewiesen wurde');
    expect(documentXml).not.toContain('kein Materialaufwand im Vorjahr');
    expect(documentXml).not.toContain('Im Vorjahr wurde kein entsprechender Betrag ausgewiesen');
  });
});

describe('Anhang Ergebnisverwendung', () => {
  it('enthaelt Jahresueberschuss 2025 (15.962)', () => expect(documentXml).toContain('15.962'));
});

describe('Anhang Personalaufwand (C.3) – VJ-Werte', () => {
  it('VJ Loehne (29.787)',           () => expect(documentXml).toContain('29.787'));
  it('VJ Personalaufwand (35.744)', () => expect(documentXml).toContain('35.744'));
});

describe('Anhang Umsatz (C.1) – Segmente', () => {
  it('5 Segmente: KI-Beratung',          () => expect(documentXml).toContain('KI-Beratung'));
  it('Vorjahr Umsatz Gesamt (100.889)',  () => expect(documentXml).toContain('100.889'));
});

describe('Anhang Pflichtangaben', () => {
  it('Para 285 Prueferhonorar', () => expect(documentXml).toContain('285'));
  it('Vorstand vorhanden',      () => expect(documentXml).toContain('Vorstand'));
  it('Firmenname (Lumina AG)',  () => expect(documentXml).toContain('Lumina AG'));
});
