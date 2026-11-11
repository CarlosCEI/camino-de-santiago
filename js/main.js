import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const reducirMovimiento = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* Transición de entrada y navegación entre páginas */
document.documentElement.classList.add("transicion-entrada");

window.setTimeout(() => {
  document.documentElement.classList.remove("transicion-entrada");
}, reducirMovimiento ? 0 : 700);

document.addEventListener("click", (evento) => {
  const enlace = evento.target.closest("a[href]");

  if (
    !enlace ||
    evento.defaultPrevented ||
    evento.button !== 0 ||
    evento.metaKey ||
    evento.ctrlKey ||
    evento.shiftKey ||
    evento.altKey ||
    enlace.target === "_blank" ||
    enlace.hasAttribute("download")
  ) {
    return;
  }

  const destino = new URL(enlace.href, window.location.href);

  if (
    destino.origin !== window.location.origin ||
    destino.pathname === window.location.pathname &&
      destino.hash
  ) {
    return;
  }

  evento.preventDefault();

  if (reducirMovimiento) {
    window.location.href = destino.href;
    return;
  }

  document.documentElement.classList.add("transicion-salida");

  window.setTimeout(() => {
    window.location.href = destino.href;
  }, 260);
});

/* Mapa topográfico 3D esquemático */
function alturaTerreno(x, z) {
  const colinas =
    Math.sin(x * 0.48) * 0.45 +
    Math.cos(z * 0.62) * 0.34 +
    Math.sin((x + z) * 0.31) * 0.3;

  const montana =
    Math.exp(-((x + 3) ** 2 + (z + 1) ** 2) / 22) * 1.35;

  return colinas + montana;
}

function crearTerreno() {
  const ancho = 20;
  const fondo = 12;
  const segmentosX = 110;
  const segmentosZ = 70;
  const posiciones = [];
  const colores = [];
  const indices = [];

  const colorBajo = new THREE.Color("#123d3a");
  const colorMedio = new THREE.Color("#147a68");
  const colorAlto = new THREE.Color("#b9d75a");

  for (let fila = 0; fila <= segmentosZ; fila += 1) {
    const z = (fila / segmentosZ - 0.5) * fondo;

    for (let columna = 0; columna <= segmentosX; columna += 1) {
      const x = (columna / segmentosX - 0.5) * ancho;
      const y = alturaTerreno(x, z);

      posiciones.push(x, y, z);

      const nivel = THREE.MathUtils.clamp((y + 1.1) / 3.2, 0, 1);
      const color = nivel < 0.56
        ? colorBajo.clone().lerp(colorMedio, nivel / 0.56)
        : colorMedio.clone().lerp(colorAlto, (nivel - 0.56) / 0.44);

      colores.push(color.r, color.g, color.b);
    }
  }

  for (let fila = 0; fila < segmentosZ; fila += 1) {
    for (let columna = 0; columna < segmentosX; columna += 1) {
      const actual = fila * (segmentosX + 1) + columna;
      const siguiente = actual + segmentosX + 1;

      indices.push(actual, siguiente, actual + 1);
      indices.push(siguiente, siguiente + 1, actual + 1);
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posiciones, 3)
  );
  geometria.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colores, 3)
  );
  geometria.setIndex(indices);
  geometria.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.04,
    side: THREE.DoubleSide
  });

  return new THREE.Mesh(geometria, material);
}

function crearRuta(scene, puntos, color, grosor = 0.055) {
  const puntosCurva = puntos.map(([x, z]) => (
    new THREE.Vector3(x, alturaTerreno(x, z) + 0.09, z)
  ));
  const curva = new THREE.CatmullRomCurve3(puntosCurva);
  const geometria = new THREE.TubeGeometry(curva, 180, grosor, 8, false);
  const material = new THREE.MeshBasicMaterial({
    color,
    toneMapped: false
  });

  scene.add(new THREE.Mesh(geometria, material));

  puntosCurva.forEach((punto, indice) => {
    if (indice !== 0 && indice !== puntosCurva.length - 1) {
      return;
    }

    const marcador = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );

    marcador.position.copy(punto);
    scene.add(marcador);
  });
}

function iniciarMapa(contenedor) {
  const canvas = contenedor.querySelector(".mapa-3d__canvas");

  if (!canvas) {
    return;
  }

  let renderer;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
  } catch (error) {
    contenedor.classList.add("mapa-3d--sin-webgl");
    return;
  }

  const escena = new THREE.Scene();
  escena.background = new THREE.Color("#071116");
  escena.fog = new THREE.Fog("#071116", 19, 36);

  const camara = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camara.position.set(0, 8.5, 15.5);

  escena.add(crearTerreno());
  escena.add(new THREE.HemisphereLight("#b7f5ee", "#071116", 2.1));

  const luzPrincipal = new THREE.DirectionalLight("#d5ff00", 2.2);
  luzPrincipal.position.set(-5, 10, 7);
  escena.add(luzPrincipal);

  const luzSecundaria = new THREE.PointLight("#19e7e8", 18, 28);
  luzSecundaria.position.set(6, 5, -4);
  escena.add(luzSecundaria);

  const rutas = contenedor.dataset.caminoMap === "rutas";

  if (rutas) {
    crearRuta(
      escena,
      [[-9, -3], [-6, -1.8], [-3.5, -1.5], [-1.4, -0.7], [1.2, 0.1], [4, 0.5], [7.2, 0]],
      "#d5ff00",
      0.065
    );
    crearRuta(
      escena,
      [[-7.5, 5], [-5.4, 3.8], [-3.2, 2.2], [-1.2, 1.4], [1.2, 0.7], [4, 0.5], [7.2, 0]],
      "#19e7e8",
      0.045
    );
    crearRuta(
      escena,
      [[-4.4, -5], [-3.2, -3.5], [-2.2, -2.2], [-1.4, -0.7], [1.2, 0.1], [4, 0.5], [7.2, 0]],
      "#a987ff",
      0.045
    );
    crearRuta(
      escena,
      [[-9, 2.8], [-6.7, 2.2], [-4.8, 1.7], [-2.4, 1.2], [0, 0.9], [3.2, 0.5], [7.2, 0]],
      "#45d7a2",
      0.045
    );
  } else {
    crearRuta(
      escena,
      [[-9, 1.2], [-6.8, 0.7], [-4.9, 1.7], [-2.6, 0.8], [-0.4, 1.2], [2.2, 0.3], [4.2, 0.7], [7.2, 0]],
      "#d5ff00",
      0.075
    );
  }

  const controles = new OrbitControls(camara, canvas);
  controles.enableDamping = true;
  controles.dampingFactor = 0.055;
  controles.enablePan = false;
  controles.minDistance = 9;
  controles.maxDistance = 24;
  controles.minPolarAngle = 0.35;
  controles.maxPolarAngle = 1.38;
  controles.target.set(0, 0, 0);

  const ajustarTamanio = () => {
    const ancho = contenedor.clientWidth;
    const alto = contenedor.clientHeight;

    if (!ancho || !alto) {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
  };

  const observador = new ResizeObserver(ajustarTamanio);
  observador.observe(contenedor);
  ajustarTamanio();

  const animar = () => {
    controles.update();
    renderer.render(escena, camara);
    window.requestAnimationFrame(animar);
  };

  animar();
}

document.querySelectorAll("[data-camino-map]").forEach(iniciarMapa);

/* Filtros de rutas */
const filtrosRuta = document.querySelectorAll("[data-filtro-ruta]");
const tarjetasRuta = document.querySelectorAll("[data-categorias]");

filtrosRuta.forEach((boton) => {
  boton.addEventListener("click", () => {
    const filtro = boton.dataset.filtroRuta;

    filtrosRuta.forEach((otroBoton) => {
      const seleccionado = otroBoton === boton;
      otroBoton.classList.toggle("filtros-ruta__activo", seleccionado);
      otroBoton.setAttribute("aria-pressed", String(seleccionado));
    });

    tarjetasRuta.forEach((tarjeta) => {
      const categorias = tarjeta.dataset.categorias.split(" ");
      tarjeta.hidden = filtro !== "todas" && !categorias.includes(filtro);
    });
  });
});

/* Selección de ruta en la página de etapas */
const botonesEtapas = document.querySelectorAll("[data-seleccionar-ruta]");

if (botonesEtapas.length) {
  const nombreRuta = document.querySelector("[data-ruta-titulo]");
  const resumenRuta = document.querySelector("[data-ruta-resumen]");
  const listaEtapas = document.querySelector(".lista-etapas");
  const etapaDestacada = document.querySelector("[data-etapa-destacada]");
  const nombrePorRuta = {
    frances: "Camino Francés",
    portugues: "Camino Portugués",
    primitivo: "Camino Primitivo",
    norte: "Camino del Norte"
  };

  botonesEtapas.forEach((boton) => {
    boton.addEventListener("click", () => {
      const ruta = boton.dataset.seleccionarRuta;
      const esFrances = ruta === "frances";

      botonesEtapas.forEach((otroBoton) => {
        const seleccionado = otroBoton === boton;
        otroBoton.classList.toggle(
          "selector-ruta__opcion--activa",
          seleccionado
        );
        otroBoton.setAttribute("aria-pressed", String(seleccionado));
      });

      nombreRuta.textContent = nombrePorRuta[ruta];
      resumenRuta.textContent = esFrances
        ? "Ejemplo de organización desde O Cebreiro hasta Santiago."
        : "Esta página muestra el recorrido detallado de ejemplo del Camino Francés. Consulta las rutas para más información.";

      listaEtapas.hidden = !esFrances;
      etapaDestacada.hidden = !esFrances;
    });
  });
}

/* Carruseles de productos */
document.querySelectorAll("[data-carrusel-mover]").forEach((boton) => {
  boton.addEventListener("click", () => {
    const lista = document.getElementById(boton.getAttribute("aria-controls"));

    if (!lista) {
      return;
    }

    const tarjeta = lista.querySelector(".producto-card");
    const anchoTarjeta = tarjeta
      ? tarjeta.getBoundingClientRect().width
      : lista.clientWidth * 0.8;
    const direccion = boton.dataset.carruselMover === "siguiente" ? 1 : -1;

    lista.scrollBy({
      left: direccion * (anchoTarjeta + 20),
      behavior: reducirMovimiento ? "instant" : "smooth"
    });
  });
});

/* Modelos de producto CSS 3D */
const partesModelo = {
  mochila: [
    "cuerpo",
    "tapa",
    "bolsillo",
    "bolsillo-lateral",
    "correa-izquierda",
    "correa-derecha"
  ],
  botella: [
    "cuerpo",
    "cuello",
    "tapon",
    "asa"
  ],
  calzado: [
    "suela",
    "parte-superior",
    "puntera",
    "lengueta",
    "cordones"
  ]
};

document.querySelectorAll("[data-producto-3d]").forEach((visual) => {
  const tipo = visual.dataset.producto3d;
  const modelo = document.createElement("div");
  modelo.className = `modelo-3d modelo-3d--${tipo}`;
  modelo.tabIndex = 0;
  modelo.setAttribute("role", "group");
  modelo.setAttribute(
    "aria-label",
    `${tipo}. Arrastra para girar el modelo o usa las flechas del teclado.`
  );

  const escena = document.createElement("div");
  escena.className = "modelo-3d__escena";

  const giro = document.createElement("div");
  giro.className = "modelo-3d__giro";

  const forma = document.createElement("div");
  forma.className = "modelo-3d__forma";

  (partesModelo[tipo] || partesModelo.mochila).forEach((parte) => {
    const pieza = document.createElement("span");
    pieza.className = `modelo-3d__pieza modelo-3d__pieza--${parte}`;
    pieza.setAttribute("aria-hidden", "true");
    forma.appendChild(pieza);
  });

  giro.appendChild(forma);
  escena.appendChild(giro);
  modelo.appendChild(escena);

  const ayuda = document.createElement("span");
  ayuda.className = "modelo-3d__ayuda";
  ayuda.textContent = "Arrastra para girar · 360°";
  modelo.appendChild(ayuda);

  visual.replaceChildren(modelo);
  visual.setAttribute("role", "group");

  let giroX = -8;
  let giroY = 0;
  let arrastrando = false;
  let inicioX = 0;
  let inicioY = 0;
  let giroInicialX = giroX;
  let giroInicialY = giroY;

  const actualizarGiro = () => {
    escena.style.setProperty("--giro-x", `${giroX}deg`);
    escena.style.setProperty("--giro-y", `${giroY}deg`);
  };

  modelo.addEventListener("pointerdown", (evento) => {
    arrastrando = true;
    inicioX = evento.clientX;
    inicioY = evento.clientY;
    giroInicialX = giroX;
    giroInicialY = giroY;
    modelo.classList.add("modelo-3d--arrastrando");
    modelo.setPointerCapture(evento.pointerId);
  });

  modelo.addEventListener("pointermove", (evento) => {
    if (!arrastrando) {
      return;
    }

    giroY = giroInicialY + (evento.clientX - inicioX) * 0.8;
    giroX = Math.max(
      -35,
      Math.min(35, giroInicialX - (evento.clientY - inicioY) * 0.45)
    );
    actualizarGiro();
  });

  const terminarArrastre = () => {
    arrastrando = false;
    modelo.classList.remove("modelo-3d--arrastrando");
  };

  modelo.addEventListener("pointerup", terminarArrastre);
  modelo.addEventListener("pointercancel", terminarArrastre);
  modelo.addEventListener("lostpointercapture", terminarArrastre);

  modelo.addEventListener("keydown", (evento) => {
    const paso = evento.shiftKey ? 30 : 12;

    if (evento.key === "ArrowLeft") {
      giroY -= paso;
    } else if (evento.key === "ArrowRight") {
      giroY += paso;
    } else if (evento.key === "ArrowUp") {
      giroX = Math.max(-35, giroX - paso);
    } else if (evento.key === "ArrowDown") {
      giroX = Math.min(35, giroX + paso);
    } else {
      return;
    }

    evento.preventDefault();
    actualizarGiro();
  });

  actualizarGiro();
});

/* Generador de propuesta orientativa */
const formularioPlan = document.querySelector("#formulario-plan");

if (formularioPlan) {
  formularioPlan.addEventListener("submit", (evento) => {
    evento.preventDefault();

    if (!formularioPlan.reportValidity()) {
      return;
    }

    const datos = new FormData(formularioPlan);
    const ruta = datos.get("ruta");
    const duracion = datos.get("duracion");
    const epoca = datos.get("mes");
    const nombreRuta = {
      frances: "Camino Francés",
      portugues: "Camino Portugués",
      primitivo: "Camino Primitivo",
      norte: "Camino del Norte"
    }[ruta];

    const numeroJornadas = duracion === "otro"
      ? 21
      : Number(duracion);

    const titulo = document.querySelector("[data-titulo-plan]");
    const estado = document.querySelector("[data-estado-plan]");
    const tramos = document.querySelector("[data-tramos-plan]");
    const mensaje = document.querySelector("[data-mensaje-plan]");
    const nombreEpoca = {
      primavera: "primavera",
      verano: "verano",
      otono: "otoño",
      invierno: "invierno"
    }[epoca];

    titulo.textContent = `Propuesta · ${nombreRuta}`;
    estado.textContent = `${numeroJornadas} jornadas`;
    tramos.replaceChildren();

    const jornadasVisibles = Math.min(numeroJornadas, 7);

    for (let indice = 1; indice <= jornadasVisibles; indice += 1) {
      const tarjeta = document.createElement("article");
      tarjeta.className = "tramo-plan";

      const numero = document.createElement("span");
      numero.className = "tramo-plan__dia";
      numero.textContent = `JORNADA ${String(indice).padStart(2, "0")}`;

      const tituloTramo = document.createElement("h4");
      tituloTramo.textContent = indice === 1
        ? "Prepara el inicio del recorrido"
        : indice === jornadasVisibles
          ? "Organiza la llegada a Santiago"
          : "Planifica el siguiente tramo";

      const descripcion = document.createElement("p");
      descripcion.textContent =
        "Ajusta la distancia y el descanso a tu ritmo. Comprueba los servicios disponibles antes de salir.";

      tarjeta.append(numero, tituloTramo, descripcion);
      tramos.appendChild(tarjeta);
    }

    mensaje.textContent =
      `Propuesta orientativa para el ${nombreRuta} en ${nombreEpoca}. ` +
      "No representa etapas oficiales ni distancias verificadas; consulta información actualizada antes del viaje.";

    document.querySelector("#resultado-plan").scrollIntoView({
      behavior: reducirMovimiento ? "instant" : "smooth",
      block: "start"
    });
  });
}