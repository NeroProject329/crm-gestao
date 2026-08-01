# V1 Acceptance Checklist

## Infraestrutura

- [ ] Web, API e Worker são serviços independentes
- [ ] Worker não possui domínio público
- [ ] PostgreSQL privado
- [ ] Redis privado
- [ ] Development, staging e production separados
- [ ] Secrets separados por ambiente
- [ ] Wait for CI habilitado
- [ ] Healthchecks habilitados
- [ ] Backup PostgreSQL habilitado
- [ ] Restore drill concluído

## Segurança

- [ ] JWT inválido retorna 401
- [ ] Sessão revogada retorna 401
- [ ] Usuário inativo retorna 401
- [ ] Empresa inativa retorna 401
- [ ] EMPLOYEE não acessa rota ADMIN
- [ ] CSRF protege autenticação por cookie
- [ ] DTO rejeita campos inesperados
- [ ] employeeId de /me vem da sessão
- [ ] adminProfit nunca aparece para EMPLOYEE
- [ ] R2 permanece privado

## Financeiro

- [ ] Somente APPROVED compõe faturamento
- [ ] Aprovação é idempotente
- [ ] REVERSED recalcula cadeia financeira
- [ ] ADS histórico recalcula dívida
- [ ] Taxa bancária histórica respeita vigência
- [ ] Comissão individual respeita vigência
- [ ] Dívida atravessa semana, mês e ano
- [ ] PAID permanece imutável
- [ ] Correções de PAID geram ajuste
- [ ] Caso oficial retorna 750 / 931,67 / 2.795

## Worker

- [ ] Worker permanece RUNNING
- [ ] Redis indisponível não altera fonte financeira
- [ ] PostgreSQL permanece fonte de verdade
- [ ] Outbox recupera eventos pendentes
- [ ] Jobs são idempotentes
- [ ] Retry e backoff funcionam
- [ ] Falha Pushcut não desfaz operação
- [ ] Restart do Worker não perde eventos

## Deploy e recuperação

- [ ] Quality Gate verde
- [ ] Migration Gate verde
- [ ] Build Web/API/Worker verde
- [ ] Smoke staging verde
- [ ] Rollback testado
- [ ] Backup manual criado
- [ ] Restore em staging testado
- [ ] Smoke após restore verde