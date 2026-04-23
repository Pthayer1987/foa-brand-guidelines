import Foundation

public final class PaperBroker: Broker, @unchecked Sendable {
    public let mode: TradingMode = .paper
    public var feeRate: Double
    public var slippageBps: Double
    public private(set) var accountSnapshot: Account
    private let lock = NSLock()
    private var _markPrice: Double = 0

    public init(startingCash: Double = 10_000, feeRate: Double = 0.0006, slippageBps: Double = 3) {
        self.accountSnapshot = Account(cash: startingCash, position: .flat)
        self.feeRate = feeRate
        self.slippageBps = slippageBps
    }

    public func reset(startingCash: Double) {
        accountSnapshot = Account(cash: startingCash, position: .flat)
    }

    public var latestMarkPrice: Double {
        get { lock.lock(); defer { lock.unlock() }; return _markPrice }
        set { lock.lock(); _markPrice = newValue; lock.unlock() }
    }

    public func currentPrice() async throws -> Double {
        let p = latestMarkPrice
        if p > 0 { return p }
        return try await CoinbasePublicAPI.shared.spotPrice()
    }

    public func placeMarketOrder(_ req: OrderRequest) async throws -> Fill {
        let mid = try await currentPrice()
        let slippage = mid * slippageBps / 10_000
        let fill = req.side == .buy ? mid + slippage : mid - slippage
        let notional = fill * req.quantity
        let fee = abs(notional) * feeRate
        lock.lock()
        var acct = accountSnapshot
        switch req.side {
        case .buy:
            acct.cash -= notional + fee
            acct.position.apply(side: .buy, price: fill, quantity: req.quantity)
        case .sell:
            acct.cash += notional - fee
            acct.position.apply(side: .sell, price: fill, quantity: req.quantity)
        }
        accountSnapshot = acct
        lock.unlock()
        return Fill(price: fill, quantity: req.quantity, fee: fee, timestamp: Date())
    }

    public func account() async throws -> Account { accountSnapshot }
}
