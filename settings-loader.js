(async function () {
  const SHEET_ID = "1wDHuoi8_cpGx0wYemSWE86Oxwiz9_QIUAVNxUAhAk8A";

  const map = {
    timeline: "timelineModeBtn",
    slot: "slotModeBtn",
    photos: "photosModeBtn",
    cards: "cardsModeBtn",
    field: "fieldModeBtn",
    flow: "flowModeBtn",
    sphere: "sphereModeBtn",
    geodesic: "geodesicModeBtn",
    corbusier: "corbusierModeBtn",
    eno: "enoModeBtn",
    font: "fontModeBtn",
    calibration: "calibrationModeBtn",
    about: "aboutModeBtn"
  };

  try {
    const rows = await fetch(
      `https://opensheet.elk.sh/${SHEET_ID}/SETTINGS`,
      { cache: "no-store" }
    ).then(r => r.json());

    const controls = document.querySelector(".topbar .controls");
    const socialLinks = document.querySelector(".social-links");

    if (!controls) return;

    const settings = rows
      .map(row => ({
        key: String(row.Key || "").trim().toLowerCase(),
        enabled: String(row.Value || "Y").trim().toUpperCase() === "Y",
        order: Number(row.Order || 999)
      }))
      .filter(row => row.key && map[row.key])
      .sort((a, b) => a.order - b.order);

    settings.forEach(item => {
      const btn = document.getElementById(map[item.key]);
      if (!btn) return;

      btn.style.display = item.enabled ? "" : "none";

      if (item.enabled) {
        controls.appendChild(btn);
      }
    });

    if (socialLinks) {
      controls.appendChild(socialLinks);
    }

    console.log("Dome mode settings loaded", settings);

  } catch (err) {
    console.log("Could not load Dome settings", err);
  }
})();