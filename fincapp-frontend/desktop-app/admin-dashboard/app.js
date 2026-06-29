const data = window.FINCAAPP_DASHBOARD_DATA;

const farmSelector = document.getElementById("farmSelector");
const farmTitle = document.getElementById("farmTitle");
const farmSubtitle = document.getElementById("farmSubtitle");
const syncLabel = document.getElementById("syncLabel");
const lastSync = document.getElementById("lastSync");
const emptyState = document.getElementById("emptyState");
const dashboardContent = document.getElementById("dashboardContent");

const totalAnimals = document.getElementById("totalAnimals");
const averageWeight = document.getElementById("averageWeight");
const healthAlerts = document.getElementById("healthAlerts");
const healthAlertText = document.getElementById("healthAlertText");
const pendingSync = document.getElementById("pendingSync");
const animalBars = document.getElementById("animalBars");
const weightTrend = document.getElementById("weightTrend");
const alertsList = document.getElementById("alertsList");
const activityList = document.getElementById("activityList");
const auraInsight = document.getElementById("auraInsight");

const labels = {
  cattle: "Cattle",
  swine: "Swine",
  poultry: "Poultry"
};

function init() {
  data.farms.forEach((farm) => {
    const option = document.createElement("option");
    option.value = farm.id;
    option.textContent = farm.name;
    farmSelector.appendChild(option);
  });

  farmSelector.addEventListener("change", () => {
    renderDashboard(getSelectedFarm());
  });

  renderDashboard(data.farms[0]);
}

function getSelectedFarm() {
  return data.farms.find((farm) => farm.id === farmSelector.value) || data.farms[0];
}

function renderDashboard(farm) {
  farmTitle.textContent = farm.name;
  farmSubtitle.textContent = `${farm.location} • ${farm.animals.length} synchronized animals`;
  lastSync.textContent = `Last sync: ${farm.lastSync}`;
  syncLabel.textContent = farm.pendingSync > 0 ? "Pending data" : "Synced";

  const hasData = farm.animals.length > 0 || farm.healthAlerts.length > 0 || farm.recentActivity.length > 0;
  emptyState.classList.toggle("hidden", hasData);
  dashboardContent.classList.toggle("hidden", !hasData);

  if (!hasData) {
    auraInsight.textContent = "AURA has no synchronized data for this farm yet. Register livestock records from the APK and synchronize them to activate the dashboard.";
    return;
  }

  const weightValues = farm.animals
    .map((animal) => animal.latestWeightKg)
    .filter((weight) => typeof weight === "number");

  const average = weightValues.length
    ? weightValues.reduce((sum, value) => sum + value, 0) / weightValues.length
    : 0;

  totalAnimals.textContent = farm.animals.length;
  averageWeight.textContent = `${average.toFixed(1)} kg`;
  healthAlerts.textContent = farm.healthAlerts.length;
  pendingSync.textContent = farm.pendingSync;

  const alertCard = document.querySelector(".alert-card");
  alertCard.classList.toggle("has-alert", farm.healthAlerts.length > 0);
  healthAlertText.textContent = farm.healthAlerts.length > 0
    ? "Requires administrator review"
    : "No active alerts";

  renderAnimalBars(farm);
  renderWeightTrend(farm);
  renderAlerts(farm);
  renderActivity(farm);
  renderAuraInsight(farm, average);
}

function renderAnimalBars(farm) {
  const counts = {
    cattle: farm.animals.filter((animal) => animal.type === "cattle").length,
    swine: farm.animals.filter((animal) => animal.type === "swine").length,
    poultry: farm.animals.filter((animal) => animal.type === "poultry").length
  };

  const max = Math.max(...Object.values(counts), 1);
  animalBars.innerHTML = Object.entries(counts).map(([type, count]) => {
    const width = Math.max((count / max) * 100, count > 0 ? 10 : 0);
    return `
      <div class="bar-row">
        <div class="bar-label">
          <span>${labels[type]}</span>
          <strong>${count}</strong>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderWeightTrend(farm) {
  if (!farm.weightTrend.length) {
    weightTrend.innerHTML = "<p>No weight trend available.</p>";
    return;
  }

  const max = Math.max(...farm.weightTrend.map((item) => item.value));
  weightTrend.innerHTML = farm.weightTrend.map((item) => {
    const height = Math.max((item.value / max) * 190, 20);
    return `
      <div class="trend-bar" title="${item.value} kg" style="height:${height}px">
        <span>${item.label}</span>
      </div>
    `;
  }).join("");
}

function renderAlerts(farm) {
  if (!farm.healthAlerts.length) {
    alertsList.innerHTML = "<p>No active health alerts.</p>";
    return;
  }

  alertsList.innerHTML = `
    <div class="table-row header">
      <span>Animal</span>
      <span>Tag</span>
      <span>Symptom</span>
      <span>Severity</span>
    </div>
    ${farm.healthAlerts.map((alert) => `
      <div class="table-row">
        <strong>${alert.animal}</strong>
        <span>${alert.tag}</span>
        <span>${alert.symptom}</span>
        <span class="badge ${alert.severity}">${alert.severity}</span>
      </div>
    `).join("")}
  `;
}

function renderActivity(farm) {
  if (!farm.recentActivity.length) {
    activityList.innerHTML = "<p>No recent activity.</p>";
    return;
  }

  activityList.innerHTML = `
    <div class="table-row header">
      <span>Time</span>
      <span>Type</span>
      <span>Description</span>
      <span>Status</span>
    </div>
    ${farm.recentActivity.map((activity) => `
      <div class="table-row">
        <strong>${activity.time}</strong>
        <span>${activity.type}</span>
        <span>${activity.description}</span>
        <span class="badge ${activity.status === "success" || activity.status === "synced" ? "low" : "medium"}">${activity.status}</span>
      </div>
    `).join("")}
  `;
}

function renderAuraInsight(farm, average) {
  const highAlerts = farm.healthAlerts.filter((alert) => alert.severity === "high").length;

  if (highAlerts > 0) {
    auraInsight.textContent = `AURA detected ${highAlerts} high-priority health alert(s) in ${farm.name}. Review animal welfare first, then continue with weight and inventory analysis.`;
    return;
  }

  if (farm.pendingSync > 0) {
    auraInsight.textContent = `AURA detected ${farm.pendingSync} pending local record(s). Synchronize the APK to keep the administrator dashboard updated.`;
    return;
  }

  auraInsight.textContent = `AURA reports that ${farm.name} has ${farm.animals.length} synchronized animals and an average recorded weight of ${average.toFixed(1)} kg.`;
}

init();
