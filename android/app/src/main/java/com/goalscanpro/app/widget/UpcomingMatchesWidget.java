package com.goalscanpro.app.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import com.goalscanpro.app.R;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class UpcomingMatchesWidget extends AppWidgetProvider {
    
    private static final String TAG = "UpcomingMatchesWidget";
    
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
        List<WidgetDataProvider.MatchData> upcomingMatches = WidgetDataProvider.getUpcomingMatches(context);
        
        RemoteViews views;
        
        // Determinar qual layout usar baseado no tamanho do widget
        int minHeight = appWidgetManager.getAppWidgetOptions(appWidgetId).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        
        // Se altura mínima > 150dp, usar layout medium
        if (minHeight > 150) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming_matches_medium);
            updateMediumLayout(context, views, upcomingMatches);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_upcoming_matches_small);
            updateSmallLayout(context, views, upcomingMatches);
        }
        
        // Intent para abrir o app ao tocar no widget
        Intent intent = new Intent(context, com.goalscanpro.app.MainActivity.class);
        intent.putExtra("action", "open_matches");
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pendingIntent = android.app.PendingIntent.getActivity(
            context, 0, intent, 
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE
        );
        // Configurar click em todo o widget
        views.setOnClickPendingIntent(R.id.widget_upcoming_container, pendingIntent);
        
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
    
    private static void updateSmallLayout(Context context, RemoteViews views, List<WidgetDataProvider.MatchData> matches) {
        if (matches != null && !matches.isEmpty()) {
            WidgetDataProvider.MatchData nextMatch = matches.get(0);
            
            String teams = nextMatch.homeTeam + " vs " + nextMatch.awayTeam;
            views.setTextViewText(R.id.widget_upcoming_teams, teams);
            
            // Formatar data/hora
            String timeStr = formatMatchTime(nextMatch.matchDate, nextMatch.matchTime);
            views.setTextViewText(R.id.widget_upcoming_time, timeStr);
            
            // Probabilidade e EV
            views.setTextViewText(R.id.widget_upcoming_probability, 
                String.format(Locale.getDefault(), "%.0f%%", nextMatch.probability));
            
            String evText = String.format(Locale.getDefault(), "EV: %+.1f%%", nextMatch.ev);
            views.setTextViewText(R.id.widget_upcoming_ev, evText);
            
            // Cor do EV baseado no valor
            if (nextMatch.ev > 0) {
                views.setInt(R.id.widget_upcoming_ev, "setBackgroundColor", 0x334CAF50); // Verde transparente
            } else {
                views.setInt(R.id.widget_upcoming_ev, "setBackgroundColor", 0x33F44336); // Vermelho transparente
            }
        } else {
            views.setTextViewText(R.id.widget_upcoming_teams, "Nenhuma partida agendada");
            views.setTextViewText(R.id.widget_upcoming_time, "");
            views.setTextViewText(R.id.widget_upcoming_probability, "");
            views.setTextViewText(R.id.widget_upcoming_ev, "");
        }
    }
    
    private static void updateMediumLayout(Context context, RemoteViews views, List<WidgetDataProvider.MatchData> matches) {
        // Para layout medium, mostrar múltiplas partidas
        // Por limitações do RemoteViews, vamos mostrar apenas a primeira partida por enquanto
        // Em uma implementação mais avançada, poderia usar RemoteViewsService
        if (matches != null && !matches.isEmpty()) {
            updateSmallLayout(context, views, matches);
        } else {
            views.setTextViewText(R.id.widget_upcoming_title, "Nenhuma partida agendada");
        }
    }
    
    private static String formatMatchTime(String date, String time) {
        try {
            if (date != null && !date.isEmpty() && time != null && !time.isEmpty()) {
                String[] dateParts = date.split("-");
                String[] timeParts = time.split(":");
                
                if (dateParts.length == 3 && timeParts.length >= 2) {
                    int year = Integer.parseInt(dateParts[0]);
                    int month = Integer.parseInt(dateParts[1]) - 1;
                    int day = Integer.parseInt(dateParts[2]);
                    int hour = Integer.parseInt(timeParts[0]);
                    int minute = Integer.parseInt(timeParts[1]);
                    
                    java.util.Calendar cal = java.util.Calendar.getInstance();
                    cal.set(year, month, day, hour, minute, 0);
                    
                    java.util.Calendar now = java.util.Calendar.getInstance();
                    long diff = cal.getTimeInMillis() - now.getTimeInMillis();
                    
                    if (diff < 24 * 60 * 60 * 1000) {
                        // Hoje
                        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                        return "Hoje, " + timeFormat.format(cal.getTime());
                    } else if (diff < 2 * 24 * 60 * 60 * 1000) {
                        // Amanhã
                        SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                        return "Amanhã, " + timeFormat.format(cal.getTime());
                    } else {
                        // Outra data
                        SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM, HH:mm", Locale.getDefault());
                        return dateFormat.format(cal.getTime());
                    }
                }
            }
        } catch (Exception e) {
            // Ignorar erros de parsing
        }
        return "";
    }
}

