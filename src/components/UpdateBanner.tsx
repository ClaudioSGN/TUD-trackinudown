import { CheckCircle2, Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppUpdateState } from '../types/domain'

export function UpdateBanner() {
  const [state, setState] = useState<AppUpdateState | null>(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => window.tud.app.onUpdateState(next => { setState(next); if (next.status === 'ready') setDismissed(false) }), [])
  if (!state || dismissed || !['available', 'downloading', 'ready'].includes(state.status)) return null
  const ready = state.status === 'ready'
  return <aside className="update-banner" aria-live="polite"><span className="update-icon">{ready ? <CheckCircle2/> : <Download/>}</span><div><strong>{ready ? `TUD ${state.version || ''} está pronto` : 'Baixando atualização…'}</strong><small>{ready ? 'A nova versão já pode ser instalada.' : `${state.percent || 0}% concluído`}</small>{!ready && <span className="update-progress"><i style={{ width: `${state.percent || 4}%` }}/></span>}</div>{ready && <button className="primary" onClick={() => window.tud.app.installUpdate()}>Atualizar agora</button>}<button className="icon-button" onClick={() => setDismissed(true)} aria-label="Fechar aviso de atualização"><X size={16}/></button></aside>
}
