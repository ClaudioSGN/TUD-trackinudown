import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TUD · Painel de acompanhamento',
  description: 'Visualização somente para leitura dos atendimentos do TUD',
  robots: { index: false, follow: false, nocache: true }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>
}

