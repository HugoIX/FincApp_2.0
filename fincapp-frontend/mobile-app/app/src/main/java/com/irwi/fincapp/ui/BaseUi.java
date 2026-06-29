package com.irwi.fincapp.ui;
import android.app.Activity;import android.graphics.Typeface;import android.view.*;import android.widget.*;import android.graphics.Color;import android.text.InputType;
public class BaseUi{
 public static LinearLayout root(Activity a){LinearLayout l=new LinearLayout(a);l.setOrientation(LinearLayout.VERTICAL);l.setPadding(28,28,28,28);l.setBackgroundColor(Color.rgb(244,247,242));a.setContentView(l);return l;}
 public static TextView title(Activity a,String s){TextView v=new TextView(a);v.setText(s);v.setTextSize(30);v.setTypeface(Typeface.DEFAULT_BOLD);v.setTextColor(Color.rgb(16,32,21));v.setPadding(0,14,0,18);return v;}
 public static TextView text(Activity a,String s,int sp){TextView v=new TextView(a);v.setText(s);v.setTextSize(sp);v.setTextColor(Color.rgb(16,32,21));v.setPadding(0,8,0,8);return v;}
 public static EditText input(Activity a,String hint){EditText e=new EditText(a);e.setHint(hint);e.setTextSize(20);e.setSingleLine(false);e.setMinHeight(58);e.setPadding(18,8,18,8);e.setBackgroundResource(com.irwi.fincapp.R.drawable.input_bg);e.setTextColor(Color.rgb(16,32,21));e.setHintTextColor(Color.GRAY);e.setLayoutParams(new LinearLayout.LayoutParams(-1,-2));return e;}
 public static Button btn(Activity a,String s){Button b=new Button(a);b.setText(s);b.setTextSize(20);b.setTypeface(Typeface.DEFAULT_BOLD);b.setTextColor(Color.WHITE);b.setAllCaps(false);b.setMinHeight(68);b.setBackgroundResource(com.irwi.fincapp.R.drawable.button_primary);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.setMargins(0,12,0,12);b.setLayoutParams(p);return b;}
 public static void toast(Activity a,String s){Toast.makeText(a,s,Toast.LENGTH_LONG).show();}
}
