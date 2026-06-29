package com.irwi.fincapp.session;
import android.content.Context;import android.content.SharedPreferences;
public class SessionManager{
 private final SharedPreferences p; public SessionManager(Context c){p=c.getSharedPreferences("session",Context.MODE_PRIVATE);} 
 public boolean isLogged(){return p.getBoolean("logged",false);} public void login(String email){p.edit().putBoolean("logged",true).putString("email",email).apply();}
 public void logout(){p.edit().clear().apply();}
 public String getEmail(){return p.getString("email","");}
 public void setFarm(String id,String name){p.edit().putString("farm_id",id).putString("farm_name",name).apply();}
 public String farmId(){return p.getString("farm_id","00000000-0000-0000-0000-000000000001");}
 public String farmName(){return p.getString("farm_name","Demo Farm");}
 public String baseUrl(){return p.getString("base_url","http://10.0.2.2:5211/api/");}
 public void setBaseUrl(String u){p.edit().putString("base_url",u).apply();}
}
