# Backup e Restore do PostgreSQL

O ambiente de producao em Docker executa o servico `postgres-backup`, que gera dumps logicos em formato customizado (`pg_dump -Fc`) no volume `postgres_backups`.

Variaveis operacionais:

- `BACKUP_INTERVAL_SECONDS`: intervalo entre backups. Padrao: `86400`.
- `BACKUP_RETENTION_DAYS`: retencao local dos arquivos `.dump`. Padrao: `7`.

Restore controlado:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" scripts/db-restore.sh backups/selecao-posgrad-YYYYMMDDTHHMMSSZ.dump
```

Teste de restore deve ser feito em banco isolado antes de qualquer uso operacional.
