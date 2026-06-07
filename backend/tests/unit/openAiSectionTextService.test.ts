import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOpenAiSectionTextRequest, generateSectionText, generateSectionTextsForAnhang } from '../../services/openAiSectionTextService';
import { renderAnhang } from '../../renderers/anhangRenderer.ts';
import testData from '../fixtures/testData.json';
import AdmZip from 'adm-zip';

describe('openAiSectionTextService', () => {
  const originalFetch = global.fetch;
  const parseUserPromptData = (prompt: string) => JSON.parse(prompt.split('Eingabedaten:\n')[1]);
  const containsUndefined = (value: unknown): boolean => {
    if (value === undefined) return true;
    if (Array.isArray(value)) return value.some(containsUndefined);
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).some(containsUndefined);
    }
    return false;
  };

  afterEach(() => {
    delete process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_MODEL'];
    delete process.env['USE_MOCK_AI_TEXTS'];
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('liefert Fallback, wenn OPENAI_API_KEY fehlt', async () => {
    delete process.env['OPENAI_API_KEY'];

    const result = await generateSectionText({ sectionId: 'anhang_b4_eigenkapital', title: 'Eigenkapital' });

    expect(result.warnings[0]).toContain('Fallback');
    expect(result.paragraphs[0]).toEqual(expect.objectContaining({
      type: 'unconfirmed',
      requiresConfirmation: true,
    }));
  });

  it('liefert valides Schema aus gemockter OpenAI-Antwort', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    process.env['OPENAI_MODEL'] = 'test-model';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'anhang_b4_eigenkapital',
          status: 'draft',
          text: 'Das Eigenkapital wird erlaeutert.',
          paragraphs: [
            {
              type: 'confirmed',
              text: 'Das Eigenkapital wird erlaeutert.',
              source: 'facts',
              requiresConfirmation: false,
            },
          ],
          warnings: [],
          missingInputs: ['Beschluss zur Ergebnisverwendung'],
          reviewQuestions: [],
          usedFacts: ['Eigenkapital 2025: 39.761 TEUR'],
        }),
      }),
    });
    global.fetch = fetchMock;

    const result = await generateSectionText({
      sectionId: 'anhang_b4_eigenkapital',
      facts: ['Eigenkapital 2025: 39.761 TEUR'],
      missingInputs: ['Beschluss zur Ergebnisverwendung'],
    });

    expect(result).toEqual({
      sectionId: 'anhang_b4_eigenkapital',
      status: 'draft',
      text: 'Das Eigenkapital wird erlaeutert.',
      paragraphs: [
        {
          type: 'confirmed',
          text: 'Das Eigenkapital wird erlaeutert.',
          source: 'facts',
          requiresConfirmation: false,
        },
      ],
      warnings: [],
      missingInputs: ['Beschluss zur Ergebnisverwendung'],
      reviewQuestions: [],
      usedFacts: ['Eigenkapital 2025: 39.761 TEUR'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('test-model');
  });

  it('normalisiert temperature string zu number und sendet role/customPrompt nur im Prompt', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'anhang.eigenkapital',
          status: 'draft',
          text: 'Text.',
          paragraphs: [
            { type: 'confirmed', text: 'Text.', source: 'facts', requiresConfirmation: false },
          ],
          warnings: [],
          missingInputs: [],
          reviewQuestions: [],
          usedFacts: [],
        }),
      }),
    });
    global.fetch = fetchMock;

    await generateSectionText({
      sectionId: 'anhang.eigenkapital',
      role: 'prüferorientierter HGB-Abschlussassistent',
      scope: 'mittel',
      temperature: '0.3',
      customPrompt: 'Nur ein kompakter Absatz.',
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userPromptText = body.input[1].content;
    const userPrompt = parseUserPromptData(body.input[1].content);
    expect(body.temperature).toBe(0.3);
    expect(body.role).toBeUndefined();
    expect(body.customPrompt).toBeUndefined();
    expect(userPromptText).toContain('Rolle: prüferorientierter HGB-Abschlussassistent');
    expect(userPromptText).toContain('Umfang mittel: 1 confirmed paragraph und 1 bis 2 unconfirmed paragraphs.');
    expect(userPromptText).toContain('Benutzerdefinierte Abschnittsanweisung: Nur ein kompakter Absatz.');
    expect(userPrompt.role).toBe('prüferorientierter HGB-Abschlussassistent');
    expect(userPrompt.scope).toBe('mittel');
    expect(userPrompt.customPrompt).toBe('Nur ein kompakter Absatz.');
  });

  it('setzt je scope unterschiedliche Laengenanweisungen in den Prompt', () => {
    const prompts = (['kurz', 'mittel', 'ausführlich'] as const).map(scope => {
      const request = buildOpenAiSectionTextRequest({
        sectionId: 'anhang.eigenkapital',
        scope,
        customPrompt: `Prompt ${scope}`,
      });
      return String(request.input[1].content);
    });

    expect(prompts[0]).toContain('Umfang kurz: maximal 1 confirmed paragraph und maximal 1 unconfirmed paragraph.');
    expect(prompts[1]).toContain('Umfang mittel: 1 confirmed paragraph und 1 bis 2 unconfirmed paragraphs.');
    expect(prompts[2]).toContain('Umfang ausfuehrlich: mehrere Absaetze mit tieferer Erlaeuterung');
    expect(prompts[0]).toContain('Benutzerdefinierte Abschnittsanweisung: Prompt kurz');
    expect(prompts[1]).toContain('Benutzerdefinierte Abschnittsanweisung: Prompt mittel');
    expect(prompts[2]).toContain('Benutzerdefinierte Abschnittsanweisung: Prompt ausführlich');
  });

  it('erzeugt gueltiges OpenAI JSON-Schema ohne undefined-Werte', () => {
    const request = buildOpenAiSectionTextRequest({
      sectionId: 'anhang.rueckstellungen',
      title: 'Rueckstellungen',
      temperature: '0.3',
    });

    expect(containsUndefined(request)).toBe(false);
    expect(request.model).toBe('gpt-4.1-mini');
    expect(request.temperature).toBe(0.3);
    expect(request.text.format.schema).toEqual(expect.objectContaining({
      type: 'object',
      additionalProperties: false,
      required: ['sectionId', 'status', 'text', 'paragraphs', 'warnings', 'missingInputs', 'reviewQuestions', 'usedFacts'],
      properties: expect.objectContaining({
        sectionId: { type: 'string' },
        paragraphs: expect.objectContaining({
          type: 'array',
          items: expect.objectContaining({
            type: 'object',
            additionalProperties: false,
            required: ['type', 'text', 'source', 'requiresConfirmation'],
            properties: expect.objectContaining({
              type: { type: 'string', enum: ['confirmed', 'unconfirmed'] },
              text: { type: 'string' },
              source: { type: 'string', enum: ['facts', 'usual_text_block', 'missing_input_notice', 'user_input'] },
              requiresConfirmation: { type: 'boolean' },
            }),
          }),
        }),
      }),
    }));
  });

  it('faengt ungueltige OpenAI-Antwort mit Fallback ab', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: '{"sectionId":"x","status":"done"}' }),
    });

    const result = await generateSectionText({ sectionId: 'x', title: 'Testabschnitt' });

    expect(result.sectionId).toBe('x');
    expect(result.warnings[0]).toContain('Fallback');
    expect(result.paragraphs[0].type).toBe('unconfirmed');
  });

  it('trennt finalen Textentwurf von internen Pruefhinweisen im Systemprompt', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'anhang.verbindlichkeiten',
          status: 'draft',
          text: 'Die Verbindlichkeiten haben sich gegenueber dem Vorjahr erhoeht.',
          paragraphs: [
            {
              type: 'confirmed',
              text: 'Die Verbindlichkeiten haben sich gegenueber dem Vorjahr erhoeht.',
              source: 'facts',
              requiresConfirmation: false,
            },
          ],
          warnings: ['Restlaufzeitenspiegel fehlt'],
          missingInputs: ['Begründung der wesentlichen Veränderung nicht übergeben; ergänzen oder als nicht erforderlich bestätigen.'],
          reviewQuestions: [],
          usedFacts: ['currentTotal', 'previousTotal', 'changeAmount', 'changePercent'],
        }),
      }),
    });
    global.fetch = fetchMock;

    await generateSectionText({
      sectionId: 'anhang.verbindlichkeiten',
      facts: {
        currentTotal: 100,
        previousTotal: 80,
        changeAmount: 20,
        changePercent: 25,
        tableAlreadyShowsDetails: true,
        changeExplanation: null,
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const systemPrompt = body.input[0].content;
    const userPromptText = body.input[1].content;
    const userPrompt = parseUserPromptData(userPromptText);

    expect(systemPrompt).toContain('Uebliche, plausible, aber unbestaetigte Erlaeuterungen duerfen erzeugt werden');
    expect(systemPrompt).toContain('Confirmed paragraphs duerfen nur Aussagen enthalten, die aus Zahlen/Facts eindeutig ableitbar oder ausdruecklich bestaetigt sind.');
    expect(systemPrompt).toContain('Alle ueblichen Ursachen, Standardannahmen und nicht bestaetigten fachlichen Angaben muessen als type="unconfirmed" geliefert werden.');
    expect(systemPrompt).toContain('type="unconfirmed" erfordert immer requiresConfirmation=true');
    expect(systemPrompt).toContain('requirements sind Arbeitsanweisungen und duerfen niemals als missingInputs zurueckgegeben werden');
    expect(userPromptText).toContain('Aufgabe: Erstelle einen gut lesbaren Erlaeuterungstext');
    expect(userPromptText).toContain('Du bist ein prueferorientierter HGB-Abschlussassistent');
    expect(userPromptText).toContain('Trenne belegte und unbestaetigte Textteile zwingend ueber paragraphs');
    expect(userPromptText).toContain('source="usual_text_block", requiresConfirmation=true');
    expect(userPromptText).toContain('source="missing_input_notice"');
    expect(userPromptText).toContain('Eingabedaten:');
    expect(userPrompt.sectionRules.doNotRepeatTable).toContain('Wiederhole daher nicht die vollstaendige Verbindlichkeitentabelle.');
    expect(userPrompt.sectionRules.focus).toContain('Gesamtveraenderung der Verbindlichkeiten in TEUR und Prozent nennen.');
  });

  it('liefert Section-Prompt-Regeln fuer alle Abschnittsassistenten mit', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'x',
          status: 'draft',
          text: 'Textentwurf.',
          paragraphs: [
            {
              type: 'confirmed',
              text: 'Textentwurf.',
              source: 'facts',
              requiresConfirmation: false,
            },
          ],
          warnings: [],
          missingInputs: [],
          reviewQuestions: [],
          usedFacts: [],
        }),
      }),
    });
    global.fetch = fetchMock;

    const sectionIds = [
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
      'anhang.guv.bestandsveraenderung',
      'anhang.guv.aktivierte_eigenleistungen',
      'anhang.guv.sonstige_betriebliche_ertraege',
      'anhang.guv.materialaufwand',
      'anhang.guv.personalaufwand',
      'anhang.guv.abschreibungen',
      'anhang.guv.sonstige_betriebliche_aufwendungen',
      'anhang.guv.beteiligungsertraege',
      'anhang.guv.zinsertraege',
      'anhang.guv.abschreibungen_finanzanlagen',
      'anhang.guv.zinsaufwendungen',
      'anhang.guv.steuern_einkommen_ertrag',
      'anhang.guv.sonstige_steuern',
      'anhang.guv.jahresueberschuss',
    ];

    for (const sectionId of sectionIds) {
      await generateSectionText({ sectionId });
    }

    const prompts = fetchMock.mock.calls.map(call => parseUserPromptData(JSON.parse(call[1].body).input[1].content));

    expect(prompts.map(prompt => prompt.sectionId)).toEqual(sectionIds);
    for (const prompt of prompts) {
      expect(prompt.sectionRules).toEqual(expect.objectContaining({
        textGoal: expect.any(String),
        doNotRepeatTable: expect.any(String),
        focus: expect.any(Array),
        mandatoryReviewPoints: expect.any(Array),
        forbiddenClaims: expect.any(Array),
        missingInputRules: expect.any(Array),
      }));
      if (prompt.sectionId !== 'anhang.eigenkapital') {
        expect(prompt.sectionRules.focus).toContain('Der bestaetigte Text soll maximal ein kompakter Absatz sein.');
      }
      expect(prompt.sectionRules.focus).toContain('Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.');
      expect(prompt.sectionRules.forbiddenClaims).toContain('Confirmed paragraphs duerfen nur Aussagen enthalten, die durch uebergebene Facts gedeckt oder ausdruecklich bestaetigt sind.');
    }
    expect(prompts[0].sectionRules.forbiddenClaims).toContain('Keine Bewertungsmethode nennen, wenn sie nicht als Fact uebergeben wurde.');
    expect(prompts[0].sectionRules.forbiddenClaims).toContain('Aussagen wie "Abwertungen wurden nicht erfasst" oder "erhaltene Anzahlungen wurden nicht offen abgesetzt" duerfen nur confirmed sein, wenn sie ausdruecklich bestaetigt sind.');
    expect(prompts[0].sectionRules.forbiddenClaims).toContain('Keine Aussagen zu Abwertungen, erhaltenen Anzahlungen, Gaengigkeitsabschlaegen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen oder Herstellungskostenbestandteilen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.');
    expect(prompts[0].sectionRules.outputGuidance).toContain('Verwende uebliche Erlaeuterungsbausteine nur, wenn sie zur Zahlenentwicklung passen.');
    expect(prompts[0].sectionRules.usualTextBlocks).toContain('Der Rueckgang der unfertigen Erzeugnisse resultiert aus der Fertigstellung laufender Auftraege und der damit verbundenen Umgliederung in fertige Erzeugnisse.');
    expect(prompts[0].sectionRules.focus).toContain('Der bestaetigte Text soll maximal ein kompakter Absatz sein.');
    expect(prompts[0].sectionRules.focus).toContain('Prozentformat einheitlich mit einer Nachkommastelle, zum Beispiel 32,0 % oder -1,6 %.');
    expect(prompts[0].sectionRules.missingInputRules).toContain('Wenn Angaben zu Abwertungen, Gaengigkeitsabschlaegen, Verbrauchsfolgeverfahren, Fremdkapitalzinsen, Herstellungskostenbestandteilen oder zur Behandlung erhaltener Anzahlungen fehlen, formuliere einen unconfirmed paragraph mit source="missing_input_notice".');
    expect(prompts[1].sectionRules.textGoal).toContain('Forderungen und sonstige Vermoegensgegenstaende');
    expect(prompts[1].sectionRules.focus).toContain('Wesentliche Treiber aus den Facts erklaeren: Anstieg Forderungen aus Lieferungen und Leistungen, Rueckgang Forderungen gegen verbundene Unternehmen, Veraenderung sonstige Vermoegensgegenstaende.');
    expect(prompts[1].sectionRules.focus).toContain('Forderungen gegen verbundene Unternehmen nur einmal erwaehnen.');
    expect(prompts[1].sectionRules.usualTextBlocks).toContain('Der Anstieg der Forderungen aus Lieferungen und Leistungen resultiert aus einem hoeheren Geschaeftsvolumen im letzten Quartal sowie aus Zahlungseingaengen nach dem Bilanzstichtag.');
    expect(prompts[1].sectionRules.usualTextBlocks).toContain('Der Rueckgang der Forderungen gegen verbundene Unternehmen resultiert aus der planmaessigen Verrechnung konzerninterner Leistungsbeziehungen.');
    expect(prompts[1].sectionRules.usualTextBlocks).toContain('Der Anstieg der sonstigen Vermoegensgegenstaende resultiert aus stichtagsbedingten Steuer- und Abgrenzungsposten.');
    expect(prompts[1].sectionRules.missingInputRules).toContain('Nutze stattdessen die uebergebenen Standardtexte restlaufzeiten_standardtext, wertberichtigungen_standardtext und sicherheiten_standardtext als lesbaren unconfirmed paragraph.');
    expect(prompts[1].sectionRules.missingInputRules).toContain('Standardabsatz: "Saemtliche Forderungen und sonstigen Vermoegensgegenstaende haben eine Restlaufzeit von bis zu einem Jahr. Wertberichtigungen wurden, soweit erforderlich, beruecksichtigt. Sicherheiten bestehen nicht."');
    expect(prompts[2].sectionRules.textGoal).toContain('Immaterielle Vermoegenswerte');
    expect(prompts[2].sectionRules.usualTextBlocks).toContain('Der Anstieg der immateriellen Vermoegenswerte resultiert aus Investitionen in Software, Lizenzen und digitale Anwendungen.');
    expect(prompts[3].sectionRules.textGoal).toContain('Sachanlagen');
    expect(prompts[3].sectionRules.usualTextBlocks).toContain('Der Anstieg der Sachanlagen resultiert aus Investitionen in technische Anlagen, Betriebs- und Geschaeftsausstattung sowie laufende Bau- und Erweiterungsmassnahmen.');
    expect(prompts[4].sectionRules.textGoal).toContain('Finanzanlagen');
    expect(prompts[4].sectionRules.forbiddenClaims).toContain('Keine Aussagen zu Werthaltigkeit, Beteiligungsverhaeltnissen, Ausleihungskonditionen, Abschreibungen oder Zuschreibungen in confirmed paragraphs, wenn diese Angaben nicht bestaetigt sind.');
    expect(prompts[5].sectionRules.textGoal).toContain('Wertpapiere des Umlaufvermoegens');
    expect(prompts[5].sectionRules.usualTextBlocks).toContain('Die Wertpapiere des Umlaufvermoegens dienen der kurzfristigen Liquiditaetsanlage.');
    expect(prompts[6].sectionRules.textGoal).toContain('Liquide Mittel');
    expect(prompts[6].sectionRules.forbiddenClaims).toContain('Keine Ursachen im confirmed paragraph nennen, wenn diese nicht bestaetigt sind.');
    expect(prompts[7].sectionRules.textGoal).toContain('Eigenkapital');
    expect(prompts[7].sectionRules.focus).toContain('Confirmed paragraph darf ausschliesslich enthalten: Eigenkapital aktuelles Jahr, Eigenkapital Vorjahr, Veraenderung in TEUR, Veraenderung in Prozent.');
    expect(prompts[7].sectionRules.focus).toContain('Keine Ursachen, keine Wirkungsbehauptungen und keine wertende Einordnung im confirmed paragraph.');
    expect(prompts[7].sectionRules.forbiddenClaims).toContain('Nicht im confirmed paragraph erlaubt: positive Auswirkungen auf Vermoegens- und Finanzlage, Staerkung der Kapitalbasis, Verbesserung der finanziellen Stabilitaet, Thesaurierung, Jahresergebnis als Ursache, Gewinnverwendung, Ausschuettung, Ruecklagenzufuehrung oder Kapitalmassnahmen.');
    expect(prompts[7].sectionRules.usualTextBlocks).toContain('Die Erhoehung des Eigenkapitals resultiert im Wesentlichen aus dem positiven Jahresergebnis und der Thesaurierung des Ergebnisses.');
    expect(prompts[7].sectionRules.usualTextBlocks).toContain('Die Staerkung des Eigenkapitals verbessert die Kapitalbasis der Gesellschaft und erhoeht die finanzielle Stabilitaet.');
    expect(prompts[7].sectionRules.usualTextBlocks).toContain('Angaben zur Ergebnisverwendung, Ausschuettung, Ruecklagenzufuehrung, Kapitalmassnahmen und Beschlusslage sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen.');
    expect(prompts[8].sectionRules.textGoal).toContain('Rueckstellungen');
    expect(prompts[8].sectionRules.focus).toContain('Confirmed paragraph muss den deutlichen Rueckgang der Pensionsrueckstellungen mit pensionenChangeAmount und pensionenChangePercent nennen.');
    expect(prompts[8].sectionRules.focus).toContain('Confirmed paragraph muss den deutlichen Rueckgang der Steuerrueckstellungen mit steuernChangeAmount und steuernChangePercent nennen.');
    expect(prompts[8].sectionRules.focus).toContain('Confirmed paragraph muss den gegenlaeufigen Anstieg der sonstigen Rueckstellungen mit sonstigeChangeAmount und sonstigeChangePercent nennen.');
    expect(prompts[8].sectionRules.usualTextBlocks).toContain('Die sonstigen Rueckstellungen betreffen ausstehende Rechnungen, Personalverpflichtungen, Urlaubsansprueche, variable Verguetungen, Prozess- und Gewaehrleistungsrisiken sowie Abschluss- und Pruefungskosten.');
    expect(prompts[9].sectionRules.textGoal).toContain('Verbindlichkeiten');
    expect(prompts[9].sectionRules.focus).toContain('Verbindlichkeiten gegenueber Kreditinstituten und gegenueber verbundenen Unternehmen kurz erwaehnen, weil diese fuer Finanzlage und Konzernbeziehungen relevant sind.');
    expect(prompts[9].sectionRules.focus).toContain('Betraege in TEUR ohne Nachkommastellen ausgeben, zum Beispiel 38.833 TEUR, 50.247 TEUR oder 11.414 TEUR.');
    expect(prompts[9].sectionRules.forbiddenClaims).toContain('Wenn keine Vorjahresdetails je Unterposition vorhanden sind, keine einzelnen Treiber behaupten.');
    expect(prompts[9].sectionRules.usualTextBlocks).toContain('Der Rueckgang der Verbindlichkeiten resultiert aus planmaessigen Tilgungen und einer geringeren Inanspruchnahme kurzfristiger Finanzierungslinien.');
    expect(prompts[9].sectionRules.usualTextBlocks).toContain('Die Verminderung der sonstigen Verbindlichkeiten resultiert aus dem Abbau stichtagsbezogener Steuer-, Personal- und Abgrenzungsposten.');
    expect(prompts[9].sectionRules.usualTextBlocks).toContain('Die Verbindlichkeiten gegenueber Kreditinstituten spiegeln die bestehende Finanzierungsstruktur der Gesellschaft wider.');
    expect(prompts[9].sectionRules.usualTextBlocks).toContain('Die Verbindlichkeiten gegenueber verbundenen Unternehmen resultieren aus konzerninternen Leistungs- und Finanzierungsbeziehungen.');
    expect(prompts[9].sectionRules.missingInputRules).toContain('Nutze stattdessen die uebergebenen Standardtexte restlaufzeiten_standardtext, besicherungen_standardtext und haftungsverhaeltnisse_standardtext als lesbaren unconfirmed paragraph.');
    expect(prompts[9].sectionRules.missingInputRules).toContain('Standardabsatz: "Die Verbindlichkeiten haben eine Restlaufzeit von bis zu einem Jahr, soweit sich aus dem Verbindlichkeitenspiegel nichts anderes ergibt. Besicherungen und Haftungsverhaeltnisse bestehen nicht."');
    expect(prompts[10].sectionRules.textGoal).toContain('Umsatzerloese');
    expect(prompts[10].sectionRules.usualTextBlocks).toContain('Der Umsatzanstieg resultiert aus hoeherem Absatzvolumen, Preissteigerungen und einer Ausweitung des Projektgeschaefts.');
    expect(prompts[11].sectionRules.textGoal).toContain('Bestandsveraenderung');
    expect(prompts[11].sectionRules.focus).toContain('Positive Bestandsveraenderung wirkt ergebniserhoehend, negative ergebnismindernd.');
    expect(prompts[12].sectionRules.textGoal).toContain('Aktivierte Eigenleistungen');
    expect(prompts[13].sectionRules.textGoal).toContain('Sonstige betriebliche Ertraege');
    expect(prompts[14].sectionRules.textGoal).toContain('Materialaufwand');
    expect(prompts[14].sectionRules.focus).toContain('Ergebniswirkung nennen: Aufwandserhoehung ergebnismindernd, Aufwandsrueckgang ergebnisverbessernd.');
    expect(prompts[15].sectionRules.textGoal).toContain('Personalaufwand');
    expect(prompts[15].sectionRules.usualTextBlocks).toContain('Der Anstieg des Personalaufwands resultiert aus tariflichen Anpassungen, hoeherer Mitarbeiterzahl, variablen Verguetungsbestandteilen oder strukturellen Veraenderungen.');
    expect(prompts[16].sectionRules.textGoal).toContain('Abschreibungen');
    expect(prompts[16].sectionRules.forbiddenClaims).toContain('Keine ausserplanmaessigen Abschreibungen behaupten ohne bestaetigte Facts.');
    expect(prompts[17].sectionRules.textGoal).toContain('Sonstige betriebliche Aufwendungen');
    expect(prompts[18].sectionRules.textGoal).toContain('Beteiligungsertraege');
    expect(prompts[19].sectionRules.textGoal).toContain('Zinsertraege');
    expect(prompts[20].sectionRules.textGoal).toContain('Abschreibungen auf Finanzanlagen');
    expect(prompts[21].sectionRules.textGoal).toContain('Zinsaufwendungen');
    expect(prompts[22].sectionRules.textGoal).toContain('Steuern vom Einkommen und Ertrag');
    expect(prompts[23].sectionRules.textGoal).toContain('Sonstige Steuern');
    expect(prompts[24].sectionRules.textGoal).toContain('Jahresueberschuss');
    expect(prompts[24].sectionRules.missingInputRules).toContain('Beispiel: "Angaben zu wesentlichen Ergebnisursachen, Sondereffekten, periodenfremden Effekten und Gewinnverwendung sind noch zu ergaenzen oder als nicht einschlaegig zu bestaetigen."');
  });

  it('akzeptiert confirmed und unconfirmed paragraphs mit Bestaetigungspflicht', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'anhang.vorraete',
          status: 'draft',
          text: 'Die Vorraete sind gesunken. Als moegliche Erlaeuterung kommt eine Abarbeitung des Auftragsbestands in Betracht; dies ist durch das Unternehmen zu bestaetigen.',
          paragraphs: [
            {
              type: 'confirmed',
              text: 'Die Vorraete sind gesunken.',
              source: 'facts',
              requiresConfirmation: false,
            },
            {
              type: 'unconfirmed',
              text: 'Der Rueckgang der unfertigen Erzeugnisse resultiert aus der Abarbeitung des Auftragsbestands.',
              source: 'usual_text_block',
              requiresConfirmation: true,
            },
            {
              type: 'unconfirmed',
              text: 'Angaben zu Gängigkeitsabschlägen sind vor Freigabe zu klären.',
              source: 'missing_input_notice',
              requiresConfirmation: true,
            },
          ],
          warnings: [],
          missingInputs: [],
          reviewQuestions: [],
          usedFacts: ['currentTotal', 'previousTotal'],
        }),
      }),
    });

    const result = await generateSectionText({ sectionId: 'anhang.vorraete' });

    expect(result.paragraphs).toHaveLength(3);
    expect(result.text).not.toContain('[gelb]');
    expect(result.paragraphs.map(paragraph => paragraph.text).join(' ')).not.toContain('[gelb]');
    expect(result.paragraphs[1]).toEqual(expect.objectContaining({
      type: 'unconfirmed',
      source: 'usual_text_block',
      requiresConfirmation: true,
    }));
    expect(result.paragraphs[2]).toEqual(expect.objectContaining({
      type: 'unconfirmed',
      source: 'missing_input_notice',
      requiresConfirmation: true,
    }));
  });

  it('ersetzt unconfirmed paragraph ohne requiresConfirmation=true durch Fallback', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId: 'anhang.vorraete',
          status: 'draft',
          text: 'Unbestaetigter Text.',
          paragraphs: [
            {
              type: 'unconfirmed',
              text: 'Unbestaetigter Text.',
              source: 'usual_text_block',
              requiresConfirmation: false,
            },
          ],
          warnings: [],
          missingInputs: [],
          reviewQuestions: [],
          usedFacts: [],
        }),
      }),
    });

    const result = await generateSectionText({ sectionId: 'anhang.vorraete' });

    expect(result.warnings[0]).toContain('Fallback');
    expect(result.paragraphs[0]).toEqual(expect.objectContaining({
      type: 'unconfirmed',
      requiresConfirmation: true,
    }));
  });

  it('liefert Mock-SectionTexts fuer den Anhang ohne externen API-Call', async () => {
    process.env['USE_MOCK_AI_TEXTS'] = 'true';
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    const result = await generateSectionTextsForAnhang(testData);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(result)).toEqual([
      'anhang.vorraete',
      'anhang.forderungen',
      'anhang.verbindlichkeiten',
    ]);
    expect(result['anhang.vorraete']?.paragraphs.some(paragraph => paragraph.type === 'confirmed')).toBe(true);
    expect(result['anhang.vorraete']?.paragraphs.some(paragraph => paragraph.type === 'unconfirmed' && paragraph.requiresConfirmation)).toBe(true);
  });

  it('isoliert einen OpenAI-Timeout und erzeugt fuer den betroffenen Abschnitt Fallback', async () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const okResponse = (sectionId: string) => ({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          sectionId,
          status: 'draft',
          text: `KI-Text ${sectionId}`,
          paragraphs: [
            { type: 'confirmed', text: `KI-Text ${sectionId}`, source: 'facts', requiresConfirmation: false },
          ],
          warnings: [],
          missingInputs: [],
          reviewQuestions: [],
          usedFacts: ['currentTotal'],
        }),
      }),
    });
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const prompt = String(body.input[1].content);
      const sectionId = JSON.parse(prompt.split('Eingabedaten:\n')[1]).sectionId;
      if (sectionId === 'anhang.forderungen') {
        return {
          ok: false,
          status: 503,
          text: async () => 'upstream connect error or disconnect/reset before headers. reset reason: connection timeout',
        };
      }
      return okResponse(sectionId);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await generateSectionTextsForAnhang(testData);

    expect(result['anhang.vorraete']?.warnings).toEqual([]);
    expect(result['anhang.verbindlichkeiten']?.warnings).toEqual([]);
    expect(result['anhang.forderungen']?.warnings[0]).toContain('Fallback');
    expect(result['anhang.forderungen']?.paragraphs[0]).toEqual(expect.objectContaining({
      type: 'unconfirmed',
      requiresConfirmation: true,
    }));

    const aiTexts = {
      lagebericht: {
        geschaeftsmodell: '',
        strategie: '',
        gesamtwirtschaft: '',
        geschaeftsverlauf: '',
        ertragslage: '',
        finanzlage: '',
        vermoegenslage: '',
        nachtragsbericht: '',
        risiken: '',
        chancen: '',
        prognose: '',
      },
      anhang: {
        rechtliche_grundlagen: 'Test.',
        bilanzierungsgrundsaetze_intro: 'Test.',
        bewertung_immaterielle: 'Test.',
        bewertung_sachanlagen: 'Test.',
        bewertung_vorraete: 'Test.',
        bewertung_forderungen: 'Test.',
        bewertung_rueckstellungen: 'Test.',
        vorraete_kommentar: 'Test.',
        forderungen_kommentar: 'Test.',
        eigenkapital_kommentar: 'Test.',
        rueckstellungen_kommentar: 'Test.',
        verbindlichkeiten_kommentar: 'Test.',
        umsatz_kommentar: 'Test.',
        personal_kommentar: 'Test.',
        derivate_kommentar: 'Test.',
        nahestehende_kommentar: 'Test.',
        ereignisse_nach_stichtag: 'Test.',
        bestaetigung_pruefungsurteil: 'Test.',
      },
    };
    const docx = await renderAnhang({ ...testData, reportTexts: {} } as any, aiTexts, result);
    const xml = new AdmZip(docx).getEntry('word/document.xml')?.getData().toString('utf8') ?? '';

    expect(xml).toContain('Die Forderungen beliefen sich');
    expect(xml).toContain('w:highlight');
  });
});
