//
//  Views.swift
//  FallbackWidgets
//
//  M7. Three SwiftUI views, one per S46 gallery entry. All colour comes from the snapshot's
//  own `theme`/`signalColors` fields — nothing here reads a hardcoded hex (the native-side
//  mirror of Rule 1: no raw colour literal outside the design token source of truth, which
//  for the widget process IS this snapshot).
//
import SwiftUI
import WidgetKit

private extension Color {
    /// `"#RRGGBB"` -> `Color`. The snapshot only ever contains the app's own token hexes.
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        s.removeAll { $0 == "#" }
        var value: UInt64 = 0
        Scanner(string: s).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

/// "Small · Today" — S46's first gallery entry: a ring + "n/m done" fraction.
struct SmallTodayWidgetView: View {
    let entry: FallbackWidgetEntry

    var body: some View {
        guard let snapshot = entry.snapshot else { return AnyView(Text("—")) }
        let accent = Color(hex: snapshot.theme.accentHex)
        let percent = Double(snapshot.today.percent ?? 0) / 100
        return AnyView(
            VStack(spacing: 4) {
                ZStack {
                    Circle().stroke(Color.gray.opacity(0.2), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: snapshot.today.totalDue > 0 ? percent : 0)
                        .stroke(accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 44, height: 44)
                Text("\(snapshot.today.doneCount)/\(snapshot.today.totalDue) done")
                    .font(.caption2)
            }
            .padding()
        )
    }
}

/// "Small · One task" — a single task name + its StateChip-equivalent glyph, in the FIXED
/// signal colour (never the accent — the same accent-invariance rule S43 proves in-app).
struct SmallOneTaskWidgetView: View {
    let entry: FallbackWidgetEntry

    var body: some View {
        guard let snapshot = entry.snapshot else { return AnyView(Text("—")) }
        let config = snapshot.config(for: "small-one-task")
        let task = snapshot.task(for: config)
        let signalHex: String
        switch task?.chipState {
        case "done": signalHex = snapshot.signalColors.ideal
        case "fallback": signalHex = snapshot.signalColors.fallback
        case "skip": signalHex = snapshot.signalColors.off
        default: signalHex = snapshot.signalColors.off
        }
        return AnyView(
            VStack(alignment: .leading, spacing: 4) {
                Circle().fill(Color(hex: signalHex)).frame(width: 16, height: 16)
                Text(task?.name ?? "No task due")
                    .font(.footnote.bold())
                    .lineLimit(2)
            }
            .padding()
        )
    }
}

/// "Medium · Up next" — the next two due tasks with their times.
struct MediumUpNextWidgetView: View {
    let entry: FallbackWidgetEntry

    var body: some View {
        guard let snapshot = entry.snapshot else { return AnyView(Text("—")) }
        return AnyView(
            VStack(alignment: .leading, spacing: 6) {
                Text("Up next").font(.caption).foregroundColor(.secondary)
                ForEach(snapshot.tasks.prefix(2), id: \.id) { task in
                    HStack {
                        Text(task.name).font(.footnote.bold()).lineLimit(1)
                        Spacer()
                        if let time = task.timeOfDay { Text(time).font(.caption2) }
                    }
                }
            }
            .padding()
        )
    }
}
