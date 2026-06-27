/**
 * voice-logic.js - FincApp Voice Assistant
 * Speech-to-Text (commands) + Text-to-Speech (responses) + OpenAI interpretation.
 * The microphone button is ALWAYS available; TTS can be toggled off in Settings.
 */

import { showToast } from './ui-utils.js';
import { navigateTo } from './router.js';

let recognition = null;
let isListening = false;
let ttsEnabled = true;

// ===== INIT =====
export function initVoiceAssistant() {
    ttsEnabled = localStorage.getItem('fincapp_tts') !== 'false';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('[Voice] Speech recognition not supported in this browser.');
        document.getElementById('voice-fab')?.classList.add('opacity-50');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isListening = true;
        const fab = document.getElementById('voice-fab');
        fab?.classList.add('listening');
        document.getElementById('voice-fab-icon')?.classList.replace('fa-microphone', 'fa-circle-stop');
        speak('Listening...');
    };

    recognition.onend = () => {
        isListening = false;
        const fab = document.getElementById('voice-fab');
        fab?.classList.remove('listening');
        document.getElementById('voice-fab-icon')?.classList.replace('fa-circle-stop', 'fa-microphone');
    };

    recognition.onerror = (event) => {
        console.error('[Voice] Error:', event.error);
        isListening = false;
        document.getElementById('voice-fab')?.classList.remove('listening');
        document.getElementById('voice-fab-icon')?.classList.replace('fa-circle-stop', 'fa-microphone');
        if (event.error !== 'no-speech') {
            showToast('Voice recognition error: ' + event.error, 'warning');
        }
    };

    recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase().trim();
        console.log('[Voice] Heard:', transcript);
        showToast(`🎤 "${transcript}"`, 'info');
        await processVoiceCommand(transcript);
    };
}

// ===== TOGGLE VOICE =====
export function toggleVoice() {
    if (!recognition) {
        showToast('Voice recognition not available in this browser', 'warning');
        return;
    }
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

// ===== TEXT TO SPEECH =====
export function speak(message) {
    if (!ttsEnabled) return;
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    window.speechSynthesis.speak(utterance);
}

export function setTTS(enabled) {
    ttsEnabled = enabled;
    localStorage.setItem('fincapp_tts', enabled.toString());
}

export function getTTSStatus() { return ttsEnabled; }

// ===== COMMAND PROCESSOR =====
async function processVoiceCommand(text) {
    // First try local pattern matching (fast, no API needed)
    const localResult = parseLocalCommand(text);
    if (localResult.handled) {
        speak(localResult.response);
        return;
    }

    // Fall back to OpenAI for complex commands
    const apiKey = localStorage.getItem('fincapp_openai_key');
    if (apiKey) {
        try {
            const aiResponse = await interpretWithOpenAI(text, apiKey);
            await executeAICommand(aiResponse);
        } catch (err) {
            console.warn('[Voice] OpenAI unavailable:', err);
            speak('Command not understood. Please try again.');
        }
    } else {
        speak('Please configure your OpenAI API key in Settings for advanced commands.');
        showToast('Add OpenAI API key in Settings for AI commands', 'info');
    }
}

// ===== LOCAL PATTERN MATCHING =====
function parseLocalCommand(text) {
    // Navigation commands
    if (text.includes('inventario') || text.includes('ganado')) {
        navigateTo('inventory');
        return { handled: true, response: 'Abriendo inventario de ganado.' };
    }
    if (text.includes('salud') || text.includes('vacuna')) {
        navigateTo('health');
        return { handled: true, response: 'Abriendo módulo de salud y vacunas.' };
    }
    if (text.includes('actividad') || text.includes('actividades') || text.includes('registro')) {
        navigateTo('activities');
        return { handled: true, response: 'Abriendo registro de actividades.' };
    }
    if (text.includes('peso') && text.includes('control')) {
        navigateTo('weights');
        return { handled: true, response: 'Abriendo control de peso.' };
    }
    if (text.includes('dashboard') || text.includes('inicio') || text.includes('resumen')) {
        navigateTo('dashboard');
        return { handled: true, response: 'Volviendo al dashboard.' };
    }
    if (text.includes('reporte') || text.includes('informe') || text.includes('pdf')) {
        navigateTo('reports');
        return { handled: true, response: 'Abriendo módulo de reportes.' };
    }
    if (text.includes('ajuste') || text.includes('configuración')) {
        navigateTo('settings');
        return { handled: true, response: 'Abriendo ajustes.' };
    }

    // Weight recording: "vaca 101 peso 450"
    const weightMatch = text.match(/(?:vaca|animal|toro|res)\s+(\d+).*?(\d+)\s*(?:kilo|kg|kilogramo)/i)
        || text.match(/(\d+)\s+(?:pesa|peso)\s+(\d+)/i);
    if (weightMatch) {
        const tag = weightMatch[1];
        const weight = weightMatch[2];
        // Trigger form fill
        const tagInput = document.getElementById('livestock-tag') || document.getElementById('weight-tag');
        const weightInput = document.getElementById('current-weight') || document.getElementById('weight-value');
        if (tagInput) tagInput.value = tag;
        if (weightInput) weightInput.value = weight;
        return {
            handled: true,
            response: `Registrando ${weight} kilogramos para el animal número ${tag}. Confirma para guardar.`
        };
    }

    return { handled: false };
}

// ===== OPENAI INTEGRATION =====
async function interpretWithOpenAI(userText, apiKey) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 300,
            messages: [
                {
                    role: 'system',
                    content: `Eres el asistente de FincApp, una app de gestión ganadera. 
                    El usuario habla en español. Interpreta su comando y responde con JSON:
                    {
                        "action": "navigate|register_weight|add_activity|get_diagnosis|unknown",
                        "params": {},
                        "response": "respuesta verbal en español para el usuario"
                    }
                    Acciones disponibles: navigate (a dashboard/inventory/health/activities/weights/reports/settings),
                    register_weight (tag, weight), add_activity (type, description), get_diagnosis (animalId).`
                },
                { role: 'user', content: userText }
            ]
        })
    });

    if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
    const data = await response.json();
    const content = data.choices[0].message.content;

    try {
        return JSON.parse(content.replace(/```json|```/g, '').trim());
    } catch {
        return { action: 'unknown', params: {}, response: content };
    }
}

async function executeAICommand(command) {
    speak(command.response || 'Comando procesado.');

    switch (command.action) {
        case 'navigate':
            if (command.params?.view) navigateTo(command.params.view);
            break;
        case 'register_weight': {
            const tagInput = document.getElementById('weight-tag');
            const weightInput = document.getElementById('weight-value');
            if (tagInput && command.params?.tag) tagInput.value = command.params.tag;
            if (weightInput && command.params?.weight) weightInput.value = command.params.weight;
            navigateTo('weights');
            break;
        }
        case 'add_activity':
            navigateTo('activities');
            break;
        case 'get_diagnosis':
            navigateTo('health');
            break;
    }
}

// ===== AI DIAGNOSIS (for health module) =====
export async function getAIDiagnosis(animalData) {
    try {
        const response = await fetch('http://localhost:5000/api/diagnosis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(animalData)
        });
        const result = await response.json();
        return result.diagnosis;
    } catch (err) {
        // Fallback local si Flask no está corriendo
        if (animalData.weight < 250) {
            return 'Low weight detected. Increase feed ration and check for parasites.';
        }
        return 'Animal is in healthy weight range. Continue current grazing plan.';
    }
}
