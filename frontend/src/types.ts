/**
 * Gemeinsame Typen für das Frontend.
 * JahresabschlussData kommt direkt aus @nexus/schema.
 */
import type { JahresabschlussData as SchemaJahresabschlussData } from '@nexus/schema';

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

export type JahresabschlussData = SchemaJahresabschlussData & {
  reportTexts?: Record<string, ReportTextEntry>;
};

// Callback-Typen für den Wizard-State in App.tsx
export type OnChange = (section: string, field: string, value: string | number) => void;
export type OnArrayChange = (path: string, index: number, field: string, value: string | number) => void;
export type OnAddItem = (path: string, template: Record<string, unknown>) => void;
export type OnRemoveItem = (path: string, index: number) => void;
export type OnTransferReportText = (entry: ReportTextEntry) => void;

/** Props die alle Step-Komponenten gemeinsam haben */
export interface StepProps {
  data: JahresabschlussData;
  onChange: OnChange;
  onArrayChange: OnArrayChange;
  onAddItem: OnAddItem;
  onRemoveItem: OnRemoveItem;
  onTransferReportText?: OnTransferReportText;
}
