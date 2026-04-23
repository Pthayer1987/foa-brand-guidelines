import Foundation

public struct OrderRequest {
    public let side: TradeSide
    public let quantity: Double
    public let reason: String
}

public struct Fill {
    public let price: Double
    public let quantity: Double
    public let fee: Double
    public let timestamp: Date
}

public protocol Broker {
    var mode: TradingMode { get }
    func currentPrice() async throws -> Double
    func placeMarketOrder(_ req: OrderRequest) async throws -> Fill
    func account() async throws -> Account
}
