const API_BASE_URL = 'https://fincapp.crudzaso.com/api/v1';
const SESSION_ID = `aura-presentation-${Date.now()}`;

const wakeBtn = document.getElementById('wakeBtn');
const nextBtn = document.getElementById('nextBtn');

const auraOrb = document.getElementById('auraOrb');
const auraState = document.getElementById('auraState');
const sceneTitle = document.getElementById('sceneTitle');
const sceneStep = document.getElementById('sceneStep');

const moduleLabel = document.getElementById('moduleLabel');
const moduleTitle = document.getElementById('moduleTitle');
const cardTag = document.getElementById('cardTag');
const cardTitle = document.getElementById('cardTitle');
const cardText = document.getElementById('cardText');
const metricGrid = document.getElementById('metricGrid');
const featureGrid = document.getElementById('featureGrid');

let currentScene = -1;
let isRunning = false;
let activeAudio = null;
let speechToken = 0;

const scenes = [
  {
    menu: 'dashboard',
    auraState: 'Institutional presentation',
    sceneTitle: 'AURA',
    sceneStep: 'FincApp intelligent assistant',
    moduleLabel: 'Overview',
    moduleTitle: 'Smart farm management',
    cardTag: 'Purpose',
    cardTitle: 'Clearer information for better farm decisions',
    cardText: 'FincApp centralizes farm operations data so animals, weight records, health records and reports can be managed from one place.',
    metrics: [['FincApp', 'Farm management'], ['AURA', 'Intelligent assistant'], ['Data', 'Clear decisions']],
    features: ['Animal inventory', 'Weight control', 'Animal health', 'Reports and analysis'],
    speak: 'Hello, I am AURA, the intelligent assistant integrated into FincApp. I was designed to support farm management through data queries, operational recommendations, guided navigation and decision support.'
  },
  {
    menu: 'dashboard',
    auraState: 'Project context',
    sceneTitle: 'Purpose',
    sceneStep: 'The problem FincApp addresses',
    moduleLabel: 'Context',
    moduleTitle: 'Scattered information in farm operations',
    cardTag: 'Need',
    cardTitle: 'Organizing data to act on time',
    cardText: 'In many farms, information can remain in notebooks, loose sheets or disconnected files. This makes it harder to track animals, weight changes, health records and pending activities.',
    metrics: [['Risk', 'Scattered data'], ['Impact', 'Slow follow-up'], ['Goal', 'Traceability']],
    features: ['Centralized records', 'Animal history', 'Early alerts', 'Operational priorities'],
    speak: 'FincApp was created from a practical need in the agricultural sector. When information is scattered, follow-up becomes slower and decisions depend too much on memory. The goal is to organize farm data so workers and managers can act with more clarity.'
  },
  {
    menu: 'animals',
    auraState: 'Functional tour',
    sceneTitle: 'Inventory',
    sceneStep: 'Registered animals and current status',
    moduleLabel: 'Module',
    moduleTitle: 'Animal inventory',
    cardTag: 'Animals',
    cardTitle: 'Identification and control',
    cardText: 'The inventory module allows users to review animals by tag, production type and current status. This becomes the base for weight, health and report analysis.',
    metrics: [['Tag', 'Identification'], ['Type', 'Cattle, swine or poultry'], ['Status', 'Current follow-up']],
    features: ['Search by tag', 'Animal status', 'Production type', 'Linked records'],
    speak: 'The animal inventory is the foundation of the system. Each animal can be reviewed by its tag, production type and current status. From this information, FincApp connects weight records, health records and reports.'
  },
  {
    menu: 'weights',
    auraState: 'Functional tour',
    sceneTitle: 'Weights',
    sceneStep: 'Evolution and weight-loss alerts',
    moduleLabel: 'Module',
    moduleTitle: 'Weight control',
    cardTag: 'Weights',
    cardTitle: 'Animal evolution tracking',
    cardText: 'Weight records help analyze animal evolution. A significant weight loss can become a priority alert for operational or health follow-up.',
    metrics: [['History', 'Weight records'], ['Analysis', 'Gain or loss'], ['Priority', 'Alerts']],
    features: ['Register weight', 'Compare evolution', 'Detect weight loss', 'Generate reports'],
    speak: 'The weight control module allows workers to register measurements and analyze the evolution of each animal. With this data, AURA can identify weight loss and recommend timely follow-up.'
  },
  {
    menu: 'health',
    auraState: 'Functional tour',
    sceneTitle: 'Health',
    sceneStep: 'Health records and follow-up',
    moduleLabel: 'Module',
    moduleTitle: 'Animal health',
    cardTag: 'Health',
    cardTitle: 'Symptoms, diagnosis and treatment',
    cardText: 'The health module stores animal health events, treatments and observations so animals requiring attention can be followed over time.',
    metrics: [['Symptoms', 'Record'], ['Treatment', 'Follow-up'], ['Risk', 'Prioritization']],
    features: ['Register symptoms', 'Store diagnosis', 'Track treatments', 'Review history'],
    speak: 'The health module allows users to register symptoms, diagnoses, treatments and observations. AURA can use this information to identify animals with higher priority and support operational follow-up.'
  },
  {
    menu: 'reports',
    auraState: 'Architecture',
    sceneTitle: 'Build',
    sceneStep: 'How AURA works inside FincApp',
    moduleLabel: 'Architecture',
    moduleTitle: 'Tool-based intelligent agent',
    cardTag: 'Technology',
    cardTitle: 'Frontend, backend, data and intelligence',
    cardText: 'AURA connects the interface, the dot net backend, PostgreSQL, business rules and voice services to provide a conversational experience.',
    metrics: [['.NET', 'Backend'], ['PostgreSQL', 'Data'], ['ElevenLabs', 'Voice']],
    features: ['Tool agent', 'Business rules', 'Context memory', 'Real data queries'],
    speak: 'AURA was built as a tool-based agent. The interface handles interaction, the dot net backend validates business rules and queries data, PostgreSQL stores information, and the voice service provides a more natural experience.'
  },
  {
    menu: 'reports',
    auraState: 'Live analysis',
    sceneTitle: 'Analysis',
    sceneStep: 'Real local database query',
    moduleLabel: 'Live demo',
    moduleTitle: 'Real data analysis',
    cardTag: 'In progress',
    cardTitle: 'Identifying the highest-priority animal',
    cardText: 'AURA will query the local FincApp database and identify which animal requires the most attention based on weight loss, health alerts and missing records.',
    metrics: [['Real', 'Local database'], ['Context', 'Memory'], ['Action', 'Recommendation']],
    features: ['Query backend', 'Analyze records', 'Prioritize animals', 'Respond with context'],
    speak: 'Now I will perform a real query against the local FincApp database. I will analyze animals, health records and weight records to identify which animal requires the most attention.',
    autoDemo: true
  },
  {
    menu: 'sync',
    auraState: 'Closing',
    sceneTitle: 'Roadmap',
    sceneStep: 'What is missing and how it will be addressed',
    moduleLabel: 'Next phase',
    moduleTitle: 'Product evolution',
    cardTag: 'Pending work',
    cardTitle: 'From functional base to stable product',
    cardText: 'The next phase should strengthen synchronization, validation, production database connection, testing and the offline experience.',
    metrics: [['Sync', 'Synchronization'], ['QA', 'Testing'], ['Deploy', 'Production']],
    features: ['Final synchronization', 'Advanced validation', 'Production database', 'End-to-end testing'],
    speak: 'FincApp already has a functional foundation. The next phase is to strengthen online and offline synchronization, expand validations, connect the production database, improve testing and prepare the system for deployment.'
  }
];

wakeBtn.addEventListener('click', () => {
  runExclusive(async () => {
    currentScene = 0;
    renderScene(scenes[currentScene]);
    await speak(scenes[currentScene].speak);
  });
});

nextBtn.addEventListener('click', () => {
  runExclusive(async () => {
    if (currentScene < scenes.length - 1) {
      currentScene++;
      const scene = scenes[currentScene];
      renderScene(scene);
      await speak(scene.speak);

      if (scene.autoDemo) {
        await runRealDemo();
      }
    }
  });
});

async function runExclusive(action) {
  if (isRunning) return;

  isRunning = true;
  setControlsLocked(true);
  stopCurrentVoice();

  try {
    await action();
  } finally {
    isRunning = false;
    setControlsLocked(false);
  }
}

function setControlsLocked(locked) {
  wakeBtn.disabled = locked || currentScene >= 0;
  nextBtn.disabled = locked || currentScene < 0 || currentScene >= scenes.length - 1;
}

function stopCurrentVoice() {
  speechToken++;

  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.src = '';
      activeAudio.load();
    } catch {}
    activeAudio = null;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  auraOrb.classList.remove('speaking');
}

function renderScene(scene) {
  auraState.textContent = scene.auraState;
  sceneTitle.textContent = scene.sceneTitle;
  sceneStep.textContent = scene.sceneStep;

  moduleLabel.textContent = scene.moduleLabel;
  moduleTitle.textContent = scene.moduleTitle;
  cardTag.textContent = scene.cardTag;
  cardTitle.textContent = scene.cardTitle;
  cardText.textContent = scene.cardText;

  renderMetrics(scene.metrics);
  renderFeatures(scene.features);

  document.querySelectorAll('.menu-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.module === scene.menu);
  });
}

async function runRealDemo() {
  const first = await askToolAgent('que animal esta mas critico');
  if (first) await speak(first);

  const second = await askToolAgent('que hago con ese animal');
  if (second) await speak(second);
}

async function askToolAgent(text) {
  try {
    auraState.textContent = 'Querying backend';

    const response = await fetch(`${API_BASE_URL}/aura/tool-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: SESSION_ID, farm_id: 'all', text })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.tool_name === 'system_data_snapshot') {
      return renderEnglishSnapshot(data);
    }

    if (data.tool_name === 'answer_from_context') {
      return renderEnglishRecommendation(data);
    }

    return 'AURA generated a response using the available FincApp data.';
  } catch (error) {
    console.error(error);
    const fallback = 'I could not connect to the AURA backend. Please verify that the server is running.';
    cardTitle.textContent = 'Backend unavailable';
    cardText.textContent = fallback;
    renderMetrics([['Error', 'Connection'], ['5211', 'Port'], ['Backend', 'Check']]);
    renderFeatures(['Verify backend', 'Check local database', 'Try again']);
    return fallback;
  }
}

function renderEnglishSnapshot(data) {
  const result = data.tool_result || {};
  const priority = result.priority_animals?.[0];

  const tag = priority?.identification_tag || 'unknown';
  const reason = toEnglishReason(priority?.reason || 'requires priority review');
  const score = priority?.priority_score || 'N/A';

  cardTag.textContent = 'Real data query';
  cardTitle.textContent = 'Highest-priority animal';
  cardText.textContent = `AURA identified animal tag ${tag} as the highest-priority case. Main reason: ${reason}. Priority score: ${score}.`;

  renderMetrics([
    [String(result.total_animals || 0), 'Animals'],
    [String(result.health_alerts_count || 0), 'Health alerts'],
    [String(result.animals_with_weight_loss || 0), 'Weight loss cases']
  ]);

  renderFeatures([
    `Priority animal: tag ${tag}`,
    `Reason: ${reason}`,
    `Animals without recent weight: ${result.animals_without_recent_weight || 0}`,
    'Recommendation will be generated from this context'
  ]);

  return `Based on the FincApp records, the highest-priority animal is tag ${tag}. The main reason is that ${reason}. Its priority score is ${score}.`;
}

function renderEnglishRecommendation(data) {
  const animal = data.tool_result?.focus_animal || {};
  const tag = animal.identification_tag || 'unknown';
  const reason = toEnglishReason(animal.reason || 'requires follow-up');

  cardTag.textContent = 'Context memory';
  cardTitle.textContent = 'Follow-up recommendation';
  cardText.textContent = `AURA generated a recommendation for animal tag ${tag}, using the previous real-data analysis.`;

  renderMetrics([
    [tag, 'Animal tag'],
    [String(animal.priority_score || 'N/A'), 'Priority score'],
    ['High', 'Follow-up need']
  ]);

  renderFeatures([
    'Check food and water intake',
    'Review body condition and behavior',
    'Perform a control weight record',
    'Register a health follow-up if the animal does not improve'
  ]);

  return `For animal tag ${tag}, I recommend checking food and water intake, body condition, temperature and signs of weakness. A new control weight record should be performed. If the condition does not improve, a health follow-up should be registered.`;
}

function toEnglishReason(reason) {
  return String(reason)
    .replace('presenta pérdida de peso de', 'has a weight loss of')
    .replace('tiene registros de salud recientes', 'has recent health records')
    .replace('no tiene suficientes registros de peso', 'does not have enough weight records')
    .replace('tiene registros de salud recientes', 'has recent health records');
}

async function speak(rawText) {
  const token = ++speechToken;
  const text = cleanText(rawText);

  auraOrb.classList.add('speaking');
  auraState.textContent = 'AURA speaking';

  try {
    const response = await fetch(`${API_BASE_URL}/aura/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) throw new Error(`Speech HTTP ${response.status}`);

    const blob = await response.blob();
    if (token !== speechToken) return;

    const audioUrl = URL.createObjectURL(blob);
    activeAudio = new Audio(audioUrl);

    await playAudio(activeAudio, token);

    URL.revokeObjectURL(audioUrl);
    activeAudio = null;
  } catch (error) {
    await fallbackSpeak(text, token);
  } finally {
    if (token === speechToken) {
      auraOrb.classList.remove('speaking');
      auraState.textContent = 'AURA ready';
    }
  }
}

function playAudio(audio, token) {
  return new Promise((resolve, reject) => {
    audio.onended = resolve;
    audio.onerror = reject;

    if (token !== speechToken) {
      resolve();
      return;
    }

    audio.play().catch(reject);
  });
}

function fallbackSpeak(text, token) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || token !== speechToken) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.onend = resolve;
    utterance.onerror = resolve;

    window.speechSynthesis.speak(utterance);

    setTimeout(resolve, Math.max(3000, text.split(/\s+/).length * 420));
  });
}

function renderMetrics(metrics) {
  metricGrid.innerHTML = metrics.map(([value, label]) => `
    <div class="metric">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `).join('');
}

function renderFeatures(features) {
  featureGrid.innerHTML = features.map((feature) => `
    <div class="feature">${escapeHtml(feature)}</div>
  `).join('');
}

function cleanText(value) {
  return String(value || '')
    .replace(/unnuevo/g, 'un nuevo')
    .replace(/unpesaje/g, 'un pesaje')
    .replace(/cerrarel/g, 'cerrar el')
    .replace(/(\d)\.([A-ZÁÉÍÓÚÑ])/g, '$1. $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

setControlsLocked(false);
