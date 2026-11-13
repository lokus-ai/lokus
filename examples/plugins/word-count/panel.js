async function refresh() {
  try {
    const { count, unit } = await countActiveNote();
    document.getElementById("count").textContent = count;
    document.getElementById("unit").textContent = unit;
  } catch {
    document.getElementById("count").textContent = "–";
    document.getElementById("unit").textContent = "Open a note";
  }
}

lokus.on("active-note", refresh);
lokus.on("vault-changed", refresh);
lokus.on("settings-changed", refresh);
setInterval(refresh, 2000);
refresh();
