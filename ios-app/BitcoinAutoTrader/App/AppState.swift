import Foundation
import Combine

@MainActor
public final class AppState: ObservableObject {
    @Published public var liveAcknowledged: Bool
    @Published public var apiKey: String = ""
    @Published public var apiSecret: String = ""
    @Published public var hasStoredCredentials: Bool

    public init() {
        let s = Storage.shared.load()
        self.liveAcknowledged = s.liveTradingAcknowledged
        self.hasStoredCredentials = KeychainHelper.shared.loadCredentials() != nil
    }

    public func acknowledgeLive() {
        liveAcknowledged = true
        var s = Storage.shared.load()
        s.liveTradingAcknowledged = true
        Storage.shared.save(s)
    }

    public func revokeLive() {
        liveAcknowledged = false
        var s = Storage.shared.load()
        s.liveTradingAcknowledged = false
        Storage.shared.save(s)
    }

    public func saveCredentials() {
        let trimKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimSecret = apiSecret.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimKey.isEmpty, !trimSecret.isEmpty else { return }
        let creds = CoinbaseCredentials(apiKey: trimKey, apiSecret: trimSecret)
        KeychainHelper.shared.saveCredentials(creds)
        hasStoredCredentials = true
        apiKey = ""
        apiSecret = ""
    }

    public func deleteCredentials() {
        KeychainHelper.shared.deleteCredentials()
        hasStoredCredentials = false
    }

    public func buildLiveBroker(productId: String) -> LiveBroker? {
        guard let creds = KeychainHelper.shared.loadCredentials() else { return nil }
        return LiveBroker(client: CoinbaseAdvancedTradeClient(credentials: creds), productId: productId)
    }
}
