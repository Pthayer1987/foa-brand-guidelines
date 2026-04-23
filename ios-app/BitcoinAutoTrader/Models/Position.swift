import Foundation

public struct Position: Codable, Hashable {
    public var quantity: Double
    public var averageEntryPrice: Double

    public static let flat = Position(quantity: 0, averageEntryPrice: 0)

    public var isFlat: Bool { abs(quantity) < 1e-10 }
    public var isLong: Bool { quantity > 1e-10 }

    public func unrealizedPnL(at price: Double) -> Double {
        (price - averageEntryPrice) * quantity
    }

    public mutating func apply(side: TradeSide, price: Double, quantity qty: Double) {
        let signed = side == .buy ? qty : -qty
        let newQty = quantity + signed
        if (quantity >= 0 && newQty >= 0 && signed > 0) || (quantity <= 0 && newQty <= 0 && signed < 0) {
            let totalCost = averageEntryPrice * quantity + price * signed
            averageEntryPrice = newQty == 0 ? 0 : totalCost / newQty
        } else if newQty == 0 || (newQty > 0) != (quantity > 0) {
            averageEntryPrice = price
        }
        quantity = newQty
    }
}
