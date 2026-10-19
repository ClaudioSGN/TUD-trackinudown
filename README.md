# TUD — Tracking u Down

Aplicativo desktop offline para registrar atendimentos por condomínio, reconstruído com Electron, React, TypeScript e SQLite.

## Desenvolvimento

```powershell
npm install
npm run dev
```

## Verificações

```powershell
npm run typecheck
npm test
npm run build
```

## Instalador Windows

```powershell
npm run dist
```

O instalador assistido é gerado em `release/` e permite escolher o diretório de instalação. Os dados ficam em `Documentos\TUD Dados`, separados do programa e preservados durante atualizações e reinstalações.

## Publicar uma atualização

1. Altere a versão em `package.json` e `package-lock.json`.
2. Faça commit e envie o código.
3. Crie e envie uma tag com a mesma versão:

```powershell
git tag v3.1.1
git push origin main --tags
```

O workflow do GitHub gera o instalador, o arquivo `latest.yml` e a release. Instalações existentes verificam novas versões automaticamente e exibem **Atualizar agora** quando o download termina.

## Painel online somente para leitura

O projeto em `web/` publica no Vercel uma cópia protegida dos chamados. O aplicativo desktop continua sendo a única fonte de edição; o painel não possui rotas para criar, editar ou excluir dados.

### Implantação no Vercel

1. Importe este repositório e selecione `web` como **Root Directory**.
2. Crie um Blob Store com acesso **Private** e conecte-o ao projeto.
3. Configure as variáveis de ambiente:

```text
TUD_SYNC_TOKEN=<chave longa gerada no aplicativo>
TUD_VIEWER_PASSWORD=<senha entregue ao supervisor>
TUD_SESSION_SECRET=<outra chave longa e aleatória>
```

4. Publique o projeto.
5. No TUD, abra **Preferências → Visualização online**, informe a URL publicada e a mesma `TUD_SYNC_TOKEN`, salve e clique em **Sincronizar agora**.
6. Depois do primeiro envio, ative a sincronização automática a cada dez minutos.

Os anexos enviados à web são cópias WebP redimensionadas. Os arquivos originais permanecem no computador e no backup `.tud`. Chamados e anexos ficam em armazenamento privado; o navegador só recebe conteúdo depois da validação da senha.
