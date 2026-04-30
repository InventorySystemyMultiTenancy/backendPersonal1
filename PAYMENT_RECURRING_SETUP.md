# Implementação de Pagamento Recorrente com Mercado Pago

## 📋 Fluxo de Integração

```
1. Planos existem em AlunoPlan (tabela já existente no banco)
2. Admin sincroniza um AlunoPlan com Mercado Pago
   └─ AlunoPlan recebe mp_plan_id do Mercado Pago
3. Aluno escolhe um AlunoPlan para assinar
4. Frontend tokeniza cartão via SDK do Mercado Pago
5. Backend cria preapproval (assinatura recorrente) usando mp_plan_id
6. AlunoSubscription registra a assinatura do aluno para este plano
7. Mercado Pago cobra automaticamente cada mês
8. Webhooks notificam sistema de pagamentos/eventos
```

## 1. Configuração do Banco de Dados

Execute o arquivo SQL:

```bash
# Conecte ao seu banco postgresql e execute:
psql -U your_user -d your_db -f sql/014_mercadopago_recurring_subscriptions.sql
```

Ou manualmente no DBeaver, execute `sql/014_mercadopago_recurring_subscriptions.sql` que contém:

```sql
-- Modifica a tabela AlunoPlan existente, adicionando campos MP
ALTER TABLE "AlunoPlan"
  ADD COLUMN IF NOT EXISTS mp_plan_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS mp_sync_status TEXT DEFAULT 'pending' 
    CHECK (mp_sync_status IN ('pending', 'synced', 'error')),
  ADD COLUMN IF NOT EXISTS mp_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS mp_synced_at TIMESTAMPTZ;

-- Tabela de Assinaturas de Alunos (links aluno → AlunoPlan no MP)
CREATE TABLE IF NOT EXISTS "AlunoSubscription" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoId" UUID NOT NULL REFERENCES "Aluno"(id) ON DELETE CASCADE,
  "alunoPlanId" UUID NOT NULL REFERENCES "AlunoPlan"(id) ON DELETE RESTRICT,
  mp_preapproval_id TEXT NOT NULL UNIQUE,
  payer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'authorized', 'paused', 'canceled')),
  next_payment_date TIMESTAMPTZ,
  card_token_last4 TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aluno_subscription_aluno 
  ON "AlunoSubscription"("alunoId");
CREATE INDEX idx_aluno_subscription_status 
  ON "AlunoSubscription"(status);
CREATE INDEX idx_aluno_subscription_plan 
  ON "AlunoSubscription"("alunoPlanId");

-- Tabela de Eventos do Webhook MP
CREATE TABLE IF NOT EXISTS "AlunoSubscriptionEvent" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "alunoSubscriptionId" UUID NOT NULL REFERENCES "AlunoSubscription"(id) ON DELETE CASCADE,
  "eventType" TEXT NOT NULL,
  "providerEventKey" TEXT UNIQUE,
  status TEXT,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscription_event_subscription 
  ON "AlunoSubscriptionEvent"("alunoSubscriptionId");
```

## 2. Atualizar Prisma Schema

Já realizado em `prisma/schema.prisma`:

```prisma
model AlunoPlan {
  id                    String                    @id @default(cuid())
  personalId            String
  name                  String
  description           String?
  monthlyPriceCents     Int                       // preço em centavos
  
  // Campos Mercado Pago
  mp_plan_id            String?                   @unique
  mp_sync_status        String                    @default("pending")
  mp_sync_error         String?
  mp_synced_at          DateTime?
  
  // Relações
  alunoSubscriptions    AlunoSubscription[]
  
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt
  
  @@index([personalId])
}

model AlunoSubscription {
  id                    String                    @id @default(cuid())
  alunoId               String
  aluno                 Aluno                     @relation(fields: [alunoId], references: [id], onDelete: Cascade)
  
  alunoPlanId           String
  alunoPlan             AlunoPlan                 @relation(fields: [alunoPlanId], references: [id], onDelete: Restrict)
  
  mp_preapproval_id     String                    @unique
  payer_email           String
  status                String                    @default("pending")
  next_payment_date     DateTime?
  card_token_last4      String?
  
  events                AlunoSubscriptionEvent[]
  
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt
  
  @@index([alunoId])
  @@index([status])
  @@index([alunoPlanId])
}

model AlunoSubscriptionEvent {
  id                    String                    @id @default(cuid())
  alunoSubscriptionId   String
  subscription          AlunoSubscription         @relation(fields: [alunoSubscriptionId], references: [id], onDelete: Cascade)
  
  eventType             String
  providerEventKey      String?                   @unique
  status                String?
  payload               Json?
  
  createdAt             DateTime                  @default(now())
  
  @@index([alunoSubscriptionId])
}
```

## 3. Gerar e Executar Migração Prisma

```bash
# Gerar migração baseada nas mudanças do schema
npx prisma migrate dev --name add_aluno_subscription

# Ou só sincronizar sem gerar (desenvolvimento)
npx prisma db push
```

## 4. Configuração de Variáveis de Ambiente

Adicione ao seu `.env`:

```env
# Mercado Pago
MERCADO_PAGO_ACCESS_TOKEN=your_mp_access_token_here
MP_API_BASE_URL=https://api.mercadopago.com
MP_REQUEST_TIMEOUT_MS=10000
MP_MAX_RETRIES=2
PAYMENT_DEBUG_LOGS=true

# Frontend
FRONTEND_URL=http://localhost:3000
```

## 5. Integração no App

Em `src/app.js`:

```javascript
import paymentRecurringRoutes from './routes/paymentRecurringRoutes.js';

// Integrar as rotas
app.use('/api/payments/recurring', paymentRecurringRoutes);
```

## 6. Isolamento Multi-Tenant (IMPORTANTE ⚠️)

Este sistema foi projetado para múltiplos Personals compartilharem o mesmo backend. Validações automáticas garantem isolamento:

### Validações Implementadas

**1. Sincronização de Plano (Admin)**
```
POST /api/payments/recurring/subscriptions/sync-plan/:alunoPlanId
- ✅ Valida que o plano pertence ao personal autenticado
- ✅ Apenas personals podem sincronizar seus próprios planos
```

**2. Criação de Assinatura**
```
POST /api/payments/recurring/subscriptions
- ✅ Valida que o aluno pertence ao personal autenticado
- ✅ Valida que o plano pertence ao mesmo personal do aluno
- ❌ Erro: "Aluno não pertence a este personal"
- ❌ Erro: "Plano não pertence a este personal"
```

**3. Consulta de Assinatura**
```
GET /api/payments/recurring/subscriptions/:subscriptionId
- ✅ Valida que o aluno pertence ao personal autenticado
- ❌ Erro: "Aluno não pertence a este personal"
```

**4. Cancelamento de Assinatura**
```
POST /api/payments/recurring/subscriptions/:subscriptionId/cancel
- ✅ Valida que o aluno pertence ao personal autenticado
- ❌ Erro: "Aluno não pertence a este personal"
```

**5. Webhooks do Mercado Pago**
```
POST /api/payments/recurring/webhooks/mercadopago
- ✅ Valida que aluno, plano e personalId são coerentes
- ✅ Rejeita eventos com tenant mismatch
- 🔒 Sem exposição de dados entre personals
```

### Estrutura de Dados

```
Personal A (personalId = uuid-a)
├── AlunoPlan 1 (personalId = uuid-a) → mp_plan_id
├── AlunoPlan 2 (personalId = uuid-a) → mp_plan_id
├── Aluno 1 (personalId = uuid-a)
│   └── AlunoSubscription (alunoPlanId referencia AlunoPlan de seu personal)
└── Aluno 2 (personalId = uuid-a)
    └── AlunoSubscription

Personal B (personalId = uuid-b) ← ISOLADO
├── AlunoPlan 3 (personalId = uuid-b) → mp_plan_id
├── Aluno 3 (personalId = uuid-b)
└── Aluno 4 (personalId = uuid-b)
```

### O que Acontece se Tentar Burlar?

1. **Aluno de Personal A tenta assinar Plano de Personal B:**
   ```
   Error: "Plano não pertence a este personal"
   ```

2. **Webhook tenta atualizar assinatura com tenant mismatch:**
   ```
   Error: "Tenant mismatch in webhook processing"
   Log: [payments:webhook-tenant-mismatch]
   ```

3. **Usuario tenta acessar assinatura de outro personal:**
   ```
   Error: "Aluno não pertence a este personal"
   ```

## 7. Endpoints Disponíveis

### 1️⃣ Listar Planos Públicos (Sem Auth)
```http
GET /api/payments/recurring/subscriptions/plans/:personalId

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "aluno-plan-uuid",
      "name": "Plano Gold",
      "monthlyPriceCents": 29900,
      "mp_plan_id": "mercadopago-plan-id",
      "mp_sync_status": "synced"
    }
  ]
}
```

### 2️⃣ Sincronizar AlunoPlan com Mercado Pago (Admin)
```http
POST /api/payments/recurring/subscriptions/sync-plan/:alunoPlanId
Headers: {
  "Authorization": "Bearer <token>"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "aluno-plan-uuid",
    "mp_plan_id": "mercadopago-plan-id",
    "mp_sync_status": "synced",
    "mp_synced_at": "2024-01-15T10:30:00Z"
  },
  "alreadySynced": false
}
```

### 3️⃣ Criar Assinatura para Aluno
```http
POST /api/payments/recurring/subscriptions
Headers: {
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}

Body:
{
  "alunoId": "aluno-uuid",
  "alunoPlanId": "aluno-plan-uuid",
  "cardTokenId": "token-gerado-pelo-mp-sdk",
  "payerEmail": "aluno@email.com"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "subscription-uuid",
    "mp_preapproval_id": "mercadopago-subscription-id",
    "status": "pending",
    "next_payment_date": "2024-02-15T10:30:00Z"
  }
}
```

### 4️⃣ Obter Status da Assinatura
```http
GET /api/payments/recurring/subscriptions/:subscriptionId
Headers: {
  "Authorization": "Bearer <token>"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "subscription-uuid",
    "status": "authorized",
    "next_payment_date": "2024-02-15T10:30:00Z",
    "aluno": { ... },
    "alunoPlan": { ... }
  }
}
```

### 5️⃣ Cancelar Assinatura
```http
POST /api/payments/recurring/subscriptions/:subscriptionId/cancel
Headers: {
  "Authorization": "Bearer <token>"
}

Response 200:
{
  "success": true,
  "message": "Subscription canceled successfully"
}
```

### 6️⃣ Webhook do Mercado Pago (Sem Auth)
```http
POST /api/payments/recurring/webhooks/mercadopago?id=<mp-event-id>&topic=preapproval

MP envia quando:
- Pagamento autorizado/rejeitado
- Assinatura pausada/cancelada
- Alterações no cartão
```
```

### Criar Assinatura para Aluno
```
POST /api/payments/recurring/subscriptions
Headers: { Authorization: Bearer <token> }
Body: {
  "aluno_id": "uuid-do-aluno",
  "preapproval_plan_id": "id-do-plano-mercado-pago",
  "payer_email": "aluno@email.com",
  "card_token_id": "token-do-cartao-gerado-frontend",
  "reason": "Assinatura Premium"
}
```

### Consultar Status da Assinatura
```
GET /api/payments/recurring/subscriptions/:reference
Headers: { Authorization: Bearer <token> }
Body: { "aluno_id": "uuid-do-aluno" }
```

### Cancelar Assinatura
```
POST /api/payments/recurring/subscriptions/:reference/cancel
Headers: { Authorization: Bearer <token> }
Body: { "aluno_id": "uuid-do-aluno" }
```

### Webhook do Mercado Pago
```
POST /api/payments/recurring/webhooks/mercadopago
(Sem autenticação - configurar na dashboard do Mercado Pago)
```

## 5. Fluxo de Implementação no Frontend

Veja o arquivo `FRONTEND_IMPLEMENTATION_PROMPT.md` para detalhes completos da integração frontend.

### Resumo do Fluxo:
1. Buscar planos disponíveis (GET `/api/payments/recurring/subscriptions/plans/public`)
2. Usuário seleciona plano e cartão
3. Frontend gera token do cartão via Mercado Pago SDK
4. Enviar token + dados para backend (POST `/api/payments/recurring/subscriptions`)
5. Backend cria preapproval com Mercado Pago
6. Pagamentos recorrentes caem automaticamente no cartão cadastrado

## 6. Sincronização de Status

O sistema sincroniza o status das assinaturas através de:

1. **Webhooks do Mercado Pago**: Atualizações em tempo real
2. **Polling Manual**: Endpoint `/api/payments/recurring/subscriptions/:reference`
3. **Tabela de Auditoria**: `subscription_provider_events` rastreia todas as mudanças

## 7. Testes Locais

```bash
# 1. Criar um plano de teste
curl -X POST http://localhost:3000/api/payments/recurring/subscriptions/plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token" \
  -d '{
    "name": "Teste Plan",
    "transaction_amount": 99.90,
    "frequency": 1,
    "frequency_type": "months"
  }'

# 2. Listar planos públicos
curl http://localhost:3000/api/payments/recurring/subscriptions/plans/public

# 3. Criar assinatura (depois do frontend gerar token)
curl -X POST http://localhost:3000/api/payments/recurring/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu_token" \
  -d '{
    "aluno_id": "uuid-aluno",
    "preapproval_plan_id": "id-do-plano",
    "payer_email": "aluno@email.com",
    "card_token_id": "token-gerado-frontend"
  }'
```

## 8. Monitoramento

- **Logs de Debug**: Ative `PAYMENT_DEBUG_LOGS=true` no .env para ver detalhes
- **Tabelas de Auditoria**:
  - `subscriptions`: Status atual das assinaturas
  - `subscription_attempts`: Histórico de tentativas
  - `subscription_provider_events`: Todos os eventos do Mercado Pago

## 9. Próximos Passos

1. ✅ Backend configurado
2. ⏳ Implementar frontend com Mercado Pago Cardform
3. ⏳ Configurar webhooks na dashboard do Mercado Pago
4. ⏳ Testes com cartões de teste do Mercado Pago
5. ⏳ Deploy para produção
