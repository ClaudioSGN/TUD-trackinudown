import { X, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings, AtendimentoInput, Condominio } from '../types/domain'
import { useUi } from '../stores/ui'

export function CondominioModal({ condominios }: { condominios: Condominio[] }) {
  const { condoModal, closeCondo, navigate } = useUi()
  const query = useQueryClient()
  const editing = typeof condoModal === 'number'
  const current = editing ? condominios.find(item => item.id === condoModal) : undefined
  const blank = { nome: '', endereco: '', contato: '', gestor_nome: '', gestor_contato: '', ti_nome: '', ti_contato: '', observacoes: '' }
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Partial<Condominio>>({ defaultValues: current || blank })
  useEffect(() => reset(current || blank), [current, reset])
  if (condoModal === null) return null
  const save = handleSubmit(async values => {
    if (editing) await window.tud.condominios.update(condoModal as number, values)
    else { const id = await window.tud.condominios.create(values); navigate({ page: 'condo', condominioId: id }) }
    await query.invalidateQueries(); closeCondo()
  })
  const archive = async () => {
    if (!editing || !confirm(`Arquivar “${current?.nome}”? O histórico será mantido.`)) return
    await window.tud.condominios.archive(condoModal as number); navigate({ page: 'dashboard' }); await query.invalidateQueries(); closeCondo()
  }
  return <div className="modal-wrap" onMouseDown={event => { if (event.target === event.currentTarget) closeCondo() }}><form className="modal condo-modal" onSubmit={save}>
    <span className="eyebrow">{editing ? 'Editar condomínio' : 'Novo condomínio'}</span><h2>{editing ? 'Editar' : 'Novo'} <em>condomínio</em></h2>
    <section className="condo-form-section"><h3>Informações gerais</h3><Field label="Nome" error={errors.nome?.message}><input autoFocus {...register('nome', { required: 'Informe o nome do condomínio.' })}/></Field><Field label="Endereço"><input {...register('endereco')}/></Field><Field label="Contato geral"><input {...register('contato')} placeholder="Telefone, e-mail ou portaria"/></Field></section>
    <div className="condo-people-grid"><section className="condo-form-section"><h3>Gestor responsável</h3><Field label="Nome"><input {...register('gestor_nome')} placeholder="Ex.: Ana Ribeiro"/></Field><Field label="Contato"><input {...register('gestor_contato')} placeholder="Telefone ou e-mail"/></Field></section><section className="condo-form-section"><h3>Equipe de T.I.</h3><Field label="Equipe ou empresa"><input {...register('ti_nome')} placeholder="Ex.: Suporte N1"/></Field><Field label="Contato"><input {...register('ti_contato')} placeholder="Telefone ou e-mail"/></Field></section></div>
    <section className="condo-form-section"><Field label="Observações"><textarea {...register('observacoes')}/></Field></section>
    <div className="modal-foot">{editing && <button type="button" className="ghost danger" onClick={archive}>Arquivar</button>}<button type="button" className="ghost" onClick={closeCondo}>Cancelar</button><button className="primary" disabled={isSubmitting}>{isSubmitting ? 'Salvando…' : 'Salvar'}</button></div>
  </form></div>
}

export function AttendanceDrawer({ condominios, settings, preferredCondo }: { condominios: Condominio[]; settings: AppSettings; preferredCondo?: number }) {
  const {drawerId,closeDrawer}=useUi(); const editing=typeof drawerId==='number'; const {data:item}=useQuery({queryKey:['atendimento',drawerId],queryFn:()=>window.tud.atendimentos.get(drawerId as number),enabled:editing}); const query=useQueryClient(); const [files,setFiles]=useState<File[]>([]); const [drag,setDrag]=useState(false); const [saveError,setSaveError]=useState(''); const [persistedId,setPersistedId]=useState<number|null>(null)
  const {register,handleSubmit,reset,formState:{errors,isSubmitting,isDirty}}=useForm<AtendimentoInput>({defaultValues:blank(preferredCondo||condominios[0]?.id)})
  useEffect(()=>{if(item)reset({condominioId:item.condominio_id,titulo:item.titulo,descricao:item.descricao,categoria:item.categoria,status:item.status,prioridade:item.prioridade,dataAtendimento:localDate(item.data_atendimento)});else if(drawerId==='new')reset(blank(preferredCondo||condominios[0]?.id))},[item,drawerId,preferredCondo,condominios,reset])
  useEffect(()=>{if(drawerId===null)return;const paste=(event:ClipboardEvent)=>{const images=[...(event.clipboardData?.items||[])].filter(x=>x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean) as File[];if(images.length){event.preventDefault();setFiles(old=>[...old,...images])}};window.addEventListener('paste',paste);return()=>window.removeEventListener('paste',paste)},[drawerId])
  useEffect(()=>{if(drawerId!==null){setFiles([]);setSaveError('');setPersistedId(null)}},[drawerId])
  if(drawerId===null)return null
  const close=()=>{if(persistedId&&files.length&&!confirm('O chamado já foi salvo, mas os anexos ainda não. Fechar mesmo assim?'))return;if(!persistedId&&(isDirty||files.length)&&!confirm('Descartar alterações?'))return;setFiles([]);setSaveError('');setPersistedId(null);closeDrawer()}
  const save=handleSubmit(async values=>{setSaveError('');const payload={...values,dataAtendimento:new Date(values.dataAtendimento||Date.now()).toISOString()};try{let id:number;if(editing){id=drawerId as number;await window.tud.atendimentos.update(id,payload)}else if(persistedId){id=persistedId;await window.tud.atendimentos.update(id,payload)}else{id=await window.tud.atendimentos.create(payload);setPersistedId(id)}if(files.length)await window.tud.anexos.addFiles(id,files);setFiles([]);setPersistedId(null);await query.invalidateQueries();closeDrawer()}catch(error){setSaveError(error instanceof Error?error.message:'Não foi possível salvar o atendimento e seus anexos.')}})
  const accept=(incoming:FileList|File[])=>setFiles(old=>[...old,...Array.from(incoming).filter(x=>x.type.startsWith('image/'))])
  return <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><form className="drawer" onSubmit={save}><header className="drawer-head"><div><span className="eyebrow">{editing?'Editar atendimento':'Novo atendimento'}</span><h2>{editing?'Editar':'Novo'} <em>atendimento</em></h2></div><button type="button" className="icon-button" onClick={close}><X/></button></header><div className="drawer-body"><Field label="Condomínio" error={errors.condominioId?.message}><select {...register('condominioId',{valueAsNumber:true,required:'Escolha um condomínio.'})}>{condominios.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></Field><Field label="Título" error={errors.titulo?.message}><input autoFocus {...register('titulo',{required:'Informe o título do atendimento.'})}/></Field><Field label="Descrição"><textarea {...register('descricao')}/></Field><div className="field-grid"><Field label="Categoria"><select {...register('categoria')}>{settings.categories.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Prioridade"><select {...register('prioridade')}><option>Baixa</option><option>Normal</option><option>Alta</option></select></Field></div><div className="field-grid"><Field label="Status"><select {...register('status')}><option>Aberto</option><option>Em andamento</option><option>Concluído</option></select></Field><Field label="Data e hora"><input type="datetime-local" {...register('dataAtendimento')}/></Field></div><label className={`dropzone ${drag?'drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);accept(e.dataTransfer.files)}}><div><Upload size={22}/><div>{drag?'Solte para anexar':'Arraste imagens, cole com Ctrl+V ou escolha arquivos'}</div><input hidden type="file" accept="image/*" multiple onChange={e=>e.target.files&&accept(e.target.files)}/></div></label>{files.length>0&&<div className="thumbs">{files.map((file,i)=><div key={`${file.name}-${i}`} style={{position:'relative'}}><img className="thumb" src={URL.createObjectURL(file)}/><button type="button" className="icon-button" style={{position:'absolute',right:2,top:2,background:'white'}} onClick={()=>setFiles(x=>x.filter((_,n)=>n!==i))}><X size={14}/></button></div>)}</div>}{saveError&&<div className="save-error"><strong>Não foi possível concluir o salvamento.</strong><span>{saveError}</span>{persistedId&&<small>O chamado {`TUD-${String(persistedId).padStart(4,'0')}`} já foi criado. Corrija o anexo e tente novamente; um novo ID não será gerado.</small>}</div>}</div><footer className="drawer-foot"><button type="button" className="ghost" onClick={close}>Cancelar</button><button className="primary" disabled={isSubmitting}>{isSubmitting?'Salvando…':'Salvar'}</button></footer></form></div>
}
function Field({label,error,children}:{label:string;error?:string;children:React.ReactNode}){return <label className="field"><span>{label}</span>{children}{error&&<div className="error-text">{error}</div>}</label>}
const localDate=(value:string)=>{const d=new Date(value);const offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,16)}
const blank=(condominioId?:number):AtendimentoInput=>({condominioId:condominioId||0,titulo:'',descricao:'',categoria:'Suporte remoto',status:'Aberto',prioridade:'Normal',dataAtendimento:localDate(new Date().toISOString())})
