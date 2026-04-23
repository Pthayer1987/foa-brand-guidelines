import Foundation

public struct TrailingStopConfig: Codable {
    public var trailPercent: Double
    public var useATR: Bool
    public var atrMultiplier: Double
    public var hardStopPercent: Double

    public static let `default` = TrailingStopConfig(
        trailPercent: 0.015,
        useATR: false,
        atrMultiplier: 2.0,
        hardStopPercent: 0.05
    )
}

public struct TrailingStopState: Codable {
    public var entryPrice: Double
    public var peakPrice: Double
    public var currentStop: Double
    public var atEntryATR: Double?
}

public final class TrailingStopManager {
    public private(set) var config: TrailingStopConfig
    public private(set) var active: TrailingStopState?

    public init(config: TrailingStopConfig = .default) {
        self.config = config
    }

    public func updateConfig(_ cfg: TrailingStopConfig) {
        config = cfg
    }

    public func armOnEntry(price: Double, atr: Double?) {
        let stop: Double
        if config.useATR, let a = atr, a > 0 {
            stop = price - a * config.atrMultiplier
        } else {
            stop = price * (1 - config.trailPercent)
        }
        let hardStop = price * (1 - config.hardStopPercent)
        active = TrailingStopState(
            entryPrice: price,
            peakPrice: price,
            currentStop: max(stop, hardStop),
            atEntryATR: atr
        )
    }

    public func disarm() { active = nil }

    /// Returns true if the position should be exited due to trailing or hard stop being hit.
    public func onTick(price: Double, atr: Double?) -> Bool {
        guard var s = active else { return false }
        if price > s.peakPrice {
            s.peakPrice = price
            let trailed: Double
            if config.useATR, let a = atr ?? s.atEntryATR, a > 0 {
                trailed = price - a * config.atrMultiplier
            } else {
                trailed = price * (1 - config.trailPercent)
            }
            s.currentStop = max(s.currentStop, trailed)
            active = s
        }
        if price <= s.currentStop { return true }
        if price <= s.entryPrice * (1 - config.hardStopPercent) { return true }
        return false
    }

    public var currentStop: Double? { active?.currentStop }
    public var peakPrice: Double? { active?.peakPrice }
}
