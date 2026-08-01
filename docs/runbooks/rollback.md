# Application Rollback Runbook

## Regra principal

Rollback de aplicação não deve exigir rollback destrutivo do banco.

Migrations devem seguir expansão e contração:

1. adicionar estrutura compatível
2. implantar aplicação
3. migrar dados quando necessário
4. remover estrutura antiga apenas em release posterior

## Rollback Railway

1. Abrir o serviço afetado
2. Abrir Deployments
3. Selecionar último deployment conhecido como saudável
4. Executar Rollback
5. Aguardar healthcheck
6. Validar logs
7. Executar smoke
8. Confirmar processamento da Outbox
9. Registrar incidente

## Ordem em incidente amplo

1. crm-api
2. crm-worker
3. crm-web

Não restaurar banco apenas para desfazer uma versão de aplicação.