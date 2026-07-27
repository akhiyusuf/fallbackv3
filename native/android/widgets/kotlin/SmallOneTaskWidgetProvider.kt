package com.fallback.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import com.fallback.app.R

/**
 * M7 — S46's "Small · One task" widget. The signal dot is FIXED to the ideal/fallback/off
 * hex from the snapshot — never the accent hex, mirroring S43's accent-invariance rule on
 * the native side too.
 */
class SmallOneTaskWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val snapshot = WidgetSnapshot.load(context)
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_small_one_task)
            if (snapshot != null) {
                val config = snapshot.config("small-one-task")
                val task = snapshot.task(config)
                views.setTextViewText(R.id.widget_one_task_name, task?.name ?: "No task due")
                val signalHex = when (task?.chipState) {
                    "done" -> snapshot.idealHex
                    "fallback" -> snapshot.fallbackHex
                    else -> snapshot.offHex
                }
                views.setInt(R.id.widget_one_task_dot, "setColorFilter", android.graphics.Color.parseColor(signalHex))
            } else {
                views.setTextViewText(R.id.widget_one_task_name, "—")
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
