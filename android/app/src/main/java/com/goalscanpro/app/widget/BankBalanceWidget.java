package com.goalscanpro.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import com.goalscanpro.app.R;
import java.text.NumberFormat;
import java.util.Locale;

public class BankBalanceWidget extends AppWidgetProvider {
    
    private static final String TAG = "BankBalanceWidget";
    
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }
    
    @Override
    public void onEnabled(Context context) {
        // Widget habilitado
    }
    
    @Override
    public void onDisabled(Context context) {
        // Widget desabilitado
    }
    
    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        WidgetDataProvider.BankData bank = WidgetDataProvider.getBankSettings(context);
        
        RemoteViews views;
        
        // Determinar qual layout usar baseado no tamanho do widget
        int minWidth = appWidgetManager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int minHeight = appWidgetManager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        
        // Se altura mínima > 60dp, usar layout medium
        if (minHeight > 60) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_bank_balance_medium);
            updateMediumLayout(context, views, bank);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_bank_balance_small);
            updateSmallLayout(context, views, bank);
        }
        
        // Intent para abrir o app ao tocar no widget
        Intent intent = new Intent(context, com.goalscanpro.app.MainActivity.class);
        intent.putExtra("action", "open_bank_settings");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, 
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_bank_container, pendingIntent);
        
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
    
    private static void updateSmallLayout(Context context, RemoteViews views, WidgetDataProvider.BankData bank) {
        NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
        
        if (bank != null) {
            views.setTextViewText(R.id.widget_bank_amount, currencyFormat.format(bank.totalBank));
        } else {
            views.setTextViewText(R.id.widget_bank_amount, "R$ 0,00");
        }
    }
    
    private static void updateMediumLayout(Context context, RemoteViews views, WidgetDataProvider.BankData bank) {
        NumberFormat currencyFormat = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
        
        if (bank != null) {
            views.setTextViewText(R.id.widget_bank_amount, currencyFormat.format(bank.totalBank));
            
            // Calcular variação diária (simplificado - pode ser melhorado com histórico)
            // Por enquanto, apenas mostra o saldo
            views.setTextViewText(R.id.widget_bank_change, "+R$ 0,00");
            views.setTextViewText(R.id.widget_bank_change_percent, "(+0%)");
        } else {
            views.setTextViewText(R.id.widget_bank_amount, "R$ 0,00");
            views.setTextViewText(R.id.widget_bank_change, "+R$ 0,00");
            views.setTextViewText(R.id.widget_bank_change_percent, "(+0%)");
        }
    }
}

