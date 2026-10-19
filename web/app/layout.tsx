import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TUD · Painel de acompanhamento',
  description: 'Visualização somente para leitura dos atendimentos do TUD',
  robots: { index: false, follow: false, nocache: true }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `(function(){try{var t=localStorage.getItem('tud-web-theme');if(t!=='light'&&t!=='dark')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body>{children}</body></html>
}

