# Modular Enterprise App

Aplicación full-stack modular desarrollada con:

- Next.js (App Router)
- React + Node.js
- PostgreSQL + Prisma
- NextAuth v5 (credenciales)
- Tailwind CSS

## Módulos implementados

1. Autenticación y autorización
2. Gestión de usuarios
3. Dashboard y métricas
4. Configuración del sistema
5. Auditoría

## Requisitos

- Node.js 20+
- Docker (opcional, recomendado)

## Puesta en marcha

1. Instalar dependencias:

```bash
npm install
```

2. Levantar PostgreSQL y Redis:

```bash
docker compose up -d
```

3. Revisar variables de entorno (`.env` / `.env.example`).

4. Generar cliente Prisma y aplicar migraciones:

```bash
npm run db:generate
npm run db:migrate
```

5. Cargar datos base:

```bash
npm run db:seed
```

6. Ejecutar app:

```bash
npm run dev
```

## Usuario inicial

- Email: `admin@example.com`
- Password: `Admin1234`

## Notas

- El script `scripts/create-audit-partition.ts` permite crear la siguiente partición mensual de `audit_logs`.
- El SQL en `prisma/migrations/0001_extensions_partitioning/migration.sql` incluye extensiones y triggers requeridos.
