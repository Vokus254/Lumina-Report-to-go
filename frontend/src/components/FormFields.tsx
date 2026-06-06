import React from 'react';

// ── Field ─────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  name?: string;
  value: string | number;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  type?: string;
  placeholder?: string;
  hint?: string;
}

export function Field({ label, name, value, onChange, type = 'text', placeholder = '', hint = '' }: FieldProps) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        name={name}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
      {hint && <span style={styles.hint}>{hint}</span>}
    </div>
  );
}

// ── NumberField ───────────────────────────────────────────────────
interface NumberFieldProps {
  label: string;
  name?: string;
  value: number | string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  hint?: string;
  suffix?: string;
}

export function NumberField({ label, name, value, onChange, hint = '', suffix = 'TEUR' }: NumberFieldProps) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <div style={styles.inputRow}>
        <input
          type="number"
          name={name}
          value={value ?? ''}
          onChange={onChange}
          style={{ ...styles.input, textAlign: 'right' }}
          step="1"
        />
        {suffix && <span style={styles.suffix}>{suffix}</span>}
      </div>
      {hint && <span style={styles.hint}>{hint}</span>}
    </div>
  );
}

// ── SelectField ───────────────────────────────────────────────────
interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  name?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  options: (string | SelectOption)[];
}

export function SelectField({ label, name, value, onChange, options }: SelectFieldProps) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <select name={name} value={value ?? ''} onChange={onChange} style={styles.input}>
        {options.map(o => {
          const val = typeof o === 'string' ? o : o.value;
          const lab = typeof o === 'string' ? o : o.label;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
}

// ── SectionBox ────────────────────────────────────────────────────
interface SectionBoxProps {
  title: string;
  children: React.ReactNode;
}

export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <div style={styles.sectionBox}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────
interface RowProps {
  children: React.ReactNode;
  cols?: number;
}

export function Row({ children, cols = 2 }: RowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '12px 20px' }}>
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────
interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  return (
    <div style={styles.divider}>
      {label && <span style={styles.dividerLabel}>{label}</span>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  fieldGroup:   { display: 'flex', flexDirection: 'column', gap: 4 },
  label:        { fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:        { padding: '8px 10px', fontSize: 14, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', background: '#FAFAFA', color: '#111827', transition: 'border-color 0.15s' },
  inputRow:     { display: 'flex', alignItems: 'center', gap: 6 },
  suffix:       { fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', minWidth: 32 },
  hint:         { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  sectionBox:   { background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '18px 20px', marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#1F3864', marginBottom: 14, marginTop: 0 },
  divider:      { borderTop: '1px solid #E5E7EB', margin: '20px 0' },
  dividerLabel: { display: 'block', textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: -8, background: '#fff', width: 'fit-content', padding: '0 10px' },
};
