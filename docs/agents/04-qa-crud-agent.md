# Agente QA CRUD

## Objetivo
Validar que un módulo CRUD quedó listo para uso en desarrollo.

## Verificaciones funcionales
1. Crear registro válido.
2. Intentar crear inválido (validación esperada).
3. Buscar por código/nombre.
4. Cambiar paginación y límite.
5. Editar registro inline y verificar persistencia.
6. Eliminar registro sin dependencias.
7. Intentar eliminar con dependencias y validar `409`.

## Verificaciones técnicas
- Ejecutar:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build`
- Confirmar ausencia de errores en consola.

## Verificaciones de seguridad
- Sin sesión => `401` en API.
- Sin permiso => `403` en API.

## Entregable
- Resumen corto con:
  - Qué pasó
  - Qué falló
  - Qué quedó pendiente
  - Riesgos detectados
