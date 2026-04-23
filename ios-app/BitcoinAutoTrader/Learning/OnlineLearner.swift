import Foundation

public struct LearnerState: Codable {
    public var subWeights: [String: Double]
    public var entryWeights: [Double]
    public var entryBias: Double
    public var featureOrder: [String]
    public var samplesSeen: Int
    public var exponentialPnL: Double

    public static let empty = LearnerState(
        subWeights: [:], entryWeights: [], entryBias: 0, featureOrder: [], samplesSeen: 0, exponentialPnL: 0
    )
}

public final class OnlineLearner {

    public private(set) var state: LearnerState
    public let learningRate: Double
    public let entryThreshold: Double
    public let subSources: [SubSignalSource]

    public init(sources: [SubSignalSource],
                state: LearnerState = .empty,
                learningRate: Double = 0.02,
                entryThreshold: Double = 0.55) {
        self.subSources = sources
        self.learningRate = learningRate
        self.entryThreshold = entryThreshold
        var seeded = state
        if seeded.featureOrder.isEmpty {
            seeded.featureOrder = sources.map(\.name)
        }
        if seeded.entryWeights.count != seeded.featureOrder.count {
            seeded.entryWeights = Array(repeating: 0, count: seeded.featureOrder.count)
        }
        for name in seeded.featureOrder where seeded.subWeights[name] == nil {
            seeded.subWeights[name] = 1.0 / Double(seeded.featureOrder.count)
        }
        self.state = seeded
    }

    public func features(candles: [Candle], index: Int) -> [String: Double]? {
        var feats: [String: Double] = [:]
        for src in subSources {
            guard let v = src.compute(candles: candles, index: index) else { return nil }
            feats[src.name] = v
        }
        return feats
    }

    public func ensembleScore(features: [String: Double]) -> Double {
        var score = 0.0
        var totalWeight = 0.0
        for (name, value) in features {
            let w = state.subWeights[name] ?? 0
            score += w * value
            totalWeight += abs(w)
        }
        return totalWeight > 0 ? score / totalWeight : 0
    }

    public func entryProbability(features: [String: Double]) -> Double {
        var z = state.entryBias
        for (i, name) in state.featureOrder.enumerated() {
            guard i < state.entryWeights.count else { break }
            let f = features[name] ?? 0
            z += state.entryWeights[i] * f
        }
        return 1.0 / (1.0 + exp(-z))
    }

    public func shouldEnterLong(features: [String: Double]) -> (Bool, Double) {
        let score = ensembleScore(features: features)
        let pEntry = entryProbability(features: features)
        let combined = (score + (pEntry * 2 - 1)) / 2
        return (combined > 0 && pEntry >= entryThreshold, combined)
    }

    public func update(features: [String: Double], realizedReturn: Double) {
        state.samplesSeen += 1
        let lr = learningRate
        let decay = 0.995
        state.exponentialPnL = decay * state.exponentialPnL + (1 - decay) * realizedReturn

        for (name, value) in features {
            let pnl = value * realizedReturn
            let old = state.subWeights[name] ?? 0
            let updated = old + lr * pnl
            state.subWeights[name] = updated
        }
        normalizeSubWeights()

        let label: Double = realizedReturn > 0 ? 1 : 0
        var z = state.entryBias
        for (i, name) in state.featureOrder.enumerated() {
            guard i < state.entryWeights.count else { break }
            z += state.entryWeights[i] * (features[name] ?? 0)
        }
        let p = 1.0 / (1.0 + exp(-z))
        let grad = p - label
        state.entryBias -= lr * grad
        for (i, name) in state.featureOrder.enumerated() {
            guard i < state.entryWeights.count else { break }
            let f = features[name] ?? 0
            state.entryWeights[i] -= lr * grad * f
            state.entryWeights[i] *= 0.9999
        }
    }

    private func normalizeSubWeights() {
        let absSum = state.subWeights.values.reduce(0) { $0 + abs($1) }
        guard absSum > 0 else { return }
        for (k, v) in state.subWeights {
            state.subWeights[k] = v / absSum
        }
    }

    public func snapshot() -> LearnerState { state }
    public func load(_ s: LearnerState) {
        var merged = s
        if merged.featureOrder.isEmpty {
            merged.featureOrder = subSources.map(\.name)
        }
        if merged.entryWeights.count != merged.featureOrder.count {
            merged.entryWeights = Array(repeating: 0, count: merged.featureOrder.count)
        }
        for name in merged.featureOrder where merged.subWeights[name] == nil {
            merged.subWeights[name] = 1.0 / Double(merged.featureOrder.count)
        }
        state = merged
    }
}
