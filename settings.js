globalThis.AMBIENT_FIELDS = [
  { name: "advancedSettings", label: "Advanced", type: "checkbox", default: false },
  { name: "enabled", label: "Enabled", type: "checkbox", default: true },
  { section: "Ambient light" },
  { name: "blur2", label: "Blur", type: "range", min: 0, max: 100, step: 0.1, default: 30 },
  { name: "edge", label: "Edge size", type: "range", min: 2, max: 50, step: 0.1, default: 12, advanced: true },
  { name: "spread", label: "Spread", type: "range", min: 0, max: 400, step: 0.1, default: 17 },
  { section: "Page" },
  { name: "surroundingContentFillOpacity", label: "Buttons & boxes background opacity", type: "range", min: -100, max: 100, step: 0.1, default: 10 },
  { name: "spreadFadeStart", label: "Spread fade start", type: "range", min: -50, max: 100, step: 0.1, default: 15, advanced: true },
  { name: "spreadFadeCurve", label: "Spread fade curve", type: "range", min: 1, max: 100, step: 1, default: 35, advanced: true },
  { section: "Filters" },
  { name: "brightness", label: "Brightness", type: "range", min: 0, max: 200, step: 1, default: 100 },
  { name: "contrast", label: "Contrast", type: "range", min: 0, max: 200, step: 1, default: 100, advanced: true },
  { name: "vibrance", label: "Colors", type: "range", min: 0, max: 200, step: 0.1, default: 100 },
  { name: "saturation", label: "Saturation", type: "range", min: 0, max: 200, step: 1, default: 100 },
  { section: "Directions", advanced: true },
  { name: "directionTopEnabled", label: "Top", type: "checkbox", default: true, advanced: true },
  { name: "directionRightEnabled", label: "Right", type: "checkbox", default: true, advanced: true },
  { name: "directionBottomEnabled", label: "Bottom", type: "checkbox", default: true, advanced: true },
  { name: "directionLeftEnabled", label: "Left", type: "checkbox", default: true, advanced: true },
  { section: "Quality" },
  { name: "resolution", label: "Resolution", type: "range", min: 6.25, max: 400, step: 6.25, default: 100 },
  { name: "framerateLimit", label: "Limit framerate (per second)", type: "range", min: 1, max: 60, step: 1, default: 60 },
  { section: "View modes" },
  {
    name: "enableInViews",
    label: "Enable in layouts",
    type: "select",
    default: 0,
    options: [
      { value: 0, label: "All" },
      { value: 1, label: "Small" },
      { value: 2, label: "Small & Theater" },
      { value: 3, label: "Theater" },
      { value: 4, label: "Theater & Fullscreen" },
      { value: 5, label: "Fullscreen" },
    ],
  },
  { name: "fixedPosition", label: "Fixed position", type: "checkbox", default: false, advanced: true },
];

globalThis.AMBIENT_DEFAULTS = Object.fromEntries(
  AMBIENT_FIELDS.filter((field) => field.name).map((field) => [field.name, field.default])
);

globalThis.renderAmbientSettings = (root, values, onChange) => {
  const advanced = !!values.advancedSettings;
  root.replaceChildren();
  const form = document.createElement("form");
  form.addEventListener("submit", (event) => event.preventDefault());
  for (const field of AMBIENT_FIELDS) {
    if (field.advanced && !advanced) continue;
    if (field.section) {
      const title = document.createElement("h2");
      title.textContent = field.section;
      form.append(title);
      continue;
    }
    const row = document.createElement("label");
    row.className = "row";
    const name = document.createElement("span");
    name.textContent = field.label;
    row.append(name);
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      for (const option of field.options) {
        const node = document.createElement("option");
        node.value = String(option.value);
        node.textContent = option.label;
        input.append(node);
      }
      input.value = String(values[field.name]);
    } else if (field.type === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!values[field.name];
    } else {
      input = document.createElement("input");
      input.type = "range";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(values[field.name]);
      const readout = document.createElement("b");
      readout.textContent = String(values[field.name]);
      input.addEventListener("input", () => {
        readout.textContent = input.value;
      });
      row.append(readout);
    }
    input.addEventListener("input", () => {
      const next = field.type === "checkbox" ? input.checked : Number(input.value);
      onChange(field.name, next);
    });
    row.append(input);
    form.append(row);
  }
  root.append(form);
};
