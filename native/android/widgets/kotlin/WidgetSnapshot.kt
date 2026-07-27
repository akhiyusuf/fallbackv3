package com.fallback.app.widgets

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * M7. Reads the JSON snapshot `src/services/widgets/index.ts` writes via `expo-file-system`'s
 * `Paths.document` (see that file's header comment: Android's AppWidgetProvider runs IN the
 * host app's own process, as a plain `BroadcastReceiver` — unlike iOS's separate WidgetKit
 * extension process, so no App Group / shared-container concept applies here at all; the
 * app's own `filesDir` is already directly readable). This is the widget's ONLY data source —
 * it never opens the app's SQLite database (MODULES.md M7's non-negotiable).
 *
 * ASSUMPTION, flagged for verification against a real `expo prebuild` output: `expo-file-
 * system`'s `Paths.document` is expected to resolve to `context.filesDir` on Android (its
 * long-standing mapping in prior expo-file-system versions), so `SNAPSHOT_FILENAME` is read
 * from there directly. If a future expo-file-system release changes that mapping, this
 * constant is the one thing that needs to move with it.
 */
private const val SNAPSHOT_FILENAME = "fallback-widget-snapshot.json"

data class WidgetTaskSummary(
    val id: String,
    val name: String,
    val timeOfDay: String?,
    val chipState: String?,
)

data class WidgetConfigEntry(
    val size: String,
    val mode: String,
    val fixedTaskId: String?,
)

data class WidgetSnapshot(
    val version: Int,
    val generatedAt: String,
    val accentHex: String,
    val idealHex: String,
    val fallbackHex: String,
    val offHex: String,
    val totalDue: Int,
    val doneCount: Int,
    val percent: Int?,
    val tasks: List<WidgetTaskSummary>,
    val widgetConfigs: List<WidgetConfigEntry>,
) {
    fun config(size: String): WidgetConfigEntry =
        widgetConfigs.firstOrNull { it.size == size } ?: WidgetConfigEntry(size, "smart-next-due", null)

    fun task(config: WidgetConfigEntry): WidgetTaskSummary? =
        if (config.mode == "fixed-task" && config.fixedTaskId != null) {
            tasks.firstOrNull { it.id == config.fixedTaskId } ?: tasks.firstOrNull()
        } else {
            tasks.firstOrNull()
        }

    companion object {
        fun load(context: Context): WidgetSnapshot? {
            val file = File(context.filesDir, SNAPSHOT_FILENAME)
            if (!file.exists()) return null
            return try {
                val root = JSONObject(file.readText())
                val theme = root.getJSONObject("theme")
                val signal = root.getJSONObject("signalColors")
                val today = root.getJSONObject("today")
                val tasksJson = root.getJSONArray("tasks")
                val tasks = (0 until tasksJson.length()).map { i ->
                    val t = tasksJson.getJSONObject(i)
                    WidgetTaskSummary(
                        id = t.getString("id"),
                        name = t.getString("name"),
                        timeOfDay = t.optString("timeOfDay", null),
                        chipState = t.optString("chipState", null),
                    )
                }
                val configsJson = root.getJSONArray("widgetConfigs")
                val configs = (0 until configsJson.length()).map { i ->
                    val c = configsJson.getJSONObject(i)
                    WidgetConfigEntry(
                        size = c.getString("size"),
                        mode = c.getString("mode"),
                        fixedTaskId = c.optString("fixedTaskId", null),
                    )
                }
                WidgetSnapshot(
                    version = root.getInt("version"),
                    generatedAt = root.getString("generatedAt"),
                    accentHex = theme.getString("accentHex"),
                    idealHex = signal.getString("ideal"),
                    fallbackHex = signal.getString("fallback"),
                    offHex = signal.getString("off"),
                    totalDue = today.getInt("totalDue"),
                    doneCount = today.getInt("doneCount"),
                    percent = if (today.isNull("percent")) null else today.getInt("percent"),
                    tasks = tasks,
                    widgetConfigs = configs,
                )
            } catch (_: Exception) {
                // A malformed/partial snapshot (mid-write race) degrades to "no data yet" —
                // never a widget crash.
                null
            }
        }
    }
}
