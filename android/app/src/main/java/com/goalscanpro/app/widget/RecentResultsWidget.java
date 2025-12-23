package com.goalscanpro.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import com.goalscanpro.app.R;
import java.text.NumberFormat;
import java.util.List;
import java.util.Locale;

public class RecentResultsWidget extends AppWidgetProvider {
    
    private static final String TAG = "RecentResultsWidget";
    
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
        List<WidgetDataProvider.MatchData> recentResults = WidgetDataProvider.getRecentResults(context);
        
        RemoteViews views;
        
        // Determinar qual layout usar baseado no tamanho do widget
        int minHeight = appWidgetManager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        
        // Se altura mínima > 200dp, usar layout medium
        if (minHeight > 200) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_recent_results_medium);
            updateMediumLayout(context, views, recentResults);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_recent_results_small);
            updateSmallLayout(context, views, recentResults);
        }
        
        // Intent para abrir o app ao tocar no widget
        Intent intent = new Intent(context, com.goalscanpro.app.MainActivity.class);
        intent.putExtra("action", "open_results");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, 
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_results_container, pendingIntent);
        
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
    
    private static void updateSmallLayout(Context context, RemoteViews views, List<WidgetDataProvider.MatchData> results) {
        // Por limitações do RemoteViews, vamos mostrar apenas um resumo
        // Em uma implementação mais avançada, poderia usar RemoteViewsService para listas
        if (results != null && !results.isEmpty()) {
            int wonCount = 0;
            int lostCount = 0;
            
            for (WidgetDataProvider.MatchData result : results) {
                if ("won".equals(result.betStatus)) {
                    wonCount++;
                } else if ("lost".equals(result.betStatus)) {
                    lostCount++;
                }
            }
            
            String summary = String.format(Locale.getDefault(), 
                "%d vitórias, %d derrotas", wonCount, lostCount);
            // Como não temos um TextView específico para isso no layout small,
            // vamos usar o título
            views.setTextViewText(R.id.widget_results_title, summary);
        } else {
            views.setTextViewText(R.id.widget_results_title, "Nenhum resultado ainda");
        }
    }
    
    private static void updateMediumLayout(Context context, RemoteViews views, List<WidgetDataProvider.MatchData> results) {
        if (results != null && !results.isEmpty()) {
            int wonCount = 0;
            int lostCount = 0;
            
            for (WidgetDataProvider.MatchData result : results) {
                if ("won".equals(result.betStatus)) {
                    wonCount++;
                } else if ("lost".equals(result.betStatus)) {
                    lostCount++;
                }
            }
            
            int total = wonCount + lostCount;
            double winRate = total > 0 ? (wonCount * 100.0 / total) : 0;
            
            views.setTextViewText(R.id.widget_results_winrate, 
                String.format(Locale.getDefault(), "Taxa: %.0f%%", winRate));
        } else {
            views.setTextViewText(R.id.widget_results_title, "Nenhum resultado ainda");
            views.setTextViewText(R.id.widget_results_winrate, "");
        }
    }
}

