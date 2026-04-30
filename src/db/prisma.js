const { PrismaClient } = require("@prisma/client");
const { getAuthContext } = require("../context/requestContext");

const tenantModels = new Set([
  "Aluno",
  "AlunoPlan",
  "WorkoutPlan",
  "WorkoutPlanItem",
  "Payment",
  "TenantSubscription",
  "AgendaEvent",
  "DietPlan",
  "DietPlanDay",
]);

function applyTenantWhere(args, personalId) {
  const currentWhere = args.where || {};

  if (currentWhere.personalId && currentWhere.personalId !== personalId) {
    throw new Error("Cross-tenant query blocked");
  }

  return {
    ...args,
    where: {
      ...currentWhere,
      personalId,
    },
  };
}

function applyTenantData(args, personalId) {
  if (!args.data) {
    return args;
  }

  if (Array.isArray(args.data)) {
    return {
      ...args,
      data: args.data.map((item) => ({ ...item, personalId })),
    };
  }

  return {
    ...args,
    data: {
      ...args.data,
      personalId,
    },
  };
}

function applyTenantUpsert(args, personalId) {
  return {
    ...applyTenantWhere(args, personalId),
    create: {
      ...(args.create || {}),
      personalId,
    },
    update: {
      ...(args.update || {}),
      personalId,
    },
  };
}

const prisma = new PrismaClient().$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const auth = getAuthContext();

        if (!tenantModels.has(model)) {
          return query(args);
        }

        if (!auth || auth.role === "SUPER_ADMIN") {
          return query(args);
        }

        if (!auth.personalId) {
          throw new Error("Tenant context missing for tenant-scoped model");
        }

        let nextArgs = { ...args };

        if (
          [
            "findMany",
            "findFirst",
            "count",
            "aggregate",
            "updateMany",
            "deleteMany",
          ].includes(operation)
        ) {
          nextArgs = applyTenantWhere(nextArgs, auth.personalId);
        }

        if (["create", "createMany"].includes(operation)) {
          nextArgs = applyTenantData(nextArgs, auth.personalId);
        }

        if (operation === "upsert") {
          nextArgs = applyTenantUpsert(nextArgs, auth.personalId);
        }

        return query(nextArgs);
      },
    },
  },
});

module.exports = { prisma };
