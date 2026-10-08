import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from '../components/Sidebar'
import { Dashboard } from '../pages/Dashboard'
import { AttendancesPage } from '../pages/Attendances'
import { Preferences } from '../pages/Preferences'
import { Reminders } from '../pages/Reminders'
import { AttendanceDrawer, CondominioModal } from '../components/Forms'
import { QuickAdd } from '../components/QuickAdd'
import { UpdateBanner } from '../components/UpdateBanner'
import { useUi } from '../stores/ui'
import type { AppSettings } from '../types/domain'

const fallback:AppSettings={theme:'light',animation:'full',backgroundEffects:true,splash:true,particles:true,density:'comfortable',categories:['Suporte remoto','Elétrica','Infraestrutura','Visita'],startWithWindows:false,tray:false,closeBehavior:'quit',globalShortcut:true,autoBackup:false,backupFolder:'',onboardingSeen:false,lastRoute:'dashboard'}

export function App(){
 const ui=useUi();const [shortcuts,setShortcuts]=useState(false);const {data:condominios=[]}=useQuery({queryKey:['condominios'],queryFn:()=>window.tud.condominios.list()});const {data:settings=fallback}=useQuery({queryKey:['settings'],queryFn:()=>window.tud.settings.get()});
 useEffect(()=>{document.documentElement.dataset.motion=settings.animation;document.documentElement.dataset.density=settings.density;document.documentElement.dataset.theme=settings.theme;localStorage.setItem('tud-theme',settings.theme);void window.tud.app.setTheme(settings.theme)},[settings])
 useEffect(()=>window.tud.app.onOpenReminders(()=>ui.navigate({page:'reminders'})),[ui.navigate])
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();ui.setQuick(true)}else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='n'){e.preventDefault();ui.openCondo()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();ui.openDrawer()}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();ui.navigate({page:'dashboard'})}else if((e.ctrlKey||e.metaKey)&&/^[1-9]$/.test(e.key)){const condo=condominios[Number(e.key)-1];if(condo)ui.navigate({page:'condo',condominioId:condo.id})}else if(e.key==='?'&&!e.ctrlKey){setShortcuts(true)}else if(e.key==='Escape'){setShortcuts(false);ui.setQuick(false)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[ui,condominios])
 const page=ui.route.page==='dashboard'?<Dashboard condominios={condominios}/>:ui.route.page==='preferences'?<Preferences settings={settings}/>:ui.route.page==='reminders'?<Reminders/>:<AttendancesPage condominios={condominios} categories={settings.categories} condominioId={ui.route.page==='condo'?ui.route.condominioId:undefined}/>
 return <div className="app"><div className="titlebar"><span>tud<span className="wordmark-dot">.</span></span></div><div className="shell"><Sidebar condominios={condominios}/><main className="content">{page}</main></div><QuickAdd condominios={condominios}/><AttendanceDrawer condominios={condominios} settings={settings} preferredCondo={ui.route.page==='condo'?ui.route.condominioId:undefined}/><CondominioModal condominios={condominios}/><UpdateBanner/>{shortcuts&&<ShortcutModal onClose={()=>setShortcuts(false)}/>} {settings.splash&&<div className="splash"><div><strong>tud<span className="wordmark-dot">.</span></strong><em>Tracking u Down</em></div></div>}</div>
}
function ShortcutModal({onClose}:{onClose:()=>void}){const rows=[['Ctrl+K','Abrir Quick Add'],['Ctrl+Alt+T','Trazer Quick Add para frente'],['Ctrl+N','Novo atendimento'],['Ctrl+Shift+N','Novo condomínio'],['Ctrl+V','Colar imagem'],['Ctrl+Enter','Salvar formulário'],['Ctrl+D','Ir ao Dashboard'],['Ctrl+1…9','Abrir condomínio'],['Esc','Fechar camada atual'],['?','Exibir estes atalhos']];return <div className="modal-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal"><span className="eyebrow">Ajuda</span><h2>Atalhos de <em>teclado</em></h2>{rows.map(([key,text])=><div className="pref-row" key={key}><kbd className="badge">{key}</kbd><span>{text}</span></div>)}<div className="modal-foot"><button className="primary" onClick={onClose}>Fechar</button></div></div></div>}
