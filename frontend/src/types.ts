/**
 * Gemeinsame Frontend-Typen.
 *
 * Vercel baut das Frontend isoliert aus dem Ordner `frontend`.
 * Deshalb darf diese Datei kein externes `@nexus/schema` auflösen müssen.
 */
export type SectionTextParagraph = {
  type: 'confirmed' | 'unconfirmed';
  text: string;
  source: 'facts' | 'usual_text_block' | 'missing_input_notice' | 'user_input';
  requiresConfirmation: boolean;
};

export type ReportTextEntry = {
  sectionId: string;
  text: string;
  paragraphs: SectionTextParagraph[];
  status: 'transferred';
  role: string;
  scope: 'kurz' | 'mittel' | 'ausführlich';
  temperature: number;
  customPrompt: string;
  prompt?: string;
  transferredAt: string;
  updatedAt?: string;
  generationSignature?: string;
};

export type JahresabschlussData = {
  stammdaten: Record<string, any>;
  segmente: any[];
  guv: Record<string, any>;
  bilanz: Record<string, any>;
  kennzahlen: Record<string, any>;
  organe: {
    vorstand: any[];
    aufsichtsrat: any[];
    [key: string]: any;
  };
  beteiligungen: any[];
  reportTexts?: Record<string, ReportTextEntry>;
  [key: string]: any;
};

export type OnChange = (section: string, field: string, value: string | number) => void;
export type OnArrayChange = (path: string, index: number, field: string, value: string | number) => void;
export type OnAddItem = (path: string, template: Record<string, unknown>) => void;
export type OnRemoveItem = (path: string, index: number) => void;
export type OnTransferReportText = (entry: ReportTextEntry) => void;
export type DemoTestRunAction = {
  run: () => void | Promise<void>;
  running: boolean;
  visible: boolean;
};
export type OnRegisterDemoTestRun = (action: DemoTestRunAction | null) => void;

export interface StepProps {
  data: JahresabschlussData;
  onChange: OnChange;
  onArrayChange: OnArrayChange;
  onAddItem: OnAddItem;
  onRemoveItem: OnRemoveItem;
  onTransferReportText?: OnTransferReportText;
  onRegisterDemoTestRun?: OnRegisterDemoTestRun;
}
