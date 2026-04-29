# Personal SaaS Backend (Multi-tenant)

Backend skeleton in Node.js + Express + Prisma/PostgreSQL with strict tenant isolation by `personalId`.

## Stack

- Node.js + Express
- JavaScript
- Prisma ORM
- PostgreSQL
- JWT authentication

## How isolation works

1. JWT payload contains `sub`, `role`, and `personalId`.
2. `authMiddleware` validates token and injects context into `req.auth`.
3. Request context is stored in `AsyncLocalStorage`.
4. Prisma client extension reads that context and auto-injects `personalId` filters in tenant models (`Aluno`, `WorkoutPlan`, `Payment`, `TenantSubscription`).
5. Super admin bypasses tenant filter.

## Run

1. Copy `.env.example` to `.env`.
2. Install dependencies.
3. Generate Prisma client and run migrations.

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

## Suggested project structure

```text
backend/
  prisma/
    schema.prisma
  src/
    app.js
    server.js
    config/
      env.js
    context/
      requestContext.js
    controllers/
      authController.js
      alunoController.js
      superAdminController.js
    db/
      prisma.js
    di/
      container.js
    middlewares/
      authMiddleware.js
      roleMiddleware.js
      errorMiddleware.js
    repositories/
      userRepository.js
      alunoRepository.js
      personalRepository.js
    routes/
      authRoutes.js
      alunoRoutes.js
      superAdminRoutes.js
      healthRoutes.js
    services/
      authService.js
      alunoService.js
      superAdminService.js
    utils/
      appError.js
      jwt.js
      tenantScope.js
```

## Main endpoints

- `POST /auth/login`
- `GET /alunos` (PERSONAL)
- `POST /alunos` (PERSONAL)
- `GET /super-admin/tenants` (SUPER_ADMIN)
- `PATCH /super-admin/tenants/:personalId/status` (SUPER_ADMIN)

## Example: getAllAlunos with tenant isolation

`AlunoRepository.getAll()` intentionally does not receive explicit `where.personalId`.

The Prisma extension in `src/db/prisma.js` enforces `where.personalId = req.auth.personalId` automatically for tenant users.

This blocks cross-tenant reads/writes even if a developer forgets a `where` clause.
