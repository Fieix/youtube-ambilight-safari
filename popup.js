const api = globalThis.browser ?? globalThis.chrome;
const panel = document.getElementById("panel");
let values = { ...AMBIENT_DEFAULTS };

function save(name, value) {
  values = { ...values, [name]: value };
  api.storage.local.set({ ambientSettings: values });
  if (name === "advancedSettings") draw();
}

function draw() {
  renderAmbientSettings(panel, values, save);
}

const stored = api.storage.local.get("ambientSettings");
Promise.resolve(stored).then((data) => {
  values = { ...AMBIENT_DEFAULTS, ...(data && data.ambientSettings) };
  draw();
});
