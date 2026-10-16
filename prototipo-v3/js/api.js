/**
 * ══════════════════════════════════════════════════════════════
 * js/api.js — Capa de Servicios desacoplada para el MATP - PUCP
 * Versión 2 — Catálogo Consolidado (M1 a M7)
 * Todas las vistas interactúan únicamente a través de esta API.
 * ══════════════════════════════════════════════════════════════
 */

const API_BASE_URL = ""; // ← aquí irá la URL del backend real (ej: https://api-matp.pucp.edu.pe/v1)

/**
 * Obtiene los KPIs y métricas agregadas del museo para el Dashboard
 */
async function getKPIs() {
  if (!API_BASE_URL) {
    return Promise.resolve({
      kpis: MOCK.kpis,
      distribucion: MOCK.distribucionColecciones,
      cargasRecientes: MOCK.cargasRecientes,
      alertas: MOCK.alertasInventario
    });
  }
  // TODO(backend): Conectar con GET /api/v1/dashboard/metricas
  const r = await fetch(`${API_BASE_URL}/dashboard/metricas`);
  return r.json();
}

/**
 * M1: Obtiene el listado de piezas con soporte para filtros multicriterio
 * @param {Object} filtros - { q, coleccion, estado, regimen }
 */
async function getPiezas(filtros = {}) {
  if (!API_BASE_URL) {
    let resultado = [...MOCK.piezas];
    if (filtros.q) {
      const qLower = filtros.q.toLowerCase().trim();
      resultado = resultado.filter(p =>
        p.denominacion.toLowerCase().includes(qLower) ||
        p.codigoI.toLowerCase().includes(qLower) ||
        (p.autor && p.autor.toLowerCase().includes(qLower)) ||
        p.coleccion.toLowerCase().includes(qLower) ||
        (p.procedencia && p.procedencia.toLowerCase().includes(qLower))
      );
    }
    if (filtros.coleccion && filtros.coleccion !== "todas") {
      resultado = resultado.filter(p => p.coleccion === filtros.coleccion);
    }
    if (filtros.estado && filtros.estado !== "todos") {
      resultado = resultado.filter(p => p.estadoTipo === filtros.estado);
    }
    if (filtros.regimen && filtros.regimen !== "todos") {
      resultado = resultado.filter(p => p.regimen.toLowerCase().includes(filtros.regimen.toLowerCase()));
    }
    return Promise.resolve(resultado);
  }
  // TODO(backend): Conectar con GET /api/v1/piezas?query_params
  const query = new URLSearchParams(filtros).toString();
  const r = await fetch(`${API_BASE_URL}/piezas?${query}`);
  return r.json();
}

/**
 * M1: Obtiene el detalle completo de una pieza por su ID
 * @param {string} id
 */
async function getPieza(id) {
  if (!API_BASE_URL) {
    const pieza = MOCK.piezas.find(p => p.id === id) || MOCK.piezas[0];
    return Promise.resolve(pieza);
  }
  // TODO(backend): Conectar con GET /api/v1/piezas/:id
  const r = await fetch(`${API_BASE_URL}/piezas/${id}`);
  return r.json();
}

/**
 * M1: Guarda o actualiza una pieza en el catálogo
 * @param {Object} piezaData
 */
async function savePieza(piezaData) {
  if (!API_BASE_URL) {
    let existente = MOCK.piezas.find(p => p.id === piezaData.id);
    if (existente) {
      Object.assign(existente, piezaData);
    } else {
      const nuevaPieza = {
        ...piezaData,
        id: `p-${Date.now()}`,
        estado: piezaData.estado || "Completa",
        estadoTipo: piezaData.estadoTipo || "completa",
        fotos: piezaData.fotos || []
      };
      MOCK.piezas.unshift(nuevaPieza);
    }
    return Promise.resolve({ ok: true, mensaje: "Pieza guardada exitosamente en el catálogo museográfico" });
  }
  // TODO(backend): Conectar con POST /api/v1/piezas o PUT /api/v1/piezas/:id
  const method = piezaData.id ? "PUT" : "POST";
  const url = piezaData.id ? `${API_BASE_URL}/piezas/${piezaData.id}` : `${API_BASE_URL}/piezas`;
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(piezaData)
  });
  return r.json();
}

/**
 * M1: Obtiene la lista de colecciones y fondos
 */
async function getColecciones() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.colecciones);
  }
  // TODO(backend): Conectar con GET /api/v1/colecciones
  const r = await fetch(`${API_BASE_URL}/colecciones`);
  return r.json();
}

/**
 * M1: Guarda o actualiza una colección del museo
 * @param {Object} coleccionData
 */
async function saveColeccion(coleccionData) {
  if (!API_BASE_URL) {
    let existente = MOCK.colecciones.find(c => c.id === coleccionData.id);
    if (existente) {
      Object.assign(existente, coleccionData);
    } else {
      const nueva = {
        ...coleccionData,
        id: `col-${Date.now()}`,
        piezas: coleccionData.piezas || 0,
        porcentajeDigital: coleccionData.porcentajeDigital || 0,
        estado: "Activa"
      };
      MOCK.colecciones.push(nueva);
    }
    return Promise.resolve({ ok: true, mensaje: "Colección guardada satisfactoriamente" });
  }
  // TODO(backend): Conectar con POST /api/v1/colecciones o PUT /api/v1/colecciones/:id
  const method = coleccionData.id ? "PUT" : "POST";
  const url = coleccionData.id ? `${API_BASE_URL}/colecciones/${coleccionData.id}` : `${API_BASE_URL}/colecciones`;
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coleccionData)
  });
  return r.json();
}

/**
 * M2: Obtiene los tesauros y vocabularios controlados
 * @param {string} categoria - tiposBien, materiales, procedencias, regimenes, estadosConservacion
 */
async function getTesauros(categoria = null) {
  if (!API_BASE_URL) {
    if (categoria && MOCK.tesauros[categoria]) {
      return Promise.resolve(MOCK.tesauros[categoria]);
    }
    return Promise.resolve(MOCK.tesauros);
  }
  // TODO(backend): Conectar con GET /api/v1/tesauros?categoria=...
  const url = categoria ? `${API_BASE_URL}/tesauros?categoria=${categoria}` : `${API_BASE_URL}/tesauros`;
  const r = await fetch(url);
  return r.json();
}

/**
 * M2: Guarda un nuevo término de tesauro o actualiza uno existente
 * @param {string} categoria
 * @param {Object} terminoData
 */
async function saveTerminoTesauro(categoria, terminoData) {
  if (!API_BASE_URL) {
    if (!MOCK.tesauros[categoria]) MOCK.tesauros[categoria] = [];
    let existente = MOCK.tesauros[categoria].find(t => t.id === terminoData.id);
    if (existente) {
      Object.assign(existente, terminoData);
    } else {
      const nuevo = {
        ...terminoData,
        id: `voc-${Date.now()}`,
        piezas: 0,
        estado: "Activo"
      };
      MOCK.tesauros[categoria].unshift(nuevo);
    }
    return Promise.resolve({ ok: true, mensaje: "Término de tesauro guardado exitosamente" });
  }
  // TODO(backend): Conectar con POST /api/v1/tesauros/:categoria
  const r = await fetch(`${API_BASE_URL}/tesauros/${categoria}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(terminoData)
  });
  return r.json();
}

/**
 * M2: Normaliza o fusiona dos términos de tesauro
 * @param {string} categoria
 * @param {string} terminoOrigenId
 * @param {string} terminoDestinoId
 */
async function normalizarTerminos(categoria, terminoOrigenId, terminoDestinoId) {
  if (!API_BASE_URL) {
    const origen = MOCK.tesauros[categoria]?.find(t => t.id === terminoOrigenId);
    const destino = MOCK.tesauros[categoria]?.find(t => t.id === terminoDestinoId);
    if (origen && destino) {
      destino.piezas = (destino.piezas || 0) + (origen.piezas || 0);
      destino.sinonimos = destino.sinonimos ? `${destino.sinonimos}, ${origen.termino}` : origen.termino;
      origen.estado = "Fusionado / Inactivo";
    }
    return Promise.resolve({ ok: true, mensaje: `Términos normalizados exitosamente bajo: ${destino?.termino}` });
  }
  // TODO(backend): Conectar con POST /api/v1/tesauros/normalizar
  const r = await fetch(`${API_BASE_URL}/tesauros/normalizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoria, terminoOrigenId, terminoDestinoId })
  });
  return r.json();
}

/**
 * M3: Obtiene el árbol jerárquico de sedes y depósitos
 */
async function getArbolUbicaciones() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.arbolUbicaciones);
  }
  // TODO(backend): Conectar con GET /api/v1/ubicaciones/arbol
  const r = await fetch(`${API_BASE_URL}/ubicaciones/arbol`);
  return r.json();
}

/**
 * M3: Obtiene los movimientos recientes de piezas
 */
async function getMovimientosRecientes() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.movimientosRecientes);
  }
  // TODO(backend): Conectar con GET /api/v1/ubicaciones/movimientos
  const r = await fetch(`${API_BASE_URL}/ubicaciones/movimientos`);
  return r.json();
}

/**
 * M3: Registra un nuevo movimiento de custodia física
 * @param {Object} movimiento
 */
async function registrarMovimiento(movimiento) {
  if (!API_BASE_URL) {
    MOCK.movimientosRecientes.unshift({
      fecha: "Hoy, recién",
      pieza: movimiento.pieza || "I-03566 · Procesión Corpus Christi",
      origen: movimiento.origen || "Depósito 1",
      destino: movimiento.destino || "Sala Temporal",
      responsable: MOCK.curador.nombre,
      motivo: movimiento.motivo || "Rotación de exhibición"
    });
    // Registrar también en auditoría
    MOCK.auditoriaCambios.unshift({
      fecha: "Hoy, recién",
      usuario: MOCK.curador.nombre,
      accion: "Movimiento de Custodia",
      anterior: movimiento.origen,
      nuevo: movimiento.destino,
      pieza: movimiento.pieza
    });
    return Promise.resolve({ ok: true, mensaje: "Movimiento registrado y asentado en bitácora de custodia" });
  }
  // TODO(backend): Conectar con POST /api/v1/ubicaciones/movimientos
  const r = await fetch(`${API_BASE_URL}/ubicaciones/movimientos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(movimiento)
  });
  return r.json();
}

/**
 * M4: Obtiene el estado y datos del lote de importación de Excel actual
 */
async function getImportacionActual() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.importacionActual);
  }
  // TODO(backend): Conectar con GET /api/v1/importaciones/lote-activo
  const r = await fetch(`${API_BASE_URL}/importaciones/lote-activo`);
  return r.json();
}

/**
 * M4: Obtiene los resultados de la validación contra tesauros controlados
 */
async function getValidacionTesauros() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.importacionActual.validacionTesauros || []);
  }
  // TODO(backend): Conectar con GET /api/v1/importaciones/validacion-tesauros
  const r = await fetch(`${API_BASE_URL}/importaciones/validacion-tesauros`);
  return r.json();
}

/**
 * M4: Aprueba el lote de importación y fusiona los registros
 * @param {string} loteId
 */
async function aprobarImportacion(loteId) {
  if (!API_BASE_URL) {
    MOCK.importacionActual.resumen.nuevos = 0;
    MOCK.importacionActual.resumen.actualizaciones = 0;
    MOCK.cargasRecientes.unshift({
      id: `IMP-${Date.now()}`,
      archivo: MOCK.importacionActual.archivo,
      fecha: "Hoy, recién",
      filas: MOCK.importacionActual.totalFilas,
      usuario: MOCK.curador.nombre,
      estado: "Aprobada",
      tipoEstado: "aprobada"
    });
    return Promise.resolve({ ok: true, mensaje: "Lote aprobado e incorporado al inventario con éxito" });
  }
  // TODO(backend): Conectar con POST /api/v1/importaciones/:id/aprobar
  const r = await fetch(`${API_BASE_URL}/importaciones/${loteId}/aprobar`, { method: "POST" });
  return r.json();
}

/**
 * M4: Obtiene la bitácora de importaciones históricas
 */
async function getBitacoraImportaciones() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.bitacoraImportaciones);
  }
  // TODO(backend): Conectar con GET /api/v1/importaciones/bitacora
  const r = await fetch(`${API_BASE_URL}/importaciones/bitacora`);
  return r.json();
}

/**
 * M5: Obtiene la lista de reportes disponibles
 */
async function getReportes() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.reportes);
  }
  // TODO(backend): Conectar con GET /api/v1/reportes
  const r = await fetch(`${API_BASE_URL}/reportes`);
  return r.json();
}

/**
 * Obtiene el usuario actual autenticado en el sistema (curador)
 */
async function getUsuarioActual() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.curador);
  }
  // TODO(backend): Conectar con GET /api/v1/auth/me o /api/v1/usuarios/actual
  const r = await fetch(`${API_BASE_URL}/auth/me`);
  return r.json();
}

/**
 * M6: Obtiene los usuarios del sistema, matriz de permisos y auditoría
 */
async function getUsuarios() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.usuarios);
  }
  // TODO(backend): Conectar con GET /api/v1/usuarios
  const r = await fetch(`${API_BASE_URL}/usuarios`);
  return r.json();
}

async function getPermisos() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.permisos);
  }
  // TODO(backend): Conectar con GET /api/v1/roles/permisos
  const r = await fetch(`${API_BASE_URL}/roles/permisos`);
  return r.json();
}

async function getAuditoria() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.auditoriaCambios);
  }
  // TODO(backend): Conectar con GET /api/v1/auditoria
  const r = await fetch(`${API_BASE_URL}/auditoria`);
  return r.json();
}

/**
 * M7: Obtiene la configuración parametrizable del sistema
 */
async function getConfiguracion() {
  if (!API_BASE_URL) {
    return Promise.resolve(MOCK.configuracion);
  }
  // TODO(backend): Conectar con GET /api/v1/configuracion
  const r = await fetch(`${API_BASE_URL}/configuracion`);
  return r.json();
}

/**
 * M7: Guarda la configuración del sistema
 * @param {Object} configData
 */
async function saveConfiguracion(configData) {
  if (!API_BASE_URL) {
    Object.assign(MOCK.configuracion, configData);
    return Promise.resolve({ ok: true, mensaje: "Parámetros de configuración actualizados correctamente" });
  }
  // TODO(backend): Conectar con PUT /api/v1/configuracion
  const r = await fetch(`${API_BASE_URL}/configuracion`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configData)
  });
  return r.json();
}

if (typeof window !== "undefined") {
  window.API = {
    getKPIs,
    getUsuarioActual,
    getPiezas,
    getPieza,
    savePieza,
    getColecciones,
    saveColeccion,
    getTesauros,
    saveTerminoTesauro,
    normalizarTerminos,
    getArbolUbicaciones,
    getMovimientosRecientes,
    registrarMovimiento,
    getImportacionActual,
    getValidacionTesauros,
    aprobarImportacion,
    getBitacoraImportaciones,
    getReportes,
    getUsuarios,
    getPermisos,
    getAuditoria,
    getConfiguracion,
    saveConfiguracion
  };
}
