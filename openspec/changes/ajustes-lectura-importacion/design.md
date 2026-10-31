## Context

- `TENURE_ALIASES` (`imports/mapping.py`) es un diccionario fijo: etiquetas del contrato (`Propiedad`, `Comodato`, `Préstamo Temporal`) más `propiedad`, `propio`, `comodato` y `prestamo temporal`. Se usa al convertir el régimen por defecto del lote y el valor de la columna mapeada a `tenure_regime`.
- `Piece.acquisition_method_term_id` existe y la importación admite destinos `terms:<VOCABULARIO>`. Falta confirmar que un destino `terms:ACQUISITION_METHOD` llene ese campo al aplicar (tarea 1.1).
- `normalize_inc_code` acepta 4 y 6 dígitos (`FORMAT_INC_4`, `FORMAT_INC_6`); cualquier otra longitud es «no normalizable».
- `normalization_setting` ya guarda parámetros administrables (`absence_markers`, `concatenation_separators`) con su pantalla «Lectura de códigos».

## Goals / Non-Goals

**Goals:** importar las sábanas reales sin que la forma de adquisición rompa el régimen; reconocer los RN de 5 dígitos.

**Non-Goals:** régimen nuevo; renormalizar en masa identificadores ya registrados (se hace con la vista previa de «Tipos de código»).

## Decisions

### D1. Correspondencias en `normalization_setting` con clave `tenure_aliases`

- Valor: `{"<valor plegado>": "OWNED|LOAN_FOR_USE|TEMPORARY_LOAN"}`. Migración de datos que siembra los valores por defecto (de la propuesta) más los alias actuales; `TENURE_ALIASES` queda como respaldo si la fila no existe (instalación sin migrar).
- Lectura con el mismo caché por petición que los demás parámetros (`NormalizationParams`). Validación al guardar: régimen dentro del enumerado; clave no vacía.
- *Alternativa*: un campo «régimen» en cada término del vocabulario «Formas de adquisición». Más elegante, pero cambia el modelo de términos y la pantalla de Listas de valores de otro change; se descarta para no tocar el contrato.

### D2. Deducción en la conversión de la fila

```mermaid
flowchart TD
    A[Fila] --> B{¿Régimen explícito?}
    B -- sí --> C[Usar régimen explícito]
    C --> D{¿Forma de adquisición indica otro?}
    D -- sí --> E[Advertencia de revisión]
    B -- no --> F{¿Forma de adquisición con correspondencia?}
    F -- sí --> G[Régimen deducido + término]
    F -- no --> H{¿Régimen por defecto del lote?}
    H -- sí --> I[Régimen por defecto]
    H -- no --> J[Error: no se puede deducir]
```

Las reglas de comodato (RN-003, RN-008) se aplican después sobre el régimen resultante, sin cambios.

### D3. RN de 5 dígitos

`FORMAT_INC_5 = "INC_5_DIGITOS"`, una rama más en `normalize_inc_code`. No se rellena con ceros. Los identificadores ya registrados como «no normalizables» con 5 dígitos se recuperan desde «Tipos de código» con la vista previa y confirmación existentes (sin migración automática, RN-005).

## Risks / Trade-offs

- **[SUPUESTO] Donación/Compra → Propiedad** podría no valer para alguna colección. → Correspondencias editables; el régimen por defecto del lote sigue disponible.
- **RN de 5 dígitos que en realidad son 6 sin un cero** → no se rellena; si A4 dice lo contrario, basta cambiar la regla y renormalizar con vista previa.

## Migration Plan

1. Migración de datos: fila `tenure_aliases` en `normalization_setting`; `downgrade` la retira lógicamente.
2. Seed: términos «Cesión de uso» y «Custodia» en «Formas de adquisición».
