package com.goalscanpro.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {
    
    private static final String TAG = "WidgetSyncPlugin";
    private static final String PREFS_NAME = "goalscan_prefs";
    private static final String KEY_SAVED_MATCHES = "goalscan_saved";
    private static final String KEY_BANK_SETTINGS = "goalscan_bank_settings";
    
    @PluginMethod
    public void syncData(PluginCall call) {
        try {
            String savedMatches = call.getString("savedMatches");
            String bankSettings = call.getString("bankSettings");
            
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            
            if (savedMatches != null) {
                editor.putString(KEY_SAVED_MATCHES, savedMatches);
                Log.d(TAG, "Sincronizado partidas salvas");
            }
            
            if (bankSettings != null) {
                editor.putString(KEY_BANK_SETTINGS, bankSettings);
                Log.d(TAG, "Sincronizado configurações de banca");
            }
            
            editor.apply();
            
            // Notificar widgets para atualizar
            android.content.Intent updateIntent = new android.content.Intent(
                "com.goalscanpro.app.WIDGET_UPDATE"
            );
            context.sendBroadcast(updateIntent);
            
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "Erro ao sincronizar dados", e);
            call.reject("Erro ao sincronizar dados: " + e.getMessage());
        }
    }
}

