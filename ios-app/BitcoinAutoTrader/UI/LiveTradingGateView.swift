import SwiftUI

struct LiveTradingGateView: View {
    @EnvironmentObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    let onConfirm: () -> Void

    @State private var typedAcknowledgement = ""
    private let requiredPhrase = "I ACCEPT THE RISK"

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label("Live trading uses real money", systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                    Text("Automated trading can lose 100% of your capital. Past backtest performance does not predict future returns. The model can and will be wrong. You are solely responsible for any orders this app places on your exchange account.")
                        .font(.footnote)
                }
                Section("API credentials") {
                    if app.hasStoredCredentials {
                        Label("Coinbase credentials stored in Keychain", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                        Button("Remove credentials", role: .destructive) {
                            app.deleteCredentials()
                        }
                    } else {
                        SecureField("API key", text: $app.apiKey)
                        SecureField("API secret", text: $app.apiSecret)
                        Button("Save to Keychain") { app.saveCredentials() }
                            .disabled(app.apiKey.isEmpty || app.apiSecret.isEmpty)
                    }
                }
                Section("Acknowledge") {
                    Text("Type the phrase below to enable live trading:")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text(requiredPhrase).font(.footnote.monospaced()).bold()
                    TextField("Type here", text: $typedAcknowledgement)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                }
                Section {
                    Button("Enable live trading") {
                        app.acknowledgeLive()
                        onConfirm()
                        dismiss()
                    }
                    .disabled(!canEnable)
                    .frame(maxWidth: .infinity)
                    .foregroundStyle(.red)
                }
            }
            .navigationTitle("Enable live trading")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var canEnable: Bool {
        app.hasStoredCredentials && typedAcknowledgement.trimmingCharacters(in: .whitespaces) == requiredPhrase
    }
}
