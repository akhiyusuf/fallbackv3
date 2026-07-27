package com.fallback.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.fallback.app.R

/** M7 — S46's "Medium · Up next" widget: the next two due tasks with their times. */
class MediumUpNextWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val snapshot = WidgetSnapshot.load(context)
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_medium_up_next)
            val upNext = snapshot?.tasks.orEmpty().take(2)
            views.setTextViewText(
                R.id.widget_up_next_line1,
                upNext.getOrNull(0)?.let { "${it.name}${it.timeOfDay?.let { t -> " · $t" } ?: ""}" } ?: "Nothing due",
            )
            views.setTextViewText(
                R.id.widget_up_next_line2,
                upNext.getOrNull(1)?.let { "${it.name}${it.timeOfDay?.let { t -> " · $t" } ?: ""}" } ?: "",
            )
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
