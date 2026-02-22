# Agente UI CRUD (Dashboard)

## Objetivo
Construir una vista `page.tsx` con experiencia completa de gestión:
- formulario create
- tabla/listado
- búsqueda con debounce
- filtros
- paginación (`page` + `limit` + total)
- edición inline
- eliminación con confirmación

## Ubicación
- `src/app/(dashboard)/<ruta>/page.tsx`

## Patrón recomendado (existente en el repo)
Tomar como referencia la pantalla `patrimonio-forestal`.

## Reglas UX
- Mantener estado de búsqueda/paginación tras crear/editar/eliminar.
- Autoajustar página si queda fuera de rango.
- Mostrar aviso breve cuando haya ajuste automático usando `sileo`.
- Deshabilitar botones durante `submitting`.
- Toda alerta/notificación debe implementarse con `sileo`.
- Confirmaciones de acciones destructivas deben usar `sileo.action`.
- No usar `window.alert` ni `window.confirm`.

## Integración API
- `GET`: `level/filters/search/page/limit`
- `POST`: payload create
- `PATCH`: payload update
- `DELETE`: payload delete

## Checklist
- [ ] Tipado local por item
- [ ] manejo de `error` visible
- [ ] controles de paginación claros
- [ ] selector de límite (10/25/50)
- [ ] mensaje de “sin resultados”
