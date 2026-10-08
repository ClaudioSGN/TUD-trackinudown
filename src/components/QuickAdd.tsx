import { Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Condominio } from '../types/domain'
import { useUi } from '../stores/ui'

export function QuickAdd({condominios}:{condominios:Condominio[]}){
 const {quickOpen,setQuick,openDrawer}=useUi();const [title,setTitle]=useState('');const [selected,setSelected]=useState<number>();const [error,setError]=useState(false);const input=useRef<HTMLInputElement>(null);const query=useQueryClient()
 useEffect(()=>{if(quickOpen)setTimeout(()=>input.current?.focus(),80)},[quickOpen]);useEffect(()=>window.tud.app.onGlobalQuickAdd(()=>setQuick(true)),[setQuick])
 const submit=async()=>{if(!title.trim())return;if(!selected){setError(true);setTimeout(()=>setError(false),500);return}await window.tud.quickAdd.create({condominioId:selected,titulo:title.trim()});setTitle('');await query.invalidateQueries()}
 if(!quickOpen)return <div className="quick"><button className="quick-collapsed" onClick={()=>setQuick(true)}><span className="quick-avatar">t</span><span>Registrar atendimento…</span><small style={{marginLeft:'auto'}}>Ctrl+K</small></button></div>
 return <div className={`quick open ${error?'error':''}`}><div className="quick-body"><div className="quick-head"><span className="quick-avatar">t</span><strong>O que aconteceu hoje?</strong></div><input ref={input} className="quick-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Vazamento no bloco B" aria-label="Título do atendimento rápido" onKeyDown={e=>{if(e.key==='Escape')setQuick(false);if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}if(e.key==='Enter'&&e.shiftKey){e.preventDefault();openDrawer()}}}/><span className="quick-label">Escolha o condomínio</span><div className="quick-chips">{condominios.slice(0,3).map(x=><button type="button" key={x.id} className={`chip ${selected===x.id?'active':''}`} onClick={()=>setSelected(x.id)} title={x.nome} aria-pressed={selected===x.id}><span>{x.nome}</span></button>)}<button type="button" className="chip quick-more" onClick={()=>openDrawer()} aria-label="Abrir formulário completo"><Plus size={15}/><span>Mais opções</span></button></div>{error&&<div className="quick-error">Escolha um condomínio.</div>}<div className="quick-hint"><span><kbd>Enter</kbd> registra</span><span><kbd>Shift+Enter</kbd> abre o formulário</span><span><kbd>Esc</kbd> fecha</span></div></div></div>
}
