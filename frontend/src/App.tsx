import React, { useEffect, useState } from 'react';
import StepStammdaten from './pages/StepStammdaten';
import StepSegmente from './pages/StepSegmente';
import StepGuV from './pages/StepGuV';
import StepBilanz from './pages/StepBilanz';
import StepVorschau from './pages/StepVorschau';
import { useJahresabschluss } from './hooks/useJahresabschluss';
import type { DemoTestRunAction, StepProps } from './types';
import { PILOT_ACCESS_INVALID_EVENT, PILOT_CODE_STORAGE_KEY } from './utils/api';

type ShellScreen = 'start' | 'express' | 'abschluss' | 'archive' | 'credits' | 'settings' | 'service' | 'reportPro';

const STEPS: { id: string; label: string; icon: string; component: React.ComponentType<StepProps> }[] = [
  { id: 'stammdaten', label: 'Stammdaten', icon: '01', component: StepStammdaten },
  { id: 'segmente', label: 'Segmente & Organe', icon: '02', component: StepSegmente },
  { id: 'guv', label: 'GuV', icon: '03', component: StepGuV },
  { id: 'bilanz', label: 'Bilanz', icon: '04', component: StepBilanz },
  { id: 'vorschau', label: 'Vorschau', icon: '05', component: StepVorschau },
];

const REPORT_CARDS = [
  {
    id: 'express' as ShellScreen,
    title: 'Lumina Report Express',
    text: 'Schneller Finanzbericht aus BWA, Bilanz oder GuV – mit Management Summary, Kennzahlen, Ampelstatus und Auffälligkeiten.',
    status: 'Empfohlen',
    hint: '2 Credits / 19,99 EUR',
  },
  {
    id: 'reportPro' as ShellScreen,
    title: 'Lumina Report Pro',
    text: 'Ausführlicher Monats- oder Quartalsbericht mit Kennzahlen, Abweichungen und Handlungsempfehlungen.',
    status: 'Demnächst',
    hint: '5 Credits / 49,99 EUR',
  },
  {
    id: 'abschluss' as ShellScreen,
    title: 'Lumina Abschluss Pro',
    text: 'HGB-orientierter Jahresabschlussentwurf mit Anhang, Lagebericht und offenen Prüf-/Bestätigungspunkten.',
    status: '',
    hint: '20 Credits / 199 EUR',
  },
  {
    id: 'service' as ShellScreen,
    title: 'Lumina Abschluss Service',
    text: 'Betreute Erstellung und fachliche Durchsicht durch Volker Kusch.',
    status: '',
    hint: 'auf Anfrage',
  },
];

const styleTag = document.createElement('style');
styleTag.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(styleTag);

function fmt(value: number | undefined): string {
  const n = Number(value || 0);
  return n > 0 ? Math.round(n).toLocaleString('de-DE') : 'offen';
}

export default function App() {
  const [screen, setScreen] = useState<ShellScreen>('start');
  const [pilotCodeInput, setPilotCodeInput] = useState('');
  const [showPilotModal, setShowPilotModal] = useState(() => !window.localStorage.getItem(PILOT_CODE_STORAGE_KEY));
  const [pilotMessage, setPilotMessage] = useState('');
  const [demoTestRunAction, setDemoTestRunAction] = useState<DemoTestRunAction | null>(null);
  const {
    data, step, setStep,
    status, errorMsg, loadingMsg,
    importStatus, importMsg, fileRef,
    onChange, onArrayChange, onAddItem, onRemoveItem,
    onTransferReportText,
    handleImport, generate,
  } = useJahresabschluss();

  const CurrentStep = STEPS[step].component;

  useEffect(() => {
    const handleInvalidAccess = () => {
      setPilotMessage('Der Zugriffscode ist ungueltig oder abgelaufen.');
      setPilotCodeInput('');
      setShowPilotModal(true);
    };

    window.addEventListener(PILOT_ACCESS_INVALID_EVENT, handleInvalidAccess);
    return () => window.removeEventListener(PILOT_ACCESS_INVALID_EVENT, handleInvalidAccess);
  }, []);

  useEffect(() => {
    if (STEPS[step].id !== 'vorschau') {
      setDemoTestRunAction(null);
    }
  }, [step]);

  const unlockPilotAccess = () => {
    const code = pilotCodeInput.trim();
    if (!code) {
      setPilotMessage('Bitte geben Sie den Zugangscode ein.');
      return;
    }

    window.localStorage.setItem(PILOT_CODE_STORAGE_KEY, code);
    setPilotMessage('');
    setShowPilotModal(false);
  };

  const resetPilotAccess = () => {
    window.localStorage.removeItem(PILOT_CODE_STORAGE_KEY);
    setPilotCodeInput('');
    setPilotMessage('');
    setShowPilotModal(true);
  };

  const navItem = (id: ShellScreen, label: string, badge?: string) => (
    <button type="button" style={{ ...S.navItem, ...(screen === id ? S.navItemActive : {}) }} onClick={() => setScreen(id)}>
      <span>{label}</span>
      {badge && <span style={S.navBadge}>{badge}</span>}
    </button>
  );

  const renderStart = () => (
    <div style={S.center}>
      <div style={S.hero}>
        <h1 style={S.heroTitle}>Welchen Bericht möchten Sie erstellen?</h1>
        <p style={S.heroText}>
          Lumina führt vom Zahlenexport zum verständlichen Berichtsentwurf. Die Ergebnisse bleiben fachlich zu prüfen.
        </p>
      </div>
      <div style={S.cardGrid}>
        {REPORT_CARDS.map(card => (
          <button
            key={card.title}
            type="button"
            style={{ ...S.reportCard, ...(card.id === 'express' ? S.reportCardFeatured : {}) }}
            onClick={() => setScreen(card.id)}
          >
            <div style={S.cardTop}>
              <strong style={S.cardTitle}>{card.title}</strong>
              {card.status && <span style={card.status === 'Empfohlen' ? S.badgeGreen : S.badgeBlue}>{card.status}</span>}
            </div>
            <p style={S.cardText}>{card.text}</p>
            <div style={S.cardFooter}>{card.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );

  const renderPlaceholder = (title: string, text: string) => (
    <div style={S.centerNarrow}>
      <div style={S.panel}>
        <h1 style={S.panelTitle}>{title}</h1>
        <p style={S.panelText}>{text}</p>
      </div>
    </div>
  );

  const renderArchive = () => (
    <div style={S.centerNarrow}>
      <h1 style={S.pageTitle}>Archiv</h1>
      {[
        ['Lumina AG - Abschluss Pro 2025', 'Demo-Eintrag - Word-ZIP erzeugt'],
        ['Bauer & Partner KG - Report Express Q1', 'Demo-Eintrag - Analyse-Cockpit vorbereitet'],
        ['Schmidt Handels GmbH - Abschluss Pro 2024', 'Demo-Eintrag - Berichtsentwurf'],
      ].map(([title, meta]) => (
        <div key={title} style={S.listRow}>
          <div>
            <div style={S.listTitle}>{title}</div>
            <div style={S.muted}>{meta}</div>
          </div>
          <span style={S.badgeAmber}>Demo</span>
        </div>
      ))}
    </div>
  );

  const renderCredits = () => (
    <div style={S.centerNarrow}>
      <h1 style={S.pageTitle}>Credits</h1>
      <p style={S.pageIntro}>Platzhalter für spätere Guthabenlogik. Im Pilotbetrieb erfolgt keine echte Zahlung.</p>
      <div style={S.creditGrid}>
        {[
          ['Starter', '10 Credits', '9,99 EUR'],
          ['Standard', '40 Credits', '29,99 EUR'],
          ['Pro', '120 Credits', '79,99 EUR'],
        ].map(([name, credits, price]) => (
          <div key={name} style={S.panel}>
            <h2 style={S.smallTitle}>{name}</h2>
            <p style={S.panelText}>{credits}</p>
            <strong>{price}</strong>
            <div style={S.disabledAction}>Demnächst</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div style={S.centerNarrow}>
      <h1 style={S.pageTitle}>Einstellungen</h1>
      <div style={S.panel}>
        <div style={S.settingRow}>
          <div>
            <strong>Pilotmodus aktiv</strong>
            <div style={S.muted}>Zugangscode ist lokal im Browser gespeichert.</div>
          </div>
          <button type="button" style={S.secondaryBtn} onClick={resetPilotAccess}>Zugangscode ändern</button>
        </div>
        <div style={S.settingRow}>
          <div>
            <strong>Backend-Status</strong>
            <div style={S.muted}>Platzhalter für spätere Live-Prüfung.</div>
          </div>
          <span style={S.badgeGreen}>aktiv</span>
        </div>
        <div style={{ ...S.settingRow, borderBottom: 'none' }}>
          <div>
            <strong>Credits</strong>
            <div style={S.muted}>38 Credits als Pilot-Platzhalter.</div>
          </div>
          <span style={S.badgeBlue}>38</span>
        </div>
      </div>
    </div>
  );

  const renderStepSummary = () => {
    const b = data.bilanz;
    const g = data.guv;
    const reportTextCount = Object.keys(data.reportTexts ?? {}).length;
    const active = STEPS[step].id;
    if (active === 'stammdaten') {
      return [
        ['Pflichtfelder', data.stammdaten.firmenname && data.stammdaten.sitz ? 'gefüllt' : 'offen'],
        ['Gesellschaft', data.stammdaten.firmenname || 'noch offen'],
        ['Kapitalmarktdaten', data.stammdaten.isin ? 'vorhanden' : 'optional'],
        ['Nächster Schritt', 'Segmente & Organe'],
      ];
    }
    if (active === 'segmente') {
      return [
        ['Operative Segmente', String(data.segmente.length)],
        ['Vorstand', String(data.organe.vorstand.length)],
        ['Organe-Qualität', data.organe.vorstand.length ? 'prüfbar' : 'offen'],
        ['Offene Angaben', 'fachlich prüfen'],
      ];
    }
    if (active === 'guv') {
      const material = (g.material_roh || 0) + (g.material_dienst || 0);
      const gesamtleistung = (g.umsatzerloese || 0) + (g.bestandsveraenderung || 0) + (g.eigenleistungen || 0) + (g.sonstige_ertraege || 0);
      const hasGuVValues = (g.umsatzerloese || 0) > 0 || gesamtleistung > 0 || material > 0;
      return [
        ['Umsatzerlöse', fmt(g.umsatzerloese)],
        ['Gesamtleistung', fmt(gesamtleistung)],
        ['Materialaufwand', fmt(material)],
        ['Datenqualität', hasGuVValues ? 'bearbeitbar' : 'noch nicht importiert'],
      ];
    }
    if (active === 'bilanz') {
      const aktiva = Number(b.bilanzsumme || 0);
      const passiva = Number(b.eigenkapital || 0) + Number(b.rueckstellungen || 0) + Number(b.verbindlichkeiten || 0);
      const hasBilanzValues = aktiva > 0 || passiva > 0;
      return [
        ['Bilanzsumme', fmt(aktiva)],
        ['Bilanz ausgeglichen', hasBilanzValues ? (Math.abs(aktiva - passiva) < 2 ? 'ja' : 'prüfen') : 'noch nicht importiert'],
        ['Aktiva', fmt(aktiva)],
        ['Passiva', fmt(passiva)],
      ];
    }
    return [
      ['Berichtstexte', reportTextCount > 0 ? String(reportTextCount) : 'vorhanden'],
      ['Standard-/Fallbacktexte', 'Standardtexte verwendet'],
      ['Exportbereitschaft', 'gegeben'],
      ['Manuell zu prüfen', 'vor Freigabe'],
    ];
  };

  const renderWizard = () => (
    <div style={S.wizardShell}>
      <div style={S.wizardTop}>
        <div>
          <div style={S.kicker}>Lumina Abschluss Pro</div>
          <h1 style={S.wizardTitle}>HGB-orientierter Jahresabschlussentwurf</h1>
        </div>
        <div style={S.headerRight}>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
          <button style={S.secondaryBtn} onClick={() => fileRef.current?.click()}>
            {importStatus === 'loading' ? 'Excel wird geladen...' : 'Excel importieren'}
          </button>
          {importStatus === 'done' && <span style={S.importOk}>{importMsg}</span>}
          {importStatus === 'error' && <span style={S.importErr}>{importMsg}</span>}
        </div>
      </div>
      <div style={S.stepNav}>
        {STEPS.map((s, i) => (
          <button key={s.id} type="button" onClick={() => setStep(i)} style={{
            ...S.stepBtn,
            ...(i === step ? S.stepBtnActive : {}),
            ...(i < step ? S.stepBtnDone : {}),
          }}>
            <span style={S.stepIcon}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div style={S.summaryGrid}>
        {renderStepSummary().map(([label, value]) => (
          <div key={label} style={S.summaryCard}>
            <div style={S.summaryLabel}>{label}</div>
            <strong style={S.summaryValue}>{value}</strong>
          </div>
        ))}
      </div>
      <div style={S.content}>
        <div style={S.stepHeader}>
          <h2 style={S.stepTitle}>{STEPS[step].label}</h2>
          <div style={S.stepCount}>{step + 1} / {STEPS.length}</div>
        </div>
        <div style={S.stepBody}>
          <CurrentStep
            data={data}
            onChange={onChange}
            onArrayChange={onArrayChange}
            onAddItem={onAddItem}
            onRemoveItem={onRemoveItem}
            onTransferReportText={onTransferReportText}
            onRegisterDemoTestRun={setDemoTestRunAction}
          />
        </div>
        <div style={S.navRow}>
          <button style={S.secondaryBtn} onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>
            Zurück
          </button>
          {step < STEPS.length - 1 ? (
            <button style={S.primaryBtn} onClick={() => setStep(s => s + 1)}>Weiter</button>
          ) : (
            <div style={S.generateArea}>
              {status === 'generating' && (
                <div style={S.loadingBox}>
                  <div style={S.spinner} />
                  <span>{loadingMsg}</span>
                </div>
              )}
              {status === 'error' && <div style={S.errorBox}>{errorMsg}</div>}
              {status === 'done' && <div style={S.successBox}>Download gestartet.</div>}
              <div style={S.generateButtons}>
                {demoTestRunAction?.visible && (
                  <button
                    style={S.demoBtn}
                    onClick={() => void demoTestRunAction.run()}
                    disabled={demoTestRunAction.running || status === 'generating'}
                  >
                    {demoTestRunAction.running ? 'Demo-Testlauf läuft...' : 'Demo-Testlauf starten'}
                  </button>
                )}
                <button style={S.primaryBtn} onClick={generate} disabled={status === 'generating'}>
                  {status === 'generating' ? 'Generiert...' : 'Jahresabschluss generieren'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (screen === 'start') return renderStart();
    if (screen === 'abschluss') return renderWizard();
    if (screen === 'express') {
      return renderPlaceholder(
        'Report Express wird vorbereitet.',
        'In der nächsten Ausbaustufe entsteht hier der schnelle Finanzbericht mit Analyse-Cockpit.'
      );
    }
    if (screen === 'reportPro') {
      return renderPlaceholder('Lumina Report Pro wird vorbereitet.', 'Der ausführliche Monats- oder Quartalsbericht folgt in Etappe 2.');
    }
    if (screen === 'service') {
      return renderPlaceholder('Lumina Abschluss Service', 'Betreute Erstellung und fachliche Durchsicht durch Volker Kusch. Anfragefunktion folgt später.');
    }
    if (screen === 'archive') return renderArchive();
    if (screen === 'credits') return renderCredits();
    return renderSettings();
  };

  return (
    <div style={S.root}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.logo}>L</div>
          <div>
            <div style={S.brandName}>Lumina</div>
            <div style={S.muted}>report</div>
          </div>
        </div>
        <button type="button" style={S.newReportBtn} onClick={() => setScreen('start')}>Neuer Bericht</button>
        <div style={S.navGroup}>Erstellen</div>
        {navItem('start', 'Start')}
        {navItem('express', 'Lumina Report Express', 'Neu')}
        {navItem('abschluss', 'Lumina Abschluss Pro')}
        <div style={S.navGroup}>Verlauf</div>
        {navItem('archive', 'Archiv')}
        <div style={S.navGroup}>Konto</div>
        {navItem('credits', 'Credits', '38')}
        {navItem('settings', 'Einstellungen')}
        <div style={S.sidebarBottom}>
          <div style={S.creditCard}>
            <div style={S.creditTop}><span>Credits</span><strong>38</strong></div>
            <div style={S.muted}>Pilotmodus aktiv</div>
          </div>
          <button type="button" style={S.accessBtn} onClick={resetPilotAccess}>Zugangscode ändern</button>
        </div>
      </aside>
      <main style={S.main}>
        <div style={S.topbar}>
          <div style={S.crumb}>{screen === 'abschluss' ? 'Lumina Abschluss Pro' : 'Lumina Pilot'}</div>
          <span style={S.badgeAmber}>Pilotmodus</span>
          <button type="button" style={S.secondaryBtn} onClick={resetPilotAccess}>Zugangscode ändern</button>
        </div>
        {renderContent()}
      </main>
      {showPilotModal && (
        <div style={S.modalOverlay}>
          <form
            style={S.modal}
            onSubmit={(event) => {
              event.preventDefault();
              unlockPilotAccess();
            }}
          >
            <h2 style={S.modalTitle}>Pilot-Zugangscode eingeben</h2>
            <p style={S.modalText}>Diese Lumina-Version ist für den kontrollierten Pilotbetrieb geschützt.</p>
            <label style={S.modalLabel} htmlFor="pilot-access-code">Zugangscode</label>
            <input
              id="pilot-access-code"
              type="password"
              value={pilotCodeInput}
              onChange={(event) => setPilotCodeInput(event.target.value)}
              style={S.modalInput}
              autoFocus
            />
            {pilotMessage && <div style={S.modalError}>{pilotMessage}</div>}
            <button type="submit" style={S.modalButton}>Zugang freischalten</button>
          </form>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', background: '#f7f7f5', color: '#1f2428', fontFamily: "'Segoe UI', Arial, sans-serif" },
  sidebar: { width: 268, background: '#f0f0ee', borderRight: '1px solid #e6e7e9', padding: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 14px' },
  logo: { width: 30, height: 30, borderRadius: 9, background: '#111827', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700 },
  brandName: { fontWeight: 700, letterSpacing: '-0.02em' },
  muted: { fontSize: 12, color: '#667085' },
  newReportBtn: { border: '1px solid #d0d5dd', background: '#fff', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', fontWeight: 650, color: '#111827', fontFamily: 'inherit' },
  navGroup: { margin: '18px 8px 6px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#98a2b3', fontWeight: 700 },
  navItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', border: 'none', borderRadius: 10, padding: '9px 10px', background: 'transparent', color: '#475467', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', fontSize: 14 },
  navItemActive: { background: '#fff', color: '#111827', fontWeight: 700, boxShadow: '0 1px 2px rgba(16,24,40,0.04)' },
  navBadge: { marginLeft: 'auto', fontSize: 11, padding: '2px 7px', borderRadius: 999, background: '#fff4df', color: '#a15c07', fontWeight: 700 },
  sidebarBottom: { marginTop: 'auto', borderTop: '1px solid #e6e7e9', paddingTop: 12 },
  creditCard: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, padding: 12, marginBottom: 10 },
  creditTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  accessBtn: { width: '100%', border: '1px solid #d0d5dd', background: '#fff', borderRadius: 10, padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit', color: '#344054' },
  main: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  topbar: { height: 58, borderBottom: '1px solid #e6e7e9', display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: 'rgba(247,247,245,0.86)' },
  crumb: { flex: 1, fontSize: 13, color: '#667085' },
  center: { maxWidth: 980, margin: '0 auto', padding: '42px 28px', width: '100%' },
  centerNarrow: { maxWidth: 760, margin: '0 auto', padding: '42px 28px', width: '100%' },
  hero: { textAlign: 'center', margin: '24px 0 34px' },
  heroTitle: { fontSize: 34, letterSpacing: '-0.035em', lineHeight: 1.1, margin: '0 0 10px', fontWeight: 750 },
  heroText: { fontSize: 16, color: '#667085', lineHeight: 1.55, margin: '0 auto', maxWidth: 640 },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 14 },
  reportCard: { textAlign: 'left', minHeight: 168, background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, padding: 18, cursor: 'pointer', fontFamily: 'inherit', color: '#1f2428' },
  reportCardFeatured: { border: '1.5px solid #111827' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
  cardTitle: { fontSize: 16 },
  cardText: { margin: 0, color: '#667085', lineHeight: 1.48, fontSize: 13 },
  cardFooter: { marginTop: 18, paddingTop: 12, borderTop: '1px solid #e6e7e9', color: '#344054', fontSize: 12, fontWeight: 700 },
  badgeGreen: { borderRadius: 999, padding: '4px 8px', background: '#eaf7ef', color: '#16794c', fontSize: 11, fontWeight: 700 },
  badgeBlue: { borderRadius: 999, padding: '4px 8px', background: '#eff6ff', color: '#175cd3', fontSize: 11, fontWeight: 700 },
  badgeAmber: { borderRadius: 999, padding: '4px 8px', background: '#fff4df', color: '#a15c07', fontSize: 11, fontWeight: 700 },
  panel: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 14, padding: 18 },
  panelTitle: { margin: '0 0 8px', fontSize: 24, letterSpacing: '-0.02em' },
  panelText: { margin: 0, color: '#667085', lineHeight: 1.55 },
  pageTitle: { margin: '0 0 12px', fontSize: 26, letterSpacing: '-0.03em' },
  pageIntro: { color: '#667085', lineHeight: 1.55, marginTop: 0 },
  listRow: { background: '#fff', border: '1px solid #e6e7e9', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  listTitle: { fontWeight: 700 },
  creditGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14 },
  smallTitle: { margin: '0 0 8px', fontSize: 16 },
  disabledAction: { marginTop: 14, color: '#667085', fontSize: 13 },
  settingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e6e7e9', padding: '14px 0', gap: 16 },
  wizardShell: { height: 'calc(100vh - 58px)', overflow: 'auto', padding: '22px 28px 112px' },
  wizardTop: { display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', maxWidth: 1180, margin: '0 auto 18px' },
  kicker: { fontSize: 12, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 },
  wizardTitle: { margin: '4px 0 0', fontSize: 24, letterSpacing: '-0.02em' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
  importOk: { fontSize: 12, color: '#16794c', fontWeight: 700 },
  importErr: { fontSize: 12, color: '#b42318', fontWeight: 700 },
  stepNav: { display: 'flex', gap: 10, margin: '0 auto 14px', maxWidth: 1180, background: '#fcfcfb', borderRadius: 20, padding: '14px 16px', border: '1px solid #e6e7e9', overflowX: 'auto' },
  stepBtn: { display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderRadius: 999, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', color: '#667085', whiteSpace: 'nowrap', fontFamily: 'inherit', fontWeight: 650 },
  stepBtnActive: { background: '#111827', color: '#fff', fontWeight: 700 },
  stepBtnDone: { color: '#16794c' },
  stepIcon: { width: 23, height: 23, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, border: '1px solid currentColor' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, maxWidth: 1180, margin: '0 auto 14px' },
  summaryCard: { background: '#fbfbfa', border: '1px solid #e6e7e9', borderRadius: 14, padding: '12px 14px' },
  summaryLabel: { fontSize: 12, color: '#667085', marginBottom: 5 },
  summaryValue: { display: 'block', fontSize: 17, color: '#17212f', letterSpacing: '-0.01em' },
  content: { maxWidth: 1180, margin: '0 auto', background: '#fff', borderRadius: 18, border: '1px solid #e6e7e9', overflow: 'hidden' },
  stepHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #e6e7e9', background: '#fbfbfa' },
  stepTitle: { margin: 0, fontSize: 18, fontWeight: 700 },
  stepCount: { fontSize: 12, color: '#98a2b3', fontWeight: 700 },
  stepBody: { padding: 18, maxHeight: 'calc(100vh - 390px)', overflowY: 'auto' },
  navRow: { position: 'fixed', left: 297, right: 0, bottom: 0, zIndex: 80, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderTop: '1px solid #e6e7e9', background: 'rgba(251,251,250,0.96)', boxShadow: '0 -10px 30px rgba(16,24,40,0.08)', boxSizing: 'border-box' },
  primaryBtn: { border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
  secondaryBtn: { border: '1px solid #d0d5dd', background: '#fff', color: '#344054', borderRadius: 10, padding: '9px 13px', cursor: 'pointer', fontWeight: 650, fontFamily: 'inherit' },
  generateArea: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  generateButtons: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  demoBtn: { border: '1px solid #f59e0b', background: '#fffbeb', color: '#92400e', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' },
  loadingBox: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', color: '#175cd3', fontSize: 13 },
  spinner: { width: 16, height: 16, border: '2px solid #bfdbfe', borderTopColor: '#175cd3', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  errorBox: { padding: '8px 14px', background: '#fff0ee', border: '1px solid #f5c2bd', borderRadius: 10, fontSize: 13, color: '#b42318' },
  successBox: { padding: '8px 14px', background: '#eaf7ef', border: '1px solid #b8e6c9', borderRadius: 10, fontSize: 13, color: '#16794c', fontWeight: 700 },
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.42)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 18, border: '1px solid #e6e7e9', padding: 24, boxShadow: '0 28px 70px rgba(16,24,40,0.22)' },
  modalTitle: { margin: '0 0 8px', fontSize: 20, fontWeight: 700 },
  modalText: { margin: '0 0 18px', fontSize: 14, color: '#667085', lineHeight: 1.5 },
  modalLabel: { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700 },
  modalInput: { width: '100%', boxSizing: 'border-box', border: '1px solid #d0d5dd', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit' },
  modalError: { marginTop: 10, padding: '8px 10px', background: '#fff0ee', border: '1px solid #f5c2bd', borderRadius: 10, fontSize: 13, color: '#b42318' },
  modalButton: { width: '100%', marginTop: 16, background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
