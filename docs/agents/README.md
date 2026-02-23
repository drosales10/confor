# Agentes CRUD reutilizables

Estos agentes están diseñados para replicar el mismo patrón implementado en `patrimonio-forestal` sobre otras tablas.

## Orden recomendado de ejecución
1. `00-orquestador-crud-agent.md`
2. `01-validaciones-zod-agent.md`
3. `02-api-crud-agent.md`
4. `05-seguridad-multiorganizacion-agent.md`
5. `03-ui-crud-agent.md`
6. `04-qa-crud-agent.md`

## Qué cubren
- Formulario con campos requeridos
- Validación Zod
- CRUD API (`GET/POST/PATCH/DELETE`)
- Patrón de permisos reusable (`SUPER_ADMIN` + fallback `READ`/`CREATE`/`UPDATE`/`DELETE` en `GET`)
- Seguridad multiorganización (filtro por organización + validación de ownership en `POST/PATCH/DELETE`)
- Búsqueda/filtros
- Listado
- Paginación y límite
- Edición inline
- Alertas/confirmaciones con `sileo`
- Verificación final (lint/types/build)

## Input sugerido por tabla
- `entityName`
- `moduleSlug`
- `routeBase`
- `apiRoute`
- `fields`
- dependencias/hijos para reglas de delete

## Ejemplo de uso (tabla hipotética)
- Entidad: `MaterialVegetal`
- Ruta dashboard: `/material-vegetal`
- Ruta API: `/api/forest/material-vegetal`
- Módulo permiso: `material-vegetal`

Con esos datos, el orquestador puede guiar la implementación completa en el repo.
