// -------------------------------------------------------
// Tipos compartilhados entre API, Worker e Frontend
// -------------------------------------------------------

export type AutomationAction =
  | 'goto'
  | 'click'
  | 'type'
  | 'wait'
  | 'select'
  | 'check'
  | 'screenshot'
  | 'scroll'
  | 'hover';

export type SelectorType = 'role' | 'text' | 'css' | 'testid' | 'id' | 'xpath';

export interface AutomationStep {
  action: AutomationAction;
  label: string;              // Nome legível do passo
  selector?: string;          // seletor CSS, XPath, role, etc.
  selectorType?: SelectorType;
  value?: string;             // texto para type, option para select, URL para goto
  milliseconds?: number;      // para wait
  isPopup?: boolean;          // se o clique abre popup
  options?: Record<string, unknown>;
}

export interface AutomationJobData {
  jobId: string;
  jobName: string;
  targetUrl: string;
  scriptCode?: string;        // código original (opcional, para exibição)
  scriptSteps: AutomationStep[];
  requestedAt: string;
  userId?: string;
}

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';

export interface StepResult {
  index: number;
  label: string;
  status: 'aprovado' | 'falha_clique' | 'erro_js' | 'sem_texto' | 'pulado';
  detalhe: string;
  screenshotBase64?: string;
  duration?: number;          // ms
}

export interface AutomationJobResult {
  status: JobStatus;
  progress: number;           // 0–100
  pdfUrl?: string;
  htmlReportUrl?: string;
  reportMarkdown?: string;
  steps?: StepResult[];
  axeViolationsCount?: number;
  totalSteps?: number;
  approvedSteps?: number;
  failedSteps?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
