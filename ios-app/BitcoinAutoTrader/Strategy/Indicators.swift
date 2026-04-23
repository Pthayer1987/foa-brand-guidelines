import Foundation

public enum Indicators {

    public static func sma(_ values: [Double], period: Int) -> [Double?] {
        guard period > 0 else { return values.map { _ in nil } }
        var out: [Double?] = Array(repeating: nil, count: values.count)
        guard values.count >= period else { return out }
        var sum = values.prefix(period).reduce(0, +)
        out[period - 1] = sum / Double(period)
        for i in period..<values.count {
            sum += values[i] - values[i - period]
            out[i] = sum / Double(period)
        }
        return out
    }

    public static func ema(_ values: [Double], period: Int) -> [Double?] {
        guard period > 0, !values.isEmpty else { return values.map { _ in nil } }
        var out: [Double?] = Array(repeating: nil, count: values.count)
        let k = 2.0 / Double(period + 1)
        var prev: Double?
        for i in values.indices {
            if let p = prev {
                let e = values[i] * k + p * (1 - k)
                out[i] = e
                prev = e
            } else if i >= period - 1 {
                let seed = values[(i - period + 1)...i].reduce(0, +) / Double(period)
                out[i] = seed
                prev = seed
            }
        }
        return out
    }

    public static func rsi(_ closes: [Double], period: Int = 14) -> [Double?] {
        var out: [Double?] = Array(repeating: nil, count: closes.count)
        guard closes.count > period else { return out }
        var gains = 0.0, losses = 0.0
        for i in 1...period {
            let d = closes[i] - closes[i - 1]
            if d > 0 { gains += d } else { losses -= d }
        }
        var avgGain = gains / Double(period)
        var avgLoss = losses / Double(period)
        out[period] = rsiValue(avgGain, avgLoss)
        for i in (period + 1)..<closes.count {
            let d = closes[i] - closes[i - 1]
            let g = max(d, 0)
            let l = max(-d, 0)
            avgGain = (avgGain * Double(period - 1) + g) / Double(period)
            avgLoss = (avgLoss * Double(period - 1) + l) / Double(period)
            out[i] = rsiValue(avgGain, avgLoss)
        }
        return out
    }

    private static func rsiValue(_ gain: Double, _ loss: Double) -> Double {
        if loss == 0 { return 100 }
        let rs = gain / loss
        return 100 - (100 / (1 + rs))
    }

    public static func atr(_ candles: [Candle], period: Int = 14) -> [Double?] {
        var tr: [Double] = []
        for (i, c) in candles.enumerated() {
            if i == 0 {
                tr.append(c.high - c.low)
            } else {
                let prev = candles[i - 1].close
                tr.append(max(c.high - c.low, max(abs(c.high - prev), abs(c.low - prev))))
            }
        }
        return sma(tr, period: period)
    }

    public static func returns(_ closes: [Double], lookback: Int) -> [Double?] {
        var out: [Double?] = Array(repeating: nil, count: closes.count)
        guard lookback > 0, closes.count > lookback else { return out }
        for i in lookback..<closes.count {
            let prev = closes[i - lookback]
            guard prev > 0 else { continue }
            out[i] = (closes[i] / prev) - 1
        }
        return out
    }

    public static func zscore(_ values: [Double], period: Int) -> [Double?] {
        var out: [Double?] = Array(repeating: nil, count: values.count)
        guard period > 1, values.count >= period else { return out }
        for i in (period - 1)..<values.count {
            let window = values[(i - period + 1)...i]
            let mean = window.reduce(0, +) / Double(period)
            let variance = window.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(period)
            let sd = sqrt(variance)
            out[i] = sd > 0 ? (values[i] - mean) / sd : 0
        }
        return out
    }
}
