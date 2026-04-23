import Foundation

public struct Account: Codable {
    public var cash: Double
    public var position: Position

    public static let defaultPaper = Account(cash: 10_000, position: .flat)

    public func equity(at price: Double) -> Double {
        cash + position.quantity * price
    }
}
