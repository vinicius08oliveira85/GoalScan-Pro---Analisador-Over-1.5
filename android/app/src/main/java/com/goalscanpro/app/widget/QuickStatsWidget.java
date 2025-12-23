package com.goalscanpro.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import com.goalscanpro.app.R;
import java.util.Locale;

public class QuickStatsWidget extends AppWidgetProvider {
    
    private static final String TAG = "QuickStatsWidget";
    
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
        WidgetDataProvider.StatsData stats = WidgetDataProvider.calculateStats(context);
        
        RemoteViews views;
        
        // Determinar qual layout usar baseado no tamanho do widget
        int minHeight = appWidgetManager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        
        // Se altura mínima > 100dp, usar layout medium
        if (minHeight > 100) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_stats_medium);
            updateMediumLayout(context, views, stats);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_stats_small);
            updateSmallLayout(context, views, stats);
        }
        
        // Intent para abrir o app ao tocar no widget
        Intent intent = new Intent(context, com.goalscanpro.app.MainActivity.class);
        intent.putExtra("action", "open_stats");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, 
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_stats_container, pendingIntent);
        
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
    
    private static void updateSmallLayout(Context context, RemoteViews views, WidgetDataProvider.StatsData stats) {
        if (stats != null) {
            views.setTextViewText(R.id.widget_stats_total_value, String.valueOf(stats.totalMatches));
            views.setTextViewText(R.id.widget_stats_ev_value, String.valueOf(stats.positiveEVCount));
        } else {
            views.setTextViewText(R.id.widget_stats_total_value, "0");
            views.setTextViewText(R.id.widget_stats_ev_value, "0");
        }
    }
    
    private static void updateMediumLayout(Context context, RemoteViews views, WidgetDataProvider.StatsData stats) {
        if (stats != null) {
            views.setTextViewText(R.id.widget_stats_total_value, String.valueOf(stats.totalMatches));
            views.setTextViewText(R.id.widget_stats_winrate_value, 
                String.format(Locale.getDefault(), "%.0f%%", stats.winRate));
            views.setTextViewText(R.id.widget_stats_ev_value, String.valueOf(stats.positiveEVCount));
            views.setTextViewText(R.id.widget_stats_roi_value, 
                String.format(Locale.getDefault(), "%.1f%%", stats.roi));
        } else {
            views.setTextViewText(R.id.widget_stats_total_value, "0");
            views.setTextViewText(R.id.widget_stats_winrate_value, "0%");
            views.setTextViewText(R.id.widget_stats_ev_value, "0");
            views.setTextViewText(R.id.widget_stats_roi_value, "0%");
        }
    }
}

