// Confere manualmente, direto no Mercado Pago, se a última cobrança PIX de
// um aluno já foi paga — e corrige o status/vencimento no banco se sim.
//
// Serve para o caso em que o webhook de confirmação não atualizou a
// assinatura (atrasou, foi perdido, ou a correção do webhook ainda não foi
// implantada). Não force nada "na marra": ele só marca como pago se o
// Mercado Pago confirmar que o pagamento foi aprovado.
//
// Uso (a partir da raiz do backend, com o .env apontando para o banco/API
// corretos — geralmente o mesmo ambiente onde o backend roda em produção):
//   node scripts/check-pix-payment.js "email-ou-nome-do-aluno"

require("dotenv").config();
const { prisma } = require("../src/db/prisma");
const {
  getSubscriptionStatus,
} = require("../src/services/paymentRecurringService");

async function main() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error(
      'Uso: node scripts/check-pix-payment.js "email ou nome do aluno"',
    );
    process.exitCode = 1;
    return;
  }

  const aluno = await prisma.aluno.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { fullName: { contains: identifier, mode: "insensitive" } },
      ],
    },
    include: {
      alunoPlan: true,
      alunoSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!aluno) {
    console.error(`Nenhum aluno encontrado para "${identifier}".`);
    process.exitCode = 1;
    return;
  }

  const subscription = aluno.alunoSubscriptions[0];

  if (!subscription) {
    console.error(`${aluno.fullName} não tem nenhuma assinatura registrada.`);
    process.exitCode = 1;
    return;
  }

  if (subscription.payment_method !== "pix") {
    console.error(
      `A última assinatura de ${aluno.fullName} é "${subscription.payment_method}", não PIX. Esse script só serve para PIX.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Aluno: ${aluno.fullName} (${aluno.email || "sem email"})`);
  console.log(`Plano: ${aluno.alunoPlan?.name || "sem plano"}`);
  console.log(`Assinatura: ${subscription.id}`);
  console.log(
    `Status atual no banco: ${subscription.status} (provider: ${subscription.provider_status || "-"})`,
  );
  console.log(
    `Vencimento atual: ${aluno.planDueDate ? aluno.planDueDate.toISOString() : "não informado"}`,
  );
  console.log("\nConsultando o Mercado Pago...\n");

  const result = await getSubscriptionStatus({
    alunoId: aluno.id,
    personalId: aluno.personalId,
    subscriptionId: subscription.id,
    authUserId: null,
  });

  console.log("--- Resultado ---");
  console.log(`Status confirmado no Mercado Pago: ${result.subscription.status}`);
  console.log(
    `Próximo vencimento: ${result.subscription.next_payment_date || "-"}`,
  );

  if (result.subscription.status === "authorized") {
    console.log(
      "\n✅ Pagamento confirmado no Mercado Pago. O vencimento do aluno já foi atualizado no banco.",
    );
  } else {
    console.log(
      `\n⚠️  O Mercado Pago ainda não confirma esse pagamento como aprovado (status: "${result.subscription.status}"). Nada foi marcado como pago — se o cliente disser que pagou, confira o comprovante/CPF usado, pode ser um PIX em outra cobrança/ciclo.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Erro:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
