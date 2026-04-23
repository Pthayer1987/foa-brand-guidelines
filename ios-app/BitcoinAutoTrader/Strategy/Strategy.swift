import Foundation

public enum SignalAction: String, Codable {
    case enterLong
    case exitLong
    case hold
}

public struct StrategySignal: Codable {
    public let action: SignalAction
    public let confidence: Double
    public let reason: String
    public let features: [String: Double]

    public init(action: SignalAction, confidence: Double, reason: String, features: [String: Double]) {
        self.action = action
        self.confidence = confidence
        self.reason = reason
        self.features = features
    }

    public static let hold = StrategySignal(action: .hold, confidence: 0, reason: "warmup", features: [:])
}

public protocol SubSignalSource: Sendable {
    var name: String { get }
    func compute(candles: [Candle], index: Int) -> Double?
}

public struct MovingAverageCross: SubSignalSource {
    public let name = "ma_cross"
    public let fast: Int
    public let slow: Int
    public init(fast: Int = 9, slow: Int = 21) { self.fast = fast; self.slow = slow }

    public func compute(candles: [Candle], index: Int) -> Double? {
        guard index >= slow else { return nil }
        let closes = candles.map(\.close)
        let ef = Indicators.ema(closes, period: fast)
        let es = Indicators.ema(closes, period: slow)
        guard let f = ef[index], let s = es[index], s > 0 else { return nil }
        return max(-1, min(1, (f - s) / s * 100))
    }
}

public struct RSIReversion: SubSignalSource {
    public let name = "rsi_reversion"
    public let period: Int
    public init(period: Int = 14) { self.period = period }

    public func compute(candles: [Candle], index: Int) -> Double? {
        guard index >= period else { return nil }
        let closes = candles.map(\.close)
        guard let r = Indicators.rsi(closes, period: period)[index] else { return nil }
        return (50 - r) / 50
    }
}

public struct MomentumLookback: SubSignalSource {
    public let name: String
    public let lookback: Int
    public init(lookback: Int) { self.lookback = lookback; self.name = "momentum_\(lookback)" }

    public func compute(candles: [Candle], index: Int) -> Double? {
        guard index >= lookback else { return nil }
        let closes = candles.map(\.close)
        guard let r = Indicators.returns(closes, lookback: lookback)[index] else { return nil }
        return max(-1, min(1, r * 20))
    }
}

public struct VolatilityBreakout: SubSignalSource {
    public let name = "vol_breakout"
    public let period: Int
    public init(period: Int = 20) { self.period = period }

    public func compute(candles: [Candle], index: Int) -> Double? {
        guard index >= period else { return nil }
        let closes = candles.map(\.close)
        guard let z = Indicators.zscore(closes, period: period)[index] else { return nil }
        return max(-1, min(1, z / 2))
    }
}
