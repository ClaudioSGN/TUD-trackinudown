import { Bell, BookUser, LayoutDashboard, ListTodo, Plus, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Condominio } from '../types/domain'
import { initials } from '../lib/format'
import { useUi } from '../stores/ui'

export function Sidebar({ condominios }: { condominios: Condominio[] }) {
  const { route, navigate, openCondo } = useUi()
  const { data: reminders = [] } = useQuery({ queryKey: ['lembretes', 'active'], queryFn: () => window.tud.lembretes.list() })
  return <aside className="sidebar">
    <nav className="nav-stack" aria-label="Navegação principal">
      <button className={`nav-button ${route.page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate({ page: 'dashboard' })}><LayoutDashboard/><span>Dashboard</span></button>
      <button className={`nav-button ${route.page === 'all' ? 'active' : ''}`} onClick={() => navigate({ page: 'all' })}><ListTodo/><span>Todos os atendimentos</span></button>
    </nav>
    <section className="side-section">
      <div className="side-heading"><span className="eyebrow">Condomínios</span><button className="icon-button" onClick={() => openCondo()} aria-label="Adicionar condomínio" title="Adicionar condomínio"><Plus/></button></div>
      <div className="condo-list">
        {condominios.map(condo => <button key={condo.id} className={`nav-button ${route.page === 'condo' && route.condominioId === condo.id ? 'active' : ''}`} onClick={() => navigate({ page: 'condo', condominioId: condo.id })}>
          <span className="avatar">{initials(condo.nome)}</span><span>{condo.nome}</span>{condo.abertos > 0 && <span className="count">{condo.abertos}</span>}
        </button>)}
      </div>
    </section>
    <div className="reminder-nav"><button className={`nav-button ${route.page === 'contacts' ? 'active' : ''}`} onClick={() => navigate({ page: 'contacts' })}><BookUser/><span>Contatos</span></button><button className={`nav-button ${route.page === 'reminders' ? 'active' : ''}`} onClick={() => navigate({ page: 'reminders' })}><Bell/><span>Lembretes</span>{reminders.length > 0 && <span className="count">{reminders.length}</span>}</button></div>
    <div className="sidebar-footer"><button className={`nav-button ${route.page === 'preferences' ? 'active' : ''}`} onClick={() => navigate({ page: 'preferences' })}><Settings/><span>Preferências</span></button></div>
  </aside>
}
