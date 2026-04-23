import Foundation

public enum TradingMode: String, Codable, CaseIterable, Identifiable {
    case paper
    case live

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .paper: return "Paper"
        case .live: return "Live"
        }
    }
}

public enum EngineStatus: String, Codable {
    case stopped
    case running
    case error
}
