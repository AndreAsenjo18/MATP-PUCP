# Catálogo

> Secciones escritas por cada change: alta, edición, conflictos, eliminación y corrección del código I llegan con `ficha-pieza-crud`; la conservación, con `colecciones-y-vocabularios-admin`.

## Conservación

En la ficha de una pieza, la sección **Conservación** muestra todas las evaluaciones de su estado, la más reciente primero. La que tiene la marca **Estado actual** es la que se ve en la ficha y en el catálogo. Ninguna evaluación se borra (RN-005).

### Registrar una evaluación

Solo puede hacerlo el personal de Conservación (y el Administrador).

1. Elija el **Estado de conservación** de la escala (bueno, regular, malo…).
2. Si la evaluación es de otro día, escriba la **Fecha de la evaluación**; vacía significa hoy.
3. Si quiere, escriba **Notas** (qué se observó).
4. Pulse **Registrar evaluación**.

Si la fecha es **anterior** a la última evaluación (por ejemplo, al pasar al sistema una evaluación de hace dos años), se agrega al historial **sin cambiar el estado actual**.

> **[SUPUESTO]** La escala de estados es ilustrativa hasta recibir la del museo (pregunta B4).

### Si algo sale mal

| Qué ve | Qué hacer |
|---|---|
| «Elija un estado de conservación activo de la escala» | El estado elegido fue desactivado; elija otro. La escala se administra en **Administración › Vocabularios**. |
| No aparece el formulario | Su rol no registra evaluaciones; pida que lo haga el personal de Conservación. |
| «El historial de conservación está disponible con la API (modo live)» | Está usando la maqueta de demostración. |
