/**
 * ══════════════════════════════════════════════════════════════
 * js/app.js — Enrutador, Controladores de Pantalla e Interactividad
 * Sistema de Gestión de Colecciones MATP - PUCP
 * Versión 2 — Catálogo Consolidado (M1 a M7)
 * ══════════════════════════════════════════════════════════════
 */

const App = {
  currentScreen: "dashboard",
  currentPieceId: "p-001",
  activeFichaTab: "identificacion",
  activeFotoIndex: 0,
  activeImportStep: "archivo",
  activeImportTab: "asistente",
  activeTesauroCat: "tiposBien",
  filtrosCatalogo: { q: "", coleccion: "todas", estado: "todos", regimen: "todos" },
  mostrarPanelFiltros: false,
  nodoUbicacionSeleccionado: "Caja 1 (Colección MMZ)",

  /**
   * Inicialización de la aplicación
   */
  async init() {
    window.addEventListener("hashchange", () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        App.navigateTo(hash, false);
      }
    });

    const initialHash = window.location.hash.replace("#", "");
    if (initialHash) {
      await App.navigateTo(initialHash, false);
    } else {
      await App.navigateTo("dashboard", false);
    }
  },

  /**
   * Enrutador central entre las pantallas del sistema
   */
  async navigateTo(screenId, updateHash = true) {
    App.currentScreen = screenId;
    if (updateHash) {
      window.location.hash = screenId;
    }

    const appContainer = document.getElementById("app-container");
    if (!appContainer) return;

    if (screenId === "login") {
      appContainer.innerHTML = App.renderPantallaLogin();
      return;
    }

    const breadcrumbMap = {
      dashboard: "Panel de Control y Métricas",
      catalogo: "Piezas (Catálogo Museográfico)",
      ficha: "Ficha Técnica Museográfica",
      registro: "Catalogación de Pieza",
      colecciones: "Colecciones y Fondos",
      tesauros: "Tesauros y Vocabularios Controlados",
      ubicacion: "Ubicaciones y Control Físico",
      importar: "Importación y Calidad de Datos",
      reportes: "Módulo de Reportes e Inventarios",
      usuarios: "Usuarios, Roles y Seguridad",
      configuracion: "Configuración del Sistema"
    };

    const breadcrumb = breadcrumbMap[screenId] || "Panel General";
    const mostrarBusqueda = screenId === "dashboard" || screenId === "ficha";

    appContainer.innerHTML = `
      <div class="flex h-screen w-screen overflow-hidden bg-[#F5F0DA]">
        <!-- Sidebar Fijo (240px) -->
        ${Components.renderSidebar(screenId)}

        <!-- Columna de Contenido Principal con Topbar -->
        <div class="flex-1 flex flex-col min-w-0 overflow-y-auto">
          ${Components.renderTopbar(breadcrumb, "", mostrarBusqueda)}

          <main class="flex-1 p-6 max-w-7xl w-full mx-auto" id="screen-content">
            <div class="flex items-center justify-center p-12 text-[#5B534C] text-sm">
              <span class="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Cargando información del catálogo...
            </div>
          </main>
        </div>
      </div>
      <!-- Contenedor de Modales Globales -->
      <div id="modal-container"></div>
    `;

    const contentEl = document.getElementById("screen-content");
    if (!contentEl) return;

    try {
      if (screenId === "dashboard") {
        contentEl.innerHTML = await App.renderDashboard();
      } else if (screenId === "catalogo") {
        contentEl.innerHTML = await App.renderCatalogo();
      } else if (screenId === "ficha") {
        contentEl.innerHTML = await App.renderFicha();
      } else if (screenId === "registro") {
        contentEl.innerHTML = await App.renderRegistro();
      } else if (screenId === "colecciones") {
        contentEl.innerHTML = await App.renderColecciones();
      } else if (screenId === "tesauros") {
        contentEl.innerHTML = await App.renderTesauros();
      } else if (screenId === "ubicacion") {
        contentEl.innerHTML = await App.renderUbicacion();
      } else if (screenId === "importar") {
        contentEl.innerHTML = await App.renderImportar();
      } else if (screenId === "reportes") {
        contentEl.innerHTML = await App.renderReportes();
      } else if (screenId === "usuarios") {
        contentEl.innerHTML = await App.renderUsuarios();
      } else if (screenId === "configuracion") {
        contentEl.innerHTML = await App.renderConfiguracion();
      }
    } catch (err) {
      console.error("Error al renderizar pantalla:", err);
      contentEl.innerHTML = `
        <div class="matp-card p-6 text-center text-[#DA2A4E]">
          <span class="material-symbols-outlined text-4xl mb-2">warning</span>
          <p class="font-semibold text-sm">Ocurrió un error al cargar la vista</p>
          <p class="text-xs text-[#5B534C] mt-1">${err.message || err}</p>
        </div>
      `;
    }
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (1): LOGIN (RF-50) — Acceso interno sin registro público
  // ══════════════════════════════════════════════════════════════
  renderPantallaLogin() {
    return `
      <div class="min-h-screen bg-[#F5F0DA] flex flex-col justify-center items-center p-4 relative greca-decorativa">
        <!-- Tarjeta de Login Centrada -->
        <div class="matp-card w-full max-w-md p-8 shadow-xl relative z-10 border border-[#E3DECB]">
          <!-- Logo Oficial MATP: Círculo terracota con siglas MATP en blanco -->
          <div class="flex flex-col items-center text-center mb-6">
            <div class="w-16 h-16 rounded-full bg-[#A23C16] flex items-center justify-center font-bold text-white text-xl tracking-wider shadow-md mb-3 ring-4 ring-[#F0DAD0]">
              MATP
            </div>
            <h1 class="text-xl font-bold font-heading text-[#0C0F14] tracking-tight">MATP – PUCP</h1>
            <p class="text-xs text-[#5B534C] font-medium mt-1">
              Museo de Artes y Tradiciones Populares "Luis Repetto Málaga"
            </p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F0DAD0] text-[#A23C16] text-[11px] font-semibold rounded-full mt-3">
              <span class="material-symbols-outlined text-[14px]">lock</span>
              Sistema de Uso Interno Institucional
            </div>
          </div>

          <!-- Formulario de Acceso con Credenciales PUCP -->
          <form onsubmit="event.preventDefault(); App.navigateTo('dashboard');" class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Correo Institucional PUCP
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5B534C] text-[18px]">mail</span>
                <input
                  type="email"
                  required
                  value="gmejia@pucp.edu.pe"
                  class="input-matp pl-10"
                  placeholder="usuario@pucp.edu.pe"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Contraseña
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5B534C] text-[18px]">key</span>
                <input
                  type="password"
                  required
                  value="••••••••••••"
                  class="input-matp pl-10"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div class="p-3 bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px] text-[11px] text-[#5B534C] flex items-start gap-2">
              <span class="material-symbols-outlined text-[#C8791E] text-[16px] shrink-0 mt-0.5">info</span>
              <span>Acceso restringido exclusivamente a curadores, catalogadores y personal autorizado del MATP. No existe autoregistro público.</span>
            </div>

            <button type="submit" class="btn-primario w-full py-2.5 mt-2 justify-center">
              <span class="material-symbols-outlined text-[18px]">login</span>
              <span>Iniciar Sesión en el Sistema</span>
            </button>
          </form>

          <!-- Pie de página institucional -->
          <div class="mt-6 pt-4 border-t border-[#E3DECB] text-center text-[10px] text-[#5B534C]">
            Pontificia Universidad Católica del Perú · Jr. Camaná 459, Lima
          </div>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (2): DASHBOARD — Indicadores y Estado General
  // ══════════════════════════════════════════════════════════════
  async renderDashboard() {
    const [data, usuario] = await Promise.all([API.getKPIs(), API.getUsuarioActual()]);
    const { kpis, distribucion, cargasRecientes, alertas } = data;

    const cardsHtml = `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        ${Components.renderKpiCard("Total piezas catalogadas", kpis.totalPiezas.toLocaleString(), "Patrimonio total registrado", "inventory_2", "terracota", "App.navigateTo('catalogo')")}
        ${Components.renderKpiCard("% Fichas completas", `${kpis.completitudPorcentaje}%`, `${kpis.piezasCompletas.toLocaleString()} piezas con ficha íntegra`, "task_alt", "verde")}
        ${Components.renderKpiCard("Sin código I", kpis.sinCodigoI.toLocaleString(), "Pendientes / Comodato", "tag", "ambar", "App.filtrosCatalogo.estado='sin-codigo'; App.navigateTo('catalogo')")}
        ${Components.renderKpiCard("Sin fotografía", kpis.sinFoto.toLocaleString(), "Requiere registro visual", "photo_library", "ambar", "App.filtrosCatalogo.estado='sin-foto'; App.navigateTo('catalogo')")}
        ${Components.renderKpiCard("Sin ubicación", kpis.sinUbicacion.toLocaleString(), "Por asignar depósito", "location_on", "carmin", "App.filtrosCatalogo.estado='sin-ubicacion'; App.navigateTo('catalogo')")}
      </div>
    `;

    const distribucionHtml = distribucion.map(d => `
      <div class="space-y-1.5 cursor-pointer hover:bg-[#FAF7EE] p-2 rounded transition-colors" onclick="App.filtrosCatalogo.coleccion='${d.clave}'; App.navigateTo('catalogo');">
        <div class="flex items-center justify-between text-xs font-medium">
          <span class="text-[#0C0F14] hover:text-[#A23C16] font-medium">${d.nombre}</span>
          <span class="text-[#5B534C] font-mono">${d.total.toLocaleString()} piezas (${d.porcentaje}%)</span>
        </div>
        <div class="w-full bg-[#E3DECB] rounded-full h-2 overflow-hidden">
          <div class="bg-[#A23C16] h-2 rounded-full" style="width: ${d.porcentaje}%;"></div>
        </div>
      </div>
    `).join("");

    const cargasHtml = cargasRecientes.map(c => `
      <div class="flex items-center justify-between py-2.5 px-1 hover:bg-[#FAF7EE] transition-colors gap-3 rounded-[4px]">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-8 h-8 rounded bg-[#F0DAD0] text-[#A23C16] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[18px]">description</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-[#0C0F14] truncate" title="${c.archivo}">${c.archivo}</p>
            <p class="text-[11px] text-[#5B534C] truncate">${c.fecha} · ${c.filas} piezas · ${c.usuario}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${Components.renderChipEstado(c.estado, c.tipoEstado)}
          <button onclick="App.navigateTo('importar')" class="btn-texto py-1 px-1.5 text-xs shrink-0" title="Ver lote de importación">
            <span class="material-symbols-outlined text-[16px]">visibility</span>
          </button>
        </div>
      </div>
    `).join("");

    const alertasHtml = alertas.map(a => `
      <div class="flex items-center justify-between py-2.5 px-1 hover:bg-[#FAF7EE] transition-colors gap-3 rounded-[4px]">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <span class="material-symbols-outlined text-[#C8791E] text-[18px] shrink-0">warning</span>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-[#0C0F14] truncate" title="${a.denominacion}">${a.denominacion}</p>
            <p class="text-[11px] text-[#5B534C] font-mono truncate">${a.codigo} · Problema: <strong class="text-[#0C0F14]">${a.problema}</strong></p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${Components.renderBadgePrioridad(a.prioridad)}
          <button onclick="App.currentPieceId='${a.id}'; App.navigateTo('ficha')" class="btn-secundario py-1 px-2.5 text-xs shrink-0">
            <span class="material-symbols-outlined text-[14px]">edit</span>
            <span>Resolver</span>
          </button>
        </div>
      </div>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado con bienvenida y acciones rápidas -->
        <div class="matp-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-l-4 border-l-[#A23C16]">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Museo de Artes y Tradiciones Populares · PUCP</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14] mt-0.5">Bienvenida, ${usuario.nombre}</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Catálogo general: <strong>${kpis.totalPiezas.toLocaleString()} piezas</strong> registradas. Estado de completitud: <strong>${kpis.completitudPorcentaje}%</strong> con ficha digital íntegra.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="App.navigateTo('registro')" class="btn-primario">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>Registrar Pieza</span>
            </button>
            <button onclick="App.navigateTo('importar')" class="btn-secundario">
              <span class="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Importar Excel</span>
            </button>
            <button onclick="App.navigateTo('reportes')" class="btn-texto">
              <span class="material-symbols-outlined text-[18px]">assessment</span>
              <span>Reportes</span>
            </button>
          </div>
        </div>

        <!-- Indicadores KPI Clave -->
        ${cardsHtml}

        <!-- Gráficos y Listas de Control -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Columna 1: Distribución por Fondos y Colecciones -->
          <div class="matp-card p-5 space-y-4 min-w-0">
            <div class="flex items-center justify-between border-b border-[#E3DECB] pb-3">
              <h3 class="text-sm font-semibold font-heading text-[#0C0F14] flex items-center gap-2">
                <span class="material-symbols-outlined text-[#A23C16] text-[18px]">collections_bookmark</span>
                Distribución por Colección
              </h3>
              <button onclick="App.navigateTo('colecciones')" class="text-xs text-[#A23C16] hover:underline font-medium shrink-0">
                Gestionar fondos
              </button>
            </div>
            <div class="space-y-3 pt-1">
              ${distribucionHtml}
            </div>
          </div>

          <!-- Columna 2: Cargas Recientes de Excel -->
          <div class="matp-card p-5 space-y-3 min-w-0">
            <div class="flex items-center justify-between border-b border-[#E3DECB] pb-3">
              <h3 class="text-sm font-semibold font-heading text-[#0C0F14] flex items-center gap-2">
                <span class="material-symbols-outlined text-[#A23C16] text-[18px]">upload_file</span>
                Cargas Recientes de Excel
              </h3>
              <button onclick="App.navigateTo('importar')" class="text-xs text-[#A23C16] hover:underline font-medium shrink-0">
                Ver historial
              </button>
            </div>
            <div class="divide-y divide-[#E3DECB]">
              ${cargasHtml}
            </div>
          </div>

          <!-- Columna 3: Alertas Prioritarias de Calidad -->
          <div class="matp-card p-5 space-y-3 min-w-0">
            <div class="flex items-center justify-between border-b border-[#E3DECB] pb-3">
              <h3 class="text-sm font-semibold font-heading text-[#0C0F14] flex items-center gap-2">
                <span class="material-symbols-outlined text-[#C8791E] text-[18px]">warning</span>
                Alertas de Información Incompleta
              </h3>
              <span class="chip chip-incompleta text-[10px] shrink-0">Prioridad alta</span>
            </div>
            <div class="divide-y divide-[#E3DECB]">
              ${alertasHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (3): CATÁLOGO DE PIEZAS (M1) — Listado y Filtros
  // ══════════════════════════════════════════════════════════════
  async renderCatalogo() {
    const piezas = await API.getPiezas(App.filtrosCatalogo);

    const filasHtml = piezas.map(p => {
      const tieneFoto = p.fotos && p.fotos.length > 0;
      const fotoUrl = tieneFoto ? p.fotos[0].url : "";
      const thumbHtml = tieneFoto
        ? `<img src="${fotoUrl}" alt="${p.denominacion}" class="w-10 h-10 object-cover rounded-[4px] border border-[#E3DECB] shrink-0" />`
        : `<div class="w-10 h-10 rounded-[4px] bg-[#FAF7EE] border border-[#E3DECB] flex items-center justify-center text-[#5B534C] shrink-0">
             <span class="material-symbols-outlined text-[18px]">photo_camera</span>
           </div>`;

      return `
        <tr>
          <td class="text-center w-12">${thumbHtml}</td>
          <td class="font-mono font-medium text-xs text-[#0C0F14]">
            ${p.tieneCodigoI ? `<span class="px-1.5 py-0.5 bg-[#F0DAD0] text-[#A23C16] rounded font-bold">${p.codigoI}</span>` : `<span class="text-[#5B534C] italic font-normal">Sin Código I</span>`}
          </td>
          <td>
            <a href="javascript:void(0)" onclick="App.currentPieceId='${p.id}'; App.navigateTo('ficha')" class="font-medium text-xs text-[#0C0F14] hover:text-[#A23C16] line-clamp-1">
              ${p.denominacion}
            </a>
            <p class="text-[11px] text-[#5B534C]">${p.autor || "Autor no identificado"} · ${p.procedencia || "Procedencia no registrada"}</p>
          </td>
          <td class="text-xs text-[#5B534C]">${p.coleccion}</td>
          <td class="text-xs text-[#5B534C]">${p.regimen}</td>
          <td>${Components.renderChipEstado(p.estado, p.estadoTipo)}</td>
          <td class="text-xs text-[#5B534C] font-mono text-[11px]">${p.ubicacion}</td>
          <td class="text-right whitespace-nowrap">
            <button onclick="App.currentPieceId='${p.id}'; App.navigateTo('ficha')" class="btn-texto py-1 px-2 text-xs" title="Ver ficha técnica">
              <span class="material-symbols-outlined text-[16px]">visibility</span>
            </button>
            <button onclick="App.currentPieceId='${p.id}'; App.navigateTo('registro')" class="btn-texto py-1 px-2 text-xs" title="Editar catalogación">
              <span class="material-symbols-outlined text-[16px]">edit</span>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="space-y-4 animate-fade-in">
        <!-- Barra de Búsqueda y Filtros Multicriterio -->
        <div class="matp-card p-4 space-y-3">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <!-- Buscador -->
            <div class="relative flex-1">
              <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5B534C] text-[18px]">search</span>
              <input
                type="text"
                placeholder="Buscar por código I, denominación, autor, técnica o procedencia..."
                value="${App.filtrosCatalogo.q || ""}"
                oninput="App.filtrosCatalogo.q=this.value; App.navigateTo('catalogo', false)"
                class="input-matp pl-10"
              />
            </div>

            <!-- Botones de Acción -->
            <div class="flex items-center gap-2 shrink-0">
              <button onclick="App.navigateTo('registro')" class="btn-primario text-xs">
                <span class="material-symbols-outlined text-[16px]">add</span>
                <span>Nueva Pieza</span>
              </button>
              <button onclick="Components.showToast('Catálogo filtrado exportado a Excel (XLSX) exitosamente', 'exito')" class="btn-secundario text-xs">
                <span class="material-symbols-outlined text-[16px]">download</span>
                <span>Exportar</span>
              </button>
            </div>
          </div>

          <!-- Dropdowns de Filtrado Cruzado -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-[#E3DECB]">
            <div>
              <label class="block text-[11px] font-semibold text-[#5B534C] mb-1">Colección / Fondo</label>
              <select
                onchange="App.filtrosCatalogo.coleccion=this.value; App.navigateTo('catalogo', false)"
                class="input-matp text-xs py-1.5"
              >
                <option value="todas" ${App.filtrosCatalogo.coleccion === "todas" ? "selected" : ""}>Todas las colecciones</option>
                <option value="AJB" ${App.filtrosCatalogo.coleccion === "AJB" ? "selected" : ""}>Colección Arturo Jiménez Borja (AJB)</option>
                <option value="MMZ" ${App.filtrosCatalogo.coleccion === "MMZ" ? "selected" : ""}>Colección Mildred Merino de Zela (MMZ)</option>
                <option value="FJT" ${App.filtrosCatalogo.coleccion === "FJT" ? "selected" : ""}>Colección Florentino Jiménez Toma</option>
                <option value="GERSOL" ${App.filtrosCatalogo.coleccion === "GERSOL" ? "selected" : ""}>Colección Gertrud Bramberger de Solari</option>
                <option value="MBV" ${App.filtrosCatalogo.coleccion === "MBV" ? "selected" : ""}>Colección Mariano Benites Villanueva</option>
                <option value="DGP" ${App.filtrosCatalogo.coleccion === "DGP" ? "selected" : ""}>Colección Doris Gibson Parra</option>
                <option value="ACG" ${App.filtrosCatalogo.coleccion === "ACG" ? "selected" : ""}>Colección Alfonso Cabrera Ganoza</option>
                <option value="RAB" ${App.filtrosCatalogo.coleccion === "RAB" ? "selected" : ""}>Colección Raúl Apesteguía Bresciani</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-[#5B534C] mb-1">Estado de Catalogación</label>
              <select
                onchange="App.filtrosCatalogo.estado=this.value; App.navigateTo('catalogo', false)"
                class="input-matp text-xs py-1.5"
              >
                <option value="todos" ${App.filtrosCatalogo.estado === "todos" ? "selected" : ""}>Todos los estados</option>
                <option value="completa" ${App.filtrosCatalogo.estado === "completa" ? "selected" : ""}>Ficha Completa</option>
                <option value="sin-codigo" ${App.filtrosCatalogo.estado === "sin-codigo" ? "selected" : ""}>Sin Código I</option>
                <option value="sin-foto" ${App.filtrosCatalogo.estado === "sin-foto" ? "selected" : ""}>Sin Fotografía</option>
                <option value="sin-ubicacion" ${App.filtrosCatalogo.estado === "sin-ubicacion" ? "selected" : ""}>Sin Ubicación</option>
              </select>
            </div>

            <div>
              <label class="block text-[11px] font-semibold text-[#5B534C] mb-1">Régimen de Tenencia</label>
              <select
                onchange="App.filtrosCatalogo.regimen=this.value; App.navigateTo('catalogo', false)"
                class="input-matp text-xs py-1.5"
              >
                <option value="todos" ${App.filtrosCatalogo.regimen === "todos" ? "selected" : ""}>Todos los regímenes</option>
                <option value="Propiedad" ${App.filtrosCatalogo.regimen === "Propiedad" ? "selected" : ""}>Propiedad definitiva (PUCP)</option>
                <option value="Comodato" ${App.filtrosCatalogo.regimen === "Comodato" ? "selected" : ""}>Comodato familiar / institucional</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tabla de Piezas -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] flex items-center justify-between bg-[#FAF7EE]">
            <span class="text-xs font-semibold text-[#0C0F14]">
              Mostrando <strong class="text-[#A23C16]">${piezas.length}</strong> piezas patrimoniales
            </span>
            <div class="text-[11px] text-[#5B534C] flex items-center gap-2">
              <span class="material-symbols-outlined text-[16px]">info</span>
              Filas alternadas en paleta institucional
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th class="w-12 text-center">Foto</th>
                  <th>Código I</th>
                  <th>Denominación / Autor</th>
                  <th>Colección</th>
                  <th>Régimen</th>
                  <th>Estado</th>
                  <th>Ubicación</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${filasHtml.length > 0 ? filasHtml : `
                  <tr>
                    <td colspan="8" class="text-center py-8 text-[#5B534C] text-xs">
                      No se encontraron piezas con los filtros aplicados.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (4): FICHA TÉCNICA MUSEOGRÁFICA (M1) — formato tipo SURDOC
  // ══════════════════════════════════════════════════════════════
  async renderFicha() {
    const pieza = await API.getPieza(App.currentPieceId);
    const fotos = pieza.fotos || [];
    const fotoPrincipal = fotos[App.activeFotoIndex] || fotos[0] || {
      url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
      vista: "Frontal"
    };

    const colecciones = await API.getColecciones();
    const coleccionInfo = colecciones.find(c => c.clave === pieza.coleccion);
    const coleccionNombre = coleccionInfo ? coleccionInfo.nombre : pieza.coleccion;

    const codigoColeccionEntry = (pieza.codigos || []).find(c => c.tipo === "Código de Colección");
    const codigoColeccion = codigoColeccionEntry ? codigoColeccionEntry.valor : "—";

    const fotosThumbsHtml = fotos.map((f, idx) => `
      <button
        onclick="App.activeFotoIndex=${idx}; App.navigateTo('ficha', false)"
        class="relative rounded-[4px] overflow-hidden border-2 transition-all shrink-0 ${App.activeFotoIndex === idx ? "border-[#A23C16] shadow-sm" : "border-[#E3DECB] opacity-70 hover:opacity-100"}"
      >
        <img src="${f.url}" alt="${f.vista}" class="w-14 h-14 object-cover" />
        <span class="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[8px] py-0.5 px-1 truncate text-center">
          ${f.vista}
        </span>
      </button>
    `).join("");

    const registradoresHtml = (pieza.historial && pieza.historial.length > 0)
      ? pieza.historial.map(h => `
          <div class="text-xs text-[#0C0F14] py-1.5 border-b border-[#E3DECB] last:border-b-0">
            <strong>${h.usuario}</strong><span class="text-[#5B534C]"> — ${h.fecha} · ${h.accion}</span>
          </div>
        `).join("")
      : `<div class="text-xs text-[#0C0F14] py-1.5">${pieza.registrador || "Sin registradores consignados"}</div>`;

    const relacionadas = (await API.getPiezas({ coleccion: pieza.coleccion }))
      .filter(p => p.id !== pieza.id)
      .slice(0, 3);
    const relacionadasHtml = relacionadas.map(p => `
      <div class="matp-card overflow-hidden">
        <button onclick="App.currentPieceId='${p.id}'; App.navigateTo('ficha')" class="block w-full text-left">
          <img src="${(p.fotos && p.fotos[0] && p.fotos[0].url) || fotoPrincipal.url}" alt="${p.denominacion}" class="w-full h-28 object-cover" />
          <div class="p-3">
            <span class="text-[10px] font-mono font-bold text-[#A23C16]">${p.codigoI && p.codigoI !== "—" ? p.codigoI : "Sin Código I"}</span>
            <p class="text-xs font-semibold text-[#0C0F14] line-clamp-2 mt-0.5">${p.denominacion}</p>
            <p class="text-[11px] text-[#5B534C] mt-0.5">${coleccionNombre} · ${p.autor || "Anónimo"}</p>
            <span class="text-[11px] font-semibold text-[#A23C16] inline-flex items-center gap-0.5 mt-1.5">
              Ver <span class="material-symbols-outlined text-[13px]">chevron_right</span>
            </span>
          </div>
        </button>
      </div>
    `).join("");

    const filaIdentificacion = (label, valor) => `
      <div class="grid grid-cols-[180px_1fr] gap-3 py-2 border-b border-[#E3DECB] text-xs">
        <span class="font-semibold text-[#5B534C]">${label}:</span>
        <span class="text-[#0C0F14]">${valor || "—"}</span>
      </div>
    `;

    return `
      <div class="space-y-5 animate-fade-in max-w-5xl mx-auto">
        <!-- Migas de pan -->
        <div class="text-xs text-[#5B534C] flex items-center gap-1.5 flex-wrap">
          <a href="javascript:void(0)" onclick="App.navigateTo('catalogo')" class="hover:text-[#A23C16] cursor-pointer">Catálogo</a>
          <span>/</span>
          <a href="javascript:void(0)" onclick="App.filtrosCatalogo.coleccion='${pieza.coleccion}'; App.navigateTo('catalogo')" class="hover:text-[#A23C16] cursor-pointer">${coleccionNombre}</a>
          <span>/</span>
          <span class="text-[#0C0F14] font-medium">${pieza.denominacion}</span>
        </div>

        <!-- Título y acciones -->
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold font-heading text-[#0C0F14]">${pieza.denominacion}</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Autor: <strong>${pieza.autor || "Anónimo"}</strong> · ${pieza.procedencia} · ${pieza.epocaOriginal || "Época no consignada"}
            </p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="App.navigateTo('registro')" class="btn-secundario text-xs" title="Editar ficha">
              <span class="material-symbols-outlined text-[16px]">edit</span>
              <span>Editar</span>
            </button>
            <button onclick="Components.showToast('Ficha técnica generada para impresión/PDF', 'info')" class="btn-texto text-xs p-2" title="Descargar / imprimir ficha">
              <span class="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            </button>
            <button onclick="navigator.clipboard && navigator.clipboard.writeText(window.location.href).then(() => Components.showToast('Enlace copiado al portapapeles', 'exito')).catch(() => Components.showToast('No se pudo copiar el enlace', 'error'))" class="btn-texto text-xs p-2" title="Copiar enlace">
              <span class="material-symbols-outlined text-[18px]">link</span>
            </button>
            <button onclick="Components.showToast('Ficha enviada por correo (simulado)', 'info')" class="btn-texto text-xs p-2" title="Enviar por email">
              <span class="material-symbols-outlined text-[18px]">mail</span>
            </button>
          </div>
        </div>

        <!-- Imagen principal -->
        <div class="matp-card overflow-hidden">
          <img src="${fotoPrincipal.url}" alt="${fotoPrincipal.vista}" class="w-full max-h-[420px] object-cover" />
        </div>

        <!-- Banner de registro -->
        <div class="bg-[#A23C16] text-white px-5 py-3 rounded-[6px] flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold text-sm">
            ${pieza.tieneCodigoI ? `Número de Registro: ${pieza.codigoI}` : `Código de Colección: ${pieza.coleccion} ${codigoColeccion !== "—" ? "· " + codigoColeccion : "(sin código I — comodato)"}`}
          </span>
          ${Components.renderChipEstado(pieza.estado, pieza.estadoTipo)}
        </div>

        <!-- Tabla rápida -->
        <div class="matp-card overflow-hidden">
          <table class="w-full text-xs">
            <tbody>
              <tr class="border-b border-[#E3DECB] bg-[#FAF7EE]"><td class="p-3 font-semibold text-[#5B534C] w-40">Título</td><td class="p-3 text-[#0C0F14]">${pieza.denominacion}</td></tr>
              <tr class="border-b border-[#E3DECB]"><td class="p-3 font-semibold text-[#5B534C]">Creador</td><td class="p-3 text-[#0C0F14]">${pieza.autor || "Anónimo"}</td></tr>
              <tr class="border-b border-[#E3DECB] bg-[#FAF7EE]"><td class="p-3 font-semibold text-[#5B534C]">Institución</td><td class="p-3 text-[#0C0F14]">Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (MATP - PUCP)</td></tr>
              <tr><td class="p-3 font-semibold text-[#5B534C]">Fecha</td><td class="p-3 text-[#0C0F14]">${pieza.epocaOriginal || "No consignada"}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Ficha de registro -->
        <div class="flex items-center justify-between border-b border-[#E3DECB] pb-2 pt-2">
          <h3 class="text-sm font-bold font-heading text-[#0C0F14]">Ficha de registro</h3>
          <span class="text-[11px] text-[#5B534C]">${pieza.registrador || "Sistema digital MATP"}</span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Columna izquierda: galería -->
          <div class="lg:col-span-1 space-y-3">
            <div class="matp-card overflow-hidden">
              <img src="${fotoPrincipal.url}" alt="${fotoPrincipal.vista}" class="w-full h-48 object-cover" />
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              ${fotosThumbsHtml || '<p class="text-[11px] text-[#5B534C] col-span-4">Sin fotografías registradas.</p>'}
            </div>
            <button onclick="Components.showToast('Abriendo gestor de carga fotográfica', 'info')" class="btn-secundario w-full text-xs">
              <span class="material-symbols-outlined text-[16px]">add_a_photo</span>
              <span>Subir Nueva Vista</span>
            </button>
          </div>

          <!-- Columna derecha: identificación, descripción, contexto, gestión -->
          <div class="lg:col-span-2 space-y-6">
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] mb-1">Identificación</h4>
              ${filaIdentificacion("Institución", "MATP - PUCP")}
              ${filaIdentificacion("Número de registro", pieza.tieneCodigoI ? pieza.codigoI : "Sin asignar (comodato)")}
              ${filaIdentificacion("N° Inventario Colección", codigoColeccion)}
              ${filaIdentificacion("Clasificación", "Patrimonio Mueble Etnográfico")}
              ${filaIdentificacion("Colección", coleccionNombre)}
              ${filaIdentificacion("Objeto", pieza.tipoBien)}
              ${filaIdentificacion("Creador", pieza.autor || "Anónimo")}
              ${filaIdentificacion("Dimensiones", pieza.medidas)}
              ${filaIdentificacion("Técnica / Material", pieza.materiales)}
              ${filaIdentificacion("Ubicación", pieza.ubicacion)}
            </div>

            <div>
              ${filaIdentificacion("Título", pieza.denominacion)}
              <div class="py-2 border-b border-[#E3DECB] text-xs">
                <span class="font-semibold text-[#5B534C] block mb-1">Descripción:</span>
                <p class="text-[#0C0F14] leading-relaxed">${pieza.observaciones || "Sin descripción adicional."}</p>
              </div>
              ${filaIdentificacion("Estado de conservación", pieza.conservacion)}
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] mb-1">Contexto</h4>
              ${filaIdentificacion("Fecha de creación", pieza.epocaOriginal)}
            </div>

            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] mb-1">Gestión</h4>
              <p class="text-[11px] font-semibold text-[#5B534C] mt-2 mb-1">Adquisición</p>
              ${filaIdentificacion("Régimen de tenencia", pieza.regimen)}
              ${filaIdentificacion("Procedencia", pieza.procedencia)}

              <p class="text-[11px] font-semibold text-[#5B534C] mt-3 mb-1">Registradores</p>
              <div class="border border-[#E3DECB] rounded-[6px] px-3">
                ${registradoresHtml}
              </div>
            </div>
          </div>
        </div>

        <!-- Contenido relacionado -->
        ${relacionadas.length > 0 ? `
          <div class="pt-2">
            <h3 class="text-sm font-bold font-heading text-[#0C0F14] mb-3">Contenido relacionado · ${coleccionNombre}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              ${relacionadasHtml}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (5): REGISTRAR / EDITAR PIEZA (M1)
  // ══════════════════════════════════════════════════════════════
  async renderRegistro() {
    const esEdicion = App.currentPieceId && App.currentPieceId !== "nueva";
    const pieza = esEdicion ? (await API.getPieza(App.currentPieceId)) : {
      codigoI: "I-00" + Math.floor(1000 + Math.random() * 9000),
      tieneCodigoI: true,
      denominacion: "",
      coleccion: "Retablos",
      regimen: "Propiedad definitiva",
      autor: "",
      procedencia: "Huamanga, Ayacucho, Perú",
      tipoBien: "Retablo / Caja de San Marcos",
      materiales: "",
      medidas: "",
      conservacion: "Bueno / Estable",
      ubicacion: "Depósito 1 · Estante A-2",
      observaciones: ""
    };

    return `
      <div class="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <!-- Encabezado del Formulario -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex items-center justify-between">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 1 · Catálogo Museográfico</span>
            <h2 class="text-lg font-bold font-heading text-[#0C0F14]">
              ${esEdicion ? `Editar Catalogación: ${pieza.denominacion}` : "Registrar Nueva Pieza Patrimonial"}
            </h2>
            <p class="text-xs text-[#5B534C] mt-0.5">
              Los campos marcados con asterisco (<strong class="text-[#A23C16]">*</strong>) son obligatorios según las reglas de completitud institucional.
            </p>
          </div>
          <button onclick="App.navigateTo('catalogo')" class="btn-texto text-xs">
            <span class="material-symbols-outlined text-[16px]">close</span>
            <span>Cancelar</span>
          </button>
        </div>

        <!-- Formulario -->
        <form onsubmit="App.handleGuardarPieza(event)" class="space-y-6">
          <!-- Sección 1: Identificación y Régimen Legal -->
          <div class="matp-card p-6 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-2 border-b border-[#E3DECB] pb-2">
              <span class="material-symbols-outlined text-[18px]">tag</span>
              1. Identificación y Régimen Legal
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Código I (Inventario General) <span class="text-[#A23C16]">*</span>
                </label>
                <input
                  type="text"
                  name="codigoI"
                  value="${pieza.codigoI}"
                  required
                  class="input-matp font-mono"
                  placeholder="I-00XXXX"
                />
                <p class="text-[10px] text-[#5B534C] mt-1">Identificador patrimonial inmutable una vez asignado a piezas en propiedad.</p>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Régimen de Tenencia <span class="text-[#A23C16]">*</span>
                </label>
                <select name="regimen" class="input-matp" onchange="App.handleRegimenChange(this.value)">
                  <option value="Propiedad definitiva" ${pieza.regimen.includes("Propiedad") ? "selected" : ""}>Propiedad definitiva (PUCP)</option>
                  <option value="Comodato familiar / institucional" ${pieza.regimen.includes("Comodato") ? "selected" : ""}>Comodato familiar / institucional</option>
                  <option value="Depósito temporal en custodia" ${pieza.regimen.includes("Depósito") ? "selected" : ""}>Depósito temporal en custodia</option>
                </select>
                <p id="regimen-help" class="text-[10px] text-[#C8791E] mt-1 hidden">
                  Nota: Las piezas en comodato no reciben Código I definitivo.
                </p>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Denominación / Título de la Pieza <span class="text-[#A23C16]">*</span>
              </label>
              <input
                type="text"
                name="denominacion"
                value="${pieza.denominacion}"
                required
                class="input-matp"
                placeholder="Ej. Procesión del Corpus Christi con imagen de San Cristóbal"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Colección / Fondo <span class="text-[#A23C16]">*</span>
                </label>
                <select name="coleccion" class="input-matp">
                  <option value="AJB" ${pieza.coleccion === "AJB" ? "selected" : ""}>Colección Arturo Jiménez Borja (AJB)</option>
                  <option value="MMZ" ${pieza.coleccion === "MMZ" ? "selected" : ""}>Colección Mildred Merino de Zela (MMZ)</option>
                  <option value="FJT" ${pieza.coleccion === "FJT" ? "selected" : ""}>Colección Florentino Jiménez Toma</option>
                  <option value="GERSOL" ${pieza.coleccion === "GERSOL" ? "selected" : ""}>Colección Gertrud Bramberger de Solari</option>
                  <option value="MBV" ${pieza.coleccion === "MBV" ? "selected" : ""}>Colección Mariano Benites Villanueva</option>
                  <option value="DGP" ${pieza.coleccion === "DGP" ? "selected" : ""}>Colección Doris Gibson Parra</option>
                  <option value="ACG" ${pieza.coleccion === "ACG" ? "selected" : ""}>Colección Alfonso Cabrera Ganoza</option>
                  <option value="RAB" ${pieza.coleccion === "RAB" ? "selected" : ""}>Colección Raúl Apesteguía Bresciani</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Tipo de Bien (Tesauro) <span class="text-[#A23C16]">*</span>
                </label>
                <select name="tipoBien" class="input-matp">
                  <option value="Retablo / Caja de San Marcos">Retablo / Caja de San Marcos</option>
                  <option value="Mate burilado">Mate burilado</option>
                  <option value="Cerámica tradicional">Cerámica tradicional</option>
                  <option value="Textil ritual / Indumentaria">Textil ritual / Indumentaria</option>
                  <option value="Máscara festiva">Máscara festiva</option>
                  <option value="Imaginería religiosa / Escultura">Imaginería religiosa / Escultura</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Autor / Creador
                </label>
                <input
                  type="text"
                  name="autor"
                  value="${pieza.autor || ""}"
                  class="input-matp"
                  placeholder="Ej. Joaquín López Antay"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Procedencia Geográfica / Cultural
                </label>
                <input
                  type="text"
                  name="procedencia"
                  value="${pieza.procedencia || ""}"
                  class="input-matp"
                  placeholder="Ej. Huamanga, Ayacucho, Perú"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Época / Cronología
                </label>
                <input
                  type="text"
                  name="epocaOriginal"
                  value="${pieza.epocaOriginal || ""}"
                  class="input-matp"
                  placeholder="Ej. ca. 1955-1960"
                />
              </div>
            </div>
          </div>

          <!-- Sección 2: Características Físicas y Conservación -->
          <div class="matp-card p-6 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-2 border-b border-[#E3DECB] pb-2">
              <span class="material-symbols-outlined text-[18px]">palette</span>
              2. Características Físicas y Estado de Conservación
            </h3>

            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Materiales y Técnicas Empleadas <span class="text-[#A23C16]">*</span>
              </label>
              <textarea
                name="materiales"
                required
                rows="2"
                class="input-matp"
                placeholder="Ej. Madera de cedro, pasta de yeso y almidón de papa, pigmentos al temple..."
              >${pieza.materiales || ""}</textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Medidas y Dimensiones <span class="text-[#A23C16]">*</span>
                </label>
                <input
                  type="text"
                  name="medidas"
                  value="${pieza.medidas || ""}"
                  required
                  class="input-matp"
                  placeholder="Alto: 62 cm · Ancho: 48 cm · Fondo: 18 cm"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                  Estado de Conservación <span class="text-[#A23C16]">*</span>
                </label>
                <select name="conservacion" class="input-matp">
                  <option value="Excelente">Excelente (Sin deterioro visible)</option>
                  <option value="Bueno / Estable" selected>Bueno / Estable (Desgaste menor concordante con edad)</option>
                  <option value="Regular / Requiere monitoreo">Regular / Requiere monitoreo</option>
                  <option value="Malo / En restauración">Malo / En restauración</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Observaciones y Diagnóstico
              </label>
              <textarea
                name="observaciones"
                rows="2"
                class="input-matp"
                placeholder="Observaciones de ingreso, restauraciones previas o particularidades..."
              >${pieza.observaciones || ""}</textarea>
            </div>
          </div>

          <!-- Sección 3: Ubicación y Custodia Inicial -->
          <div class="matp-card p-6 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-2 border-b border-[#E3DECB] pb-2">
              <span class="material-symbols-outlined text-[18px]">location_on</span>
              3. Ubicación Topográfica Asignada
            </h3>

            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">
                Ubicación Topográfica <span class="text-[#A23C16]">*</span>
              </label>
              <select name="ubicacion" class="input-matp">
                <option value="Depósito N° 1, caja 1">Sede MATP · Depósito N° 1, caja 1</option>
                <option value="Depósito N° 2">Sede MATP · Depósito N° 2</option>
                <option value="Depósito AJB, Caja 25">Sede MATP · Depósito AJB, Caja 25</option>
                <option value="Primera gaveta de Anaquel de Metal - Depósito AJB">Sede MATP · Anaquel de Metal, Depósito AJB</option>
                <option value="Por asignar">Por asignar (En tránsito)</option>
              </select>
            </div>
          </div>

          <!-- Botones de Guardar -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <button type="button" onclick="App.navigateTo('catalogo')" class="btn-texto">
              Cancelar
            </button>
            <button type="submit" class="btn-primario px-6 py-2.5">
              <span class="material-symbols-outlined text-[18px]">save</span>
              <span>Guardar en Catálogo</span>
            </button>
          </div>
        </form>
      </div>
    `;
  },

  handleRegimenChange(valor) {
    const help = document.getElementById("regimen-help");
    if (help) {
      help.classList.toggle("hidden", valor.includes("Propiedad"));
    }
  },

  async handleGuardarPieza(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const piezaData = {
      id: App.currentPieceId !== "nueva" ? App.currentPieceId : `p-${Date.now()}`,
      codigoI: formData.get("codigoI"),
      tieneCodigoI: Boolean(formData.get("codigoI")),
      denominacion: formData.get("denominacion"),
      coleccion: formData.get("coleccion"),
      regimen: formData.get("regimen"),
      tipoBien: formData.get("tipoBien"),
      autor: formData.get("autor"),
      procedencia: formData.get("procedencia"),
      epocaOriginal: formData.get("epocaOriginal"),
      materiales: formData.get("materiales"),
      medidas: formData.get("medidas"),
      conservacion: formData.get("conservacion"),
      ubicacion: formData.get("ubicacion"),
      observaciones: formData.get("observaciones"),
      estado: "Completa",
      estadoTipo: "completa"
    };

    await API.savePieza(piezaData);
    Components.showToast("Pieza catalogada exitosamente", "exito");
    App.currentPieceId = piezaData.id;
    App.navigateTo("ficha");
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (6): COLECCIONES Y FONDOS (M1) [NUEVO]
  // ══════════════════════════════════════════════════════════════
  async renderColecciones() {
    const colecciones = await API.getColecciones();

    const coleccionesHtml = colecciones.map(c => `
      <div class="matp-card p-5 space-y-4 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
          <div>
            <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0DAD0] text-[#A23C16]">
              ${c.sigla}
            </span>
            <h3 class="text-base font-bold font-heading text-[#0C0F14] mt-1">${c.nombre}</h3>
            <p class="text-[11px] text-[#5B534C]">${c.tipoFondo} · Ingreso: <strong>${c.anioIngreso}</strong></p>
          </div>
          <span class="chip chip-completa">${c.estado}</span>
        </div>

        <p class="text-xs text-[#5B534C] line-clamp-3 leading-relaxed">
          ${c.descripcion}
        </p>

        <!-- Barra de Digitalización -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-[#0C0F14]">${c.piezas.toLocaleString()} piezas</span>
            <span class="text-[#A23C16] font-semibold">${c.porcentajeDigital}% digitalizado</span>
          </div>
          <div class="w-full bg-[#E3DECB] rounded-full h-2 overflow-hidden">
            <div class="bg-[#A23C16] h-2 rounded-full" style="width: ${c.porcentajeDigital}%;"></div>
          </div>
        </div>

        <!-- Acciones -->
        <div class="pt-3 border-t border-[#E3DECB] flex items-center justify-between">
          <span class="text-[11px] text-[#5B534C]">Curador: <strong>${c.curador}</strong></span>
          <button
            onclick="App.filtrosCatalogo.coleccion='${c.clave}'; App.navigateTo('catalogo');"
            class="btn-secundario py-1 px-3 text-xs"
          >
            <span class="material-symbols-outlined text-[14px]">inventory_2</span>
            <span>Ver Piezas</span>
          </button>
        </div>
      </div>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado de Colecciones -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 1 · Gestión de Fondos</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Colecciones y Fondos Patrimoniales</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              El MATP custodia <strong>8 fondos emblemáticos</strong> (de 11-12 colecciones documentadas) con más de 10,000 obras de arte popular peruano.
            </p>
          </div>
          <button onclick="App.showModalNuevaColeccion()" class="btn-primario text-xs shrink-0">
            <span class="material-symbols-outlined text-[16px]">add</span>
            <span>Nueva Colección</span>
          </button>
        </div>

        <!-- Grid de Colecciones -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${coleccionesHtml}
        </div>
      </div>
    `;
  },

  async showModalNuevaColeccion() {
    const usuario = await API.getUsuarioActual();
    const curadorNombre = usuario?.nombre || "Curador Responsable";
    const bodyHtml = `
      <form id="form-nueva-coleccion" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Nombre de la Colección / Fondo *</label>
          <input type="text" name="nombre" required class="input-matp" placeholder="Ej. Colección Hojalatería y Platería" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Sigla / Clave *</label>
            <input type="text" name="sigla" required class="input-matp font-mono" placeholder="HOJ" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Año de Ingreso *</label>
            <input type="number" name="anioIngreso" value="2024" required class="input-matp" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Curador / Responsable *</label>
          <input type="text" name="curador" value="${curadorNombre}" required class="input-matp" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Descripción del Fondo</label>
          <textarea name="descripcion" rows="3" class="input-matp" placeholder="Descripción histórica y procedencia..."></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button onclick="Components.closeModal('modal-coleccion')" class="btn-texto text-xs">Cancelar</button>
      <button onclick="App.handleGuardarNuevaColeccion()" class="btn-primario text-xs">Crear Colección</button>
    `;

    Components.showModal(Components.renderModal("modal-coleccion", "Registrar Nuevo Fondo Patrimonial", bodyHtml, footerHtml));
  },

  async handleGuardarNuevaColeccion() {
    const form = document.getElementById("form-nueva-coleccion");
    if (!form || !form.reportValidity()) return;

    const fd = new FormData(form);
    await API.saveColeccion({
      nombre: fd.get("nombre"),
      clave: fd.get("sigla"),
      sigla: fd.get("sigla"),
      curador: fd.get("curador"),
      anioIngreso: parseInt(fd.get("anioIngreso"), 10),
      descripcion: fd.get("descripcion"),
      tipoFondo: "Fondo incorporado"
    });

    Components.closeModal("modal-coleccion");
    Components.showToast("Colección incorporada exitosamente", "exito");
    App.navigateTo("colecciones");
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (7): TESAUROS Y VOCABULARIOS (M2) [NUEVO]
  // ══════════════════════════════════════════════════════════════
  async renderTesauros() {
    const categoria = App.activeTesauroCat || "tiposBien";
    const terminos = await API.getTesauros(categoria);

    const tabsMap = [
      { id: "tiposBien", label: "Tipos de Bien", icon: "category" },
      { id: "materiales", label: "Materiales y Técnicas", icon: "palette" },
      { id: "procedencias", label: "Procedencias Culturales", icon: "public" },
      { id: "regimenes", label: "Regímenes de Tenencia", icon: "gavel" },
      { id: "estadosConservacion", label: "Estados de Conservación", icon: "healing" }
    ];

    const tabsHtml = tabsMap.map(t => `
      <button
        onclick="App.activeTesauroCat='${t.id}'; App.navigateTo('tesauros', false)"
        class="matp-tab ${categoria === t.id ? 'active' : ''}"
      >
        <span class="material-symbols-outlined text-[16px] mr-1.5">${t.icon}</span>
        ${t.label}
      </button>
    `).join("");

    const terminosHtml = (Array.isArray(terminos) ? terminos : []).map(t => `
      <tr class="hover:bg-[#FAF7EE] transition-colors border-b border-[#E3DECB]">
        <td class="font-mono text-xs font-semibold text-[#A23C16]">${t.uri || t.codigo || "—"}</td>
        <td class="text-xs font-bold text-[#0C0F14]">${t.termino}</td>
        <td class="text-xs text-[#5B534C]">${t.sinonimos || "—"}</td>
        <td class="text-xs font-mono font-medium text-center text-[#0C0F14]">
          ${t.piezas !== undefined ? t.piezas.toLocaleString() : "—"}
        </td>
        <td class="text-center">
          <span class="chip chip-completa text-[11px]">${t.estado || "Activo"}</span>
        </td>
        <td class="text-right">
          <button onclick="App.showModalNormalizarTermino('${categoria}', '${t.id}', '${t.termino}')" class="btn-texto py-1 px-2 text-xs" title="Normalizar / Fusionar sinónimos">
            <span class="material-symbols-outlined text-[16px]">rule</span>
            <span>Normalizar</span>
          </button>
        </td>
      </tr>
    `).join("");

    return `
      <div class="space-y-5 animate-fade-in">
        <!-- Encabezado de Tesauros -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 2 · Control Terminológico y Calidad</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Tesauros y Vocabularios Controlados</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Garantiza la normalización y búsqueda unívoca según estándares internacionales y benchmarking museográfico.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button onclick="App.showModalNuevoTermino('${categoria}')" class="btn-primario text-xs">
              <span class="material-symbols-outlined text-[16px]">add</span>
              <span>Nuevo Término</span>
            </button>
          </div>
        </div>

        <!-- Pestañas de Categorías de Tesauro -->
        <div class="border-b border-[#E3DECB] flex items-center gap-2 overflow-x-auto bg-white rounded-t-[8px] px-4 pt-1">
          ${tabsHtml}
        </div>

        <!-- Tabla de Términos Controlados -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] flex items-center justify-between bg-[#FAF7EE]">
            <span class="text-xs font-semibold text-[#0C0F14]">
              Términos preferentes en catálogo: <strong class="text-[#A23C16]">${terminos.length}</strong>
            </span>
            <div class="text-[11px] text-[#5B534C] flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px]">rule</span>
              Regla de calidad: Todo término nuevo valida sinónimos duplicados
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th class="w-32">URI / Código</th>
                  <th>Término Preferente</th>
                  <th>Sinónimos / Términos No Preferentes</th>
                  <th class="text-center w-28">Piezas Vinculadas</th>
                  <th class="text-center w-24">Estado</th>
                  <th class="text-right w-36">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${terminosHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  showModalNuevoTermino(categoria) {
    const bodyHtml = `
      <form id="form-nuevo-termino" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Término Preferente *</label>
          <input type="text" name="termino" required class="input-matp" placeholder="Ej. Retablo de dos cuerpos" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Sinónimos o Términos No Preferentes (separados por coma)</label>
          <input type="text" name="sinonimos" class="input-matp" placeholder="Ej. Cajón sanmarcos, retablillo" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Definición o Alcance Curatorial</label>
          <textarea name="descripcion" rows="3" class="input-matp" placeholder="Criterio de aplicación para catalogadores..."></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button onclick="Components.closeModal('modal-termino')" class="btn-texto text-xs">Cancelar</button>
      <button onclick="App.handleGuardarNuevoTermino('${categoria}')" class="btn-primario text-xs">Guardar Término</button>
    `;

    Components.showModal(Components.renderModal("modal-termino", "Agregar Término de Tesauro", bodyHtml, footerHtml));
  },

  async handleGuardarNuevoTermino(categoria) {
    const form = document.getElementById("form-nuevo-termino");
    if (!form || !form.reportValidity()) return;

    const fd = new FormData(form);
    await API.saveTerminoTesauro(categoria, {
      termino: fd.get("termino"),
      sinonimos: fd.get("sinonimos"),
      descripcion: fd.get("descripcion"),
      uri: `VOC-MATP-${Math.floor(100 + Math.random() * 900)}`
    });

    Components.closeModal("modal-termino");
    Components.showToast("Término incorporado al tesauro oficial", "exito");
    App.navigateTo("tesauros");
  },

  async showModalNormalizarTermino(categoria, origenId, terminoNombre) {
    const terminos = (await API.getTesauros(categoria)) || [];
    const opciones = terminos
      .filter(t => t.id !== origenId)
      .map(t => `<option value="${t.id}">${t.termino}</option>`)
      .join("");

    const bodyHtml = `
      <div class="space-y-4">
        <div class="p-3 bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px] text-xs text-[#0C0F14]">
          Está normalizando el término <strong>"${terminoNombre}"</strong>. Al unificarlo, todas las piezas asociadas adoptarán el término de destino y la variante se preservará como sinónimo.
        </div>
        <div>
          <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Fusionar bajo el Término Canónico:</label>
          <select id="select-termino-destino" class="input-matp">
            ${opciones}
          </select>
        </div>
      </div>
    `;

    const footerHtml = `
      <button onclick="Components.closeModal('modal-normalizar')" class="btn-texto text-xs">Cancelar</button>
      <button onclick="App.handleConfirmarNormalizar('${categoria}', '${origenId}')" class="btn-primario text-xs">
        Confirmar Normalización
      </button>
    `;

    Components.showModal(Components.renderModal("modal-normalizar", "Regla de Calidad: Normalizar Términos", bodyHtml, footerHtml));
  },

  async handleConfirmarNormalizar(categoria, origenId) {
    const select = document.getElementById("select-termino-destino");
    if (!select) return;

    const destinoId = select.value;
    const res = await API.normalizarTerminos(categoria, origenId, destinoId);
    Components.closeModal("modal-normalizar");
    Components.showToast(res.mensaje, "exito");
    App.navigateTo("tesauros");
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (8): UBICACIÓN Y CONTROL FÍSICO (M3)
  // ══════════════════════════════════════════════════════════════
  async renderUbicacion() {
    const arbol = await API.getArbolUbicaciones();
    const movimientos = await API.getMovimientosRecientes();

    const movimientosHtml = movimientos.map(m => `
      <tr class="hover:bg-[#FAF7EE] transition-colors border-b border-[#E3DECB] text-xs">
        <td class="font-mono text-[#5B534C] whitespace-nowrap">${m.fecha}</td>
        <td class="font-semibold text-[#0C0F14]">${m.pieza}</td>
        <td class="text-[#5B534C]">${m.origen}</td>
        <td class="font-medium text-[#A23C16]">${m.destino}</td>
        <td class="text-[#0C0F14]">${m.responsable}</td>
        <td class="text-[#5B534C]">${m.motivo}</td>
      </tr>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado de Ubicaciones -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 3 · Topografía y Custodia Física</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Ubicaciones y Control Físico</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Explorador jerárquico topográfico: Sede → Depósito / Sala → Mueble → Nivel / Bandeja.
            </p>
          </div>
        </div>

        <!-- Explorador en 2 Columnas -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Columna Izquierda: Árbol Topográfico -->
          <div class="matp-card p-4 space-y-3">
            <div class="flex items-center justify-between border-b border-[#E3DECB] pb-2">
              <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">account_tree</span>
                Árbol Topográfico MATP
              </h3>
              <span class="text-[10px] text-[#5B534C]">Jerarquía activa</span>
            </div>

            <!-- Estructura del Árbol -->
            <div class="text-xs space-y-2 select-none">
              <div class="font-semibold text-[#0C0F14] flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[#A23C16] text-[16px]">home</span>
                Sede MATP (Jr. Camaná 459, Lima)
              </div>

              <div class="pl-4 space-y-2 border-l border-[#E3DECB] ml-2">
                <div>
                  <div class="font-medium text-[#0C0F14] flex items-center gap-1 text-[11px]">
                    <span class="material-symbols-outlined text-[14px]">door_front</span>
                    Depósito N° 1 (Bóveda Principal - Planta Baja)
                  </div>
                  <div class="pl-4 space-y-1.5 border-l border-[#E3DECB] ml-2 mt-1">
                    <div class="text-[11px] font-medium text-[#A23C16] flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">table_restaurant</span>
                      Anaquel (Cerámica MMZ / MBV)
                    </div>
                    <div class="pl-4 space-y-1 border-l border-[#E3DECB] ml-2">
                      <div class="text-[11px] text-[#5B534C] hover:text-[#A23C16] cursor-pointer" onclick="App.nodoUbicacionSeleccionado='Nivel 1 (Piezas gran formato)'; App.navigateTo('ubicacion', false)">
                        • Nivel 1 (12 piezas)
                      </div>
                      <div class="text-[11px] font-bold text-[#A23C16] bg-[#F0DAD0] px-2 py-0.5 rounded cursor-pointer">
                        • Caja 1 (Colección MMZ - 24 piezas)
                      </div>
                      <div class="text-[11px] text-[#5B534C] hover:text-[#A23C16] cursor-pointer" onclick="App.nodoUbicacionSeleccionado='Nivel 3 (Cajas herméticas)'; App.navigateTo('ubicacion', false)">
                        • Nivel 3 (18 piezas)
                      </div>
                    </div>

                    <div class="text-[11px] text-[#5B534C] flex items-center gap-1 mt-2">
                      <span class="material-symbols-outlined text-[14px]">table_restaurant</span>
                      Estante (Metales y mates) (58 piezas)
                    </div>
                  </div>
                </div>

                <div class="text-[11px] text-[#5B534C] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">door_front</span>
                  Depósito N° 2 (Procesiones y Textiles)
                </div>

                <div class="text-[11px] text-[#5B534C] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">door_front</span>
                  Depósito AJB (Colección en comodato)
                </div>

                <div class="text-[11px] text-[#5B534C] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">gallery_thumbnail</span>
                  Sala Permanente "Identidades"
                </div>

                <div class="text-[11px] text-[#5B534C] flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">gallery_thumbnail</span>
                  Sala Temporal "Memoria Viva"
                </div>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Piezas en el Nivel Seleccionado -->
          <div class="lg:col-span-2 space-y-4">
            <div class="matp-card p-5 space-y-3">
              <div class="flex items-center justify-between border-b border-[#E3DECB] pb-3">
                <div>
                  <span class="text-[10px] font-semibold uppercase tracking-wider text-[#A23C16]">Ubicación Seleccionada</span>
                  <h3 class="text-sm font-bold font-heading text-[#0C0F14]">${App.nodoUbicacionSeleccionado}</h3>
                  <p class="text-xs text-[#5B534C]">Sede MATP · Depósito N° 1 · Anaquel</p>
                </div>
                <span class="chip chip-completa text-xs">Capacidad: 24 / 30 ocupado</span>
              </div>

              <!-- Listado de Piezas alojadas -->
              <div class="space-y-2">
                <p class="text-xs font-semibold text-[#0C0F14]">Piezas alojadas en esta posición:</p>
                <div class="space-y-2">
                  <div class="flex items-center justify-between p-2.5 bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px]">
                    <div class="flex items-center gap-2.5">
                      <span class="px-1.5 py-0.5 bg-[#A23C16] text-white font-mono font-bold text-[10px] rounded">I-00010</span>
                      <span class="text-xs font-medium text-[#0C0F14]">Niño Jesús</span>
                    </div>
                    <button onclick="App.currentPieceId='p-002'; App.navigateTo('ficha')" class="btn-texto py-0.5 px-2 text-xs">
                      Ver Ficha
                    </button>
                  </div>

                  <div class="flex items-center justify-between p-2.5 bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px]">
                    <div class="flex items-center gap-2.5">
                      <span class="px-1.5 py-0.5 bg-[#A23C16] text-white font-mono font-bold text-[10px] rounded">I-01237</span>
                      <span class="text-xs font-medium text-[#0C0F14]">Virgen con el Niño</span>
                    </div>
                    <button onclick="App.currentPieceId='p-003'; App.navigateTo('ficha')" class="btn-texto py-0.5 px-2 text-xs">
                      Ver Ficha
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bitácora de Movimientos de Custodia (Solo Lectura) -->
            <div class="matp-card overflow-hidden">
              <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[16px]">history</span>
                      Bitácora de Movimientos de Custodia
                    </h3>
                    <span class="chip chip-gris text-[10px] py-0.5 px-2">Solo lectura</span>
                  </div>
                  <p class="text-[11px] text-[#5B534C] mt-1">
                    El historial de ubicación se genera automáticamente al editar la ubicación de una pieza.
                  </p>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="tabla-matp">
                  <thead>
                    <tr>
                      <th>Fecha / Hora</th>
                      <th>Pieza</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th>Responsable</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${movimientosHtml}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (9): IMPORTACIÓN Y CALIDAD DE DATOS (M4)
  // ══════════════════════════════════════════════════════════════
  async renderImportar() {
    const importData = await API.getImportacionActual();
    const bitacora = await API.getBitacoraImportaciones();
    const validacionTesauros = await API.getValidacionTesauros();

    const currentStep = App.activeImportStep || "archivo";

    const stepDefs = [
      { id: "archivo", num: 1, label: "1. Archivo", iconDefault: "upload_file" },
      { id: "mapeo", num: 2, label: "2. Mapeo Columnas", iconDefault: "alt_route" },
      { id: "tesauros", num: 3, label: "3. Validación Tesauros", iconDefault: "fact_check" },
      { id: "previsualizacion", num: 4, label: "4. Previsualización y Matching", iconDefault: "rule" },
      { id: "incorporacion", num: 5, label: "5. Incorporación", iconDefault: "task_alt" }
    ];

    const currentStepIdx = stepDefs.findIndex(s => s.id === currentStep);
    const activeIdx = currentStepIdx >= 0 ? currentStepIdx : 0;

    const stepperHtml = stepDefs.map((step, idx) => {
      let classes = "";
      let icon = step.iconDefault;

      if (idx === activeIdx) {
        classes = "bg-[#A23C16] text-white font-bold shadow-sm ring-1 ring-[#A23C16]";
      } else if (idx < activeIdx) {
        classes = "bg-[#E1EFD8] text-[#007438] font-medium hover:bg-[#D5E8CB]";
        icon = "check_circle";
      } else {
        classes = "bg-[#FAF7EE] text-[#5B534C] border border-[#E3DECB] font-medium hover:bg-[#F2EDDC]";
      }

      return `
        <button
          type="button"
          onclick="App.activeImportStep='${step.id}'; App.navigateTo('importar', false)"
          class="p-2.5 rounded-[6px] text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${classes}"
          title="Ir al paso: ${step.label}"
        >
          <span class="material-symbols-outlined text-[16px]">${icon}</span>
          <span>${step.label}</span>
        </button>
      `;
    }).join("");

    const validacionTesaurosHtml = validacionTesauros.map(v => {
      const chipHtml = v.estado === "Validado"
        ? `<span class="chip chip-completa"><span class="material-symbols-outlined text-[14px]">check_circle</span>Validado</span>`
        : `<span class="chip chip-pendiente"><span class="material-symbols-outlined text-[14px]">warning</span>Revisar</span>`;

      return `
        <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
          <td>
            <div class="font-mono text-[11px] text-[#A23C16] font-semibold">${v.columna}</div>
            <div class="text-[10px] text-[#5B534C]">${v.campoMatp}</div>
          </td>
          <td class="text-center font-mono font-medium text-[#007438]">
            <span class="px-2 py-0.5 bg-[#E1EFD8] rounded font-semibold">${v.coincidentes}</span>
          </td>
          <td class="text-center font-mono font-medium">
            ${v.noReconocidos > 0 
              ? `<span class="px-2 py-0.5 bg-[#F8E1DC] text-[#DA2A4E] rounded font-bold">${v.noReconocidos}</span>` 
              : `<span class="px-2 py-0.5 bg-[#FAF7EE] text-[#5B534C] rounded font-medium">0</span>`}
          </td>
          <td class="text-[#5B534C] text-[11px]">
            ${v.ejemploNoReconocido}
          </td>
          <td class="text-center">
            ${chipHtml}
          </td>
          <td class="text-right whitespace-nowrap">
            ${v.noReconocidos > 0 ? `
              <div class="flex items-center justify-end gap-1.5">
                <button type="button" onclick="Components.showToast('Mapeando variantes de ${v.columna} a término canónico del tesauro', 'info')" class="btn-secundario py-1 px-2 text-[11px]" title="Homologar variante al tesauro">
                  <span class="material-symbols-outlined text-[14px]">alt_route</span>
                  <span>Mapear a existente</span>
                </button>
                <button type="button" onclick="Components.showToast('Abriendo registro rápido para nuevo término en tesauro ${v.campoMatp}', 'info')" class="btn-texto py-1 px-2 text-[11px] text-[#A23C16] hover:underline" title="Crear nuevo término en tesauro">
                  <span class="material-symbols-outlined text-[14px]">add_circle</span>
                  <span>Crear nuevo</span>
                </button>
              </div>
            ` : `
              <span class="text-[11px] text-[#007438] flex items-center justify-end gap-1 font-medium">
                <span class="material-symbols-outlined text-[14px]">task_alt</span>
                100% Homologado
              </span>
            `}
          </td>
        </tr>
      `;
    }).join("");

    const filasHtml = importData.filasPrevisualizacion.map(f => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-mono text-center text-[#5B534C]">${f.filaExcel}</td>
        <td class="font-mono font-bold text-[#A23C16]">${f.codigoReferencia}</td>
        <td class="font-medium text-[#0C0F14]">${f.denominacion}</td>
        <td>${Components.renderChipEstado(f.estadoImport, f.estadoTipo)}</td>
        <td class="text-[#5B534C] text-[11px]">${f.campoDiff}</td>
        <td class="text-right">
          <button onclick="Components.showToast('Acción aplicada para fila ${f.filaExcel}', 'info')" class="btn-secundario py-1 px-2.5 text-xs">
            Resolver
          </button>
        </td>
      </tr>
    `).join("");

    const bitacoraHtml = bitacora.map(b => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-mono text-[#5B534C]">${b.id}</td>
        <td class="font-semibold text-[#0C0F14]">${b.archivo}</td>
        <td class="text-[#5B534C]">${b.fecha}</td>
        <td class="text-center font-mono font-medium">${b.filas}</td>
        <td class="text-[#0C0F14]">${b.usuario}</td>
        <td class="text-center">${Components.renderChipEstado(b.resultado, b.resultado.toLowerCase())}</td>
        <td class="text-[11px] text-[#5B534C]">${b.motivo}</td>
      </tr>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado de Importación -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 4 · Ingesta Masiva y Reglas de Calidad</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Importación Masiva de Colecciones (Excel / CSV)</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Asistente de 5 pasos con previsualización sintáctica, validación contra tesauros y detección de duplicados.
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${currentStep === "incorporacion" ? `
              <button onclick="App.handleAprobarImportacion()" class="btn-primario text-xs shrink-0">
                <span class="material-symbols-outlined text-[16px]">task_alt</span>
                <span>Aprobar e Incorporar al Inventario</span>
              </button>
            ` : `
              <span class="chip chip-gris text-xs font-mono">Paso ${activeIdx + 1} de 5: ${stepDefs[activeIdx].label.split(". ")[1]}</span>
            `}
          </div>
        </div>

        <!-- Stepper Visual de 5 Pasos -->
        <div class="matp-card p-4">
          <div class="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
            ${stepperHtml}
          </div>
        </div>

        <!-- PASO 1: Carga de Archivo -->
        ${currentStep === "archivo" ? `
          <div class="matp-card p-6 space-y-6 bg-white border border-[#E3DECB]">
            <div class="border-b border-[#E3DECB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-[#F0DAD0] text-[#A23C16] font-bold text-[10px] rounded font-mono">PASO 1</span>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[#A23C16] text-[18px]">upload_file</span>
                    Carga de Archivo de Inventario
                  </h3>
                </div>
                <p class="text-xs text-[#5B534C] mt-1">
                  Seleccione la hoja de cálculo generada en campo o el catálogo exportado por el equipo de catalogación.
                </p>
              </div>
              <span class="chip chip-verde text-xs shrink-0">
                <span class="material-symbols-outlined text-[14px]">verified</span>
                Archivo cargado en memoria
              </span>
            </div>

            <!-- Zona Drag & Drop / Input File -->
            <div class="border-2 border-dashed border-[#A23C16]/40 hover:border-[#A23C16] bg-[#FAF7EE] p-8 rounded-[8px] text-center space-y-3 transition-colors cursor-pointer" onclick="document.getElementById('input-archivo-excel').click()">
              <div class="w-14 h-14 mx-auto rounded-full bg-[#F0DAD0] text-[#A23C16] flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">cloud_upload</span>
              </div>
              <div>
                <p class="text-sm font-semibold text-[#0C0F14]">Arrastra y suelta tu archivo Excel o CSV aquí</p>
                <p class="text-xs text-[#5B534C] mt-0.5">o haz clic para explorar en tus carpetas locales</p>
              </div>
              <input type="file" id="input-archivo-excel" class="hidden" accept=".xlsx,.xls,.csv" onchange="Components.showToast('Archivo seleccionado: ' + (this.files[0] ? this.files[0].name : 'archivo.xlsx'), 'info')" />
              <div class="pt-2">
                <button type="button" onclick="event.stopPropagation(); Components.showToast('Archivo &quot;${importData.archivo}&quot; cargado e inspeccionado correctamente', 'exito')" class="btn-primario text-xs mx-auto">
                  <span class="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>Simular carga de archivo</span>
                </button>
              </div>
            </div>

            <!-- Metadatos del Archivo Activo y Restricciones -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-[#FAF7EE] rounded-[6px] border border-[#E3DECB] space-y-2.5">
                <h4 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">description</span>
                  Metadatos del Archivo Activo
                </h4>
                <div class="space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="text-[#5B534C]">Nombre del archivo:</span>
                    <span class="font-mono font-semibold text-[#0C0F14]">${importData.archivo}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[#5B534C]">Fecha y hora de subida:</span>
                    <span class="font-medium text-[#0C0F14]">${importData.fechaSubida}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[#5B534C]">Total de registros detectados:</span>
                    <span class="font-mono font-bold text-[#A23C16]">${importData.totalFilas} filas</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-[#5B534C]">Integridad estructural:</span>
                    <span class="text-[#007438] font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                      Encabezados y columnas conformes
                    </span>
                  </div>
                </div>
              </div>

              <div class="p-4 bg-white rounded-[6px] border border-[#E3DECB] space-y-2.5">
                <h4 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">rule_folder</span>
                  Formatos y Límites Técnicos
                </h4>
                <ul class="text-xs text-[#5B534C] space-y-2">
                  <li class="flex items-start gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-[#A23C16] shrink-0">check</span>
                    <span><strong>Formatos admitidos:</strong> Hojas de cálculo Microsoft Excel (.xlsx, .xls) y archivos CSV delimitados por coma o punto y coma.</span>
                  </li>
                  <li class="flex items-start gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-[#A23C16] shrink-0">check</span>
                    <span><strong>Límites permitidos:</strong> Hasta 20,000 filas por carga y un tamaño máximo de 50 MB por archivo.</span>
                  </li>
                  <li class="flex items-start gap-1.5">
                    <span class="material-symbols-outlined text-[15px] text-[#A23C16] shrink-0">check</span>
                    <span><strong>Codificación recomendada:</strong> UTF-8 para garantizar la fidelidad de nombres en quechua, tildes y caracteres especiales.</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Navegación del Paso -->
            <div class="flex items-center justify-end pt-4 border-t border-[#E3DECB]">
              <button onclick="App.activeImportStep='mapeo'; App.navigateTo('importar', false)" class="btn-primario text-xs">
                <span>Siguiente: Mapeo Columnas</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- PASO 2: Configuración y Selección de Plantilla de Mapeo -->
        ${currentStep === "mapeo" ? `
          <div class="matp-card p-5 space-y-3 bg-white border border-[#E3DECB]">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E3DECB] pb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-[#F0DAD0] text-[#A23C16] font-bold text-[10px] rounded font-mono">PASO 2</span>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[#A23C16] text-[18px]">alt_route</span>
                    Mapeo de Columnas y Plantillas Reutilizables
                  </h3>
                </div>
                <p class="text-[11px] text-[#5B534C] mt-1.5 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[15px] text-[#A23C16]">info</span>
                  <span>El mapeo configurado puede guardarse y reutilizarse en cargas del mismo tipo de colección para agilizar la ingesta masiva.</span>
                </p>
              </div>

              <!-- Selector de Plantilla y Botón Guardar -->
              <div class="flex items-center gap-2 shrink-0 flex-wrap">
                <div class="flex items-center gap-1.5">
                  <label for="select-plantilla-mapeo" class="text-xs font-semibold text-[#5B534C] whitespace-nowrap">Plantilla de mapeo:</label>
                  <select
                    id="select-plantilla-mapeo"
                    class="input-matp text-xs py-1.5 font-medium min-w-[210px]"
                    onchange="App.handleSeleccionarPlantillaMapeo(this.value)"
                  >
                    <option value="pl-1" selected>Inventario Retablos 2024</option>
                    <option value="pl-2">Cerámica Cusco</option>
                    <option value="pl-3">Textiles y Danzas - Fondos históricos</option>
                    <option value="nueva">+ Crear nueva plantilla...</option>
                  </select>
                </div>

                <button
                  type="button"
                  onclick="App.handleGuardarPlantillaMapeo()"
                  class="btn-secundario text-xs py-1.5 px-3 shrink-0"
                  title="Guardar mapeo actual como plantilla reutilizable"
                >
                  <span class="material-symbols-outlined text-[16px]">bookmark_add</span>
                  <span>Guardar mapeo como plantilla</span>
                </button>
              </div>
            </div>

            <!-- Mapeo rápido de columnas del Excel con campos del MATP -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-[11px]">
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: COD_PIEZA</span>
                <strong class="text-[#0C0F14]">→ Código I</strong>
              </div>
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: DENOMINACION</span>
                <strong class="text-[#0C0F14]">→ Denominación *</strong>
              </div>
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: FONDO_COLEC</span>
                <strong class="text-[#0C0F14]">→ Colección *</strong>
              </div>
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: AUTOR_TALLER</span>
                <strong class="text-[#0C0F14]">→ Autor / Creador</strong>
              </div>
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: MATERIALES</span>
                <strong class="text-[#0C0F14]">→ Materiales (Tesauro)</strong>
              </div>
              <div class="p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                <span class="text-[#5B534C] block font-mono text-[10px]">Col: DIMENSIONES</span>
                <strong class="text-[#0C0F14]">→ Medidas / Peso</strong>
              </div>
            </div>

            <!-- Navegación del Paso -->
            <div class="flex items-center justify-between pt-4 border-t border-[#E3DECB]">
              <button onclick="App.activeImportStep='archivo'; App.navigateTo('importar', false)" class="btn-secundario text-xs">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Atrás: Archivo</span>
              </button>
              <button onclick="App.activeImportStep='tesauros'; App.navigateTo('importar', false)" class="btn-primario text-xs">
                <span>Siguiente: Validación Tesauros</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- PASO 3: Validación Tesauros -->
        ${currentStep === "tesauros" ? `
          <div class="matp-card overflow-hidden bg-white border border-[#E3DECB] space-y-0">
            <div class="px-5 py-4 border-b border-[#E3DECB] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#FAF7EE]">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-[#F0DAD0] text-[#A23C16] font-bold text-[10px] rounded font-mono">PASO 3</span>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[#A23C16] text-[18px]">fact_check</span>
                    Validación de Vocabularios Controlados y Tesauros Oficiales
                  </h3>
                </div>
                <p class="text-[11px] text-[#5B534C] mt-1">
                  Cruce semántico automático contra los tesauros del MATP. Asegura que términos de materiales, técnicas y colecciones se homologuen con la norma del museo.
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" onclick="Components.showToast('Revalidando términos contra base de tesauros MATP...', 'info')" class="btn-secundario text-xs py-1.5 px-3">
                  <span class="material-symbols-outlined text-[16px]">sync</span>
                  <span>Revalidar Tesauros</span>
                </button>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="tabla-matp">
                <thead>
                  <tr>
                    <th>Columna / Campo MATP</th>
                    <th class="text-center">Coincidentes con Tesauro</th>
                    <th class="text-center">No Reconocidos</th>
                    <th>Ejemplo de Término / Discrepancia</th>
                    <th class="text-center">Estado</th>
                    <th class="text-right">Acciones de Calidad</th>
                  </tr>
                </thead>
                <tbody>
                  ${validacionTesaurosHtml}
                </tbody>
              </table>
            </div>

            <!-- Navegación del Paso -->
            <div class="p-4 bg-white border-t border-[#E3DECB] flex items-center justify-between">
              <button onclick="App.activeImportStep='mapeo'; App.navigateTo('importar', false)" class="btn-secundario text-xs">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Atrás: Mapeo Columnas</span>
              </button>
              <button onclick="App.activeImportStep='previsualizacion'; App.navigateTo('importar', false)" class="btn-primario text-xs">
                <span>Siguiente: Previsualización y Matching</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- PASO 4: Tabla de Previsualización y Matching -->
        ${currentStep === "previsualizacion" ? `
          <div class="matp-card overflow-hidden bg-white border border-[#E3DECB]">
            <div class="px-5 py-3 border-b border-[#E3DECB] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#FAF7EE]">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-[#F0DAD0] text-[#A23C16] font-bold text-[10px] rounded font-mono">PASO 4</span>
                  <span class="text-xs font-semibold text-[#0C0F14]">
                    Previsualización y Matching · Archivo activo: <strong>${importData.archivo}</strong>
                  </span>
                </div>
                <p class="text-[11px] text-[#5B534C] mt-0.5">Revisión de consistencia sintáctica y detección de duplicados antes de la incorporación.</p>
              </div>
              <span class="chip chip-gris text-xs font-mono shrink-0">${importData.totalFilas} registros procesados</span>
            </div>

            <div class="overflow-x-auto">
              <table class="tabla-matp">
                <thead>
                  <tr>
                    <th class="w-16 text-center">Fila</th>
                    <th>Código Referencia</th>
                    <th>Denominación</th>
                    <th>Resultado Matching</th>
                    <th>Discrepancia / Regla</th>
                    <th class="text-right">Resolución</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasHtml}
                </tbody>
              </table>
            </div>

            <!-- Navegación del Paso -->
            <div class="p-4 bg-white border-t border-[#E3DECB] flex items-center justify-between">
              <button onclick="App.activeImportStep='tesauros'; App.navigateTo('importar', false)" class="btn-secundario text-xs">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Atrás: Validación Tesauros</span>
              </button>
              <button onclick="App.activeImportStep='incorporacion'; App.navigateTo('importar', false)" class="btn-primario text-xs">
                <span>Siguiente: Incorporación</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- PASO 5: Confirmación e Incorporación Final -->
        ${currentStep === "incorporacion" ? `
          <div class="matp-card p-6 space-y-6 bg-white border border-[#E3DECB]">
            <div class="border-b border-[#E3DECB] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 bg-[#F0DAD0] text-[#A23C16] font-bold text-[10px] rounded font-mono">PASO 5</span>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[#A23C16] text-[18px]">task_alt</span>
                    Confirmación Final e Incorporación al Inventario General
                  </h3>
                </div>
                <p class="text-xs text-[#5B534C] mt-1">
                  Revise el checklist de aseguramiento de calidad antes de ejecutar la escritura definitiva en el catálogo.
                </p>
              </div>
              <span class="chip chip-completa text-xs shrink-0">
                <span class="material-symbols-outlined text-[14px]">verified</span>
                Listo para aprobación
              </span>
            </div>

            <!-- Checklist de Validaciones Previas y Resumen de Impacto -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 bg-[#FAF7EE] rounded-[6px] border border-[#E3DECB] space-y-3">
                <h4 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">checklist</span>
                  Checklist de Validaciones Previas Completadas
                </h4>
                <div class="space-y-2.5 text-xs">
                  <div class="flex items-start gap-2 text-[#007438]">
                    <span class="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                    <div>
                      <p class="font-semibold text-[#0C0F14]">1. Archivo cargado e inspeccionado</p>
                      <p class="text-[11px] text-[#5B534C]">${importData.archivo} · ${importData.totalFilas} registros UTF-8 sin corrupción estructural.</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2 text-[#007438]">
                    <span class="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                    <div>
                      <p class="font-semibold text-[#0C0F14]">2. Mapeo de columnas configurado</p>
                      <p class="text-[11px] text-[#5B534C]">Campos obligatorios (Código, Denominación, Colección) asociados correctamente.</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2 text-[#007438]">
                    <span class="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                    <div>
                      <p class="font-semibold text-[#0C0F14]">3. Tesauros y vocabularios controlados validados</p>
                      <p class="text-[11px] text-[#5B534C]">Términos canónicos normalizados y discrepancias resueltas para preservación.</p>
                    </div>
                  </div>
                  <div class="flex items-start gap-2 text-[#007438]">
                    <span class="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
                    <div>
                      <p class="font-semibold text-[#0C0F14]">4. Previsualización y matching analizado</p>
                      <p class="text-[11px] text-[#5B534C]">Clasificación de nuevos, actualizaciones, duplicados y conflictos confirmada.</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Resumen de Impacto en Catálogo -->
              <div class="p-4 bg-white rounded-[6px] border border-[#E3DECB] space-y-3">
                <h4 class="text-xs font-bold uppercase tracking-wider text-[#0C0F14] flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px]">analytics</span>
                  Resumen de Impacto en Base de Datos
                </h4>
                <div class="space-y-2 text-xs">
                  <div class="flex items-center justify-between p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                    <span class="text-[#007438] font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">add_circle</span>
                      Nuevas piezas a registrar con correlativo de Código I:
                    </span>
                    <strong class="text-[#007438] font-mono">${importData.resumen.nuevos}</strong>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                    <span class="text-[#A23C16] font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">update</span>
                      Fichas existentes que actualizarán campos técnicos:
                    </span>
                    <strong class="text-[#A23C16] font-mono">${importData.resumen.actualizaciones}</strong>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                    <span class="text-[#C8791E] font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">flag</span>
                      Filas marcadas como incompletas (pendientes de completar):
                    </span>
                    <strong class="text-[#C8791E] font-mono">${importData.resumen.pendientes || 8}</strong>
                  </div>
                  <div class="flex items-center justify-between p-2 bg-[#FAF7EE] rounded border border-[#E3DECB]">
                    <span class="text-[#5B534C] font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">block</span>
                      Filas corruptas o descartadas que se omitirán:
                    </span>
                    <strong class="text-[#5B534C] font-mono">${importData.resumen.rechazados || 4}</strong>
                  </div>
                </div>
              </div>
            </div>

            <!-- Advertencia de Auditoría y Trazabilidad -->
            <div class="p-3.5 bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px] text-xs text-[#5B534C] flex items-center gap-2.5">
              <span class="material-symbols-outlined text-[#A23C16] text-[20px] shrink-0">history_edu</span>
              <span>Esta operación registrará una entrada en la <strong>Bitácora Histórica</strong> y en la auditoría general del museo asociada a su usuario institucional. Los Códigos I asignados serán inmutables según el reglamento MATP.</span>
            </div>

            <!-- Botón de Acción Principal y Navegación -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E3DECB]">
              <button onclick="App.activeImportStep='previsualizacion'; App.navigateTo('importar', false)" class="btn-secundario text-xs">
                <span class="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Atrás: Previsualización y Matching</span>
              </button>

              <button onclick="App.handleAprobarImportacion()" class="btn-primario text-xs py-2.5 px-4 font-semibold shadow-xs">
                <span class="material-symbols-outlined text-[18px]">task_alt</span>
                <span>Aprobar e Incorporar al Inventario (${importData.resumen.nuevos + importData.resumen.actualizaciones + (importData.resumen.pendientes || 8)} registros)</span>
              </button>
            </div>
          </div>
        ` : ""}

        <!-- Resumen del Lote Activo: Clasificación Completa (Siempre Visible) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div class="matp-card p-3 text-center">
            <p class="text-[11px] text-[#5B534C]">Total Filas</p>
            <p class="text-lg font-bold font-heading text-[#0C0F14]">${importData.totalFilas}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#007438]">
            <p class="text-[11px] text-[#007438]">Nuevos</p>
            <p class="text-lg font-bold font-heading text-[#007438]">${importData.resumen.nuevos}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#A23C16]">
            <p class="text-[11px] text-[#A23C16]">Actualizaciones</p>
            <p class="text-lg font-bold font-heading text-[#A23C16]">${importData.resumen.actualizaciones}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#DA546F]">
            <p class="text-[11px] text-[#DA546F]">Posibles Duplicados</p>
            <p class="text-lg font-bold font-heading text-[#DA546F]">${importData.resumen.duplicados}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#DA2A4E]">
            <p class="text-[11px] text-[#DA2A4E]">Conflictos</p>
            <p class="text-lg font-bold font-heading text-[#DA2A4E]">${importData.resumen.conflictos}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#C8791E]">
            <p class="text-[11px] text-[#C8791E]">Pendientes (Incompletas)</p>
            <p class="text-lg font-bold font-heading text-[#C8791E]">${importData.resumen.pendientes || 8}</p>
          </div>
          <div class="matp-card p-3 text-center border-b-2 border-b-[#5B534C]">
            <p class="text-[11px] text-[#5B534C]">Rechazados</p>
            <p class="text-lg font-bold font-heading text-[#5B534C]">${importData.resumen.rechazados || 4}</p>
          </div>
        </div>

        <!-- Bitácora Histórica (Siempre Visible) -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE] flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">history</span>
              Bitácora Histórica de Importaciones de Excel
            </h3>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th>Lote ID</th>
                  <th>Archivo Excel</th>
                  <th>Fecha</th>
                  <th class="text-center">Filas</th>
                  <th>Usuario</th>
                  <th class="text-center">Resultado</th>
                  <th>Observaciones / Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                ${bitacoraHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async handleAprobarImportacion() {
    await API.aprobarImportacion("lote-activo");
    Components.showToast("Lote incorporado exitosamente al inventario general", "exito");
    App.navigateTo("dashboard");
  },

  handleGuardarPlantillaMapeo() {
    const select = document.getElementById("select-plantilla-mapeo");
    const nombre = select && select.options[select.selectedIndex] ? select.options[select.selectedIndex].text : "Plantilla personalizada";
    Components.showToast(`Mapeo guardado como plantilla: "${nombre}". Lista para reutilizar en futuros lotes.`, "exito");
  },

  handleSeleccionarPlantillaMapeo(val) {
    if (val === "nueva") {
      Components.showToast("Configure las columnas y pulse 'Guardar mapeo como plantilla'", "info");
    } else {
      const select = document.getElementById("select-plantilla-mapeo");
      const nombre = select ? select.options[select.selectedIndex].text : val;
      Components.showToast(`Plantilla "${nombre}" aplicada. Columnas mapeadas automáticamente.`, "exito");
    }
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (10): REPORTES E INVENTARIOS (M5)
  // ══════════════════════════════════════════════════════════════
  async renderReportes() {
    const reportes = await API.getReportes();

    const reportesHtml = reportes.map(r => `
      <div class="matp-card p-5 space-y-3 hover:shadow-md transition-shadow">
        <div class="flex items-start justify-between">
          <div class="w-9 h-9 rounded bg-[#F0DAD0] text-[#A23C16] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[20px]">assessment</span>
          </div>
          <span class="chip chip-completa text-[10px] font-mono">${r.formatoSugerido || "XLSX"}</span>
        </div>
        <div>
          <h3 class="text-sm font-bold font-heading text-[#0C0F14]">${r.titulo}</h3>
          <p class="text-xs text-[#5B534C] mt-1 leading-relaxed">${r.descripcion}</p>
        </div>
        <div class="pt-3 border-t border-[#E3DECB] flex items-center justify-between text-xs">
          <span class="text-[#5B534C] font-mono font-medium">${r.registrosSimulados.toLocaleString()} registros</span>
          <button onclick="Components.showToast('Reporte \"${r.titulo}\" generado y descargado', 'exito')" class="btn-secundario py-1 px-3 text-xs">
            <span class="material-symbols-outlined text-[14px]">download</span>
            <span>Exportar</span>
          </button>
        </div>
      </div>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado de Reportes -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 5 · Consultas Patrimoniales e Informes</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Módulo de Reportes e Inventarios</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Generación de informes consolidados de inventario patrimonial, auditoría de completitud y topografía.
            </p>
          </div>
          <button onclick="Components.showToast('Generando consolidado general...', 'info')" class="btn-primario text-xs shrink-0">
            <span class="material-symbols-outlined text-[16px]">file_download</span>
            <span>Descargar Inventario General</span>
          </button>
        </div>

        <!-- Catálogo de Reportes Preconfigurados -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${reportesHtml}
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (11): USUARIOS, ROLES Y SEGURIDAD (M6)
  // ══════════════════════════════════════════════════════════════
  async renderUsuarios() {
    const usuarios = await API.getUsuarios();
    const permisos = await API.getPermisos();
    const auditoria = await API.getAuditoria();

    const usuariosHtml = usuarios.map(u => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-semibold text-[#0C0F14] flex items-center gap-2 py-3">
          <div class="w-7 h-7 rounded-full bg-[#F0DAD0] text-[#A23C16] flex items-center justify-center font-bold text-[10px]">
            ${u.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
          </div>
          <span>${u.nombre}</span>
        </td>
        <td class="text-[#5B534C] font-mono">${u.correo}</td>
        <td>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FAF7EE] border border-[#E3DECB] text-[#0C0F14]">
            ${u.rol}
          </span>
        </td>
        <td class="text-center">
          <span class="chip ${u.estado.includes("Activo") ? "chip-completa" : "chip-incompleta"} text-[10px]">${u.estado}</span>
        </td>
        <td class="text-[#5B534C]">${u.ultimoAcceso}</td>
        <td class="text-right">
          <button onclick="Components.showToast('Permisos de ${u.nombre} actualizados', 'info')" class="btn-texto py-1 px-2 text-xs">
            <span class="material-symbols-outlined text-[16px]">edit</span>
          </button>
        </td>
      </tr>
    `).join("");

    const permisosHtml = permisos.map(p => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-medium text-[#0C0F14] py-2.5">${p.modulo}</td>
        ${p.roles.map(r => `
          <td class="text-center">
            <span class="material-symbols-outlined text-[16px] ${r ? "text-[#007438]" : "text-[#E3DECB]"}">
              ${r ? "check_circle" : "cancel"}
            </span>
          </td>
        `).join("")}
      </tr>
    `).join("");

    const auditoriaHtml = auditoria.map(a => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-mono text-[#5B534C] whitespace-nowrap">${a.fecha}</td>
        <td class="font-semibold text-[#0C0F14]">${a.usuario}</td>
        <td class="text-[#A23C16] font-medium">${a.accion}</td>
        <td class="text-[#5B534C]">${a.pieza || "—"}</td>
        <td class="text-[11px] text-[#5B534C]">De: <em>${a.anterior}</em> → A: <strong>${a.nuevo}</strong></td>
      </tr>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Encabezado de Usuarios -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 6 · Seguridad y Control de Acceso</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Usuarios, Roles y Permisos Granulares</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Gestión de credenciales institucionales PUCP, roles museográficos y matriz de seguridad.
            </p>
          </div>
          <button onclick="Components.showToast('Acceso limitado al Administrador Central del Sistema', 'alerta')" class="btn-primario text-xs shrink-0">
            <span class="material-symbols-outlined text-[16px]">person_add</span>
            <span>Invitar Usuario</span>
          </button>
        </div>

        <!-- Directorio de Usuarios -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE] flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16]">Directorio de Personal Autorizado MATP</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo Institucional</th>
                  <th>Rol Asignado</th>
                  <th class="text-center">Estado</th>
                  <th>Último Acceso</th>
                  <th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${usuariosHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Matriz Cruzada de Permisos por Rol -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE]">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16]">Matriz de Permisos por Rol</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th>Módulo / Acción</th>
                  <th class="text-center">Curador</th>
                  <th class="text-center">Admin</th>
                  <th class="text-center">Catalogador</th>
                  <th class="text-center">Conservador</th>
                  <th class="text-center">Consulta Int.</th>
                  <th class="text-center">Consulta Ext.</th>
                </tr>
              </thead>
              <tbody>
                ${permisosHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Auditoría del Sistema -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE]">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16]">Bitácora de Auditoría y Trazabilidad</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Registro</th>
                  <th>Detalle del Cambio</th>
                </tr>
              </thead>
              <tbody>
                ${auditoriaHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ══════════════════════════════════════════════════════════════
  // PANTALLA (12): CONFIGURACIÓN (M7) [NUEVO — AHORA CON CONTENIDO REAL]
  // ══════════════════════════════════════════════════════════════
  async renderConfiguracion() {
    const config = await API.getConfiguracion();

    const idsHtml = config.tiposIdentificador.map(i => `
      <tr class="hover:bg-[#FAF7EE] border-b border-[#E3DECB] text-xs">
        <td class="font-bold text-[#0C0F14]">${i.tipo}</td>
        <td class="font-mono text-[#A23C16] font-semibold">${i.formato}</td>
        <td class="text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${i.obligatorio ? "bg-[#F0DAD0] text-[#A23C16]" : "bg-[#FAF7EE] text-[#5B534C]"}">
            ${i.obligatorio ? "Obligatorio" : "Opcional"}
          </span>
        </td>
        <td class="text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${i.inmutable ? "bg-[#E1EFD8] text-[#007438]" : "bg-[#FAF7EE] text-[#5B534C]"}">
            ${i.inmutable ? "Inmutable" : "Editable"}
          </span>
        </td>
        <td class="text-[11px] text-[#5B534C]">${i.descripcion}</td>
      </tr>
    `).join("");

    return `
      <div class="space-y-6 animate-fade-in max-w-5xl mx-auto">
        <!-- Encabezado de Configuración -->
        <div class="matp-card p-6 border-l-4 border-l-[#A23C16] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold uppercase tracking-wider text-[#A23C16]">Módulo 7 · Parametrización Transversal</span>
            <h2 class="text-xl font-bold font-heading text-[#0C0F14]">Configuración y Parámetros del Sistema</h2>
            <p class="text-xs text-[#5B534C] mt-1">
              Principio transversal: Todo parámetro es configurable directamente en la interfaz sin requerir cambios de código.
            </p>
          </div>
          <button onclick="App.handleGuardarConfiguracion()" class="btn-primario text-xs shrink-0">
            <span class="material-symbols-outlined text-[16px]">save</span>
            <span>Guardar Parámetros</span>
          </button>
        </div>

        <!-- Sección 1: Datos Institucionales -->
        <div class="matp-card p-6 space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-2 border-b border-[#E3DECB] pb-2">
            <span class="material-symbols-outlined text-[18px]">account_balance</span>
            1. Datos Institucionales y Sede Central
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Nombre Institucional</label>
              <input type="text" id="cfg-nombre" value="${config.institucion.nombre}" class="input-matp text-xs" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Siglas Oficiales</label>
              <input type="text" id="cfg-siglas" value="${config.institucion.siglas}" class="input-matp text-xs font-bold" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Dirección / Sede Principal</label>
              <input type="text" id="cfg-sede" value="${config.institucion.sedePrincipal}" class="input-matp text-xs" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-[#0C0F14] mb-1">Correo de Contacto Institucional</label>
              <input type="email" id="cfg-correo" value="${config.institucion.correo}" class="input-matp text-xs font-mono" />
            </div>
          </div>
        </div>

        <!-- Sección 2: Identificadores Admitidos -->
        <div class="matp-card overflow-hidden">
          <div class="px-5 py-3 border-b border-[#E3DECB] bg-[#FAF7EE] flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">tag</span>
              2. Tipos de Identificador de Bienes Culturales
            </h3>
            <span class="text-[11px] text-[#5B534C]">Reglas inmutables y de autogeneración</span>
          </div>

          <div class="overflow-x-auto">
            <table class="tabla-matp">
              <thead>
                <tr>
                  <th>Tipo de Identificador</th>
                  <th>Formato / Máscara</th>
                  <th class="text-center">Exigibilidad</th>
                  <th class="text-center">Mutabilidad</th>
                  <th>Propósito Patrimonial</th>
                </tr>
              </thead>
              <tbody>
                ${idsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Sección 3: Reglas de Calidad e Importación -->
        <div class="matp-card p-6 space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-[#A23C16] flex items-center gap-2 border-b border-[#E3DECB] pb-2">
            <span class="material-symbols-outlined text-[18px]">rule</span>
            3. Reglas de Completitud e Importación Masiva
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div class="space-y-3">
              <p class="font-semibold text-[#0C0F14]">Criterios para considerar una ficha "Completa":</p>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked class="rounded text-[#A23C16] focus:ring-[#A23C16]" />
                <span>Exigir fotografía principal registrada</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked class="rounded text-[#A23C16] focus:ring-[#A23C16]" />
                <span>Exigir ubicación topográfica asignada en depósito</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked class="rounded text-[#A23C16] focus:ring-[#A23C16]" />
                <span>Condicionar Código I exclusivamente al régimen de propiedad</span>
              </label>
            </div>

            <div class="space-y-3">
              <p class="font-semibold text-[#0C0F14]">Reglas de Ingesta Masiva y Matching:</p>
              <div>
                <label class="block text-[11px] font-semibold text-[#5B534C] mb-1">Umbral de Similitud para Detección de Duplicados</label>
                <select class="input-matp text-xs">
                  <option value="85%" selected>85% (Recomendado para arte popular)</option>
                  <option value="90%">90% (Estricto)</option>
                  <option value="75%">75% (Flexible)</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-[#5B534C] mb-1">Acción ante términos fuera de tesauro</label>
                <select class="input-matp text-xs">
                  <option value="advertir" selected>Advertir y sugerir sinónimo más cercano</option>
                  <option value="rechazar">Rechazar fila en validación</option>
                  <option value="crear">Crear automáticamente como término borrador</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleGuardarConfiguracion() {
    const nombre = document.getElementById("cfg-nombre")?.value;
    const siglas = document.getElementById("cfg-siglas")?.value;
    const sede = document.getElementById("cfg-sede")?.value;
    const correo = document.getElementById("cfg-correo")?.value;

    const config = await API.getConfiguracion();
    if (!config.institucion) config.institucion = {};
    if (nombre) config.institucion.nombre = nombre;
    if (siglas) config.institucion.siglas = siglas;
    if (sede) config.institucion.sedePrincipal = sede;
    if (correo) config.institucion.correo = correo;

    await API.saveConfiguracion(config);
    Components.showToast("Parámetros de configuración guardados con éxito", "exito");
  }
};

if (typeof window !== "undefined") {
  window.App = App;
}
