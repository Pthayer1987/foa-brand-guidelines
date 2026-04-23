import Foundation

public struct PersistedState: Codable {
    public var learner: LearnerState
    public var trades: [Trade]
    public var riskConfig: RiskConfig
    public var trailingConfig: TrailingStopConfig
    public var paperCash: Double
    public var productId: String
    public var tickIntervalSeconds: Double
    public var granularity: Granularity
    public var liveTradingAcknowledged: Bool

    public static let `default` = PersistedState(
        learner: .empty,
        trades: [],
        riskConfig: .default,
        trailingConfig: .default,
        paperCash: 10_000,
        productId: "BTC-USD",
        tickIntervalSeconds: 2,
        granularity: .oneMinute,
        liveTradingAcknowledged: false
    )
}

public final class Storage {
    public static let shared = Storage()

    private let url: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return dir.appendingPathComponent("state.json")
    }()

    public func load() -> PersistedState {
        guard let data = try? Data(contentsOf: url),
              let s = try? JSONDecoder().decode(PersistedState.self, from: data) else {
            return .default
        }
        return s
    }

    public func save(_ state: PersistedState) {
        if let data = try? JSONEncoder().encode(state) {
            try? data.write(to: url, options: .atomic)
        }
    }
}
