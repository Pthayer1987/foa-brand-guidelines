import Foundation

public final class LiveBroker: Broker {
    public let mode: TradingMode = .live
    public let productId: String
    public let quoteCurrency: String
    public let baseCurrency: String
    public let client: CoinbaseAdvancedTradeClient

    public init(client: CoinbaseAdvancedTradeClient, productId: String = "BTC-USD") {
        self.client = client
        self.productId = productId
        let parts = productId.split(separator: "-")
        self.baseCurrency = parts.first.map(String.init) ?? "BTC"
        self.quoteCurrency = parts.last.map(String.init) ?? "USD"
    }

    public func currentPrice() async throws -> Double {
        try await CoinbasePublicAPI.shared.spotPrice(productId: productId)
    }

    public func placeMarketOrder(_ req: OrderRequest) async throws -> Fill {
        let placed = try await client.placeMarketOrder(productId: productId, side: req.side, baseSize: req.quantity)
        return Fill(
            price: placed.averageFilledPrice,
            quantity: placed.filledSize,
            fee: placed.totalFees,
            timestamp: Date()
        )
    }

    public func account() async throws -> Account {
        let balances = try await client.accounts()
        let cash = balances.first { $0.currency == quoteCurrency }?.available ?? 0
        let base = balances.first { $0.currency == baseCurrency }?.available ?? 0
        let price = (try? await currentPrice()) ?? 0
        return Account(
            cash: cash,
            position: Position(quantity: base, averageEntryPrice: price)
        )
    }
}
