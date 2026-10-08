export type Status = 'Aberto' | 'Em andamento' | 'Concluído'
export type Prioridade = 'Baixa' | 'Normal' | 'Alta'
export type Periodo = '7d' | '30d' | '90d' | 'ano' | 'tudo'

export interface Condominio {
  id: number
  nome: string
  endereco: string
  contato: string
  observacoes: string
  arquivado: number
  criado_em: string
  abertos: number
  total: number
}

export interface Anexo {
  id: number
  atendimento_id: number
  caminho: string
  miniatura: string
  nome_original: string
  largura?: number
  altura?: number
  bytes: number
  criado_em: string
}

export interface Atendimento {
  id: number
  condominio_id: number
  condominio_nome: string
  titulo: string
  descricao: string
  categoria: string
  status: Status
  prioridade: Prioridade
  data_atendimento: string
  concluido_em: string | null
  criado_em: string
  atualizado_em: string
  anexo_count: number
  anexos?: Anexo[]
}

export interface AtendimentoInput {
  id?: number
  condominioId: number
  titulo: string
  descricao?: string
  categoria?: string
  status?: Status
  prioridade?: Prioridade
  dataAtendimento?: string
}

export interface AtendimentoAtualizacao {
  id: number
  atendimento_id: number
  tipo: 'criacao' | 'nota' | 'status' | 'categoria'
  texto: string
  valor_anterior: string | null
  valor_novo: string | null
  criado_em: string
}

export interface AtendimentoUpdateInput {
  text?: string
  status?: Status
  categoria?: string
}

export interface Lembrete {
  id: number
  titulo: string
  observacoes: string
  lembrete_em: string
  atendimento_id: number | null
  atendimento_titulo: string | null
  condominio_nome: string | null
  concluido: number
  notificado_em: string | null
  criado_em: string
  concluido_em: string | null
}

export interface LembreteInput {
  titulo: string
  observacoes?: string
  lembreteEm: string
  atendimentoId?: number
}

export interface AppUpdateState {
  status: 'checking' | 'available' | 'downloading' | 'ready' | 'idle' | 'error'
  version?: string
  percent?: number
  message?: string
}

export interface AtendimentoFilters {
  condominioId?: number
  search?: string
  status?: Status | ''
  prioridade?: Prioridade | ''
  categoria?: string
  periodo?: Periodo
  sort?: 'recentes' | 'antigos' | 'prioridade' | 'status'
  limit?: number
}

export interface DashboardData {
  kpis: { total: number; abertos: number; concluidos: number; condominios: number; taxa: number }
  previous: { total: number; abertos: number; concluidos: number; condominios: number }
  ranking: Array<{ id: number; nome: string; total: number }>
  monthly: Array<{ mes: string; total: number }>
  categories: Array<{ label: string; total: number }>
  statuses: Array<{ label: string; total: number }>
  recent: Atendimento[]
  oldest: Atendimento[]
}

export interface AppSettings {
  theme: 'light' | 'dark'
  animation: 'full' | 'reduced' | 'off'
  backgroundEffects: boolean
  splash: boolean
  particles: boolean
  density: 'comfortable' | 'compact'
  categories: string[]
  startWithWindows: boolean
  tray: boolean
  closeBehavior: 'quit' | 'tray'
  globalShortcut: boolean
  autoBackup: boolean
  backupFolder: string
  onboardingSeen: boolean
  lastRoute: string
  windowBounds?: { x?: number; y?: number; width: number; height: number; maximized?: boolean }
}

export interface TudApi {
  condominios: {
    list(includeArchived?: boolean): Promise<Condominio[]>
    create(input: Partial<Condominio>): Promise<number>
    update(id: number, input: Partial<Condominio>): Promise<void>
    archive(id: number): Promise<void>
    restore(id: number): Promise<void>
  }
  atendimentos: {
    list(filters?: AtendimentoFilters): Promise<Atendimento[]>
    get(id: number): Promise<Atendimento | null>
    create(input: AtendimentoInput): Promise<number>
    update(id: number, input: AtendimentoInput): Promise<void>
    setStatus(id: number, status: Status): Promise<void>
    updates(id: number): Promise<AtendimentoAtualizacao[]>
    addUpdate(id: number, input: AtendimentoUpdateInput): Promise<number>
    removeUpdate(id: number, updateIds: number[]): Promise<void>
    related(id: number): Promise<Atendimento[]>
    link(id: number, relatedId: number): Promise<void>
    unlink(id: number, relatedId: number): Promise<void>
    remove(id: number): Promise<void>
    undoRemove(id: number): Promise<void>
  }
  anexos: {
    addFiles(id: number, files: File[]): Promise<Anexo[]>
    addBuffer(id: number, bytes: Uint8Array, mime: string, name: string): Promise<Anexo>
    remove(id: number): Promise<void>
    reveal(path: string): Promise<void>
    copyToClipboard(path: string): Promise<void>
  }
  dashboard: { summary(period: Periodo): Promise<DashboardData> }
  lembretes: {
    list(includeCompleted?: boolean): Promise<Lembrete[]>
    create(input: LembreteInput): Promise<number>
    setDone(id: number, done: boolean): Promise<void>
    remove(id: number): Promise<void>
  }
  quickAdd: { create(input: { condominioId: number; titulo: string }): Promise<number> }
  backup: { create(folder?: string): Promise<string | null>; restore(): Promise<boolean> }
  export: { csv(condominioId?: number): Promise<string | null> }
  settings: { get(): Promise<AppSettings>; set(patch: Partial<AppSettings>): Promise<AppSettings> }
  app: {
    version(): Promise<string>
    openDataFolder(): Promise<void>
    setTheme(theme: 'light' | 'dark'): Promise<void>
    checkForUpdates(): Promise<void>
    installUpdate(): Promise<void>
    onGlobalQuickAdd(callback: () => void): () => void
    onOpenReminders(callback: () => void): () => void
    onUpdateState(callback: (state: AppUpdateState) => void): () => void
  }
}
