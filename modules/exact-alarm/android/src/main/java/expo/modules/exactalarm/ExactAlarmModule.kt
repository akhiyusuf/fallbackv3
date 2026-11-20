package expo.modules.exactalarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android 12+ asks the person before an app may ring alarms at an exact minute (Android 14 turns
 * it off by default). expo-notifications already uses exact alarms when allowed and falls back to
 * inexact ones (which can be minutes late) when not; this module only reports which, and opens the
 * system page where the person can allow it.
 */
class ExactAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExactAlarm")

    Function("canScheduleExactAlarms") {
      val context = appContext.reactContext
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || context == null) {
        true
      } else {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarms.canScheduleExactAlarms()
      }
    }

    Function("openExactAlarmSettings") {
      val context = appContext.reactContext
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || context == null) {
        false
      } else {
        val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
          true
        } catch (e: Exception) {
          false
        }
      }
    }
  }
}
