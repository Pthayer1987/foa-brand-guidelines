import SwiftUI

struct TradesView: View {
    @EnvironmentObject var engine: TradingEngine

    var body: some View {
        NavigationStack {
            List(engine.trades.reversed()) { t in
                HStack {
                    VStack(alignment: .leading) {
                        HStack {
                            Text(t.side.rawValue.uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(t.side == .buy ? Color.green : Color.orange)
                            Text(t.mode.displayName.uppercased())
                                .font(.caption2)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(t.mode == .live ? Color.red.opacity(0.1) : Color.blue.opacity(0.1))
                                .clipShape(Capsule())
                        }
                        Text(t.reason).font(.caption).foregroundStyle(.secondary)
                        Text(t.timestamp.formatted(date: .abbreviated, time: .standard))
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(String(format: "$%.2f", t.price)).font(.body.monospaced())
                        Text(String(format: "%.6f BTC", t.quantity)).font(.caption.monospaced()).foregroundStyle(.secondary)
                        Text(String(format: "fee $%.2f", t.fee)).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            .overlay {
                if engine.trades.isEmpty {
                    ContentUnavailableView("No trades yet", systemImage: "tray",
                        description: Text("Start the engine in paper mode to see simulated fills here."))
                }
            }
            .navigationTitle("Trades")
        }
    }
}
