import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var engine: TradingEngine
    @EnvironmentObject var app: AppState

    @State private var trailPercent: Double = 1.5
    @State private var hardStopPercent: Double = 5.0
    @State private var useATR: Bool = false
    @State private var atrMultiplier: Double = 2.0

    @State private var perTradeRisk: Double = 10
    @State private var maxPosition: Double = 50
    @State private var maxDailyLoss: Double = 10
    @State private var minConfidence: Double = 0.05
    @State private var cooldown: Double = 10

    @State private var tickInterval: Double = 2

    var body: some View {
        NavigationStack {
            Form {
                Section("Trailing stop") {
                    Toggle("Use ATR trail", isOn: $useATR)
                    if useATR {
                        Slider(value: $atrMultiplier, in: 0.5...6, step: 0.5) { Text("ATR × \(String(format: "%.1f", atrMultiplier))") }
                    } else {
                        Slider(value: $trailPercent, in: 0.1...10, step: 0.1) { Text("Trail \(String(format: "%.1f", trailPercent))%") }
                    }
                    Slider(value: $hardStopPercent, in: 0.5...20, step: 0.5) { Text("Hard stop \(String(format: "%.1f", hardStopPercent))%") }
                    Button("Apply trailing stop") { applyTrail() }
                }

                Section("Risk") {
                    Slider(value: $perTradeRisk, in: 1...100, step: 1) { Text("Per trade: \(Int(perTradeRisk))%") }
                    Slider(value: $maxPosition, in: 5...100, step: 5) { Text("Max position: \(Int(maxPosition))%") }
                    Slider(value: $maxDailyLoss, in: 1...50, step: 1) { Text("Max daily loss: \(Int(maxDailyLoss))%") }
                    Slider(value: $minConfidence, in: 0...0.5, step: 0.01) { Text("Min confidence: \(String(format: "%.2f", minConfidence))") }
                    Slider(value: $cooldown, in: 0...60, step: 1) { Text("Cooldown: \(Int(cooldown))s") }
                    Button("Apply risk settings") { applyRisk() }
                }

                Section("Engine") {
                    Slider(value: $tickInterval, in: 1...30, step: 1) { Text("Tick interval: \(Int(tickInterval))s") }
                    Button("Apply tick interval") { engine.tickIntervalSeconds = tickInterval; engine.persist() }
                }

                Section("Live API credentials") {
                    if app.hasStoredCredentials {
                        Label("Credentials stored", systemImage: "checkmark.seal.fill").foregroundStyle(.green)
                        Button("Remove credentials", role: .destructive) { app.deleteCredentials() }
                    } else {
                        SecureField("API key", text: $app.apiKey)
                        SecureField("API secret", text: $app.apiSecret)
                        Button("Save to Keychain") { app.saveCredentials() }
                            .disabled(app.apiKey.isEmpty || app.apiSecret.isEmpty)
                    }
                    if app.liveAcknowledged {
                        Button("Revoke live trading acknowledgement", role: .destructive) {
                            app.revokeLive()
                            engine.setMode(.paper)
                        }
                    }
                }

                Section {
                    Text("⚠︎ Automated trading carries substantial risk of loss. This app is provided as-is with no warranty of profitability.")
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Settings")
            .onAppear(perform: loadFromEngine)
        }
    }

    private func loadFromEngine() {
        trailPercent = engine.trail.config.trailPercent * 100
        hardStopPercent = engine.trail.config.hardStopPercent * 100
        useATR = engine.trail.config.useATR
        atrMultiplier = engine.trail.config.atrMultiplier
        perTradeRisk = engine.risk.config.perTradeRiskFraction * 100
        maxPosition = engine.risk.config.maxPositionFraction * 100
        maxDailyLoss = engine.risk.config.maxDailyLossFraction * 100
        minConfidence = engine.risk.config.minConfidence
        cooldown = engine.risk.config.cooldownSeconds
        tickInterval = engine.tickIntervalSeconds
    }

    private func applyTrail() {
        engine.updateTrail(TrailingStopConfig(
            trailPercent: trailPercent / 100,
            useATR: useATR,
            atrMultiplier: atrMultiplier,
            hardStopPercent: hardStopPercent / 100
        ))
    }

    private func applyRisk() {
        engine.updateRisk(RiskConfig(
            perTradeRiskFraction: perTradeRisk / 100,
            maxPositionFraction: maxPosition / 100,
            maxDailyLossFraction: maxDailyLoss / 100,
            minConfidence: minConfidence,
            cooldownSeconds: cooldown
        ))
    }
}
