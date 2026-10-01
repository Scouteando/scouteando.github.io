// LÓGICA DE LA APP
// Dos vistas: "Equipos" (elegís un club y ves su plantel) y "Ranking de la liga".

// ---------- 1. Elementos del HTML ----------
const vistaEquipos = document.getElementById("vistaEquipos");
const vistaJugadores = document.getElementById("vistaJugadores");
const vistaLideres = document.getElementById("vistaLideres");
const busquedaGlobal = document.getElementById("busquedaGlobal");
const buscadorGlobal = document.getElementById("buscadorGlobal");
const resultadosGlobal = document.getElementById("resultadosGlobal");
const resumenEquipo = document.getElementById("resumenEquipo");
const titulo = document.getElementById("titulo");
const resumen = document.getElementById("resumen");
const grilla = document.getElementById("grilla");
const buscador = document.getElementById("buscador");
const selectOrden = document.getElementById("orden");
const botonesMenu = document.querySelectorAll(".menu__opcion");
const botonesPuesto = document.querySelectorAll("#vistaJugadores .filtro[data-puesto]");
const botonVerMas = document.getElementById("verMas");
const volver = document.getElementById("volver");

// ---------- 1b. Jugadores unificados (para líderes, buscador y comparaciones) ----------
// Si alguien jugó en dos clubes en la temporada, FBref lo trae en dos filas.
// Para los líderes y las comparaciones sumamos sus números y lo contamos una sola vez.
const sumables = ["partidos", "titular", "minutos", "goles", "asistencias", "amarillas", "rojas", "tiros", "tirosAlArco",
  "intercepciones", "quites", "faltasRecibidas", "centros", "atajadas", "golesRecibidos", "vallasInvictas"];

function unificar(lista) {
  const porJugador = {};
  for (const j of lista) {
    const clave = j.nombre + "|" + j.edad;
    if (!porJugador[clave]) {
      porJugador[clave] = { ...j, clubes: [j.equipo] };
      continue;
    }
    const u = porJugador[clave];
    for (const campo of sumables) {
      if (j[campo] != null) u[campo] = (u[campo] || 0) + j[campo];
    }
    u.clubes.push(j.equipo);
    // Nos quedamos con el club actual (o el último en el que jugó más)
    if (j.enPlantel || (!u.enPlantel && j.minutos > 0)) {
      u.equipo = j.equipo; u.equipoId = j.equipoId; u.enPlantel = j.enPlantel;
    }
    u.foto = u.foto || j.foto;
  }
  // Recalculamos lo que no se puede sumar
  for (const u of Object.values(porJugador)) {
    if (u.clubes.length > 1) {
      const filas = lista.filter(j => j.nombre + "|" + j.edad === u.nombre + "|" + u.edad);
      if (u.atajadas != null) u.pctAtajadas = Math.round((u.atajadas / Math.max(1, u.atajadas + u.golesRecibidos)) * 1000) / 10;
    }
  }
  return Object.values(porJugador);
}

// La liga elegida: se completan al cargar una liga (ver cargarLiga)
let ligaActual = null;
let jugadores = [];
let jugadoresUnificados = [];

// ---------- 2. Estadísticas por las que se puede ordenar ----------
// "valor" es una función que saca el número de un jugador.
// "menor: true" = gana el más bajo (por ejemplo, la edad).
const ordenPuestos = { ARQ: 1, DEF: 2, MED: 3, DEL: 4, "S/D": 5 };
const nombresPuestos = { ARQ: "Arqueros", DEF: "Defensores", MED: "Mediocampistas", DEL: "Delanteros", "S/D": "Sin puesto" };

// Dato más importante de cada puesto (se muestra grande en la carta del plantel)
function datoClave(j) {
  if (j.puesto === "ARQ") return ["Atajadas/PJ", porPartido(j.atajadas, j)];
  if (j.puesto === "DEF") return ["Recuperaciones/PJ", porPartido(j.quites + j.intercepciones, j)];
  if (j.puesto === "DEL") return ["Goles", j.goles];
  return ["Goles + asist.", j.goles + j.asistencias];
}

const estadisticas = {
  puesto:         { nombre: "Puesto (plantel)",    valor: j => datoClave(j)[1], etiqueta: j => datoClave(j)[0] },
  goles:          { nombre: "Goles",               valor: j => j.goles },
  golesPP:        { nombre: "Goles por partido",   valor: j => porPartido(j.goles, j), minimo: 450 },
  asistencias:    { nombre: "Asistencias",         valor: j => j.asistencias },
  ga:             { nombre: "Goles + asistencias", valor: j => j.goles + j.asistencias },
  minutos:        { nombre: "Minutos jugados",     valor: j => j.minutos },
  partidos:       { nombre: "Partidos",            valor: j => j.partidos },
  recuperaciones: { nombre: "Recuperaciones",      valor: j => j.quites + j.intercepciones },
  recuperacionesPP: { nombre: "Recuperaciones por partido", valor: j => porPartido(j.quites + j.intercepciones, j), minimo: 450 },
  intercepciones: { nombre: "Intercepciones",      valor: j => j.intercepciones },
  faltas:         { nombre: "Faltas recibidas",    valor: j => j.faltasRecibidas },
  centros:        { nombre: "Centros",             valor: j => j.centros },
  atajadas:       { nombre: "Atajadas",            valor: j => j.atajadas ?? null },
  atajadasPP:     { nombre: "Atajadas por partido", valor: j => j.atajadas == null ? null : porPartido(j.atajadas, j), minimo: 450 },
  golesRecPP:     { nombre: "Goles recibidos por partido", valor: j => j.golesRecibidos == null ? null : porPartido(j.golesRecibidos, j), menor: true, minimo: 450 },
  pctAtajadas:    { nombre: "% de atajadas",       valor: j => j.pctAtajadas ?? null, minimo: 450 },
  vallas:         { nombre: "Vallas invictas",     valor: j => j.vallasInvictas ?? null },
  amarillas:      { nombre: "Amarillas",           valor: j => j.amarillas },
  edad:           { nombre: "Edad (más joven)",    valor: j => j.edad, menor: true },
  tiros:          { nombre: "Tiros",               valor: j => j.tiros },
  tirosAlArco:    { nombre: "Tiros al arco",       valor: j => j.tirosAlArco },
  tirosAlArcoPP:  { nombre: "Tiros al arco por partido", valor: j => porPartido(j.tirosAlArco, j), minimo: 450 }
};
for (const clave in estadisticas) {
  selectOrden.innerHTML += `<option value="${clave}">${estadisticas[clave].nombre}</option>`;
}

// ---------- 3. Estado de la pantalla ----------
let vista = "ligas";        // "ligas" | "equipos" | "plantel" | "lideres"
let equipoElegido = null;
let puestoElegido = "TODOS";
let ordenElegido = "puesto";
let textoBuscado = "";
let cantidadVisible = 48;

const colores = {
  ARQ: "var(--arq)", DEF: "var(--def)", MED: "var(--med)", DEL: "var(--del)", "S/D": "var(--texto-suave)"
};

// ---------- 4. Utilidades ----------
// Promedio por partido con 1 decimal (ej.: 8 goles en 21 partidos = 0.4)
function porPartido(valor, j) {
  return j.partidos > 0 ? Math.round((valor / j.partidos) * 10) / 10 : 0;
}

function escudo(idEquipo) {
  return "https://media.api-sports.io/football/teams/" + idEquipo + ".png";
}
function iniciales(nombre) {
  const partes = nombre.split(" ");
  return partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "");
}

function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// "River Plate" -> "river-plate" (para los links)
function slug(texto) {
  return normalizar(String(texto)).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Busca jugadores por nombre: primero los que EMPIEZAN con lo buscado ("enzo" -> Enzo Pérez),
// después los que tienen una palabra que empieza así, y al final los que solo lo contienen ("Renzo").
function puntajeBusqueda(nombre, buscado) {
  const n = normalizar(nombre);
  if (!n.includes(buscado)) return 0;
  if (n.startsWith(buscado)) return 3;
  if (n.split(/[\s-]+/).some(palabra => palabra.startsWith(buscado))) return 2;
  return 1;
}
function buscarJugadores(lista, texto, cantidad) {
  const buscado = normalizar(texto.trim());
  return lista
    .map(j => ({ j, puntaje: puntajeBusqueda(j.nombre, buscado) }))
    .filter(x => x.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje || b.j.minutos - a.j.minutos)
    .slice(0, cantidad)
    .map(x => x.j);
}

// ---------- 5. Vista EQUIPOS ----------
function mostrarEquipos() {
  const equipos = [...new Set(jugadores.map(j => j.equipo))].sort();

  vistaEquipos.innerHTML = equipos.map(function (equipo) {
    const plantel = jugadores.filter(j => j.equipo === equipo);
    return `
      <button class="equipo" data-equipo="${equipo}">
        <img class="equipo__escudo" src="${escudo(plantel[0].equipoId)}" alt="Escudo de ${equipo}" loading="lazy">
        <span class="equipo__nombre">${equipo}</span>
      </button>`;
  }).join("");

  titulo.textContent = "Equipos";
  resumen.textContent = "Elegí un club para ver su plantel";
}

// ---------- 6. Carta de un jugador ----------
function crearCarta(j) {
  const foto = j.foto ? `<img src="${j.foto}" alt="${j.nombre}" loading="lazy" onerror="this.remove()">` : "";
  const tarjetas = j.rojas > 0 ? `${j.amarillas} 🟨 ${j.rojas} 🟥` : `${j.amarillas} 🟨`;

  // Tres estadísticas según el puesto
  let stats;
  if (j.puesto === "ARQ") {
    stats = [["Atajadas/PJ", porPartido(j.atajadas, j)], ["Vallas inv.", j.vallasInvictas], ["Goles rec./PJ", porPartido(j.golesRecibidos, j)]];
  } else if (j.puesto === "DEF") {
    stats = [["Recup./PJ", porPartido(j.quites + j.intercepciones, j)], ["Intercep.", j.intercepciones], ["G + A", j.goles + j.asistencias]];
  } else if (j.puesto === "DEL") {
    stats = [["Goles", j.goles], ["Tiros al arco", j.tirosAlArco], ["Asist.", j.asistencias]];
  } else {
    stats = [["Recup./PJ", porPartido(j.quites + j.intercepciones, j)], ["Goles", j.goles], ["Asist.", j.asistencias]];
  }
  // Si el usuario ordena por una estadística, esa va primera y resaltada
  let destacada = null;
  if (ordenElegido !== "puesto") {
    const est = estadisticas[ordenElegido];
    const valor = est.valor(j);
    destacada = [est.nombre, valor ?? "–"];
    stats = [destacada, ...stats.filter(s => s[0] !== est.nombre)].slice(0, 3);
  }
  const htmlStats = stats.map(s => `
      <div class="${s === destacada ? "stat--destacada" : ""}"><span class="stat__valor">${s[1]}</span><span class="stat__nombre">${s[0]}</span></div>`).join("");

  return `
    <article class="carta ${j.enPlantel ? "" : "carta--fuera"}" style="--color: ${colores[j.puesto]}" data-clave="${j.nombre}|${j.edad}|${j.equipo}">
      <div class="carta__arriba">
        <div class="carta__avatar">${foto}<span>${iniciales(j.nombre)}</span></div>
        <div class="carta__titulo">
          <span class="carta__puesto">${{ ARQ: "Arquero", DEF: "Defensor", MED: "Mediocampista", DEL: "Delantero" }[j.puesto] || "Sin puesto"}</span>
          <h2 class="carta__nombre">${j.nombre}${ligaActual && loSigo(j) ? ' <span class="seguido" title="Lo seguís">⭐</span>' : ""}</h2>
          <p class="carta__info">
            <a href="#" class="carta__equipo" data-equipo="${j.equipo}"><img class="mini-escudo" src="${escudo(j.equipoId)}" alt="">${j.equipo}</a>
            · ${j.pais}${j.edad ? " · " + j.edad + " años" : ""}
          </p>
        </div>
      </div>
      ${j.enPlantel ? "" : `<span class="aviso-fuera">Ya no está en el club</span>`}
      <div class="carta__stats">${htmlStats}</div>
      <div class="carta__extra">
        <span>${j.partidos} PJ · ${j.titular} de titular · ${j.minutos}'</span>
        <span>${tarjetas}</span>
      </div>
    </article>`;
}

// ---------- 7. Vista PLANTEL (jugadores de un equipo) ----------
function mostrarJugadores() {
  const est = estadisticas[ordenElegido];
  const buscado = normalizar(textoBuscado);

  let lista = jugadores.filter(function (j) {
    const okEquipo = j.equipo === equipoElegido && j.enPlantel; // los que se fueron no se muestran
    const okPuesto = puestoElegido === "TODOS" || j.puesto === puestoElegido;
    const okTexto = buscado === "" || normalizar(j.nombre).includes(buscado);
    return okEquipo && okPuesto && okTexto;
  });

  lista.sort(function (a, b) {
    if (ordenElegido === "puesto") {
      // Primero los que siguen en el club; después por puesto; dentro del puesto, el que más jugó
      return (b.enPlantel - a.enPlantel) || ordenPuestos[a.puesto] - ordenPuestos[b.puesto] || b.minutos - a.minutos;
    }
    const va = est.valor(a), vb = est.valor(b);
    if (va === null && vb === null) return b.minutos - a.minutos;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va === vb) return b.minutos - a.minutos; // empate: el que más jugó
    return est.menor ? va - vb : vb - va;
  });

  const id = jugadores.find(j => j.equipo === equipoElegido).equipoId;
  titulo.innerHTML = `<img class="titulo__escudo" src="${escudo(id)}" alt="">${equipoElegido}`;
  resumen.textContent = ordenElegido === "puesto"
    ? `${lista.length} jugadores · ordenados por puesto`
    : `${lista.length} jugadores · ordenados por ${est.nombre.toLowerCase()}`;

  const visibles = lista.slice(0, cantidadVisible);
  let html = "";
  let puestoAnterior = null;
  for (const j of visibles) {
    // Si ordenamos por puesto, ponemos un título cada vez que cambia el grupo
    const grupo = j.enPlantel ? nombresPuestos[j.puesto] : "Ya no están en el club";
    if (ordenElegido === "puesto" && grupo !== puestoAnterior) {
      html += `<h3 class="grupo">${grupo}</h3>`;
      puestoAnterior = grupo;
    }
    html += crearCarta(j);
  }
  grilla.innerHTML = html || `<p class="vacio">No hay jugadores con esos filtros.</p>`;
  botonVerMas.style.display = lista.length > cantidadVisible ? "inline-block" : "none";
}

// ---------- 7b. Ficha individual del jugador ----------
const ficha = document.getElementById("ficha");

// Percentil dentro de su puesto (solo contra jugadores con 450' o más)
function percentilEnPuesto(j, funcionValor, menorEsMejor) {
  const grupo = jugadoresUnificados.filter(o => o.puesto === j.puesto && o.minutos >= 450);
  const valor = funcionValor(j);
  if (valor == null || grupo.length === 0) return null;
  const valores = grupo.map(funcionValor).filter(v => v != null);
  const peores = valores.filter(v => menorEsMejor ? v > valor : v < valor).length;
  return Math.round((peores / valores.length) * 100);
}

// Puesto en el ranking de su posición: 1 = el mejor. Devuelve { lugar, total } o null
function rankingEnPuesto(j, funcionValor, menorEsMejor) {
  const grupo = jugadoresUnificados.filter(o => o.puesto === j.puesto && o.minutos >= 450);
  const valor = funcionValor(j);
  if (valor == null || grupo.length === 0) return null;
  const valores = grupo.map(funcionValor).filter(v => v != null);
  const mejores = valores.filter(v => menorEsMejor ? v < valor : v > valor).length;
  return { lugar: mejores + 1, total: valores.length };
}

// Emoji para los mejores: 1º = 🥇, del 2º al 5º = ⭐
function medalla(lugar) {
  if (lugar === 1) return "🥇 ";
  if (lugar <= 5) return "⭐ ";
  return "";
}

// Etiqueta que describe la POSICIÓN en el ranking (solo se muestra si está en el 25% mejor)
function nivel(p) {
  if (p >= 90) return "Top 10%";
  if (p >= 75) return "Top 25%";
  if (p >= 50) return "Mitad de arriba";
  return "Mitad de abajo";
}
function claseNivel(p) {
  if (p >= 90) return "nivel--1";
  if (p >= 75) return "nivel--2";
  if (p >= 50) return "nivel--3";
  return "nivel--4";
}

// Orden de las estadísticas en la ficha: primero lo más importante de cada puesto
const ordenFicha = {
  DEF: ["Recuperaciones", "Intercepciones", "Minutos jugados", "Centros", "Asistencias", "Goles", "Tiros al arco", "Faltas recibidas"],
  MED: ["Recuperaciones", "Asistencias", "Centros", "Faltas recibidas", "Goles", "Tiros al arco", "Intercepciones", "Minutos jugados"],
  DEL: ["Goles", "Tiros al arco", "Asistencias", "Faltas recibidas", "Centros", "Recuperaciones", "Intercepciones", "Minutos jugados"]
};

function abrirFicha(elegido) {
  // La ficha muestra siempre la TEMPORADA COMPLETA del jugador (todos sus clubes sumados)
  const j = jugadoresUnificados.find(x => x.nombre === elegido.nombre && x.edad === elegido.edad) || elegido;
  const porClub = jugadores.filter(x => x.nombre === j.nombre && x.edad === j.edad);
  // Modo de los promedios: por partido o cada 90 minutos (se cambia con los botones de la ficha)
  const cada90 = modoFicha === "90";
  const tasa = (v, x) => (v == null ? null : cada90 ? (x.minutos > 0 ? (v * 90) / x.minutos : 0) : (x.partidos > 0 ? v / x.partidos : 0));
  const redondo = v => (v == null ? null : Math.round(v * 100) / 100);
  const unidad = cada90 ? "cada 90'" : "por partido";
  const grupoTexto = nombresPuestos[j.puesto].toLowerCase();

  // [nombre, total, promedio, función para comparar, menor es mejor]
  const m = (nombre, campo, menor) => [nombre, campo(j), redondo(tasa(campo(j), j)), x => (campo(x) == null ? null : tasa(campo(x), x)), menor];
  let metricas;
  if (j.puesto === "ARQ") {
    metricas = [
      m("Atajadas", x => x.atajadas),
      ["% de atajadas", j.pctAtajadas + "%", null, x => x.pctAtajadas ?? null],
      m("Vallas invictas", x => x.vallasInvictas),
      m("Goles recibidos", x => x.golesRecibidos, true),
      ["Minutos jugados", j.minutos, null, x => x.minutos]
    ];
  } else {
    metricas = [
      m("Goles", x => x.goles),
      m("Tiros al arco", x => x.tirosAlArco),
      m("Asistencias", x => x.asistencias),
      m("Recuperaciones", x => x.quites + x.intercepciones),
      m("Intercepciones", x => x.intercepciones),
      m("Faltas recibidas", x => x.faltasRecibidas),
      m("Centros", x => x.centros),
      ["Minutos jugados", j.minutos, null, x => x.minutos]
    ];
  }

  if (ordenFicha[j.puesto]) {
    metricas.sort((x, y) => ordenFicha[j.puesto].indexOf(x[0]) - ordenFicha[j.puesto].indexOf(y[0]));
  }

  // Con menos de 450' mostramos igual sus números, pero sin compararlo
  const alcanza = j.minutos >= 450;
  const datosRadar = []; // para el gráfico de perfil
  const perfil = metricas.map(function (m) {
    const r = alcanza ? rankingEnPuesto(j, m[3], m[4]) : null;
    // Barra y nivel salen del mismo ranking: 1º de 100 = 100, 50º de 100 = 51
    const p = r ? Math.round((1 - (r.lugar - 1) / r.total) * 100) : null;
    if (p != null && m[0] !== "Minutos jugados") datosRadar.push({ nombre: m[0], p: p });
    const lado = p == null
      ? `<span class="perfil__top">–</span><span class="perfil__nivel">sin comparar</span>`
      : `<span class="perfil__top">${medalla(r.lugar)}${r.lugar}º <small>de ${r.total}</small></span>
         ${p >= 75 ? `<span class="nivel ${claseNivel(p)}">${nivel(p)}</span>` : ""}`;
    return `
      <div class="perfil__fila" ${p == null ? "" : `title="Mejor que el ${p}% de los ${grupoTexto}"`}>
        <div class="perfil__texto">
          <span class="perfil__nombre">${m[0]}</span>
          <span class="perfil__valor">${m[2] != null ? `${m[2]}<small> ${unidad} · ${m[1] ?? "-"} en total</small>` : (m[1] ?? "-")}</span>
        </div>
        <div class="perfil__barra"><div class="perfil__relleno" style="width:${p == null ? 0 : Math.max(p, 2)}%"></div></div>
        <div class="perfil__lado">${lado}</div>
      </div>`;
  }).join("");
  const radar = datosRadar.length >= 3 ? dibujarRadar(datosRadar) : "";
  const avisoMinutos = alcanza ? "" :
    `<p class="ficha__nota">Jugó ${j.minutos}' en la temporada: con menos de 450' no lo comparamos con los demás ${grupoTexto}.</p>`;
  const detalleClubes = porClub.length > 1
    ? `<p class="ficha__nota">Temporada completa: ${porClub.map(c => `${c.equipo} (${c.partidos} PJ)`).join(" + ")}.</p>`
    : "";

  const cuadros = j.puesto === "ARQ"
    ? [["Partidos", j.partidos], ["Minutos", j.minutos], ["Atajadas", j.atajadas], ["Vallas invictas", j.vallasInvictas]]
    : [["Partidos", j.partidos], ["Minutos", j.minutos], ["Goles", j.goles], ["Asistencias", j.asistencias]];
  const htmlCuadros = cuadros.map(c => `
      <div class="cuadro"><span class="cuadro__valor">${c[1] ?? "-"}</span><span class="cuadro__nombre">${c[0]}</span></div>`).join("");

  const foto = j.foto ? `<img src="${j.foto}" alt="${j.nombre}" onerror="this.remove()">` : "";
  ficha.innerHTML = `
    <div class="ficha__caja" style="--color: ${colores[j.puesto]}">
      <button class="ficha__cerrar" aria-label="Cerrar">✕</button>
      <div class="ficha__cabecera">
        <div class="carta__avatar ficha__foto">${foto}<span>${iniciales(j.nombre)}</span></div>
        <div>
          <span class="carta__puesto">${{ ARQ: "Arquero", DEF: "Defensor", MED: "Mediocampista", DEL: "Delantero" }[j.puesto] || "Sin puesto"}</span>
          <h2 class="ficha__nombre">${j.nombre}</h2>
          <div class="ficha__acciones">
            <button class="boton-seguir ${loSigo(j) ? "boton-seguir--activo" : ""}" data-seguir>${loSigo(j) ? "★ Siguiendo" : "☆ Seguir"}</button>
            <button class="boton-seguir" data-compartir>🔗 Compartir</button>
          </div>
          <p class="carta__info"><img class="mini-escudo" src="${escudo(j.equipoId)}" alt="">${(j.clubes || [j.equipo]).join(" / ")}
             · ${j.pais} · ${j.edad ?? "-"} años</p>
          ${j.enPlantel ? "" : `<span class="aviso-fuera">Ya no está en el club</span>`}
        </div>
      </div>

      <div class="cuadros">${htmlCuadros}</div>

      ${detalleClubes}
      <h3 class="ficha__subtitulo">Temporada ${ligaActual.temporada} · su lugar entre los ${grupoTexto} de la liga</h3>
      <div class="modo">
        <button class="modo__opcion ${cada90 ? "" : "activo"}" data-modo="partido">Por partido</button>
        <button class="modo__opcion ${cada90 ? "activo" : ""}" data-modo="90">Cada 90 minutos</button>
      </div>
      ${radar}
      <div class="perfil">${perfil}</div>
      ${avisoMinutos}

      <div class="comp__buscador">
        <input class="campo campo--buscar comp__buscar" type="search" placeholder="⚖️ Comparar con otro jugador…">
        <ul class="resultados comp__resultados"></ul>
      </div>
      <p class="ficha__nota">El ranking compara el promedio ${unidad} contra los ${grupoTexto} de la liga con 450' o más (🥇 = 1º, ⭐ = top 5). Las estadísticas están ordenadas por importancia para su puesto.
      Titular en ${j.titular} de ${j.partidos} partidos · ${j.amarillas} ${j.amarillas === 1 ? "amarilla" : "amarillas"}, ${j.rojas} ${j.rojas === 1 ? "roja" : "rojas"}.</p>
    </div>`;
  ficha.hidden = false;
  fichaActual = j;
  document.title = `${j.nombre} · Scouteando`;
  ponerRuta(rutaJugador(j));
}

// ---------- Gráfico de perfil (radar) ----------
// Cada eje es una estadística; cuanto más lejos del centro, mejor ubicado en el ranking de su puesto.
function dibujarRadar(datos) {
  const tam = 300, c = tam / 2, radio = 100;
  const punto = (i, valor) => {
    const angulo = (-90 + (360 * i) / datos.length) * (Math.PI / 180);
    return [c + Math.cos(angulo) * radio * (valor / 100), c + Math.sin(angulo) * radio * (valor / 100)];
  };
  const anillos = [25, 50, 75, 100].map(v =>
    `<polygon class="radar__anillo" points="${datos.map((_, i) => punto(i, v).join(",")).join(" ")}"/>`).join("");
  const ejes = datos.map((_, i) => {
    const [x, y] = punto(i, 100);
    return `<line class="radar__eje" x1="${c}" y1="${c}" x2="${x}" y2="${y}"/>`;
  }).join("");
  const forma = `<polygon class="radar__forma" points="${datos.map((d, i) => punto(i, Math.max(d.p, 3)).join(",")).join(" ")}"/>`;
  const puntos = datos.map((d, i) => {
    const [x, y] = punto(i, Math.max(d.p, 3));
    return `<circle class="radar__punto" cx="${x}" cy="${y}" r="4"><title>${d.nombre}: mejor que el ${d.p}% de su puesto</title></circle>`;
  }).join("");
  const etiquetas = datos.map((d, i) => {
    const [x, y] = punto(i, 128);
    const ancla = Math.abs(x - c) < 10 ? "middle" : x > c ? "start" : "end";
    return `<text class="radar__texto" x="${x}" y="${y}" text-anchor="${ancla}" dominant-baseline="middle">${d.nombre}</text>`;
  }).join("");
  return `<svg class="radar" viewBox="-60 0 ${tam + 120} ${tam}" role="img" aria-label="Gráfico de perfil del jugador">
    ${anillos}${ejes}${forma}${puntos}${etiquetas}</svg>`;
}

let modoFicha = "partido"; // "partido" | "90"

// ---------- Comparador de dos jugadores ----------
let fichaActual = null;

// Métricas para comparar: [nombre, función (por partido), menor es mejor]
function metricasComparacion(a, b) {
  if (a.puesto === "ARQ" && b.puesto === "ARQ") {
    return [
      ["Atajadas por partido", x => porPartido(x.atajadas, x)],
      ["% de atajadas", x => x.pctAtajadas],
      ["Vallas invictas", x => x.vallasInvictas],
      ["Goles recibidos por partido", x => porPartido(x.golesRecibidos, x), true],
      ["Partidos", x => x.partidos],
      ["Minutos", x => x.minutos]
    ];
  }
  const pp2 = (v, x) => (x.partidos > 0 ? Math.round((v / x.partidos) * 100) / 100 : 0);
  return [
    ["Partidos", x => x.partidos],
    ["Minutos", x => x.minutos],
    ["Goles", x => x.goles],
    ["Asistencias", x => x.asistencias],
    ["Goles por partido", x => pp2(x.goles, x)],
    ["Tiros al arco por partido", x => pp2(x.tirosAlArco, x)],
    ["Asistencias por partido", x => pp2(x.asistencias, x)],
    ["Recuperaciones por partido", x => pp2(x.quites + x.intercepciones, x)],
    ["Intercepciones por partido", x => pp2(x.intercepciones, x)],
    ["Faltas recibidas por partido", x => pp2(x.faltasRecibidas, x)],
    ["Centros por partido", x => pp2(x.centros, x)],
    ["Tarjetas amarillas", x => x.amarillas, true]
  ];
}

function abrirComparacion(a, b) {
  const cabeza = x => `
    <div class="comp__jugador">
      <div class="carta__avatar ficha__foto" style="--color: ${colores[x.puesto]}">${x.foto ? `<img src="${x.foto}" alt="" onerror="this.remove()">` : ""}<span>${iniciales(x.nombre)}</span></div>
      <h3>${x.nombre}</h3>
      <p class="carta__info"><img class="mini-escudo" src="${escudo(x.equipoId)}" alt="">${x.equipo} · ${x.edad ?? "-"} años</p>
    </div>`;
  let ganaA = 0, ganaB = 0;
  const filas = metricasComparacion(a, b).map(function ([nombre, f, menor]) {
    const va = f(a) ?? 0, vb = f(b) ?? 0;
    const mejorA = menor ? va < vb : va > vb;
    const mejorB = menor ? vb < va : vb > va;
    if (mejorA) ganaA++;
    if (mejorB) ganaB++;
    return `
      <div class="comp__fila">
        <span class="comp__valor ${mejorA ? "comp__valor--mejor" : ""}">${va}</span>
        <span class="comp__nombre">${nombre}</span>
        <span class="comp__valor ${mejorB ? "comp__valor--mejor" : ""}">${vb}</span>
      </div>`;
  }).join("");

  ficha.innerHTML = `
    <div class="ficha__caja comp">
      <button class="ficha__cerrar" aria-label="Cerrar">✕</button>
      <h3 class="ficha__subtitulo">Comparación · temporada ${ligaActual.temporada}</h3>
      <div class="comp__cabeza">${cabeza(a)}<span class="comp__vs">VS</span>${cabeza(b)}</div>
      <div class="comp__marcador"><span>${ganaA}</span> estadísticas mejores <span>${ganaB}</span></div>
      <div class="comp__tabla">${filas}</div>
      <p class="ficha__nota">En verde, el mejor en cada estadística. Los promedios son por partido jugado.
      ${a.puesto !== b.puesto ? "Ojo: juegan en puestos distintos, la comparación es orientativa." : ""}</p>
      <button class="filtro comp__volver" data-volver="${a.nombre}|${a.edad}">← Volver a la ficha de ${a.nombre}</button>
    </div>`;
  ficha.hidden = false;
}

// Buscador "Comparar con…" dentro de la ficha
ficha.addEventListener("input", function (e) {
  if (!e.target.matches(".comp__buscar")) return;
  const buscado = normalizar(e.target.value.trim());
  const lista = ficha.querySelector(".comp__resultados");
  if (buscado.length < 2) { lista.innerHTML = ""; return; }
  lista.innerHTML = buscarJugadores(jugadoresUnificados.filter(x => x !== fichaActual), buscado, 6)
    .map(x => `<li class="lider" data-comparar="${x.nombre}|${x.edad}">
        <span class="lider__foto">${x.foto ? `<img src="${x.foto}" alt="" onerror="this.remove()">` : ""}<span>${iniciales(x.nombre)}</span></span>
        <span class="lider__nombre">${x.nombre}<small>${x.equipo} · ${nombresPuestos[x.puesto]}</small></span>
      </li>`).join("");
});

ficha.addEventListener("click", function (e) {
  const botonModo = e.target.closest("[data-modo]");
  if (botonModo && fichaActual) {
    modoFicha = botonModo.dataset.modo;
    abrirFicha(fichaActual);
    return;
  }
  if (e.target.closest("[data-seguir]") && fichaActual) {
    alternarSeguir(fichaActual);
    const boton = e.target.closest("[data-seguir]");
    boton.classList.toggle("boton-seguir--activo", loSigo(fichaActual));
    boton.textContent = loSigo(fichaActual) ? "★ Siguiendo" : "☆ Seguir";
    return;
  }
  const botonCompartir = e.target.closest("[data-compartir]");
  if (botonCompartir && fichaActual) {
    compartirLink(botonCompartir, `${fichaActual.nombre} en Scouteando`);
    return;
  }
  const elegido = e.target.closest("[data-comparar]");
  if (elegido) {
    const [nombre, edad] = elegido.dataset.comparar.split("|");
    const otro = jugadoresUnificados.find(x => x.nombre === nombre && String(x.edad) === edad);
    if (otro && fichaActual) abrirComparacion(fichaActual, otro);
    return;
  }
  const volverA = e.target.closest("[data-volver]");
  if (volverA && fichaActual) abrirFicha(fichaActual);
});

function cerrarFicha() {
  if (ficha.hidden) return;
  // Si la ficha tiene su propio link (#/liga/jugador/...), volvemos atrás en el historial:
  // así el botón "atrás" del celu y la X hacen lo mismo.
  if (/\/jugador\//.test(location.hash) && fichaAbiertaPorNosotros) return history.back();
  ocultarFicha();
  ponerRuta(rutaVista(), true);
}
function ocultarFicha() {
  ficha.hidden = true;
  fichaAbiertaPorNosotros = false;
  document.title = "Scouteando · Estadísticas de jugadores de fútbol";
  if (vista === "seguidos") mostrarSeguidos();
  else if (vista === "plantel") mostrarJugadores();
}

// Copia el link actual (o abre el menú "Compartir" del celu)
function compartirLink(boton, titulo) {
  const url = location.href;
  const avisar = texto => { const antes = boton.textContent; boton.textContent = texto; setTimeout(() => (boton.textContent = antes), 2000); };
  if (navigator.share) {
    navigator.share({ title: titulo, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => avisar("✓ Link copiado"), () => avisar(url));
  } else {
    avisar(url);
  }
}

// ---------- 7c. Vista LÍDERES (Top 10 por estadística) ----------
// [título, clave de "estadisticas", minutos mínimos para entrar]
const tablasLideres = [
  ["Goles", "goles", 0],
  ["Asistencias", "asistencias", 0],
  ["Goles + asistencias", "ga", 0],
  ["Goles por partido", "golesPP", 900],
  ["Recuperaciones", "recuperaciones", 0],
  ["Intercepciones", "intercepciones", 0],
  ["Faltas recibidas", "faltas", 0],
  ["Centros", "centros", 0],
  ["Atajadas", "atajadas", 0],
  ["Vallas invictas", "vallas", 0],
  ["% de atajadas", "pctAtajadas", 900],
  ["Tiros al arco", "tirosAlArco", 0],
  ["Minutos jugados", "minutos", 0]
];

// Filtros de Líderes: puesto, edad (rango), nacionalidad y minutos mínimos
let puestoLideres = "TODOS";
let edadLideres = "";      // "" = todas, o "desde-hasta" (ej. "0-23")
let paisLideres = "";      // "" = todas, o código (ej. "ARG")
let minutosLideres = 0;
const filtrosLideres = document.getElementById("filtrosLideres");
const filtroEdad = document.getElementById("filtroEdad");
const filtroPais = document.getElementById("filtroPais");
const filtroMinutos = document.getElementById("filtroMinutos");

const nombresPaises = {
  ARG: "Argentina", BRA: "Brasil", URU: "Uruguay", PAR: "Paraguay", COL: "Colombia", CHI: "Chile",
  ECU: "Ecuador", PER: "Perú", VEN: "Venezuela", BOL: "Bolivia", MEX: "México", USA: "Estados Unidos",
  ESP: "España", ITA: "Italia", POR: "Portugal", FRA: "Francia", GER: "Alemania", CRC: "Costa Rica",
  PAN: "Panamá", HON: "Honduras", ANG: "Angola", JPN: "Japón", NED: "Países Bajos", BEL: "Bélgica"
};

// Llena la lista de nacionalidades con las que hay en la liga (las más comunes primero)
function llenarPaises() {
  const cuenta = {};
  for (const j of jugadoresUnificados) if (j.pais && j.pais !== "-") cuenta[j.pais] = (cuenta[j.pais] || 0) + 1;
  const paises = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a]);
  if (!paises.includes(paisLideres)) paisLideres = "";
  filtroPais.innerHTML = `<option value="">Todas</option>` +
    paises.map(p => `<option value="${p}">${nombresPaises[p] || p} (${cuenta[p]})</option>`).join("");
  filtroPais.value = paisLideres;
}

filtrosLideres.addEventListener("click", function (e) {
  const boton = e.target.closest("button[data-puesto]");
  if (!boton) return;
  puestoLideres = boton.dataset.puesto;
  mostrarLideres();
});
filtroEdad.addEventListener("change", () => { edadLideres = filtroEdad.value; mostrarLideres(); });
filtroPais.addEventListener("change", () => { paisLideres = filtroPais.value; mostrarLideres(); });
filtroMinutos.addEventListener("change", () => { minutosLideres = Number(filtroMinutos.value); mostrarLideres(); });

function mostrarLideres() {
  // Marcar los botones activos
  for (const b of filtrosLideres.querySelectorAll("button[data-puesto]")) b.classList.toggle("activo", b.dataset.puesto === puestoLideres);
  const [edadDesde, edadHasta] = edadLideres ? edadLideres.split("-").map(Number) : [0, 99];
  const base = jugadoresUnificados.filter(j =>
    (!edadLideres || (j.edad != null && j.edad >= edadDesde && j.edad <= edadHasta)) &&
    (!paisLideres || j.pais === paisLideres) &&
    (puestoLideres === "TODOS" || j.puesto === puestoLideres));

  vistaLideres.innerHTML = tablasLideres.map(function ([tituloTabla, clave, minimoTabla]) {
    const minimo = Math.max(minimoTabla, minutosLideres);
    const est = estadisticas[clave];
    const top = base
      .filter(j => est.valor(j) != null && j.minutos >= minimo && (est.valor(j) > 0 || est.menor))
      .sort((a, b) => (est.menor ? est.valor(a) - est.valor(b) : est.valor(b) - est.valor(a)) || b.minutos - a.minutos)
      .slice(0, 10);

    // Con empates, comparten el lugar (ej.: tres jugadores con 13 goles son todos 1º)
    const lugares = top.map(j => top.filter(o => est.menor ? est.valor(o) < est.valor(j) : est.valor(o) > est.valor(j)).length + 1);
    const filas = top.map(function (j, i) {
      const foto = j.foto ? `<img src="${j.foto}" alt="" loading="lazy" onerror="this.remove()">` : "";
      const valor = clave === "pctAtajadas" ? est.valor(j) + "%" : est.valor(j);
      return `
        <li class="lider" data-clave="${j.nombre}|${j.edad}|">
          <span class="lider__pos">${lugares[i] === 1 ? "🥇" : lugares[i]}</span>
          <span class="lider__foto">${foto}<span>${iniciales(j.nombre)}</span></span>
          <span class="lider__nombre">${j.nombre}
            <small><img class="mini-escudo" src="${escudo(j.equipoId)}" alt="">${j.equipo}${edadLideres ? " · " + j.edad + " años" : ""}${paisLideres ? "" : " · " + j.pais}</small></span>
          <span class="lider__valor">${valor}</span>
        </li>`;
    }).join("");

    if (top.length === 0) return ""; // tabla sin jugadores con esos filtros (ej.: atajadas de delanteros)
    const nota = minimo ? `<p class="tabla-lideres__nota">Mínimo ${minimo} minutos jugados</p>` : "";
    return `
      <section class="tabla-lideres">
        <h2>${tituloTabla}</h2>
        <ol>${filas}</ol>
        ${nota}
      </section>`;
  }).join("") || `<p class="vacio vacio--grande">No hay jugadores con esos filtros.</p>`;

  titulo.textContent = "Líderes";
  const filtroTexto = [
    edadLideres ? filtroEdad.options[filtroEdad.selectedIndex].text : "",
    paisLideres ? nombresPaises[paisLideres] || paisLideres : "",
    puestoLideres !== "TODOS" ? nombresPuestos[puestoLideres].toLowerCase() : "",
    minutosLideres ? `+${minutosLideres}'` : ""
  ].filter(Boolean).join(" · ");
  resumen.textContent = `Top 10 de ${ligaActual.nombre} ${ligaActual.temporada}${filtroTexto ? " · " + filtroTexto : ""}`;
}

vistaLideres.addEventListener("click", function (e) {
  const fila = e.target.closest(".lider");
  if (!fila) return;
  const [nombre, edad] = fila.dataset.clave.split("|");
  const j = jugadoresUnificados.find(x => x.nombre === nombre && String(x.edad) === edad);
  if (j) abrirFicha(j);
});

// ---------- 7d. Buscador de jugadores ----------
// En la portada busca en TODAS las ligas disponibles; dentro de una liga, solo en esa.
const ligasDisponibles = () => LIGAS.filter(l => l.disponible);

function mostrarResultadosGlobales() {
  const texto = buscadorGlobal.value;
  if (normalizar(texto.trim()).length < 2) { resultadosGlobal.innerHTML = ""; return; }
  const enPortada = vista === "ligas";
  const ligas = enPortada ? ligasDisponibles() : [ligaActual];
  let candidatos = [];
  let cargando = false;
  for (const liga of ligas) {
    if (!(window.DATOS_LIGAS && window.DATOS_LIGAS[liga.id])) {
      cargando = true;
      cargarDatos(liga.id, mostrarResultadosGlobales); // cuando llega, se vuelve a buscar
      continue;
    }
    candidatos = candidatos.concat(unificadosDe(liga.id));
  }
  const encontrados = buscarJugadores(candidatos, texto, enPortada ? 10 : 8);
  const nombreLiga = id => LIGAS.find(l => l.id === id);
  resultadosGlobal.innerHTML = encontrados.length
    ? encontrados.map(j => `
        <li class="lider" data-clave="${j.nombre}|${j.edad}|" data-liga="${j.liga}">
          <span class="lider__foto">${j.foto ? `<img src="${j.foto}" alt="" onerror="this.remove()">` : ""}<span>${iniciales(j.nombre)}</span></span>
          <span class="lider__nombre">${j.nombre}
            <small><img class="mini-escudo" src="${escudo(j.equipoId)}" alt="">${j.equipo} · ${nombresPuestos[j.puesto]}${enPortada ? ` · <img class="mini-escudo" src="${bandera(nombreLiga(j.liga).bandera)}" alt="">${nombreLiga(j.liga).pais}` : ""}</small></span>
        </li>`).join("")
    : `<li class="vacio">${cargando ? "Buscando…" : "No encontramos a ningún jugador con ese nombre."}</li>`;
}
buscadorGlobal.addEventListener("input", mostrarResultadosGlobales);

resultadosGlobal.addEventListener("click", function (e) {
  const fila = e.target.closest(".lider");
  if (!fila) return;
  const [nombre, edad] = fila.dataset.clave.split("|");
  const abrir = function () {
    const j = jugadoresUnificados.find(x => x.nombre === nombre && String(x.edad) === edad);
    if (j) abrirFicha(j);
  };
  // Desde la portada: primero entramos a la liga del jugador
  if (vista === "ligas") activarLiga(fila.dataset.liga, () => { irA("equipos"); abrir(); });
  else abrir();
});

// ---------- 7e. Resumen del equipo (arriba del plantel) ----------
function mostrarResumenEquipo() {
  const plantel = jugadores.filter(j => j.equipo === equipoElegido && j.enPlantel);
  const mejor = f => [...plantel].sort((a, b) => f(b) - f(a))[0];
  const destacados = [
    ["Goleador", mejor(j => j.goles), j => j.goles + " goles"],
    ["Asistidor", mejor(j => j.asistencias), j => j.asistencias + " asist."],
    ["Más recupera", mejor(j => j.quites + j.intercepciones), j => (j.quites + j.intercepciones) + " recup."],
    ["Más minutos", mejor(j => j.minutos), j => j.minutos + " min"]
  ];
  const goles = plantel.reduce((s, j) => s + j.goles, 0);
  const enTablas = posicionesDeEquipo(equipoElegido).map(({ t, fila }) => `
    <div class="destacado destacado--total"><span class="destacado__valor">${fila.pos}º</span>
      <span class="destacado__rol">${t.competencia}${t.grupo ? " · " + t.grupo : ""} · ${fila.pts} pts</span></div>`).join("");
  resumenEquipo.innerHTML = `${enTablas}
    <div class="destacado destacado--total"><span class="destacado__valor">${goles}</span><span class="destacado__rol">Goles de sus jugadores</span></div>
    ${destacados.map(([rol, j, texto]) => `
      <div class="destacado lider" data-clave="${j.nombre}|${j.edad}|${j.equipo}">
        <span class="lider__foto">${j.foto ? `<img src="${j.foto}" alt="" onerror="this.remove()">` : ""}<span>${iniciales(j.nombre)}</span></span>
        <span class="lider__nombre"><small>${rol}</small>${j.nombre}<small>${texto(j)}</small></span>
      </div>`).join("")}`;
}

resumenEquipo.addEventListener("click", function (e) {
  const fila = e.target.closest(".lider");
  if (!fila) return;
  const [nombre, edad, equipo] = fila.dataset.clave.split("|");
  const j = jugadores.find(x => x.nombre === nombre && String(x.edad) === edad && x.equipo === equipo);
  if (j) abrirFicha(j);
});

// ---------- 7f. Vista LIGAS (pantalla de inicio) ----------
const vistaLigas = document.getElementById("vistaLigas");
const menuLiga = document.getElementById("menuLiga");

function bandera(codigo) {
  return `https://flagcdn.com/w80/${codigo}.png`;
}

function mostrarLigas() {
  const proximas = LIGAS.filter(l => !l.disponible);
  vistaLigas.innerHTML = LIGAS.filter(l => l.disponible).map(l => `
    <button class="liga ${l.disponible ? "" : "liga--pronto"}" data-liga="${l.id}" ${l.disponible ? "" : "disabled"}>
      <img class="liga__bandera" src="${bandera(l.bandera)}" alt="Bandera de ${l.pais}">
      <span class="liga__nombre">${l.nombre}</span>
      <span class="liga__pais">${l.pais} · ${l.temporada}</span>
      <span class="liga__estado">${l.disponible ? "Actualizado " + l.actualizado : "Próximamente"}</span>
    </button>`).join("") + (totalSeguidos() ? `
    <button class="liga liga--seguidos" data-seguidos>
      <span class="liga__nombre">⭐ Mis jugadores</span>
      <span class="liga__pais">${totalSeguidos()} en seguimiento, de todas las ligas</span>
    </button>` : "") + (proximas.length ? `
    <p class="ligas__proximas">Próximamente: ${proximas.map(l => `${l.nombre} (${l.pais})`).join(", ")}.</p>` : "");
  titulo.textContent = "Scouting de jugadores";
  resumen.textContent = "Cada jugador comparado con los de su mismo puesto: quién recupera más, quién patea más al arco, quién está en el top 10% de su liga.";
  buscadorGlobal.placeholder = "Buscá un jugador de cualquier liga…";
}

// Carga el archivo de datos de una liga (datos/generados/<id>.js) solo cuando hace falta
const unificadosPorLiga = {};
function cargarDatos(id, listo) {
  if (window.DATOS_LIGAS && window.DATOS_LIGAS[id]) return listo();
  const liga = LIGAS.find(l => l.id === id);
  const script = document.createElement("script");
  script.src = `datos/generados/${id}.js?v=${liga.actualizado}`;
  script.onload = listo;
  script.onerror = () => console.error("No se pudieron cargar los datos de " + liga.nombre);
  document.body.appendChild(script);
}
// Jugadores unificados de una liga ya cargada (cada uno sabe de qué liga es)
function unificadosDe(id) {
  if (!unificadosPorLiga[id]) {
    for (const j of window.DATOS_LIGAS[id]) j.liga = id;
    unificadosPorLiga[id] = unificar(window.DATOS_LIGAS[id]);
  }
  return unificadosPorLiga[id];
}
// Deja una liga como "actual" (sin cambiar de pantalla)
function activarLiga(id, listo) {
  cargarDatos(id, function () {
    ligaActual = LIGAS.find(l => l.id === id);
    jugadoresUnificados = unificadosDe(id);
    jugadores = window.DATOS_LIGAS[id];
    tablasLiga = (window.DATOS_TABLAS && window.DATOS_TABLAS[id]) || [];
    llenarPaises();
    listo();
  });
}
function cargarLiga(id) {
  activarLiga(id, () => irA("equipos"));
}

vistaLigas.addEventListener("click", function (e) {
  const boton = e.target.closest(".liga");
  if (!boton || boton.disabled) return;
  if (boton.dataset.seguidos !== undefined) {
    // Necesitamos una liga "actual" para el menú: usamos la primera que tenga seguidos
    const primera = LIGAS.find(l => (seguidos[l.id] || []).length);
    return activarLiga(primera.id, () => irA("seguidos"));
  }
  cargarLiga(boton.dataset.liga);
});

// ---------- 7g. Lista de seguimiento ("Mis jugadores") ----------
// Se guarda en el navegador (localStorage), por liga, y se muestran todas las ligas juntas. Si el navegador no deja guardar, funciona igual mientras la página está abierta.
let seguidos = {}; // { argentina: ["Nombre|edad", ...] }
try { seguidos = JSON.parse(localStorage.getItem("scouting-seguidos")) || {}; } catch (e) { seguidos = {}; }

function guardarSeguidos() {
  try { localStorage.setItem("scouting-seguidos", JSON.stringify(seguidos)); } catch (e) { /* sin almacenamiento */ }
}
const claveJugador = j => j.nombre + "|" + j.edad;
const listaDe = id => (seguidos[id] = seguidos[id] || []);
const loSigo = j => listaDe(j.liga || ligaActual.id).includes(claveJugador(j));
const totalSeguidos = () => LIGAS.reduce((n, l) => n + (seguidos[l.id] || []).length, 0);

function alternarSeguir(j) {
  const lista = listaDe(j.liga || ligaActual.id);
  const i = lista.indexOf(claveJugador(j));
  if (i >= 0) lista.splice(i, 1);
  else lista.push(claveJugador(j));
  guardarSeguidos();
  actualizarContadorSeguidos();
}

function actualizarContadorSeguidos() {
  const boton = document.querySelector('.menu__opcion[data-vista="seguidos"]');
  if (boton) boton.textContent = `⭐ Mis jugadores (${totalSeguidos()})`;
}

const vistaSeguidos = document.getElementById("vistaSeguidos");

function mostrarSeguidos() {
  const ligasConSeguidos = LIGAS.filter(l => (seguidos[l.id] || []).length);
  let html = "";
  for (const liga of ligasConSeguidos) {
    // Si la liga todavía no se cargó, la cargamos y volvemos a dibujar
    if (!(window.DATOS_LIGAS && window.DATOS_LIGAS[liga.id])) {
      cargarDatos(liga.id, () => { if (vista === "seguidos") mostrarSeguidos(); });
      html += `<h3 class="grupo">${liga.nombre} · cargando…</h3>`;
      continue;
    }
    const todos = unificadosDe(liga.id);
    const lista = seguidos[liga.id]
      .map(c => todos.find(j => claveJugador(j) === c))
      .filter(Boolean)
      .sort((x, y) => ordenPuestos[x.puesto] - ordenPuestos[y.puesto] || y.minutos - x.minutos);
    if (!lista.length) continue;
    html += `<h3 class="grupo"><img class="mini-escudo" src="${bandera(liga.bandera)}" alt=""> ${liga.nombre}</h3>` +
      lista.map(j => crearCarta(j).replace("<article ", `<article data-liga="${liga.id}" `)).join("");
  }

  const total = totalSeguidos();
  titulo.textContent = "Mis jugadores";
  resumen.textContent = total ? `${total} jugador${total === 1 ? "" : "es"} en seguimiento · todas las ligas` : "";
  vistaSeguidos.innerHTML = html ||
    `<div class="vacio vacio--grande">
       <p>Todavía no seguís a ningún jugador.</p>
       <p>Abrí la ficha de un jugador y tocá <strong>☆ Seguir</strong> para sumarlo a tu lista.</p>
     </div>`;
}

vistaSeguidos.addEventListener("click", function (e) {
  const carta = e.target.closest(".carta");
  if (!carta) return;
  const link = e.target.closest(".carta__equipo");
  if (link) e.preventDefault();
  const [nombre, edad] = carta.dataset.clave.split("|");
  // Si el jugador es de otra liga, primero cambiamos a esa liga (así su ranking es contra su liga)
  activarLiga(carta.dataset.liga, function () {
    if (link) return irA("plantel", link.dataset.equipo);
    irA("seguidos");
    const j = jugadoresUnificados.find(x => x.nombre === nombre && String(x.edad) === edad);
    if (j) abrirFicha(j);
  });
});

// ---------- 7h. Vista POSICIONES ----------
const vistaPosiciones = document.getElementById("vistaPosiciones");
let tablasLiga = [];
let competenciaElegida = null;

// Zonas de la tabla (clasificación y descenso), se definen en datos/fuentes/<liga>/tablas.csv
const tiposZona = {
  lib: "Copa Libertadores",
  prelib: "Libertadores (fase previa)",
  sud: "Copa Sudamericana",
  play: "Clasifica a octavos",
  desc: "Descenso"
};
const zonaDe = (t, pos) => (t.zonas || []).find(z => pos >= z.desde && pos <= z.hasta);

function mostrarPosiciones() {
  const competencias = [...new Set(tablasLiga.map(t => t.competencia))];
  if (!competencias.includes(competenciaElegida)) competenciaElegida = competencias[0];

  const botones = competencias.map(c =>
    `<button class="filtro ${c === competenciaElegida ? "activo" : ""}" data-competencia="${c}">${c}</button>`).join("");
  const esPromedios = /promedio/i.test(competenciaElegida || "");

  const tablas = tablasLiga.filter(t => t.competencia === competenciaElegida).map(function (t) {
    const conUltimos = t.filas.some(f => f.ultimos.length);
    const filas = t.filas.map(f => `
      <tr class="${zonaDe(t, f.pos) ? "zona zona--" + zonaDe(t, f.pos).tipo : ""}">
        <td class="pos">${f.pos}</td>
        <td class="equipo-celda"><a href="#" class="carta__equipo" data-equipo="${f.equipo}"><img class="mini-escudo" src="${escudo(f.equipoId)}" alt="">${f.equipo}</a></td>
        <td>${f.pj}</td><td>${f.g}</td><td>${f.e}</td><td>${f.p}</td>
        <td class="ocultar-celu">${f.gf}</td><td class="ocultar-celu">${f.gc}</td><td>${f.dg > 0 ? "+" + f.dg : f.dg}</td>
        <td class="pts">${esPromedios ? f.promedio.toFixed(3) : f.pts}</td>
        ${conUltimos ? `<td class="ocultar-celu">${f.ultimos.map(r => `<span class="forma forma--${r}" title="${{ G: "Ganó", E: "Empató", P: "Perdió" }[r]}">${r}</span>`).join("")}</td>` : ""}
      </tr>`).join("");
    return `
      <section class="tabla-posiciones">
        ${t.grupo ? `<h2>${t.grupo}</h2>` : ""}
        <table>
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th>
            <th class="ocultar-celu">GF</th><th class="ocultar-celu">GC</th><th>DG</th><th>${esPromedios ? "Prom." : "Pts"}</th>
            ${conUltimos ? `<th class="ocultar-celu">Últimos 5</th>` : ""}</tr></thead>
          <tbody>${filas}</tbody>
        </table>
        ${(t.zonas || []).length ? `<ul class="zonas">${[...new Set(t.zonas.map(z => z.tipo))].map(tipo =>
          `<li><span class="zona-color zona--${tipo}"></span>${tiposZona[tipo] || tipo}</li>`).join("")}</ul>` : ""}
      </section>`;
  }).join("");

  vistaPosiciones.innerHTML = tablasLiga.length
    ? `<div class="filtros">${botones}</div><div class="posiciones">${tablas}</div>`
    : `<p class="vacio">Esta liga todavía no tiene tablas de posiciones cargadas.</p>`;
  titulo.textContent = "Posiciones";
  resumen.textContent = esPromedios
    ? "Promedio de puntos de las últimas temporadas: define los descensos"
    : `${competenciaElegida} · ${ligaActual.nombre}`;
  if (tablasLiga.some(t => (t.zonas || []).some(z => z.tipo !== "play" && z.tipo !== "desc")))
    vistaPosiciones.insertAdjacentHTML("beforeend", `<p class="nota-zonas">Las zonas de copas son de referencia: las plazas finales dependen también de los campeones de las copas nacionales.</p>`);
}

vistaPosiciones.addEventListener("click", function (e) {
  const boton = e.target.closest("[data-competencia]");
  if (boton) { competenciaElegida = boton.dataset.competencia; mostrarPosiciones(); return; }
  const link = e.target.closest(".carta__equipo");
  if (link) { e.preventDefault(); irA("plantel", link.dataset.equipo); }
});

// Posición de un equipo en cada tabla (para el resumen del plantel)
function posicionesDeEquipo(equipo) {
  return tablasLiga
    .filter(t => !/promedio/i.test(t.competencia))
    .map(t => ({ t, fila: t.filas.find(f => f.equipo === equipo) }))
    .filter(x => x.fila);
}

// ---------- 8. Cambiar de vista ----------
// Cada pantalla tiene su dirección (#/argentina/equipo/river-plate), así funcionan
// el botón "atrás" del navegador y los links directos.
let fichaAbiertaPorNosotros = false;

function rutaVista() {
  if (vista === "ligas" || !ligaActual) return "#/";
  const resto = { equipos: "", plantel: "equipo/" + slug(equipoElegido), posiciones: "posiciones", lideres: "lideres", seguidos: "seguidos" }[vista] ?? "";
  return `#/${ligaActual.id}/${resto}`.replace(/\/$/, "");
}
const rutaJugador = j => `#/${ligaActual.id}/jugador/${slug(j.nombre)}-${j.edad ?? ""}`;

// Agrega la dirección al historial (o la reemplaza, si "reemplazar")
function ponerRuta(ruta, reemplazar) {
  if (location.hash === ruta || (!location.hash && ruta === "#/")) return;
  if (reemplazar) history.replaceState(null, "", ruta);
  else {
    history.pushState(null, "", ruta);
    if (/\/jugador\//.test(ruta)) fichaAbiertaPorNosotros = true;
  }
}

// Lee la dirección y muestra esa pantalla (al abrir un link o al ir "atrás")
function aplicarRuta() {
  const [ligaId, tipo, valor] = decodeURIComponent(location.hash.replace(/^#\/?/, "")).split("/");
  const liga = LIGAS.find(l => l.id === ligaId && l.disponible);
  if (!liga) { if (!ficha.hidden) ocultarFicha(); return irA("ligas", null, true); }

  activarLiga(liga.id, function () {
    if (tipo === "jugador") {
      const j = jugadoresUnificados.find(x => `${slug(x.nombre)}-${x.edad ?? ""}` === valor);
      if (vista === "ligas" || !vista) irA("equipos", null, true);
      if (j) abrirFicha(j);
      return;
    }
    // Volver "atrás" desde una ficha a la misma pantalla: solo cerramos la ficha
    if (!ficha.hidden) {
      ocultarFicha();
      if (location.hash === rutaVista() || (!location.hash && vista === "ligas")) return;
    }
    if (tipo === "equipo") {
      const equipo = [...new Set(jugadores.map(j => j.equipo))].find(e => slug(e) === valor);
      return irA(equipo ? "plantel" : "equipos", equipo, true);
    }
    irA({ posiciones: "posiciones", lideres: "lideres", seguidos: "seguidos" }[tipo] || "equipos", null, true);
  });
}
window.addEventListener("popstate", aplicarRuta);

function irA(nuevaVista, equipo, desdeRuta) {
  vista = nuevaVista;
  if (equipo) equipoElegido = equipo;
  ordenElegido = "puesto";
  selectOrden.value = ordenElegido;
  cantidadVisible = 48;

  vistaLigas.hidden = vista !== "ligas";
  menuLiga.hidden = vista === "ligas";
  vistaEquipos.hidden = vista !== "equipos";
  busquedaGlobal.hidden = vista !== "equipos" && vista !== "ligas";
  if (vista === "equipos") buscadorGlobal.placeholder = `Buscar un jugador de ${ligaActual.nombre}…`;
  resultadosGlobal.innerHTML = "";
  buscadorGlobal.value = "";
  resumenEquipo.hidden = vista !== "plantel";
  if (vista === "plantel") mostrarResumenEquipo();
  vistaLideres.hidden = vista !== "lideres";
  vistaSeguidos.hidden = vista !== "seguidos";
  vistaPosiciones.hidden = vista !== "posiciones";
  actualizarContadorSeguidos();
  filtrosLideres.hidden = vista !== "lideres";
  vistaJugadores.hidden = vista !== "plantel";
  for (const b of botonesMenu) {
    b.classList.toggle("activo", b.dataset.vista === (vista === "plantel" ? "equipos" : vista));
  }
  if (vista === "ligas") volver.textContent = "Scouteando";
  else if (vista === "plantel") volver.textContent = "← Volver a equipos";
  else volver.innerHTML = `← Todas las ligas · <img class="mini-escudo" src="${bandera(ligaActual.bandera)}" alt=""> ${ligaActual.nombre} ${ligaActual.temporada}`;
  volver.classList.toggle("link", vista !== "ligas");

  if (vista === "ligas") mostrarLigas();
  else if (vista === "equipos") mostrarEquipos();
  else if (vista === "lideres") mostrarLideres();
  else if (vista === "seguidos") mostrarSeguidos();
  else if (vista === "posiciones") mostrarPosiciones();
  else mostrarJugadores();
  window.scrollTo({ top: 0 });
  if (!desdeRuta) ponerRuta(rutaVista());
}

function aplicarCambio() {
  cantidadVisible = 48;
  mostrarJugadores();
}

// ---------- 9. Eventos ----------
for (const b of botonesMenu) {
  b.addEventListener("click", () => irA(b.dataset.vista));
}

vistaEquipos.addEventListener("click", function (e) {
  const boton = e.target.closest(".equipo");
  if (boton) irA("plantel", boton.dataset.equipo);
});

volver.addEventListener("click", function () {
  if (vista === "plantel") irA("equipos");
  else if (vista !== "ligas") irA("ligas");
});

grilla.addEventListener("click", function (e) {
  const link = e.target.closest(".carta__equipo");
  if (link) {
    e.preventDefault();
    irA("plantel", link.dataset.equipo);
    return;
  }
  const carta = e.target.closest(".carta");
  if (!carta) return;
  const [nombre, edad, equipo] = carta.dataset.clave.split("|");
  const lista = equipo ? jugadores : jugadoresUnificados;
  const j = lista.find(x => x.nombre === nombre && String(x.edad) === edad && (!equipo || x.equipo === equipo));
  if (j) abrirFicha(j);
});

ficha.addEventListener("click", function (e) {
  // Cerrar con la X o tocando afuera de la caja
  if (e.target === ficha || e.target.closest(".ficha__cerrar")) cerrarFicha();
});

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") cerrarFicha();
});

for (const boton of botonesPuesto) {
  boton.addEventListener("click", function () {
    for (const b of botonesPuesto) b.classList.remove("activo");
    boton.classList.add("activo");
    puestoElegido = boton.dataset.puesto;
    aplicarCambio();
  });
}

selectOrden.addEventListener("change", function () {
  ordenElegido = selectOrden.value;
  aplicarCambio();
});

buscador.addEventListener("input", function () {
  textoBuscado = buscador.value;
  aplicarCambio();
});

botonVerMas.addEventListener("click", function () {
  cantidadVisible += 48;
  mostrarJugadores();
});

// ---------- 9b. "Acerca de" (se abre en la misma ventana que la ficha) ----------
document.getElementById("abrirAcerca").addEventListener("click", function () {
  const ligas = LIGAS.filter(l => l.disponible)
    .map(l => `<li>${l.nombre} ${l.temporada} · actualizado el ${l.actualizado}</li>`).join("");
  ficha.innerHTML = `
    <div class="ficha__caja acerca">
      <button class="ficha__cerrar" aria-label="Cerrar">✕</button>
      <h2>Acerca de</h2>
      <p>Scouteando es un proyecto personal de estadísticas de fútbol. Está hecho con HTML, CSS y JavaScript, sin frameworks.</p>
      <h3>Ligas</h3>
      <ul>${ligas}</ul>
      <h3>De dónde salen los datos</h3>
      <ul>
        <li><strong>Estadísticas y posiciones:</strong> FBref (fbref.com).</li>
        <li><strong>Fotos, escudos y planteles actuales:</strong> API-Football (api-football.com).</li>
        <li><strong>Banderas:</strong> flagcdn.com.</li>
      </ul>
      <h3>Cómo se calcula el ranking</h3>
      <p>En la ficha, cada jugador se compara con los de su mismo puesto en su liga que jugaron al menos 450 minutos.
         Los valores se muestran por partido o cada 90 minutos. "Top 10%" y "Top 25%" indican en qué parte del ranking está.</p>
      <p class="acerca__nota">Los datos se actualizan a mano después de cada fecha, así que puede haber algunos días de diferencia con la realidad.</p>
    </div>`;
  ficha.hidden = false;
});

// ---------- 10. Arranque ----------
// Si entraron con un link (ej. .../#/argentina/jugador/...), vamos directo ahí
aplicarRuta();
