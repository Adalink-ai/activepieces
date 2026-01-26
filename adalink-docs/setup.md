# Setup do Active Pieces - Adalink

## **[IMPORTANTE!!]:**O projeto usa bun e não npm ou pnpm!!
Portanto, é necessário ter `bun` instalado e deve-se usar os comandos `bun install` e `bun dev` por exemplo...

## Envs:

Rodando localmente, o `.env.example` já tem quase todas as envs configuradas. As **obrigatórias** que faltam são as seguintes: `AP_ENCRYPTION_KEY` e `AP_JWT_SECRET` 


Com o comando abaixo, uma chave é gerada. Essa chave deve ser usada como `AP_ENCRYPTION_KEY`.
```cmd
openssl rand -hex 16
```
