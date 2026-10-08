import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import '@fontsource-variable/inter-tight'
import '@fontsource-variable/newsreader'
import './styles/app.css'
import { App } from './app/App'

const savedTheme = localStorage.getItem('tud-theme')
if (savedTheme === 'dark' || savedTheme === 'light') document.documentElement.dataset.theme = savedTheme

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 3_000, refetchOnWindowFocus: false } } })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><App /></QueryClientProvider></React.StrictMode>)
