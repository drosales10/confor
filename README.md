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

## Worker geoespacial automático

El procesamiento asíncrono de importación y recálculo de superficies Nivel 4 se ejecuta con un scheduler dedicado:

```bash
pnpm worker:geo
```

Variables opcionales:

- `GEO_WORKER_INTERVAL_MS` (default `4000`): intervalo de polling.
- `GEO_IMPORT_BATCH_SIZE` (default `5`): máximo de jobs de importación por ciclo.
- `GEO_RECALC_BATCH_SIZE` (default `10`): máximo de jobs de recálculo por ciclo.
- `GEO_WORKER_RUN_ONCE=true`: ejecuta un ciclo y termina (útil para pruebas/manual).

Ejecución de prueba en un ciclo:

```bash
pnpm worker:geo:once
```

## Ejecución sin Docker con PM2 (Windows)

Si no deseas usar Docker, puedes ejecutar la aplicación y el worker geoespacial como procesos administrados por PM2.

1. Instalar PM2 globalmente:

```bash
npm i -g pm2
```

2. Construir la aplicación (modo producción):

```bash
pnpm build
```

3. Levantar procesos definidos en `ecosystem.config.cjs`:

```bash
pm2 start ecosystem.config.cjs
```

4. Ver estado y logs:

```bash
pm2 status
pm2 logs confor-web
pm2 logs confor-geo-worker
```

5. Persistir configuración para reinicios:

```bash
pm2 save
```

6. Habilitar autoarranque de PM2 en Windows:

```bash
pm2 startup
```

Luego ejecuta el comando que PM2 muestre en pantalla y vuelve a guardar:

```bash
pm2 save
```

### Comandos útiles PM2

- Reiniciar app web: `pm2 restart confor-web`
- Reiniciar worker: `pm2 restart confor-geo-worker`
- Detener todo: `pm2 stop all`
- Eliminar procesos: `pm2 delete all`

## Usuario inicial

- Email: `admin@example.com`
- Password: `Admin1234`

## Notas

- El script `scripts/create-audit-partition.ts` permite crear la siguiente partición mensual de `audit_logs`.
- El SQL en `prisma/migrations/0001_extensions_partitioning/migration.sql` incluye extensiones y triggers requeridos.
