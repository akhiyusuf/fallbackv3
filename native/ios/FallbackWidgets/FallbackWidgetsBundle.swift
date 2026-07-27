//
//  FallbackWidgetsBundle.swift
//  FallbackWidgets
//
//  M7. The WidgetKit extension entry point — one bundle, three `Widget` kinds, one per S46
//  gallery entry. Registered as an `app_extension` target by `plugins/withFallbackWidgets.js`.
//
import SwiftUI
import WidgetKit

struct SmallTodayWidget: Widget {
    let kind: String = "FallbackSmallToday"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FallbackWidgetProvider()) { entry in
            SmallTodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("How many of today's habits you've shown up for.")
        .supportedFamilies([.systemSmall])
    }
}

struct SmallOneTaskWidget: Widget {
    let kind: String = "FallbackSmallOneTask"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FallbackWidgetProvider()) { entry in
            SmallOneTaskWidgetView(entry: entry)
        }
        .configurationDisplayName("One task")
        .description("A single habit and its state.")
        .supportedFamilies([.systemSmall])
    }
}

struct MediumUpNextWidget: Widget {
    let kind: String = "FallbackMediumUpNext"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FallbackWidgetProvider()) { entry in
            MediumUpNextWidgetView(entry: entry)
        }
        .configurationDisplayName("Up next")
        .description("Your next two habits.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct FallbackWidgetsBundle: WidgetBundle {
    var body: some Widget {
        SmallTodayWidget()
        SmallOneTaskWidget()
        MediumUpNextWidget()
    }
}
