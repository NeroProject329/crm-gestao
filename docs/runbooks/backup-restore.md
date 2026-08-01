# PostgreSQL Backup and Restore Runbook

## Política

- Backups automáticos habilitados no PostgreSQL Railway
- Backup manual antes de migration destrutiva ou release crítica
- Restore drill realizado em staging
- Nunca testar restore sobre production
- O backup só é considerado válido quando sua restauração foi testada

## Restore drill

1. Criar backup manual do PostgreSQL staging
2. Registrar horário e identificador
3. Criar um registro identificável no banco
4. Criar novo backup manual
5. Alterar ou remover somente o registro de teste
6. Restaurar o backup
7. Confirmar retorno do registro
8. Executar prisma migrate status
9. Executar db:verify
10. Executar smoke
11. Confirmar API e Worker
12. Registrar resultado

## Evidência

- Data:
- Ambiente:
- Backup utilizado:
- Início:
- Fim:
- Duração:
- Restore concluído:
- db:verify:
- smoke:
- Responsável:
- Observações: