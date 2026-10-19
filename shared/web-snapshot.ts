export const WEB_SNAPSHOT_VERSION = 1 as const

export interface WebCondominium {
  id: number
  name: string
  address: string
  generalContact: string
  managerName: string
  managerContact: string
  itName: string
  itContact: string
  notes: string
  archived: boolean
}

export interface WebAttachment {
  id: number
  updateId: number | null
  name: string
  mediaKey: string
  createdAt: string
}

export interface WebTicketUpdate {
  id: number
  type: 'criacao' | 'nota' | 'status' | 'categoria'
  text: string
  previousValue: string | null
  nextValue: string | null
  createdAt: string
}

export interface WebTicket {
  id: number
  condominiumId: number
  condominiumName: string
  title: string
  description: string
  category: string
  status: 'Aberto' | 'Em andamento' | 'Concluído'
  priority: 'Baixa' | 'Normal' | 'Alta'
  serviceAt: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  relatedIds: number[]
  updates: WebTicketUpdate[]
  attachments: WebAttachment[]
}

export interface WebSnapshot {
  schemaVersion: typeof WEB_SNAPSHOT_VERSION
  generatedAt: string
  appVersion: string
  summary: {
    total: number
    open: number
    inProgress: number
    completed: number
    condominiums: number
    completionRate: number
  }
  condominiums: WebCondominium[]
  tickets: WebTicket[]
}

