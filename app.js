const files = {
  cascaraA: "audio/CASCARA AGUDO.wav",
  cascaraG: "audio/CASCARA GRAVE.wav",
  cowbell: "audio/CENCERRO 4.wav",
  chacha: "audio/CHACHA BOCA.wav",
  jam: "audio/JAM BLOCK.wav",
  rimshot: "audio/PARCHE AGUDO RIMSHOT.wav",
  center: "audio/PARCHE CENTRO.wav",
  grave: "audio/PARCHE GRAVE.wav",
  cup: "audio/PLATILLO COPA.wav",
  cymbal: "audio/PLATILLO ZILDJIAN CERRADO Y ABIERTO.wav"
};

let ctx = null;
let master = null;
let ready = false;
let loadingPromise = null;

const buffers = Object.create(null);

const status = document.querySelector("#status");
const startButton = document.querySelector("#start");
const masterSlider = document.querySelector("#master");
const pads = [...document.querySelectorAll("[data-sound]")];


/* =====================================================
   MOTOR DE AUDIO
   ===================================================== */

function createEngine() {
  if (ctx) return;

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  ctx = new AudioContextClass({
    latencyHint: "interactive"
  });

  master = ctx.createGain();

  master.gain.value = masterSlider
    ? Number(masterSlider.value)
    : 0.9;

  master.connect(ctx.destination);
}


/* =====================================================
   DESBLOQUEO DE AUDIO iOS
   ===================================================== */

function unlockAudio() {
  createEngine();

  if (ctx.state !== "running") {
    ctx.resume().catch(() => {});
  }
}


/* =====================================================
   CARGAR TODO UNA SOLA VEZ EN RAM
   ===================================================== */

async function preload() {
  if (ready) return;
  if (loadingPromise) return loadingPromise;

  createEngine();

  if (status) {
    status.textContent = "Cargando sonidos...";
  }

  loadingPromise = Promise.all(
    Object.entries(files).map(async ([name, url]) => {

      const response = await fetch(url, {
        cache: "force-cache"
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar: " + url);
      }

      const data = await response.arrayBuffer();

      buffers[name] =
        await ctx.decodeAudioData(data);
    })
  );

  try {
    await loadingPromise;

    ready = true;

    if (status) {
      status.textContent =
        "AUDIO LISTO • 10/10 sonidos cargados";
    }

    if (startButton) {
      startButton.textContent = "AUDIO LISTO";
    }

  } catch (error) {

    console.error(error);

    loadingPromise = null;

    if (status) {
      status.textContent = "ERROR DE AUDIO";
    }
  }
}


/* =====================================================
   DISPARO
   UNA VOZ NUEVA POR CADA GOLPE
   ===================================================== */

function trigger(name) {
  if (!ready) return;

  const buffer = buffers[name];

  if (!buffer) return;

  const voice = ctx.createBufferSource();

  voice.buffer = buffer;
  voice.playbackRate.value = 1;

  voice.connect(master);

  /*
    Sin setTimeout.
    Sin await.
    Sin detener voces anteriores.
  */
  voice.start(0);

  voice.onended = () => {
    voice.disconnect();
  };
}


/* =====================================================
   ILUMINACIÓN
   ===================================================== */

function flashPad(pad) {
  /*
    requestAnimationFrame evita meter trabajo
    visual antes de disparar el sonido.
  */

  requestAnimationFrame(() => {
    pad.classList.add("hit");

    setTimeout(() => {
      pad.classList.remove("hit");
    }, 40);
  });
}


/* =====================================================
   BUSCAR QUÉ PAD HAY DEBAJO DE CADA DEDO
   ===================================================== */

function getPadFromTouch(touch) {

  const element = document.elementFromPoint(
    touch.clientX,
    touch.clientY
  );

  if (!element) return null;

  return element.closest("[data-sound]");
}


/* =====================================================
   MULTITOUCH NATIVO iPHONE / iPAD

   IMPORTANTE:
   changedTouches contiene TODOS los dedos nuevos
   que llegaron en este touchstart.
   ===================================================== */

document.addEventListener(
  "touchstart",
  event => {

    event.preventDefault();

    /*
      Si ya está listo NO hacemos resume(),
      fetch(), await ni ninguna otra operación.
    */

    if (ready) {

      const touches = event.changedTouches;

      /*
        PRIMERO DISPARAMOS TODO EL AUDIO.
      */

      for (let i = 0; i < touches.length; i++) {

        const pad = getPadFromTouch(touches[i]);

        if (!pad) continue;

        trigger(pad.dataset.sound);
      }

      /*
        DESPUÉS hacemos los gráficos.
      */

      for (let i = 0; i < touches.length; i++) {

        const pad = getPadFromTouch(touches[i]);

        if (pad) {
          flashPad(pad);
        }
      }

      return;
    }


    /*
      Solamente durante el arranque.
    */

    unlockAudio();

    preload();

  },
  {
    capture: true,
    passive: false
  }
);


/* =====================================================
   EVITAR GESTOS DEL NAVEGADOR SOBRE LOS PADS
   ===================================================== */

pads.forEach(pad => {

  pad.style.touchAction = "none";

  pad.addEventListener(
    "touchmove",
    event => {
      event.preventDefault();
    },
    {
      passive: false
    }
  );

});


/* =====================================================
   FALLBACK PARA MOUSE / COMPUTADORA

   En dispositivos táctiles NO utilizamos pointerdown
   para evitar disparar dos veces el mismo golpe.
   ===================================================== */

if (!("ontouchstart" in window)) {

  pads.forEach(pad => {

    pad.addEventListener(
      "pointerdown",
      event => {

        event.preventDefault();

        if (!ready) {
          unlockAudio();

          preload().then(() => {
            trigger(pad.dataset.sound);
          });

          return;
        }

        trigger(pad.dataset.sound);
        flashPad(pad);
      },
      {
        passive: false
      }
    );

  });

}


/* =====================================================
   BOTÓN AUDIO
   ===================================================== */

if (startButton) {

  startButton.addEventListener(
    "touchstart",
    event => {

      event.preventDefault();

      unlockAudio();
      preload();

    },
    {
      passive: false
    }
  );

}


/* =====================================================
   MASTER
   ===================================================== */

if (masterSlider) {

  masterSlider.addEventListener(
    "input",
    event => {

      if (!master) return;

      master.gain.setValueAtTime(
        Number(event.target.value),
        ctx.currentTime
      );

    },
    {
      passive: true
    }
  );

}


/* =====================================================
   REGRESAR A LA APP
   ===================================================== */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState === "visible" &&
      ctx &&
      ctx.state !== "running"
    ) {
      ctx.resume().catch(() => {});
    }

  }
);


/* =====================================================
   EVITAR MENÚ AL MANTENER PULSADO
   ===================================================== */

document.addEventListener(
  "contextmenu",
  event => {
    event.preventDefault();
  }
);
