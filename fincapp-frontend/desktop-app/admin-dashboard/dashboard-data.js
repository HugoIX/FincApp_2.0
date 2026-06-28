window.FINCAAPP_DASHBOARD_DATA = {
  farms: [
    {
      id: "farm-el-roble",
      name: "Oak Farm",
      location: "Antioquia, Colombia",
      lastSync: "2026-06-27 09:45",
      pendingSync: 3,
      animals: [
        { id: "A-302", type: "cattle", tag: "302", latestWeightKg: 520 },
        { id: "A-045", type: "cattle", tag: "45", latestWeightKg: 410 },
        { id: "A-T20", type: "cattle", tag: "T20", latestWeightKg: 610 },
        { id: "S-012", type: "swine", tag: "12", latestWeightKg: 95 },
        { id: "S-088", type: "swine", tag: "88", latestWeightKg: 102 },
        { id: "P-G15", type: "poultry", tag: "G15", latestWeightKg: 2.4 },
        { id: "P-P9", type: "poultry", tag: "P9", latestWeightKg: 2.5 }
      ],
      weightTrend: [
        { label: "Mon", value: 398 },
        { label: "Tue", value: 410 },
        { label: "Wed", value: 421 },
        { label: "Thu", value: 438 },
        { label: "Fri", value: 452 },
        { label: "Sat", value: 468 },
        { label: "Sun", value: 482 }
      ],
      healthAlerts: [
        { animal: "Cattle 302", tag: "302", symptom: "Fever detected", severity: "high" },
        { animal: "Swine 12", tag: "12", symptom: "Loss of appetite", severity: "high" },
        { animal: "Poultry G15", tag: "G15", symptom: "Cough", severity: "medium" }
      ],
      recentActivity: [
        { time: "09:45", type: "Sync", description: "3 pending records synchronized", status: "success" },
        { time: "09:35", type: "Weight", description: "Cattle 302 registered at 520 kg", status: "pending" },
        { time: "09:31", type: "Health", description: "Fever reported for cattle 302", status: "pending" },
        { time: "09:20", type: "Animal", description: "Swine 12 registered locally", status: "synced" }
      ]
    },
    {
      id: "farm-la-esperanza",
      name: "Hope Farm",
      location: "Córdoba, Colombia",
      lastSync: "2026-06-27 08:20",
      pendingSync: 0,
      animals: [
        { id: "A-701", type: "cattle", tag: "701", latestWeightKg: 455 },
        { id: "A-702", type: "cattle", tag: "702", latestWeightKg: 462 },
        { id: "S-030", type: "swine", tag: "30", latestWeightKg: 88 },
        { id: "S-031", type: "swine", tag: "31", latestWeightKg: 91 },
        { id: "S-032", type: "swine", tag: "32", latestWeightKg: 89 }
      ],
      weightTrend: [
        { label: "Mon", value: 301 },
        { label: "Tue", value: 315 },
        { label: "Wed", value: 318 },
        { label: "Thu", value: 327 },
        { label: "Fri", value: 336 },
        { label: "Sat", value: 344 },
        { label: "Sun", value: 352 }
      ],
      healthAlerts: [
        { animal: "Cattle 702", tag: "702", symptom: "Mild limping", severity: "medium" }
      ],
      recentActivity: [
        { time: "08:20", type: "Sync", description: "All local records synchronized", status: "success" },
        { time: "07:55", type: "Weight", description: "Swine 31 registered at 91 kg", status: "synced" },
        { time: "07:41", type: "Animal", description: "Cattle 702 registered", status: "synced" }
      ]
    },
    {
      id: "farm-empty-demo",
      name: "Demo Empty State Farm",
      location: "No synchronized data",
      lastSync: "--",
      pendingSync: 0,
      animals: [],
      weightTrend: [],
      healthAlerts: [],
      recentActivity: []
    }
  ]
};
