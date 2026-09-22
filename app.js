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
let loading = false;

const buffers = Object.create(null);

const status = document.querySelector("#status");
const startButton = document.querySelector("#start");
const masterSlider = document.querySelector("#master");


/* ==========================================
   CREAR MOTOR DE AUDIO UNA SOLA VEZ
   ========================================== */

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
    : 1.0;

  master.connect(ctx.destination);
}


/* ==========================================
   DESBLOQUEO iPHONE / iPAD
   ========================================== */

function unlockAudio() {
  createEngine();

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  /*
    Buffer silencioso para desbloquear Web Audio
    en iOS/PWA.
  */
  const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
  const source = ctx.createBufferSource();

  source.buffer = silent;
  source.connect(ctx.destination);
  source.start(0);
}


/* ==========================================
   PRECARGAR TODOS LOS WAV EN RAM
   ========================================== */

async function preload() {
  if (ready || loading) return;

  loading = true;

  if (status) {
    status.textContent = "Cargando sonidos...";
  }

  try {
    createEngine();

    const entries = Object.entries(files);

    await Promise.all(
      entries.map(async ([name, url]) => {

        const response = await fetch(url, {
          cache: "force-cache"
        });

        if (!response.ok) {
          throw new Error(url);
        }

        const data = await response.arrayBuffer();

        buffers[name] =
          await ctx.decodeAudioData(data);
      })
    );

    ready = true;
    loading = false;

    if (status) {
      status.textContent =
        "AUDIO LISTO • 10/10 sonidos cargados";
    }

    if (startButton) {
      startButton.textContent = "AUDIO LISTO";
    }

  } catch (error) {

    console.error(error);

    loading = false;

    if (status) {
      status.textContent =
        "ERROR DE AUDIO";
    }
  }
}


/* ==========================================
   DISPARO DE AUDIO
   CAMINO ULTRA CORTO
   ========================================== */

function trigger(name) {
  if (!ready) return;

  const buffer = buffers[name];

  if (!buffer) return;

  /*
    Cada golpe obtiene SU PROPIA VOZ.
    Nunca reutilizamos ni detenemos otra.
  */
  const voice = ctx.createBufferSource();

  voice.buffer = buffer;

  /*
    Afinación y velocidad originales.
  */
  voice.playbackRate.value = 1.0;

  voice.connect(master);

  /*
    Reproducir AHORA.
    Sin temporizadores.
    Sin await.
    Sin planificación adicional.
  */
  voice.start();

  voice.onended = () => {
    try {
      voice.disconnect();
    } catch (_) {}
  };
}


/* ==========================================
   EFECTO VISUAL SEPARADO DEL AUDIO
   ========================================== */

function flash(element) {
  element.classList.add("hit");

  setTimeout(() => {
    element.classList.remove("hit");
  }, 45);
}


/* ==========================================
   MULTITOUCH
   ========================================== */

const pads =
  document.querySelectorAll("[data-sound]");

pads.forEach(pad => {

  pad.style.touchAction = "none";

  pad.addEventListener(
    "pointerdown",
    event => {

      event.preventDefault();

      /*
        IMPORTANTE:
        si el motor ya está listo,
        aquí solamente se dispara audio.
      */
      if (ready) {
        trigger(pad.dataset.sound);
        flash(pad);
        return;
      }

      /*
        Solo ocurre al iniciar la app.
      */
      unlockAudio();

      preload().then(() => {
        if (ready) {
          trigger(pad.dataset.sound);
          flash(pad);
        }
      });

    },
    {
      passive: false
    }
  );

});


/* ==========================================
   MASTER
   ========================================== */

if (masterSlider) {

  masterSlider.addEventListener(
    "input",
    event => {

      if (!master) return;

      master.gain.value =
        Number(event.target.value);

    },
    {
      passive: true
    }
  );
}


/* ==========================================
   BOTÓN DE AUDIO
   AUNQUE ESTÉ OCULTO VISUALMENTE
   ========================================== */

if (startButton) {

  startButton.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
      preload();
    }
  );

}


/* ==========================================
   PRIMER TOQUE EN LA APP
   ========================================== */

function firstTouch() {
  unlockAudio();
  preload();
}

document.addEventListener(
  "pointerdown",
  firstTouch,
  {
    once: true,
    capture: true,
    passive: true
  }
);


/* ==========================================
   VOLVER A LA APP DESPUÉS DE MINIMIZAR
   ========================================== */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState === "visible" &&
      ctx &&
      ctx.state === "suspended"
    ) {
      ctx.resume();
    }

  }
);


/* EVITAR MENÚ DE iOS AL MANTENER PULSADO */

document.addEventListener(
  "contextmenu",
  event => event.preventDefault()
);
