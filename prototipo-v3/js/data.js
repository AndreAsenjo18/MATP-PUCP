/**
 * ══════════════════════════════════════════════════════════════
 * js/data.js — Fuente única de datos de prueba realistas (MOCK)
 * Museo de Artes y Tradiciones Populares "Luis Repetto Málaga" (MATP - PUCP)
 * Versión 2 — Catálogo de Requisitos Consolidado + Benchmarking MAPA Chile
 * ══════════════════════════════════════════════════════════════
 */

const MOCK = {
  // Metadatos globales y usuario en sesión
  curador: {
    nombre: "Gabriela Mejía Valdivia",
    cargo: "Curadora Principal",
    iniciales: "GM",
    institucion: "MATP – PUCP",
    correo: "gmejia@pucp.edu.pe"
  },

  // Indicadores KPI del Dashboard
  kpis: {
    totalPiezas: 10412,
    sinCodigoI: 6120,
    sinFoto: 3940,
    sinUbicacion: 2180,
    completitudPorcentaje: 41.2,
    piezasCompletas: 4292
  },

  // Distribución por Colección (conteos reales de filas de las bases de datos estandarizadas del museo, 2025)
  distribucionColecciones: [
    { nombre: "Colección Arturo Jiménez Borja (AJB)", clave: "AJB", total: 4200, porcentaje: 63.6 },
    { nombre: "Colección Guillermo Ugarte Chamorro", clave: "GUC", total: 1035, porcentaje: 15.7 },
    { nombre: "Colección Plus Petrol", clave: "PLUSP", total: 669, porcentaje: 10.1 },
    { nombre: "Colección Nilda Anglarill", clave: "NA", total: 419, porcentaje: 6.3 },
    { nombre: "Colección Mildred Merino de Zela (MMZ)", clave: "MMZ", total: 276, porcentaje: 4.2 }
  ],

  // M1: Colecciones y Fondos del Museo (nombres, siglas y conteos reales de "BD ESTANDARIZADAS AL 2025")
  colecciones: [
    {
      id: "col-1",
      clave: "AJB",
      nombre: "Colección Arturo Jiménez Borja",
      sigla: "AJB",
      curador: "Gabriela Mejía Valdivia",
      anioIngreso: 1978,
      piezas: 4200,
      porcentajeDigital: 68.4,
      estado: "Activa",
      tipoFondo: "Colección en comodato",
      descripcion: "Conjunto seminal de arte popular peruano recopilado por el médico y antropólogo Arturo Jiménez Borja, custodiado en comodato por el MATP (propietario: Luis Alfredo Jiménez Borja). Las piezas no reciben Código I definitivo mientras dure el comodato (RN-003). Más de 40 lotes de fichas de catalogación digitalizadas, con códigos de propietario AJB 001 a AJB 6098."
    },
    {
      id: "col-2",
      clave: "MMZ",
      nombre: "Colección Mildred Merino de Zela",
      sigla: "MMZ",
      curador: "Carlos Alarcón Soto",
      anioIngreso: 1978,
      piezas: 276,
      porcentajeDigital: 52.1,
      estado: "Activa",
      tipoFondo: "Fondo de propiedad definitiva",
      descripcion: "Conjunto recopilado por la folklorista Mildred Merino de Zela, principalmente cerámica ayacuchana tradicional: iglesias, figuras del nacimiento y animales modelados en arcilla con engobe y pintura."
    },
    {
      id: "col-3",
      clave: "FJT",
      nombre: "Colección Florentino Jiménez Toma",
      sigla: "FJT",
      curador: "Gabriela Mejía Valdivia",
      anioIngreso: 2015,
      piezas: 46,
      porcentajeDigital: 84.6,
      estado: "Activa",
      tipoFondo: "Fondo monográfico de autor (donación PUCP)",
      descripcion: "Retablos policromados donados a la PUCP, obra del maestro ayacuchano Florentino Jiménez Toma, con escenas costumbristas y agrícolas (cosecha del maíz, faenas comunales)."
    },
    {
      id: "col-4",
      clave: "GERSOL",
      nombre: "Colección Gertrud Bramberger de Solari",
      sigla: "GERSOL",
      curador: "Mariana Silva Thorne",
      anioIngreso: 1990,
      piezas: 118,
      porcentajeDigital: 45.0,
      estado: "Activa",
      tipoFondo: "Fondo temático textil",
      descripcion: "Fajas, llautos y textilería prehispánica y colonial de la costa central y sur del Perú (Santa Isabel de Sihuas - Arequipa), con técnicas de tapiz kelim y tejido de urdimbre de doble cara."
    },
    {
      id: "col-5",
      clave: "MBV",
      nombre: "Colección Mariano Benites Villanueva",
      sigla: "MBV",
      curador: "Roberto Sandoval Ruiz",
      anioIngreso: 1980,
      piezas: 155,
      porcentajeDigital: 39.2,
      estado: "Activa",
      tipoFondo: "Fondo de propiedad definitiva",
      descripcion: "Cerámica escultórica ayacuchana del taller Tineo: nacimientos, imaginería religiosa y figuras costumbristas en barro modelado y pintado."
    },
    {
      id: "col-6",
      clave: "DGP",
      nombre: "Colección Doris Gibson Parra",
      sigla: "DGP",
      curador: "Gabriela Mejía Valdivia",
      anioIngreso: 2002,
      piezas: 118,
      porcentajeDigital: 52.0,
      estado: "Activa",
      tipoFondo: "Fondo de propiedad definitiva",
      descripcion: "Esculturas y tallas cusqueñas del santero Hilario Mendívil, incluyendo representaciones procesionales del Corpus Christi con santos patronos."
    },
    {
      id: "col-7",
      clave: "ACG",
      nombre: "Colección Alfonso Cabrera Ganoza",
      sigla: "ACG",
      curador: "Carlos Alarcón Soto",
      anioIngreso: 1981,
      piezas: 71,
      porcentajeDigital: 41.0,
      estado: "Activa",
      tipoFondo: "Fondo de propiedad definitiva",
      descripcion: "Colección mixta de pintura colonial sobre cuero, cerámica shipiba-conibo y piezas metálicas, donada por Alfredo Cabrera Ganoza. Contiene varios registros con errores de codificación aún pendientes de corrección (ver Calidad de Datos)."
    },
    {
      id: "col-8",
      clave: "RAB",
      nombre: "Colección Raúl Apesteguía Bresciani",
      sigla: "RAB",
      curador: "Mariana Silva Thorne",
      anioIngreso: 1992,
      piezas: 39,
      porcentajeDigital: 58.0,
      estado: "Activa",
      tipoFondo: "Fondo de propiedad definitiva",
      descripcion: "Cerámica ceremonial cusqueña y mates burilados piuranos, donados por Raúl Apesteguía Barandarián."
    }
  ],

  // M2: Tesauros y Vocabularios Controlados (Benchmarking MAPA Chile y catalogación estandarizada)
  tesauros: {
    tiposBien: [
      { id: "tb-1", termino: "Cerámica", sinonimos: "Alfarería popular, barro vidriado, modelado", uri: "VOC-MATP-TB-01", piezas: 1890, estado: "Activo", descripcion: "Objetos modelados en arcilla cocida: iglesias, animales, figuras del nacimiento y vasijas ceremoniales andinas." },
      { id: "tb-2", termino: "Escultura y talla", sinonimos: "Imaginería, bulto devocional", uri: "VOC-MATP-TB-02", piezas: 640, estado: "Activo", descripcion: "Representaciones talladas o modeladas en madera, pasta y espejos de santos, procesiones y escenas devocionales." },
      { id: "tb-3", termino: "Textilería e Indumentaria", sinonimos: "Faja, llauto, tapiz, traje de danza", uri: "VOC-MATP-TB-03", piezas: 465, estado: "Activo", descripcion: "Prendas y fajas tejidas en telar de cintura, tapiz kelim o urdimbre de doble cara." },
      { id: "tb-4", termino: "Máscara", sinonimos: "Careta festiva, máscara de danza", uri: "VOC-MATP-TB-04", piezas: 310, estado: "Activo", descripcion: "Elemento de transformación facial confeccionado en hojalata, malla metálica, yeso, pasta, cuero o madera." },
      { id: "tb-5", termino: "Pintura", sinonimos: "Tela pintada, pintura sobre cuero", uri: "VOC-MATP-TB-05", piezas: 210, estado: "Activo", descripcion: "Obras pictóricas sobre cuero, tela o lienzo con temática religiosa o costumbrista." },
      { id: "tb-6", termino: "Mate", sinonimos: "Mate burilado, calabaza pirograbada", uri: "VOC-MATP-TB-06", piezas: 185, estado: "Activo", descripcion: "Fruto de calabaza seca cuya corteza es cortada, quemada y burilada o pirograbada con narrativas populares." }
    ],
    materiales: [
      { id: "mat-1", termino: "Cerámica", sinonimos: "Arcilla modelada y cocida", uri: "VOC-MATP-MAT-01", piezas: 1890, estado: "Activo", descripcion: "Material base de la mayor parte de las colecciones de figuras devocionales y costumbristas del museo." },
      { id: "mat-2", termino: "Madera", sinonimos: "Madera de cedro, madera y pasta", uri: "VOC-MATP-MAT-02", piezas: 540, estado: "Activo", descripcion: "Soporte de retablos, esculturas y tallas; frecuentemente combinada con pasta y pigmentos al temple." },
      { id: "mat-3", termino: "Lana", sinonimos: "Fibra de ovino, lana con tintes naturales", uri: "VOC-MATP-MAT-03", piezas: 320, estado: "Activo", descripcion: "Fibra hilada y teñida artesanalmente empleada en fajas, llautos y tapices." },
      { id: "mat-4", termino: "Algodón", sinonimos: "Fibra vegetal textil", uri: "VOC-MATP-MAT-04", piezas: 180, estado: "Activo", descripcion: "Fibra empleada en textilería prehispánica de la costa central." },
      { id: "mat-5", termino: "Calabaza (Lagenaria siceraria)", sinonimos: "Mate, porongo", uri: "VOC-MATP-MAT-05", piezas: 185, estado: "Activo", descripcion: "Corteza de calabaza desecada para burilado fino y quemado al fuego." },
      { id: "mat-6", termino: "Hojalata", sinonimos: "Lámina metálica moldeada", uri: "VOC-MATP-MAT-06", piezas: 150, estado: "Activo", descripcion: "Lámina metálica moldeada y pintada usada en máscaras festivas, combinada con papel y tela." }
    ],
    procedencias: [
      { id: "proc-1", termino: "Ayacucho, Perú", sinonimos: "Huamanga, Ayacucho centro", uri: "VOC-MATP-GEO-01", piezas: 1720, estado: "Activo", descripcion: "Cuna del retablo peruano, la imaginería devocional y la cerámica policromada de iglesias y figuras del nacimiento." },
      { id: "proc-2", termino: "Cusco, Perú", sinonimos: "Cusco ciudad, Cusco provincias", uri: "VOC-MATP-GEO-02", piezas: 980, estado: "Activo", descripcion: "Procedencia de cerámica ceremonial, mocahuas shipibas-conibas y esculturas procesionales de santeros cusqueños." },
      { id: "proc-3", termino: "Costa Central, Perú", sinonimos: "Lima, costa centro-sur", uri: "VOC-MATP-GEO-03", piezas: 340, estado: "Activo", descripcion: "Procedencia de textilería prehispánica en algodón de la colección Gertrud Bramberger de Solari." },
      { id: "proc-4", termino: "Santa Isabel de Sihuas, Arequipa, Perú", sinonimos: "Arequipa sur", uri: "VOC-MATP-GEO-04", piezas: 160, estado: "Activo", descripcion: "Procedencia de fajas y llautos prehispánicos tejidos en urdimbre de doble cara." },
      { id: "proc-5", termino: "Cajamarca, Perú", sinonimos: "Cajabamba", uri: "VOC-MATP-GEO-05", piezas: 95, estado: "Activo", descripcion: "Procedencia de máscaras festivas de hojalata de la colección en comodato Arturo Jiménez Borja." }
    ],
    regimenes: [
      { id: "reg-1", termino: "Propiedad definitiva", codigo: "PROP", inmutableCodigoI: true, descripcion: "Pieza adquirida o donada en propiedad patrimonial de la PUCP / MATP. Exige Código I inmutable." },
      { id: "reg-2", termino: "Comodato familiar / institucional", codigo: "COMODATO", inmutableCodigoI: false, descripcion: "Pieza cedida temporalmente para custodia y exhibición. NO recibe Código I definitivo según reglamento." },
      { id: "reg-3", termino: "Depósito temporal en custodia", codigo: "DEP-TEMP", inmutableCodigoI: false, descripcion: "Pieza ingresada para peritaje, restauración o exhibición temporal corta." }
    ],
    estadosConservacion: [
      { id: "ec-1", termino: "Excelente", badge: "verde", descripcion: "Sin deterioro visible, material y estructura íntegros." },
      { id: "ec-2", termino: "Bueno / Estable", badge: "verde", descripcion: "Desgaste menor concordante con uso y antigüedad, estructura estable." },
      { id: "ec-3", termino: "Regular / Requiere monitoreo", badge: "ambar", descripcion: "Pérdida menor de policromía, bisagras flojas o fragilidad que exige revisión." },
      { id: "ec-4", termino: "Malo / En restauración", badge: "carmin", descripcion: "Ataque biológico, fracturas activas o desprendimientos graves; retirado de sala." }
    ]
  },

  // Cargas recientes de Excel (nombres de archivo reales del museo)
  cargasRecientes: [
    {
      id: "IMP-2025-03",
      archivo: "1. INVENTARIO GENERAL MATP - Recortado con relación de errores - Final.xlsx",
      fecha: "11/09/2025",
      filas: 4380,
      usuario: "G. Mejía",
      estado: "En revisión",
      tipoEstado: "en-revision"
    },
    {
      id: "IMP-2025-02",
      archivo: "6. Colección Guillermo Ugarte Chamorro - Final con RN.xlsx",
      fecha: "11/09/2025",
      filas: 1035,
      usuario: "C. Alarcón",
      estado: "Aprobada",
      tipoEstado: "aprobada"
    },
    {
      id: "IMP-2025-01",
      archivo: "9. Coleccion Mildred Merino de Zela - Final.xlsx",
      fecha: "11/09/2025",
      filas: 276,
      usuario: "G. Mejía",
      estado: "Aprobada",
      tipoEstado: "aprobada"
    }
  ],

  // Alertas prioritarias de piezas (basadas en piezas reales del catálogo)
  alertasInventario: [
    { id: "p-005", codigo: "AJB 001", denominacion: "Máscara \"Cabeza de diablo\"", problema: "Sin código I (comodato)", prioridad: "Alta", tipo: "sin-codigo" },
    { id: "p-004", codigo: "I-02330", denominacion: "Mate decorado - uso ritual para chicha", problema: "Sin fotografía", prioridad: "Media", tipo: "sin-foto" },
    { id: "p-007", codigo: "I-01823", denominacion: "Toro de bronce (posible equivalencia con ACG 028 / I-01848)", problema: "Sin ubicación, sin tipo de bien ni colección asignada", prioridad: "Alta", tipo: "sin-ubicacion" },
    { id: "p-008", codigo: "FJT 001", denominacion: "Retablo \"La cosecha del maíz\"", problema: "Pendiente de incorporar al correlativo Código I", prioridad: "Baja", tipo: "incompleta" }
  ],

  // Catálogo de Piezas del MATP — ejemplos reales tomados de las bases de datos estandarizadas
  // y fichas de catalogación del museo (Archivos del cliente, 2025), con nombres sintéticos
  // de usuario/registrador del sistema; los datos de la pieza en sí son reales.
  piezas: [
    {
      id: "p-001",
      codigoI: "I-03566",
      tieneCodigoI: true,
      denominacion: "Procesión del Corpus Christi con imagen de San Cristóbal",
      coleccion: "DGP",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Depósito N° 2",
      ubicacionCompleta: {
        sede: "Sede MATP (Jirón Camaná 459, Lima)",
        espacio: "Depósito N° 2",
        mueble: "Anaquel procesiones",
        nivel: "Nivel 1",
        contenedor: "—"
      },
      autor: "Hilario Mendívil",
      procedencia: "Cusco, Perú",
      epocaOriginal: "1940 - 1950",
      tipoBien: "Escultura y talla",
      materiales: "Madera, pasta y espejos; modelado y tallado, acabado pintado.",
      medidas: "Alto: 22.0 cm · Ancho: 24.0 cm · Fondo: 42.0 cm",
      conservacion: "Regular / Incompleto",
      registrador: "Gabriela Mejía Valdivia (sistema digital MATP)",
      observaciones: "Representación de procesión de Corpus Christi con imagen de San Cristóbal y el Niño Jesús sobre anda, acompañada por padrinos, sacerdotes, músicos y pueblo. En la base se observan improntas de dos personajes faltantes; la pieza ha sido restaurada. Fondo Doris Gibson Parra.",
      codigos: [
        { tipo: "Código I (Inventario General)", valor: "I-03566", fuente: "Base de Datos Estandarizada MATP 2025", vigencia: "Vigente", inmutable: true },
        { tipo: "Código de Colección", valor: "DGP 052", fuente: "Ficha de catalogación Colección Doris Gibson Parra", vigencia: "Vigente", inmutable: false },
        { tipo: "UUID Digital Interno", valor: "matp-art-003566-pe", fuente: "Sistema Digitalización MATP", vigencia: "Vigente", inmutable: true }
      ],
      fotos: [
        { id: "f1", vista: "Frontal", url: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80", principal: true },
        { id: "f2", vista: "Detalle base", url: "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?w=800&auto=format&fit=crop&q=80", principal: false }
      ],
      historial: [
        { fecha: "18/03/2024", usuario: "G. Mejía", accion: "Movimiento de custodia", detalle: "De: Sala de Exposición Temporal → A: Depósito N° 2 tras clausura de muestra." },
        { fecha: "15/10/2002", usuario: "Fuente original", accion: "Catalogación inicial (ficha física)", detalle: "Ingreso a la Colección Doris Gibson Parra, código de colección DGP 052." }
      ]
    },
    {
      id: "p-002",
      codigoI: "I-00010",
      tieneCodigoI: true,
      denominacion: "Niño Jesús",
      coleccion: "MMZ",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Depósito N° 1, caja 1",
      autor: "Leoncio Tineo",
      procedencia: "Ayacucho, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Cerámica",
      materiales: "Cerámica; modelado, acabado alisado-pintado.",
      medidas: "Alto: 10.0 cm · Ancho: 4.1 cm · Peso: 40.0 g",
      conservacion: "Regular / Estable",
      registrador: "Carlos Alarcón Soto (sistema digital MATP)",
      observaciones: "Representación escultórica del Niño Jesús con rasgos indígenas, acostado con brazos levantados y piernas flexionadas. Ambos brazos fueron pegados con resina; restaurado en septiembre de 1989.",
      fotos: [
        { id: "f21", vista: "Frontal", url: "https://images.unsplash.com/photo-1569383746724-6f1b882b8f46?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-003",
      codigoI: "I-01237",
      tieneCodigoI: true,
      denominacion: "Virgen con el Niño",
      coleccion: "MBV",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Depósito N° 1",
      autor: "Julia Tineo (Taller Tineo)",
      procedencia: "Ayacucho, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Cerámica",
      materiales: "Cerámica; modelado, acabado alisado-inciso y pintado.",
      medidas: "Alto: 20.4 cm · Ancho: 11.7 cm · Fondo: 10.0 cm · Peso: 668.0 g",
      conservacion: "Bueno / Estable",
      registrador: "Roberto Sandoval Ruiz (sistema digital MATP)",
      observaciones: "Virgen sentada cargando al Niño Jesús en sus faldas; el niño viste chullo y faldellín. Expuesta en \"Navidad Andina\", Centro Español del Perú, diciembre 1994.",
      fotos: [
        { id: "f31", vista: "Frontal", url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-004",
      codigoI: "I-02330",
      tieneCodigoI: true,
      denominacion: "Mate decorado - uso ritual para chicha",
      coleccion: "RAB",
      regimen: "Propiedad definitiva",
      estado: "Sin foto",
      estadoTipo: "sin-foto",
      ubicacion: "Depósito N° 1",
      autor: "Desconocido",
      procedencia: "Piura, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Mate",
      materiales: "Calabaza; técnica de cortado y quemado, acabado burilado y pirograbado.",
      medidas: "Alto: 14.7 cm · Diámetro: 26.0 cm · Peso: 30.0 g",
      conservacion: "Regular / Completo",
      registrador: "Mariana Silva Thorne (sistema digital MATP)",
      observaciones: "Mate de cuerpo semiesférico con cuatro diseños florales y ondulantes en rojo y negro; se utiliza para tomar chicha. Presenta decoloración y sectores afectados por xilófagos. Fotografía pendiente de toma con iluminación controlada.",
      fotos: []
    },
    {
      id: "p-005",
      codigoI: "—",
      tieneCodigoI: false,
      denominacion: "Máscara \"Cabeza de diablo\"",
      coleccion: "AJB",
      regimen: "Comodato familiar / institucional",
      estado: "Sin código I",
      estadoTipo: "sin-codigo",
      ubicacion: "Depósito AJB, Caja 25",
      autor: "Desconocido",
      procedencia: "Cajabamba, Cajamarca, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Máscara",
      materiales: "Hojalata, papel y tela; moldeado, acabado pintado.",
      medidas: "Alto: 27.5 cm · Ancho: 23.0 cm · Fondo: 23.0 cm",
      conservacion: "Regular / Completo",
      registrador: "Julio Sebastián Sánchez García (20/08/2012, ficha física AJB)",
      observaciones: "PIEZA EN COMODATO (COLECCIÓN ARTURO JIMÉNEZ BORJA): propietario Luis Alfredo Jiménez Borja. Según reglamento institucional MATP, las piezas en comodato NO reciben código I patrimonial definitivo (RN-003). Código INC/Registro Nacional: 2771. Código de propietario: AJB 001. Exhibida en \"El universo de AJB\" (MATP-PUCP, jun. 2001 - ene. 2002) e ICPNA Miraflores (set. 2005).",
      fotos: [
        { id: "f51", vista: "Frontal", url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-006",
      codigoI: "I-02722",
      tieneCodigoI: true,
      denominacion: "Faja o Llauto",
      coleccion: "GERSOL",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Primera gaveta de Anaquel de Metal - Depósito AJB",
      autor: "Desconocido",
      procedencia: "Costa Central, Perú",
      epocaOriginal: "Prehispánico",
      tipoBien: "Textilería e Indumentaria",
      materiales: "Algodón; tapiz Kelim.",
      medidas: "Largo: 163.5 cm · Ancho: 3.0 cm · Peso: 23.0 g",
      conservacion: "Regular / Incompleto",
      registrador: "Gabriela Mejía Valdivia (sistema digital MATP)",
      observaciones: "Faja con diseños listados horizontales alternados con espirales escalonados a manera de olas, en marrón, beige y amarillo oscuro. Faltan flecos en un terminal. Fondo Gertrud Bramberger de Solari.",
      fotos: [
        { id: "f61", vista: "Frontal", url: "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-007",
      codigoI: "I-01823",
      tieneCodigoI: true,
      denominacion: "Toro de bronce",
      coleccion: "ACG",
      regimen: "Propiedad definitiva",
      estado: "Sin ubicación",
      estadoTipo: "sin-ubicacion",
      ubicacion: "Por asignar",
      autor: "Desconocido",
      procedencia: "Puno, Perú",
      epocaOriginal: "—",
      tipoBien: "—",
      materiales: "Metal (bronce).",
      medidas: "Medidas no registradas en la ficha original",
      conservacion: "En perfecto estado",
      registrador: "Carlos Alarcón Soto (sistema digital MATP)",
      observaciones: "REGISTRO TAL COMO FIGURA EN LA HOJA \"ERRORES PENDIENTES\" DEL INVENTARIO GENERAL: pieza de bronce pequeña, sin colección, tipo de bien ni ubicación asignados en el archivo fuente. El propio equipo del museo anotó: \"Puede ser el ACG 028 (I-01848)\" — posible duplicado o confusión de código a confirmar con la contraparte antes de asignar ubicación definitiva.",
      fotos: [
        { id: "f71", vista: "Frontal", url: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-008",
      codigoI: "I-04381",
      tieneCodigoI: true,
      denominacion: "Retablo \"La cosecha del maíz\"",
      coleccion: "FJT",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Primer Depósito",
      autor: "Florentino Jiménez Toma",
      procedencia: "Ayacucho, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Retablo (Escultura y talla)",
      materiales: "Madera, cartón, lana, caña, pasta, témpera y barniz; tallado y modelado, acabado alisado y barnizado.",
      medidas: "Alto: 26.0 cm · Ancho: 29.2 cm · Fondo: 8.3 cm",
      conservacion: "Regular / Incompleto",
      registrador: "Julio S. Sánchez García (20/01/2015, ficha física) · Código I asignado al incorporar al inventario general",
      observaciones: "Retablo policromo de un solo nivel: cosecha de maíz en primer plano, maizal con loros en segundo plano y depósito con campesinos al costado. Donación a la PUCP. Falta la mano de un niño en primer plano. Bibliografía: Huerats, C.E. \"Vida y obra de Florentino Jimenez Toma\", 1987.",
      fotos: [
        { id: "f81", vista: "Frontal", url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-009",
      codigoI: "I-00011",
      tieneCodigoI: true,
      denominacion: "Vaca",
      coleccion: "MMZ",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Depósito N° 1, caja 1",
      autor: "Taller Tineo",
      procedencia: "Ayacucho, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Cerámica",
      materiales: "Cerámica; modelado, acabado alisado-pintado.",
      medidas: "Alto: 8.0 cm · Ancho: 10.3 cm · Peso: 80.0 g",
      conservacion: "Regular / Completo",
      registrador: "Carlos Alarcón Soto (sistema digital MATP)",
      observaciones: "Representación escultórica de una vaca parada sobre sus cuatro patas, con engobe marrón oscuro, pezuñas pintadas de gris y rasgos marcados con líneas incisas. El cuerno derecho está roto.",
      fotos: [
        { id: "f91", vista: "Frontal", url: "https://images.unsplash.com/photo-1582561424760-0321d75e81fa?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    },
    {
      id: "p-010",
      codigoI: "I-01625",
      tieneCodigoI: true,
      denominacion: "Mocahua Shipiba",
      coleccion: "ACG",
      regimen: "Propiedad definitiva",
      estado: "Completa",
      estadoTipo: "completa",
      ubicacion: "Depósito N° 1",
      autor: "Anónimo",
      procedencia: "Loreto - Comunidad shipiba-conibo, Perú",
      epocaOriginal: "Siglo XX",
      tipoBien: "Cerámica",
      materiales: "Cerámica; técnica torneado, acabado pintura.",
      medidas: "Alto: 6.8 cm · Diámetro: 20.5 cm · Espesor: 0.5 cm",
      conservacion: "Regular / Completo",
      registrador: "Mariana Silva Thorne (sistema digital MATP)",
      observaciones: "Vasija abierta de paredes convexo-divergentes y base plana. Superficie interna con pintura roja en líneas verticales; superficie externa con diseños geométricos en negro y ocre sobre fondo crema. Se está descascarando, con huellas de uso y borde desgastado.",
      fotos: [
        { id: "f101", vista: "Frontal", url: "https://images.unsplash.com/photo-1569383746724-6f1b882b8f46?w=800&auto=format&fit=crop&q=80", principal: true }
      ]
    }
  ],

  // M4: Datos para el Asistente de Importación de Excel (Paso 4 - Matching y Calidad)
  // Archivo real: "1. INVENTARIO GENERAL MATP - Recortado con relación de errores - Final.xlsx"
  // (hoja "Inventario": 4,380 filas; hojas "Errores identificados"/"Errores pendientes" con
  // casos reales de códigos duplicados y registros incompletos usados en la previsualización).
  importacionActual: {
    archivo: "1. INVENTARIO GENERAL MATP - Recortado con relación de errores - Final.xlsx",
    fechaSubida: "11/09/2025 00:44",
    totalFilas: 4380,
    plantillasMapeo: [
      { id: "pl-1", nombre: "Inventario General MATP (recortado)", descripcion: "Plantilla estándar del museo: N° Inventario (I), Código de colección, RN, Colección, Autor, Procedencia, Tipo de bien, Material, medidas y conservación", fecha: "11/09/2025" },
      { id: "pl-2", nombre: "Fichas de catalogación AJB", descripcion: "Mapeo para lotes de fichas AJB (Código INC, Código de propietario, Forma de adquisición, Situación Habida/No habida)", fecha: "11/09/2025" },
      { id: "pl-3", nombre: "Colecciones individuales - Fondos históricos", descripcion: "Mapeo para los 16 archivos de 'BD Estandarizadas al 2025' por colección (MMZ, MBV, ACG, RAB, GERSOL, DGP, etc.)", fecha: "11/09/2025" }
    ],
    resumen: {
      nuevos: 78,
      actualizaciones: 34,
      duplicados: 12,
      conflictos: 6,
      pendientes: 8,
      rechazados: 4
    },
    pasoActual: 4,
    validacionTesauros: [
      {
        columna: "Nombre de la Colección",
        campoMatp: "Colección / Fondo",
        terminosEnArchivo: 12,
        coincidentes: 4216,
        noReconocidos: 164,
        ejemploNoReconocido: '"Alfredo Cabrera Ganoza" (debería ser "Alfonso Cabrera Ganoza")',
        estado: "Revisar",
        estadoTipo: "advertencia"
      },
      {
        columna: "Material",
        campoMatp: "Materiales y Técnicas",
        terminosEnArchivo: 38,
        coincidentes: 4012,
        noReconocidos: 368,
        ejemploNoReconocido: '"Hojalata, papel y tela" (combinación aún no normalizada)',
        estado: "Revisar",
        estadoTipo: "advertencia"
      },
      {
        columna: "Tipo de bien",
        campoMatp: "Categoría / Tipo de Bien",
        terminosEnArchivo: 14,
        coincidentes: 4380,
        noReconocidos: 0,
        ejemploNoReconocido: "— (Todos los términos homologados contra el tesauro)",
        estado: "Validado",
        estadoTipo: "completa"
      },
      {
        columna: "Estado de conservación (bueno, regular, malo)",
        campoMatp: "Estado de Conservación",
        terminosEnArchivo: 3,
        coincidentes: 4380,
        noReconocidos: 0,
        ejemploNoReconocido: "— (Vocabulario de 3 valores homologado directo)",
        estado: "Validado",
        estadoTipo: "completa"
      },
      {
        columna: "Código de la colección",
        campoMatp: "Código de Colección",
        terminosEnArchivo: 4380,
        coincidentes: 4091,
        noReconocidos: 289,
        ejemploNoReconocido: '"ACG 022" repetido en dos N° de inventario distintos (I-01997 / I-01998)',
        estado: "Revisar",
        estadoTipo: "advertencia"
      }
    ],
    // Filas reales tomadas de las hojas "Errores identificados" y "Errores pendientes"
    // del archivo del museo — ejemplos auténticos de los problemas de codificación descritos en el expediente.
    filasPrevisualizacion: [
      {
        filaExcel: 1823,
        codigoReferencia: "I-01823",
        denominacion: "Toro (bronce, Puno)",
        estadoImport: "Posible duplicado",
        estadoTipo: "duplicado",
        campoDiff: "Colección, tipo de bien y ubicación vacíos en el archivo original",
        valorActual: "Registro I-01848 (ACG 028): \"Toro\", bronce, 4.9x5.5x2.5 cm, Depósito N° 1",
        valorEntrante: "Anotación original del museo: \"Puede ser el ACG 028 (I-01848)\"",
        accionSugerida: "Requiere revisión de curaduría para confirmar si es la misma pieza"
      },
      {
        filaExcel: 1997,
        codigoReferencia: "I-01997 / I-01998",
        denominacion: "Caja (Alfonso Cabrera Ganoza)",
        estadoImport: "Conflicto",
        estadoTipo: "conflicto",
        campoDiff: "Dos números de inventario agrupados bajo un mismo código de colección ACG 022",
        valorActual: "I-01997: \"Caja\", madera tallada, código ACG 022",
        valorEntrante: "I-01998: \"Tapa\", madera, mismo código de colección ACG 022 repetido",
        accionSugerida: "Anotación del museo: \"no se respetó que tuvieran números diferentes de inventario\" — requiere asignar códigos de colección distintos"
      },
      {
        filaExcel: 27,
        codigoReferencia: "I-00027",
        denominacion: "Toro Cajamarquino (antes \"Toro de Pucará\")",
        estadoImport: "Actualización",
        estadoTipo: "actualizacion",
        campoDiff: "Procedencia y título corregidos",
        valorActual: "MMZ 216 — Procedencia y título original mal otorgados (error histórico)",
        valorEntrante: "Procedencia corregida a Cajamarca; título corregido a \"Toro Cajamarquino\"",
        accionSugerida: "Sobrescribir campo preservando código I inmutable (I-00027)"
      },
      {
        filaExcel: 2731,
        codigoReferencia: "I-02731",
        denominacion: "Faja o Llauto (GERSOL 025)",
        estadoImport: "Actualización",
        estadoTipo: "actualizacion",
        campoDiff: "Medida en conflicto con ficha de catalogación anterior",
        valorActual: "Ficha anterior: 224 cm de largo",
        valorEntrante: "Medida actual: 89 cm — \"aparentemente la pieza fue cortada entre su primer registro y el 2005/2006\"",
        accionSugerida: "Confirmar con conservación antes de sobrescribir la medida"
      },
      {
        filaExcel: 4381,
        codigoReferencia: "FJT 001",
        denominacion: "Retablo \"La cosecha del maíz\"",
        estadoImport: "Nuevo",
        estadoTipo: "nuevo",
        campoDiff: "Registro íntegro, sin Código I asignado en la ficha original",
        valorActual: "— (Proviene de ficha de catalogación independiente, no del inventario general)",
        valorEntrante: "Florentino Jiménez Toma, donación PUCP, Código INC 7340",
        accionSugerida: "Crear nuevo registro y asignar correlativo de Código I (propuesto: I-04381)"
      },
      {
        filaExcel: 3326,
        codigoReferencia: "ELA 215 CEL",
        denominacion: "Cruz de la Pasión",
        estadoImport: "Pendiente",
        estadoTipo: "pendiente",
        campoDiff: "Error de inscripción en Registro Nacional (MC) a corregir",
        valorActual: "N° Inscripción RN: 139095",
        valorEntrante: "Anotación del museo: \"Error de inscripción, corregir en el MC\"",
        accionSugerida: "Se carga marcada como pendiente de corrección ante el Ministerio de Cultura (no rechazada)"
      }
    ]
  },

  // Bitácora histórica de importaciones
  bitacoraImportaciones: [
    { id: "BIT-104", archivo: "1. INVENTARIO GENERAL MATP - Compilado con relación de errores - Final.xlsx", fecha: "11/09/2025", usuario: "G. Mejía", resultado: "Rechazado", motivo: "164 filas con nombre de colección no homologado (ej. \"Alfredo\" vs \"Alfonso\" Cabrera Ganoza) y 289 códigos de colección repetidos entre dos N° de inventario distintos.", filas: 4380 },
    { id: "BIT-103", archivo: "6. Colección Guillermo Ugarte Chamorro - Final con RN.xlsx", fecha: "11/09/2025", usuario: "C. Alarcón", resultado: "Aprobado", motivo: "Carga exitosa de 1,035 piezas con Registro Nacional y matching de tesauros.", filas: 1035 },
    { id: "BIT-102", archivo: "9. Coleccion Mildred Merino de Zela - Final.xlsx", fecha: "11/09/2025", usuario: "G. Mejía", resultado: "Aprobado", motivo: "Carga aprobada con 276 piezas de cerámica tradicional incorporadas.", filas: 276 }
  ],

  // M3: Árbol jerárquico de ubicaciones físicas del MATP
  arbolUbicaciones: [
    {
      id: "sede-ohiggins",
      nombre: "Sede MATP (Jirón Camaná 459, Lima)",
      tipo: "sede",
      abierto: true,
      hijos: [
        {
          id: "dep-1",
          nombre: "Depósito 1 (Bóveda Principal - Planta Baja)",
          tipo: "espacio",
          abierto: true,
          hijos: [
            {
              id: "est-a",
              nombre: "Estante A (Retablos y Escultura Devocional)",
              tipo: "mueble",
              abierto: true,
              hijos: [
                { id: "niv-1", nombre: "Nivel 1 (Piezas gran formato)", tipo: "nivel", piezasCount: 12 },
                { id: "niv-2", nombre: "Nivel 2 (Colección Retablos)", tipo: "nivel", piezasCount: 24, seleccionado: true },
                { id: "niv-3", nombre: "Nivel 3 (Cajas herméticas)", tipo: "nivel", piezasCount: 18 }
              ]
            },
            {
              id: "est-b",
              nombre: "Estante B (Metales, mates y platería)",
              tipo: "mueble",
              abierto: false,
              hijos: [
                { id: "niv-b1", nombre: "Nivel 1 (Mates burilados)", tipo: "nivel", piezasCount: 30 },
                { id: "niv-b2", nombre: "Nivel 2 (Platería y hojalatería)", tipo: "nivel", piezasCount: 28 }
              ]
            }
          ]
        },
        {
          id: "dep-2",
          nombre: "Depósito 2 (Piso 2 - Textiles y Trajes)",
          tipo: "espacio",
          abierto: false,
          hijos: [
            { id: "gav-text", nombre: "Gavetero climatizado Textiles", tipo: "mueble", hijos: [] }
          ]
        },
        {
          id: "sala-perm",
          nombre: "Sala de Exhibición Permanente 'Identidades'",
          tipo: "espacio",
          abierto: false,
          hijos: []
        },
        {
          id: "sala-temp",
          nombre: "Sala Temporal 'Memoria Viva'",
          tipo: "espacio",
          abierto: false,
          hijos: []
        }
      ]
    }
  ],

  // M3: Movimientos recientes en control de ubicación
  movimientosRecientes: [
    { fecha: "18/03/2024 11:20", pieza: "I-03566 · Procesión Corpus Christi", origen: "Sala Temporal", destino: "Depósito N° 2", responsable: "G. Mejía", motivo: "Retorno a bóveda fin de muestra" },
    { fecha: "15/03/2024 16:45", pieza: "I-02722 · Faja o Llauto", origen: "Taller", destino: "Depósito AJB · Anaquel de Metal", responsable: "C. Alarcón", motivo: "Fin de evaluación de conservación" },
    { fecha: "11/03/2024 09:30", pieza: "I-01823 · Toro de bronce", origen: "Sin registrar", destino: "Por asignar", responsable: "R. Sandoval", motivo: "Pendiente de confirmar posible duplicado con ACG 028 antes de asignar ubicación" }
  ],

  // M5: Reportes preconfigurados disponibles
  reportes: [
    {
      id: "rep-1",
      titulo: "Inventario General de Piezas",
      descripcion: "Consolidado total con códigos I, colecciones, tenencia y estados de catalogación museográfica.",
      registrosSimulados: 10412,
      fechaActualizacion: "Hoy, 06:00",
      formatoSugerido: "XLSX / PDF"
    },
    {
      id: "rep-2",
      titulo: "Inventario por Colección y Régimen",
      descripcion: "Segmentación por fondos (AJB, MMZ, Guillermo Ugarte Chamorro, Plus Petrol, entre otras) y régimen legal (Propiedad / Comodato).",
      registrosSimulados: 5,
      fechaActualizacion: "15/03/2024",
      formatoSugerido: "XLSX"
    },
    {
      id: "rep-3",
      titulo: "Ubicación Topográfica y Depósitos",
      descripcion: "Mapeo físico pormenorizado por sede, depósito, mueble, estante y contenedor de conservación.",
      registrosSimulados: 8232,
      fechaActualizacion: "18/03/2024",
      formatoSugerido: "PDF / CSV"
    },
    {
      id: "rep-4",
      titulo: "Auditoría de Información Incompleta",
      descripcion: "Listado de piezas prioritarias sin código I, sin fotografía oficial o sin ubicación topográfica asignada.",
      registrosSimulados: 6120,
      fechaActualizacion: "Tiempo real",
      formatoSugerido: "XLSX"
    },
    {
      id: "rep-5",
      titulo: "Trazabilidad y Movimientos de Custodia",
      descripcion: "Historial completo de traslados físicos entre depósitos y salas con detalle de custodios responsables.",
      registrosSimulados: 940,
      fechaActualizacion: "18/03/2024",
      formatoSugerido: "PDF / XLSX"
    }
  ],

  // M6: Usuarios del sistema y Roles
  usuarios: [
    { id: "u-1", nombre: "Gabriela Mejía Valdivia", correo: "gmejia@pucp.edu.pe", rol: "Curador / Gestor de colecciones", estado: "Activo", ultimoAcceso: "Hoy, 10:14" },
    { id: "u-2", nombre: "Dr. Claudio Mendoza", correo: "cmendoza@pucp.pe", rol: "Administrador", estado: "Activo", ultimoAcceso: "Ayer, 18:30" },
    { id: "u-3", nombre: "Carlos Alarcón Soto", correo: "calarcon.s@pucp.pe", rol: "Catalogador / Practicante", estado: "Activo", ultimoAcceso: "17/03/2024" },
    { id: "u-4", nombre: "Roberto Sandoval Ruiz", correo: "rsandoval@pucp.edu.pe", rol: "Conservación", estado: "Activo", ultimoAcceso: "15/03/2024" },
    { id: "u-5", nombre: "Mariana Silva Thorne", correo: "msilvat@pucp.edu.pe", rol: "Consulta interna", estado: "Activo", ultimoAcceso: "10/03/2024" },
    { id: "u-6", nombre: "Investigadores Acreditados", correo: "investigador.ext@pucp.pe", rol: "Consulta externa", estado: "Inactivo en Fase 1", ultimoAcceso: "—" }
  ],

  // M6: Matriz de permisos cruzada por módulo y perfil
  permisos: [
    { modulo: "Dashboard y métricas generales", roles: [true, true, true, true, true, false] },
    { modulo: "Catálogo de piezas (Lectura)", roles: [true, true, true, true, true, false] },
    { modulo: "Catálogo de piezas (Creación / Edición)", roles: [true, true, true, false, false, false] },
    { modulo: "Colecciones (Gestión de fondos)", roles: [true, true, false, false, false, false] },
    { modulo: "Tesauros y vocabularios (Normalización)", roles: [true, true, false, false, false, false] },
    { modulo: "Asignación de Código I (Inmutable)", roles: [true, true, false, false, false, false] },
    { modulo: "Ubicaciones y movimientos de custodia", roles: [true, true, false, true, false, false] },
    { modulo: "Importación masiva y calidad de datos", roles: [true, true, false, false, false, false] },
    { modulo: "Generación y exportación de reportes", roles: [true, true, true, true, true, false] },
    { modulo: "Configuración del sistema y reglas", roles: [true, false, false, false, false, false] },
    { modulo: "Gestión de usuarios y asignación de roles", roles: [true, false, false, false, false, false] },
    { modulo: "Auditoría de cambios y trazabilidad", roles: [true, true, false, false, false, false] }
  ],

  // M6: Auditoría reciente de trazabilidad
  auditoriaCambios: [
    { fecha: "18/03/2024 11:20", usuario: "Gabriela Mejía", accion: "Actualización de Ubicación", anterior: "Sala Temporal", nuevo: "Depósito N° 2", pieza: "I-03566" },
    { fecha: "17/03/2024 15:10", usuario: "Carlos Alarcón", accion: "Edición de Catalogación", anterior: "Título: Toro de Pucará (MMZ 216)", nuevo: "Título: Toro Cajamarquino (procedencia corregida a Cajamarca)", pieza: "I-00027" },
    { fecha: "14/03/2024 09:40", usuario: "Roberto Sandoval", accion: "Modificación de Conservación", anterior: "Regular", nuevo: "Regular / Incompleto tras evaluación", pieza: "I-02722" },
    { fecha: "12/03/2024 14:00", usuario: "Claudio Mendoza", accion: "Aprobación de Lote Excel", anterior: "Estado: En revisión", nuevo: "Estado: Aprobado (1,035 piezas)", pieza: "IMP-2025-02" }
  ],

  // M7: Parámetros del Sistema y Configuración Parametrizable sin código
  configuracion: {
    institucion: {
      nombre: "Museo de Artes y Tradiciones Populares 'Luis Repetto Málaga'",
      siglas: "MATP – PUCP",
      sedePrincipal: "Jirón Camaná 459, Lima",
      correo: "matp@pucp.edu.pe",
      telefono: "(01) 626-2000 anexo 4510",
      director: "Dirección Académica de Relaciones Institucionales / Asuntos Culturales PUCP"
    },
    tiposIdentificador: [
      { id: "id-1", tipo: "Código I (Inventario General)", formato: "I-XXXXXX (Correlativo 6 dígitos)", obligatorio: true, inmutable: true, descripcion: "Identificador único inmutable asignado exclusivamente a piezas en propiedad definitiva del museo." },
      { id: "id-2", tipo: "Código de Colección", formato: "SIGLA-XXXX (ej. AJB-089)", obligatorio: false, inmutable: false, descripcion: "Código histórico heredado del inventario físico del fondo donante." },
      { id: "id-3", tipo: "Código Patrimonial PUCP", formato: "PUCP-MATP-AÑO-NUM", obligatorio: false, inmutable: false, descripcion: "Código patrimonial oficial registrado en la Dirección de Administración PUCP." },
      { id: "id-4", tipo: "Registro Nacional MC", formato: "INC-LRM-XXXX", obligatorio: false, inmutable: false, descripcion: "Código del Registro Nacional de Bienes Integrantes del Patrimonio Cultural." },
      { id: "id-5", tipo: "UUID Digital Interno", formato: "matp-art-XXXXXX-pe", obligatorio: true, inmutable: true, descripcion: "Identificador unívoco del sistema digital de colecciones." }
    ],
    reglasCatalogacion: {
      camposObligatorios: ["denominacion", "coleccion", "regimen", "materiales", "medidas", "procedencia"],
      exigirFotoParaCompletitud: true,
      exigirUbicacionParaCompletitud: true,
      codigoIExclusivoPropiedad: true,
      umbralSimilitudDuplicados: "85%",
      accionTerminoFueraTesauro: "advertir"
    },
    conservacionAlertas: {
      intervaloRevisionMeses: 6,
      alertaUbicacionVacia: true,
      bloqueoEdicionSinRol: true
    }
  }
};

if (typeof window !== "undefined") {
  window.MOCK = MOCK;
}
