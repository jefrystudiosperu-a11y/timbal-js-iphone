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
const buffers = {};

const status = document.querySelector("#status");

async function initAudio() {
  if (!ctx) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    ctx = new AudioContextClass({
      latencyHint: "interactive"
    });

    master = ctx.createGain();
    master.gain.value =
      Number(document.querySelector("#master")?.value || 1);

    master.connect(ctx.destination);

    if (status) status.textContent = "Cargando sonidos...";

    for (const [name, url] of Object.entries(files)) {
      try {
        const response = await fetch(
          encodeURI(url),
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            `${response.status} ${response.statusText}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();

        buffers[name] =
          await ctx.decodeAudioData(arrayBuffer);

      } catch (error) {
        console.error("ERROR:", name, url, error);

        if (status) {
          status.textContent =
            "ERROR cargando: " + url;
        }
      }
    }

    if (
      Object.keys(buffers).length ===
      Object.keys(files).length
    ) {
      if (status) {
        status.textContent =
          "AUDIO LISTO • 10/10 sonidos cargados";
      }
    }
  }

  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

async function playSound(name, element) {
  try {
    await initAudio();

    if (!buffers[name]) {
      if (status) {
        status.textContent =
          "NO CARGÓ: " + (files[name] || name);
      }
      return;
    }

    const source = ctx.createBufferSource();

    source.buffer = buffers[name];
    source.connect(master);
    source.start(0);

    element.classList.add("hit");

    setTimeout(() => {
      element.classList.remove("hit");
    }, 90);

  } catch (error) {
    console.error(error);

    if (status) {
      status.textContent =
        "ERROR DE AUDIO: " + error.message;
    }
  }
}

const masterSlider =
  document.querySelector("#master");

if (masterSlider) {
  masterSlider.addEventListener("input", e => {
    if (master) {
      master.gain.value =
        Number(e.target.value);
    }
  });
}

document
  .querySelectorAll("[data-sound]")
  .forEach(element => {

    element.addEventListener(
      "pointerdown",
      async e => {
        e.preventDefault();

        try {
          element.setPointerCapture?.(
            e.pointerId
          );
        } catch (_) {}

        await playSound(
          element.dataset.sound,
          element
        );
      }
    );

  });

document.addEventListener(
  "contextmenu",
  e => e.preventDefault()
);

if (status) {
  status.textContent =
    "TOCA UN PAD PARA ACTIVAR EL AUDIO";
}
