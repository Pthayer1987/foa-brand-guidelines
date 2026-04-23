import SwiftUI
import Charts

struct BacktestView: View {
    @EnvironmentObject var engine: TradingEngine
    @State private var days: Int = 30
    @State private var granularity: Granularity = .oneHour
    @State private var epochs: Int = 3
    @State private var isRunning = false
    @State private var result: BacktestResult?
    @State private var errorText: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Training window") {
                    Stepper("Days: \(days)", value: $days, in: 1...180)
                    Picker("Granularity", selection: $granularity) {
                        ForEach(Granularity.allCases, id: \.self) { g in
                            Text(g.displayName).tag(g)
                        }
                    }
                    Stepper("Training epochs: \(epochs)", value: $epochs, in: 1...20)
                }
                Section {
                    Button(isRunning ? "Running…" : "Run backtest & train") {
                        runBacktest()
                    }
                    .disabled(isRunning)
                    .frame(maxWidth: .infinity)
                    if let e = errorText {
                        Text(e).font(.caption).foregroundStyle(.red)
                    }
                }
                if let r = result {
                    Section("Results") {
                        row("Starting equity", String(format: "$%.2f", r.startingEquity))
                        row("Ending equity", String(format: "$%.2f", r.endingEquity))
                        row("Total return", String(format: "%.2f%%", r.totalReturn * 100))
                        row("Annualized", String(format: "%.2f%%", r.annualizedReturn * 100))
                        row("Sharpe", String(format: "%.2f", r.sharpe))
                        row("Max drawdown", String(format: "%.2f%%", r.maxDrawdown * 100))
                        row("Trades", "\(r.numTrades)")
                        row("Win rate", String(format: "%.1f%%", r.winRate * 100))
                        row("Samples trained", "\(r.sampleCount)")
                    }
                    Section("Equity curve") {
                        Chart(Array(r.equityCurve.enumerated()), id: \.offset) { i, v in
                            LineMark(x: .value("Step", i), y: .value("Equity", v))
                        }
                        .frame(height: 180)
                    }
                    Section {
                        Button("Apply trained model to live engine") {
                            engine.applyBacktestResult(r)
                        }
                    }
                }
            }
            .navigationTitle("Backtest & train")
        }
    }

    private func row(_ k: String, _ v: String) -> some View {
        HStack { Text(k); Spacer(); Text(v).font(.body.monospaced()).foregroundStyle(.secondary) }
    }

    private func runBacktest() {
        isRunning = true
        errorText = nil
        let productId = engine.productId
        let gran = granularity
        let d = days
        let ep = epochs
        let sources = engine.learner.subSources
        let currentState = engine.learner.snapshot()
        Task {
            do {
                let api = CoinbasePublicAPI.shared
                let end = Date()
                let start = end.addingTimeInterval(-Double(d) * 86400)
                var all: [Candle] = []
                var cursor = start
                let windowSeconds = Double(gran.rawValue) * 300
                while cursor < end {
                    let chunkEnd = min(cursor.addingTimeInterval(windowSeconds), end)
                    let chunk = try await api.historicalCandles(
                        productId: productId, granularity: gran, start: cursor, end: chunkEnd
                    )
                    all.append(contentsOf: chunk)
                    cursor = chunkEnd
                    try await Task.sleep(nanoseconds: 200_000_000)
                }
                var deduped: [Date: Candle] = [:]
                for c in all { deduped[c.timestamp] = c }
                let candles = deduped.values.sorted { $0.timestamp < $1.timestamp }

                let r = await Task.detached(priority: .userInitiated) {
                    let learner = OnlineLearner(sources: sources, state: currentState)
                    var cfg = BacktestConfig.default
                    cfg.trainingEpochs = ep
                    let bt = Backtester(config: cfg)
                    return bt.run(candles: candles, learner: learner)
                }.value

                self.result = r
                self.isRunning = false
            } catch {
                self.errorText = error.localizedDescription
                self.isRunning = false
            }
        }
    }
}
