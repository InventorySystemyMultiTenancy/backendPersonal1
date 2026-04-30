# 📋 Checklist Final: Integração de Pagamento Recorrente

## ✅ Passo 1: Banco de Dados

```bash
# 1. Execute o arquivo SQL no DBeaver:
# sql/014_mercadopago_recurring_subscriptions.sql
```

**Status:** Tabelas `subscriptions`, `subscription_plans`, etc. criadas

## ✅ Passo 2: Variáveis de Ambiente

Adicione ao `.env`:

```env
# MERCADO PAGO
MERCADO_PAGO_ACCESS_TOKEN=your_access_token_here
MP_API_BASE_URL=https://api.mercadopago.com
MP_REQUEST_TIMEOUT_MS=10000
MP_MAX_RETRIES=2
PAYMENT_DEBUG_LOGS=false  # true para debug, false em produção
FRONTEND_URL=http://localhost:3000
```

**Como obter o token:**
1. Acesse https://www.mercadopago.com.br/
2. Faça login na sua conta
3. Vá em **Configurações > Tokens de acesso**
4. Copie o **Token de teste** ou **Token de produção**

**Status:** Variáveis configuradas

## ✅ Passo 3: Integração no App.js

Adicione as rotas ao seu arquivo principal:

```javascript
// src/app.js (ou main.js)

import paymentRecurringRoutes from './routes/paymentRecurringRoutes.js';

// Depois dos outros imports e middlewares:
app.use('/api/payments/recurring', paymentRecurringRoutes);

// Se tiver proxy ou mount em subrouta:
app.use('/api', appRouter); // já inclui /payments/recurring
```

**Arquivos envolvidos:**
- ✅ `src/services/paymentRecurringService.js` (criado)
- ✅ `src/controllers/paymentRecurringController.js` (criado)
- ✅ `src/routes/paymentRecurringRoutes.js` (criado)

**Status:** Rotas integradas

## ✅ Passo 4: Instalar Dependências (se necessário)

```bash
# Seu projeto provavelmente já tem fetch nativo (Node 18+)
# Mas verifique se precisa de alguma biblioteca:

npm install  # já deve ter tudo necessário
```

**Status:** Dependências verificadas

## ✅ Passo 5: Configurar Webhooks (Mercado Pago Dashboard)

1. Acesse https://www.mercadopago.com.br/developers/panel/
2. Vá em **Configuração > Webhooks**
3. Adicione URL de webhook:
   ```
   https://seusite.com.br/api/payments/recurring/webhooks/mercadopago
   ```
4. Selecione eventos:
   - `subscription_preapproval.created`
   - `subscription_preapproval.updated`
   - `subscription_preapproval.status_changed`
5. Salve

**Status:** Webhooks configurados

## ✅ Passo 6: Testar Endpoints

```bash
# Terminal 1: Inicie o servidor
npm start

# Terminal 2: Execute os testes

# 1. Listar planos públicos
curl http://localhost:3000/api/payments/recurring/subscriptions/plans/public

# 2. Criar plano (precisa de token JWT)
# Primeiro, faça login e pegue o token bearer

TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"sua_senha"}' | jq -r '.data.token')

curl -X POST http://localhost:3000/api/payments/recurring/subscriptions/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Plano Premium",
    "description": "Treinos personalizados",
    "transaction_amount": 199.90,
    "frequency": 1,
    "frequency_type": "months"
  }'

# Resposta esperada:
# {
#   "success": true,
#   "data": {
#     "plan": {
#       "id": "plan-id",
#       "name": "Plano Premium",
#       "preapproval_plan_id": "mp-plan-id",
#       "transaction_amount": 199.90,
#       ...
#     },
#     "provider": {
#       "id": "mp-plan-id",
#       "init_point": "https://mpago.click/...",
#       "back_url": "..."
#     }
#   }
# }
```

**Status:** Endpoints testados

## ✅ Passo 7: Implementação Frontend

Veja o arquivo `FRONTEND_IMPLEMENTATION_PROMPT.md` para:

- Instalação de dependências
- Componente React exemplo
- Configuração do Cardform
- Testes com cartões de teste
- Fluxo completo

**Resumo:**
```javascript
// 1. npm install @mercadopago/sdk-js
// 2. Adicione REACT_APP_MERCADO_PAGO_PUBLIC_KEY ao .env
// 3. Crie componente RecurringPaymentForm
// 4. Teste com cartões de teste Mercado Pago
```

**Status:** Documentação frontend fornecida

## 🧪 Testes Completos

### Teste 1: Criar Plano
```bash
# Criar um plano de R$ 99.90/mês
curl -X POST http://localhost:3000/api/payments/recurring/subscriptions/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token" \
  -d '{
    "name": "Plano Teste",
    "transaction_amount": 99.90,
    "frequency": 1,
    "frequency_type": "months"
  }'

# Guardar o ID retornado em "data.provider.id"
```

### Teste 2: Listar Planos
```bash
curl http://localhost:3000/api/payments/recurring/subscriptions/plans/public | jq .
```

### Teste 3: Criar Assinatura

```bash
# No frontend:
# 1. Cardform gera token do cartão
# 2. Envie:

curl -X POST http://localhost:3000/api/payments/recurring/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token" \
  -d '{
    "aluno_id": "uuid-do-aluno",
    "preapproval_plan_id": "id-do-plano-mercado-pago",
    "card_token_id": "token-gerado-pelo-frontend",
    "payer_email": "aluno@email.com"
  }'

# Resposta:
# {
#   "success": true,
#   "data": {
#     "subscription": {
#       "mp_preapproval_id": "mp-subscription-id",
#       "status": "authorized",
#       "next_payment_date": "2025-05-30T...",
#       ...
#     }
#   }
# }
```

### Teste 4: Consultar Status
```bash
curl http://localhost:3000/api/payments/recurring/subscriptions/mp-subscription-id \
  -H "Authorization: Bearer seu_token" \
  -d '{"aluno_id":"uuid"}'
```

### Teste 5: Cancelar Assinatura
```bash
curl -X POST http://localhost:3000/api/payments/recurring/subscriptions/mp-subscription-id/cancel \
  -H "Authorization: Bearer seu_token" \
  -d '{"aluno_id":"uuid"}'
```

## 📊 Verificar Status no Banco

```sql
-- Verificar planos criados
SELECT id, code, name, price_cents, is_active 
FROM subscription_plans 
ORDER BY created_at DESC;

-- Verificar assinaturas
SELECT id, aluno_id, mp_preapproval_id, status, next_payment_date 
FROM subscriptions 
ORDER BY created_at DESC;

-- Verificar histórico de eventos
SELECT id, type, status, message, created_at 
FROM subscription_provider_events 
ORDER BY created_at DESC;
```

## 🚨 Troubleshooting

### Erro: "Access Token do Mercado Pago não configurado"
```
Solução: Verifique se MERCADO_PAGO_ACCESS_TOKEN está no .env
```

### Erro: "Timeout ao comunicar com Mercado Pago"
```
Solução: Verifique sua conexão de internet e o valor de MP_REQUEST_TIMEOUT_MS
```

### Erro: "card_token_id obrigatório"
```
Solução: Frontend não gerou o token corretamente
Verifique: REACT_APP_MERCADO_PAGO_PUBLIC_KEY e Cardform configuration
```

### Erro: "Plano de assinatura inativo ou inexistente"
```
Solução: O ID do plano não é válido ou não está ativo
Execute: SELECT * FROM subscription_plans;
```

### Erro: "Este plano ainda nao possui identificador recorrente configurado no backend"
```
Diagnóstico rápido:
1) Verifique se o endpoint chamado é o correto:
   GET /payments/recurring/subscriptions/plans/public?personalId=<PERSONAL_ID>
   ou
   GET /payments/recurring/subscriptions/plans/<PERSONAL_ID>

2) Verifique no banco se o AlunoPlan está sincronizado:
   SELECT id, name, "personalId", "isActive", mp_plan_id, mp_sync_status, mp_sync_error
   FROM "AlunoPlan"
   WHERE "personalId" = '<PERSONAL_ID>'
   ORDER BY "updatedAt" DESC;

3) Se mp_plan_id estiver null, sincronize o plano:
   POST /payments/recurring/subscriptions/sync-plan/:alunoPlanId
```

## 📞 Debugging

Ative logs detalhados:

```env
PAYMENT_DEBUG_LOGS=true
```

Verifique os logs:
```bash
# Terminal onde o servidor roda
# Procure por: [payments:...]

# Padrões mais importantes para esse bug:
# [payments:route-hit]
# [payments:controller:list-plans:request]
# [payments:controller:list-plans-legacy:resolved-personal-id]
# [payments:list-public-plans:counts]
# [payments:create-subscription:plan-invalid]
# [api:error:context]
```

## 🎯 Fluxo de Produção

```
1. Usuário seleciona plano
   ↓
2. Frontend exibe Cardform do MP
   ↓
3. Usuário preenche dados do cartão
   ↓
4. Frontend gera token (MP SDK)
   ↓
5. Frontend envia token + email ao backend
   ↓
6. Backend cria preapproval no Mercado Pago
   ↓
7. MP autoriza e cobra na data de vencimento
   ↓
8. MP envia webhook com confirmação
   ↓
9. Backend atualiza status no banco
```

## 📈 Monitoramento Pós-Implementação

```bash
# Verificar assinaturas ativas
SELECT COUNT(*) as total_subscriptions,
       COUNT(CASE WHEN status = 'authorized' THEN 1 END) as ativas,
       COUNT(CASE WHEN status = 'canceled' THEN 1 END) as canceladas
FROM subscriptions;

# Receita estimada mensal
SELECT COUNT(*) as num_subscriptions,
       SUM(s.priceCents) * COUNT(*) / 100 as receita_mensal
FROM subscriptions sub
JOIN aluno a ON a.aluno_plan_id = sub.aluno_id
JOIN subscription_plans sp ON sp.id = a.aluno_plan_id
WHERE sub.status = 'authorized';

# Próximas cobranças
SELECT COUNT(*) FROM subscriptions
WHERE next_payment_date BETWEEN TODAY() AND TODAY() + INTERVAL 7 DAYS
AND status = 'authorized';
```

## ✨ Próximos Passos Recomendados

1. **Dashboard de Pagamentos**: Mostrar histórico de assinaturas
2. **Notificações**: Enviar email antes do vencimento
3. **Analytics**: Rastrear churn (cancelamentos)
4. **Relatórios**: Gerar planilha de faturamento
5. **Automação**: Processar refunds automáticos

## 🎓 Documentação Adicional

- [Integração com Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/common-implementation/preapproval)
- [Cardform SDK](https://www.mercadopago.com.br/developers/pt/docs/sdks/cardform/integration)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/webhooks/introduction)
- [API Reference](https://www.mercadopago.com.br/developers/pt/docs)

## ✅ Status Final

- [x] Backend implementado
- [x] Banco de dados preparado
- [x] Documentação frontend fornecida
- [x] Testes definidos
- [ ] Frontend implementado (seu time)
- [ ] Webhooks configurados
- [ ] Testes em produção
- [ ] Deploy

---

**Última atualização:** Abril 2025
**Status:** Pronto para implementação frontend
