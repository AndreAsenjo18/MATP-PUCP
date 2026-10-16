/**
 * ══════════════════════════════════════════════════════════════
 * js/components.js — Componentes reutilizables UI para MATP - PUCP
 * Versión 2 — Catálogo Consolidado (M1 a M7)
 * Renderizado puro y determinista guiado por el Sistema de Diseño Oficial.
 * ══════════════════════════════════════════════════════════════
 */

const Components = {
  /**
   * Renderiza el chip de estado unificado del MATP
   * Chips estandarizados: Completa, Sin código I, Sin foto, Sin ubicación, Ficha incompleta, Duplicado, Conflicto, Nuevo, Actualización
   */
  renderChipEstado(estado, tipo) {
    let clase = "chip-incompleta";
    let icono = "warning";
    const e = (tipo || estado || "").toLowerCase();

    if (e.includes("completa") || e.includes("aprobada") || e === "nuevo" || e.includes("activo")) {
      clase = "chip-completa";
      icono = "check_circle";
    } else if (e.includes("rechazad")) {
      clase = "chip-rechazado";
      icono = "cancel";
    } else if (e.includes("pendiente")) {
      clase = "chip-pendiente";
      icono = "warning";
    } else if (e.includes("duplicado")) {
      clase = "chip-duplicado";
      icono = "rule";
    } else if (e.includes("conflicto") || e.includes("error")) {
      clase = "chip-conflicto";
      icono = "warning";
    } else if (e.includes("actualizacion") || e.includes("actualización")) {
      clase = "chip-actualizacion";
      icono = "history";
    } else if (e.includes("codigo") || e.includes("código")) {
      clase = "chip-sin-codigo";
      icono = "tag";
    } else if (e.includes("foto")) {
      clase = "chip-sin-foto";
      icono = "photo_library";
    } else if (e.includes("ubicacion") || e.includes("ubicación")) {
      clase = "chip-sin-ubicacion";
      icono = "location_on";
    }

    return `
      <span class="chip ${clase}">
        <span class="material-symbols-outlined" style="font-size:14px;">${icono}</span>
        <span>${estado}</span>
      </span>
    `;
  },

  /**
   * Renderiza badge de prioridad: Alta=terracota, Media=ámbar, Baja=gris
   */
  renderBadgePrioridad(prioridad) {
    const p = (prioridad || "").toLowerCase();
    let clase = "badge-prioridad-baja";
    if (p === "alta") clase = "badge-prioridad-alta";
    else if (p === "media") clase = "badge-prioridad-media";
    return `<span class="badge-prioridad ${clase}">${prioridad}</span>`;
  },

  /**
   * Sidebar lateral fijo (240px)
   * Ítems normalizados según requisitos v2:
   * - Dashboard — dashboard
   * - Piezas (Catálogo) — inventory_2
   * - Colecciones — collections_bookmark
   * - Tesauros y vocabularios — account_tree
   * - Ubicaciones — location_on
   * - Importación — upload_file
   * - Reportes — assessment
   * - Usuarios y roles — admin_panel_settings
   * - Configuración — settings
   */
  renderSidebar(activeScreen = "dashboard") {
    const navItems = [
      { id: "dashboard", label: "Dashboard", icon: "dashboard" },
      { id: "catalogo", label: "Piezas (Catálogo)", icon: "inventory_2" },
      { id: "colecciones", label: "Colecciones", icon: "collections_bookmark" },
      { id: "tesauros", label: "Tesauros y vocabularios", icon: "account_tree" },
      { id: "ubicacion", label: "Ubicaciones", icon: "location_on" },
      { id: "importar", label: "Importación", icon: "upload_file" },
      { id: "reportes", label: "Reportes", icon: "assessment" },
      { id: "usuarios", label: "Usuarios y roles", icon: "admin_panel_settings" },
      { id: "configuracion", label: "Configuración", icon: "settings" }
    ];

    const itemsHtml = navItems.map(item => {
      const isActive = activeScreen === item.id ||
        (item.id === "catalogo" && (activeScreen === "ficha" || activeScreen === "registro"));
      const activeClasses = isActive
        ? "bg-[#A23C16] text-white font-medium shadow-sm"
        : "text-[#FAF7EE]/80 hover:bg-[#A23C16]/20 hover:text-white";

      return `
        <button
          onclick="App.navigateTo('${item.id}')"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-xs text-left transition-all ${activeClasses}"
          id="nav-${item.id}"
          title="${item.label}"
        >
          <span class="material-symbols-outlined" style="font-size:20px;">${item.icon}</span>
          <span class="truncate">${item.label}</span>
        </button>
      `;
    }).join("");

    return `
      <aside class="w-60 bg-[#0C0F14] text-white flex flex-col shrink-0 min-h-screen border-r border-[#E3DECB]/20 select-none">
        <!-- Logo MATP Oficial (Círculo terracota con siglas MATP en blanco) -->
        <div class="p-4 border-b border-white/10 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[#A23C16] flex items-center justify-center font-bold text-white text-sm tracking-wider shrink-0 shadow-sm ring-2 ring-white/10">
            MATP
          </div>
          <div class="leading-tight overflow-hidden">
            <h1 class="text-xs font-semibold text-white tracking-wide font-heading truncate">MATP – PUCP</h1>
            <p class="text-[10px] text-[#FAF7EE]/60 truncate">Colecciones Museográficas</p>
          </div>
        </div>

        <!-- Navegación Institucional (M1 - M7) -->
        <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-[#FAF7EE]/40 px-3 mb-2">
            Módulos Principales
          </div>
          ${itemsHtml}
        </nav>

        <!-- Indicador de Versión y Estado -->
        <div class="p-3 border-t border-white/10 text-[11px] text-[#FAF7EE]/60 bg-black/20">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] font-mono uppercase text-[#A4C35F] flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[#A4C35F] animate-pulse"></span>
              En línea · v2.0
            </span>
            <span class="text-[10px] text-white/40">PUCP</span>
          </div>
          <div class="text-[10px] text-white/50 truncate">
            Jr. Camaná 459 · Lima
          </div>
        </div>
      </aside>
    `;
  },

  /**
   * Barra superior (Topbar) unificada
   */
  renderTopbar(breadcrumb = "Dashboard", quickActionHtml = "", mostrarBusqueda = false) {
    if (typeof quickActionHtml === "boolean") {
      mostrarBusqueda = quickActionHtml;
      quickActionHtml = "";
    }

    return `
      <header class="bg-white border-b border-[#E3DECB] px-6 py-3 flex items-center justify-between shrink-0 shadow-xs sticky top-0 z-20">
        <!-- Breadcrumb / Título de la pantalla -->
        <div class="flex items-center gap-2">
          <button
            onclick="App.navigateTo('dashboard')"
            class="text-[#5B534C] hover:text-[#A23C16] transition-colors flex items-center"
            title="Ir al Dashboard"
          >
            <span class="material-symbols-outlined" style="font-size:18px;">home</span>
          </button>
          <span class="text-xs text-[#5B534C] font-mono">/</span>
          <span class="text-sm font-semibold text-[#0C0F14] font-heading tracking-wide">${breadcrumb}</span>
        </div>

        <!-- Acciones rápidas y Perfil del Curador -->
        <div class="flex items-center gap-3">
          ${quickActionHtml}

          ${mostrarBusqueda ? `
            <!-- Buscador Global Rápido -->
            <div class="relative hidden sm:block">
              <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5B534C] text-[18px]">search</span>
              <input
                type="text"
                placeholder="Buscar por código I o término..."
                class="w-48 lg:w-64 pl-8 pr-3 py-1.5 text-xs bg-[#FAF7EE] border border-[#E3DECB] rounded-[6px] focus:outline-none focus:border-[#A23C16] focus:bg-white transition-all text-[#0C0F14]"
                onkeydown="if(event.key==='Enter'){ App.filtrosCatalogo.q=this.value; App.navigateTo('catalogo'); }"
              />
            </div>
          ` : ""}

          <!-- Divisor -->
          <div class="h-6 w-px bg-[#E3DECB]"></div>

          <!-- Perfil Curador -->
          <div class="flex items-center gap-2.5 pl-1">
            <div class="w-8 h-8 rounded-full bg-[#F0DAD0] text-[#A23C16] flex items-center justify-center font-bold text-xs ring-1 ring-[#A23C16]/30 shadow-xs">
              ${MOCK.curador.iniciales}
            </div>
            <div class="hidden md:block text-left leading-tight">
              <p class="text-xs font-medium text-[#0C0F14] truncate max-w-[150px]">${MOCK.curador.nombre}</p>
              <p class="text-[10px] text-[#5B534C] truncate">${MOCK.curador.cargo}</p>
            </div>
            <button
              onclick="App.navigateTo('login')"
              class="text-[#5B534C] hover:text-[#DA2A4E] transition-colors p-1 rounded hover:bg-[#F7D9DF]/40"
              title="Cerrar sesión de uso interno"
            >
              <span class="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </header>
    `;
  },

  /**
   * Tarjetas KPI del Dashboard
   */
  renderKpiCard(titulo, valor, subtitulo, icono, tipoColor = "neutral", onClickAction = "") {
    let iconBg = "bg-[#FAF7EE] text-[#5B534C]";
    let borderAccent = "border-[#E3DECB]";

    if (tipoColor === "terracota") {
      iconBg = "bg-[#F0DAD0] text-[#A23C16]";
      borderAccent = "border-l-4 border-l-[#A23C16]";
    } else if (tipoColor === "verde") {
      iconBg = "bg-[#E1EFD8] text-[#007438]";
      borderAccent = "border-l-4 border-l-[#007438]";
    } else if (tipoColor === "ambar") {
      iconBg = "bg-[#F5E4CC] text-[#C8791E]";
      borderAccent = "border-l-4 border-l-[#C8791E]";
    } else if (tipoColor === "carmin") {
      iconBg = "bg-[#F7D9DF] text-[#DA2A4E]";
      borderAccent = "border-l-4 border-l-[#DA2A4E]";
    }

    const clickClass = onClickAction ? "cursor-pointer hover:shadow-md transition-shadow" : "";

    return `
      <div class="matp-card p-4 ${borderAccent} ${clickClass}" ${onClickAction ? `onclick="${onClickAction}"` : ""}>
        <div class="flex items-start justify-between">
          <div>
            <p class="text-xs font-medium text-[#5B534C]">${titulo}</p>
            <h3 class="text-2xl font-bold font-heading text-[#0C0F14] mt-1">${valor}</h3>
            <p class="text-[11px] text-[#5B534C] mt-1">${subtitulo}</p>
          </div>
          <div class="w-10 h-10 rounded-[8px] ${iconBg} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[22px]">${icono}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Renderiza el contenedor modal institucional
   */
  renderModal(id, titulo, bodyHtml, footerHtml = "") {
    return `
      <div id="${id}" class="fixed inset-0 z-50 bg-[#0C0F14]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white rounded-[8px] border border-[#E3DECB] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-[#E3DECB] flex items-center justify-between bg-[#FAF7EE]">
            <h3 class="text-base font-semibold text-[#0C0F14] font-heading flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#A23C16]"></span>
              ${titulo}
            </h3>
            <button onclick="Components.closeModal('${id}')" class="text-[#5B534C] hover:text-[#DA2A4E] transition-colors p-1">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Body con scroll -->
          <div class="p-6 overflow-y-auto flex-1 space-y-4 text-sm text-[#0C0F14]">
            ${bodyHtml}
          </div>

          <!-- Footer -->
          ${footerHtml ? `
            <div class="px-6 py-3 border-t border-[#E3DECB] bg-[#FAF7EE] flex items-center justify-end gap-3">
              ${footerHtml}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  },

  /**
   * Muestra un modal en el contenedor global
   */
  showModal(html) {
    const container = document.getElementById("modal-container");
    if (container) {
      container.innerHTML = html;
    }
  },

  /**
   * Cierra el modal activo
   */
  closeModal(modalId) {
    const el = document.getElementById(modalId) || document.getElementById("modal-container");
    if (el) {
      if (el.id === "modal-container") el.innerHTML = "";
      else el.remove();
    }
  },

  /**
   * Muestra un toast institucional en la esquina superior derecha
   */
  showToast(mensaje, tipo = "exito") {
    let bg = "bg-[#007438] text-white";
    let icono = "task_alt";

    if (tipo === "alerta") {
      bg = "bg-[#C8791E] text-white";
      icono = "warning";
    } else if (tipo === "error") {
      bg = "bg-[#DA2A4E] text-white";
      icono = "error";
    } else if (tipo === "info") {
      bg = "bg-[#0C0F14] text-white";
      icono = "info";
    }

    const toast = document.createElement("div");
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-[6px] shadow-lg flex items-center gap-2.5 text-xs font-medium ${bg} transition-all duration-300`;
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[18px]">${icono}</span>
      <span>${mensaje}</span>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
};

if (typeof window !== "undefined") {
  window.Components = Components;
}
