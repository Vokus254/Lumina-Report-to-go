import React, { useEffect, useState } from 'react';
import StepStammdaten from './pages/StepStammdaten';
import StepSegmente   from './pages/StepSegmente';
import StepGuV        from './pages/StepGuV';
import StepBilanz     from './pages/StepBilanz';
import StepVorschau   from './pages/StepVorschau';
import { useJahresabschluss } from './hooks/useJahresabschluss';
import type { StepProps } from './types';
import { PILOT_ACCESS_INVALID_EVENT, PILOT_CODE_STORAGE_KEY } from './utils/api';

const STEPS: { id: string; label: string; icon: string; component: React.ComponentType<StepProps> }[] = [
  { id: 'stammdaten', label: 'Stammdaten',       icon: '🏢', component: StepStammdaten },
  { id: 'segmente',   label: 'Segmente & Organe', icon: '👥', component: StepSegmente },
  { id: 'guv',        label: 'GuV',               icon: '📈', component: StepGuV },
  { id: 'bilanz',     label: 'Bilanz',             icon: '⚖️', component: StepBilanz },
  { id: 'vorschau',   label: 'Vorschau',           icon: '✅', component: StepVorschau },
];

// Inject keyframe animation once
const styleTag = document.createElement('style');
styleTag.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(styleTag);

export default function App() {
  const [pilotCodeInput, setPilotCodeInput] = useState('');
  const [showPilotModal, setShowPilotModal] = useState(() => !window.localStorage.getItem(PILOT_CODE_STORAGE_KEY));
  const [pilotMessage, setPilotMessage] = useState('');
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
      setPilotMessage('Der Zugriffscode ist ungültig oder abgelaufen.');
      setPilotCodeInput('');
      setShowPilotModal(true);
    };

    window.addEventListener(PILOT_ACCESS_INVALID_EVENT, handleInvalidAccess);
    return () => window.removeEventListener(PILOT_ACCESS_INVALID_EVENT, handleInvalidAccess);
  }, []);

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

  return (
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>
            <span style={S.logoIcon}>📑</span>
            <div>
              <div style={S.logoTitle}>Jahresabschluss Generator</div>
              <div style={S.logoSub}>HGB-orientierte Berichtsentwuerfe mit KI-Freitexten</div>
            </div>
          </div>
          <div style={S.headerRight}>
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleImport} />
            <button style={S.importBtn} onClick={() => fileRef.current?.click()}>
              {importStatus === 'loading' ? '⏳ Wird eingelesen...' : '📥 Excel importieren'}
            </button>
            {importStatus === 'done'  && <span style={S.importOk}>{importMsg}</span>}
            {importStatus === 'error' && <span style={S.importErr}>{importMsg}</span>}
            {data.stammdaten.firmenname && (
              <div style={S.companyChip}>{data.stammdaten.firmenname}</div>
            )}
            <button type="button" style={S.accessBtn} onClick={resetPilotAccess}>
              Zugangscode ändern
            </button>
          </div>
        </div>
      </div>

      <div style={S.main}>
        {/* Step Nav */}
        <div style={S.stepNav}>
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => setStep(i)} style={{
              ...S.stepBtn,
              ...(i === step ? S.stepBtnActive : {}),
              ...(i < step ? S.stepBtnDone : {}),
            }}>
              <span style={S.stepIcon}>{i < step ? '✓' : s.icon}</span>
              <span style={S.stepLabel}>{s.label}</span>
              {i < STEPS.length - 1 && <span style={S.stepArrow}>›</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={S.content}>
          <div style={S.stepHeader}>
            <h2 style={S.stepTitle}>{STEPS[step].icon} {STEPS[step].label}</h2>
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
            />
          </div>
          <div style={S.navRow}>
            <button
              style={{ ...S.navBtn, ...S.navBtnSecondary }}
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Zurück
            </button>
            {step < STEPS.length - 1 ? (
              <button style={{ ...S.navBtn, ...S.navBtnPrimary }} onClick={() => setStep(s => s + 1)}>
                Weiter →
              </button>
            ) : (
              <div style={S.generateArea}>
                {status === 'generating' && (
                  <div style={S.loadingBox}>
                    <div style={S.spinner} />
                    <span style={S.loadingText}>{loadingMsg}</span>
                  </div>
                )}
                {status === 'error' && <div style={S.errorBox}>⚠ {errorMsg}</div>}
                {status === 'done'  && <div style={S.successBox}>✓ Download gestartet!</div>}
                <button
                  style={{ ...S.navBtn, ...S.generateBtn, opacity: status === 'generating' ? 0.7 : 1, cursor: status === 'generating' ? 'not-allowed' : 'pointer' }}
                  onClick={generate}
                  disabled={status === 'generating'}
                >
                  {status === 'generating' ? '⏳ Generiert...' : '🚀 Jahresabschluss generieren'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
  root:           { minHeight: '100vh', background: '#F3F4F6', fontFamily: "'Segoe UI', Arial, sans-serif" },
  header:         { background: 'linear-gradient(135deg, #1F3864 0%, #2E75B6 100%)' },
  headerInner:    { maxWidth: 1100, margin: '0 auto', padding: '14px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo:           { display: 'flex', gap: 14, alignItems: 'center' },
  logoIcon:       { fontSize: 28 },
  logoTitle:      { fontSize: 18, fontWeight: 700, color: '#fff' },
  logoSub:        { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  headerRight:    { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' },
  importBtn:      { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  accessBtn:      { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  importOk:       { fontSize: 12, color: '#A7F3D0', fontWeight: 600 },
  importErr:      { fontSize: 12, color: '#FCA5A5', fontWeight: 600 },
  companyChip:    { background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 },
  main:           { maxWidth: 1100, margin: '0 auto', padding: '28px 20px' },
  stepNav:        { display: 'flex', gap: 4, marginBottom: 24, background: '#fff', borderRadius: 12, padding: 8, border: '1px solid #E5E7EB', overflowX: 'auto' },
  stepBtn:        { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  stepBtnActive:  { background: '#EBF3FB', color: '#1F3864', fontWeight: 700 },
  stepBtnDone:    { color: '#059669' },
  stepIcon:       { fontSize: 16 },
  stepLabel:      { fontSize: 13 },
  stepArrow:      { color: '#D1D5DB', marginLeft: 4 },
  content:        { background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden' },
  stepHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' },
  stepTitle:      { margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' },
  stepCount:      { fontSize: 12, color: '#9CA3AF', fontWeight: 600 },
  stepBody:       { padding: '24px', maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' },
  navRow:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderTop: '1px solid #E5E7EB', background: '#FAFAFA' },
  navBtn:         { padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  navBtnPrimary:  { background: '#2E75B6', color: '#fff' },
  navBtnSecondary:{ background: '#F3F4F6', color: '#374151', border: '1px solid #D1D5DB' },
  generateArea:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
  generateBtn:    { background: 'linear-gradient(135deg, #1F3864, #2E75B6)', color: '#fff', padding: '12px 28px', fontSize: 15 },
  loadingBox:     { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE' },
  spinner:        { width: 16, height: 16, border: '2px solid #BFDBFE', borderTopColor: '#2E75B6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 },
  loadingText:    { fontSize: 13, color: '#1D4ED8', fontStyle: 'italic' },
  errorBox:       { padding: '8px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' },
  successBox:     { padding: '8px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, fontSize: 13, color: '#065F46', fontWeight: 600 },
  modalOverlay:   { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,24,39,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:          { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 24, boxShadow: '0 20px 50px rgba(15,23,42,0.25)' },
  modalTitle:     { margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#111827' },
  modalText:      { margin: '0 0 18px', fontSize: 14, color: '#4B5563', lineHeight: 1.5 },
  modalLabel:     { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#1F3864' },
  modalInput:     { width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit' },
  modalError:     { marginTop: 10, padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#B91C1C' },
  modalButton:    { width: '100%', marginTop: 16, background: '#2E75B6', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
