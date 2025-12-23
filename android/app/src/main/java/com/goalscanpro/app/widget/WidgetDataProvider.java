package com.goalscanpro.app.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class WidgetDataProvider {
    private static final String TAG = "WidgetDataProvider";
    private static final String PREFS_NAME = "goalscan_prefs";
    private static final String KEY_SAVED_MATCHES = "goalscan_saved";
    private static final String KEY_BANK_SETTINGS = "goalscan_bank_settings";

    // Classe para representar uma partida salva
    public static class MatchData {
        public String id;
        public String homeTeam;
        public String awayTeam;
        public String matchDate;
        public String matchTime;
        public double probability;
        public double ev;
        public double odd;
        public String betStatus; // pending, won, lost, cancelled
        public double betAmount;
        public double potentialReturn;
        public long timestamp;
        public Long resultAt;
    }

    // Classe para representar configurações de banca
    public static class BankData {
        public double totalBank;
        public String currency;
        public long updatedAt;
    }

    // Ler partidas salvas do SharedPreferences
    public static List<MatchData> getSavedMatches(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String matchesJson = prefs.getString(KEY_SAVED_MATCHES, "[]");
        
        List<MatchData> matches = new ArrayList<>();
        
        try {
            JSONArray jsonArray = new JSONArray(matchesJson);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject matchObj = jsonArray.getJSONObject(i);
                MatchData match = parseMatchData(matchObj);
                if (match != null) {
                    matches.add(match);
                }
            }
        } catch (JSONException e) {
            Log.e(TAG, "Erro ao parsear partidas salvas", e);
        }
        
        return matches;
    }

    // Parsear um objeto JSON de partida
    private static MatchData parseMatchData(JSONObject matchObj) {
        try {
            MatchData match = new MatchData();
            match.id = matchObj.optString("id", "");
            match.timestamp = matchObj.optLong("timestamp", 0);
            
            JSONObject data = matchObj.getJSONObject("data");
            match.homeTeam = data.optString("homeTeam", "");
            match.awayTeam = data.optString("awayTeam", "");
            match.matchDate = data.optString("matchDate", "");
            match.matchTime = data.optString("matchTime", "");
            match.odd = data.optDouble("oddOver15", 0);
            
            JSONObject result = matchObj.getJSONObject("result");
            match.probability = result.optDouble("probabilityOver15", 0);
            match.ev = result.optDouble("ev", 0);
            
            if (matchObj.has("betInfo")) {
                JSONObject betInfo = matchObj.getJSONObject("betInfo");
                match.betStatus = betInfo.optString("status", "");
                match.betAmount = betInfo.optDouble("betAmount", 0);
                match.potentialReturn = betInfo.optDouble("potentialReturn", 0);
                if (betInfo.has("resultAt") && !betInfo.isNull("resultAt")) {
                    match.resultAt = betInfo.optLong("resultAt");
                }
            }
            
            return match;
        } catch (JSONException e) {
            Log.e(TAG, "Erro ao parsear partida individual", e);
            return null;
        }
    }

    // Obter configurações de banca
    public static BankData getBankSettings(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String bankJson = prefs.getString(KEY_BANK_SETTINGS, null);
        
        if (bankJson == null) {
            return null;
        }
        
        try {
            JSONObject bankObj = new JSONObject(bankJson);
            BankData bank = new BankData();
            bank.totalBank = bankObj.optDouble("totalBank", 0);
            bank.currency = bankObj.optString("currency", "R$");
            bank.updatedAt = bankObj.optLong("updatedAt", 0);
            return bank;
        } catch (JSONException e) {
            Log.e(TAG, "Erro ao parsear configurações de banca", e);
            return null;
        }
    }

    // Filtrar partidas futuras
    public static List<MatchData> getUpcomingMatches(Context context) {
        List<MatchData> allMatches = getSavedMatches(context);
        List<MatchData> upcoming = new ArrayList<>();
        long now = System.currentTimeMillis();
        
        for (MatchData match : allMatches) {
            if (match.matchDate != null && !match.matchDate.isEmpty() && 
                match.matchTime != null && !match.matchTime.isEmpty()) {
                try {
                    String[] dateParts = match.matchDate.split("-");
                    String[] timeParts = match.matchTime.split(":");
                    
                    if (dateParts.length == 3 && timeParts.length >= 2) {
                        int year = Integer.parseInt(dateParts[0]);
                        int month = Integer.parseInt(dateParts[1]) - 1;
                        int day = Integer.parseInt(dateParts[2]);
                        int hour = Integer.parseInt(timeParts[0]);
                        int minute = Integer.parseInt(timeParts[1]);
                        
                        java.util.Calendar cal = java.util.Calendar.getInstance();
                        cal.set(year, month, day, hour, minute, 0);
                        long matchTime = cal.getTimeInMillis();
                        
                        if (matchTime > now) {
                            upcoming.add(match);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao parsear data/hora da partida", e);
                }
            }
        }
        
        // Ordenar por data/hora mais próxima
        Collections.sort(upcoming, new Comparator<MatchData>() {
            @Override
            public int compare(MatchData m1, MatchData m2) {
                try {
                    long t1 = getMatchTimestamp(m1);
                    long t2 = getMatchTimestamp(m2);
                    return Long.compare(t1, t2);
                } catch (Exception e) {
                    return 0;
                }
            }
        });
        
        return upcoming;
    }

    // Obter timestamp de uma partida
    private static long getMatchTimestamp(MatchData match) {
        try {
            String[] dateParts = match.matchDate.split("-");
            String[] timeParts = match.matchTime.split(":");
            
            int year = Integer.parseInt(dateParts[0]);
            int month = Integer.parseInt(dateParts[1]) - 1;
            int day = Integer.parseInt(dateParts[2]);
            int hour = Integer.parseInt(timeParts[0]);
            int minute = Integer.parseInt(timeParts[1]);
            
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.set(year, month, day, hour, minute, 0);
            return cal.getTimeInMillis();
        } catch (Exception e) {
            return 0;
        }
    }

    // Obter resultados recentes (won ou lost)
    public static List<MatchData> getRecentResults(Context context) {
        List<MatchData> allMatches = getSavedMatches(context);
        List<MatchData> results = new ArrayList<>();
        
        for (MatchData match : allMatches) {
            if (match.betStatus != null && 
                (match.betStatus.equals("won") || match.betStatus.equals("lost"))) {
                results.add(match);
            }
        }
        
        // Ordenar por resultAt ou timestamp (mais recente primeiro)
        Collections.sort(results, new Comparator<MatchData>() {
            @Override
            public int compare(MatchData m1, MatchData m2) {
                long t1 = (m1.resultAt != null) ? m1.resultAt : m1.timestamp;
                long t2 = (m2.resultAt != null) ? m2.resultAt : m2.timestamp;
                return Long.compare(t2, t1); // Ordem decrescente
            }
        });
        
        return results;
    }

    // Calcular estatísticas agregadas
    public static class StatsData {
        public int totalMatches;
        public int positiveEVCount;
        public double winRate; // %
        public double roi; // %
        public int wonCount;
        public int lostCount;
        public double totalProfit;
    }

    public static StatsData calculateStats(Context context) {
        StatsData stats = new StatsData();
        List<MatchData> allMatches = getSavedMatches(context);
        BankData bank = getBankSettings(context);
        
        stats.totalMatches = allMatches.size();
        
        int wonCount = 0;
        int lostCount = 0;
        double totalProfit = 0;
        int positiveEV = 0;
        
        for (MatchData match : allMatches) {
            if (match.ev > 0) {
                positiveEV++;
            }
            
            if (match.betStatus != null) {
                if (match.betStatus.equals("won")) {
                    wonCount++;
                    totalProfit += (match.potentialReturn - match.betAmount);
                } else if (match.betStatus.equals("lost")) {
                    lostCount++;
                    totalProfit -= match.betAmount;
                }
            }
        }
        
        stats.positiveEVCount = positiveEV;
        stats.wonCount = wonCount;
        stats.lostCount = lostCount;
        stats.totalProfit = totalProfit;
        
        int totalBets = wonCount + lostCount;
        if (totalBets > 0) {
            stats.winRate = (wonCount * 100.0) / totalBets;
        }
        
        // Calcular ROI (assumindo banca inicial como referência)
        if (bank != null && bank.totalBank > 0) {
            // ROI aproximado baseado no lucro total
            stats.roi = (totalProfit * 100.0) / bank.totalBank;
        }
        
        return stats;
    }
}

