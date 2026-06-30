/**
 * voice-logic.js - AURA Web Agent
 * Voice agent connected to C# backend /api/aura/tool-agent
 * Executes UI actions: navigate, open forms, prefill fields.
 */

import { apiService } from './api.js';
import { showToast } from './ui-utils.js';

let recognition = null;
let isListening = false;
let ttsEnabled = localStorage.getItem('fincapp_tts_enabled') !== 'false';

let previousSessionsText = '';
let currentSessionFinal = '';
let currentSessionInterim = '';
let auraSilenceTimer = null;
let auraMaxListenTimer = null;
let auraProcessing = false;
let auraListenStartedAt = 0;
let auraIsAutoRestart = false;

const AURA_DEFAULT_SILENCE_MS = 3500;
const AURA_ANIMAL_REGISTER_SILENCE_MS = 7500;
const AURA_MAX_LISTEN_MS = 30000;

export function initVoiceAssistant() {
  setupRecognition();
  window.askAura = askAuraByText;
}

export function setTTS(enabled) {
  ttsEnabled = Boolean(enabled);
  localStorage.setItem('fincapp_tts_enabled', String(ttsEnabled));
}

export function getTTSStatus() {
  return ttsEnabled;
}

let currentAuraAudio = null;

export function speak(text) {
  if (!ttsEnabled || !text) return;

  playAuraSpeech(text).catch(error => {
    console.warn('[AURA] ElevenLabs speech failed, using browser fallback:', error);
    browserSpeechFallback(text);
  });
}

async function playAuraSpeech(text) {
  const apiBaseUrl = getAuraSpeechApiBaseUrl();

  if (currentAuraAudio) {
    currentAuraAudio.pause();
    currentAuraAudio = null;
  }

  const response = await fetch(`${apiBaseUrl}/aura/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      stability: 0.62,
      similarity_boost: 0.80,
      style: 0.16
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Speech request failed: ${response.status} ${errorText}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  currentAuraAudio = new Audio(audioUrl);
  currentAuraAudio.onended = () => URL.revokeObjectURL(audioUrl);
  currentAuraAudio.onerror = () => URL.revokeObjectURL(audioUrl);

  await currentAuraAudio.play();
}

function browserSpeechFallback(text) {
  if (!ttsEnabled || !text || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-CO';
  utterance.rate = 0.95;
  utterance.pitch = 1;

  window.speechSynthesis.speak(utterance);
}

function getAuraSpeechApiBaseUrl() {
  return (localStorage.getItem('fincapp_api_base_url') || 'https://fincapp.crudzaso.com/api/v1')
    .replace(/\/$/, '');
}

export async function toggleVoice() {
  setupRecognition();

  if (!recognition) {
    showToast('Tu navegador no soporta reconocimiento de voz.', 'warning');
    speak('Tu navegador no soporta reconocimiento de voz. Usa Google Chrome.');
    return;
  }

  if (isListening) {
    recognition.stop();
    setListeningState(false);
    return;
  }

  try {
    window.speechSynthesis?.cancel();
    recognition.start();
  } catch (error) {
    console.warn('[AURA] recognition start error:', error);
    showToast('No pude iniciar el micrófono.', 'warning');
  }
}

function setupRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    recognition = null;
    return;
  }

  if (recognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'es-CO';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    setListeningState(true);
    auraProcessing = false;
    clearTimeout(auraSilenceTimer);

    if (!auraIsAutoRestart) {
      previousSessionsText = '';
      currentSessionFinal = '';
      currentSessionInterim = '';
      auraListenStartedAt = Date.now();

      clearTimeout(auraMaxListenTimer);
      auraMaxListenTimer = setTimeout(() => {
        processBufferedAuraCommand('max-time');
      }, AURA_MAX_LISTEN_MS);

      showToast('AURA está escuchando. Puedes decir el comando completo...', 'info');
    } else {
      previousSessionsText = `${previousSessionsText} ${currentSessionFinal}`.trim();
      currentSessionFinal = '';
      currentSessionInterim = '';
    }

    auraIsAutoRestart = false;
  };

  recognition.onresult = async (event) => {
    let newFinalText = '';
    let newInterimText = '';

    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript || '';

      if (result.isFinal) {
        newFinalText += ` ${transcript}`;
      } else {
        newInterimText += ` ${transcript}`;
      }
    }

    currentSessionFinal = newFinalText.trim();
    currentSessionInterim = newInterimText.trim();

    const currentTranscript = `${previousSessionsText} ${currentSessionFinal} ${currentSessionInterim}`.trim();

    if (!currentTranscript) return;

    updateAuraLiveTranscript(currentTranscript);

    if (isAuraFinishCommand(currentTranscript)) {
      processBufferedAuraCommand('finish-command');
      return;
    }

    scheduleAuraProcessing(currentTranscript);
  };

  recognition.onerror = (event) => {
    console.warn('[AURA] Voice error:', event.error);
    clearAuraLiveTranscript();
    setListeningState(false);

    if (event.error === 'no-speech') {
      const transcript = `${previousSessionsText} ${currentSessionFinal} ${currentSessionInterim}`.trim();

      if (transcript) {
        updateAuraLiveTranscript(transcript);
        scheduleAuraProcessing(transcript);
        return;
      }

      showToast('AURA no detectó voz. Intenta de nuevo.', 'warning');
      return;
    }

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      showToast('Permite el micrófono para usar AURA.', 'error');
      speak('Necesito permiso del micrófono para escucharte.');
      return;
    }

    showToast(`Error de voz: ${event.error}`, 'warning');
  };

  recognition.onend = () => {
    setListeningState(false);

    const transcript = `${previousSessionsText} ${currentSessionFinal} ${currentSessionInterim}`.trim();

    if (!transcript || auraProcessing) {
      return;
    }

    const elapsed = Date.now() - auraListenStartedAt;

    if (elapsed < AURA_MAX_LISTEN_MS) {
      updateAuraLiveTranscript(transcript);

      setTimeout(() => {
        try {
          if (!auraProcessing && recognition) {
            auraIsAutoRestart = true;
            recognition.start();
          }
        } catch (error) {
          console.warn('[AURA] auto-restart recognition error:', error);
        }
      }, 350);

      return;
    }

    processBufferedAuraCommand('max-time-on-end');
  };
}

function setListeningState(active) {
  isListening = active;

  const fab = document.getElementById('voice-fab');
  const icon = document.getElementById('voice-fab-icon');

  if (fab) {
    fab.classList.toggle('ring-4', active);
    fab.classList.toggle('ring-green-300', active);
    fab.classList.toggle('scale-105', active);
  }

  if (icon) {
    icon.classList.toggle('fa-microphone', !active);
    icon.classList.toggle('fa-wave-square', active);
  }
}



function updateAuraLiveTranscript(text) {
  let box = document.getElementById('aura-live-transcript-box');

  if (!box) {
    box = document.createElement('div');
    box.id = 'aura-live-transcript-box';
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.bottom = '24px';
    box.style.transform = 'translateX(-50%)';
    box.style.zIndex = '9999';
    box.style.width = 'min(92vw, 720px)';
    box.style.padding = '18px 22px';
    box.style.borderRadius = '18px';
    box.style.background = 'linear-gradient(135deg, #1d4ed8, #2563eb)';
    box.style.color = '#ffffff';
    box.style.boxShadow = '0 18px 45px rgba(15, 23, 42, 0.35)';
    box.style.fontFamily = 'Inter, system-ui, Arial, sans-serif';

    box.innerHTML = `
      <div style="display:flex; gap:14px; align-items:flex-start;">
        <div style="
          width:34px;
          height:34px;
          min-width:34px;
          border-radius:999px;
          background:rgba(255,255,255,0.18);
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:800;
        ">🎙</div>
        <div style="flex:1;">
          <div style="font-size:13px; opacity:0.85; font-weight:700; margin-bottom:5px;">
            AURA está escuchando...
          </div>
          <div id="aura-live-transcript-text" style="
            font-size:17px;
            line-height:1.45;
            font-weight:700;
            word-break:break-word;
          "></div>
          <div style="font-size:12px; opacity:0.75; margin-top:8px;">
            Hable paso a paso. AURA procesará cuando termine.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(box);
  }

  const textEl = document.getElementById('aura-live-transcript-text');
  if (textEl) {
    textEl.textContent = text || '';
  }
}

function clearAuraLiveTranscript() {
  const box = document.getElementById('aura-live-transcript-box');

  if (!box) return;

  box.style.opacity = '0';
  box.style.transition = 'opacity 180ms ease';

  setTimeout(() => {
    box.remove();
  }, 200);
}


function scheduleAuraProcessing(transcript) {
  clearTimeout(auraSilenceTimer);

  const delay = getAuraProcessingDelay(transcript);

  auraSilenceTimer = setTimeout(() => {
    processBufferedAuraCommand('silence');
  }, delay);
}

async function processBufferedAuraCommand(reason = 'silence') {
  if (auraProcessing) return;

  const transcript = `${previousSessionsText} ${currentSessionFinal} ${currentSessionInterim}`.trim();

  if (!transcript) return;

  auraProcessing = true;

  clearTimeout(auraSilenceTimer);
  clearTimeout(auraMaxListenTimer);

  try {
    if (recognition && isListening) {
      recognition.stop();
    }
  } catch {}

  setListeningState(false);

  clearAuraLiveTranscript();

  showToast(`AURA procesando comando completo: "${transcript}"`, 'info');

  previousSessionsText = '';
  currentSessionFinal = '';
  currentSessionInterim = '';

  try {
    await handleAuraCommand(transcript);
  } catch (err) {
    console.error('[AURA] Fallo al procesar el comando:', err);
    showToast('Ocurrió un error inesperado al procesar el comando de voz.', 'error');
  } finally {
    auraProcessing = false;
  }
}


function isAuraFinishCommand(transcript) {
  const text = normalize(transcript);

  return text.endsWith(' listo') ||
      text.endsWith(' listo aura') ||
      text.includes(' eso es todo') ||
      text.includes(' ya termine') ||
      text.includes(' termine') ||
      text.includes(' finaliza comando') ||
      text.includes(' procesa eso');
}


function getAuraProcessingDelay(transcript) {
  const text = normalize(transcript);

  const isAnimalRegistration =
    text.includes('registrar animal') ||
    text.includes('registra animal') ||
    text.includes('vamos a registrar') ||
    text.includes('nuevo animal') ||
    text.includes('raza') ||
    text.includes('fecha de nacimiento');

  return isAnimalRegistration
    ? AURA_ANIMAL_REGISTER_SILENCE_MS
    : AURA_DEFAULT_SILENCE_MS;
}


export async function askAuraByText(text) {
  return handleAuraCommand(text);
}


function getAuraSessionId() {
  let sessionId = localStorage.getItem('fincapp_aura_session_id');

  if (!sessionId) {
    sessionId = `aura-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('fincapp_aura_session_id', sessionId);
  }

  return sessionId;
}



async function tryLegacyFincAppCommand(text) {
  const command = parseLegacyFincAppCommand(text);

  if (!command) return null;

  console.log('[AURA] Legacy FincApp command matched:', command);

  await executeLegacyFincAppCommand(command, text);

  return {
    mode: 'legacy_fincapp_voice',
    intent: command.intent || command.action,
    action: command.action,
    params: command.params || {},
    assistant_message: command.response,
    aura_response: command.response,
    confidence: 'high',
    missing_fields: [],
    raw_text: text
  };
}

/**
 * Adapted from old FincApp voice-logic.js.
 * Old local commands:
 * - inventario / ganado -> inventory
 * - salud / vacuna -> health
 * - actividad / actividades / registro -> activities
 * - peso + control -> weights
 * - dashboard / inicio / resumen -> dashboard
 * - reporte / informe / pdf -> reports
 * - ajuste / configuración -> settings
 * - vaca 101 peso 450 / 101 pesa 450 -> register_weight
 */
function parseLegacyFincAppCommand(text) {
  const raw = String(text || '');
  const normalized = normalize(raw);

  // Export inventory must be checked BEFORE generic inventory navigation.
  // Example: "exporta el inventario" contains "inventario", but the intended action is export.
  if (
    (
      normalized.includes('exporta') ||
      normalized.includes('exportar') ||
      normalized.includes('descarga') ||
      normalized.includes('descargar') ||
      normalized.includes('genera') ||
      normalized.includes('generar') ||
      normalized.includes('saca') ||
      normalized.includes('sacar')
    ) &&
    (
      normalized.includes('inventario') ||
      normalized.includes('ganado') ||
      normalized.includes('animales') ||
      normalized.includes('listado')
    )
  ) {
    return {
      action: 'export_inventory_pdf',
      intent: 'export_inventory',
      params: { format: 'pdf' },
      response: 'Listo voy a generar el PDF del inventario con los animales disponibles.'
    };
  }

  if (
    normalized.includes('inventario en excel') ||
    normalized.includes('inventario en csv') ||
    normalized.includes('excel del inventario') ||
    normalized.includes('csv del inventario') ||
    normalized.includes('listado de animales')
  ) {
    return {
      action: 'export_inventory_pdf',
      intent: 'export_inventory',
      params: { format: 'pdf' },
      response: 'Listo voy a generar el PDF del inventario.'
    };
  }

  // Legacy navigation commands from old FincApp
  if (normalized.includes('inventario') || normalized.includes('ganado')) {
    return {
      action: 'navigate',
      intent: 'open_inventory',
      params: { view: 'inventory' },
      response: 'Abriendo inventario de ganado.'
    };
  }

  if (normalized.includes('salud') || normalized.includes('vacuna')) {
    return {
      action: 'navigate',
      intent: 'open_health',
      params: { view: 'health' },
      response: 'Abriendo módulo de salud y vacunas.'
    };
  }

  if (
    normalized.includes('actividad') ||
    normalized.includes('actividades') ||
    /\bregistro\b/.test(normalized)
  ) {
    return {
      action: 'navigate',
      intent: 'open_activities',
      params: { view: 'activities' },
      response: 'Abriendo registro de actividades.'
    };
  }

  if (normalized.includes('peso') && normalized.includes('control')) {
    return {
      action: 'navigate',
      intent: 'open_weights',
      params: { view: 'weights' },
      response: 'Abriendo control de peso.'
    };
  }

  if (
    normalized.includes('dashboard') ||
    normalized.includes('inicio') ||
    normalized.includes('resumen')
  ) {
    return {
      action: 'navigate',
      intent: 'open_dashboard',
      params: { view: 'dashboard' },
      response: 'Volviendo al dashboard.'
    };
  }

  if (
    normalized.includes('reporte') ||
    normalized.includes('reportes') ||
    normalized.includes('informe') ||
    normalized.includes('pdf')
  ) {
    return {
      action: 'navigate',
      intent: 'open_reports',
      params: { view: 'reports' },
      response: 'Abriendo módulo de reportes.'
    };
  }

  if (
    normalized.includes('ajuste') ||
    normalized.includes('ajustes') ||
    normalized.includes('configuracion') ||
    normalized.includes('configuración')
  ) {
    return {
      action: 'navigate',
      intent: 'open_settings',
      params: { view: 'settings' },
      response: 'Abriendo ajustes.'
    };
  }

  // Legacy weight recording:
  // "vaca 101 peso 450"
  // "animal 101 pesa 450"
  // "101 pesa 450"
  const weightMatch =
    normalized.match(/(?:vaca|animal|toro|res)\s+([a-z0-9-]+).*?(\d+(?:[.,]\d+)?)\s*(?:kilo|kg|kilogramo|kilogramos)?/i) ||
    normalized.match(/([a-z0-9-]+)\s+(?:pesa|peso)\s+(\d+(?:[.,]\d+)?)/i);

  if (weightMatch && hasWeightKeyword(normalized)) {
    const tag = weightMatch[1].toUpperCase();
    const weight = Number(String(weightMatch[2]).replace(',', '.'));

    if (!Number.isNaN(weight)) {
      return {
        action: 'register_weight',
        intent: 'register_weight',
        params: { tag, weight },
        response: `Registrando ${weight} kilogramos para el animal número ${tag}. Confirma para guardar.`
      };
    }
  }

  return null;
}

function hasWeightKeyword(text) {
  return text.includes('peso') ||
      text.includes('pesa') ||
      text.includes('pesó') ||
      text.includes('peso de') ||
      text.includes('kilo') ||
      text.includes('kg') ||
      text.includes('kilogramo');
}

async function executeLegacyFincAppCommand(command, rawText) {
  const response = command.response || 'Command processed.';

  switch (command.action) {
    case 'navigate': {
      speak(response);
      showToast(response, 'success');

      const view = command.params?.view;

      if (view) {
        await goToView(view);
      }

      return;
    }

    case 'export_inventory_pdf': {
      await exportInventoryCsv({
        intent: 'export_inventory',
        action: 'export_inventory_pdf',
        assistant_message: response,
        aura_response: response,
        raw_text: rawText
      });
      return;
    }

    case 'register_weight': {
      const tag = command.params?.tag || '';
      const weight = command.params?.weight || '';

      speak(response);
      showToast(response, 'success');

      await goToView('weights');

      await sleep(350);

      setValue('#livestock-tag', tag);
      setValue('#weight-tag', tag);
      setValue('#current-weight', weight);
      setValue('#weight-value', weight);

      const dateInput = document.getElementById('weight-date');
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }

      focusFirstEmpty([
        '#weight-tag',
        '#livestock-tag',
        '#weight-value',
        '#current-weight'
      ]);

      return;
    }

    case 'add_activity': {
      await openActivityRegistration({
        intent: 'register_task',
        action: 'open_activity_registration',
        task_description: command.params?.description || rawText,
        raw_text: rawText,
        aura_response: response,
        assistant_message: response
      });

      return;
    }

    case 'get_diagnosis': {
      await openHealthRegistration({
        intent: 'register_health_record',
        action: 'open_health_registration',
        identification_tag: command.params?.animalId || command.params?.tag || null,
        symptoms_description: rawText,
        raw_text: rawText,
        aura_response: response,
        assistant_message: response
      });

      return;
    }

    default:
      speak(response);
      showToast(response, 'info');
  }
}


async function handleAuraCommand(text) {
  let parsed;

  try {
    parsed = await apiService.post('aura/tool-agent', {
      text,
      session_id: getAuraSessionId(),
      farm_id: localStorage.getItem('fincapp_current_farm_id') || 'all'
    });
  } catch (error) {
    console.warn('[AURA] Backend tool-agent unavailable, using local fallback:', error);

    const legacyCommand = await tryLegacyFincAppCommand(text);

    if (legacyCommand) {
      return legacyCommand;
    }

    parsed = localAuraFallback(text);
  }

  console.log('[AURA] Tool agent response:', parsed);

  await executeParsedIntent(parsed);

  return parsed;
}

async function executeParsedIntent(parsed) {
  if (!parsed) return;

  parsed = normalizeAuraToolAgentResponse(parsed);

  const action = parsed.ui_action || parsed.action || inferActionFromIntent(parsed.intent);
  const message =
    parsed.aura_response ||
    parsed.audio_text ||
    parsed.assistant_message ||
    '';

  console.log('[AURA] Executing UI action:', action, parsed);

  switch (action) {
    case 'validate_animal_tag':
    case 'open_animal_registration':
      await openAnimalRegistration(parsed);
      return;

    case 'open_weight_registration':
      await openWeightRegistration(parsed);
      return;

    case 'open_health_registration':
      await openHealthRegistration(parsed);
      return;

    case 'open_activity_registration':
      await openActivityRegistration(parsed);
      return;

    case 'export_inventory_pdf':
    case 'download_inventory_pdf':
      await exportInventoryPdf(parsed);
      return;

    case 'show_weight_gain_report':
    case 'show_inventory_report':
    case 'show_health_report':
    case 'show_aura_report':
      speak(message || 'Generé el reporte con la información disponible.');
      showToast('AURA generó un reporte.', 'success');
      await showAuraReport(parsed);
      return;

    case 'open_dashboard':
      speak(message || 'Abriré el dashboard.');
      showToast(message || 'AURA abrió el dashboard.', 'success');
      await goToView('dashboard');
      return;

    case 'open_inventory':
      speak(message || 'Abriré el inventario.');
      showToast(message || 'AURA abrió el inventario.', 'success');
      await goToView('inventory');
      return;

    case 'search_animal':
    case 'open_inventory_and_filter':
      speak(message || 'Buscaré el animal en el inventario.');
      showToast(message || 'AURA buscará el animal en el inventario.', 'success');
      await goToView('inventory');
      return;

    case 'open_reports':
      speak(message || 'Abriré el módulo de reportes.');
      showToast(message || 'AURA abrió reportes.', 'success');
      await goToView('reports');
      return;

    case 'open_settings':
      speak(message || 'Abriré ajustes.');
      showToast(message || 'AURA abrió ajustes.', 'success');
      await goToView('settings');
      return;

    case 'none':
    default:
      if (
        parsed.intent === 'register_vaccination' ||
        parsed.intent === 'register_deworming' ||
        parsed.intent === 'register_treatment' ||
        parsed.intent === 'register_medicine_application' ||
        parsed.tool_name === 'register_health_record_draft'
      ) {
        await openHealthRegistration(parsed);
        return;
      }

      if (
        parsed.intent === 'register_task' ||
        parsed.intent === 'register_activity' ||
        parsed.intent === 'register_feeding' ||
        parsed.intent === 'register_cleaning_task' ||
        parsed.tool_name === 'register_activity_draft'
      ) {
        await openActivityRegistration(parsed);
        return;
      }

      speak(message || 'No logré procesar esa solicitud con una herramienta disponible.');
      showToast(message || 'Solicitud no reconocida por AURA.', 'warning');
  }
}

function normalizeAuraToolAgentResponse(parsed) {
  const toolArgs =
    parsed.tool_args && typeof parsed.tool_args === 'object'
      ? parsed.tool_args
      : {};

  const normalized = {
    ...toolArgs,
    ...parsed
  };

  normalized.tool_args = toolArgs;

  normalized.action = normalized.ui_action || normalized.action || 'none';
  normalized.ui_action = normalized.ui_action || normalized.action || 'none';

  normalized.assistant_message =
    normalized.assistant_message ||
    normalized.audio_text ||
    normalized.aura_response ||
    '';

  normalized.audio_text =
    normalized.audio_text ||
    normalized.assistant_message ||
    normalized.aura_response ||
    '';

  normalized.aura_response =
    normalized.aura_response ||
    normalized.audio_text ||
    normalized.assistant_message ||
    '';

  return normalized;
}

function inferActionFromIntent(intent) {
  switch (intent) {
    case 'register_animal':
      return 'open_animal_registration';

    case 'register_weight':
      return 'open_weight_registration';

    case 'register_health_record':
    case 'register_vaccination':
    case 'register_deworming':
    case 'register_treatment':
    case 'register_medicine_application':
      return 'open_health_registration';

    case 'register_task':
    case 'register_feeding':
    case 'register_cleaning_task':
      return 'open_activity_registration';

    case 'explain_dashboard':
      return 'open_dashboard';

    default:
      return 'none';
  }
}


/**
 * register_animal:
 * Opens Inventory and triggers the existing Register New Animal modal.
 */


async function exportInventoryCsv(parsed) {
  return exportInventoryPdf(parsed);
}

async function exportInventoryPdf(parsed) {
  const intro = parsed.assistant_message || parsed.aura_response || 'Listo voy a generar el PDF del inventario.';
  speak(intro);
  showToast('AURA está generando el PDF del inventario...', 'info');

  let animals = [];

  try {
    const apiLivestock = await apiService.get('livestock');
    if (Array.isArray(apiLivestock)) {
      animals = apiLivestock;
    }
  } catch (error) {
    console.warn('[AURA] livestock endpoint unavailable:', error);
  }

  if (!animals.length) {
    try {
      const apiAnimals = await apiService.get('animals');
      if (Array.isArray(apiAnimals)) {
        animals = apiAnimals;
      }
    } catch (error) {
      console.warn('[AURA] animals endpoint unavailable:', error);
    }
  }

  if (!animals.length) {
    try {
      animals = JSON.parse(localStorage.getItem('fincapp_livestock') || '[]');
    } catch {
      animals = [];
    }
  }

  if (!animals.length) {
    animals = readInventoryFromTable();
  }

  if (!animals.length) {
    const msg = 'no encontré animales para exportar en este momento.';
    speak(msg);
    showToast(msg, 'warning');
    return;
  }

  const normalizedAnimals = animals.map(animal => ({
    ...animal,
    tag_number: animal.tag_number || animal.identification_tag || animal.tag || animal.animal_tag || animal.id || '—',
    breed: animal.breed || animal.animal_type || animal.type || '—',
    status: animal.status || animal.health_status || 'healthy',
    weight: animal.weight || animal.weight_kg || animal.current_weight || animal.last_weight || '—'
  }));

  try {
    const { exportInventoryToPDF } = await import('./ui-utils.js');
    exportInventoryToPDF(normalizedAnimals, 'inventory');

    const msg = `Listo generé el PDF del inventario con ${normalizedAnimals.length} animales.`;
    speak(msg);
    showToast(msg, 'success');
  } catch (error) {
    console.error('[AURA] PDF export failed:', error);
    const msg = 'No pude generar el PDF del inventario. Revisa que jsPDF esté cargado en la página.';
    speak(msg);
    showToast(msg, 'error');
  }
}

function readInventoryFromTable() {
  const table = document.querySelector('table');
  if (!table) return [];

  const rows = Array.from(table.querySelectorAll('tbody tr'));

  return rows.map((tr, index) => {
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());

    return {
      id: cells[0] || `row-${index + 1}`,
      identification_tag: cells[0] || '',
      animal_type: cells[1] || '',
      breed: cells[2] || '',
      weight_kg: cells[3] || '',
      status: cells[4] || ''
    };
  }).filter(row => row.identification_tag);
}

function csvEscape(value) {
  const text = String(value ?? '');

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

async function showAuraReport(parsed) {
  parsed = normalizeAuraToolAgentResponse(parsed || {});

  const title = getReportTitle(parsed);

  const summary =
    parsed.report_summary ||
    parsed.assistant_message ||
    parsed.aura_response ||
    'AURA generó un reporte con la información disponible.';

  const details = buildReportDetails(parsed);

  const actions =
    parsed.recommended_actions ||
    parsed.recommendations ||
    parsed.actions ||
    [];

  renderAuraReportPanel(title, summary, details, actions);
}

function buildReportDetails(parsed) {
  if (Array.isArray(parsed.report_details)) return parsed.report_details;
  if (Array.isArray(parsed.details)) return parsed.details;

  const result = parsed.tool_result || parsed.report || {};

  if (!result || typeof result !== 'object') {
    return [];
  }

  const labels = {
    total_animals: 'Total de animales',
    animals_with_gain: 'Animals with weight gain',
    animals_with_loss: 'Animals with weight loss',
    animals_without_recent_weight: 'Animals without recent weight records',
    average_gain_kg: 'Ganancia promedio kg',
    cattle: 'Cattle',
    swine: 'Swine',
    poultry: 'Poultry',
    active_alerts: 'Alertas activas',
    high_priority: 'Prioridad alta',
    medium_priority: 'Prioridad media',
    recent_health_records: 'Recent health records',
    possible_high_risk_cases: 'Casos posibles de alto riesgo'
  };

  return Object.entries(result).map(([key, value]) => {
    const label = labels[key] || key.replaceAll('_', ' ');
    const displayValue =
      value && typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

    return `${label}: ${displayValue}`;
  });
}

function getReportTitle(parsed) {
  const action = parsed.ui_action || parsed.action || '';
  const toolName = parsed.tool_name || '';
  const intent = parsed.intent || '';

  if (
    toolName === 'answer_from_context' ||
    intent === 'contextual_recommendation'
  ) {
    return 'Recomendaciones de AURA';
  }

  if (
    action === 'show_inventory_report' ||
    toolName === 'generate_inventory_report' ||
    intent === 'show_inventory_report'
  ) {
    return 'Reporte de inventario';
  }

  if (
    action === 'show_health_report' ||
    toolName === 'generate_health_report' ||
    intent === 'show_health_report'
  ) {
    return 'Reporte de salud animal';
  }

  if (
    action === 'show_weight_gain_report' ||
    toolName === 'generate_weight_gain_report'
  ) {
    return 'Reporte de ganancia de peso';
  }

  return 'Reporte de AURA';
}

function renderAuraReportPanel(title, summary, details = [], actions = []) {
  let panel = document.getElementById('aura-report-panel');

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'aura-report-panel';
    panel.style.position = 'fixed';
    panel.style.right = '24px';
    panel.style.top = '88px';
    panel.style.zIndex = '9999';
    panel.style.width = 'min(92vw, 520px)';
    panel.style.maxHeight = '78vh';
    panel.style.overflow = 'auto';
    panel.style.background = '#ffffff';
    panel.style.color = '#172217';
    panel.style.borderRadius = '18px';
    panel.style.boxShadow = '0 20px 55px rgba(15, 23, 42, 0.32)';
    panel.style.border = '1px solid rgba(15, 23, 42, 0.12)';
    document.body.appendChild(panel);
  }

  panel.innerHTML = `
    <div style="padding:20px 22px; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; gap:12px;">
      <div>
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:#16a34a; font-weight:800;">AURA Report</div>
        <h2 style="font-size:20px; margin:4px 0 0; font-weight:900;">${escapeHtml(title)}</h2>
      </div>
      <button id="aura-report-close" style="border:none;background:#f3f4f6;border-radius:999px;width:34px;height:34px;cursor:pointer;">×</button>
    </div>
    <div style="padding:20px 22px;">
      <p style="font-size:15px; line-height:1.55; margin:0 0 16px;">${escapeHtml(summary)}</p>

      ${details.length ? `
        <h3 style="font-size:14px; margin:16px 0 8px; font-weight:900;">Detalles</h3>
        <ul style="padding-left:20px; margin:0;">
          ${details.map(item => `<li style="margin-bottom:7px; line-height:1.45;">${escapeHtml(String(item))}</li>`).join('')}
        </ul>
      ` : ''}

      ${actions.length ? `
        <h3 style="font-size:14px; margin:18px 0 8px; font-weight:900;">Recomendaciones</h3>
        <ul style="padding-left:20px; margin:0;">
          ${actions.map(item => `<li style="margin-bottom:7px; line-height:1.45;">${escapeHtml(String(item))}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `;

  document.getElementById('aura-report-close')?.addEventListener('click', () => panel.remove());
}

async function searchAnimalFromAura(parsed) {
  const tag = parsed.identification_tag || detectTag(normalize(parsed.raw_text || ''));

  if (!tag) {
    const msg = 'puedo buscar el animal, pero necesito el número de arete.';
    speak(msg);
    showToast(msg, 'warning');
    return;
  }

  speak(`Listo voy a buscar el animal con arete ${tag}.`);
  showToast(`Buscando animal ${tag}...`, 'info');

  await goToView('inventory');

  const searchSelectors = [
    '#search',
    '#inventory-search',
    '#animal-search',
    'input[type="search"]',
    'input[placeholder*="Search"]',
    'input[placeholder*="Buscar"]'
  ];

  for (const selector of searchSelectors) {
    const input = document.querySelector(selector);
    if (input) {
      input.value = tag;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.focus();
      return;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


async function openAnimalRegistration(parsed) {
  const tag = parsed.identification_tag || '';
  const animalType = parsed.animal_type || '';
  const breed = parsed.breed || toDisplayType(animalType);
  const birthDate = parsed.birth_date || '';
  const weight = parsed.weight_kg || '';

  if (tag) {
    const validationMessage = `Voy a validar primero si el arete ${tag} ya existe en esta finca.`;
    speak(validationMessage);
    showToast(validationMessage, 'info');
    await sleep(900);

    const existingAnimal = await findExistingAnimalByTag(tag);

    if (existingAnimal) {
      const message = weight
        ? `El animal con arete ${tag} ya existe en esta finca. No crearé un duplicado. Abriré control de peso para registrar ${weight} kilos.`
        : `El animal con arete ${tag} ya existe en esta finca. No se puede registrar dos veces el mismo arete.`;

      speak(message);
      showToast(message, 'warning');

      if (weight) {
        await openWeightRegistration({
          ...parsed,
          intent: 'register_weight',
          identification_tag: tag,
          weight_kg: weight
        });
      } else {
        await goToView('inventory');
      }

      return;
    }
  }

  speak(
    tag
      ? `El arete ${tag} no existe en esta finca. Abriendo registro de nuevo animal. Revisa los datos y confirma para guardar.`
      : 'Abriendo registro de animal. Me falta el arete o identificación.'
  );

  showToast('AURA abrió el registro de nuevo animal.', 'success');

  await goToView('inventory');

  const button = await waitForElement('#btn-new-animal', 3000);
  if (button) button.click();

  await sleep(300);

  setValue('#f-tag', tag);
  setValue('#f-breed', breed);
  setValue('#f-birth', birthDate);
  setValue('#f-status', 'healthy');

  if (weight) {
    setValue('#f-weight', weight);
  }

  focusFirstEmpty(['#f-tag', '#f-breed', '#f-birth', '#f-weight']);
}


/**
 * register_weight:
 * Opens Weight Control and prefills quick entry form.
 */
async function openWeightRegistration(parsed) {
  const tag = parsed.identification_tag || '';
  const weight = parsed.weight_kg || '';

  speak(
    tag && weight
      ? `Abriendo control de peso. Dejé preparado el peso ${weight} kilos para el animal ${tag}. Confirma para guardar.`
      : 'Abriendo control de peso. Me falta el arete o el peso.'
  );

  showToast('AURA abrió control de peso.', 'success');

  await goToView('weights');

  await waitForElement('#quick-weight-form', 3000);

  setValue('#weight-tag', tag);
  setValue('#weight-value', weight);

  const dateInput = document.getElementById('weight-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  focusFirstEmpty(['#weight-tag', '#weight-value', '#weight-date']);
}

/**
 * register_health_record:
 * Opens Health and triggers Add Record.
 */
async function openHealthRegistration(parsed) {
  const isVaccination =
    parsed.intent === 'register_vaccination' ||
    String(parsed.raw_text || '').toLowerCase().includes('vacun');

  const message = isVaccination
    ? (
      parsed.identification_tag
        ? `Abriendo registro de vacunación para el animal ${parsed.identification_tag}. Revisa los datos y confirma.`
        : 'Abriendo registro de vacunación. Me falta el arete del animal y el nombre de la vacuna.'
     )
    : (
      parsed.identification_tag
        ? `Abriendo registro de salud para el animal ${parsed.identification_tag}. Revisa la alerta y confirma.`
        : 'Abriendo registro de salud. Me falta el arete del animal.'
     );

  speak(message);
  showToast(message, 'success');

  await goToView('health');

  const button = await waitForElement('#btn-add-health', 3000);
  if (button) button.click();

  await sleep(300);

  setValue('#health-animal', parsed.identification_tag || '');
  setValue('#f-animal', parsed.identification_tag || '');
  setValue('#animal-id', parsed.identification_tag || '');
  setValue('#health-symptoms', parsed.symptoms_description || parsed.raw_text || '');
  setValue('#symptoms-description', parsed.symptoms_description || parsed.raw_text || '');
  setValue('#alert-level', parsed.severity || 'low');
}

/**
 * register_task:
 * Opens Activities and triggers Log Activity.
 */
async function openActivityRegistration(parsed) {
  const description =
    parsed.task_description ||
    parsed.description ||
    parsed.raw_text ||
    parsed.assistant_message ||
    '';

  const message = description
    ? 'Listo abriré actividades y dejaré preparada la información para que usted confirme.'
    : 'Listo abriré el registro de actividades. Dígame o escriba la actividad.';

  speak(message);
  showToast(message, 'success');

  await goToView('activities');

  const button = await findButtonByText([
    'Log Activity',
    'Add Activity',
    'New Activity',
    'Register activity',
    'Nueva actividad',
    'Agregar actividad',
    'Crear actividad'
  ]);

  if (button) {
    button.click();
    await sleep(300);
  }

  setValue('#activity-description', description);
  setValue('#f-description', description);
  setValue('#description', description);
  setValue('textarea[name="description"]', description);
  setValue('input[name="description"]', description);

  const type =
    parsed.intent === 'register_feeding' ? 'feeding' :
    parsed.intent === 'register_cleaning_task' ? 'cleaning' :
    parsed.intent === 'register_maintenance' ? 'maintenance' :
    'general';

  setValue('#activity-type', type);
  setValue('#f-type', type);
  setValue('select[name="type"]', type);

  focusFirstEmpty([
    '#activity-description',
    '#f-description',
    '#description',
    'textarea[name="description"]',
    'input[name="description"]'
  ]);
}

async function findButtonByText(labels = []) {
  const normalizedLabels = labels.map(label => normalize(label));

  const candidates = Array.from(document.querySelectorAll('button, a'));

  return candidates.find(el => {
    const text = normalize(el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '');
    return normalizedLabels.some(label => text.includes(label));
  }) || null;
}


async function goToView(view) {
  if (typeof window.navigateTo === 'function') {
    await window.navigateTo(view);
  } else {
    window.location.hash = `#${view}`;
  }

  await sleep(500);
}

function setValue(selector, value) {
  const el = document.querySelector(selector);
  if (!el || value === undefined || value === null || value === '') return;

  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function focusFirstEmpty(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el && !el.value) {
      el.focus();
      return;
    }
  }

  const first = document.querySelector(selectors[0]);
  first?.focus();
}

function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const start = Date.now();

    const timer = setInterval(() => {
      const el = document.querySelector(selector);

      if (el) {
        clearInterval(timer);
        resolve(el);
        return;
      }

      if (Date.now() - start > timeout) {
        clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function toDisplayType(type) {
  if (type === 'cattle') return 'Cattle';
  if (type === 'swine') return 'Swine';
  if (type === 'poultry') return 'Poultry';
  return '';
}

function localAuraFallback(text) {
  const raw = text || '';
  const normalized = normalize(raw);

  if (normalized.includes('quien eres') || normalized.includes('hola aura') || normalized.includes('despierta aura')) {
    return {
      intent: 'assistant_response',
      animal_type: null,
      identification_tag: null,
      weight_kg: null,
      symptoms_description: null,
      task_description: null,
      severity: null,
      confidence: 'medium',
      missing_fields: [],
      raw_text: raw,
      aura_response: 'Mi nombre es AURA, el Agente Inteligente de Operaciones Agropecuarias de FincApp.'
    };
  }

  const tag = detectTag(normalized);
  const weight = detectWeight(normalized);
  const animalType = detectAnimalType(normalized);


  if (isExportInventoryText(normalized)) {
    return {
      mode: 'local_fallback',
      intent: 'export_inventory',
      action: 'export_inventory_pdf',
      assistant_message: 'Listo voy a exportar el inventario con la información disponible.',
      aura_response: 'Listo voy a exportar el inventario con la información disponible.',
      confidence: 'medium',
      missing_fields: [],
      raw_text: raw
    };
  }

  if (isReportText(normalized)) {
    return {
      mode: 'local_fallback',
      intent: 'generate_report',
      action: 'show_weight_gain_report',
      assistant_message: 'Listo voy a revisar el comportamiento de ganancia de peso con la información disponible.',
      aura_response: 'Listo voy a revisar el comportamiento de ganancia de peso con la información disponible.',
      report_title: 'Reporte de ganancia de peso',
      report_summary: 'Con la información disponible, AURA puede revisar el comportamiento general de pesos, animales pendientes por actualizar y posibles riesgos productivos.',
      report_details: [
        'Revisar animales sin pesaje reciente.',
        'Comparar el último peso contra el peso anterior.',
        'Identificar animales con baja ganancia o pérdida de peso.',
        'Cruzar alertas de salud con bajo rendimiento.'
      ],
      recommended_actions: [
        'Actualizar pesajes pendientes.',
        'Revisar animales con alertas de salud.',
        'Exportar inventario antes del cierre del reporte.'
      ],
      confidence: 'medium',
      missing_fields: [],
      raw_text: raw
    };
  }

  if (isActivityText(normalized)) {
    return {
      mode: 'local_fallback',
      intent: 'register_task',
      action: 'open_activity_registration',
      task_description: raw,
      assistant_message: 'Listo voy a abrir actividades y dejar esa tarea preparada.',
      aura_response: 'Listo voy a abrir actividades y dejar esa tarea preparada.',
      confidence: 'medium',
      missing_fields: [],
      raw_text: raw
    };
  }


  if (isHealthText(normalized)) {
    return {
      intent: 'register_health_record',
      animal_type: animalType,
      identification_tag: tag,
      weight_kg: null,
      symptoms_description: raw,
      task_description: null,
      severity: inferSeverity(normalized),
      confidence: tag ? 'medium' : 'low',
      missing_fields: tag ? [] : ['identification_tag'],
      raw_text: raw,
      aura_response: tag
        ? `Abriendo registro de salud para el animal ${tag}.`
        : 'Me falta el arete del animal para registrar salud.'
    };
  }

  if (
    normalized.includes('registrar animal') ||
    normalized.includes('registra animal') ||
    normalized.includes('vamos a registrar') ||
    normalized.includes('nuevo animal') ||
    normalized.includes('raza')
  ) {
    return {
      intent: 'register_animal',
      animal_type: animalType,
      identification_tag: tag,
      breed: detectBreed(normalized),
      birth_date: detectBirthDate(normalized),
      weight_kg: weight,
      symptoms_description: null,
      task_description: null,
      severity: null,
      confidence: tag ? 'medium' : 'low',
      missing_fields: tag ? [] : ['identification_tag'],
      raw_text: raw,
      aura_response: 'Abriendo registro de animal.'
    };
  }

  if (weight) {
    return {
      intent: 'register_weight',
      animal_type: animalType,
      identification_tag: tag,
      weight_kg: weight,
      symptoms_description: null,
      task_description: null,
      severity: null,
      confidence: tag ? 'medium' : 'low',
      missing_fields: tag ? [] : ['identification_tag'],
      raw_text: raw,
      aura_response: tag
        ? `Abriendo control de peso para el animal ${tag}.`
        : 'Me falta el arete del animal.'
    };
  }

  if (animalType || normalized.includes('registrar animal') || normalized.includes('registra animal')) {
    return {
      intent: 'register_animal',
      animal_type: animalType,
      identification_tag: tag,
      weight_kg: null,
      symptoms_description: null,
      task_description: null,
      severity: null,
      confidence: tag ? 'medium' : 'low',
      missing_fields: tag ? [] : ['identification_tag'],
      raw_text: raw,
      aura_response: 'Abriendo registro de animal.'
    };
  }

  if (normalized.includes('actividad') || normalized.includes('tarea')) {
    return {
      intent: 'register_task',
      animal_type: null,
      identification_tag: tag,
      weight_kg: null,
      symptoms_description: null,
      task_description: raw,
      severity: null,
      confidence: 'medium',
      missing_fields: [],
      raw_text: raw,
      aura_response: 'Abriendo registro de actividades.'
    };
  }

  return {
    intent: 'unknown',
    animal_type: null,
    identification_tag: null,
    weight_kg: null,
    symptoms_description: null,
    task_description: null,
    severity: null,
    confidence: 'low',
    missing_fields: [],
    raw_text: raw,
    aura_response: 'No estoy segura de cómo procesar ese comando. Puedes decir: registra una vaca con arete 302.'
  };
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function detectTag(text) {
  const match = text.match(/(?:arete|numero|codigo|tag|id|placa|chapeta|marquilla)\s+([a-z0-9-]+)/i);
  return match ? match[1].toUpperCase() : null;
}

function detectWeight(text) {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:kilos|kilo|kg|kilogramos)/i);
  return match ? Number(match[1].replace(',', '.')) : null;
}

function detectAnimalType(text) {
  if (/(vaca|toro|ternero|novillo|res|ganado|bovino)/i.test(text)) return 'cattle';
  if (/(cerdo|marrano|puerco|porcino|lechon)/i.test(text)) return 'swine';
  if (/(pollo|gallina|gallo|ave|aves|ponedora)/i.test(text)) return 'poultry';
  return null;
}


function detectBreed(text) {
  const match = text.match(/raza\s+([a-z0-9áéíóúñ \-]+?)(?:\s+fecha|\s+nacimiento|\s+nacio|\s+peso|\s+pesando|\s+y\s+su\s+peso|$)/i);
  return match ? titleCase(match[1].trim()) : null;
}

function detectBirthDate(text) {
  const match = text.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
  if (!match) return null;

  const months = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12'
  };

  const day = String(match[1]).padStart(2, '0');
  const month = months[normalize(match[2])];
  const year = match[3];

  return month ? `${year}-${month}-${day}` : null;
}

function titleCase(value) {
  return String(value || '').replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
}


function isExportInventoryText(text) {
  return text.includes('exporta') ||
      text.includes('exportar') ||
      text.includes('descarga') ||
      text.includes('descargar') ||
      text.includes('inventario en excel') ||
      text.includes('inventario en csv') ||
      text.includes('listado de animales');
}

function isReportText(text) {
  return text.includes('reporte') ||
      text.includes('reportes') ||
      text.includes('ganancia de peso') ||
      text.includes('ganado peso') ||
      text.includes('perdido peso') ||
      text.includes('como va la finca') ||
      text.includes('resumen de la finca') ||
      text.includes('produccion');
}

function isActivityText(text) {
  return text.includes('actividad') ||
      text.includes('tarea') ||
      text.includes('limpiar') ||
      text.includes('limpieza') ||
      text.includes('corral') ||
      text.includes('reparar') ||
      text.includes('mantenimiento') ||
      text.includes('alimento') ||
      text.includes('alimentacion') ||
      text.includes('cerca');
}


function isHealthText(text) {
  return /(fiebre|sangre|sangrado|diarrea|vomito|tos|cojo|cojera|inflamacion|no come|decaido|debil|herida)/i.test(text);
}

function inferSeverity(text) {
  if (/(fiebre|sangre|sangrado|no come|dificultad para respirar|herida profunda)/i.test(text)) return 'high';
  if (/(diarrea|vomito|tos|cojo|cojera|inflamacion|decaido|debil)/i.test(text)) return 'medium';
  return 'low';
}

export async function getAIDiagnosis(animal) {
  const tag = animal?.tag_number || animal?.tag || animal?.id || 'sin identificación';
  const text = `analiza salud del animal arete ${tag}`;

  try {
    const parsed = await apiService.post('aura/tool-agent', { text, session_id: getAuraSessionId(), farm_id: localStorage.getItem('fincapp_current_farm_id') || 'all' });
    return parsed.aura_response || 'AURA no encontró una alerta específica para este animal.';
  } catch {
    return 'AURA could not connect to the backend. Check the connection before requesting diagnostics.';
  }
}
