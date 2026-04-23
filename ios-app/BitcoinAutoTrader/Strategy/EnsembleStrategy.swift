import Foundation

public final class EnsembleStrategy {
    public let learner: OnlineLearner
    public let horizon: Int
    public let costEstimate: Double

    public init(learner: OnlineLearner, horizon: Int = 5, costEstimate: Double = 0.0015) {
        self.learner = learner
        self.horizon = horizon
        self.costEstimate = costEstimate
    }

    public func signal(candles: [Candle], index: Int, holdingLong: Bool) -> StrategySignal {
        guard let feats = learner.features(candles: candles, index: index) else { return .hold }
        let (enter, confidence) = learner.shouldEnterLong(features: feats)
        if holdingLong {
            if confidence < -0.1 {
                return StrategySignal(action: .exitLong, confidence: -confidence,
                                      reason: "ensemble bearish", features: feats)
            }
            return StrategySignal(action: .hold, confidence: confidence, reason: "hold long", features: feats)
        } else if enter {
            return StrategySignal(action: .enterLong, confidence: confidence,
                                  reason: "ensemble+entry classifier", features: feats)
        } else {
            return StrategySignal(action: .hold, confidence: confidence, reason: "no edge", features: feats)
        }
    }
}
