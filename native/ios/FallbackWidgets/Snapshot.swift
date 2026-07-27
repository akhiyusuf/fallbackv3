//
//  Snapshot.swift
//  FallbackWidgets
//
//  M7. Decodes the JSON snapshot `src/services/widgets/index.ts` writes into the
//  `group.com.fallback.app` App Group container (see `Paths.appleSharedContainers` in
//  that file). This is the WIDGET'S ONLY DATA SOURCE — it never opens the app's SQLite
//  database (MODULES.md M7's non-negotiable), and every field here is already fully
//  resolved (display strings, hex colours) by the JS side, so this file contains no
//  business logic of its own — just decoding + rendering.
//
import Foundation

struct WidgetSnapshot: Codable {
    struct Theme: Codable {
        let scheme: String   // "light" | "dark"
        let accent: String   // AccentKey
        let accentHex: String
    }

    struct SignalColors: Codable {
        let ideal: String
        let fallback: String
        let off: String
        // Deliberately no `missed` field — missed has no fill colour anywhere in the app
        // (Rule 4 / ARCHITECTURE §5), and the JS-side snapshot never sends one.
    }

    struct Today: Codable {
        let totalDue: Int
        let doneCount: Int
        let percent: Int?
    }

    struct TaskSummary: Codable {
        let id: String
        let name: String
        let timeOfDay: String?
        let chipState: String?  // "todo" | "done" | "fallback" | "skip" | null
    }

    struct WidgetConfigEntry: Codable {
        let size: String        // "small-today" | "small-one-task" | "medium-up-next"
        let mode: String        // "fixed-task" | "smart-next-due"
        let fixedTaskId: String?
    }

    let version: Int
    let generatedAt: String
    let theme: Theme
    let signalColors: SignalColors
    let today: Today
    let tasks: [TaskSummary]
    let widgetConfigs: [WidgetConfigEntry]

    /// The shared-container file the JS side writes. Matches `SNAPSHOT_FILENAME` /
    /// `APP_GROUP_ID` in `src/services/widgets/index.ts` exactly — if either changes there,
    /// this constant must change too.
    static let appGroupId = "group.com.fallback.app"
    static let filename = "fallback-widget-snapshot.json"

    static func load() -> WidgetSnapshot? {
        guard
            let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId),
            let data = try? Data(contentsOf: containerURL.appendingPathComponent(filename))
        else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    /// Which task a given widget config should surface: the fixed pick if set and still due
    /// today, else the first due task ("smart — next due" — S46's own definition, "whichever
    /// task is due soonest," approximated here as "first in the resolved due-today list,"
    /// since ordering by literal due time is display-only formatting the JS side already
    /// applies to `tasks` before writing the snapshot).
    func task(for config: WidgetConfigEntry) -> TaskSummary? {
        if config.mode == "fixed-task", let fixedId = config.fixedTaskId {
            return tasks.first(where: { $0.id == fixedId }) ?? tasks.first
        }
        return tasks.first
    }

    func config(for size: String) -> WidgetConfigEntry {
        widgetConfigs.first(where: { $0.size == size })
            ?? WidgetConfigEntry(size: size, mode: "smart-next-due", fixedTaskId: nil)
    }
}
