import Foundation

public enum TradeSide: String, Codable { case buy, sell }

public struct Trade: Codable, Hashable, Identifiable {
    public let id: UUID
    public let timestamp: Date
    public let side: TradeSide
    public let price: Double
    public let quantity: Double
    public let fee: Double
    public let mode: TradingMode
    public let reason: String

    public var notional: Double { price * quantity }

    public init(id: UUID = UUID(), timestamp: Date, side: TradeSide, price: Double, quantity: Double, fee: Double, mode: TradingMode, reason: String) {
        self.id = id
        self.timestamp = timestamp
        self.side = side
        self.price = price
        self.quantity = quantity
        self.fee = fee
        self.mode = mode
        self.reason = reason
    }
}
