import Foundation

public struct Candle: Codable, Hashable, Identifiable {
    public let timestamp: Date
    public let open: Double
    public let high: Double
    public let low: Double
    public let close: Double
    public let volume: Double

    public var id: Date { timestamp }

    public init(timestamp: Date, open: Double, high: Double, low: Double, close: Double, volume: Double) {
        self.timestamp = timestamp
        self.open = open
        self.high = high
        self.low = low
        self.close = close
        self.volume = volume
    }
}

public enum Granularity: Int, CaseIterable, Codable {
    case oneMinute = 60
    case fiveMinute = 300
    case fifteenMinute = 900
    case oneHour = 3600
    case sixHour = 21600
    case oneDay = 86400

    public var displayName: String {
        switch self {
        case .oneMinute: return "1m"
        case .fiveMinute: return "5m"
        case .fifteenMinute: return "15m"
        case .oneHour: return "1h"
        case .sixHour: return "6h"
        case .oneDay: return "1d"
        }
    }
}
