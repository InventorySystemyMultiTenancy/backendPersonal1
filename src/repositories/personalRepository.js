const { isUuid } = require("../utils/validation");

class PersonalRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  static normalizeTenantIdentifier(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }

  async findTenantByIdentifier(identifier) {
    const raw = String(identifier || "").trim();
    if (!raw) {
      return null;
    }

    const isUuidInput = isUuid(raw);
    const filters = [
      {
        subdomain: {
          contains: raw,
          mode: "insensitive",
        },
      },
      {
        businessName: {
          contains: raw,
          mode: "insensitive",
        },
      },
      {
        user: {
          email: {
            contains: raw,
            mode: "insensitive",
          },
        },
      },
    ];

    if (isUuidInput) {
      filters.push({
        id: raw,
      });
    }

    const candidates = await this.prisma.personalProfile.findMany({
      where: {
        OR: filters,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 50,
    });

    let resolvedCandidates = candidates;

    // Fallback: if direct DB text filters miss (e.g. subdomain without spaces),
    // score all tenants by normalized fields.
    if (!resolvedCandidates.length && !isUuidInput) {
      resolvedCandidates = await this.prisma.personalProfile.findMany({
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        take: 500,
      });
    }

    if (!resolvedCandidates.length) {
      return null;
    }

    const normalizedInput = PersonalRepository.normalizeTenantIdentifier(raw);
    const scored = resolvedCandidates
      .map((tenant) => {
        const subdomain = PersonalRepository.normalizeTenantIdentifier(
          tenant.subdomain,
        );
        const business = PersonalRepository.normalizeTenantIdentifier(
          tenant.businessName,
        );
        const emailLocal = PersonalRepository.normalizeTenantIdentifier(
          String(tenant.user?.email || "").split("@")[0],
        );

        let score = 0;
        if (String(tenant.id).toLowerCase() === raw.toLowerCase()) score += 100;
        if (subdomain === normalizedInput) score += 90;
        if (business === normalizedInput || emailLocal === normalizedInput)
          score += 80;
        if (
          subdomain.startsWith(normalizedInput) ||
          business.startsWith(normalizedInput) ||
          emailLocal.startsWith(normalizedInput)
        )
          score += 40;
        if (
          normalizedInput.startsWith(business) ||
          normalizedInput.startsWith(emailLocal)
        )
          score += 20;

        return { tenant, score };
      })
      .sort((a, b) => b.score - a.score);

    if (!scored[0] || scored[0].score <= 0) {
      return null;
    }

    const topScore = scored[0].score;
    const topMatches = scored.filter((item) => item.score === topScore);

    if (topMatches.length > 1) {
      return {
        ambiguous: true,
        options: topMatches.map((item) => item.tenant),
      };
    }

    return scored[0].tenant;
  }

  async createTenantWithUser({
    email,
    passwordHash,
    businessName,
    phone,
    subdomain,
    status,
    defaultPlan,
  }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "PERSONAL",
          isActive: true,
        },
      });

      const profile = await tx.personalProfile.create({
        data: {
          userId: user.id,
          businessName,
          phone: phone || null,
          subdomain: subdomain || null,
          status: status || "ACTIVE",
          defaultPlan: defaultPlan || "FREE",
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: { personalId: profile.id },
      });

      return tx.personalProfile.findUnique({
        where: { id: profile.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
            },
          },
        },
      });
    });
  }

  async updateTenantProfile(
    personalId,
    { businessName, phone, subdomain, email },
  ) {
    const current = await this.prisma.personalProfile.findUnique({
      where: { id: personalId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!current) {
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      if (email && current.user?.id) {
        await tx.user.update({
          where: { id: current.user.id },
          data: { email },
        });
      }

      await tx.personalProfile.update({
        where: { id: personalId },
        data: {
          businessName: businessName ?? current.businessName,
          phone: phone !== undefined ? phone : current.phone,
          subdomain: subdomain !== undefined ? subdomain : current.subdomain,
        },
      });

      return tx.personalProfile.findUnique({
        where: { id: personalId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              isActive: true,
            },
          },
        },
      });
    });
  }

  async deactivateTenant(personalId) {
    const current = await this.prisma.personalProfile.findUnique({
      where: { id: personalId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!current) {
      return null;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.personalProfile.update({
        where: { id: personalId },
        data: { status: "INACTIVE" },
      });

      if (current.user?.id) {
        await tx.user.update({
          where: { id: current.user.id },
          data: { isActive: false },
        });
      }
    });

    return { deleted: true };
  }

  listTenants() {
    return this.prisma.personalProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
        subscriptions: {
          where: { isActive: true },
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            subscriptionPlan: {
              select: {
                code: true,
                name: true,
                priceCents: true,
              },
            },
          },
        },
        _count: {
          select: {
            alunos: true,
            workoutPlans: true,
            payments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  updateTenantStatus(personalId, status) {
    return this.prisma.personalProfile.update({
      where: { id: personalId },
      data: { status },
    });
  }

  async getGlobalMetrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const [
      activePersonals,
      totalAlunos,
      newSignupsThisMonth,
      activeSubscriptions,
      canceledLast30,
      startedLast30,
    ] = await Promise.all([
      this.prisma.personalProfile.count({ where: { status: "ACTIVE" } }),
      this.prisma.aluno.count(),
      this.prisma.personalProfile.count({
        where: { createdAt: { gte: monthStart } },
      }),
      this.prisma.tenantSubscription.findMany({
        where: { isActive: true },
        include: {
          subscriptionPlan: {
            select: {
              priceCents: true,
            },
          },
        },
      }),
      this.prisma.tenantSubscription.count({
        where: {
          isActive: false,
          endsAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.tenantSubscription.count({
        where: {
          startedAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const mrrCents = activeSubscriptions.reduce(
      (sum, item) => sum + (item.subscriptionPlan?.priceCents || 0),
      0,
    );

    const churnRate =
      startedLast30 > 0 ? (canceledLast30 / startedLast30) * 100 : 0;

    return {
      activePersonals,
      totalAlunos,
      mrrCents,
      churnRate,
      newSignupsThisMonth,
    };
  }

  async getGrowthSeries() {
    const [personalsRows, revenueRows] = await Promise.all([
      this.prisma.$queryRaw`
        WITH months AS (
          SELECT date_trunc('month', current_date) - (interval '1 month' * gs) AS month_start
          FROM generate_series(11, 0, -1) AS gs
        )
        SELECT
          to_char(m.month_start, 'YYYY-MM') AS label,
          COALESCE(COUNT(p.id), 0)::int AS value
        FROM months m
        LEFT JOIN "PersonalProfile" p
          ON date_trunc('month', p."createdAt") = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `,
      this.prisma.$queryRaw`
        WITH months AS (
          SELECT date_trunc('month', current_date) - (interval '1 month' * gs) AS month_start
          FROM generate_series(11, 0, -1) AS gs
        )
        SELECT
          to_char(m.month_start, 'YYYY-MM') AS label,
          COALESCE(SUM(sp."priceCents"), 0)::int AS value
        FROM months m
        LEFT JOIN "TenantSubscription" ts
          ON date_trunc('month', ts."startedAt") = m.month_start
          AND ts."isActive" = true
        LEFT JOIN "SubscriptionPlan" sp
          ON sp.id = ts."subscriptionPlanId"
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `,
    ]);

    return {
      labels: personalsRows.map((row) => row.label),
      personals: personalsRows.map((row) => Number(row.value)),
      revenue: revenueRows.map((row) => Number(row.value) / 100),
    };
  }

  async getBillingReport() {
    const tenants = await this.prisma.personalProfile.findMany({
      include: {
        user: { select: { email: true } },
        subscriptions: {
          where: { isActive: true },
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            subscriptionPlan: {
              select: {
                code: true,
                name: true,
                priceCents: true,
                interval: true,
              },
            },
          },
        },
        _count: { select: { alunos: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return tenants.map((t) => {
      const sub = t.subscriptions?.[0] ?? null;
      const plan = sub?.subscriptionPlan ?? null;
      return {
        personalId: t.id,
        businessName: t.businessName,
        email: t.user?.email ?? "",
        subdomain: t.subdomain,
        status: t.status,
        planCode: plan?.code ?? null,
        planName: plan?.name ?? null,
        priceCents: plan?.priceCents ?? 0,
        billingInterval: plan?.interval ?? null,
        subscriptionStartedAt: sub?.startedAt ?? null,
        totalAlunos: t._count.alunos,
      };
    });
  }

  async getPlansSummary() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      include: {
        _count: {
          select: { subscriptions: { where: { isActive: true } } },
        },
      },
      orderBy: { priceCents: "asc" },
    });

    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      priceCents: p.priceCents,
      billingInterval: p.interval,
      isActive: p.isActive,
      activeSubscribers: p._count.subscriptions,
      mrrContributionCents: p.priceCents * p._count.subscriptions,
    }));
  }

  async getRecentActivity(limit = 10) {
    const tenants = await this.prisma.personalProfile.findMany({
      include: {
        subscriptions: {
          where: { isActive: true },
          take: 1,
          orderBy: { startedAt: "desc" },
          include: {
            subscriptionPlan: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return tenants.map((tenant) => {
      let action = "Atualizacao de conta";

      if (tenant.status !== "ACTIVE") {
        action = "Conta desativada";
      } else if (tenant.createdAt.getTime() === tenant.updatedAt.getTime()) {
        action = "Novo personal cadastrado";
      }

      return {
        action,
        tenantId: tenant.id,
        tenant: tenant.businessName,
        plan:
          tenant.subscriptions[0]?.subscriptionPlan?.code ||
          tenant.subscriptions[0]?.plan ||
          tenant.defaultPlan,
        status: tenant.status,
        timestamp: tenant.updatedAt,
      };
    });
  }
}

module.exports = { PersonalRepository };
