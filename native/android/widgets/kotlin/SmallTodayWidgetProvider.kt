package com.fallback.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.fallback.app.R

/** M7 — S46's "Small · Today" widget: an "n/m done" fraction, honouring the current accent. */
class SmallTodayWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val snapshot = WidgetSnapshot.load(context)
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_small_today)
            if (snapshot != null) {
                views.setTextViewText(R.id.widget_today_fraction, "${snapshot.doneCount}/${snapshot.totalDue} done")
                views.setInt(R.id.widget_today_ring, "setColorFilter", android.graphics.Color.parseColor(snapshot.accentHex))
            } else {
                views.setTextViewText(R.id.widget_today_fraction, "—")
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
