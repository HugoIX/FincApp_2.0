package com.irwi.fincapp.ui;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.irwi.fincapp.network.ApiClient;
import com.irwi.fincapp.session.SessionManager;
import java.util.HashMap;
import java.util.Map;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AuraActivity extends Activity {
    private TextView conversation;
    private SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        session = new SessionManager(this);
        LinearLayout layout = BaseUi.root(this);
        layout.addView(BaseUi.title(this, "✨ AURA"));
        layout.addView(BaseUi.subtitle(this, "Assistant connected to the backend endpoint /api/aura/tool-agent"));

        conversation = BaseUi.text(this, "AURA ready. Ask about farm operations, animal registration or offline synchronization.", 18);
        EditText question = BaseUi.input(this, "Ask AURA...");
        Button ask = BaseUi.button(this, "Send to AURA");

        layout.addView(conversation);
        layout.addView(question);
        layout.addView(ask);

        ask.setOnClickListener(v -> {
            String text = question.getText().toString().trim();
            if (text.isEmpty()) {
                BaseUi.toast(this, "Write a question first.");
                return;
            }
            question.setText("");
            askAura(text);
        });
    }

    private void askAura(String text) {
        conversation.setText("You: " + text + "\n\nAURA is thinking...");
        Map<String, String> body = new HashMap<>();
        body.put("text", text);
        body.put("session_id", "android-" + session.userId());
        body.put("farm_id", session.farmId().isEmpty() ? "all" : session.farmId());

        ApiClient.service(session.baseUrl()).auraToolAgent(body).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                if (!response.isSuccessful() || response.body() == null) {
                    conversation.setText("You: " + text + "\n\nAURA backend error. HTTP " + response.code());
                    return;
                }
                Map<String, Object> map = response.body();
                String answer = firstNonEmpty(map.get("aura_response"), map.get("assistant_message"), map.get("audio_text"));
                conversation.setText("You: " + text + "\n\nAURA: " + answer);
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                conversation.setText("You: " + text + "\n\nAURA unavailable: " + t.getMessage());
            }
        });
    }

    private String firstNonEmpty(Object... values) {
        for (Object value : values) {
            if (value != null && !String.valueOf(value).trim().isEmpty()) return String.valueOf(value);
        }
        return "AURA did not return a message.";
    }
}
