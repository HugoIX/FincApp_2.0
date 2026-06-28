package com.irwi.fincapp.ui;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.view.animation.ScaleAnimation;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.irwi.fincapp.R;
import com.irwi.fincapp.aura.AuraScriptEngine;
import com.irwi.fincapp.database.DatabaseHelper;
import com.irwi.fincapp.repository.ModuleRepository;

import java.util.ArrayList;
import java.util.Locale;

public class AuraActivity extends Activity implements TextToSpeech.OnInitListener {

    private static final int REQUEST_RECORD_AUDIO = 101;

    private TextView txtAuraConversation;
    private TextView txtAuraStatus;
    private TextView txtAuraOrb;
    private EditText edtAuraQuestion;
    private Button btnVoiceQuestion;

    private TextToSpeech textToSpeech;
    private SpeechRecognizer speechRecognizer;
    private boolean ttsReady = false;
    private String pendingSpeech;
    private ModuleRepository moduleRepository;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_aura);

        DatabaseHelper databaseHelper = new DatabaseHelper(this);
        moduleRepository = new ModuleRepository(databaseHelper);

        textToSpeech = new TextToSpeech(this, this);

        txtAuraConversation = findViewById(R.id.txtAuraConversation);
        txtAuraStatus = findViewById(R.id.txtAuraStatus);
        txtAuraOrb = findViewById(R.id.txtAuraOrb);
        edtAuraQuestion = findViewById(R.id.edtAuraQuestion);

        Button btnAwakenAura = findViewById(R.id.btnAwakenAura);
        Button btnAskAura = findViewById(R.id.btnAskAura);
        Button btnWhoAreYou = findViewById(R.id.btnWhoAreYou);
        Button btnOffline = findViewById(R.id.btnOffline);
        Button btnRegister = findViewById(R.id.btnRegister);
        btnVoiceQuestion = findViewById(R.id.btnVoiceQuestion);

        btnAwakenAura.setOnClickListener(v -> awakenAura());
        btnAskAura.setOnClickListener(v -> askAuraFromInput());
        btnVoiceQuestion.setOnClickListener(v -> startVoiceQuestion());
        btnWhoAreYou.setOnClickListener(v -> askAura("¿Quién eres?"));
        btnOffline.setOnClickListener(v -> askAura("¿Puedes trabajar sin internet?"));
        btnRegister.setOnClickListener(v -> askAura("Quiero registrar una vaca con arete 302 y peso 520 kilos"));

        prepareSpeechRecognizer();
    }

    private void awakenAura() {
        animateOrb();
        txtAuraStatus.setText("AURA despierta · Modo demo offline activo");

        int activeFarms = moduleRepository.getActiveFarms().size();
        int pendingSyncItems = moduleRepository.getPendingSyncCount();
        String intro = AuraScriptEngine.buildIntroMessage(
                "Hugo",
                "admin",
                activeFarms,
                pendingSyncItems
        );

        setAuraVisualState("AURA está lista. Usa el micrófono o escribe una pregunta.");
        speak(intro);
    }

    private void askAuraFromInput() {
        String question = edtAuraQuestion.getText().toString();
        if (question.trim().isEmpty()) {
            Toast.makeText(this, "Escribe una pregunta o usa el micrófono", Toast.LENGTH_SHORT).show();
            return;
        }
        askAura(question);
        edtAuraQuestion.setText("");
    }

    private void askAura(String question) {
        animateOrb();
        String response = AuraScriptEngine.answerQuestion(question);
        setAuraVisualState("Pregunta procesada: “" + question + "”");
        speak(response);
    }

    private void setAuraVisualState(String message) {
        // HU-01 improvement: we no longer print the full text spoken by AURA.
        // The screen only shows a short state message while the real answer is delivered by voice.
        txtAuraConversation.setText(message);
    }

    private void startVoiceQuestion() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Toast.makeText(this, "El reconocimiento de voz no está disponible en este dispositivo", Toast.LENGTH_LONG).show();
            return;
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQUEST_RECORD_AUDIO);
            return;
        }

        if (speechRecognizer == null) {
            prepareSpeechRecognizer();
        }

        textToSpeech.stop();
        animateOrb();
        txtAuraStatus.setText("Listening... speak now");
        setAuraVisualState("Estoy escuchando. Hazle una pregunta a AURA.");

        Intent recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "es-CO");
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "es-CO");
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "es-CO");
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Pregúntale algo a AURA");
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);

        speechRecognizer.startListening(recognizerIntent);
    }

    private void prepareSpeechRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            return;
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                txtAuraStatus.setText("Micrófono activo · AURA está escuchando");
            }

            @Override
            public void onBeginningOfSpeech() {
                txtAuraStatus.setText("Recibiendo tu pregunta...");
            }

            @Override
            public void onRmsChanged(float rmsdB) {
                // Not needed for this demo.
            }

            @Override
            public void onBufferReceived(byte[] buffer) {
                // Not needed for this demo.
            }

            @Override
            public void onEndOfSpeech() {
                txtAuraStatus.setText("Procesando pregunta...");
            }

            @Override
            public void onError(int error) {
                String message = getSpeechErrorMessage(error);
                txtAuraStatus.setText("AURA no pudo escuchar con claridad");
                setAuraVisualState(message + " También puedes escribir la pregunta manualmente.");
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches == null || matches.isEmpty()) {
                    txtAuraStatus.setText("No escuché ninguna pregunta");
                    setAuraVisualState("Intenta de nuevo o escribe la pregunta manualmente.");
                    return;
                }

                String spokenQuestion = matches.get(0);
                txtAuraStatus.setText("Pregunta recibida por voz");
                askAura(spokenQuestion);
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                // Not needed for this demo.
            }

            @Override
            public void onEvent(int eventType, Bundle params) {
                // Not needed for this demo.
            }
        });
    }

    private String getSpeechErrorMessage(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Hubo un problema con el audio del dispositivo.";
            case SpeechRecognizer.ERROR_CLIENT:
                return "El servicio de voz se detuvo inesperadamente.";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Falta el permiso del micrófono para escuchar preguntas.";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "El reconocimiento de voz del sistema necesitó red y no pudo responder.";
            case SpeechRecognizer.ERROR_NO_MATCH:
                return "No logré entender la pregunta.";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "El micrófono está ocupado. Espera un segundo e intenta otra vez.";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "No escuché voz suficiente para procesar la pregunta.";
            default:
                return "No pude procesar la pregunta por voz.";
        }
    }

    private void animateOrb() {
        ScaleAnimation scaleAnimation = new ScaleAnimation(
                0.92f,
                1.08f,
                0.92f,
                1.08f,
                Animation.RELATIVE_TO_SELF,
                0.5f,
                Animation.RELATIVE_TO_SELF,
                0.5f
        );
        scaleAnimation.setDuration(700);
        scaleAnimation.setRepeatMode(Animation.REVERSE);
        scaleAnimation.setRepeatCount(1);

        AlphaAnimation alphaAnimation = new AlphaAnimation(0.65f, 1.0f);
        alphaAnimation.setDuration(700);
        alphaAnimation.setRepeatMode(Animation.REVERSE);
        alphaAnimation.setRepeatCount(1);

        txtAuraOrb.startAnimation(scaleAnimation);
        txtAuraStatus.startAnimation(alphaAnimation);
    }

    private void speak(String message) {
        if (!ttsReady) {
            pendingSpeech = message;
            return;
        }
        textToSpeech.stop();
        textToSpeech.speak(message, TextToSpeech.QUEUE_FLUSH, null, "AURA_SPEECH");
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int result = textToSpeech.setLanguage(new Locale("es", "CO"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                textToSpeech.setLanguage(new Locale("es", "ES"));
            }
            textToSpeech.setSpeechRate(0.92f);
            textToSpeech.setPitch(1.0f);
            ttsReady = true;

            if (pendingSpeech != null) {
                speak(pendingSpeech);
                pendingSpeech = null;
            }
        } else {
            Toast.makeText(this, "AURA voice engine is not available", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startVoiceQuestion();
            } else {
                Toast.makeText(this, "Sin permiso de micrófono, AURA solo podrá responder preguntas escritas", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    protected void onDestroy() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
        }
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
        }
        super.onDestroy();
    }
}
