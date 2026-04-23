import Foundation

public struct RiskConfig: Codable {
    public var perTradeRiskFraction: Double
    public var maxPositionFraction: Double
    public var maxDailyLossFraction: Double
    public var minConfidence: Double
    public var cooldownSeconds: TimeInterval

    public static let `default` = RiskConfig(
        perTradeRiskFraction: 0.10,
        maxPositionFraction: 0.50,
        maxDailyLossFraction: 0.10,
        minConfidence: 0.05,
        cooldownSeconds: 10
    )
}

public final class RiskManager {
    public private(set) var config: RiskConfig
    private(set) var lastTradeAt: Date = .distantPast
    private(set) var sessionStartEquity: Double = 0
    private(set) var dayStart: Date = Date()

    public init(config: RiskConfig = .default) {
        self.config = config
    }

    public func updateConfig(_ c: RiskConfig) { config = c }

    public func resetSession(equity: Double) {
        sessionStartEquity = equity
        dayStart = Date()
        lastTradeAt = .distantPast
    }

    public func positionSize(cash: Double, price: Double, confidence: Double) -> Double {
        guard price > 0 else { return 0 }
        let scaled = max(0, min(1, abs(confidence)))
        let budget = cash * config.perTradeRiskFraction * scaled
        let maxBudget = cash * config.maxPositionFraction
        let notional = min(budget, maxBudget)
        return (notional / price).rounded(toPlaces: 8)
    }

    public func canTrade(equity: Double, confidence: Double, now: Date = Date()) -> (Bool, String?) {
        if sessionStartEquity > 0 {
            let dd = (sessionStartEquity - equity) / sessionStartEquity
            if dd >= config.maxDailyLossFraction {
                return (false, "daily loss limit hit (\(String(format: "%.1f", dd * 100))%)")
            }
        }
        if abs(confidence) < config.minConfidence {
            return (false, "confidence below min")
        }
        if now.timeIntervalSince(lastTradeAt) < config.cooldownSeconds {
            return (false, "cooldown active")
        }
        return (true, nil)
    }

    public func recordTrade(at date: Date = Date()) {
        lastTradeAt = date
    }
}

extension Double {
    func rounded(toPlaces places: Int) -> Double {
        let m = pow(10.0, Double(places))
        return (self * m).rounded() / m
    }
}
