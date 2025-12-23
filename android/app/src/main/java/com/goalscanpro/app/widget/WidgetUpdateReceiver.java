package com.goalscanpro.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class WidgetUpdateReceiver extends BroadcastReceiver {
    
    private static final String TAG = "WidgetUpdateReceiver";
    public static final String ACTION_UPDATE_WIDGETS = "com.goalscanpro.app.WIDGET_UPDATE";
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if (ACTION_UPDATE_WIDGETS.equals(action) || 
            AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            
            Log.d(TAG, "Atualizando widgets...");
            
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            
            // Atualizar todos os widgets
            int[] bankWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, BankBalanceWidget.class));
            for (int widgetId : bankWidgetIds) {
                BankBalanceWidget.updateAppWidget(context, appWidgetManager, widgetId);
            }
            
            int[] upcomingWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, UpcomingMatchesWidget.class));
            for (int widgetId : upcomingWidgetIds) {
                UpcomingMatchesWidget.updateAppWidget(context, appWidgetManager, widgetId);
            }
            
            int[] resultsWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, RecentResultsWidget.class));
            for (int widgetId : resultsWidgetIds) {
                RecentResultsWidget.updateAppWidget(context, appWidgetManager, widgetId);
            }
            
            int[] statsWidgetIds = appWidgetManager.getAppWidgetIds(
                new ComponentName(context, QuickStatsWidget.class));
            for (int widgetId : statsWidgetIds) {
                QuickStatsWidget.updateAppWidget(context, appWidgetManager, widgetId);
            }
        }
    }
}

