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
let loadingPromise = null;
const buffers = Object.create(null);

const status = document.querySelector("#status");
const startButton = document.querySelector("#start");
const masterSlider = document.querySelector("#master");

function createAudioEngine() {
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

  /* Desbloqueo inmediato para iPhone/iPad */
  const silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  const silentSource = ctx.createBufferSource();

  silentSource.buffer = silentBuffer;
  silentSource.connect(master);
  silentSource.start(0);
}

function unlockAudio() {
  createAudioEngine();

  if (ctx.state !== "running") {
    ctx.resume().catch(() => {});
  }
}

async function loadSamples() {
  createAudioEngine();

  if (loadingPromise) return loadingPromise;

  if (status) {
    status.textContent = "Cargando sonidos...";
  }

  loadingPromise = Promise.all(
    Object.entries(files).map(async ([name, url]) => {
      const response = await fetch(url, {
        cache: "force-cache"
      });

      if (!response.ok) {
        throw new Error("No se pudo cargar " + url);
      }

      const arrayBuffer = await response.arrayBuffer();

      buffers[name] =
        await ctx.decodeAudioData(arrayBuffer.slice(0));
    })
  )
    .then(() => {
      if (status) {
        status.textContent =
          "AUDIO LISTO • 10/10 sonidos cargados";
      }

      if (startButton) {
        startButton.textContent = "AUDIO LISTO";
      }
    })
    .catch(error => {
      console.error(error);

      if (status) {
        status.textContent =
          "ERROR DE AUDIO: " + error.message;
      }

      loadingPromise = null;
    });

  return loadingPromise;
}

/*
  Cada golpe crea un BufferSource NUEVO.
  Así un golpe nunca corta al anterior.
*/
function playSound(name, element) {
  if (!ctx || !buffers[name]) return;

  if (ctx.state !== "running") {
    ctx.resume().catch(() => {});
  }

  const source = ctx.createBufferSource();

  source.buffer = buffers[name];

  /* Reproducción original: sin alterar pitch ni velocidad */
  source.playbackRate.value = 1.0;

  source.connect(master);

  /*
    Pequeño margen de planificación.
    Evita golpes perdidos cuando se toca muy rápido.
  */
  const when = Math.max(
    ctx.currentTime,
    ctx.currentTime + 0.001
  );

  source.start(when);

  if (element) {
    element.classList.add("hit");

    setTimeout(() => {
      element.classList.remove("hit");
    }, 65);
  }

  source.onended = () => {
    try {
      source.disconnect();
    } catch (_) {}
  };
}

async function prepareAudio() {
  unlockAudio();

  if (!loadingPromise) {
    await loadSamples();
  }

  if (ctx && ctx.state !== "running") {
    try {
      await ctx.resume();
    } catch (_) {}
  }
}

/* Botón de activación, aunque visualmente esté oculto */
if (startButton) {
  startButton.addEventListener(
    "pointerdown",
    () => {
      unlockAudio();
      loadSamples();
    },
    { passive: true }
  );

  startButton.addEventListener("click", () => {
    unlockAudio();
    loadSamples();
  });
}

/* MASTER */
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
    { passive: true }
  );
}

/*
  PADS:
  pointerdown dispara el sonido inmediatamente.
  No esperamos pointerup ni click.
*/
document
  .querySelectorAll("[data-sound]")
  .forEach(element => {
    element.style.touchAction = "none";

    element.addEventListener(
      "pointerdown",
      event => {
        event.preventDefault();

        unlockAudio();

        const name = element.dataset.sound;

        /*
          Si ya está precargado:
          tocar inmediatamente.
        */
        if (buffers[name]) {
          playSound(name, element);
          return;
        }

        /*
          Solo ocurrirá durante la primera carga.
        */
        loadSamples().then(() => {
          if (buffers[name]) {
            playSound(name, element);
          }
        });
      },
      { passive: false }
    );
  });

/*
  Precarga apenas la app recibe el primer gesto.
*/
const firstGesture = () => {
  unlockAudio();
  loadSamples();

  document.removeEventListener(
    "touchstart",
    firstGesture
  );

  document.removeEventListener(
    "pointerdown",
    firstGesture
  );
};

document.addEventListener(
  "touchstart",
  firstGesture,
  {
    passive: true,
    once: true
  }
);

document.addEventListener(
  "pointerdown",
  firstGesture,
  {
    passive: true,
    once: true
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState === "visible" &&
      ctx &&
      ctx.state === "suspended"
    ) {
      ctx.resume().catch(() => {});
    }
  }
);

document.addEventListener(
  "contextmenu",
  event => event.preventDefault()
);
