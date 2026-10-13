import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Clock3 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { Condominio, DashboardData, Periodo, Status } from '../types/domain'
import { useState } from 'react'
import { useUi } from '../stores/ui'
import { dateTime, ago, ticketId } from '../lib/format'

const periods: Array<[Periodo,string]> = [['7d','7d'],['30d','30d'],['90d','90d'],['ano','Ano'],['tudo','Tudo']]
export function Dashboard({ condominios }: { condominios: Condominio[] }) {
  const [period, setPeriod] = useState<Periodo>('30d'); const { data } = useQuery({ queryKey: ['dashboard',period], queryFn: () => window.tud.dashboard.summary(period) })
  const { openDrawer, navigate, openCondo } = useUi()
  if (!condominios.length) return <Onboarding onAdd={() => openCondo()} />
  const d = data; const max = Math.max(1,...(d?.ranking.map(x => x.total) || [1]))
  return <div className="page">
    <div className="page-top"><div><span className="eyebrow">TUD · RESUMO</span></div><div className="segmented">{periods.map(([id,label]) => <button key={id} className={period===id?'active':''} onClick={() => setPeriod(id)}>{label}</button>)}</div></div>
    <section className="hero-grid">
      <div className="hero-copy"><h1 className="display">Seus atendimentos, <em>sob controle.</em></h1><p className="support">Você registrou {d?.kpis.total || 0} atendimentos no período em {d?.kpis.condominios || 0} condomínios.</p><button className="primary" onClick={() => openDrawer()}>Novo atendimento <ArrowRight size={17}/></button></div>
      <StatusOverview data={d} onOpen={status => navigate({ page: 'all', status })}/>
    </section>
    <section className="kpi-grid">{[['Atendimentos',d?.kpis.total],['Em aberto',d?.kpis.abertos],['Concluídos',d?.kpis.concluidos],['Condomínios ativos',condominios.length]].map(([label,value])=><article className="card kpi" key={label}><span className="eyebrow">{label}</span><strong>{value || 0}</strong><span className="muted">no período selecionado</span></article>)}</section>
    <section className="ranking"><div><span className="eyebrow">Ranking</span><h2>Condomínios com mais demandas</h2><p className="muted">Top 10 · período selecionado</p>{d?.ranking[0] && <div className="ranking-winner">{d.ranking[0].nome}</div>}</div><div className="rank-list">{d?.ranking.map((x,i)=><button className="rank-row" key={x.id} onClick={() => navigate({page:'condo',condominioId:x.id})}><span>{i+1}</span><span>{x.nome}</span><span className="bar"><span style={{width:`${x.total/max*100}%`}}/></span><strong>{x.total}</strong></button>)}</div></section>
    <section className="lower-grid"><Breakdown title="Por categoria" rows={d?.categories||[]}/><Breakdown title="Por status" rows={d?.statuses||[]}/><List title="Recentes" rows={d?.recent||[]} onOpen={id => navigate({page:'condo',condominioId:id})}/><List title="Pendências mais antigas" rows={d?.oldest||[]} onOpen={id => navigate({page:'condo',condominioId:id})} old/></section>
  </div>
}
function StatusOverview({ data, onOpen }: { data?: DashboardData; onOpen: (status: Status) => void }) {
  const total = data?.kpis.total || 0
  const count = (status: Status) => Number(data?.statuses.find(item => item.label === status)?.total || 0)
  const statuses: Array<{ label: Status; count: number; icon: typeof CheckCircle2; className: string }> = [
    { label: 'Concluído', count: count('Concluído'), icon: CheckCircle2, className: 'done' },
    { label: 'Em andamento', count: count('Em andamento'), icon: Clock3, className: 'progress' },
    { label: 'Aberto', count: count('Aberto'), icon: CircleAlert, className: 'open' }
  ]
  const percentage = (value: number) => total ? Math.round(value / total * 100) : 0
  return <div className="dashboard-visual"><div className="back-card"/><article className="product-card status-overview">
    <header className="status-overview-head"><div><span className="eyebrow">Situação no período</span><h2>Visão rápida</h2></div><div className="completion-rate"><strong>{data?.kpis.taxa || 0}%</strong><span>concluídos</span></div></header>
    <div className="status-track" role="img" aria-label={`${statuses[0].count} concluídos, ${statuses[1].count} em andamento e ${statuses[2].count} abertos`}>
      {statuses.map(item => item.count > 0 && <i key={item.label} className={item.className} style={{ width: `${item.count / Math.max(1, total) * 100}%` }}/>) }
    </div>
    <p className="status-caption">{total ? `${statuses[0].count} de ${total} atendimentos foram concluídos.` : 'Nenhum atendimento no período selecionado.'}</p>
    <div className="status-actions">
      {statuses.map(item => { const Icon = item.icon; return <button key={item.label} className={`status-action ${item.className}`} onClick={() => onOpen(item.label)} aria-label={`Ver ${item.count} atendimentos com status ${item.label}`}>
        <span className="status-icon"><Icon size={18}/></span><span className="status-label">{item.label}</span><strong>{item.count}</strong><small>{percentage(item.count)}% do total</small><ArrowUpRight className="status-arrow" size={16}/>
      </button> })}
    </div>
  </article></div>
}
function Breakdown({title,rows}:{title:string;rows:Array<{label:string;total:number}>}){const max=Math.max(1,...rows.map(x=>x.total));return <article className="card breakdown"><h3>{title}</h3>{rows.length?rows.map(x=><div className="break-row" key={x.label}><span>{x.label}</span><span className="bar"><span style={{width:`${x.total/max*100}%`}}/></span><strong>{x.total}</strong></div>):<p className="muted">Ainda não há dados.</p>}</article>}
function List({title,rows,onOpen,old}:{title:string;rows:any[];onOpen:(id:number)=>void;old?:boolean}){return <article className="card list-card"><h3>{title}</h3>{rows.length?rows.map(x=><button className="nav-button" style={{width:'100%'}} key={x.id} onClick={()=>onOpen(x.condominio_id)}><i className={`dot ${x.status==='Concluído'?'done':x.status==='Em andamento'?'progress':''}`}/><span className="ticket-id">{ticketId(x.id)}</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.titulo}</span><small style={{marginLeft:'auto'}}>{old?ago(x.data_atendimento):dateTime(x.data_atendimento).slice(0,10)}</small></button>):<p className="muted">Nada por aqui.</p>}</article>}
function Onboarding({onAdd}:{onAdd:()=>void}){return <div className="page onboarding"><span className="eyebrow">Bem-vindo ao TUD</span><h1 className="display">Vamos <em>começar</em>?</h1><p className="support">Organize atendimentos, acompanhe pendências e guarde imagens sem tirar nenhum dado do seu computador.</p><div className="step-grid"><article className="step dark"><span className="step-number">1</span><h3>Cadastre seus condomínios</h3><p>Crie o primeiro grupo para começar.</p><button className="primary" onClick={onAdd}>Adicionar condomínio</button></article><article className="step"><span className="step-number">2</span><h3>Registre cada atendimento</h3><p className="muted">Use o Quick Add (Ctrl+K) ou o formulário completo.</p></article><article className="step accent"><span className="step-number">3</span><h3>Anexe imagens com Ctrl+V</h3><p className="muted">Copie um print e cole direto no atendimento.</p></article></div></div>}
