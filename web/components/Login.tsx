import { Eye, LockKeyhole } from 'lucide-react'

export function Login({ invalid }: { invalid: boolean }) {
  return <main className="login-shell">
    <section className="login-card">
      <div className="brand-mark">tud.</div>
      <div className="login-icon"><Eye size={24}/></div>
      <span className="eyebrow">Acesso de acompanhamento</span>
      <h1>Veja o trabalho.<br/><em>Sem alterar nada.</em></h1>
      <p>Este painel é uma cópia somente para leitura dos atendimentos sincronizados pelo aplicativo TUD.</p>
      <form action="/api/login" method="post">
        <label htmlFor="password">Senha do painel</label>
        <div className="password-field"><LockKeyhole size={18}/><input id="password" name="password" type="password" autoComplete="current-password" autoFocus required placeholder="Digite a senha de acesso"/></div>
        {invalid && <div className="login-error" role="alert">Senha incorreta. Tente novamente.</div>}
        <button type="submit">Entrar no painel</button>
      </form>
      <small>Os dados originais continuam armazenados no computador responsável.</small>
    </section>
  </main>
}

