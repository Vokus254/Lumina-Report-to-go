import React, { useEffect, useState } from 'react';
import type { JahresabschlussData, ReportTextEntry, StepProps } from '../types';
import { importExcelClient } from '../utils/importExcelClient';
import { apiFetch, readApiError } from '../utils/api';

type SectionTextResult = {
  text: string;
  paragraphs: Array<{
    type: 'confirmed' | 'unconfirmed';
    text: string;
    source: 'facts' | 'usual_text_block' | 'missing_input_notice' | 'user_input';
    requiresConfirmation: boolean;
  }>;
  warnings: string[];
  missingInputs: string[];
  reviewQuestions: string[];
  usedFacts: string[];
  role?: string;
  scope?: WorkbenchSettings['scope'];
  temperature?: number;
  customPrompt?: string;
  generatedAt?: string;
  generationSignature?: string;
};

type AssistantSectionId = string;
type DataStatus = 'vollständig' | 'teilweise' | 'fehlt';
type SectionGenerationStatus = 'idle' | 'loading' | 'done' | 'fallback' | 'error';
type RequestSection = {
  sectionId: AssistantSectionId;
  title: string;
  facts: Record<string, unknown>;
  requirements: string[];
  style: string;
  dataStatus: DataStatus;
  fallbackText?: string;
};

type WorkbenchSectionId = string;
type WorkbenchSettings = {
  role: string;
  scope: 'kurz' | 'mittel' | 'ausführlich';
  temperature: number;
  prompt: string;
};

const VALUATION_FALLBACK_TEXTS: Record<string, { title: string; text: string }> = {
  'anhang.bewertung.allgemeine_grundlagen': { title: 'Allgemeine Bewertungsgrundsaetze', text: 'Der Jahresabschluss wird nach den Vorschriften des HGB aufgestellt. Die Bilanzgliederung erfolgt nach § 266 HGB; die Gewinn- und Verlustrechnung wird nach § 275 HGB nach dem Gesamtkostenverfahren gegliedert.' },
  'anhang.bewertung.immaterielle_vermoegenswerte': { title: 'Immaterielle Vermoegenswerte', text: 'Entgeltlich erworbene immaterielle Vermoegensgegenstaende werden zu Anschaffungskosten aktiviert und, soweit sie einer zeitlich begrenzten Nutzung unterliegen, planmaessig ueber die voraussichtliche wirtschaftliche Nutzungsdauer abgeschrieben. Bei voraussichtlich dauernder Wertminderung erfolgen ausserplanmaessige Abschreibungen.' },
  'anhang.bewertung.sachanlagen': { title: 'Sachanlagen', text: 'Sachanlagen werden zu Anschaffungs- oder Herstellungskosten, vermindert um planmaessige Abschreibungen, bewertet. Nachtraegliche Anschaffungs- oder Herstellungskosten werden aktiviert, soweit sie zu einer Erweiterung oder wesentlichen Verbesserung fuehren.' },
  'anhang.bewertung.finanzanlagen': { title: 'Finanzanlagen', text: 'Finanzanlagen werden zu Anschaffungskosten angesetzt. Bei voraussichtlich dauernder Wertminderung werden ausserplanmaessige Abschreibungen vorgenommen.' },
  'anhang.bewertung.vorraete': { title: 'Vorraete', text: 'Vorraete werden zu Anschaffungs- oder Herstellungskosten unter Beachtung des strengen Niederstwertprinzips bewertet. Bestandsrisiken aus Lagerdauer, eingeschraenkter Verwertbarkeit oder niedrigeren Absatzpreisen werden durch Abwertungen beruecksichtigt.' },
  'anhang.bewertung.forderungen': { title: 'Forderungen und sonstige Vermoegensgegenstaende', text: 'Forderungen und sonstige Vermoegensgegenstaende werden zum Nennwert angesetzt. Erkennbare Einzelrisiken werden durch Wertberichtigungen beruecksichtigt.' },
  'anhang.bewertung.wertpapiere_uv': { title: 'Wertpapiere des Umlaufvermoegens', text: 'Wertpapiere des Umlaufvermoegens werden zu Anschaffungskosten oder zum niedrigeren beizulegenden Wert am Bilanzstichtag bewertet.' },
  'anhang.bewertung.liquide_mittel': { title: 'Liquide Mittel', text: 'Liquide Mittel werden zum Nennwert angesetzt.' },
  'anhang.bewertung.aktive_rechnungsabgrenzung': { title: 'Rechnungsabgrenzungsposten', text: 'Aktive Rechnungsabgrenzungsposten werden fuer Ausgaben vor dem Bilanzstichtag gebildet, soweit sie Aufwand fuer eine bestimmte Zeit nach dem Bilanzstichtag darstellen.' },
  'anhang.bewertung.aktive_latente_steuern': { title: 'Latente Steuern', text: 'Latente Steuern werden fuer temporaere Differenzen zwischen handelsrechtlichen und steuerlichen Wertansaetzen beruecksichtigt, soweit die Voraussetzungen hierfuer vorliegen.' },
  'anhang.bewertung.eigenkapital': { title: 'Eigenkapital', text: 'Das Eigenkapital wird mit dem Nennbetrag ausgewiesen.' },
  'anhang.bewertung.rueckstellungen': { title: 'Rueckstellungen', text: 'Rueckstellungen werden fuer ungewisse Verbindlichkeiten und drohende Verluste aus schwebenden Geschaeften in Hoehe des nach vernuenftiger kaufmaennischer Beurteilung notwendigen Erfuellungsbetrags gebildet.' },
  'anhang.bewertung.verbindlichkeiten': { title: 'Verbindlichkeiten', text: 'Verbindlichkeiten werden mit dem Erfuellungsbetrag angesetzt.' },
  'anhang.bewertung.passive_rechnungsabgrenzung': { title: 'Passive Rechnungsabgrenzung', text: 'Passive Rechnungsabgrenzungsposten werden fuer Einnahmen vor dem Bilanzstichtag gebildet, soweit sie Ertrag fuer eine bestimmte Zeit nach dem Bilanzstichtag darstellen.' },
  'anhang.bewertung.umsatzerloese': { title: 'Umsatzerloese', text: 'Umsatzerloese werden erfasst, wenn die Lieferung oder Leistung erbracht ist und die Hoehe der Gegenleistung verlaesslich bestimmt werden kann. Erloesschmaelerungen werden von den Umsatzerloesen abgesetzt.' },
  'anhang.bewertung.bestandsveraenderungen': { title: 'Bestandsveraenderungen', text: 'Bestandsveraenderungen werden entsprechend der Veraenderung unfertiger und fertiger Erzeugnisse erfasst.' },
  'anhang.bewertung.aktivierte_eigenleistungen': { title: 'Aktivierte Eigenleistungen', text: 'Aktivierte Eigenleistungen werden mit den zurechenbaren Herstellungskosten angesetzt, soweit die Aktivierungsvoraussetzungen vorliegen.' },
  'anhang.bewertung.sonstige_betriebliche_ertraege': { title: 'Sonstige betriebliche Ertraege', text: 'Sonstige betriebliche Ertraege werden periodengerecht erfasst, soweit sie dem Geschaeftsjahr wirtschaftlich zuzurechnen sind.' },
  'anhang.bewertung.materialaufwand': { title: 'Materialaufwand', text: 'Materialaufwendungen werden bei Verbrauch der Roh-, Hilfs- und Betriebsstoffe, bezogenen Waren oder bezogenen Leistungen aufwandswirksam erfasst.' },
  'anhang.bewertung.personalaufwand': { title: 'Personalaufwand', text: 'Personalaufwendungen werden periodengerecht erfasst.' },
  'anhang.bewertung.abschreibungen': { title: 'Abschreibungen', text: 'Abschreibungen werden planmaessig ueber die voraussichtliche wirtschaftliche Nutzungsdauer der abnutzbaren Vermoegensgegenstaende vorgenommen.' },
  'anhang.bewertung.sonstige_betriebliche_aufwendungen': { title: 'Sonstige betriebliche Aufwendungen', text: 'Sonstige betriebliche Aufwendungen werden periodengerecht erfasst, soweit sie dem Geschaeftsjahr wirtschaftlich zuzurechnen sind.' },
  'anhang.bewertung.beteiligungsertraege': { title: 'Beteiligungsertraege', text: 'Beteiligungsertraege werden erfasst, wenn ein Anspruch auf die Ertraege entstanden ist.' },
  'anhang.bewertung.zinsertraege': { title: 'Zinsertraege', text: 'Zinsertraege werden periodengerecht erfasst.' },
  'anhang.bewertung.abschreibungen_finanzanlagen': { title: 'Abschreibungen auf Finanzanlagen', text: 'Abschreibungen auf Finanzanlagen werden vorgenommen, wenn eine voraussichtlich dauernde Wertminderung vorliegt.' },
  'anhang.bewertung.zinsaufwendungen': { title: 'Zinsaufwendungen', text: 'Zinsaufwendungen werden periodengerecht erfasst.' },
  'anhang.bewertung.steuern_einkommen_ertrag': { title: 'Steuern vom Einkommen und Ertrag', text: 'Steuern vom Einkommen und Ertrag werden periodengerecht entsprechend der steuerlichen Ergebnisermittlung erfasst.' },
  'anhang.bewertung.sonstige_steuern': { title: 'Sonstige Steuern', text: 'Sonstige Steuern werden periodengerecht erfasst.' },
  'anhang.bewertung.jahresueberschuss': { title: 'Jahresueberschuss', text: 'Der Jahresueberschuss ergibt sich aus der periodengerechten Erfassung der Ertraege und Aufwendungen des Geschaeftsjahres.' },
};
const VALUATION_SECTION_IDS = Object.keys(VALUATION_FALLBACK_TEXTS);
const assistantGroupLabel = (group: 'Bewertungsgrundsaetze' | 'Bilanzabschnitte' | 'GuV-Abschnitte') =>
  group === 'Bewertungsgrundsaetze' ? 'Bilanzierungs- und Bewertungsgrundsätze' : group;

const WORKBENCH_SECTION_IDS: WorkbenchSectionId[] = [
  ...VALUATION_SECTION_IDS,
  'anhang.vorraete',
  'anhang.forderungen',
  'anhang.immaterielle_vermoegenswerte',
  'anhang.sachanlagen',
  'anhang.finanzanlagen',
  'anhang.wertpapiere_uv',
  'anhang.liquide_mittel',
  'anhang.eigenkapital',
  'anhang.rueckstellungen',
  'anhang.verbindlichkeiten',
  'anhang.guv.umsatzerloese',
  'anhang.guv.materialaufwand',
  'anhang.guv.personalaufwand',
  'anhang.guv.abschreibungen',
  'anhang.guv.sonstige_betriebliche_ertraege',
  'anhang.guv.sonstige_betriebliche_aufwendungen',
];
const EXAMPLE_TEST_WORKBENCH_SECTION_IDS = WORKBENCH_SECTION_IDS.filter(sectionId => !sectionId.startsWith('anhang.bewertung.'));
const DEFAULT_WORKBENCH_ROLE = 'prüferorientierter HGB-Abschlussassistent';
const REPORT_TEXT_SECTIONS: Array<{ id: WorkbenchSectionId; title: string; group: 'Bewertungsgrundsaetze' | 'Bilanzabschnitte' | 'GuV-Abschnitte' }> = [
  ...VALUATION_SECTION_IDS.map(id => ({ id, title: VALUATION_FALLBACK_TEXTS[id].title, group: 'Bewertungsgrundsaetze' as const })),
  { id: 'anhang.immaterielle_vermoegenswerte', title: 'Immaterielle Vermögenswerte', group: 'Bilanzabschnitte' },
  { id: 'anhang.sachanlagen', title: 'Sachanlagen', group: 'Bilanzabschnitte' },
  { id: 'anhang.finanzanlagen', title: 'Finanzanlagen', group: 'Bilanzabschnitte' },
  { id: 'anhang.vorraete', title: 'Vorräte', group: 'Bilanzabschnitte' },
  { id: 'anhang.forderungen', title: 'Forderungen', group: 'Bilanzabschnitte' },
  { id: 'anhang.wertpapiere_uv', title: 'Wertpapiere UV', group: 'Bilanzabschnitte' },
  { id: 'anhang.liquide_mittel', title: 'Liquide Mittel', group: 'Bilanzabschnitte' },
  { id: 'anhang.eigenkapital', title: 'Eigenkapital', group: 'Bilanzabschnitte' },
  { id: 'anhang.rueckstellungen', title: 'Rückstellungen', group: 'Bilanzabschnitte' },
  { id: 'anhang.verbindlichkeiten', title: 'Verbindlichkeiten', group: 'Bilanzabschnitte' },
  { id: 'anhang.guv.umsatzerloese', title: 'Umsatzerlöse', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.materialaufwand', title: 'Materialaufwand', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.personalaufwand', title: 'Personalaufwand', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.abschreibungen', title: 'Abschreibungen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.sonstige_betriebliche_ertraege', title: 'Sonstige betriebliche Erträge', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.sonstige_betriebliche_aufwendungen', title: 'Sonstige betriebliche Aufwendungen', group: 'GuV-Abschnitte' },
];

function isWorkbenchSection(sectionId: AssistantSectionId): sectionId is WorkbenchSectionId {
  return WORKBENCH_SECTION_IDS.includes(sectionId as WorkbenchSectionId);
}

function defaultWorkbenchPrompt(request: RequestSection): string {
  if (request.sectionId.startsWith('anhang.bewertung.')) {
    return [
      `Erstelle einen Bewertungsmethodentext fuer A.2 "${request.title}".`,
      'Es geht um Bilanzierungs- und Bewertungsmethoden, nicht um Zahlen- oder Veraenderungsanalyse.',
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die als Facts oder Parameter ausdruecklich bestaetigt sind.',
      'Uebliche Bewertungsmethoden und fehlende Parameter als unconfirmed paragraphs formulieren, solange sie nicht bestaetigt sind.',
      'Unconfirmed paragraphs werden spaeter gelb markiert und muessen requiresConfirmation=true haben.',
      'Normverweise mit § schreiben, nicht "Paragraph". Keine Jahre erfinden.',
      'Keine sichtbaren Tags und keine technischen Feldnamen.',
      'Arbeitsanweisungen:',
      ...request.requirements.map(requirement => `- ${requirement}`),
    ].join('\n');
  }

  return [
    `Erstelle einen ${request.title}-Text fuer den Anhang unterhalb der vorhandenen Tabelle.`,
    'Nutze die positionsspezifischen Section-Regeln aus dem Backend.',
    'Trenne bestaetigte und unbestaetigte Aussagen ueber paragraphs.',
    'Arbeitsanweisungen:',
    ...request.requirements.map(requirement => `- ${requirement}`),
  ].join('\n');
}

const ASSISTANT_SECTIONS: Array<{ id: AssistantSectionId; title: string; group: 'Bewertungsgrundsaetze' | 'Bilanzabschnitte' | 'GuV-Abschnitte' }> = [
  ...VALUATION_SECTION_IDS.map(id => ({ id, title: VALUATION_FALLBACK_TEXTS[id].title, group: 'Bewertungsgrundsaetze' as const })),
  { id: 'anhang.vorraete', title: 'Vorräte', group: 'Bilanzabschnitte' },
  { id: 'anhang.forderungen', title: 'Forderungen', group: 'Bilanzabschnitte' },
  { id: 'anhang.immaterielle_vermoegenswerte', title: 'Immaterielle Vermögenswerte', group: 'Bilanzabschnitte' },
  { id: 'anhang.sachanlagen', title: 'Sachanlagen', group: 'Bilanzabschnitte' },
  { id: 'anhang.finanzanlagen', title: 'Finanzanlagen', group: 'Bilanzabschnitte' },
  { id: 'anhang.wertpapiere_uv', title: 'Wertpapiere des Umlaufvermögens', group: 'Bilanzabschnitte' },
  { id: 'anhang.liquide_mittel', title: 'Liquide Mittel', group: 'Bilanzabschnitte' },
  { id: 'anhang.eigenkapital', title: 'Eigenkapital', group: 'Bilanzabschnitte' },
  { id: 'anhang.rueckstellungen', title: 'Rückstellungen', group: 'Bilanzabschnitte' },
  { id: 'anhang.verbindlichkeiten', title: 'Verbindlichkeiten', group: 'Bilanzabschnitte' },
  { id: 'anhang.guv.umsatzerloese', title: 'Umsatzerlöse', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.bestandsveraenderung', title: 'Bestandsveränderung', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.aktivierte_eigenleistungen', title: 'Aktivierte Eigenleistungen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.sonstige_betriebliche_ertraege', title: 'Sonstige betriebliche Erträge', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.materialaufwand', title: 'Materialaufwand', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.personalaufwand', title: 'Personalaufwand', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.abschreibungen', title: 'Abschreibungen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.sonstige_betriebliche_aufwendungen', title: 'Sonstige betriebliche Aufwendungen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.beteiligungsertraege', title: 'Beteiligungserträge', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.zinsertraege', title: 'Zinserträge', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.abschreibungen_finanzanlagen', title: 'Abschreibungen auf Finanzanlagen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.zinsaufwendungen', title: 'Zinsaufwendungen', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.steuern_einkommen_ertrag', title: 'Steuern vom Einkommen und Ertrag', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.sonstige_steuern', title: 'Sonstige Steuern', group: 'GuV-Abschnitte' },
  { id: 'anhang.guv.jahresueberschuss', title: 'Jahresüberschuss', group: 'GuV-Abschnitte' },
];

function dataStatus(values: unknown[]): DataStatus {
  const filled = values.filter(value => Number(value || 0) !== 0).length;
  if (filled === 0) return 'fehlt';
  if (filled === values.length) return 'vollständig';
  return 'teilweise';
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function changePercent(current: number, previous: number): number | null {
  return previous !== 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;
}

function buildDrivers(items: Array<{ label: string; current: number; previous: number }>) {
  return items
    .map(item => ({
      label: item.label,
      current: item.current,
      previous: item.previous,
      changeAmount: item.current - item.previous,
      changePercent: changePercent(item.current, item.previous),
    }))
    .filter(item => item.current !== 0 || item.previous !== 0)
    .sort((a: any, b: any) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount));
}

function isFallbackResult(result: SectionTextResult): boolean {
  return result.warnings.some(warning => warning.toLowerCase().includes('fallback'));
}

function sectionGenerationStatusLabel(status: SectionGenerationStatus): string {
  if (status === 'done') return 'KI-Text erzeugt';
  if (status === 'fallback') return 'Fallback verwendet';
  if (status === 'error') return 'Fehler - manuelle Bearbeitung erforderlich';
  if (status === 'loading') return 'KI-Text wird erzeugt';
  return 'Noch nicht erzeugt';
}

function standardRequirements(positionName: string) {
  return [
    `${positionName}: aktuellen Gesamtwert, Vorjahreswert, Veraenderung in TEUR und Prozent nennen.`,
    'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
    'Die Tabelle zeigt die Detailwerte bereits; im Text nicht alle Positionen wiederholen.',
    'Keine doppelte Beschreibung derselben Veraenderung.',
    'Fokus auf Veraenderung, Wesentlichkeit und Auffaelligkeiten.',
    'Ursachen nur aus changeExplanation oder bestaetigten Facts ableiten.',
    'Uebliche, nicht bestaetigte Erlaeuterungen als unconfirmed paragraph liefern.',
    'Fehlende Angaben als unconfirmed paragraph mit source="missing_input_notice" formulieren.',
    'Prozentformat mit einer Nachkommastelle.',
    'Alle Betraege in TEUR.',
  ];
}

function balanceTotalRequest(
  sectionId: AssistantSectionId,
  title: string,
  currentTotal: number,
  previousTotal: number,
  facts: Record<string, unknown>,
  statusValues: unknown[],
): RequestSection {
  const allFacts = {
    ...facts,
    currentTotal,
    previousTotal,
    changeAmount: currentTotal - previousTotal,
    changePercent: changePercent(currentTotal, previousTotal),
    tableAlreadyShowsDetails: true,
    changeExplanation: null,
    unit: 'TEUR',
  };

  return {
    sectionId,
    title,
    facts: allFacts,
    requirements: standardRequirements(title),
    style: [
      'Ausgabe immer in deutscher Sprache',
      'alle Betraege ausschliesslich in TEUR',
      'sachlich, knapp, prueferorientiert',
      'keine Normzitate, wenn keine konkrete Norm im Input enthalten ist',
      'confirmed nur fuer eindeutig ableitbare oder ausdruecklich bestaetigte Facts',
      'unconfirmed fuer uebliche Ursachen, Standardannahmen und fehlende Fachangaben',
    ].join('; '),
    dataStatus: dataStatus(statusValues),
  };
}

function guvSectionRequest(
  sectionId: AssistantSectionId,
  title: string,
  currentTotal: number,
  previousTotal: number,
  facts: Record<string, unknown>,
  statusValues: unknown[],
  isExpense = false,
): RequestSection {
  const changeAmount = currentTotal - previousTotal;
  const allFacts = {
    ...facts,
    currentTotal,
    previousTotal,
    changeAmount,
    changePercent: changePercent(currentTotal, previousTotal),
    previousWasZero: previousTotal === 0,
    resultEffect: isExpense
      ? (changeAmount > 0 ? 'Aufwandserhoehung ergebnismindernd' : changeAmount < 0 ? 'Aufwandsrueckgang ergebnisverbessernd' : 'keine wesentliche Ergebniswirkung aus Veraenderung')
      : (changeAmount > 0 ? 'Anstieg ergebnisverbessernd' : changeAmount < 0 ? 'Rueckgang ergebnismindernd' : 'keine wesentliche Ergebniswirkung aus Veraenderung'),
    expenseOrIncome: isExpense ? 'expense' : 'income',
    amountNature: isExpense ? 'Aufwand' : 'Ertrag/Ergebnisgroesse',
    tableAlreadyShowsDetails: true,
    changeExplanation: null,
    unit: 'TEUR',
  };

  return {
    sectionId,
    title,
    facts: allFacts,
    requirements: [
      `${title}: aktueller Wert, Vorjahreswert, Veraenderung in TEUR und Prozent nennen, falls Vorjahr vorhanden.`,
      'Wenn Vorjahr 0 ist, keine Prozentzahl ausgeben, sondern "im Vorjahr kein entsprechender Betrag ausgewiesen" verwenden.',
      'Ergebniswirkung knapp nennen.',
      'GuV-Tabelle nicht nacherzaehlen.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Ursachen, Sondereffekte und Managementbegruendungen nur als unconfirmed paragraph liefern, wenn nicht bestaetigt.',
      'Fehlende Angaben als unconfirmed paragraph mit source="missing_input_notice" formulieren.',
      'Alle Betraege in TEUR.',
    ],
    style: [
      'Ausgabe immer in deutscher Sprache',
      'alle Betraege ausschliesslich in TEUR',
      'sachlich, knapp, prueferorientiert',
      'keine technischen Feldnamen',
      'confirmed nur fuer eindeutig ableitbare oder ausdruecklich bestaetigte Facts',
      'unconfirmed fuer uebliche Ursachen, Sondereffekte, Managementbegruendungen und fehlende Angaben',
    ].join('; '),
    dataStatus: dataStatus(statusValues),
  };
}

function renderMarkedText(text: string) {
  const parts = text.split(/(\[gelb\][\s\S]*?\[\/gelb\])/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('[gelb]') && part.endsWith('[/gelb]')) {
      return (
        <span key={index} style={styles.inlineUnconfirmed}>
          {part.slice(6, -7)}
        </span>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function shortErrorMessage(message: string): string {
  return message.length > 700 ? `${message.slice(0, 700)}...` : message;
}

function generationSignature(settings: WorkbenchSettings): string {
  return JSON.stringify({
    role: settings.role,
    scope: settings.scope,
    temperature: settings.temperature,
    customPrompt: settings.prompt.trim(),
  });
}

function formatTime(iso?: string): string {
  return iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
}

function buildSectionTextRequest(sectionId: AssistantSectionId, data: JahresabschlussData): RequestSection {
  const { stammdaten, bilanz, guv, kennzahlen, segmente } = data;
  const bilanzValues = bilanz as unknown as Record<string, unknown>;
  const guvValues = guv as unknown as Record<string, unknown>;
  const kennzahlenValues = kennzahlen as unknown as Record<string, unknown>;
  const style = [
    'Ausgabe immer in deutscher Sprache',
    'alle Beträge ausschließlich in TEUR',
    'sachlich, knapp, prüferorientiert',
    'keine Normzitate, wenn keine konkrete Norm im Input enthalten ist',
    'fehlende Informationen nicht erfinden, sondern in missingInputs melden',
  ].join('; ');

  if (sectionId.startsWith('anhang.bewertung.')) {
    const fallback = VALUATION_FALLBACK_TEXTS[sectionId];
    const rechtsform = stammdaten.rechtsform || (stammdaten.firmenname?.trim().endsWith('AG') ? 'AG' : '');
    const facts: Record<string, unknown> = {
      firma: stammdaten.firmenname || '',
      sitz: stammdaten.sitz || '',
      geschaeftsjahr: stammdaten.geschaeftsjahr || '',
      bilanzstichtag: stammdaten.geschaeftsjahr ? `31.12.${stammdaten.geschaeftsjahr}` : '',
      rechnungslegung: 'HGB',
      gesellschaftsgroesse: 'gross',
      guvVerfahren: 'Gesamtkostenverfahren',
      bilanzgliederung: '§ 266 HGB',
      guvgliederung: '§ 275 HGB',
      bewertungsmethode_bestaetigt: false,
      konkrete_parameter_bestaetigt: false,
      mustertext: fallback?.text || '',
      unit: 'TEUR',
    };
    if (rechtsform) facts.rechtsform = rechtsform;
    if (rechtsform === 'AG') facts.rechtsformNorm = 'AktG';

    return {
      sectionId,
      title: fallback?.title || 'Bewertungsgrundsatz',
      facts,
      requirements: [
        'Bilanzierungs- und Bewertungsmethode formulieren, keine Zahlenanalyse.',
        'Keine Tabellenanalyse und keine Veraenderungsanalyse.',
        'Confirmed nur, wenn als Fact oder Parameter vorhanden.',
        'Uebliche Bewertungsmethoden als unconfirmed paragraph liefern.',
        'Fehlende Parameter als unconfirmed paragraph mit source="missing_input_notice" formulieren.',
        'Keine konkreten Nutzungsdauern, Prozentsaetze, Zinssaetze oder Vereinfachungsregeln als confirmed, wenn nicht bestaetigt.',
        'Normverweise mit § schreiben, nicht "Paragraph".',
        'Geschaeftsjahr und Bilanzstichtag nur aus Facts uebernehmen.',
        'Keine sichtbaren Tags und keine technischen Feldnamen.',
      ],
      style,
      dataStatus: dataStatus([facts.firma, facts.geschaeftsjahr, facts.rechnungslegung, fallback?.text]),
      fallbackText: fallback?.text,
    };
  }

  if (sectionId === 'anhang.bewertungsgrundsaetze') {
    const rechtsform = stammdaten.rechtsform || (stammdaten.firmenname?.trim().endsWith('AG') ? 'AG' : '');
    const facts: Record<string, unknown> = {
      firma: stammdaten.firmenname || '',
      sitz: stammdaten.sitz || '',
      geschaeftsjahr: stammdaten.geschaeftsjahr || '',
      bilanzstichtag: stammdaten.geschaeftsjahr ? `31.12.${stammdaten.geschaeftsjahr}` : '',
      rechnungslegung: 'HGB',
      gesellschaftsgroesse: 'gross',
      guvVerfahren: 'Gesamtkostenverfahren',
      bilanzgliederung: 'Paragraph 266 HGB',
      guvgliederung: 'Paragraph 275 HGB',
      bewertungsmethoden_bestaetigt: false,
      fortfuehrung_bestaetigt: false,
      stetigkeit_bestaetigt: false,
      konkrete_abschreibungsmethoden_bestaetigt: false,
      wertberichtigungen_bestaetigt: false,
      rueckstellungsbewertung_bestaetigt: false,
      unit: 'TEUR',
    };
    if (rechtsform) facts.rechtsform = rechtsform;
    if (rechtsform === 'AG') facts.rechtsformNorm = 'AktG';

    return {
      sectionId,
      title: 'Bilanzierungs- und Bewertungsgrundsaetze',
      facts,
      requirements: [
        'Allgemeine Rechnungslegungs-, Gliederungs- und GuV-Verfahrensangaben als confirmed paragraph formulieren.',
        'Keine konkreten Bewertungsmethoden als confirmed paragraph nennen, wenn sie nicht ausdruecklich bestaetigt sind.',
        'Uebliche Bewertungsgrundsaetze fuer immaterielle Vermoegenswerte, Sachanlagen, Vorraete, Forderungen, Rueckstellungen und Verbindlichkeiten als unconfirmed paragraphs liefern.',
        'Fehlende konkrete Bewertungsparameter als gelb zu markierende unconfirmed paragraphs formulieren.',
        'Keine harten Standardannahmen wie Nutzungsdauer drei bis fuenf Jahre, Pauschalwertberichtigung, AfA-Tabellen oder GWG bis 800 EUR als bestaetigte Aussage verwenden.',
        'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
      ],
      style,
      dataStatus: dataStatus([facts.firma, facts.sitz, facts.geschaeftsjahr, facts.rechnungslegung, facts.guvVerfahren]),
    };
  }

  if (sectionId === 'anhang.vorraete') {
    const currentTotal = (bilanz.vorr_rhb || 0) + (bilanz.vorr_unfertig || 0) + (bilanz.vorr_fertig || 0) + (bilanz.vorr_anzahlungen || 0);
    const previousTotal = bilanz.vj_vorraete || 0;
    const vjVorrRhb = num(bilanzValues['vj_vorr_rhb']);
    const vjVorrUnfertig = num(bilanzValues['vj_vorr_unfertig']);
    const vjVorrFertig = num(bilanzValues['vj_vorr_fertig']);
    const vjVorrAnzahlungen = num(bilanzValues['vj_vorr_anzahlungen']);
    const hasPreviousDetails = [vjVorrRhb, vjVorrUnfertig, vjVorrFertig, vjVorrAnzahlungen].some(value => value !== 0);
    const facts = {
      vorr_rhb: bilanz.vorr_rhb || 0,
      vorr_unfertig: bilanz.vorr_unfertig || 0,
      vorr_fertig: bilanz.vorr_fertig || 0,
      vorr_anzahlungen: bilanz.vorr_anzahlungen || 0,
      vj_vorraete: bilanz.vj_vorraete || 0,
      bewertungsmethode: 'Anschaffungs- oder Herstellungskosten',
      bewertungsgrundsatz: 'Niederstwertprinzip',
      abwertungen_vorhanden: false,
      erhaltene_anzahlungen_offen_abgesetzt: false,
      currentTotal,
      previousTotal,
      changeAmount: currentTotal - previousTotal,
      changePercent: changePercent(currentTotal, previousTotal),
      mainDrivers: hasPreviousDetails ? buildDrivers([
        { label: 'Roh-, Hilfs- und Betriebsstoffe', current: bilanz.vorr_rhb || 0, previous: vjVorrRhb },
        { label: 'Unfertige Erzeugnisse', current: bilanz.vorr_unfertig || 0, previous: vjVorrUnfertig },
        { label: 'Fertige Erzeugnisse und Waren', current: bilanz.vorr_fertig || 0, previous: vjVorrFertig },
        { label: 'Geleistete Anzahlungen', current: bilanz.vorr_anzahlungen || 0, previous: vjVorrAnzahlungen },
      ]) : [],
      tableAlreadyShowsDetails: true,
      changeExplanation: null,
      unit: 'TEUR',
    };
    return {
      sectionId,
      title: 'Vorräte',
      facts,
      requirements: [
        'Zusammensetzung darstellen',
        'Bewertung zu Anschaffungs- oder Herstellungskosten unter Beachtung des Niederstwertprinzips darstellen',
        'keine weiteren Bewertungsmethoden erfinden',
        'Abwertungen nur erwaehnen, wenn Fact vorhanden',
        'fehlende Angaben in missingInputs nennen',
        'Nicht die Tabelle nacherzaehlen.',
        'Fokus auf Veraenderung, Wesentlichkeit und Auffaelligkeiten.',
        'Ursachen nur aus changeExplanation oder anderen Facts ableiten.',
        'Wenn keine Ursachen uebergeben wurden, in missingInputs ausweisen.',
        'Die Tabelle zeigt die Zusammensetzung bereits; im Text nicht alle Positionen wiederholen.',
        'Fokus auf Veraenderung in TEUR und Prozent.',
        'Offene Pruefhinweise nicht in den Textentwurf schreiben.',
      ],
      style,
      dataStatus: dataStatus([facts.vorr_rhb, facts.vorr_unfertig, facts.vorr_fertig, facts.vorr_anzahlungen, facts.vj_vorraete]),
    };
  }

  if (sectionId === 'anhang.forderungen') {
    const currentTotal = (bilanz.ford_llg || 0) + (bilanz.ford_vbu || 0) + (bilanz.ford_sonstige || 0);
    const previousTotal = (bilanz.vj_ford_llg || 0) + (bilanz.vj_ford_vbu || 0) + (bilanz.vj_ford_sonstige || 0);
    const facts = {
      ford_llg: bilanz.ford_llg || 0,
      ford_vbu: bilanz.ford_vbu || 0,
      ford_sonstige: bilanz.ford_sonstige || 0,
      vj_ford_llg: bilanz.vj_ford_llg || 0,
      vj_ford_vbu: bilanz.vj_ford_vbu || 0,
      vj_ford_sonstige: bilanz.vj_ford_sonstige || 0,
      restlaufzeiten_vorhanden: false,
      wertberichtigungen_vorhanden: false,
      sicherheiten_vorhanden: false,
      restlaufzeiten_standardtext: 'Sämtliche Forderungen und sonstigen Vermögensgegenstände haben eine Restlaufzeit von bis zu einem Jahr.',
      wertberichtigungen_standardtext: 'Wertberichtigungen wurden, soweit erforderlich, berücksichtigt.',
      sicherheiten_standardtext: 'Sicherheiten bestehen nicht.',
      confirmationStatus: 'unconfirmed',
      currentTotal,
      previousTotal,
      changeAmount: currentTotal - previousTotal,
      changePercent: changePercent(currentTotal, previousTotal),
      mainDrivers: buildDrivers([
        { label: 'Forderungen aus Lieferungen und Leistungen', current: bilanz.ford_llg || 0, previous: bilanz.vj_ford_llg || 0 },
        { label: 'Forderungen gegen verbundene Unternehmen', current: bilanz.ford_vbu || 0, previous: bilanz.vj_ford_vbu || 0 },
        { label: 'Sonstige Vermoegensgegenstaende', current: bilanz.ford_sonstige || 0, previous: bilanz.vj_ford_sonstige || 0 },
      ]),
      tableAlreadyShowsDetails: true,
      changeExplanation: null,
      unit: 'TEUR',
    };
    return {
      sectionId,
      title: 'Forderungen',
      facts,
      requirements: [
        'Zusammensetzung der Forderungen darstellen',
        'Veraenderung zum Vorjahr erlaeutern',
        'Forderungen gegen verbundene Unternehmen gesondert erwaehnen',
        'Restlaufzeiten nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
        'Wertberichtigungen nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
        'Sicherheiten nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
        'Nicht die Tabelle nacherzaehlen.',
        'Fokus auf Veraenderung, Wesentlichkeit und Auffaelligkeiten.',
        'Ursachen nur aus changeExplanation oder anderen Facts ableiten.',
        'Wenn keine Ursachen uebergeben wurden, in missingInputs ausweisen.',
        'Die Tabelle zeigt die Zusammensetzung bereits; im Text nicht alle Positionen wiederholen.',
        'Fokus auf Veraenderung in TEUR und Prozent.',
        'Offene Pruefhinweise nicht in den Textentwurf schreiben.',
      ],
      style,
      dataStatus: dataStatus([facts.ford_llg, facts.ford_vbu, facts.ford_sonstige, facts.vj_ford_llg, facts.vj_ford_vbu, facts.vj_ford_sonstige]),
    };
  }

  if (sectionId === 'anhang.immaterielle_vermoegenswerte') {
    const currentTotal = num(bilanzValues['immat_vw']);
    const previousTotal = num(bilanzValues['vj_immat_vw']);
    const details = [
      { label: 'Lizenzen und Software', current: num(bilanzValues['immat_lizenzen']), previous: num(bilanzValues['vj_immat_lizenzen']) },
      { label: 'Selbst erstellte immaterielle Vermoegenswerte', current: num(bilanzValues['immat_selbst']), previous: num(bilanzValues['vj_immat_selbst']) },
      { label: 'Geleistete Anzahlungen', current: num(bilanzValues['immat_anzahlungen']), previous: num(bilanzValues['vj_immat_anzahlungen']) },
    ];
    return balanceTotalRequest(sectionId, 'Immaterielle Vermoegenswerte', currentTotal, previousTotal, {
      immaterielle_vermoegenswerte: currentTotal,
      vj_immaterielle_vermoegenswerte: previousTotal,
      immat_lizenzen_current: details[0].current,
      immat_lizenzen_previous: details[0].previous,
      immat_lizenzen_change: details[0].current - details[0].previous,
      immat_lizenzen_changePercent: changePercent(details[0].current, details[0].previous),
      immat_selbst_current: details[1].current,
      immat_selbst_previous: details[1].previous,
      immat_selbst_change: details[1].current - details[1].previous,
      immat_selbst_changePercent: changePercent(details[1].current, details[1].previous),
      immat_anzahlungen_current: details[2].current,
      immat_anzahlungen_previous: details[2].previous,
      immat_anzahlungen_change: details[2].current - details[2].previous,
      immat_anzahlungen_changePercent: changePercent(details[2].current, details[2].previous),
      nutzungsdauern_vorhanden: false,
      abschreibungsmethoden_vorhanden: false,
      aktivierte_eigenleistungen_vorhanden: false,
      entwicklungskosten_vorhanden: false,
      ausserplanmaessige_abschreibungen_vorhanden: false,
      mainDrivers: buildDrivers(details),
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.sachanlagen') {
    const currentTotal = num(bilanzValues['sachanlagen']);
    const previousTotal = num(bilanzValues['vj_sachanlagen']);
    const currentDetails = [
      { label: 'Grundstuecke und Gebaeude', current: num(bilanzValues['sach_gebaeude']), previous: num(bilanzValues['vj_sach_gebaeude']) },
      { label: 'Technische Anlagen', current: num(bilanzValues['sach_maschinen']), previous: num(bilanzValues['vj_sach_maschinen']) },
      { label: 'Betriebs- und Geschaeftsausstattung', current: num(bilanzValues['sach_ausstattung']), previous: num(bilanzValues['vj_sach_ausstattung']) },
      { label: 'Anlagen im Bau', current: num(bilanzValues['sach_anbau']), previous: num(bilanzValues['vj_sach_anbau']) },
    ];
    const hasPreviousDetails = currentDetails.some(item => item.previous !== 0);
    return balanceTotalRequest(sectionId, 'Sachanlagen', currentTotal, previousTotal, {
      sachanlagen: currentTotal,
      vj_sachanlagen: previousTotal,
      sach_gebaeude_current: currentDetails[0].current,
      sach_gebaeude_previous: currentDetails[0].previous,
      sach_gebaeude_change: currentDetails[0].current - currentDetails[0].previous,
      sach_gebaeude_changePercent: changePercent(currentDetails[0].current, currentDetails[0].previous),
      sach_technische_anlagen_current: currentDetails[1].current,
      sach_technische_anlagen_previous: currentDetails[1].previous,
      sach_technische_anlagen_change: currentDetails[1].current - currentDetails[1].previous,
      sach_technische_anlagen_changePercent: changePercent(currentDetails[1].current, currentDetails[1].previous),
      sach_bga_current: currentDetails[2].current,
      sach_bga_previous: currentDetails[2].previous,
      sach_bga_change: currentDetails[2].current - currentDetails[2].previous,
      sach_bga_changePercent: changePercent(currentDetails[2].current, currentDetails[2].previous),
      sach_anlagen_im_bau_current: currentDetails[3].current,
      sach_anlagen_im_bau_previous: currentDetails[3].previous,
      sach_anlagen_im_bau_change: currentDetails[3].current - currentDetails[3].previous,
      sach_anlagen_im_bau_changePercent: changePercent(currentDetails[3].current, currentDetails[3].previous),
      wesentliche_zugaenge_vorhanden: false,
      abgaenge_vorhanden: false,
      abschreibungsmethoden_vorhanden: false,
      nutzungsdauern_vorhanden: false,
      ausserplanmaessige_abschreibungen_vorhanden: false,
      aktivierte_eigenleistungen_vorhanden: false,
      mainDrivers: hasPreviousDetails ? buildDrivers(currentDetails) : [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.finanzanlagen') {
    const currentTotal = num(bilanzValues['finanzanlagen']);
    const previousTotal = num(bilanzValues['vj_finanzanlagen']);
    const details = [
      { label: 'Anteile an verbundenen Unternehmen', current: num(bilanzValues['fin_anteilsvbu']), previous: num(bilanzValues['vj_fin_anteilsvbu']) },
      { label: 'Ausleihungen an verbundene Unternehmen', current: num(bilanzValues['fin_ausleihvbu']), previous: num(bilanzValues['vj_fin_ausleihvbu']) },
      { label: 'Beteiligungen', current: num(bilanzValues['fin_beteiligungen']), previous: num(bilanzValues['vj_fin_beteiligungen']) },
    ];
    const hasPreviousDetails = details.some(item => item.previous !== 0);
    return balanceTotalRequest(sectionId, 'Finanzanlagen', currentTotal, previousTotal, {
      finanzanlagen: currentTotal,
      vj_finanzanlagen: previousTotal,
      fin_verbundene_current: details[0].current,
      fin_verbundene_previous: details[0].previous,
      fin_verbundene_change: details[0].current - details[0].previous,
      fin_verbundene_changePercent: changePercent(details[0].current, details[0].previous),
      fin_ausleihungen_current: details[1].current,
      fin_ausleihungen_previous: details[1].previous,
      fin_ausleihungen_change: details[1].current - details[1].previous,
      fin_ausleihungen_changePercent: changePercent(details[1].current, details[1].previous),
      fin_beteiligungen_current: details[2].current,
      fin_beteiligungen_previous: details[2].previous,
      fin_beteiligungen_change: details[2].current - details[2].previous,
      fin_beteiligungen_changePercent: changePercent(details[2].current, details[2].previous),
      werthaltigkeit_bestaetigt: false,
      beteiligungsverhaeltnisse_vorhanden: false,
      ausleihungskonditionen_vorhanden: false,
      abschreibungen_vorhanden: false,
      zuschreibungen_vorhanden: false,
      mainDrivers: hasPreviousDetails ? buildDrivers(details) : [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.wertpapiere_uv') {
    const currentTotal = num(bilanzValues['wertpapiere_umlauf']);
    const previousTotal = num(bilanzValues['vj_wertpapiere_umlauf']) || num(bilanzValues['vj_wertpapiere']);
    return balanceTotalRequest(sectionId, 'Wertpapiere des Umlaufvermoegens', currentTotal, previousTotal, {
      wertpapiere_umlaufvermoegen: currentTotal,
      vj_wertpapiere_umlaufvermoegen: previousTotal,
      kurzfristig_disponierbar_bestaetigt: false,
      bewertungsmethode_vorhanden: false,
      marktwerte_vorhanden: false,
      stille_reserven_lasten_vorhanden: false,
      kursrisiken_vorhanden: false,
      verfuegbarkeit_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.liquide_mittel') {
    const currentTotal = num(bilanzValues['liquide_mittel']);
    const previousTotal = num(bilanzValues['vj_liquide_mittel']);
    return balanceTotalRequest(sectionId, 'Liquide Mittel', currentTotal, previousTotal, {
      liquide_mittel: currentTotal,
      vj_liquide_mittel: previousTotal,
      verfuegungsbeschraenkte_zahlungsmittel_vorhanden: false,
      bankguthaben_vorhanden: false,
      kassenbestaende_vorhanden: false,
      cash_pooling_vorhanden: false,
      treuhandkonten_vorhanden: false,
      stichtagseffekte_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.eigenkapital') {
    const currentTotal = num(bilanzValues['gezeichnetes_kapital']) + num(bilanzValues['kapitalruecklage'])
      + num(bilanzValues['gesetzliche_ruecklage']) + num(bilanzValues['andere_gewinnruecklagen']) + num(bilanzValues['bilanzgewinn']);
    const previousTotal = num(bilanzValues['vj_eigenkapital']);
    return balanceTotalRequest(sectionId, 'Eigenkapital', currentTotal, previousTotal, {
      gezeichnetes_kapital: num(bilanzValues['gezeichnetes_kapital']),
      kapitalruecklage: num(bilanzValues['kapitalruecklage']),
      gesetzliche_ruecklage: num(bilanzValues['gesetzliche_ruecklage']),
      andere_gewinnruecklagen: num(bilanzValues['andere_gewinnruecklagen']),
      bilanzgewinn: num(bilanzValues['bilanzgewinn']),
      vj_eigenkapital: previousTotal,
      gewinnverwendung_vorhanden: false,
      ausschuettung_vorhanden: false,
      ruecklageneinstellungen_vorhanden: false,
      kapitalmassnahmen_vorhanden: false,
      beschlusslage_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.rueckstellungen') {
    const pensionen = num(bilanzValues['pensionsrueckstellungen']);
    const steuern = num(bilanzValues['steuerrueckstellungen']);
    const sonstige = num(bilanzValues['sonstige_rueckstellungen']);
    const pensionenPrevious = num(bilanzValues['vj_pensionsrueck']);
    const steuernPrevious = num(bilanzValues['vj_steuerrueck']);
    const sonstigePrevious = num(bilanzValues['vj_sonstige_rueck']);
    const currentTotal = pensionen + steuern + sonstige;
    const previousTotal = num(bilanzValues['vj_rueckstellungen']);
    return balanceTotalRequest(sectionId, 'Rueckstellungen', currentTotal, previousTotal, {
      pensionsrueckstellungen: pensionen,
      steuerrueckstellungen: steuern,
      sonstige_rueckstellungen: sonstige,
      pensionenCurrent: pensionen,
      pensionenPrevious,
      pensionenChangeAmount: pensionen - pensionenPrevious,
      pensionenChangePercent: changePercent(pensionen, pensionenPrevious),
      steuernCurrent: steuern,
      steuernPrevious,
      steuernChangeAmount: steuern - steuernPrevious,
      steuernChangePercent: changePercent(steuern, steuernPrevious),
      sonstigeCurrent: sonstige,
      sonstigePrevious,
      sonstigeChangeAmount: sonstige - sonstigePrevious,
      sonstigeChangePercent: changePercent(sonstige, sonstigePrevious),
      vj_rueckstellungen: previousTotal,
      bewertungsmethoden_vorhanden: false,
      zinssaetze_vorhanden: false,
      versicherungsmathematische_annahmen_vorhanden: false,
      inanspruchnahmen_vorhanden: false,
      aufloesungen_vorhanden: false,
      zufuehrungen_vorhanden: false,
      wesentliche_einzelrisiken_vorhanden: false,
      groesster_einzelposten: 'sonstige Rueckstellungen',
      mainDrivers: buildDrivers([
        { label: 'Pensionsrueckstellungen', current: pensionen, previous: pensionenPrevious },
        { label: 'Steuerrueckstellungen', current: steuern, previous: steuernPrevious },
        { label: 'Sonstige Rueckstellungen', current: sonstige, previous: sonstigePrevious },
      ]),
    }, [pensionen, steuern, sonstige, previousTotal]);
  }

  if (sectionId === 'anhang.guv.umsatzerloese') {
    const currentTotal = num(guvValues['umsatzerloese']);
    const previousTotal = num(kennzahlenValues['vorjahr_umsatz']) || num(guvValues['vj_umsatzerloese']);
    const segmentDetails = (segmente || []).map((segment: any) => ({
      name: segment.name,
      current: segment.umsatz || 0,
      previous: segment.vorjahr_umsatz || 0,
      changeAmount: (segment.umsatz || 0) - (segment.vorjahr_umsatz || 0),
      changePercent: changePercent(segment.umsatz || 0, segment.vorjahr_umsatz || 0),
    }));
    return guvSectionRequest(sectionId, 'Umsatzerloese', currentTotal, previousTotal, {
      umsatz_current: currentTotal,
      umsatz_previous: previousTotal,
      umsatz_change: currentTotal - previousTotal,
      umsatz_changePercent: changePercent(currentTotal, previousTotal),
      segmentDetails,
      umsatzaufgliederung_vorhanden: false,
      preis_mengeneffekte_vorhanden: false,
      mainDrivers: segmentDetails
        .map((segment: any) => ({
          label: segment.name,
          current: segment.current,
          previous: segment.previous,
          changeAmount: segment.changeAmount,
          changePercent: segment.changePercent,
        }))
        .sort((a: any, b: any) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount)),
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.bestandsveraenderung') {
    const currentTotal = num(guvValues['bestandsveraenderung']);
    const previousTotal = num(guvValues['vj_bestandsveraenderung']);
    return guvSectionRequest(sectionId, 'Bestandsveraenderung', currentTotal, previousTotal, {
      bestandsveraenderung: currentTotal,
      vj_bestandsveraenderung: previousTotal,
      bestaende_ursachen_vorhanden: false,
      abgrenzung_unfertige_fertige_erzeugnisse_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.aktivierte_eigenleistungen') {
    const currentTotal = num(guvValues['eigenleistungen']);
    const previousTotal = num(guvValues['vj_eigenleistungen']);
    return guvSectionRequest(sectionId, 'Aktivierte Eigenleistungen', currentTotal, previousTotal, {
      aktivierte_eigenleistungen: currentTotal,
      vj_aktivierte_eigenleistungen: previousTotal,
      art_der_eigenleistungen_vorhanden: false,
      aktivierungskriterien_vorhanden: false,
      abgrenzung_zu_laufendem_aufwand_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.sonstige_betriebliche_ertraege') {
    const currentTotal = num(guvValues['sonstige_ertraege']);
    const previousTotal = num(kennzahlenValues['vj_sonstige_ertraege']) || num(guvValues['vj_sonstige_ertraege']);
    return guvSectionRequest(sectionId, 'Sonstige betriebliche Ertraege', currentTotal, previousTotal, {
      sonstige_betriebliche_ertraege_current: currentTotal,
      sonstige_betriebliche_ertraege_previous: previousTotal,
      sonstige_betriebliche_ertraege_change: currentTotal - previousTotal,
      sonstige_betriebliche_ertraege_changePercent: changePercent(currentTotal, previousTotal),
      wesentliche_einzelposten_vorhanden: false,
      periodenfremde_ertraege_vorhanden: false,
      ertraege_aus_rueckstellungsaufloesung_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.materialaufwand') {
    const materialRoh = num(guvValues['material_roh']);
    const materialDienst = num(guvValues['material_dienst']);
    const previousMaterialRoh = num(kennzahlenValues['vj_material_roh']) || num(guvValues['vj_material_roh']);
    const previousMaterialDienst = num(kennzahlenValues['vj_material_dienst']) || num(guvValues['vj_material_dienst']);
    const currentTotal = materialRoh + materialDienst;
    const previousTotal = num(kennzahlenValues['vj_materialaufwand']) || num(guvValues['vj_materialaufwand']) || previousMaterialRoh + previousMaterialDienst;
    const umsatzCurrent = num(guvValues['umsatzerloese']);
    const umsatzPrevious = num(kennzahlenValues['vorjahr_umsatz']) || num(guvValues['vj_umsatzerloese']);
    const materialquoteCurrent = umsatzCurrent !== 0 ? Number(((currentTotal / umsatzCurrent) * 100).toFixed(1)) : null;
    const materialquotePrevious = umsatzPrevious !== 0 ? Number(((previousTotal / umsatzPrevious) * 100).toFixed(1)) : null;
    return guvSectionRequest(sectionId, 'Materialaufwand', currentTotal, previousTotal, {
      materialaufwand_current: currentTotal,
      materialaufwand_previous: previousTotal,
      materialaufwand_change: currentTotal - previousTotal,
      materialaufwand_changePercent: changePercent(currentTotal, previousTotal),
      roh_hilfs_betriebsstoffe_current: materialRoh,
      roh_hilfs_betriebsstoffe_previous: previousMaterialRoh,
      roh_hilfs_betriebsstoffe_change: materialRoh - previousMaterialRoh,
      roh_hilfs_betriebsstoffe_changePercent: changePercent(materialRoh, previousMaterialRoh),
      bezogene_leistungen_current: materialDienst,
      bezogene_leistungen_previous: previousMaterialDienst,
      bezogene_leistungen_change: materialDienst - previousMaterialDienst,
      bezogene_leistungen_changePercent: changePercent(materialDienst, previousMaterialDienst),
      umsatz_current: umsatzCurrent,
      umsatz_previous: umsatzPrevious,
      materialquote_current: materialquoteCurrent,
      materialquote_previous: materialquotePrevious,
      materialquote_change: materialquoteCurrent !== null && materialquotePrevious !== null ? Number((materialquoteCurrent - materialquotePrevious).toFixed(1)) : null,
      preis_mengeneffekte_vorhanden: false,
      lieferantenstruktur_vorhanden: false,
      bezogene_leistungen_details_vorhanden: false,
      mainDrivers: buildDrivers([
        { label: 'Roh-, Hilfs- und Betriebsstoffe und bezogene Waren', current: materialRoh, previous: previousMaterialRoh },
        { label: 'Bezogene Leistungen', current: materialDienst, previous: previousMaterialDienst },
      ]),
    }, [materialRoh, materialDienst, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.personalaufwand') {
    const loehne = num(guvValues['loehne']);
    const sozialabgaben = num(guvValues['sozialabgaben']);
    const currentTotal = loehne + sozialabgaben;
    const previousLoehne = num(kennzahlenValues['vj_loehne']) || num(guvValues['vj_loehne']);
    const previousSozialabgaben = num(kennzahlenValues['vj_sozialabgaben']) || num(guvValues['vj_sozialabgaben']);
    const previousTotal = num(kennzahlenValues['vj_personalaufwand']) || num(guvValues['vj_personalaufwand']) || previousLoehne + previousSozialabgaben;
    return guvSectionRequest(sectionId, 'Personalaufwand', currentTotal, previousTotal, {
      personalaufwand_current: currentTotal,
      personalaufwand_previous: previousTotal,
      personalaufwand_change: currentTotal - previousTotal,
      personalaufwand_changePercent: changePercent(currentTotal, previousTotal),
      loehne_gehaelter_current: loehne,
      loehne_gehaelter_previous: previousLoehne,
      loehne_gehaelter_change: loehne - previousLoehne,
      loehne_gehaelter_changePercent: changePercent(loehne, previousLoehne),
      soziale_abgaben_current: sozialabgaben,
      soziale_abgaben_previous: previousSozialabgaben,
      soziale_abgaben_change: sozialabgaben - previousSozialabgaben,
      soziale_abgaben_changePercent: changePercent(sozialabgaben, previousSozialabgaben),
      mitarbeiterzahl_vorhanden: false,
      verguetungsstruktur_vorhanden: false,
      variable_verguetungen_vorhanden: false,
      einmaleffekte_vorhanden: false,
      mainDrivers: buildDrivers([
        { label: 'Loehne und Gehaelter', current: loehne, previous: previousLoehne },
        { label: 'Soziale Abgaben', current: sozialabgaben, previous: previousSozialabgaben },
      ]),
    }, [loehne, sozialabgaben, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.abschreibungen') {
    const currentTotal = num(guvValues['abschreibungen']);
    const previousTotal = num(kennzahlenValues['vj_abschreibungen']) || num(guvValues['vj_abschreibungen']);
    return guvSectionRequest(sectionId, 'Abschreibungen', currentTotal, previousTotal, {
      abschreibungen_current: currentTotal,
      abschreibungen_previous: previousTotal,
      abschreibungen_change: currentTotal - previousTotal,
      abschreibungen_changePercent: changePercent(currentTotal, previousTotal),
      planmaessige_abschreibungen_vorhanden: false,
      ausserplanmaessige_abschreibungen_vorhanden: false,
      nutzungsdauern_vorhanden: false,
      wesentliche_neuinvestitionen_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.sonstige_betriebliche_aufwendungen') {
    const currentTotal = num(guvValues['sonstige_aufwendungen']);
    const previousTotal = num(kennzahlenValues['vj_sonstige_aufwendungen']) || num(kennzahlenValues['vj_sonstige_aufwend']) || num(guvValues['vj_sonstige_aufwendungen']) || num(guvValues['vj_sonstige_aufwend']);
    return guvSectionRequest(sectionId, 'Sonstige betriebliche Aufwendungen', currentTotal, previousTotal, {
      sonstige_betriebliche_aufwendungen_current: currentTotal,
      sonstige_betriebliche_aufwendungen_previous: previousTotal,
      sonstige_betriebliche_aufwendungen_change: currentTotal - previousTotal,
      sonstige_betriebliche_aufwendungen_changePercent: changePercent(currentTotal, previousTotal),
      wesentliche_einzelposten_vorhanden: false,
      periodenfremde_aufwendungen_vorhanden: false,
      beratung_it_raumkosten_vorhanden: false,
      einmaleffekte_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.beteiligungsertraege') {
    const currentTotal = num(guvValues['beteiligungsertraege']);
    const previousTotal = num(guvValues['vj_beteiligungsertraege']);
    return guvSectionRequest(sectionId, 'Beteiligungsertraege', currentTotal, previousTotal, {
      beteiligungsertraege: currentTotal,
      vj_beteiligungsertraege: previousTotal,
      herkunft_vorhanden: false,
      ausschuettungsbeschluesse_vorhanden: false,
      einmaleffekte_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.zinsertraege') {
    const currentTotal = num(guvValues['zinsertraege']);
    const previousTotal = num(guvValues['vj_zinsertraege']);
    return guvSectionRequest(sectionId, 'Zinsertraege', currentTotal, previousTotal, {
      zinsertraege: currentTotal,
      vj_zinsertraege: previousTotal,
      zinsquellen_vorhanden: false,
      geldanlagen_vorhanden: false,
      ausleihungen_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  if (sectionId === 'anhang.guv.abschreibungen_finanzanlagen') {
    const currentTotal = num(guvValues['abschr_finanzanlagen']);
    const previousTotal = num(guvValues['vj_abschr_finanzanlagen']);
    return guvSectionRequest(sectionId, 'Abschreibungen auf Finanzanlagen', currentTotal, previousTotal, {
      abschreibungen_finanzanlagen: currentTotal,
      vj_abschreibungen_finanzanlagen: previousTotal,
      betroffene_finanzanlagen_vorhanden: false,
      werthaltigkeit_vorhanden: false,
      bewertungsanlaesse_vorhanden: false,
      dauerhaftigkeit_wertminderung_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.zinsaufwendungen') {
    const currentTotal = num(guvValues['zinsaufwendungen']);
    const previousTotal = num(guvValues['vj_zinsaufwendungen']);
    return guvSectionRequest(sectionId, 'Zinsaufwendungen', currentTotal, previousTotal, {
      zinsaufwendungen: currentTotal,
      vj_zinsaufwendungen: previousTotal,
      finanzierungsstruktur_vorhanden: false,
      zinssaetze_vorhanden: false,
      darlehen_anleihen_vorhanden: false,
      zinsaenderungseffekte_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.steuern_einkommen_ertrag') {
    const currentTotal = num(guvValues['steuern_ertrag']);
    const previousTotal = num(guvValues['vj_steuern_ertrag']);
    const ebt = num(guvValues['betriebsergebnis']) + num(guvValues['beteiligungsertraege']) + num(guvValues['zinsertraege'])
      - num(guvValues['zinsaufwendungen']) - num(guvValues['abschr_finanzanlagen']);
    return guvSectionRequest(sectionId, 'Steuern vom Einkommen und Ertrag', currentTotal, previousTotal, {
      steuern_einkommen_ertrag: currentTotal,
      vj_steuern_einkommen_ertrag: previousTotal,
      ebt,
      steuerquote: ebt !== 0 ? Number(((currentTotal / ebt) * 100).toFixed(1)) : null,
      laufende_steuern_vorhanden: false,
      latente_steuern_vorhanden: false,
      periodenfremde_steuern_vorhanden: false,
      steuerliche_sondereffekte_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.sonstige_steuern') {
    const currentTotal = num(guvValues['sonstige_steuern']);
    const previousTotal = num(guvValues['vj_sonstige_steuern']);
    return guvSectionRequest(sectionId, 'Sonstige Steuern', currentTotal, previousTotal, {
      sonstige_steuern: currentTotal,
      vj_sonstige_steuern: previousTotal,
      zusammensetzung_vorhanden: false,
      wesentliche_einzelposten_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal], true);
  }

  if (sectionId === 'anhang.guv.jahresueberschuss') {
    const ebit = num(guvValues['betriebsergebnis']) || (num(guvValues['umsatzerloese']) + num(guvValues['bestandsveraenderung']) + num(guvValues['eigenleistungen']) + num(guvValues['sonstige_ertraege'])
      - num(guvValues['material_roh']) - num(guvValues['material_dienst']) - num(guvValues['loehne']) - num(guvValues['sozialabgaben'])
      - num(guvValues['abschreibungen']) - num(guvValues['sonstige_aufwendungen']));
    const currentTotal = num(guvValues['jahresueberschuss']) || (ebit + num(guvValues['beteiligungsertraege']) + num(guvValues['zinsertraege'])
      - num(guvValues['zinsaufwendungen']) - num(guvValues['abschr_finanzanlagen']) - num(guvValues['steuern_ertrag']) - num(guvValues['sonstige_steuern']));
    const previousTotal = num(guvValues['vj_jahresueberschuss']);
    return guvSectionRequest(sectionId, 'Jahresueberschuss', currentTotal, previousTotal, {
      jahresueberschuss: currentTotal,
      vj_jahresueberschuss: previousTotal,
      umsatzerloese: num(guvValues['umsatzerloese']),
      materialaufwand: num(guvValues['material_roh']) + num(guvValues['material_dienst']),
      personalaufwand: num(guvValues['loehne']) + num(guvValues['sozialabgaben']),
      sonstige_aufwendungen: num(guvValues['sonstige_aufwendungen']),
      finanzgebnis: num(guvValues['beteiligungsertraege']) + num(guvValues['zinsertraege']) - num(guvValues['zinsaufwendungen']) - num(guvValues['abschr_finanzanlagen']),
      steuern: num(guvValues['steuern_ertrag']) + num(guvValues['sonstige_steuern']),
      wesentliche_ergebnisursachen_vorhanden: false,
      sondereffekte_vorhanden: false,
      periodenfremde_effekte_vorhanden: false,
      gewinnverwendung_vorhanden: false,
      mainDrivers: [],
    }, [currentTotal, previousTotal]);
  }

  const currentTotal = (bilanz.anleihen || 0) + (bilanz.verbindlichkeiten_kreditinstitute || 0) + (bilanz.erhaltene_anzahlungen || 0) + (bilanz.verbindlichkeiten_llg || 0)
    + (bilanz.verbindlichkeiten_vbu || 0) + (bilanz.sonstige_verbindlichkeiten || 0);
  const previousTotal = bilanz.vj_verbindlichkeiten || 0;
  const roundedCurrentTotal = Math.round(currentTotal);
  const roundedPreviousTotal = Math.round(previousTotal);
  const roundedChangeAmount = Math.round(currentTotal - previousTotal);
  const facts = {
    verb_anleihen: bilanz.anleihen || 0,
    verb_bank: bilanz.verbindlichkeiten_kreditinstitute || 0,
    verb_erhaltene_anzahlungen: bilanz.erhaltene_anzahlungen || 0,
    verb_lieferungen: bilanz.verbindlichkeiten_llg || 0,
    verb_vbu: bilanz.verbindlichkeiten_vbu || 0,
    verb_sonstige: bilanz.sonstige_verbindlichkeiten || 0,
    vj_verbindlichkeiten: bilanz.vj_verbindlichkeiten || 0,
    restlaufzeitenspiegel_vorhanden: false,
    besicherungen_vorhanden: false,
    haftungsverhaeltnisse_vorhanden: false,
    restlaufzeiten_standardtext: 'Die Verbindlichkeiten haben eine Restlaufzeit von bis zu einem Jahr, soweit sich aus dem Verbindlichkeitenspiegel nichts anderes ergibt.',
    besicherungen_standardtext: 'Besicherungen bestehen nicht.',
    haftungsverhaeltnisse_standardtext: 'Haftungsverhältnisse bestehen nicht.',
    confirmationStatus: 'unconfirmed',
    currentTotal,
    previousTotal,
    changeAmount: currentTotal - previousTotal,
    changePercent: changePercent(currentTotal, previousTotal),
    roundedCurrentTotal,
    roundedPreviousTotal,
    roundedChangeAmount,
    amountFormat: 'TEUR ohne Nachkommastellen',
    mainDrivers: [],
    tableAlreadyShowsDetails: true,
    changeExplanation: null,
    unit: 'TEUR',
  };
  return {
    sectionId,
    title: 'Verbindlichkeiten',
    facts,
    requirements: [
      'Zusammensetzung der Verbindlichkeiten darstellen',
      'Veraenderung zum Vorjahr erlaeutern',
      'Verbindlichkeiten gegenueber Kreditinstituten und verbundenen Unternehmen gesondert erwaehnen',
      'Restlaufzeiten nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
      'Besicherungen nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
      'Haftungsverhaeltnisse nicht erfinden; wenn nicht vorhanden, in missingInputs nennen',
      'Nicht die Tabelle nacherzaehlen.',
      'Fokus auf Veraenderung, Wesentlichkeit und Auffaelligkeiten.',
      'Ursachen nur aus changeExplanation oder anderen Facts ableiten.',
      'Wenn keine Ursachen uebergeben wurden, in missingInputs ausweisen.',
      'Die Tabelle zeigt die Zusammensetzung bereits; im Text nicht alle Positionen wiederholen.',
      'Fokus auf Veraenderung in TEUR und Prozent.',
      'Offene Pruefhinweise nicht in den Textentwurf schreiben.',
    ],
    style,
    dataStatus: dataStatus([facts.verb_anleihen, facts.verb_bank, facts.verb_erhaltene_anzahlungen, facts.verb_lieferungen, facts.verb_vbu, facts.verb_sonstige, facts.vj_verbindlichkeiten]),
  };
}

type PreviewAccordionKey = 'valuation' | 'bilanz' | 'guv' | 'assistant';

export default function StepVorschau({ data, onChange, onArrayChange, onTransferReportText, onRegisterDemoTestRun }: StepProps) {
  const { stammdaten, guv, bilanz, kennzahlen, segmente, organe } = data;
  const [sectionStatus, setSectionStatus] = useState<Record<AssistantSectionId, SectionGenerationStatus>>({
    'anhang.bewertungsgrundsaetze': 'idle',
    'anhang.vorraete': 'idle',
    'anhang.forderungen': 'idle',
    'anhang.immaterielle_vermoegenswerte': 'idle',
    'anhang.sachanlagen': 'idle',
    'anhang.finanzanlagen': 'idle',
    'anhang.wertpapiere_uv': 'idle',
    'anhang.liquide_mittel': 'idle',
    'anhang.eigenkapital': 'idle',
    'anhang.rueckstellungen': 'idle',
    'anhang.verbindlichkeiten': 'idle',
    'anhang.guv.umsatzerloese': 'idle',
    'anhang.guv.bestandsveraenderung': 'idle',
    'anhang.guv.aktivierte_eigenleistungen': 'idle',
    'anhang.guv.sonstige_betriebliche_ertraege': 'idle',
    'anhang.guv.materialaufwand': 'idle',
    'anhang.guv.personalaufwand': 'idle',
    'anhang.guv.abschreibungen': 'idle',
    'anhang.guv.sonstige_betriebliche_aufwendungen': 'idle',
    'anhang.guv.beteiligungsertraege': 'idle',
    'anhang.guv.zinsertraege': 'idle',
    'anhang.guv.abschreibungen_finanzanlagen': 'idle',
    'anhang.guv.zinsaufwendungen': 'idle',
    'anhang.guv.steuern_einkommen_ertrag': 'idle',
    'anhang.guv.sonstige_steuern': 'idle',
    'anhang.guv.jahresueberschuss': 'idle',
  });
  const [sectionResults, setSectionResults] = useState<Partial<Record<AssistantSectionId, SectionTextResult>>>({});
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<AssistantSectionId, string>>>({});
  const [workbenchSettings, setWorkbenchSettings] = useState<Partial<Record<WorkbenchSectionId, WorkbenchSettings>>>({});
  const [testRunRunning, setTestRunRunning] = useState(false);
  const [testRunLog, setTestRunLog] = useState('');
  const [previewAccordionOpen, setPreviewAccordionOpen] = useState<Record<PreviewAccordionKey, boolean>>({
    valuation: false,
    bilanz: false,
    guv: false,
    assistant: false,
  });
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env;
  const showTestButton = viteEnv?.VITE_SHOW_DEMO_TEST_BUTTON !== 'false' && viteEnv?.VITE_SHOW_TEST_BUTTON !== 'false';
  const previewGroupKey = (group: 'Bewertungsgrundsaetze' | 'Bilanzabschnitte' | 'GuV-Abschnitte'): PreviewAccordionKey => {
    if (group === 'Bewertungsgrundsaetze') return 'valuation';
    if (group === 'GuV-Abschnitte') return 'guv';
    return 'bilanz';
  };
  const togglePreviewAccordion = (key: PreviewAccordionKey) => {
    setPreviewAccordionOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const ebit = guv.betriebsergebnis ||
    ((guv.umsatzerloese || 0) + (guv.bestandsveraenderung || 0) + (guv.eigenleistungen || 0) + (guv.sonstige_ertraege || 0)
     - (guv.material_roh || 0) - (guv.material_dienst || 0)
     - (guv.loehne || 0) - (guv.sozialabgaben || 0)
     - (guv.abschreibungen || 0) - (guv.sonstige_aufwendungen || 0));

  const jahresueber = guv.jahresueberschuss ||
    (ebit + (guv.beteiligungsertraege || 0) + (guv.zinsertraege || 0) - (guv.zinsaufwendungen || 0)
     - (guv.abschr_finanzanlagen || 0) - (guv.steuern_ertrag || 0) - (guv.sonstige_steuern || 0));

  const ekSumme = (bilanz.gezeichnetes_kapital || 0) + (bilanz.kapitalruecklage || 0)
    + (bilanz.gesetzliche_ruecklage || 0) + (bilanz.andere_gewinnruecklagen || 0) + (bilanz.bilanzgewinn || 0);

  const aktivSumme = (bilanz.immat_vw || 0) + (bilanz.sachanlagen || 0) + (bilanz.finanzanlagen || 0)
    + (bilanz.vorraete || 0) + (bilanz.forderungen_gesamt || 0) + (bilanz.wertpapiere_umlauf || 0)
    + (bilanz.liquide_mittel || 0) + (bilanz.aktiver_rao || 0) + (bilanz.aktive_latente_steuern || 0);

  const fmt = (n: number) => Number(n || 0).toLocaleString('de-DE');
  const pct = (a: number, b: number) => b > 0 ? (a / b * 100).toFixed(1) + ' %' : '-';

  const getWorkbenchSettings = (sectionId: WorkbenchSectionId, request: RequestSection): WorkbenchSettings => (
    workbenchSettings[sectionId] ?? {
      role: DEFAULT_WORKBENCH_ROLE,
      scope: 'mittel',
      temperature: 0.3,
      prompt: defaultWorkbenchPrompt(request),
    }
  );

  const updateWorkbenchSetting = <K extends keyof WorkbenchSettings>(
    sectionId: WorkbenchSectionId,
    request: RequestSection,
    field: K,
    value: WorkbenchSettings[K],
  ) => {
    const current = getWorkbenchSettings(sectionId, request);
    setWorkbenchSettings(prev => ({
      ...prev,
      [sectionId]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const requestSectionText = async (sectionId: AssistantSectionId, sourceData: JahresabschlussData): Promise<{ request: RequestSection; result: SectionTextResult }> => {
    const request = buildSectionTextRequest(sectionId, sourceData);
    const settings = isWorkbenchSection(sectionId) ? getWorkbenchSettings(sectionId, request) : null;
    const customPrompt = settings
      ? (settings.prompt.trim() || defaultWorkbenchPrompt(request))
      : undefined;
    const signature = settings
      ? generationSignature({ ...settings, prompt: customPrompt ?? settings.prompt })
      : undefined;
    const body = settings
      ? {
          ...request,
          role: settings.role,
          scope: settings.scope,
          temperature: settings.temperature,
          customPrompt,
        }
      : request;
    setSectionStatus(prev => ({ ...prev, [sectionId]: 'loading' }));
    setSectionErrors(prev => ({ ...prev, [sectionId]: '' }));
    setSectionResults(prev => ({ ...prev, [sectionId]: undefined }));

    try {
      const resp = await apiFetch('/api/ai/section-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.clone().json().catch(() => ({ error: resp.statusText }));
      if (!resp.ok) throw new Error(await readApiError(resp));
      const result: SectionTextResult = {
        text: json.text || '',
        paragraphs: Array.isArray(json.paragraphs) ? json.paragraphs : [],
        warnings: Array.isArray(json.warnings) ? json.warnings : [],
        missingInputs: Array.isArray(json.missingInputs) ? json.missingInputs : [],
        reviewQuestions: Array.isArray(json.reviewQuestions) ? json.reviewQuestions : [],
        usedFacts: Array.isArray(json.usedFacts) ? json.usedFacts : [],
        role: settings?.role,
        scope: settings?.scope,
        temperature: settings?.temperature,
        customPrompt,
        generatedAt: settings ? new Date().toISOString() : undefined,
        generationSignature: signature,
      };

      setSectionResults(prev => ({
        ...prev,
        [sectionId]: result,
      }));
      setSectionStatus(prev => ({ ...prev, [sectionId]: isFallbackResult(result) ? 'fallback' : 'done' }));
      return { request, result };
    } catch (err) {
      setSectionErrors(prev => ({ ...prev, [sectionId]: shortErrorMessage((err as Error).message) }));
      setSectionStatus(prev => ({ ...prev, [sectionId]: 'error' }));
      throw err;
    }
  };

  const createSectionDraft = async (sectionId: AssistantSectionId) => {
    await requestSectionText(sectionId, data).catch(() => undefined);
  };

  const makeReportTextEntry = (sectionId: WorkbenchSectionId, request: RequestSection, result: SectionTextResult): ReportTextEntry => {
    const settings = getWorkbenchSettings(sectionId, request);
    return {
      sectionId,
      text: result.text,
      paragraphs: result.paragraphs,
      status: 'transferred',
      role: result.role ?? settings.role,
      scope: result.scope ?? settings.scope,
      temperature: result.temperature ?? settings.temperature,
      customPrompt: result.customPrompt ?? settings.prompt,
      prompt: result.customPrompt ?? settings.prompt,
      transferredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      generationSignature: result.generationSignature ?? generationSignature(settings),
    };
  };

  const transferToReport = (sectionId: WorkbenchSectionId, request: RequestSection) => {
    const result = sectionResults[sectionId];
    if (!result || !onTransferReportText) return;

    onTransferReportText(makeReportTextEntry(sectionId, request, result));
  };

  const reportTextStatus = (sectionId: WorkbenchSectionId, request: RequestSection) => {
    const transferred = data.reportTexts?.[sectionId];
    if (!transferred) return 'Standardtext verwendet';

    const settings = getWorkbenchSettings(sectionId, request);
    const currentSignature = generationSignature({ ...settings, prompt: settings.prompt.trim() || defaultWorkbenchPrompt(request) });
    if (!transferred.generationSignature || transferred.generationSignature === currentSignature) {
      return 'In Bericht übernommen';
    }

    return 'Manuell zu prüfen';
  };

  const applyImportedDataToState = (imported: JahresabschlussData) => {
    (['stammdaten', 'guv', 'bilanz', 'kennzahlen'] as const).forEach(section => {
      Object.entries(imported[section] ?? {}).forEach(([field, value]) => {
        if (typeof value === 'string' || typeof value === 'number') onChange(section, field, value);
      });
    });
    (imported.segmente ?? []).forEach((segment: any, index: number) => {
      Object.entries(segment).forEach(([field, value]) => {
        if (typeof value === 'string' || typeof value === 'number') onArrayChange('segmente', index, field, value);
      });
    });
    (imported.organe?.vorstand ?? []).forEach((person: any, index: number) => {
      Object.entries(person).forEach(([field, value]) => {
        if (typeof value === 'string' || typeof value === 'number') onArrayChange('organe.vorstand', index, field, value);
      });
    });
    (imported.organe?.aufsichtsrat ?? []).forEach((person: any, index: number) => {
      Object.entries(person).forEach(([field, value]) => {
        if (typeof value === 'string' || typeof value === 'number') onArrayChange('organe.aufsichtsrat', index, field, value);
      });
    });
  };

  const mergeImportedData = (imported: JahresabschlussData): JahresabschlussData => ({
    ...data,
    stammdaten: { ...data.stammdaten, ...imported.stammdaten },
    segmente: imported.segmente?.length ? imported.segmente : data.segmente,
    guv: { ...data.guv, ...imported.guv },
    bilanz: { ...data.bilanz, ...imported.bilanz },
    kennzahlen: { ...data.kennzahlen, ...imported.kennzahlen },
    organe: {
      vorstand: imported.organe?.vorstand?.length ? imported.organe.vorstand : data.organe.vorstand,
      aufsichtsrat: imported.organe?.aufsichtsrat?.length ? imported.organe.aufsichtsrat : data.organe.aufsichtsrat,
    },
    beteiligungen: imported.beteiligungen?.length ? imported.beteiligungen : data.beteiligungen,
    reportTexts: {},
  });

  const downloadGeneratedZip = async (sourceData: JahresabschlussData) => {
    const resp = await apiFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sourceData),
    });
    if (!resp.ok) {
      throw new Error(await readApiError(resp));
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const company = (sourceData.stammdaten.firmenname || 'Jahresabschluss').replace(/\s+/g, '_');
    a.href = url;
    a.download = `${company}_Jahresabschluss_${sourceData.stammdaten.geschaeftsjahr}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const runExampleTestFlow = async () => {
    if (testRunRunning) return;
    setTestRunRunning(true);
    setTestRunLog('Testlauf läuft: Excel wird importiert...');
    try {
      const excelResp = await fetch('/testdata/Jahresabschluss_Eingabevorlage_Beispiel1.xlsx');
      if (!excelResp.ok) throw new Error('Beispiel-Excel konnte nicht geladen werden.');
      const excelBlob = await excelResp.blob();
      const importedData = await importExcelClient(new File([excelBlob], 'Jahresabschluss_Eingabevorlage_Beispiel1.xlsx'));

      setTestRunLog('Excel geladen');
      applyImportedDataToState(importedData);
      let workingData = mergeImportedData(importedData);
      const reportTexts: Record<string, ReportTextEntry> = {};
      const errors: string[] = [];

      for (let index = 0; index < EXAMPLE_TEST_WORKBENCH_SECTION_IDS.length; index += 1) {
        const sectionId = EXAMPLE_TEST_WORKBENCH_SECTION_IDS[index];
        const request = buildSectionTextRequest(sectionId, workingData);
        setTestRunLog(`Testlauf läuft: Abschnitt ${index + 1}/${EXAMPLE_TEST_WORKBENCH_SECTION_IDS.length} wird erzeugt (${request.title})...`);
        try {
          const generated = await requestSectionText(sectionId, workingData);
          const entry = makeReportTextEntry(sectionId, generated.request, generated.result);
          reportTexts[sectionId] = entry;
          onTransferReportText?.(entry);
          workingData = { ...workingData, reportTexts };
          setTestRunLog(`Excel geladen\nKI-Texte erzeugt: ${index + 1}/${EXAMPLE_TEST_WORKBENCH_SECTION_IDS.length}\nBericht übernommen: ${request.title}`);
        } catch (err) {
          errors.push(`${request.title}: ${shortErrorMessage((err as Error).message)}`);
        }
      }

      setTestRunLog(errors.length > 0
        ? `Testlauf: ${errors.length} Abschnitt(e) mit Fehler. Word-Dateien werden mit verfügbaren Texten generiert...`
        : 'Testlauf läuft: Word-Dateien werden generiert...');
      await downloadGeneratedZip({ ...workingData, reportTexts });
      setTestRunLog(errors.length > 0
        ? `Excel geladen\nKI-Texte erzeugt\nBericht übernommen\nWord-Berichte generiert\nFehler: ${errors.join(' | ')}`
        : 'Excel geladen\nKI-Texte erzeugt\nBericht übernommen\nWord-Berichte generiert');
    } catch (err) {
      setTestRunLog(`Testlauf Fehler: ${shortErrorMessage((err as Error).message)}`);
    } finally {
      setTestRunRunning(false);
    }
  };

  useEffect(() => {
    onRegisterDemoTestRun?.({
      run: runExampleTestFlow,
      running: testRunRunning,
      visible: showTestButton,
    });
    return () => onRegisterDemoTestRun?.(null);
  }, [testRunRunning, showTestButton, onRegisterDemoTestRun]);

  const renderReportTextOverview = () => {
    const statuses = REPORT_TEXT_SECTIONS.map(section => ({
      ...section,
      status: reportTextStatus(section.id, buildSectionTextRequest(section.id, data)),
    }));
    const hasReviewItems = statuses.some(section => section.status === 'Manuell zu prüfen');
    const hasValuationTexts = statuses.some(section => section.group === 'Bewertungsgrundsaetze' && section.status === 'In Bericht übernommen');

    return (
      <div style={styles.reportTextOverview}>
        <div style={styles.reportTextOverviewHeader}>
          <div style={styles.reportTextOverviewTitle}>Übernommene Berichtstexte</div>
          {hasReviewItems && (
            <div style={styles.reportTextOverviewWarning}>
              Einzelne Entwürfe wurden nach der Übernahme geändert und sollten vor dem Export erneut geprüft werden.
            </div>
          )}
          {!hasValuationTexts && (
            <div style={styles.reportTextOverviewWarning}>
              Fuer Bewertungsgrundsaetze wurden keine Werkbanktexte uebernommen. Der Export verwendet Mustertexte.
            </div>
          )}
        </div>
        {(['Bewertungsgrundsaetze', 'Bilanzabschnitte', 'GuV-Abschnitte'] as const).map(group => {
          const key = previewGroupKey(group);
          const groupStatuses = statuses.filter(section => section.group === group);

          return (
            <div key={group} style={styles.accordionPanel}>
              <button type="button" style={styles.accordionHeader} onClick={() => togglePreviewAccordion(key)}>
                <span style={styles.accordionTitle}>{assistantGroupLabel(group)}</span>
                <span style={styles.accordionMeta}>{groupStatuses.length} Abschnitte</span>
                <span style={styles.accordionToggle}>{previewAccordionOpen[key] ? 'Einklappen' : 'Aufklappen'}</span>
              </button>
              {previewAccordionOpen[key] && (
                <div style={styles.reportTextGrid}>
                  {groupStatuses.map(section => (
                    <div key={section.id} style={styles.reportTextStatusRow}>
                      <span style={styles.reportTextStatusTitle}>{section.title}</span>
                      <span
                        style={{
                          ...styles.reportTextStatusBadge,
                          ...(section.status === 'In Bericht übernommen'
                            ? styles.reportTextStatusDone
                            : section.status === 'Manuell zu prüfen'
                              ? styles.reportTextStatusChanged
                              : styles.reportTextStatusStandard),
                        }}
                      >
                        {section.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSectionAssistant = () => {
    const sectionsWithRequests = ASSISTANT_SECTIONS
      .map(section => ({ ...section, request: buildSectionTextRequest(section.id, data) }))
      .filter(section => section.group === 'Bilanzabschnitte' || section.group === 'Bewertungsgrundsaetze' || section.request.dataStatus !== 'fehlt');

    return (
      <div style={styles.sectionAssistant}>
        <button type="button" style={styles.accordionHeader} onClick={() => togglePreviewAccordion('assistant')}>
          <span style={styles.sectionAssistantTitle}>KI-Abschnittsassistent</span>
          <span style={styles.accordionMeta}>{sectionsWithRequests.length} Abschnitte</span>
          <span style={styles.accordionToggle}>{previewAccordionOpen.assistant ? 'Einklappen' : 'Aufklappen'}</span>
        </button>
        {previewAccordionOpen.assistant && (['Bewertungsgrundsaetze', 'Bilanzabschnitte', 'GuV-Abschnitte'] as const).map(group => {
          const groupSections = sectionsWithRequests.filter(section => section.group === group);
          if (groupSections.length === 0) return null;

          return (
            <div key={group}>
              <div style={styles.assistantGroupTitle}>{assistantGroupLabel(group)}</div>
              {groupSections.map(section => {
                const request = section.request;
                const result = sectionResults[section.id];
                const status = sectionStatus[section.id];
                const isWorkbench = isWorkbenchSection(section.id);
                const workbenchSectionId = isWorkbench ? section.id as WorkbenchSectionId : null;
                const settings = workbenchSectionId ? getWorkbenchSettings(workbenchSectionId, request) : null;
                const transferred = workbenchSectionId ? data.reportTexts?.[workbenchSectionId] : undefined;
                const currentSignature = settings
                  ? generationSignature({ ...settings, prompt: settings.prompt.trim() || defaultWorkbenchPrompt(request) })
                  : '';
                const isTransferredCurrent = Boolean(transferred && result?.generationSignature && transferred.generationSignature === result.generationSignature && currentSignature === result.generationSignature);
                const workbenchStatus = !workbenchSectionId
                  ? ''
                  : isTransferredCurrent
                    ? 'In Bericht übernommen'
                    : transferred
                      ? 'Entwurf geändert - nicht übernommen'
                      : 'Entwurf';

                return (
                  <div key={section.id} style={styles.assistantCard}>
                    <div style={styles.assistantHeader}>
                      <div>
                        <div style={styles.assistantSectionTitle}>{section.title}</div>
                        <div style={styles.assistantMeta}>Datenstatus: {request.dataStatus}</div>
                        <div style={styles.assistantMeta}>KI-Status: {sectionGenerationStatusLabel(status)}</div>
                        {isWorkbench && (
                          <>
                            <div style={styles.assistantMeta}>Status: {workbenchStatus}</div>
                            {transferred?.transferredAt && (
                              <div style={styles.assistantMeta}>Übernommen am: {formatTime(transferred.transferredAt)}</div>
                            )}
                            {result?.generatedAt && (
                              <div style={styles.assistantMeta}>
                                Letzte Generierung: {result.role || '-'} / {result.scope || '-'} / {result.temperature ?? '-'}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <div style={styles.assistantActions}>
                        <button
                          type="button"
                          onClick={() => createSectionDraft(section.id)}
                          disabled={status === 'loading'}
                          style={{
                            ...styles.sectionTestBtn,
                            opacity: status === 'loading' ? 0.7 : 1,
                            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {status === 'loading' ? 'Wird erzeugt...' : 'Textvorschlag erzeugen'}
                        </button>
                        {isWorkbench && (
                          <button
                            type="button"
                            onClick={() => workbenchSectionId && transferToReport(workbenchSectionId, request)}
                            disabled={!result}
                            style={{
                              ...styles.transferBtn,
                              opacity: result ? 1 : 0.55,
                              cursor: result ? 'pointer' : 'not-allowed',
                            }}
                          >
                            Übergabe in Bericht
                          </button>
                        )}
                      </div>
                    </div>

                    {isWorkbench && settings && (
                      <div style={styles.workbenchGrid}>
                        <label style={styles.workbenchField}>
                          <span style={styles.workbenchLabel}>Rolle</span>
                          <input
                            value={settings.role}
                            onChange={event => workbenchSectionId && updateWorkbenchSetting(workbenchSectionId, request, 'role', event.target.value)}
                            style={styles.workbenchInput}
                          />
                        </label>
                        <label style={styles.workbenchField}>
                          <span style={styles.workbenchLabel}>Umfang</span>
                          <select
                            value={settings.scope}
                            onChange={event => workbenchSectionId && updateWorkbenchSetting(workbenchSectionId, request, 'scope', event.target.value as WorkbenchSettings['scope'])}
                            style={styles.workbenchInput}
                          >
                            <option value="kurz">kurz</option>
                            <option value="mittel">mittel</option>
                            <option value="ausführlich">ausführlich</option>
                          </select>
                        </label>
                        <label style={styles.workbenchField}>
                          <span style={styles.workbenchLabel}>Temperatur</span>
                          <select
                            value={String(settings.temperature)}
                            onChange={event => workbenchSectionId && updateWorkbenchSetting(workbenchSectionId, request, 'temperature', Number(event.target.value))}
                            style={styles.workbenchInput}
                          >
                            <option value="0.1">0.1</option>
                            <option value="0.3">0.3</option>
                            <option value="0.6">0.6</option>
                          </select>
                        </label>
                        <label style={{ ...styles.workbenchField, ...styles.workbenchPromptField }}>
                          <span style={styles.workbenchLabel}>KI-Prompt</span>
                          <textarea
                            value={settings.prompt}
                            onChange={event => workbenchSectionId && updateWorkbenchSetting(workbenchSectionId, request, 'prompt', event.target.value)}
                            style={styles.workbenchPrompt}
                          />
                        </label>
                        {request.fallbackText && (
                          <div style={{ ...styles.workbenchField, ...styles.workbenchPromptField }}>
                            <span style={styles.workbenchLabel}>Mustertext / Rueckfalltext</span>
                            <div style={styles.explanationBox}>{request.fallbackText}</div>
                            <div style={styles.explanationLegend}>Mustertext wird verwendet, solange kein Werkbanktext in den Bericht uebernommen wurde.</div>
                          </div>
                        )}
                      </div>
                    )}

                    {status === 'error' && (
                      <div style={styles.sectionTestError}>{sectionErrors[section.id]}</div>
                    )}

                    {result && (
                      <div style={styles.sectionResult}>
                        <div style={styles.sectionResultLabel}>Erläuterungstext</div>
                        {result.paragraphs.length > 0 ? (
                          <div style={styles.explanationBox}>
                            {result.paragraphs.map((paragraph, index) => (
                              <div
                                key={index}
                                style={paragraph.type === 'unconfirmed' ? styles.unconfirmedTextPart : styles.confirmedTextPart}
                              >
                                {paragraph.text}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={styles.explanationBox}>{renderMarkedText(result.text)}</div>
                        )}
                        <div style={styles.explanationLegend}>Gelb markiert = unbestätigter oder noch zu ergänzender Textbestandteil.</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div style={styles.info}>
        <span style={styles.infoIcon}>i</span>
        <span>Bitte prüfen Sie alle Angaben. Anschließend werden die Freitexte erzeugt und die drei Word-Dokumente als ZIP-Download erstellt. Dieser Vorgang dauert ca. 30-60 Sekunden.</span>
      </div>

      {renderReportTextOverview()}

      {testRunLog && (
        <div style={styles.testRunBox}>
          <div style={styles.testRunLog}>{testRunLog}</div>
        </div>
      )}

      {renderSectionAssistant()}

      <div style={styles.cardGrid}>
        <Card title="Gesellschaft">
          <KV k="Firmenname" v={stammdaten.firmenname} />
          <KV k="Sitz" v={stammdaten.sitz} />
          <KV k="Branche" v={stammdaten.branche} />
          <KV k="GJ" v={stammdaten.geschaeftsjahr} />
          <KV k="ISIN" v={stammdaten.isin} />
          <KV k="Aktien" v={`${fmt(stammdaten.anzahl_aktien)} Stk.`} />
        </Card>

        <Card title="GuV Highlights">
          <KV k="Umsatz" v={`${fmt(guv.umsatzerloese)} TEUR`} />
          <KV k="EBIT" v={`${fmt(ebit)} TEUR`} />
          <KV k="EBIT-Marge" v={pct(ebit, guv.umsatzerloese)} />
          <KV k="Jahresüberschuss" v={`${fmt(jahresueber)} TEUR`} />
          <KV k="Dividende" v={`${(kennzahlen.dividende_je_aktie || 0).toFixed(2)} EUR/Aktie`} />
          <KV k="EPS" v={`${(kennzahlen.ergebnis_je_aktie || 0).toFixed(2)} EUR`} />
        </Card>

        <Card title="Bilanz Highlights">
          <KV k="Bilanzsumme" v={`${fmt(aktivSumme)} TEUR`} />
          <KV k="Eigenkapital" v={`${fmt(ekSumme)} TEUR`} />
          <KV k="EK-Quote" v={pct(ekSumme, aktivSumme)} />
          <KV k="Liquide Mittel" v={`${fmt(bilanz.liquide_mittel)} TEUR`} />
          <KV k="Anleihen" v={`${fmt(bilanz.anleihen)} TEUR`} />
          <KV k="Pensionsrückst." v={`${fmt(bilanz.pensionsrueckstellungen)} TEUR`} />
        </Card>
      </div>

      <div style={styles.twoCol}>
        <Card title={`Segmente (${segmente.length})`}>
          {segmente.map((s: any, i: number) => <KV key={i} k={s.name || `Segment ${i + 1}`} v={`${fmt(s.umsatz)} TEUR`} />)}
        </Card>
        <Card title={`Vorstand (${organe.vorstand.length})`}>
          {organe.vorstand.map((v: any, i: number) => <KV key={i} k={v.name || '-'} v={v.funktion} />)}
        </Card>
      </div>

      <div style={styles.docList}>
        <div style={styles.docListTitle}>Es werden 3 Dokumente generiert:</div>
        {[
          { icon: 'LB', name: 'Lagebericht', desc: 'Grundlagen, Wirtschaftsbericht, Risiken & Chancen, Prognose' },
          { icon: 'BG', name: 'Bilanz & GuV', desc: 'Aktivseite, Passivseite, Gesamtkostenverfahren' },
          { icon: 'AN', name: 'Anhang', desc: 'Bilanzierungsgrundsätze, Erläuterungen, Pflichtangaben' },
        ].map(d => (
          <div key={d.name} style={styles.docItem}>
            <span style={styles.docIcon}>{d.icon}</span>
            <div>
              <div style={styles.docName}>{d.name}</div>
              <div style={styles.docDesc}>{d.desc}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={styles.card}><div style={styles.cardTitle}>{title}</div>{children}</div>;
}

function KV({ k, v }: { k: string; v: string | number }) {
  return (
    <div style={styles.kv}>
      <span style={styles.kvKey}>{k}</span>
      <span style={styles.kvVal}>{v || '-'}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  info: { display: 'flex', gap: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#1E40AF', alignItems: 'flex-start' },
  infoIcon: { fontSize: 16, flexShrink: 0, fontWeight: 700 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
  card: { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px' },
  cardTitle: { fontSize: 12, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' },
  kv: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 },
  kvKey: { fontSize: 12, color: '#6B7280', flexShrink: 0 },
  kvVal: { fontSize: 12, fontWeight: 600, color: '#111827', textAlign: 'right' },
  docList: { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 18px' },
  docListTitle: { fontSize: 12, fontWeight: 700, color: '#065F46', marginBottom: 10, textTransform: 'uppercase' },
  docItem: { display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 },
  docIcon: { fontSize: 20, flexShrink: 0 },
  docName: { fontSize: 13, fontWeight: 700, color: '#111827' },
  docDesc: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  reportTextOverview: { background: '#FFFFFF', border: '1px solid #E6E7E9', borderRadius: 16, padding: '14px 16px', marginBottom: 14 },
  reportTextOverviewHeader: { display: 'grid', gap: 6, marginBottom: 10 },
  reportTextOverviewTitle: { fontSize: 12, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase' },
  reportTextOverviewWarning: { fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 10px' },
  accordionPanel: { border: '1px solid #E6E7E9', borderRadius: 12, background: '#FFFFFF', marginTop: 8, overflow: 'hidden' },
  accordionHeader: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', border: 'none', background: '#FBFBFA', padding: '10px 12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  accordionTitle: { fontSize: 12, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase', flex: 1 },
  accordionMeta: { fontSize: 11, color: '#667085', fontWeight: 700, whiteSpace: 'nowrap' },
  accordionToggle: { fontSize: 11, color: '#344054', fontWeight: 700, whiteSpace: 'nowrap' },
  reportTextGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  reportTextStatusRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #E6E7E9', borderRadius: 12, padding: '7px 10px', background: '#FFFFFF' },
  reportTextStatusTitle: { fontSize: 12, color: '#111827', fontWeight: 600 },
  reportTextStatusBadge: { borderRadius: 999, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' },
  reportTextStatusDone: { color: '#065F46', background: '#D1FAE5' },
  reportTextStatusChanged: { color: '#92400E', background: '#FEF3C7' },
  reportTextStatusStandard: { color: '#92400E', background: '#FEF3C7' },
  reportTextStatusMissing: { color: '#991B1B', background: '#FEE2E2' },
  testRunBox: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 12px', marginBottom: 14 },
  testRunButton: { background: '#92400E', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' },
  testRunLog: { fontSize: 12, color: '#78350F', lineHeight: 1.4, whiteSpace: 'pre-wrap' },
  sectionAssistant: { marginTop: 14, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 18px' },
  sectionAssistantTitle: { fontSize: 12, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase', flex: 1 },
  assistantGroupTitle: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 8px' },
  assistantCard: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 10 },
  assistantHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 },
  assistantSectionTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },
  assistantMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  assistantActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  sectionTestBtn: { background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  transferBtn: { background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' },
  workbenchGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 },
  workbenchField: { display: 'grid', gap: 4 },
  workbenchPromptField: { gridColumn: '1 / -1' },
  workbenchLabel: { fontSize: 11, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase' },
  workbenchInput: { boxSizing: 'border-box', width: '100%', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', color: '#111827', background: '#FFFFFF' },
  workbenchPrompt: { boxSizing: 'border-box', width: '100%', minHeight: 92, resize: 'vertical', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontFamily: 'Consolas, monospace', lineHeight: 1.45, color: '#111827', background: '#FFFFFF' },
  sectionTestError: { background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 10px', color: '#B91C1C', fontSize: 12 },
  sectionResult: { display: 'grid', gap: 6 },
  sectionResultLabel: { fontSize: 11, fontWeight: 700, color: '#1F3864', textTransform: 'uppercase', marginTop: 4 },
  sectionResultList: { border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#111827', background: '#FFFFFF' },
  explanationBox: { border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, color: '#111827', background: '#FFFFFF', whiteSpace: 'pre-wrap' },
  confirmedTextPart: { marginBottom: 8 },
  unconfirmedTextPart: { display: 'block', marginBottom: 8, padding: '2px 4px', borderRadius: 4, color: '#713F12', background: '#FEF9C3' },
  inlineUnconfirmed: { padding: '1px 3px', borderRadius: 4, color: '#713F12', background: '#FEF9C3' },
  explanationLegend: { fontSize: 11, color: '#854D0E', marginTop: 2 },
  paragraphList: { display: 'grid', gap: 8 },
  confirmedParagraph: { border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, color: '#111827', background: '#FFFFFF' },
  unconfirmedParagraph: { border: '1px solid #FACC15', borderRadius: 8, padding: '10px 12px', fontSize: 13, lineHeight: 1.45, color: '#713F12', background: '#FEF9C3' },
  unconfirmedHint: { marginTop: 6, fontSize: 11, fontWeight: 700, color: '#854D0E' },
  sectionTestOutput: { width: '100%', minHeight: 110, resize: 'vertical', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 8, padding: 10, fontFamily: 'Consolas, monospace', fontSize: 12, color: '#111827', background: '#fff' },
};

