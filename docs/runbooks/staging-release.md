# Staging Release Runbook

## Pré-requisitos

- CI Quality Gate verde
- CI Migration Gate verde
- Ambiente Railway staging isolado
- PostgreSQL staging próprio
- Redis staging próprio
- Bucket R2 staging próprio
- Credenciais Pushcut staging próprias ou Pushcut desativado
- Nenhuma credencial de production em staging

## Ordem de deploy

1. Aplicar migrations pelo crm-api
2. Subir crm-api
3. Validar /health
4. Subir crm-worker
5. Confirmar worker.ready
6. Subir crm-web
7. Validar /api/health
8. Executar smoke tests
9. Validar logs e filas
10. Aprovar promoção para produção

## Smoke mínimo

- API health retorna 200
- Web health retorna 200
- Login ADMIN funciona
- Login EMPLOYEE funciona
- PostgreSQL acessível
- Redis acessível
- Worker permanece RUNNING
- Outbox PENDING volta a ser processada
- Upload R2 permanece privado
- URL assinada expira
- EMPLOYEE não acessa dados de outro funcionário
- EMPLOYEE não recebe adminProfit