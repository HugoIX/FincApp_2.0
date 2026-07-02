package com.irwi.fincapp.ui;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public final class BaseUi {
    private BaseUi() {}

    public static LinearLayout root(Activity activity) {
        ScrollView scrollView = new ScrollView(activity);
        scrollView.setFillViewport(true);
        LinearLayout layout = new LinearLayout(activity);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(28, 36, 28, 36);
        layout.setBackgroundColor(Color.rgb(246, 250, 246));
        scrollView.addView(layout);
        activity.setContentView(scrollView);
        return layout;
    }

    public static TextView title(Activity activity, String text) {
        TextView view = text(activity, text, 30);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setGravity(Gravity.CENTER_HORIZONTAL);
        view.setTextColor(Color.rgb(21, 91, 48));
        view.setPadding(0, 10, 0, 18);
        return view;
    }

    public static TextView subtitle(Activity activity, String text) {
        TextView view = text(activity, text, 18);
        view.setGravity(Gravity.CENTER_HORIZONTAL);
        view.setTextColor(Color.rgb(55, 75, 61));
        view.setPadding(0, 0, 0, 20);
        return view;
    }

    public static TextView text(Activity activity, String text, int sizeSp) {
        TextView view = new TextView(activity);
        view.setText(text);
        view.setTextSize(sizeSp);
        view.setTextColor(Color.rgb(22, 35, 26));
        view.setPadding(0, 8, 0, 8);
        return view;
    }

    public static EditText input(Activity activity, String hint) {
        EditText editText = new EditText(activity);
        editText.setHint(hint);
        editText.setTextSize(19);
        editText.setMinHeight(62);
        editText.setPadding(18, 8, 18, 8);
        editText.setSingleLine(false);
        editText.setTextColor(Color.rgb(16, 32, 21));
        editText.setHintTextColor(Color.rgb(104, 119, 109));
        editText.setBackgroundResource(com.irwi.fincapp.R.drawable.input_bg);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 8, 0, 12);
        editText.setLayoutParams(params);
        return editText;
    }

    public static Button button(Activity activity, String text) {
        Button button = new Button(activity);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(19);
        button.setTypeface(Typeface.DEFAULT_BOLD);
        button.setTextColor(Color.WHITE);
        button.setMinHeight(68);
        button.setBackgroundResource(com.irwi.fincapp.R.drawable.button_primary);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.setMargins(0, 10, 0, 10);
        button.setLayoutParams(params);
        return button;
    }

    public static Button secondaryButton(Activity activity, String text) {
        Button button = button(activity, text);
        button.setBackgroundResource(com.irwi.fincapp.R.drawable.module_button_bg);
        button.setTextColor(Color.rgb(16, 56, 29));
        return button;
    }

    public static View divider(Activity activity) {
        View view = new View(activity);
        view.setBackgroundColor(Color.rgb(210, 225, 214));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, 2);
        params.setMargins(0, 18, 0, 18);
        view.setLayoutParams(params);
        return view;
    }

    public static void toast(Activity activity, String message) {
        Toast.makeText(activity, message, Toast.LENGTH_LONG).show();
    }
}
