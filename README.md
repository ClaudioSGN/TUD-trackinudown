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
