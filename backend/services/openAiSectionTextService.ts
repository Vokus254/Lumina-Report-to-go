import type { JahresabschlussData } from '../../packages/schema/src';

export type SectionTextParagraph = {
  type: 'confirmed' | 'unconfirmed';
  text: string;
  source: 'facts' | 'usual_text_block' | 'missing_input_notice' | 'user_input';
  requiresConfirmation: boolean;
};

export type SectionTextOutput = {
  sectionId: string;
  status: 'draft';
  text: string;
  paragraphs: SectionTextParagraph[];
  warnings: string[];
  missingInputs: string[];
  reviewQuestions: string[];
  usedFacts: string[];
};

export const SectionTextOutputSchema = {
  parse(value: unknown): SectionTextOutput {
    const data = value as Partial<SectionTextOutput>;
    const isStringArray = (arr: unknown): arr is string[] =>
      Array.isArray(arr) && arr.every(item => typeof item === 'string');
    const isParagraphArray = (arr: unknown): arr is SectionTextParagraph[] =>
      Array.isArray(arr) && arr.every(item => {
        const paragraph = item as Partial<SectionTextParagraph>;
        return (
          (paragraph.type === 'confirmed' || paragraph.type === 'unconfirmed') &&
          typeof paragraph.text === 'string' &&
          (paragraph.source === 'facts' || paragraph.source === 'usual_text_block' || paragraph.source === 'missing_input_notice' || paragraph.source === 'user_input') &&
          typeof paragraph.requiresConfirmation === 'boolean' &&
          (paragraph.type !== 'unconfirmed' || paragraph.requiresConfirmation === true)
        );
      });

    if (
      typeof data?.sectionId !== 'string' ||
      data.status !== 'draft' ||
      typeof data.text !== 'string' ||
      !isParagraphArray(data.paragraphs) ||
      !isStringArray(data.warnings) ||
      !isStringArray(data.missingInputs) ||
      !isStringArray(data.reviewQuestions) ||
      !isStringArray(data.usedFacts)
    ) {
      throw new Error('Invalid SectionTextOutput');
    }

    return {
      sectionId: data.sectionId,
      status: data.status,
      text: data.text,
      paragraphs: data.paragraphs,
      warnings: data.warnings,
      missingInputs: data.missingInputs,
      reviewQuestions: data.reviewQuestions,
      usedFacts: data.usedFacts,
    };
  },
};

export type GenerateSectionTextInput = {
  sectionId: string;
  title?: string;
  facts?: Record<string, unknown> | string[];
  requirements?: string[];
  missingInputs?: string[];
  style?: string;
  role?: string;
  scope?: 'kurz' | 'mittel' | 'ausführlich';
  temperature?: number | string;
  customPrompt?: string;
};

export type AnhangSectionTexts = Partial<Record<string, SectionTextOutput>>;

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_TEMPERATURE = 0.3;

type SectionPromptRules = {
  textGoal: string;
  doNotRepeatTable: string;
  focus: string[];
  mandatoryReviewPoints: string[];
  forbiddenClaims: string[];
  missingInputRules: string[];
  outputGuidance?: string[];
  usualTextBlocks?: string[];
};

function guvSectionRules(config: {
  title: string;
  confirmedFocus: string[];
  reviewPoints: string[];
  forbiddenClaims?: string[];
  usualTextBlocks: string[];
  missingInputText: string;
}): SectionPromptRules {
  return {
    textGoal: `Erstelle den Erlaeuterungstext fuer den GuV-Anhangabschnitt "${config.title}".`,
    doNotRepeatTable: 'Der Text steht unter einer GuV-Tabelle oder Detailtabelle. Die Tabelle zeigt die Werte bereits; wiederhole daher nicht die vollstaendige GuV-Tabelle.',
    focus: [
      'Aktuellen Wert nennen.',
      'Vorjahreswert nennen, falls vorhanden.',
      'Veraenderung in TEUR nennen.',
      'Veraenderung in Prozent mit einer Nachkommastelle nennen, falls ein Vorjahreswert vorhanden ist.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Wenn der Vorjahreswert 0 ist, keine Prozentzahl ausgeben, sondern schreiben: "im Vorjahr kein entsprechender Betrag ausgewiesen".',
      'Ergebniswirkung knapp einordnen.',
      'Wesentliche Treiber und Auffaelligkeiten knapp nennen.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Alle Betraege in TEUR.',
      ...config.confirmedFocus,
    ],
    mandatoryReviewPoints: config.reviewPoints,
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Ursachen, Sondereffekte und Managementbegruendungen muessen als type="unconfirmed" geliefert werden, solange sie nicht als bestaetigter Fact uebergeben wurden.',
      'Keine technischen Feldnamen im Text verwenden.',
      'Keine sichtbaren Markierungen oder Tags wie [gelb], HTML oder Markdown verwenden.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      ...(config.forbiddenClaims ?? []),
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      `Beispiel: "${config.missingInputText}"`,
    ],
    outputGuidance: [
      'Confirmed paragraphs: aktueller Wert, Vorjahreswert, Veraenderung in TEUR, Veraenderung in Prozent, Ergebniswirkung und knapp belegte Auffaelligkeiten.',
      'Unconfirmed paragraphs: uebliche Ursachen, Sondereffekte und Managementbegruendungen nur als type="unconfirmed", source="usual_text_block", requiresConfirmation=true.',
      'Missing-input paragraphs: fehlende pruefungsrelevante Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true.',
      'Unbestaetigte paragraphs als normale Erlaeuterungssaetze formulieren; keine Worte wie "kann", "moeglicherweise", "als moegliche Erlaeuterung" oder "zu bestaetigen" verwenden.',
      'usedFacts enthaelt nur tatsaechlich verwendete Fact-Keys.',
    ],
    usualTextBlocks: config.usualTextBlocks,
  };
}

const valuationRuleTitles: Record<string, string> = {
  'anhang.bewertung.allgemeine_grundlagen': 'Allgemeine Bewertungsgrundsaetze',
  'anhang.bewertung.immaterielle_vermoegenswerte': 'Immaterielle Vermoegenswerte',
  'anhang.bewertung.sachanlagen': 'Sachanlagen',
  'anhang.bewertung.finanzanlagen': 'Finanzanlagen',
  'anhang.bewertung.vorraete': 'Vorraete',
  'anhang.bewertung.forderungen': 'Forderungen und sonstige Vermoegensgegenstaende',
  'anhang.bewertung.wertpapiere_uv': 'Wertpapiere des Umlaufvermoegens',
  'anhang.bewertung.liquide_mittel': 'Liquide Mittel',
  'anhang.bewertung.aktive_rechnungsabgrenzung': 'Aktive Rechnungsabgrenzung',
  'anhang.bewertung.aktive_latente_steuern': 'Latente Steuern',
  'anhang.bewertung.eigenkapital': 'Eigenkapital',
  'anhang.bewertung.rueckstellungen': 'Rueckstellungen',
  'anhang.bewertung.verbindlichkeiten': 'Verbindlichkeiten',
  'anhang.bewertung.passive_rechnungsabgrenzung': 'Passive Rechnungsabgrenzung',
  'anhang.bewertung.umsatzerloese': 'Umsatzerloese',
  'anhang.bewertung.bestandsveraenderungen': 'Bestandsveraenderungen',
  'anhang.bewertung.aktivierte_eigenleistungen': 'Aktivierte Eigenleistungen',
  'anhang.bewertung.sonstige_betriebliche_ertraege': 'Sonstige betriebliche Ertraege',
  'anhang.bewertung.materialaufwand': 'Materialaufwand',
  'anhang.bewertung.personalaufwand': 'Personalaufwand',
  'anhang.bewertung.abschreibungen': 'Abschreibungen',
  'anhang.bewertung.sonstige_betriebliche_aufwendungen': 'Sonstige betriebliche Aufwendungen',
  'anhang.bewertung.beteiligungsertraege': 'Beteiligungsertraege',
  'anhang.bewertung.zinsertraege': 'Zinsertraege',
  'anhang.bewertung.abschreibungen_finanzanlagen': 'Abschreibungen auf Finanzanlagen',
  'anhang.bewertung.zinsaufwendungen': 'Zinsaufwendungen',
  'anhang.bewertung.steuern_einkommen_ertrag': 'Steuern vom Einkommen und Ertrag',
  'anhang.bewertung.sonstige_steuern': 'Sonstige Steuern',
  'anhang.bewertung.jahresueberschuss': 'Jahresueberschuss',
};

function valuationSectionRules(title: string): SectionPromptRules {
  return {
    textGoal: `Erstelle den Bewertungsmethodentext fuer A.2 "${title}".`,
    doNotRepeatTable: 'Dieser Abschnitt betrifft Bilanzierungs- und Bewertungsmethoden. Keine Tabellenanalyse, keine Zahlenanalyse und keine Veraenderungsanalyse.',
    focus: [
      'Text soll fuer den Anhang geeignet sein.',
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die als Fact oder Parameter ausdruecklich vorhanden sind.',
      'Uebliche Bewertungsmethoden muessen als type="unconfirmed", source="usual_text_block", requiresConfirmation=true geliefert werden, solange sie nicht bestaetigt sind.',
      'Fehlende Bewertungsparameter als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Normverweise mit § schreiben, nicht "Paragraph".',
      'Geschaeftsjahr und Bilanzstichtag nur aus Facts uebernehmen; keine Jahre erfinden.',
      'Keine konkreten Nutzungsdauern, Prozentsaetze, Zinssaetze oder Vereinfachungsregeln als confirmed, wenn nicht bestaetigt.',
    ],
    mandatoryReviewPoints: ['Bewertungsmethode', 'konkrete Bewertungsparameter', 'Stetigkeit', 'Ausnahmen oder Besonderheiten'],
    forbiddenClaims: [
      'Keine sichtbaren [gelb]-Tags, kein HTML und kein Markdown.',
      'Keine technischen Feldnamen im Text.',
      'Keine Tabellen- oder Veraenderungsanalyse.',
      'Keine unbestaetigten Bewertungsmethoden im confirmed paragraph.',
      'Keine konkreten Nutzungsdauern, Prozentsaetze, Zinssaetze oder Vereinfachungsregeln im confirmed paragraph, wenn nicht bestaetigt.',
    ],
    missingInputRules: [
      'Fehlende Parameter als lesbaren unconfirmed paragraph mit source="missing_input_notice" formulieren.',
      'Der Mustertext darf als fachlicher Ausgangspunkt dienen, gilt aber nicht automatisch als confirmed.',
    ],
    usualTextBlocks: [
      'Der uebergebene Mustertext kann als ueblicher, noch freizugebender Bewertungsbaustein verwendet werden.',
    ],
  };
}

const valuationPromptRules = Object.fromEntries(
  Object.entries(valuationRuleTitles).map(([sectionId, title]) => [sectionId, valuationSectionRules(title)]),
) as Record<string, SectionPromptRules>;

export const SECTION_PROMPT_RULES: Record<string, SectionPromptRules> = {
  ...valuationPromptRules,
  'anhang.bewertungsgrundsaetze': {
    textGoal: 'Erstelle den Anhangtext fuer A.2 "Bilanzierungs- und Bewertungsgrundsaetze".',
    doNotRepeatTable: 'Dieser Abschnitt steht vor den Einzelpositionen und enthaelt keine Zahlentabelle; formuliere allgemeine Bilanzierungs- und Bewertungsgrundsaetze ohne Detailzahlen.',
    focus: [
      'Confirmed paragraphs duerfen nur allgemeine, durch Facts belegte Angaben enthalten: Rechnungslegung nach HGB, Bilanzgliederung, GuV-Gliederung, Geschaeftsjahr, Bilanzstichtag, Rechtsform und GuV-Verfahren.',
      'Konkrete Bewertungsmethoden duerfen im confirmed paragraph nur genannt werden, wenn sie ausdruecklich als bestaetigte Facts vorliegen.',
      'Ohne bestaetigte Bewertungsfacts sollen Bewertungsgrundsaetze als type="unconfirmed", source="usual_text_block" oder source="missing_input_notice", requiresConfirmation=true formuliert werden.',
      'Der bestaetigte Text soll knapp und neutral sein.',
      'Unconfirmed paragraphs sollen lesbare Standardbausteine fuer noch zu pruefende Bewertungsgrundsaetze enthalten.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    mandatoryReviewPoints: [
      'Fortfuehrungsannahme',
      'Bewertungsstetigkeit',
      'immaterielle Vermoegenswerte',
      'Sachanlagen',
      'Vorraete',
      'Forderungen',
      'Wertpapiere',
      'liquide Mittel',
      'Eigenkapital',
      'Rueckstellungen',
      'Verbindlichkeiten',
      'Rechnungsabgrenzung',
    ],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Nutzungsdauern, planmaessigen Abschreibungen, AfA-Tabellen, Geringwertigen Wirtschaftsguetern, Pauschalwertberichtigungen, Abzinsung, Niederstwertprinzip, Anschaffungs- oder Herstellungskosten oder Rueckstellungsbewertung in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Die Formulierungen "Nutzungsdauer von drei bis fuenf Jahren", "Pauschalwertberichtigung", "AfA-Tabellen" und "Geringwertige Wirtschaftsgueter bis 800 EUR" duerfen nicht erscheinen, solange sie nicht ausdruecklich bestaetigt sind.',
      'Keine Normzitate ausser den als Facts uebergebenen Gliederungsnormen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende konkrete Bewertungsparameter als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu Nutzungsdauern, Abschreibungsmethoden, Wertberichtigungen, Bewertungsvereinfachungen, Rueckstellungsbewertung und Abzinsung sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Immaterielle Vermoegenswerte und Sachanlagen werden zu Anschaffungs- oder Herstellungskosten angesetzt und, soweit abnutzbar, planmaessig ueber die betriebsgewoehnliche Nutzungsdauer abgeschrieben.',
      'Vorraete werden zu Anschaffungs- oder Herstellungskosten unter Beachtung des Niederstwertprinzips bewertet.',
      'Forderungen und sonstige Vermoegensgegenstaende werden mit dem Nennwert angesetzt; erkennbare Einzelrisiken und allgemeine Kreditrisiken werden durch Wertberichtigungen beruecksichtigt.',
      'Rueckstellungen werden in Hoehe des nach vernuenftiger kaufmaennischer Beurteilung notwendigen Erfuellungsbetrags angesetzt.',
      'Verbindlichkeiten werden mit dem Erfuellungsbetrag angesetzt.',
      'Angaben zu Nutzungsdauern, Abschreibungsmethoden, Wertberichtigungen, Bewertungsvereinfachungen, Rueckstellungsbewertung und Abzinsung sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
    ],
  },
  'anhang.guv.umsatzerloese': guvSectionRules({
    title: 'Umsatzerloese',
    confirmedFocus: [
      'Umsatz aktuelles Jahr, Vorjahr und Veraenderung nennen.',
      'Veraenderung als Wachstum oder Rueckgang einordnen.',
    ],
    reviewPoints: ['Umsatzaufgliederung', 'Taetigkeitsbereiche', 'Regionen', 'Kundengruppen', 'Preis-/Mengeneffekte'],
    forbiddenClaims: ['Keine Segment-, Preis-, Mengen- oder Kundenaussagen ohne bestaetigte Facts.'],
    usualTextBlocks: [
      'Der Umsatzanstieg resultiert aus hoeherem Absatzvolumen, Preissteigerungen und einer Ausweitung des Projektgeschaefts.',
      'Der Umsatzrueckgang resultiert aus geringerer Nachfrage, Projektverschiebungen oder reduziertem Auftragsvolumen.',
    ],
    missingInputText: 'Angaben zur Umsatzaufgliederung nach Taetigkeitsbereichen, Regionen, Kundengruppen sowie zu Preis-/Mengeneffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.bestandsveraenderung': guvSectionRules({
    title: 'Bestandsveraenderung',
    confirmedFocus: [
      'Bestandsveraenderung nennen und Ergebniswirkung einordnen.',
      'Positive Bestandsveraenderung wirkt ergebniserhoehend, negative ergebnismindernd.',
    ],
    reviewPoints: ['Ursachen der Bestandsveraenderung', 'Abgrenzung unfertige Erzeugnisse', 'Abgrenzung fertige Erzeugnisse'],
    usualTextBlocks: [
      'Die Bestandsveraenderung resultiert aus dem Aufbau beziehungsweise Abbau unfertiger und fertiger Erzeugnisse im Zusammenhang mit der Produktions- und Auslieferungsplanung.',
    ],
    missingInputText: 'Angaben zu den Ursachen der Bestandsveraenderung und zur Abgrenzung der unfertigen und fertigen Erzeugnisse sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.aktivierte_eigenleistungen': guvSectionRules({
    title: 'Aktivierte Eigenleistungen',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung als aktivierte Eigenleistung einordnen.',
    ],
    reviewPoints: ['Art der aktivierten Eigenleistungen', 'Aktivierungskriterien', 'Abgrenzung zu laufendem Aufwand'],
    usualTextBlocks: [
      'Die aktivierten Eigenleistungen betreffen interne Entwicklungs-, Projekt- oder Herstellungsleistungen, die den aktivierungsfaehigen Vermoegenswerten zugeordnet wurden.',
    ],
    missingInputText: 'Angaben zur Art der aktivierten Eigenleistungen, Aktivierungskriterien und Abgrenzung zu laufendem Aufwand sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.sonstige_betriebliche_ertraege': guvSectionRules({
    title: 'Sonstige betriebliche Ertraege',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Wesentliche Veraenderung knapp einordnen.',
    ],
    reviewPoints: ['wesentliche Einzelposten', 'periodenfremde Ertraege', 'Erstattungen', 'Ertraege aus Aufloesung von Rueckstellungen'],
    forbiddenClaims: ['Keine Einmaleffekte behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: [
      'Die sonstigen betrieblichen Ertraege enthalten Ertraege aus Aufloesungen von Rueckstellungen, periodenfremde Ertraege, Erstattungen oder sonstige Einmaleffekte.',
    ],
    missingInputText: 'Angaben zu wesentlichen Einzelposten, periodenfremden Ertraegen, Erstattungen und Ertraegen aus der Aufloesung von Rueckstellungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.materialaufwand': guvSectionRules({
    title: 'Materialaufwand',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Veraenderung im Verhaeltnis zu Umsatz einordnen, falls Umsatz-Facts vorhanden sind.',
      'Ergebniswirkung nennen: Aufwandserhoehung ergebnismindernd, Aufwandsrueckgang ergebnisverbessernd.',
    ],
    reviewPoints: ['Preis-/Mengeneffekte', 'Lieferantenstruktur', 'bezogene Leistungen', 'Materialquote'],
    usualTextBlocks: [
      'Die Veraenderung des Materialaufwands resultiert aus Mengen-, Preis- und Mixeffekten sowie aus Veraenderungen im Leistungsbezug.',
    ],
    missingInputText: 'Angaben zu Preis-/Mengeneffekten, Lieferantenstruktur, bezogenen Leistungen und Materialquote sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.personalaufwand': guvSectionRules({
    title: 'Personalaufwand',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen: Aufwandserhoehung ergebnismindernd, Aufwandsrueckgang ergebnisverbessernd.',
      'Wenn Loehne/Gehaelter und soziale Abgaben als Facts vorhanden sind, Haupttreiber knapp nennen.',
    ],
    reviewPoints: ['durchschnittliche Mitarbeiterzahl', 'Verguetungsstruktur', 'variable Verguetungen', 'Sozialabgaben', 'Einmaleffekte'],
    usualTextBlocks: [
      'Der Anstieg des Personalaufwands resultiert aus tariflichen Anpassungen, hoeherer Mitarbeiterzahl, variablen Verguetungsbestandteilen oder strukturellen Veraenderungen.',
      'Der Rueckgang des Personalaufwands resultiert aus geringerer Mitarbeiterzahl, geringeren variablen Verguetungen oder organisatorischen Anpassungen.',
    ],
    missingInputText: 'Angaben zur durchschnittlichen Mitarbeiterzahl, Verguetungsstruktur, variablen Verguetungen, Sozialabgaben und Einmaleffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.abschreibungen': guvSectionRules({
    title: 'Abschreibungen',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen.',
    ],
    reviewPoints: ['planmaessige Abschreibungen', 'ausserplanmaessige Abschreibungen', 'Nutzungsdauern', 'wesentliche Neuinvestitionen'],
    forbiddenClaims: ['Keine ausserplanmaessigen Abschreibungen behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: [
      'Die Abschreibungen betreffen planmaessige Abschreibungen auf immaterielle Vermoegenswerte und Sachanlagen.',
      'Ein Anstieg resultiert aus Investitionen und dem Beginn der planmaessigen Abschreibung neuer Vermoegenswerte.',
    ],
    missingInputText: 'Angaben zu planmaessigen und ausserplanmaessigen Abschreibungen, Nutzungsdauern und wesentlichen Neuinvestitionen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.sonstige_betriebliche_aufwendungen': guvSectionRules({
    title: 'Sonstige betriebliche Aufwendungen',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen.',
    ],
    reviewPoints: ['wesentliche Einzelposten', 'periodenfremde Aufwendungen', 'Beratungsaufwendungen', 'IT-Kosten', 'Miet-/Raumkosten', 'Einmaleffekte'],
    forbiddenClaims: ['Keine Einzelposten behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: [
      'Die sonstigen betrieblichen Aufwendungen enthalten im Wesentlichen Verwaltungs-, Vertriebs-, Raum-, IT-, Beratungs- und sonstige Gemeinkosten.',
      'Veraenderungen resultieren aus Kostensteigerungen, Projektaufwendungen oder stichtagsbedingten Abgrenzungen.',
    ],
    missingInputText: 'Angaben zu wesentlichen Einzelposten, periodenfremden Aufwendungen, Beratungsaufwendungen, IT-Kosten, Miet-/Raumkosten und Einmaleffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.beteiligungsertraege': guvSectionRules({
    title: 'Beteiligungsertraege',
    confirmedFocus: ['Betrag und Veraenderung nennen.'],
    reviewPoints: ['Herkunft', 'Ausschuettungsbeschluesse', 'verbundene Unternehmen', 'Einmaleffekte'],
    forbiddenClaims: ['Keine Dividendenaussagen ohne bestaetigte Facts.'],
    usualTextBlocks: ['Beteiligungsertraege resultieren aus Ausschuettungen oder Ergebnisabfuehrungen aus Beteiligungen.'],
    missingInputText: 'Angaben zu Herkunft, Ausschuettungsbeschluessen, verbundenen Unternehmen und Einmaleffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.zinsertraege': guvSectionRules({
    title: 'Zinsertraege',
    confirmedFocus: ['Betrag und Veraenderung nennen.'],
    reviewPoints: ['Zinsquellen', 'Geldanlagen', 'Ausleihungen', 'Einmaleffekte'],
    forbiddenClaims: ['Keine Anlagepolitik behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: ['Zinsertraege resultieren aus Bankguthaben, kurzfristigen Geldanlagen oder Ausleihungen.'],
    missingInputText: 'Angaben zu Zinsquellen, Geldanlagen, Ausleihungen und Einmaleffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.abschreibungen_finanzanlagen': guvSectionRules({
    title: 'Abschreibungen auf Finanzanlagen',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen.',
    ],
    reviewPoints: ['betroffene Finanzanlagen', 'Werthaltigkeit', 'Bewertungsanlaesse', 'Dauerhaftigkeit der Wertminderung'],
    forbiddenClaims: ['Keine Wertminderung behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: ['Abschreibungen auf Finanzanlagen resultieren aus Wertminderungen bei Beteiligungen, Ausleihungen oder Wertpapieren.'],
    missingInputText: 'Angaben zu betroffenen Finanzanlagen, Werthaltigkeit, Bewertungsanlaessen und Dauerhaftigkeit der Wertminderung sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.zinsaufwendungen': guvSectionRules({
    title: 'Zinsaufwendungen',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen.',
    ],
    reviewPoints: ['Finanzierungsstruktur', 'Zinssaetze', 'Darlehen', 'Anleihen', 'Zinsaenderungseffekte'],
    usualTextBlocks: [
      'Zinsaufwendungen resultieren aus Bankdarlehen, Anleihen, Leasing- oder sonstigen Finanzierungsverbindlichkeiten.',
      'Ein Anstieg resultiert aus hoeherem Zinsniveau oder hoeherer durchschnittlicher Verschuldung.',
    ],
    missingInputText: 'Angaben zu Finanzierungsstruktur, Zinssaetzen, Darlehen, Anleihen und Zinsaenderungseffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.steuern_einkommen_ertrag': guvSectionRules({
    title: 'Steuern vom Einkommen und Ertrag',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Steueraufwand im Verhaeltnis zum Ergebnis vor Steuern einordnen, falls EBT-Fact vorhanden ist.',
    ],
    reviewPoints: ['steuerliche Ueberleitungsrechnung', 'laufende Steuern', 'latente Steuern', 'periodenfremde Steuern', 'steuerliche Sondereffekte'],
    forbiddenClaims: ['Keine latenten Steuern behaupten ohne bestaetigte Facts.'],
    usualTextBlocks: ['Der Steueraufwand resultiert aus laufenden Ertragsteuern und stichtagsbezogenen steuerlichen Abgrenzungen.'],
    missingInputText: 'Angaben zur steuerlichen Ueberleitungsrechnung, laufenden Steuern, latenten Steuern, periodenfremden Steuern und steuerlichen Sondereffekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.sonstige_steuern': guvSectionRules({
    title: 'Sonstige Steuern',
    confirmedFocus: [
      'Betrag und Veraenderung nennen.',
      'Ergebniswirkung nennen.',
    ],
    reviewPoints: ['Zusammensetzung', 'wesentliche Einzelposten'],
    usualTextBlocks: ['Sonstige Steuern betreffen insbesondere nicht ertragsabhaengige Steuern wie Grundsteuer, Kfz-Steuer oder sonstige betriebliche Steueraufwendungen.'],
    missingInputText: 'Angaben zur Zusammensetzung und zu wesentlichen Einzelposten der sonstigen Steuern sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.guv.jahresueberschuss': guvSectionRules({
    title: 'Jahresueberschuss',
    confirmedFocus: [
      'Jahresueberschuss aktuelles Jahr, Vorjahr und Veraenderung nennen.',
      'Ergebnisentwicklung knapp einordnen.',
      'Haupttreiber aus Umsatz, Materialaufwand, Personalaufwand, sonstigen Aufwendungen, Finanzergebnis und Steuern nur nennen, wenn Facts vorhanden sind.',
    ],
    reviewPoints: ['wesentliche Ergebnisursachen', 'Sondereffekte', 'periodenfremde Effekte', 'Gewinnverwendung'],
    usualTextBlocks: [
      'Die Ergebnisentwicklung ist im Wesentlichen durch die operative Umsatz- und Kostenentwicklung sowie das Finanzergebnis gepraegt.',
      'Eine Verbesserung resultiert aus hoeherer operativer Leistung und stabiler Kostenstruktur.',
      'Eine Verschlechterung resultiert aus hoeheren Kosten, geringerer Marge oder gestiegenen Finanzierungsaufwendungen.',
    ],
    missingInputText: 'Angaben zu wesentlichen Ergebnisursachen, Sondereffekten, periodenfremden Effekten und Gewinnverwendung sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
  }),
  'anhang.immaterielle_vermoegenswerte': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Immaterielle Vermoegenswerte".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Tabellenstruktur.',
    focus: [
      'Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Veraenderung in TEUR und Prozent nennen.',
      'Wesentliche Veraenderung knapp einordnen.',
      'Wenn Unterpositionen als Facts vorhanden sind, hoechstens Haupttreiber nennen, nicht Tabelle nacherzaehlen.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['Nutzungsdauern', 'Abschreibungsmethoden', 'aktivierte Eigenleistungen', 'Entwicklungskosten', 'ausserplanmaessige Abschreibungen'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Nutzungsdauern, Abschreibungsmethoden, aktivierten Eigenleistungen, Entwicklungskosten oder ausserplanmaessigen Abschreibungen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu Nutzungsdauern, Abschreibungsmethoden, aktivierten Eigenleistungen, Entwicklungskosten und ausserplanmaessigen Abschreibungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Der Anstieg der immateriellen Vermoegenswerte resultiert aus Investitionen in Software, Lizenzen und digitale Anwendungen.',
      'Der Rueckgang der immateriellen Vermoegenswerte resultiert aus planmaessigen Abschreibungen.',
      'Aktivierte Entwicklungskosten betreffen selbst erstellte immaterielle Vermoegenswerte im Zusammenhang mit internen Entwicklungsprojekten.',
    ],
  },
  'anhang.sachanlagen': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Sachanlagen".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte der Sachanlagen. Wiederhole daher nicht die vollstaendige Tabelle.',
    focus: [
      'Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Veraenderung in TEUR und Prozent nennen.',
      'Haupttreiber knapp nennen, zum Beispiel Grundstuecke und Gebaeude, technische Anlagen, Betriebs- und Geschaeftsausstattung oder Anlagen im Bau.',
      'Tabelle nicht nacherzaehlen.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['wesentliche Zugaenge', 'Abgaenge', 'Abschreibungsmethoden', 'Nutzungsdauern', 'ausserplanmaessige Abschreibungen', 'aktivierte Eigenleistungen'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Zugaengen, Abgaengen, Abschreibungsmethoden, Nutzungsdauern, ausserplanmaessigen Abschreibungen oder aktivierten Eigenleistungen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu wesentlichen Zugaengen, Abgaengen, Abschreibungsmethoden, Nutzungsdauern, ausserplanmaessigen Abschreibungen und aktivierten Eigenleistungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Der Anstieg der Sachanlagen resultiert aus Investitionen in technische Anlagen, Betriebs- und Geschaeftsausstattung sowie laufende Bau- und Erweiterungsmassnahmen.',
      'Der Rueckgang der Sachanlagen resultiert aus planmaessigen Abschreibungen und Anlagenabgaengen.',
      'Anlagen im Bau betreffen noch nicht abgeschlossene Investitionsmassnahmen, die nach Fertigstellung in die entsprechenden Anlagenklassen umgegliedert werden.',
    ],
  },
  'anhang.finanzanlagen': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Finanzanlagen".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Finanzanlagentabelle.',
    focus: [
      'Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Veraenderung in TEUR und Prozent nennen.',
      'Haupttreiber knapp nennen, zum Beispiel Anteile an verbundenen Unternehmen, Ausleihungen oder Beteiligungen.',
      'Keine Aussagen zu Werthaltigkeit ohne bestaetigte Facts.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['Werthaltigkeit', 'Beteiligungsverhaeltnisse', 'Ausleihungskonditionen', 'Abschreibungen', 'Zuschreibungen'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Werthaltigkeit, Beteiligungsverhaeltnissen, Ausleihungskonditionen, Abschreibungen oder Zuschreibungen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu Werthaltigkeit, Beteiligungsverhaeltnissen, Ausleihungskonditionen, Abschreibungen und Zuschreibungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Die Finanzanlagen betreffen im Wesentlichen langfristig gehaltene Beteiligungen und Ausleihungen.',
      'Veraenderungen der Finanzanlagen resultieren aus Zugaengen, Abgaengen, Rueckfuehrungen von Ausleihungen oder Wertanpassungen.',
      'Anteile an verbundenen Unternehmen werden dauerhaft dem Geschaeftsbetrieb zugeordnet.',
    ],
  },
  'anhang.wertpapiere_uv': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Wertpapiere des Umlaufvermoegens".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Tabelle.',
    focus: [
      'Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Veraenderung in TEUR und Prozent nennen.',
      'Kurz einordnen, dass es sich um kurzfristig disponierbare Wertpapiere des Umlaufvermoegens handelt, wenn als Fact vorhanden.',
      'Keine Aussagen zu Marktwerten, Kursrisiken oder Bewertungsverfahren ohne Facts.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['Bewertungsmethode', 'Marktwerte', 'stille Reserven/Lasten', 'Kursrisiken', 'Verfuegbarkeit'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Marktwerten, Kursrisiken, Bewertungsverfahren, stillen Reserven/Lasten oder Verfuegbarkeit in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu Bewertungsmethode, Marktwerten, stillen Reserven/Lasten, Kursrisiken und Verfuegbarkeit der Wertpapiere sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Die Wertpapiere des Umlaufvermoegens dienen der kurzfristigen Liquiditaetsanlage.',
      'Veraenderungen resultieren aus Umschichtungen liquider Mittel sowie aus Kaeufen und Verkaeufen im Rahmen der Finanzdisposition.',
      'Die Bewertung erfolgt unter Beachtung des strengen Niederstwertprinzips.',
    ],
  },
  'anhang.liquide_mittel': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Liquide Mittel".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Tabelle.',
    focus: [
      'Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Veraenderung in TEUR und Prozent nennen.',
      'Kurz einordnen, ob die Veraenderung wesentlich ist.',
      'Keine Ursachen erfinden.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['verfuegungsbeschraenkte Zahlungsmittel', 'Bankguthaben', 'Kassenbestaende', 'Cash-Pooling', 'Treuhandkonten', 'stichtagsbedingte Effekte'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Ursachen im confirmed paragraph nennen, wenn diese nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu verfuegungsbeschraenkten Zahlungsmitteln, Bankguthaben, Kassenbestaenden, Cash-Pooling, Treuhandkonten und wesentlichen stichtagsbedingten Effekten sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Die Veraenderung der liquiden Mittel resultiert aus dem operativen Cashflow sowie aus Investitions- und Finanzierungsvorgaengen des Geschaeftsjahres.',
      'Der Rueckgang der liquiden Mittel steht im Zusammenhang mit Investitionen, Tilgungen oder stichtagsbedingten Zahlungsabfluessen.',
      'Der Anstieg der liquiden Mittel resultiert aus positiven operativen Zahlungsmittelzufluessen und einer vorsichtigen Liquiditaetsdisposition.',
    ],
  },
  'anhang.eigenkapital': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Eigenkapital".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte des Eigenkapitals. Wiederhole daher nicht die vollstaendige Tabelle.',
    focus: [
      'Confirmed paragraph darf ausschliesslich enthalten: Eigenkapital aktuelles Jahr, Eigenkapital Vorjahr, Veraenderung in TEUR, Veraenderung in Prozent.',
      'Confirmed paragraph darf zusaetzlich neutral enthalten: "Die Veraenderung ist betragsmaessig wesentlich", falls dies aus changePercent ableitbar ist.',
      'Confirmed paragraph soll maximal ein kompakter Absatz sein.',
      'Keine Ursachen, keine Wirkungsbehauptungen und keine wertende Einordnung im confirmed paragraph.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['Gewinnverwendung', 'Ausschuettung', 'Einstellungen in Ruecklagen', 'Kapitalmassnahmen', 'Ergebnisverwendungsvorschlag', 'Beschlusslage'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Nicht im confirmed paragraph erlaubt: positive Auswirkungen auf Vermoegens- und Finanzlage, Staerkung der Kapitalbasis, Verbesserung der finanziellen Stabilitaet, Thesaurierung, Jahresergebnis als Ursache, Gewinnverwendung, Ausschuettung, Ruecklagenzufuehrung oder Kapitalmassnahmen.',
      'Keine Aussagen zu Gewinnverwendung, Ausschuettung, Einstellungen in Ruecklagen, Kapitalmassnahmen, Ergebnisverwendungsvorschlag oder Beschlusslage in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Jahresergebnis, Thesaurierung, Staerkung der Kapitalbasis und finanzielle Stabilitaet duerfen nur als type="unconfirmed", source="usual_text_block", requiresConfirmation=true erscheinen, solange sie nicht ausdruecklich bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zur Ergebnisverwendung, Ausschuettung, Ruecklagenzufuehrung, Kapitalmassnahmen und Beschlusslage sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Die Erhoehung des Eigenkapitals resultiert im Wesentlichen aus dem positiven Jahresergebnis und der Thesaurierung des Ergebnisses.',
      'Die Staerkung des Eigenkapitals verbessert die Kapitalbasis der Gesellschaft und erhoeht die finanzielle Stabilitaet.',
      'Angaben zur Ergebnisverwendung, Ausschuettung, Ruecklagenzufuehrung, Kapitalmassnahmen und Beschlusslage sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
    ],
  },
  'anhang.rueckstellungen': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Rueckstellungen".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte der Rueckstellungen. Wiederhole daher nicht die vollstaendige Tabelle.',
    focus: [
      'Confirmed paragraph muss Gesamtbetrag aktuelles Jahr und Vorjahr nennen.',
      'Confirmed paragraph muss die Gesamtveraenderung in TEUR und Prozent nennen.',
      'Confirmed paragraph muss den deutlichen Rueckgang der Pensionsrueckstellungen mit pensionenChangeAmount und pensionenChangePercent nennen.',
      'Confirmed paragraph muss den deutlichen Rueckgang der Steuerrueckstellungen mit steuernChangeAmount und steuernChangePercent nennen.',
      'Confirmed paragraph muss den gegenlaeufigen Anstieg der sonstigen Rueckstellungen mit sonstigeChangeAmount und sonstigeChangePercent nennen.',
      'Confirmed paragraph muss nennen, dass die sonstigen Rueckstellungen mit sonstigeCurrent der groesste Einzelposten der Rueckstellungen sind.',
      'Keine Aussagen zu Bewertung, Zinssaetzen, Laufzeiten oder Gutachten ohne Facts.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
    ],
    mandatoryReviewPoints: ['Bewertungsmethoden', 'Zinssaetze', 'versicherungsmathematische Annahmen', 'Inanspruchnahmen', 'Aufloesungen', 'Zufuehrungen', 'wesentliche Einzelrisiken'],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Bewertung, Zinssaetzen, Laufzeiten, Gutachten, versicherungsmathematischen Annahmen, Inanspruchnahmen, Aufloesungen oder Zufuehrungen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann", "koennte", "als moegliche Erlaeuterung" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen und keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Fehlende Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Beispiel: "Angaben zu Bewertungsmethoden, Zinssaetzen, versicherungsmathematischen Annahmen, Inanspruchnahmen, Aufloesungen, Zufuehrungen und wesentlichen Einzelrisiken sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    usualTextBlocks: [
      'Die Veraenderung der Pensionsrueckstellungen resultiert aus versicherungsmathematischer Bewertung, dem Abzinsungssatz und der Erfuellung von Verpflichtungen.',
      'Die Veraenderung der Steuerrueckstellungen resultiert aus Veranlagungen und Zahlungen fuer Vorjahre sowie aus der erwarteten Steuerbelastung.',
      'Die sonstigen Rueckstellungen betreffen ausstehende Rechnungen, Personalverpflichtungen, Urlaubsansprueche, variable Verguetungen, Prozess- und Gewaehrleistungsrisiken sowie Abschluss- und Pruefungskosten.',
      'Angaben zu den groessten Einzelposten der sonstigen Rueckstellungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.',
    ],
  },
  'anhang.vorraete': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Vorraete".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte der Vorratsgruppen. Wiederhole deshalb nicht alle Tabellenpositionen vollstaendig.',
    focus: [
      'Gesamtveraenderung der Vorraete in TEUR und Prozent nennen.',
      'Aktuellen Gesamtbetrag und Vorjahresbetrag nennen.',
      'Wesentliche gegenlaeufige Entwicklungen nur zusammenfassend nennen, zum Beispiel Rueckgang unfertige Erzeugnisse und Anstieg fertige Erzeugnisse.',
      'Bewertung zu Anschaffungs- oder Herstellungskosten unter Beachtung des Niederstwertprinzips nur nennen, wenn diese Facts vorhanden sind.',
      'Keine Aussage wie "ohne dass Abwertungen vorgenommen wurden" im confirmed paragraph, ausser Abwertungen sind ausdruecklich bestaetigt.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
      'Maximal 3 bis 5 kurze Absaetze.',
    ],
    mandatoryReviewPoints: [
      'Bewertungsmethode',
      'Abwertungen',
      'Gaengigkeitsabschlaege',
      'erhaltene Anzahlungen',
      'Verbrauchsfolgeverfahren',
      'Fremdkapitalzinsen',
      'Herstellungskostenbestandteile',
    ],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Aussagen wie "Abwertungen wurden nicht erfasst" oder "erhaltene Anzahlungen wurden nicht offen abgesetzt" duerfen nur confirmed sein, wenn sie ausdruecklich bestaetigt sind.',
      'Die Formulierung "ohne dass Abwertungen vorgenommen wurden" ist im confirmed paragraph verboten, wenn Abwertungen nicht ausdruecklich als Fact bestaetigt sind.',
      'Keine Bewertungsmethode nennen, wenn sie nicht als Fact uebergeben wurde.',
      'Keine Aussagen zu Abwertungen, erhaltenen Anzahlungen, Gaengigkeitsabschlaegen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen oder Herstellungskostenbestandteilen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Wenn Angaben zu Abwertungen, Gaengigkeitsabschlaegen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen, Herstellungskostenbestandteilen oder zur Behandlung erhaltener Anzahlungen fehlen, formuliere einen unconfirmed paragraph mit source="missing_input_notice".',
      'Missing-input paragraphs sollen lesbar im Fliesstext stehen und werden im Frontend gelb markiert.',
      'Beispiel: "Angaben zu Abwertungen, Gaengigkeitsabschlaegen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen, Herstellungskostenbestandteilen und zur Behandlung erhaltener Anzahlungen sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."',
    ],
    outputGuidance: [
      'Confirmed paragraphs: Nenne Gesamtveraenderung, aktuellen Gesamtbetrag, Vorjahresbetrag, wesentliche gegenlaeufige Entwicklungen und bestaetigte Bewertungsangaben.',
      'Unconfirmed paragraphs: Falls keine bestaetigte changeExplanation uebergeben wurde, ergaenze passende uebliche Erlaeuterungsbausteine als type="unconfirmed", source="usual_text_block", requiresConfirmation=true.',
      'Verwende uebliche Erlaeuterungsbausteine nur, wenn sie zur Zahlenentwicklung passen.',
      'Missing-input paragraphs: Fehlende pruefungsrelevante Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Das Feld text darf aus allen paragraphs zusammengesetzt werden.',
      'Unbestaetigte paragraphs als normale Erlaeuterungssaetze formulieren; keine Worte wie "kann", "moeglicherweise", "als moegliche Erlaeuterung" oder "zu bestaetigen" verwenden.',
      'usedFacts enthaelt nur tatsaechlich verwendete Fact-Keys.',
    ],
    usualTextBlocks: [
      'Der Rueckgang der unfertigen Erzeugnisse resultiert aus der Fertigstellung laufender Auftraege und der damit verbundenen Umgliederung in fertige Erzeugnisse.',
      'Der Anstieg der fertigen Erzeugnisse und Waren ist auf noch nicht ausgelieferte Fertigprodukte zum Bilanzstichtag zurueckzufuehren.',
      'Der Anstieg der Roh-, Hilfs- und Betriebsstoffe resultiert aus gestiegenen Einkaufspreisen und einem hoeheren Lagerbestand zur Sicherung der Produktionsfaehigkeit.',
      'Der Rueckgang der geleisteten Anzahlungen resultiert aus der Lieferung vorausbezahlter Materialien und Leistungen im Berichtsjahr.',
    ],
  },
  'anhang.forderungen': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Forderungen und sonstige Vermoegensgegenstaende".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Zusammensetzung der Forderungen.',
    focus: [
      'Gesamtveraenderung in TEUR und Prozent nennen.',
      'Aktuellen Gesamtbetrag und Vorjahresbetrag nennen.',
      'Wesentliche Treiber aus den Facts erklaeren: Anstieg Forderungen aus Lieferungen und Leistungen, Rueckgang Forderungen gegen verbundene Unternehmen, Veraenderung sonstige Vermoegensgegenstaende.',
      'Forderungen gegen verbundene Unternehmen gesondert, aber nur kurz erwaehnen.',
      'Pruefungsrelevante Auffaelligkeiten erlaeutern.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Forderungen gegen verbundene Unternehmen nur einmal erwaehnen.',
      'Keine zusaetzliche Formulierung "pruefungsrelevant ist insbesondere", wenn dieselbe Aussage bereits zuvor gemacht wurde.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
      'Maximal 3 bis 5 kurze Absaetze.',
    ],
    mandatoryReviewPoints: [
      'Restlaufzeiten',
      'Wertberichtigungen',
      'Sicherheiten',
    ],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Restlaufzeiten, Wertberichtigungen oder Sicherheiten in confirmed paragraphs, wenn diese nicht bestaetigt sind.',
      'Keine Formulierungen wie "moeglicherweise", "kann" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen.',
      'Keine sichtbaren Markierungen oder Tags.',
      'Requirements duerfen nicht als missingInputs zurueckgegeben werden.',
    ],
    missingInputRules: [
      'Wenn Restlaufzeiten, Wertberichtigungen oder Sicherheiten nicht als bestaetigte Facts vorliegen, schreibe keinen Hinweis wie "Angaben zu ... sind noch zu ergaenzen".',
      'Nutze stattdessen die uebergebenen Standardtexte restlaufzeiten_standardtext, wertberichtigungen_standardtext und sicherheiten_standardtext als lesbaren unconfirmed paragraph.',
      'Dieser Standardabsatz muss type="unconfirmed", source="usual_text_block" oder source="missing_input_notice" und requiresConfirmation=true haben.',
      'Standardabsatz: "Saemtliche Forderungen und sonstigen Vermoegensgegenstaende haben eine Restlaufzeit von bis zu einem Jahr. Wertberichtigungen wurden, soweit erforderlich, beruecksichtigt. Sicherheiten bestehen nicht."',
      'Wenn restlaufzeiten_forderungen, wertberichtigungen_text oder sicherheiten_text als bestaetigte Facts vorhanden sind, darf der entsprechende Absatz confirmed sein.',
    ],
    outputGuidance: [
      'Confirmed paragraphs: Nenne Gesamtveraenderung, aktuellen Gesamtbetrag, Vorjahresbetrag, wesentliche Treiber und Forderungen gegen verbundene Unternehmen kurz gesondert.',
      'Unconfirmed paragraphs: Falls keine bestaetigte changeExplanation uebergeben wurde, ergaenze passende uebliche Erlaeuterungsbausteine als type="unconfirmed", source="usual_text_block", requiresConfirmation=true.',
      'Verwende uebliche Erlaeuterungsbausteine nur, wenn sie zur Zahlenentwicklung passen.',
      'Missing-input paragraphs: Fehlende pruefungsrelevante Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Das Feld text darf aus allen paragraphs zusammengesetzt werden.',
      'Unbestaetigte paragraphs als normale Erlaeuterungssaetze formulieren; keine Worte wie "kann", "moeglicherweise", "als moegliche Erlaeuterung" oder "zu bestaetigen" verwenden.',
      'usedFacts enthaelt nur tatsaechlich verwendete Fact-Keys.',
    ],
    usualTextBlocks: [
      'Der Anstieg der Forderungen aus Lieferungen und Leistungen resultiert aus einem hoeheren Geschaeftsvolumen im letzten Quartal sowie aus Zahlungseingaengen nach dem Bilanzstichtag.',
      'Der Rueckgang der Forderungen gegen verbundene Unternehmen resultiert aus der planmaessigen Verrechnung konzerninterner Leistungsbeziehungen.',
      'Der Anstieg der sonstigen Vermoegensgegenstaende resultiert aus stichtagsbedingten Steuer- und Abgrenzungsposten.',
    ],
  },
  'anhang.verbindlichkeiten': {
    textGoal: 'Erstelle den Erlaeuterungstext fuer den Anhangabschnitt "Verbindlichkeiten".',
    doNotRepeatTable: 'Die Tabelle oberhalb des Textes enthaelt bereits die Detailwerte. Wiederhole daher nicht die vollstaendige Verbindlichkeitentabelle.',
    focus: [
      'Gesamtveraenderung der Verbindlichkeiten in TEUR und Prozent nennen.',
      'Aktuellen Gesamtbetrag und Vorjahresbetrag nennen.',
      'Veraenderung als wesentlich darstellen, wenn changePercent betragsmaessig deutlich ist.',
      'Verbindlichkeiten gegenueber Kreditinstituten und gegenueber verbundenen Unternehmen kurz erwaehnen, weil diese fuer Finanzlage und Konzernbeziehungen relevant sind.',
      'Den bestaetigten Absatz knapp und neutral formulieren.',
      'Keine wertenden Fuellsaetze.',
      'Betraege in TEUR ohne Nachkommastellen ausgeben, zum Beispiel 38.833 TEUR, 50.247 TEUR oder 11.414 TEUR.',
      'Der bestaetigte Text soll maximal ein kompakter Absatz sein.',
      'Keine doppelte Beschreibung derselben Veraenderung.',
      'Keine zusaetzliche Formulierung "pruefungsrelevant ist insbesondere", wenn dieselbe Aussage bereits zuvor gemacht wurde.',
      'Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.',
      'Alle Betraege in TEUR.',
      'Maximal 3 bis 5 kurze Absaetze.',
    ],
    mandatoryReviewPoints: [
      'Restlaufzeiten',
      'Besicherungen',
      'Haftungsverhaeltnisse',
    ],
    forbiddenClaims: [
      'Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.',
      'Keine Aussagen zu Restlaufzeiten, Besicherungen oder Haftungsverhaeltnissen in confirmed paragraphs, wenn diese nicht bestaetigt sind.',
      'Wenn keine Vorjahresdetails je Unterposition vorhanden sind, keine einzelnen Treiber behaupten.',
      'Keine Formulierungen wie "moeglicherweise", "kann" oder "zu bestaetigen" in unconfirmed Textbausteinen.',
      'Keine technischen Feldnamen.',
      'Keine sichtbaren Markierungen oder Tags.',
    ],
    missingInputRules: [
      'Wenn Restlaufzeitenspiegel, Besicherungen oder Haftungsverhaeltnisse nicht bestaetigt sind, schreibe keinen blossen Fehlende-Angaben-Hinweis.',
      'Nutze stattdessen die uebergebenen Standardtexte restlaufzeiten_standardtext, besicherungen_standardtext und haftungsverhaeltnisse_standardtext als lesbaren unconfirmed paragraph.',
      'Dieser Standardabsatz muss type="unconfirmed", source="usual_text_block" oder source="missing_input_notice" und requiresConfirmation=true haben.',
      'Standardabsatz: "Die Verbindlichkeiten haben eine Restlaufzeit von bis zu einem Jahr, soweit sich aus dem Verbindlichkeitenspiegel nichts anderes ergibt. Besicherungen und Haftungsverhaeltnisse bestehen nicht."',
      'Wenn bestaetigte Facts zu Restlaufzeiten, Besicherungen oder Haftungsverhaeltnissen vorhanden sind, darf der entsprechende Absatz confirmed sein.',
    ],
    outputGuidance: [
      'Confirmed paragraphs: Nenne Gesamtveraenderung, aktuellen Gesamtbetrag, Vorjahresbetrag, Wesentlichkeit sowie Kreditinstitute und verbundene Unternehmen kurz, knapp und neutral.',
      'Unconfirmed paragraphs: Falls keine bestaetigte changeExplanation uebergeben wurde, ergaenze passende uebliche Erlaeuterungsbausteine als type="unconfirmed", source="usual_text_block", requiresConfirmation=true.',
      'Verwende uebliche Erlaeuterungsbausteine nur, wenn sie zur Zahlenentwicklung passen.',
      'Missing-input paragraphs: Fehlende pruefungsrelevante Angaben als type="unconfirmed", source="missing_input_notice", requiresConfirmation=true formulieren.',
      'Das Feld text darf aus allen paragraphs zusammengesetzt werden.',
      'Unbestaetigte paragraphs als normale Erlaeuterungssaetze formulieren; keine Worte wie "kann", "moeglicherweise", "als moegliche Erlaeuterung" oder "zu bestaetigen" verwenden.',
      'usedFacts enthaelt nur tatsaechlich verwendete Fact-Keys.',
    ],
    usualTextBlocks: [
      'Der Rueckgang der Verbindlichkeiten resultiert aus planmaessigen Tilgungen und einer geringeren Inanspruchnahme kurzfristiger Finanzierungslinien.',
      'Die Verminderung der sonstigen Verbindlichkeiten resultiert aus dem Abbau stichtagsbezogener Steuer-, Personal- und Abgrenzungsposten.',
      'Die Verbindlichkeiten gegenueber Kreditinstituten spiegeln die bestehende Finanzierungsstruktur der Gesellschaft wider.',
      'Die Verbindlichkeiten gegenueber verbundenen Unternehmen resultieren aus konzerninternen Leistungs- und Finanzierungsbeziehungen.',
    ],
  },
};

const outputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sectionId', 'status', 'text', 'paragraphs', 'warnings', 'missingInputs', 'reviewQuestions', 'usedFacts'],
  properties: {
    sectionId: { type: 'string' },
    status: { type: 'string', enum: ['draft'] },
    text: { type: 'string' },
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'text', 'source', 'requiresConfirmation'],
        properties: {
          type: { type: 'string', enum: ['confirmed', 'unconfirmed'] },
          text: { type: 'string' },
          source: { type: 'string', enum: ['facts', 'usual_text_block', 'missing_input_notice', 'user_input'] },
          requiresConfirmation: { type: 'boolean' },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
    missingInputs: { type: 'array', items: { type: 'string' } },
    reviewQuestions: { type: 'array', items: { type: 'string' } },
    usedFacts: { type: 'array', items: { type: 'string' } },
  },
};

function normalizeTemperature(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return DEFAULT_TEMPERATURE;
}

function supportsTemperature(model: string): boolean {
  return !/^o\d/i.test(model) && !model.toLowerCase().includes('reasoning');
}

function scopeInstruction(scope: GenerateSectionTextInput['scope']): string {
  if (scope === 'kurz') {
    return 'Umfang kurz: maximal 1 confirmed paragraph und maximal 1 unconfirmed paragraph. Sehr knapp formulieren.';
  }
  if (scope === 'ausführlich') {
    return 'Umfang ausfuehrlich: mehrere Absaetze mit tieferer Erlaeuterung, aber weiterhin keine Tabellenwiederholung.';
  }
  return 'Umfang mittel: 1 confirmed paragraph und 1 bis 2 unconfirmed paragraphs.';
}

function customPromptInstruction(customPrompt: string | undefined): string {
  const prompt = customPrompt?.trim();
  return prompt
    ? `Benutzerdefinierte Abschnittsanweisung: ${prompt}`
    : 'Benutzerdefinierte Abschnittsanweisung: keine; verwende die fachlichen Section-Regeln.';
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(item => withoutUndefined(item)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, withoutUndefined(entryValue)]),
    ) as T;
  }

  return value;
}

export function buildOpenAiSectionTextRequest(input: GenerateSectionTextInput) {
  const model = process.env['OPENAI_MODEL'] || DEFAULT_OPENAI_MODEL;
  const request = {
    model,
    input: [
      {
        role: 'system',
        content: [
          'Du formulierst deutsche, sachliche, prueferorientierte und anhangtaugliche Abschnittsentwuerfe.',
          input.role ? `Arbeite in der Rolle: ${input.role}.` : 'Arbeite in der Rolle eines prueferorientierten HGB-Abschlussassistenten.',
          'Antworte ausschliesslich im geforderten JSON-Schema.',
          'Alle Betraege ausschliesslich in TEUR darstellen; verwende niemals EUR.',
          'Betragswerte in KI-Texten moeglichst als ganze TEUR ohne Nachkommastellen ausgeben, passend zu den Tabellen.',
          'Keine werblichen Formulierungen.',
          'Keine sichtbaren Tags wie [gelb], HTML oder Markdown im Text.',
          'Keine technischen Feldnamen im Text verwenden.',
          'Keine Normzitate, wenn keine Norm als Fact uebergeben wurde.',
          'Erzeuge final lesbare Erlaeuterungstexte.',
          'Belegte Aussagen kommen als confirmed paragraph.',
          'Confirmed paragraphs duerfen nur Aussagen enthalten, die aus Zahlen/Facts eindeutig ableitbar oder ausdruecklich bestaetigt sind.',
          'Alle ueblichen Ursachen, Standardannahmen und nicht bestaetigten fachlichen Angaben muessen als type="unconfirmed" geliefert werden.',
          'Uebliche, plausible, aber unbestaetigte Erlaeuterungen duerfen erzeugt werden, aber ausschliesslich als unconfirmed paragraph.',
          'Unconfirmed paragraphs sollen wie normale Erlaeuterungssaetze formuliert sein, nicht vorsichtig.',
          'Schreibe bei unconfirmed nicht: "kann", "moeglicherweise", "als moegliche Erlaeuterung" oder "zu bestaetigen".',
          'Die Kennzeichnung als unbestaetigt erfolgt ausschliesslich ueber type="unconfirmed" und requiresConfirmation=true.',
          'Fehlende Angaben, die spaeter ergaenzt oder bestaetigt werden muessen, duerfen als type="unconfirmed" mit source="missing_input_notice" formuliert werden.',
          'Keine unbestaetigte Aussage darf in einem confirmed paragraph stehen.',
          'type="unconfirmed" erfordert immer requiresConfirmation=true.',
          'missingInputs enthaelt nur tatsaechlich fehlende Fachinformationen, keine Aufgaben oder Formulierungswuensche.',
          'Fehlende Angaben und Rueckfragen weiterhin separat in missingInputs, reviewQuestions oder warnings fuehren.',
          'requirements sind Arbeitsanweisungen und duerfen niemals als missingInputs zurueckgegeben werden.',
          'usedFacts enthaelt ausschliesslich Fact-Keys, die im Text tatsaechlich verwendet wurden.',
          'Wenn tableAlreadyShowsDetails=true, Tabelle nicht nacherzaehlen, sondern Veraenderung, Treiber und moegliche Ursachen erlaeutern.',
          'Ursachen duerfen im confirmed paragraph nur genannt werden, wenn sie als bestaetigte Facts uebergeben wurden.',
          'Uebliche Ursachen duerfen als unconfirmed paragraph genannt werden.',
          'Keine Aussagen zu Restlaufzeiten, Sicherheiten, Wertberichtigungen, Haftungsverhaeltnissen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen oder Bewertungsmethoden, wenn diese nicht als Fact oder ueblicher unbestaetigter Baustein gekennzeichnet sind.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'section_text_output',
        strict: true,
        schema: outputJsonSchema,
      },
    },
    temperature: supportsTemperature(model) ? normalizeTemperature(input.temperature) : undefined,
  };

  return withoutUndefined(request);
}

function extractOutputText(response: unknown): string {
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

function buildUserPrompt(input: GenerateSectionTextInput): string {
  return [
    'Du bist ein prueferorientierter HGB-Abschlussassistent.',
    'Aufgabe: Erstelle einen gut lesbaren Erlaeuterungstext fuer einen Anhangabschnitt eines HGB-Jahresabschlusses.',
    'Der Text steht unter einer Tabelle. Die Tabelle zeigt bereits die Detailzahlen. Wiederhole daher nicht die vollstaendige Tabellenstruktur.',
    'Der Text soll die Veraenderung, wesentliche Treiber, Auffaelligkeiten und fachliche Einordnung erlaeutern.',
    'Trenne belegte und unbestaetigte Textteile zwingend ueber paragraphs.',
    'Confirmed paragraphs duerfen nur Aussagen enthalten, die aus Zahlen/Facts eindeutig ableitbar oder ausdruecklich bestaetigt sind.',
    'Alle ueblichen Ursachen, Standardannahmen und nicht bestaetigten fachlichen Angaben muessen als type="unconfirmed" geliefert werden.',
    'Bestaetigte Aussagen: type="confirmed", source="facts" oder source="user_input", requiresConfirmation=false.',
    'Plausible uebliche Textbausteine ohne bestaetigende Facts: type="unconfirmed", source="usual_text_block", requiresConfirmation=true.',
    'Fehlende Angaben, die spaeter ergaenzt oder bestaetigt werden muessen, duerfen als type="unconfirmed" mit source="missing_input_notice" formuliert werden.',
    'Unconfirmed paragraphs sollen wie normale Erlaeuterungssaetze formuliert sein, nicht vorsichtig.',
    'Schreibe bei unconfirmed nicht: "kann", "moeglicherweise", "als moegliche Erlaeuterung", "zu bestaetigen".',
    'Die Kennzeichnung als unbestaetigt erfolgt ausschliesslich ueber type="unconfirmed" und requiresConfirmation=true.',
    'Unbestaetigte Textbausteine duerfen lesbar in text enthalten sein, muessen aber im paragraphs-Array als unconfirmed markiert sein.',
    'Offene Punkte und Rueckfragen gehoeren in warnings, missingInputs oder reviewQuestions.',
    'Wenn tableAlreadyShowsDetails=true, wiederhole nicht die Tabellenpositionen; analysiere die Veraenderung.',
    'Nutze currentTotal, previousTotal, changeAmount, changePercent und mainDrivers fuer die Analyse, soweit vorhanden.',
    'Wenn changeExplanation fehlt oder null ist, duerfen Section-Regeln genannte uebliche Textbausteine als unconfirmed paragraphs vorgeschlagen werden.',
    '',
    'Redaktionelle Werkbanksteuerung:',
    input.role ? `Rolle: ${input.role}` : 'Rolle: prueferorientierter HGB-Abschlussassistent',
    scopeInstruction(input.scope),
    customPromptInstruction(input.customPrompt),
    'Die fachlichen SECTION_PROMPT_RULES sind die Basis. Eine Benutzerdefinierte Abschnittsanweisung konkretisiert oder ueberschreibt die redaktionelle Ausrichtung, soweit sie nicht gegen Facts, confirmed/unconfirmed-Trennung oder JSON-Schema verstoesst.',
    '',
    'Eingabedaten:',
    JSON.stringify({
      sectionId: input.sectionId,
      title: input.title ?? '',
      facts: input.facts ?? [],
      requirements: input.requirements ?? [],
      sectionRules: SECTION_PROMPT_RULES[input.sectionId] ?? null,
      missingInputs: input.missingInputs ?? [],
      style: input.style ?? '',
      role: input.role ?? '',
      scope: input.scope ?? '',
      customPrompt: input.customPrompt ?? '',
    }),
  ].join('\n');
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
    .sort((a, b) => Math.abs(b.changeAmount) - Math.abs(a.changeAmount));
}

function buildAnhangSectionRequests(data: JahresabschlussData): GenerateSectionTextInput[] {
  const B = data.bilanz;

  const vorraeteCurrent = (B.vorr_rhb || 0) + (B.vorr_unfertig || 0) + (B.vorr_fertig || 0) + (B.vorr_anzahlungen || 0);
  const forderungenCurrent = (B.ford_llg || 0) + (B.ford_vbu || 0) + (B.ford_sonstige || 0);
  const forderungenPrevious = (B.vj_ford_llg || 0) + (B.vj_ford_vbu || 0) + (B.vj_ford_sonstige || 0);
  const verbindlichkeitenCurrent = (B.anleihen || 0) + (B.verbindlichkeiten_kreditinstitute || 0) + (B.verbindlichkeiten_llg || 0)
    + (B.verbindlichkeiten_vbu || 0) + (B.sonstige_verbindlichkeiten || 0);

  return [
    {
      sectionId: 'anhang.vorraete',
      title: 'Vorraete',
      facts: {
        vorr_rhb: B.vorr_rhb || 0,
        vorr_unfertig: B.vorr_unfertig || 0,
        vorr_fertig: B.vorr_fertig || 0,
        vorr_anzahlungen: B.vorr_anzahlungen || 0,
        vj_vorraete: B.vj_vorraete || 0,
        bewertungsmethode: 'Anschaffungs- oder Herstellungskosten',
        bewertungsgrundsatz: 'Niederstwertprinzip',
        currentTotal: vorraeteCurrent,
        previousTotal: B.vj_vorraete || 0,
        changeAmount: vorraeteCurrent - (B.vj_vorraete || 0),
        changePercent: changePercent(vorraeteCurrent, B.vj_vorraete || 0),
        mainDrivers: buildDrivers([
          { label: 'Roh-, Hilfs- und Betriebsstoffe', current: B.vorr_rhb || 0, previous: B.vj_vorr_rhb || 0 },
          { label: 'Unfertige Erzeugnisse', current: B.vorr_unfertig || 0, previous: B.vj_vorr_unfertig || 0 },
          { label: 'Fertige Erzeugnisse und Waren', current: B.vorr_fertig || 0, previous: B.vj_vorr_fertig || 0 },
          { label: 'Geleistete Anzahlungen', current: B.vorr_anzahlungen || 0, previous: B.vj_vorr_anzahlungen || 0 },
        ]),
        tableAlreadyShowsDetails: true,
        changeExplanation: null,
        unit: 'TEUR',
      },
      requirements: ['Tabelle nicht nacherzaehlen.', 'confirmed/unconfirmed sauber trennen.'],
      style: 'Deutsch, sachlich, knapp, prueferorientiert; alle Betraege in TEUR.',
    },
    {
      sectionId: 'anhang.forderungen',
      title: 'Forderungen',
      facts: {
        ford_llg: B.ford_llg || 0,
        ford_vbu: B.ford_vbu || 0,
        ford_sonstige: B.ford_sonstige || 0,
        vj_ford_llg: B.vj_ford_llg || 0,
        vj_ford_vbu: B.vj_ford_vbu || 0,
        vj_ford_sonstige: B.vj_ford_sonstige || 0,
        restlaufzeiten_standardtext: 'Saemtliche Forderungen und sonstigen Vermoegensgegenstaende haben eine Restlaufzeit von bis zu einem Jahr.',
        wertberichtigungen_standardtext: 'Wertberichtigungen wurden, soweit erforderlich, beruecksichtigt.',
        sicherheiten_standardtext: 'Sicherheiten bestehen nicht.',
        confirmationStatus: 'unconfirmed',
        currentTotal: forderungenCurrent,
        previousTotal: forderungenPrevious,
        changeAmount: forderungenCurrent - forderungenPrevious,
        changePercent: changePercent(forderungenCurrent, forderungenPrevious),
        mainDrivers: buildDrivers([
          { label: 'Forderungen aus Lieferungen und Leistungen', current: B.ford_llg || 0, previous: B.vj_ford_llg || 0 },
          { label: 'Forderungen gegen verbundene Unternehmen', current: B.ford_vbu || 0, previous: B.vj_ford_vbu || 0 },
          { label: 'Sonstige Vermoegensgegenstaende', current: B.ford_sonstige || 0, previous: B.vj_ford_sonstige || 0 },
        ]),
        tableAlreadyShowsDetails: true,
        changeExplanation: null,
        unit: 'TEUR',
      },
      requirements: ['Tabelle nicht nacherzaehlen.', 'confirmed/unconfirmed sauber trennen.'],
      style: 'Deutsch, sachlich, knapp, prueferorientiert; alle Betraege in TEUR.',
    },
    {
      sectionId: 'anhang.verbindlichkeiten',
      title: 'Verbindlichkeiten',
      facts: {
        verb_anleihen: B.anleihen || 0,
        verb_bank: B.verbindlichkeiten_kreditinstitute || 0,
        verb_lieferungen: B.verbindlichkeiten_llg || 0,
        verb_vbu: B.verbindlichkeiten_vbu || 0,
        verb_sonstige: B.sonstige_verbindlichkeiten || 0,
        vj_verbindlichkeiten: B.vj_verbindlichkeiten || 0,
        restlaufzeiten_standardtext: 'Die Verbindlichkeiten haben eine Restlaufzeit von bis zu einem Jahr, soweit sich aus dem Verbindlichkeitenspiegel nichts anderes ergibt.',
        besicherungen_standardtext: 'Besicherungen bestehen nicht.',
        haftungsverhaeltnisse_standardtext: 'Haftungsverhaeltnisse bestehen nicht.',
        confirmationStatus: 'unconfirmed',
        currentTotal: verbindlichkeitenCurrent,
        previousTotal: B.vj_verbindlichkeiten || 0,
        changeAmount: verbindlichkeitenCurrent - (B.vj_verbindlichkeiten || 0),
        changePercent: changePercent(verbindlichkeitenCurrent, B.vj_verbindlichkeiten || 0),
        roundedCurrentTotal: Math.round(verbindlichkeitenCurrent),
        roundedPreviousTotal: Math.round(B.vj_verbindlichkeiten || 0),
        roundedChangeAmount: Math.round(verbindlichkeitenCurrent - (B.vj_verbindlichkeiten || 0)),
        amountFormat: 'TEUR ohne Nachkommastellen',
        mainDrivers: [],
        tableAlreadyShowsDetails: true,
        changeExplanation: null,
        unit: 'TEUR',
      },
      requirements: ['Tabelle nicht nacherzaehlen.', 'confirmed/unconfirmed sauber trennen.'],
      style: 'Deutsch, sachlich, knapp, prueferorientiert; alle Betraege in TEUR.',
    },
  ];
}

function mockSectionText(sectionId: string, confirmedText: string, unconfirmedText: string): SectionTextOutput {
  return SectionTextOutputSchema.parse({
    sectionId,
    status: 'draft',
    text: `${confirmedText}\n${unconfirmedText}`,
    paragraphs: [
      { type: 'confirmed', text: confirmedText, source: 'facts', requiresConfirmation: false },
      { type: 'unconfirmed', text: unconfirmedText, source: 'missing_input_notice', requiresConfirmation: true },
    ],
    warnings: [],
    missingInputs: [],
    reviewQuestions: [],
    usedFacts: ['currentTotal', 'previousTotal', 'changeAmount', 'changePercent'],
  });
}

function generateMockSectionTextsForAnhang(): AnhangSectionTexts {
  return {
    'anhang.vorraete': mockSectionText(
      'anhang.vorraete',
      'Mock-Abschnitt Vorräte: Die Vorräte werden im lokalen Word-Export anhand der Tabellenwerte erläutert.',
      'Mock-Hinweis Vorräte: Angaben zu Abwertungen und weiteren Bewertungsparametern sind noch zu ergänzen oder als nicht einschlägig zu bestätigen.',
    ),
    'anhang.forderungen': mockSectionText(
      'anhang.forderungen',
      'Mock-Abschnitt Forderungen: Die Forderungen werden im lokalen Word-Export anhand der Tabellenwerte erläutert.',
      'Mock-Hinweis Forderungen: Restlaufzeiten, Wertberichtigungen und Sicherheiten sind noch zu bestätigen.',
    ),
    'anhang.verbindlichkeiten': mockSectionText(
      'anhang.verbindlichkeiten',
      'Mock-Abschnitt Verbindlichkeiten: Die Verbindlichkeiten werden im lokalen Word-Export anhand der Tabellenwerte erläutert.',
      'Mock-Hinweis Verbindlichkeiten: Restlaufzeiten, Besicherungen und Haftungsverhältnisse sind noch zu bestätigen.',
    ),
  };
}

export async function generateSectionTextsForAnhang(data: JahresabschlussData): Promise<AnhangSectionTexts> {
  if (process.env['USE_MOCK_AI_TEXTS'] === 'true') {
    return generateMockSectionTextsForAnhang();
  }

  const entries = await Promise.all(buildAnhangSectionRequests(data).map(async request => {
    const output = await generateSectionText(request);
    return [request.sectionId, output] as const;
  }));

  return Object.fromEntries(entries);
}

export async function generateSectionText(input: GenerateSectionTextInput): Promise<SectionTextOutput> {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY fehlt auf dem Server.');
  }

  const requestBody = buildOpenAiSectionTextRequest(input);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('OpenAI section text error response:', errorBody);
    const details = errorBody ? ` ${errorBody.slice(0, 800)}` : '';
    throw new Error(`OpenAI request failed with status ${response.status}.${details}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractOutputText(await response.json()));
  } catch (err) {
    throw new Error(`Invalid OpenAI section text response: ${(err as Error).message}`);
  }

  return SectionTextOutputSchema.parse(parsed);
}
