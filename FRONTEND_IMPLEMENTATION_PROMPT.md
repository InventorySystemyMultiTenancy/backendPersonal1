# Prompt de Implementação: Pagamento Recorrente de Mensalidade (Frontend)

## 📋 Resumo Executivo

Você precisa implementar um sistema de pagamento recorrente mensalista usando o Mercado Pago, onde:
1. O aluno escolhe um plano de mensalidade
2. Preenche dados do cartão de crédito
3. O cartão é tokenizado no frontend (SEM passar dados sensíveis pelo seu servidor)
4. O token é enviado ao backend para criar uma assinatura recorrente
5. O Mercado Pago cobra automaticamente o cartão a cada mês

## 🔐 Fluxo de Segurança

```
Frontend                           Backend                    Mercado Pago
   |                                 |                              |
   |-- Busca planos públicos ------->|                              |
   |<---------- Planos --------------|                              |
   |                                 |                              |
   |-- Abre formulário de cartão    |                              |
   |-- Tokeniza cartão (MP SDK) ----|----- (direto, sem dados )--->|
   |<----- card_token_id ------------|<---- token seguro ----------|
   |                                 |                              |
   |-- Envia token + email -------->|                              |
   |                                |-- Cria preapproval -------->|
   |                                |<-- subscription_id -------|
   |<------ Confirmação ------------|                              |
   |                                |                              |
   |  [Próximos meses: automatico]    |                              |
   |                                |<-- Webhook: pagamento ---|
   |                                |-- Atualiza banco -------->|
```

## 🛠️ Instalação de Dependências

```bash
npm install @mercadopago/sdk-js
# ou
yarn add @mercadopago/sdk-js
```

## 📱 Componente React Exemplo

```javascript
import React, { useState, useEffect } from 'react';
import { initMercadoPago, Cardform } from '@mercadopago/sdk-js';
import axios from 'axios';

const RecurringPaymentForm = ({ alunoId }) => {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // 1. Inicializar Mercado Pago no componente
  useEffect(() => {
    initMercadoPago(process.env.REACT_APP_MERCADO_PAGO_PUBLIC_KEY, {
      locale: 'pt-BR',
    });
    fetchPlans();
  }, []);

  // 2. Buscar planos disponíveis
  const fetchPlans = async () => {
    try {
      const response = await axios.get(
        '/api/payments/recurring/subscriptions/plans/public'
      );
      setPlans(response.data.data || []);
    } catch (err) {
      setError('Erro ao carregar planos');
      console.error(err);
    }
  };

  // 3. Tokenizar cartão e criar assinatura
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Obter token do formulário do Mercado Pago
      const cardformToken = window.cardformToken;
      if (!cardformToken) {
        throw new Error('Formulário de cartão inválido');
      }

      const payerEmail = document.getElementById('payer_email').value;
      if (!payerEmail) {
        throw new Error('Email obrigatório');
      }

      // Chamar backend para criar assinatura
      const response = await axios.post(
        '/api/payments/recurring/subscriptions',
        {
          aluno_id: alunoId,
          preapproval_plan_id: selectedPlan.preapproval_plan_id,
          card_token_id: cardformToken, // Token gerado pelo Mercado Pago
          payer_email: payerEmail,
          reason: `Assinatura - ${selectedPlan.name}`,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      setSuccess(true);
      console.log('Assinatura criada:', response.data);
      
      // Limpar formulário
      setTimeout(() => {
        window.location.href = '/dashboard/pagamentos';
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (success) {
    return <div className="alert alert-success">Assinatura criada com sucesso!</div>;
  }

  return (
    <div className="payment-form">
      <h2>Escolher Plano de Mensalidade</h2>

      {/* Seleção de Plano */}
      <div className="plans-list">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            onClick={() => setSelectedPlan(plan)}
          >
            <h3>{plan.name}</h3>
            <p className="description">{plan.description}</p>
            <div className="price">
              R$ {(plan.transaction_amount).toFixed(2).replace('.', ',')}
              <span className="frequency">/{plan.frequency_type === 'months' ? 'mês' : 'dia'}</span>
            </div>
          </div>
        ))}
      </div>

      {selectedPlan && (
        <form onSubmit={handleSubmit} className="cardform-container">
          <h3>Dados de Pagamento</h3>

          {/* Email do Pagador */}
          <div className="form-group">
            <label htmlFor="payer_email">Email</label>
            <input
              id="payer_email"
              type="email"
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>

          {/* Formulário de Cartão do Mercado Pago */}
          <div id="cardform" />

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
          >
            {loading ? 'Processando...' : `Assinar por R$ ${selectedPlan.transaction_amount.toFixed(2)}`}
          </button>
        </form>
      )}
    </div>
  );
};

export default RecurringPaymentForm;
```

## 🎯 Implementação do Cardform

```javascript
import { initMercadoPago, Cardform } from '@mercadopago/sdk-js';

useEffect(() => {
  initMercadoPago(process.env.REACT_APP_MERCADO_PAGO_PUBLIC_KEY, {
    locale: 'pt-BR',
  });

  // Criar instância do Cardform
  const cardform = new Cardform({
    amount: selectedPlan.transaction_amount.toString(),
    autoMount: true,
    form: {
      id: 'cardform',
      cardNumber: {
        id: 'cardNumber',
        placeholder: '1234 5678 9012 3456',
      },
      expirationDate: {
        id: 'expirationDate',
        placeholder: 'MM/YY',
      },
      securityCode: {
        id: 'securityCode',
        placeholder: 'CVV',
      },
      cardholderName: {
        id: 'cardholderName',
        placeholder: 'Nome do Titular',
      },
      issuer: {
        id: 'issuer',
      },
      installments: {
        id: 'installments',
      },
      identificationType: {
        id: 'identificationType',
      },
      identificationNumber: {
        id: 'identificationNumber',
        placeholder: 'CPF',
      },
      cardholderEmail: {
        id: 'cardholderEmail',
      },
    },
    callbacks: {
      onFormMounted: (error) => {
        if (error) return console.warn('Form Mounted handling error: ', error);
        console.log('Formulário montado com sucesso');
      },
      onSubmit: (e) => {
        e.preventDefault();
        // Será chamado quando enviar o form
      },
      onFetching: (resource) => {
        console.log('Buscando recurso:', resource);
      },
      onError: (error) => {
        console.log('Erro no formulário:', error);
      },
    },
  });

  // Salvar referência global para usar no submit
  window.cardformToken = null;

  // Quando o formulário está pronto
  return () => cardform.unmount();
}, [selectedPlan]);

// Ao submeter
const handleCardformSubmit = async () => {
  try {
    const { token } = await new Promise((resolve, reject) => {
      const cardform = document.querySelector('form');
      cardform.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = await cardform.getCardformValue();
        if (token.id) {
          resolve(token);
        } else {
          reject(new Error('Erro ao gerar token'));
        }
      });
      cardform.dispatchEvent(new Event('submit'));
    });

    window.cardformToken = token.id;
  } catch (error) {
    console.error('Erro ao gerar token:', error);
    setError('Erro ao processar cartão');
  }
};
```

## 📋 Alternativa Simples: usar Inicialization

```javascript
// Outra abordagem mais simples
import { initMercadoPago, Cardform } from '@mercadopago/sdk-js';

const setupCardForm = async () => {
  await initMercadoPago(process.env.REACT_APP_MERCADO_PAGO_PUBLIC_KEY);

  const cardform = new Cardform({
    amount: '99.90',
    autoMount: true,
    form: {
      id: 'cardform',
      cardNumber: { id: 'cardNumber' },
      expirationDate: { id: 'expirationDate' },
      securityCode: { id: 'securityCode' },
      cardholderName: { id: 'cardholderName' },
      issuer: { id: 'issuer' },
      installments: { id: 'installments' },
      identificationType: { id: 'identificationType' },
      identificationNumber: { id: 'identificationNumber' },
    },
  });

  // Obter token quando necessário
  const getToken = async () => {
    try {
      const tokenResponse = await cardform.getCardformValue();
      if (tokenResponse.status === 200) {
        return tokenResponse.data.token;
      }
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  return { cardform, getToken };
};
```

## 🔑 Variáveis de Ambiente (Frontend)

```env
REACT_APP_MERCADO_PAGO_PUBLIC_KEY=sua_public_key_aqui
REACT_APP_API_URL=http://localhost:3000/api
```

## 📱 HTML + JavaScript Puro

Se não tiver React:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
</head>
<body>
  <div id="app">
    <div class="plans-list" id="plansList"></div>
    <div id="cardform"></div>
    <button onclick="submitForm()">Confirmar Assinatura</button>
  </div>

  <script>
    let cardform;
    let selectedPlan;

    // 1. Inicializar Mercado Pago
    function init() {
      const publicKey = document.currentScript.getAttribute('data-public-key');
      mp.initMercadoPago(publicKey, {
        locale: 'pt-BR',
      });
      loadPlans();
    }

    // 2. Carregar planos
    async function loadPlans() {
      const response = await fetch('/api/payments/recurring/subscriptions/plans/public');
      const { data: plans } = await response.json();
      
      const plansList = document.getElementById('plansList');
      plansList.innerHTML = plans.map(plan => `
        <div class="plan-card" onclick="selectPlan('${plan.id}')">
          <h3>${plan.name}</h3>
          <p>R$ ${plan.transaction_amount}</p>
          <p>${plan.description}</p>
        </div>
      `).join('');
    }

    // 3. Selecionar plano
    function selectPlan(planId) {
      selectedPlan = planId;
      setupCardform();
    }

    // 4. Configurar Cardform
    function setupCardform() {
      cardform = new mp.Cardform({
        amount: '99.90',
        autoMount: true,
        form: {
          id: 'cardform',
          cardNumber: { id: 'cardNumber' },
          expirationDate: { id: 'expirationDate' },
          securityCode: { id: 'securityCode' },
          cardholderName: { id: 'cardholderName' },
        },
      });
    }

    // 5. Submeter formulário
    async function submitForm() {
      try {
        const formData = await cardform.getCardformValue();
        
        // Enviar ao backend
        const response = await fetch('/api/payments/recurring/subscriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            aluno_id: 'uuid-do-aluno',
            preapproval_plan_id: selectedPlan,
            card_token_id: formData.data.token,
            payer_email: document.getElementById('email').value,
          })
        });

        const result = await response.json();
        if (result.success) {
          alert('Assinatura criada com sucesso!');
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao processar pagamento');
      }
    }

    init();
  </script>
</body>
</html>
```

## 🧪 Testando com Cartões de Teste

Use cartões de teste do Mercado Pago:

| Tipo | Número | CVV | Validade |
|------|--------|-----|----------|
| Visa (Aprovado) | 4509953566233576 | 123 | 11/25 |
| Mastercard (Aprovado) | 5425230582516015 | 123 | 11/25 |
| Elo (Recusado) | 6362970000457013 | 123 | 11/25 |

**Nome do Titular**: APRO (para aprovado) ou OTHE (para recusado)

## 📊 Estados da Assinatura

```
pending    → Aguardando confirmação
authorized → Ativa, cobrando mensalmente
paused     → Pausada temporariamente
canceled   → Cancelada pelo usuário
```

## 🔄 Fluxo de Navegação

```
1. Tela de Planos
   ↓
2. Seleção e Preencher Cartão
   ↓
3. Confirmar Assinatura
   ↓
4. Sucesso → Dashboard com Assinatura Ativa
   ↓
5. Próximos meses: cobrança automática
```

## ⚠️ Pontos Importantes

1. **Nunca** guardar dados do cartão (SEM PCI compliance)
2. **Sempre** usar token gerado pelo Mercado Pago
3. **Nunca** enviar `card_number`, `cvv`, etc. pelo seu servidor
4. O token tem validade de **7 dias**
5. O Mercado Pago cobra automaticamente a data de vencimento de cada mês

## 🐛 Debugging

```javascript
// Ativar logs de debug
if (process.env.REACT_APP_DEBUG_PAYMENT === 'true') {
  window.mercadoPagoDebug = true;
  window.addEventListener('message', (event) => {
    if (event.data.type === 'MERCADOPAGO_CARDFORM_EVENT') {
      console.log('MP Event:', event.data);
    }
  });
}
```

## 📞 Suporte

- Docs: https://www.mercadopago.com.br/developers/pt/docs
- Dashboard de Testes: https://sandbox.mercadopago.com.br/
- Webhooks: https://webhook.site (para testar)

## ✅ Checklist de Implementação

- [ ] Instalado `@mercadopago/sdk-js`
- [ ] Variáveis de ambiente configuradas
- [ ] Componente de seleção de planos criado
- [ ] Formulário Cardform montado
- [ ] Tokenização de cartão funcionando
- [ ] Envio para backend com token
- [ ] Feedback visual (loading, sucesso, erro)
- [ ] Redirecionamento pós-sucesso
- [ ] Testes com cartões de teste
- [ ] Documentação do usuário final

## 🚀 Próximos Passos

1. Dashboard de assinaturas do aluno
2. Histórico de pagamentos
3. Atualizar método de pagamento
4. Cancelamento com razão
5. Integração com planilha/relatórios de faturamento
