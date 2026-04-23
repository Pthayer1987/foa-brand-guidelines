import SwiftUI
import Charts

struct DashboardView: View {
    @EnvironmentObject var engine: TradingEngine
    @EnvironmentObject var app: AppState
    @State private var showLiveGate = false
    @State private var pendingMode: TradingMode = .paper

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    modeBanner
                    priceCard
                    equityCard
                    signalCard
                    trailCard
                    controls
                    chart
                    if let err = engine.lastError {
                        Text(err).font(.caption).foregroundStyle(.red).frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding()
            }
            .navigationTitle("Bitcoin Auto Trader")
            .sheet(isPresented: $showLiveGate) {
                LiveTradingGateView(onConfirm: activateLive)
            }
        }
    }

    private var modeBanner: some View {
        HStack {
            Circle()
                .fill(engine.status == .running ? Color.green : Color.gray)
                .frame(width: 10, height: 10)
            Text(engine.status == .running ? "Running" : "Stopped")
                .font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(engine.currentMode == .live ? "LIVE" : "PAPER")
                .font(.caption).bold()
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(engine.currentMode == .live ? Color.red.opacity(0.15) : Color.blue.opacity(0.15))
                .foregroundStyle(engine.currentMode == .live ? Color.red : Color.blue)
                .clipShape(Capsule())
        }
    }

    private var priceCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("BTC-USD").font(.caption).foregroundStyle(.secondary)
            Text(engine.latestPrice > 0 ? formatted(engine.latestPrice) : "—")
                .font(.system(size: 34, weight: .bold, design: .rounded))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var equityCard: some View {
        let equity = engine.account.equity(at: engine.latestPrice)
        return HStack(spacing: 12) {
            stat(label: "Equity", value: formatted(equity))
            stat(label: "Cash", value: formatted(engine.account.cash))
            stat(label: "BTC", value: String(format: "%.6f", engine.account.position.quantity))
        }
    }

    private var signalCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Signal").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text(engine.lastSignal.action.rawValue)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(color(for: engine.lastSignal.action).opacity(0.2))
                    .foregroundStyle(color(for: engine.lastSignal.action))
                    .clipShape(Capsule())
            }
            Text(engine.lastSignal.reason).font(.footnote).foregroundStyle(.secondary)
            ProgressView(value: max(0, min(1, abs(engine.lastSignal.confidence))))
                .tint(color(for: engine.lastSignal.action))
            Text("Confidence: \(String(format: "%.2f", engine.lastSignal.confidence))")
                .font(.caption2).foregroundStyle(.secondary)
            Text("Samples learned: \(engine.learner.state.samplesSeen)")
                .font(.caption2).foregroundStyle(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var trailCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Trailing stop").font(.caption).foregroundStyle(.secondary)
            if engine.account.position.isFlat {
                Text("No open position").font(.footnote).foregroundStyle(.secondary)
            } else {
                HStack {
                    Text("Peak: \(engine.peakPrice.map(formatted) ?? "—")")
                    Spacer()
                    Text("Stop: \(engine.currentStop.map(formatted) ?? "—")")
                }
                .font(.footnote)
                Text("Trail \(String(format: "%.2f", engine.trail.config.trailPercent * 100))% · Hard \(String(format: "%.2f", engine.trail.config.hardStopPercent * 100))%")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var controls: some View {
        VStack(spacing: 12) {
            Toggle(isOn: Binding(
                get: { engine.currentMode == .paper },
                set: { on in
                    if on {
                        engine.setMode(.paper)
                    } else {
                        pendingMode = .live
                        showLiveGate = true
                    }
                }
            )) {
                Label("Paper trading", systemImage: "doc.text")
            }
            Toggle(isOn: Binding(
                get: { engine.currentMode == .live },
                set: { on in
                    if on {
                        pendingMode = .live
                        showLiveGate = true
                    } else {
                        engine.setMode(.paper)
                    }
                }
            )) {
                Label("Live trading (real money)", systemImage: "dollarsign.circle")
                    .foregroundStyle(.red)
            }
            HStack {
                Button(engine.status == .running ? "Stop" : "Start") {
                    engine.status == .running ? engine.stop() : engine.start()
                }
                .buttonStyle(.borderedProminent)
                .tint(engine.status == .running ? .red : .green)
                Spacer()
                Button("Reset paper") {
                    engine.resetPaper(cash: 10_000)
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var chart: some View {
        Group {
            if engine.recentCandles.isEmpty {
                Text("Loading chart…").font(.caption).foregroundStyle(.secondary)
            } else {
                Chart(engine.recentCandles) { candle in
                    LineMark(
                        x: .value("Time", candle.timestamp),
                        y: .value("Price", candle.close)
                    )
                    .foregroundStyle(Color.accentColor)
                }
                .frame(height: 180)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func activateLive() {
        guard let broker = app.buildLiveBroker(productId: engine.productId) else {
            engine.setMode(.paper)
            return
        }
        engine.setMode(.live, liveBroker: broker)
    }

    private func stat(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func color(for action: SignalAction) -> Color {
        switch action {
        case .enterLong: return .green
        case .exitLong: return .orange
        case .hold: return .gray
        }
    }

    private func formatted(_ v: Double) -> String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .currency
        fmt.currencyCode = "USD"
        fmt.maximumFractionDigits = 2
        return fmt.string(from: NSNumber(value: v)) ?? String(format: "$%.2f", v)
    }
}
