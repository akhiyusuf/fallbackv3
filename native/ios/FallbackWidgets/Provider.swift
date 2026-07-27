//
//  Provider.swift
//  FallbackWidgets
//
//  M7. A single, near-instant timeline: the snapshot file is small, local, and already
//  written by the time the widget's process wakes up (`WidgetBridge.publishSnapshot()`
//  fires on every relevant app mutation — task change, log, off-day, settings). WidgetKit
//  re-queries the provider on its own OS-governed schedule; there is no push/refresh
//  channel of our own (F14/F21's "local only" constraint applies here too).
//
import WidgetKit

struct FallbackWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct FallbackWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> FallbackWidgetEntry {
        FallbackWidgetEntry(date: Date(), snapshot: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (FallbackWidgetEntry) -> Void) {
        completion(FallbackWidgetEntry(date: Date(), snapshot: WidgetSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FallbackWidgetEntry>) -> Void) {
        let entry = FallbackWidgetEntry(date: Date(), snapshot: WidgetSnapshot.load())
        // Re-check in 15 minutes even without an app-side publish, so a widget left open
        // overnight still rolls its own "today" over (mirrors `useDayRollover`'s intent on
        // the app side, at WidgetKit's own coarser cadence).
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}
