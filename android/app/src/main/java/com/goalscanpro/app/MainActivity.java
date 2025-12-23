package com.goalscanpro.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onResume() {
        super.onResume();
        
        // Verificar se há deep link dos widgets
        android.content.Intent intent = getIntent();
        if (intent != null && intent.hasExtra("action")) {
            String action = intent.getStringExtra("action");
            // O JavaScript pode escutar este evento via Capacitor
            // Por enquanto, apenas abrimos o app
        }
    }
}
