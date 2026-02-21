# Plan Maestro de Desarrollo - Sistema Contable Forestal

Fecha: 2026-02-20

## 1. Proposito

Consolidar requerimientos funcionales del sistema contable forestal por modulos independientes pero interrelacionados. La jerarquia patrimonial es una dimension transversal para trazabilidad, consolidacion y permisos.

## 2. Jerarquia patrimonial transversal

Niveles de responsabilidad patrimonial:
- Nivel 0: Corporativo | Empresa | Sociedad
- Nivel 1: Pais | Estado | Municipio | Ciudad | Region | Departamento | Provincia | Distrito | Comuna.
- Nivel 2: Finca | Predio | Hato | Fundo | Hacienda | Farm
- Nivel 3: Compartimiento | Block | Sección | Lote | Zona | Bloque
- Nivel 4: Rodal | Parcela | Enumeration | Unidad de Manejo | Stand
- Nivel 5: Refererencia | Subunidad | Subparcela | Muestra | Submuestra
- Nivel 6: Activo Biológico 

Mapeo operativo para NIC 41:
- Proyecto = Nivel 1.
- Finca = Nivel 2.
- Lote = Nivel 3.
- Rodal = Nivel 4.
- Activo biologico = Nivel 5.

## 3. Modulo Configuracion

Objetivo: parametrizar constantes y niveles para el funcionamiento del sistema.

Alcance:
- Parametros y constantes para calculos globales.
- Configuracion de niveles organizacionales y de patrimonio (0-5).
- Politicas contables NIC 41 (modelo costo vs valor razonable, tasas, unidades de medida).
- Carga de tablas maestras necesarias para operar el sistema.

## 4. FASE 1: Modulo Gestion Patrimonial/Tecnica

Submodulos y alcance:
- [ ] Informacion del Patrimonio Forestal
- [ ] inventario forestal en pie (existencias)
- [ ] Monitoreo y crecimiento (mediciones) y cubicacion rigurosa.
- [ ] Inventarios de sobrevivencia o prendimiento.
- [ ] Inventarios de manejo o preoperativo (aclareos, raleos, podas, entresacas).
- [ ] Inventarios precosecha (mediciones pre aprovechamiento de bosque en pie).
- [ ] Inventarios de afectacion y/o daños (incendios, plagas, enfermedades, inundacion, sequia, manejo forestal inapropiado).

## 8. FASE 8:Modulo Mapas (Transversal) | Sistema de cartografía de unidades de manejo y otras áreas de interés

Uso de Suelos y variaciones patrimoniales
- [ ] Intervenciones y variaciones al patrimonio propias y de terceros y uso de suelos
  - [ ] Actualizacion de superficies intervenidas o afectadas.
  - [ ] Vinculo entre la cartografia y las áreas del proyecto.

Funciones de visualizador GIS:
- [ ] Ubicacion de formas espaciales.
- [ ] Escala.
- [ ] Coordenadas geograficas (latitud/longitud).
- [ ] Alejamiento y acercamiento (zoom).
- [ ] Medicion de distancias y areas.
- [ ] Partir y consolidar areas seleccionadas.
- [ ] Actualizacion automatica de superficies en todas las tablas inherentes a la unidad de manejo.
- [ ] Tooltip con informacion de la unidad de manejo.

Actualización y Ajuste de Superficies y volumenes:
- [ ] Prognosis o simulacion de crecimiento de plantaciones forestales.
  - [ ] Insumo principal para tasacion y planificaciones estrategicas, tacticas y operativas.
- [ ] Esquemas de manejo o recetas silviculturales.
  - [ ] Formacion de masa forestal, mantenimiento y proteccion fitosanitaria.

Integracion biologica-contable (NIC 41):
- [ ] Crecimiento anual (m3): reconocimiento de ingreso por valorizacion (no caja).
- [ ] Mortalidad/plagas: deterioro de activos o baja de inventarios.
- [ ] Raleo a desecho: cambio de activo biologico a inventario (producto cosechado a pérdida).
- [ ] Raleo comercial: cambio de activo biologico a inventario (producto cosechado).
- [ ] Podas: gasto del periodo o capitalizacion segun politica.

## 5. FASE 2: Modulo Gestion Administrativa/Financiera

Submodulos y alcance:
- [ ] Cuentas contables por Sociedad o Empresa.
  - [ ] Cuentas Mayor, cuentas auxiliares, centros de costos para gastos indirectos.
- [ ] Planes operativos y presupuesto anual/mensual.
  - [ ] Tarifas y presupuesto anual por actividad.
  - [ ] Presupuestos anuales por unidad administrativa segun organigrama.
  - [ ] Plan anual de corta (cosecha forestal)
- [ ] Cuantificacion de existencias de madera cosechada
- [ ] Ajustes de rendimiento por unidad de manejo.
- [ ] Costos de materia prima por tipo de producto y por unidad de manejo.
- [ ] Tasacion forestal o revalorizacion de plantaciones forestales por Sociedad.
- [ ] Compras de insumos, materiales y otros.
- [ ] Inventarios y stock de activos circulantes de insumos quimicos y biologicos.
- [ ] Costos reales incurridos y control de gastos por unidad administrativa.
- [ ] Abastecimiento.
  - [ ] Programas de abastecimiento industrial por tipo de producto.
  - [ ] Control de flota de transporte y planificacion de rutas e itinerarios.
  - [ ] Reportes de movilizacion de productos forestales cosechados.
  - [ ] Control diario de despacho y recepcion (origen/destino).
  - [ ] Ventas de madera a empresas relacionadas (EE.RR) o terceros.
- [ ] Control de activos fijos, terrenos y otros.

Flujo contable sugerido (NIC 41):
- [ ] Capitalizacion de costos en cuentas de activos biologicos.
- [ ] Ajuste por valor razonable al cierre de periodo.
- [ ] Traspaso a inventarios y costo de ventas al momento de cosecha/venta.

## 6. FASE 3: Modulo Gestion Financiera

Submodulos de reportes:
- [ ] Estados financieros: balance general, estado de resultado, deficit/superhabit.
- [ ] Reporte PxQ.
- [ ] Gastos de administracion.
- [ ] Gastos de ventas (total y unitario).
- [ ] Gastos de marketing.
- [ ] Capital de trabajo.
- [ ] CAPEX o inversiones en activo fijo.
- [ ] Flujo de caja mensual y anual.
- [ ] Otros ingresos y egresos fuera de explotacion.
- [ ] Ingresos/gastos financieros de terceros y EE.RR.
- [ ] Metas financieras.
- [ ] Calculo de RONA.
- [ ] Calculo de EVA.
- [ ] Calculo de EBITDA.
- [ ] Resumen de gestion mensual y anual

Nota: separar EBITDA operativo del ajuste por valor razonable.

## 7. FASE 7: Modulo Gestion Operativa

Submodulo Operacion:
- [ ] Gestion de rendimientos de faenas o actividades.
- [ ] Avance de actividades de campo.
- [ ] Reportes de calidad de productos (aceptacion/rechazo, factores de conversion).
- [ ] Apertura y cierre de actividades en unidades de manejo.
- [ ] Control de contratistas (liquidaciones, anticipos, contratos, fuerza laboral).
- [ ] Reportes de produccion de la cosecha forestal.
- [ ] Control de maquinarias y vehiculos (Plan de mantenimiento y reparacion).
- [ ] Emision de ingresos prediales.

Submodulo Legal y Capital Humano:
- [ ] Gestion de requisitos legales (comite legal).
- [ ] Valoracion de cargos.
- [ ] Descripcion de cargos
- [ ] Evaluaciones individuales de desempeño.
- [ ] Gestion de documentos controlados y no controlados.
- [ ] Gestion de seguridad y salud en el trabajo.
- [ ] Gestion ambiental y programas de conservación.
- [ ] Gestion social y comanejo.
- [ ] Rendiciones de gastos.
- [ ] Autorizaciones para utilizar activos fijos de la empresa (Vehículos y Maquinarias)
- [ ] Recorrido de vehiculos
- [ ] Reportes de tilización de Maquinaria.

## 9. Entidades base y precision de datos

Entidades base:
- [ ] Organizaciones y usuarios.
- [ ] Proyectos, fincas, rodales.
- [ ] Clientes, facturas, guias de despacho.
- [ ] Afectaciones y compensaciones.

Precision recomendada:
- Valores monetarios: NUMERIC(18,2) en dólares americanos (US$).
- Superficies: NUMERIC(12,2) en hectáreas (ha).
- Volumenes y otras mediciones forestales: NUMERIC(12,4) en m3ssc.
- Número de árboles, densidad arbórea: NUMERIC(12,0)

## 10. Pendientes y definiciones posteriores

- [ ] Completar reglas de permisos por nivel jerarquico.
- [ ] Completar matrices de trazabilidad requisito -> modulo -> nivel -> rol.


# DESARROLLO E IMPLEMENTACIÓN
## 4. FASE 1: Modulo Gestion Patrimonial/Tecnica
- [ ] Informacion de superficies de rodales y uso de suelos | Sistema de cartografía de unidades de manejo y otras áreas de interés

## Descripción de tablas

Nivel 2:
- Código de la unidad administrativa nivel 2
- Nombre de la unidad administrativa nivel 2
- Tipo: Finca | Predio | Hato | Fundo | Hacienda 
- Fecha Documento Legal
- Estado Legal: Adquisición | Arriendo | usufructo | Comodato
- Superficie Total en ha
- Ubicación geográfica (centroide): Latitud | Longitud
- Propietario o representante legal
- Antecedentes legales:
  - Número del Registro Público
  - Fecha del Registro Público
  - Dirección o ubicación
- Vecinos:
  - Código de vecino colindante
  - Nombre de vecino colindante
  - Tipo de vecino colindante
- Última fecha de la información
- Estatus: True | False

Nivel 3:
- Código de la unidad administrativa nivel 2 (relacionada)
  - Nombre de la unidad administrativa nivel 2
- Código de la unidad administrativa nivel 3
- Nombre de la unidad administrativa nivel 3|
- Tipo: Compartimiento | Block | Sección | Lote | Zona | Bloque
- Superficie total en ha
- Ubicación geográfica (centroide): Latitud | Longitud
- Última fecha de la información
- Estatus: True | False

Nivel 4:
- Código de la unidad administrativa nivel 3 (relacionada)
  - Nombre de la unidad administrativa nivel 3
- Código de la unidad administrativa nivel 4
- Nombre de la unidad administrativa nivel 4
- Tipo: Rodal | Parcela | Enumeration | Unidad de Manejo
- Superficie total en ha
- Superficie plantable en ha
- Rotación | Fase
- Uso anterior
- Ubicación geográfica (centroide): Latitud | Longitud
- Última fecha de la información 
- Estatus: True | False

Nivel 5:
- Código de la unidad administrativa nivel 4 (relacionada)
  - Nombre de la unidad administrativa nivel 4
- Código de la unidad administrativa nivel 5
- Nombre de la unidad administrativa nivel 5
- Tipo: Refererencia | Subunidad | Subparcela | Muestra | Submuestra
- Tipo de forma: Rectangular | Cuadrada | Circular | Hexagonal
- Dimensión 1 en m (Largo)
- Dimensión 2 en m (Ancho)
- Dimensión 3 en m (radio)
- Dimensión 4 en m (Longitud)
- Estatus: True | False

Cálculos de áreas:
Para calcular el área de un rectángulo o de un cuadrado se multiplca la Dimensión 1 por la Dimensión 2. 
Para calcular el área de un círculo se multiplica la constante pi() * Dimension 3 * Dimensión 3.
Para el cálculo del área de un hexágono se utiliza la fórmula: ((6 x Dimensión 4) * a)/2 donde a es la apotema del hexágono = Dimensión 4 / (2 * tan(30 grados en radianes)) se verifica el resultado con la fórmula area = ((3 * raiz cuadrada(3)) / 2) * Dimensión 4 * Dimensión 4. Se acepta con margen de diferencia de un 5%

- Superficie total en metros cuadrados (área calculado según tipo de forma)
- Ubicación geográfica (centroide): Latitud | Longitud
- Última fecha de la información 

Nivel 6:
- Código de la unidad administrativa nivel 4 (relacionada)
  - Nombre de la unidad administrativa nivel 4
- Clave Activo Biológico
Esta clave es la concatenación de los siguientes campos: Nivel 3 + Nivel 4 + Código Material Genético
- Clave Contable: Esta clave es la concatenación del código de las siguientes campos: Nivel 3 + Nivel 4 + Año Plantación
- Fecha Establecimiento o Plantación
- Año Plantación
- Superficie plantada en ha
- Código Material Vegetal (relacionado)
  - Nombre Material Vegetal
- Tipo Activo Biológico: Comercial | Investigación
- Código Esquema de Manejo (relacionado)
  - Nombre Esquema de Manejo
- Código Inventario Forestal (relacionado)
  - Tipo Inventario Forestal
  - Fecha Inventario Forestal
  - Edad Plantación a la fecha del Inventario Forestal
  - Número de unidades Nivel 5 (registros)
  - Código Espaciamiento (Relacionado)
    - Descripción
    - Entre calle en m
    - Entre árboles (cova)
    - Densidad arbórea en árboles por ha
  - Código Espaciamiento (Relacionado)
    - Descripción Espaciamiento 
  - Código Espaciamiento (Relacionado)
    - Densidad arbórea en ha 
  Densidad arbórea (Número de árboles por ha)
  - Sobrevivencia
  Para Activos Biológicos mayores a 6 años de edad:
  - Altura Dominante en m
  - Altura Media en m
  - Diámetro Cuadrático en m
  - Área Basal en metros cuadrados
Volumen del Inventario Forestal:
  Volumen Unitario:
  - Volumen en metros cúbicos sólidos sin corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
  - Volumen en metros cúbicos sólidos con corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
  Volumen Total: se multiplica el volumen unitario por la superficie plantada de la unidad administrativa nivel 5 de activo biológico
  - Volumen en metros cúbicos sólidos sin corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
  - Volumen en metros cúbicos sólidos con corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
Volumen Ajustado: se calcula con el simulador de crecimiento la diferencia de volumen entre la fecha del inventario forestal y la fecha de cierre contable al 31/12 del año en evaluación.
- Volumen en metros cúbicos sólidos sin corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
  - Volumen en metros cúbicos sólidos con corteza por ha
    - Por tipo de producto (Aserrable | Pulpable | Carbón)
    - Por Categorías Diamétricas
- Clase IMA (relacionado): se calcula en función del volumen ´solido sin corteza por ha a la fecha del inventario forestal entre la edad de la plantación a la fecha del inventario forestal.
  - Clasificación: I | II | III | IV | V
- Costo real incurrido en dólares americanos (US$) al 31/12 del año en evaluación: viene de la cuenta contable de control de costos de la unidad administrativa nivel 4

Tablas auxiliares:
- [X] Esquemas de Manejo
  - Código Esquema de Manejo
  - Nombre Esquema de Manejo
- [X] Tipo de Inventario Forestal
 - Código Inventario Forestal
 - Nombre Inventario Forestal
- [X] Clase IMA
  - Código Clase IMA
  - Clasificación IMA
  - Nombre Clase
  - Descripción Clase
  - Rango
- [X] Material Vegetal
 - Código Material Vegetal
 - Nombre Material Vegetal
 - Código Especie (relacionado)
  - Nombre Científico válido
 - Tipo Material Vegetal: Pura | Híbrida 
 - Tipo de planta: Progenie | Clon | Injerto | In vitro
 - Origen de la planta: Nativa | Exótica | Naturalizada | Introducida | Endémica | Cultivada
 - [X] Procedencia
  - Código Procedencia
  - Nombre Procedencia
  - Código País
    - Nombre País
- [X] Uso Suelos o Tipo Tierras
 - Código Uso Suelo
 - Nombre
 - Productiva: True | False
- [X] Continentes
  - Código Continente
  - Nombre Continente
- [X] Paises
  - Código Continente (Relacionado)
    - Nombre Continente
  - Código País
  - Nombre País
- [X] Regiones
  - Código País (relacionado)
    - Nombre País
  - Código Región
  - Nombre Región
- [X] Estadal
  - Código Pais (relacionado)
    - Nombre País
  - Código Estado
  - Nombre Estado
  - Tipo: Estado | Departamento
- [X] Municipal
  - Código Estado (relacionado)
    - Nombre Estado
  - Código Municipio | 
  - Nombre Municipio
  - Tipo: Municipio | Distritos
- [X] Ciudades
  - Código Municipio (relacionado)
    - Nombre Municipio
  - Código Ciudad
  - Nombre Ciudad
- [X] Desarrollo local
  - Código Ciudad (relacionado)
    - Nombre Ciudad
  - Código del Desarrollo local
  - Nombre Comuna | Parroquia
  - Tipo: Parroquia |Comuna | Territorio Indígena | Comunidad Criolla | Campamento Militar
- [X] Espaciamiento
    - Código Espaciamiento
    - Nombre Espaciamiento
    - Descripción del Espaciamiento (3,0 x 3,0)
    - Entre calle en m
    - Entre árboles (cova) en m
    - Densidad arbórea en árboles por ha
    - Dirección Plantación [Norte | Sur | Este | Oeste | Noreste | Sureste | Suroeste | Noroeste]
- [X] Especies Vegetales
  - Código Especie
  - Nombre Científico válido
  - Nombre vulgar o vernáculo
  - Género
  - Familia
  - Orden
-  [ ] Costos por unidad administrativa Nivel 4
  - Código de la unidad administrativa nivel 4 (relacionada)
  - Nombre de la unidad administrativa nivel 2
  - Nombre de la unidad administrativa nivel 3 
  - Nombre de la unidad administrativa nivel 4
  - Superficie Plantación en ha
  - Rotación | Fase
  - Número Documento Contable 
  - Fecha Documento Contable
  - Descripción Documento Contable
  - Valor Libro en dólares americanos (US$)
  - Valor Libro por ha en dólares americanos (US$)
  - Estatus: true | false
- [ ] Tipo de productos
  - Código Tipo Producto
  - Nombre Tipo Producto
  - Largo mínimo en m
  - Largo máximo en m
  - Diámetro mínimo extremo menor en cm
  - Diámetro máximo extremo menor en cm 
  - Tipo de Cosecha Recomendada: Mecanizada | Manual
  