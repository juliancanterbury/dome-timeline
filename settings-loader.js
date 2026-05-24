(async function () {
  const SHEET_ID = "1wDHuoi8_cpGx0wYemSWE86Oxwiz9_QIUAVNxUAhAk8A";
  const url = `https://opensheet.elk.sh/${SHEET_ID}/SETTINGS`;

  const modeLabels = {
    timeline: "Timeline",
    slot: "Explore / Slot",
    photos: "Photos",
    cards: "Cards",
    field: "Field",
    flow: "Flow",
    sphere: "Sphere",
    geodesic: "Geodesic",
    corbusier: "Corbusier",
    eno: "Eno",
    font: "Font",
    calibration: "Calibration",
    about: "About",
    videos: "Videos",
    shop: "Shop"
  };

  function findButton(key) {
    return (
      document.getElementById(key + "ModeBtn") ||
      document.querySelector(`[data-mode="${key}"]`) ||
      [...document.querySelectorAll(".controls button")]
        .find(b => b.textContent.trim().toLowerCase() === modeLabels[key].toLowerCase())
    );
  }

  try {
    const res = await fetch(url, { cache: "no-store" });
    const rows = await res.json();

    const settings = {};
    rows.forEach(row => {
      const key = String(row.Key || "").trim().toLowerCase();
      if (!key) return;
      settings[key] = {
        enabled: String(row.Value || "").trim().toUpperCase() === "Y",
        order: Number(row.Order || 999)
      };
    });

    Object.keys(modeLabels).forEach(key => {
      const btn = findButton(key);
      if (!btn) return;

      const setting = settings[key];

      if (!setting || setting.enabled !== true) {
        btn.style.display = "none";
      } else {
        btn.style.display = "";
      }

      if (setting) {
        btn.style.order = setting.order;
      }
    });

  } catch (err) {
    console.log("Settings loader failed", err);
  }
})();