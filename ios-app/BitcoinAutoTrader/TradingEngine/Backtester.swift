import Foundation

public struct BacktestConfig: Codable {
    public var startingCash: Double
    public var feeRate: Double
    public var slippageBps: Double
    public var trainingEpochs: Int
    public var horizon: Int

    public static let `default` = BacktestConfig(
        startingCash: 10_000, feeRate: 0.0006, slippageBps: 3, trainingEpochs: 3, horizon: 5
    )
}

public struct BacktestResult: Codable {
    public let startingEquity: Double
    public let endingEquity: Double
    public let totalReturn: Double
    public let annualizedReturn: Double
    public let sharpe: Double
    public let maxDrawdown: Double
    public let numTrades: Int
    public let winRate: Double
    public let trades: [Trade]
    public let equityCurve: [Double]
    public let trainedState: LearnerState
    public let sampleCount: Int
}

public final class Backtester {
    public let config: BacktestConfig
    public let trailingConfig: TrailingStopConfig
    public let riskConfig: RiskConfig

    public init(config: BacktestConfig = .default,
                trailingConfig: TrailingStopConfig = .default,
                riskConfig: RiskConfig = .default) {
        self.config = config
        self.trailingConfig = trailingConfig
        self.riskConfig = riskConfig
    }

    /// Runs multiple training epochs, then a final evaluation pass (no learning) to report metrics.
    public func run(candles: [Candle], learner: OnlineLearner) -> BacktestResult {
        guard candles.count > 50 else {
            return BacktestResult(startingEquity: config.startingCash, endingEquity: config.startingCash,
                                  totalReturn: 0, annualizedReturn: 0, sharpe: 0, maxDrawdown: 0,
                                  numTrades: 0, winRate: 0, trades: [], equityCurve: [config.startingCash],
                                  trainedState: learner.state, sampleCount: 0)
        }

        var totalSamples = 0
        for _ in 0..<max(1, config.trainingEpochs) {
            totalSamples += trainingPass(candles: candles, learner: learner)
        }
        let result = evaluationPass(candles: candles, learner: learner)
        return BacktestResult(
            startingEquity: result.startingEquity,
            endingEquity: result.endingEquity,
            totalReturn: result.totalReturn,
            annualizedReturn: result.annualizedReturn,
            sharpe: result.sharpe,
            maxDrawdown: result.maxDrawdown,
            numTrades: result.numTrades,
            winRate: result.winRate,
            trades: result.trades,
            equityCurve: result.equityCurve,
            trainedState: learner.state,
            sampleCount: totalSamples
        )
    }

    /// One training pass: walks forward, computing features and feeding realized future returns back to the learner.
    @discardableResult
    private func trainingPass(candles: [Candle], learner: OnlineLearner) -> Int {
        let horizon = max(1, config.horizon)
        var samples = 0
        let closes = candles.map(\.close)
        let endIndex = candles.count - horizon - 1
        guard endIndex > 0 else { return 0 }
        for i in 0..<endIndex {
            guard let feats = learner.features(candles: candles, index: i) else { continue }
            let future = closes[i + horizon]
            let now = closes[i]
            guard now > 0 else { continue }
            let realized = (future / now) - 1 - (config.feeRate * 2) - (config.slippageBps / 10_000 * 2)
            learner.update(features: feats, realizedReturn: realized)
            samples += 1
        }
        return samples
    }

    /// Evaluation pass: simulate trading bar-by-bar with trailing stop and risk rules.
    private func evaluationPass(candles: [Candle], learner: OnlineLearner) -> BacktestResult {
        var account = Account(cash: config.startingCash, position: .flat)
        var trades: [Trade] = []
        var equityCurve: [Double] = []
        var peakEquity = config.startingCash
        var maxDD = 0.0
        let risk = RiskManager(config: riskConfig)
        risk.resetSession(equity: config.startingCash)
        let trail = TrailingStopManager(config: trailingConfig)
        let strat = EnsembleStrategy(learner: learner, horizon: config.horizon,
                                     costEstimate: config.feeRate * 2 + config.slippageBps / 5000)
        let atrSeries = Indicators.atr(candles, period: 14)

        var returns: [Double] = []
        var prevEquity = config.startingCash

        for i in 0..<candles.count {
            let price = candles[i].close
            let equity = account.equity(at: price)
            equityCurve.append(equity)
            peakEquity = max(peakEquity, equity)
            let dd = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0
            maxDD = max(maxDD, dd)
            let r = prevEquity > 0 ? (equity - prevEquity) / prevEquity : 0
            returns.append(r)
            prevEquity = equity

            if !account.position.isFlat {
                if trail.onTick(price: price, atr: atrSeries[i] ?? nil) {
                    let qty = account.position.quantity
                    let fill = sell(price: price, qty: qty, account: &account)
                    trades.append(Trade(timestamp: candles[i].timestamp, side: .sell,
                                        price: fill.price, quantity: qty, fee: fill.fee,
                                        mode: .paper, reason: "trailing stop"))
                    trail.disarm()
                    risk.recordTrade(at: candles[i].timestamp)
                    continue
                }
            }

            let signal = strat.signal(candles: candles, index: i, holdingLong: !account.position.isFlat)
            switch signal.action {
            case .enterLong where account.position.isFlat:
                let (ok, _) = risk.canTrade(equity: equity, confidence: signal.confidence, now: candles[i].timestamp)
                guard ok else { continue }
                let qty = risk.positionSize(cash: account.cash, price: price, confidence: signal.confidence)
                guard qty > 0 else { continue }
                let fill = buy(price: price, qty: qty, account: &account)
                trades.append(Trade(timestamp: candles[i].timestamp, side: .buy,
                                    price: fill.price, quantity: qty, fee: fill.fee,
                                    mode: .paper, reason: signal.reason))
                trail.armOnEntry(price: fill.price, atr: atrSeries[i] ?? nil)
                risk.recordTrade(at: candles[i].timestamp)
            case .exitLong where !account.position.isFlat:
                let qty = account.position.quantity
                let fill = sell(price: price, qty: qty, account: &account)
                trades.append(Trade(timestamp: candles[i].timestamp, side: .sell,
                                    price: fill.price, quantity: qty, fee: fill.fee,
                                    mode: .paper, reason: signal.reason))
                trail.disarm()
                risk.recordTrade(at: candles[i].timestamp)
            default:
                break
            }
        }

        if !account.position.isFlat, let last = candles.last {
            let qty = account.position.quantity
            let fill = sell(price: last.close, qty: qty, account: &account)
            trades.append(Trade(timestamp: last.timestamp, side: .sell,
                                price: fill.price, quantity: qty, fee: fill.fee,
                                mode: .paper, reason: "end of backtest"))
        }

        let endEquity = account.equity(at: candles.last?.close ?? 0)
        let totalReturn = (endEquity / config.startingCash) - 1
        let days = candles.last.map { $0.timestamp.timeIntervalSince(candles.first!.timestamp) / 86400 } ?? 1
        let annualized = days > 0 ? pow(1 + totalReturn, 365.0 / days) - 1 : 0
        let sharpe = computeSharpe(returns: returns)
        let wins = trades.filter { $0.side == .sell }.count > 0 ? computeWinRate(trades: trades) : 0
        let numTrades = trades.filter { $0.side == .buy }.count

        return BacktestResult(
            startingEquity: config.startingCash,
            endingEquity: endEquity,
            totalReturn: totalReturn,
            annualizedReturn: annualized,
            sharpe: sharpe,
            maxDrawdown: maxDD,
            numTrades: numTrades,
            winRate: wins,
            trades: trades,
            equityCurve: equityCurve,
            trainedState: learner.state,
            sampleCount: 0
        )
    }

    private func buy(price: Double, qty: Double, account: inout Account) -> Fill {
        let slip = price * config.slippageBps / 10_000
        let fill = price + slip
        let fee = fill * qty * config.feeRate
        account.cash -= fill * qty + fee
        account.position.apply(side: .buy, price: fill, quantity: qty)
        return Fill(price: fill, quantity: qty, fee: fee, timestamp: Date())
    }

    private func sell(price: Double, qty: Double, account: inout Account) -> Fill {
        let slip = price * config.slippageBps / 10_000
        let fill = price - slip
        let fee = fill * qty * config.feeRate
        account.cash += fill * qty - fee
        account.position.apply(side: .sell, price: fill, quantity: qty)
        return Fill(price: fill, quantity: qty, fee: fee, timestamp: Date())
    }

    private func computeSharpe(returns: [Double]) -> Double {
        guard returns.count > 1 else { return 0 }
        let mean = returns.reduce(0, +) / Double(returns.count)
        let variance = returns.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(returns.count - 1)
        let sd = sqrt(variance)
        guard sd > 0 else { return 0 }
        return mean / sd * sqrt(365 * 24)
    }

    private func computeWinRate(trades: [Trade]) -> Double {
        var wins = 0
        var total = 0
        var openBuy: Trade?
        for t in trades {
            if t.side == .buy { openBuy = t; continue }
            if let b = openBuy, t.side == .sell {
                total += 1
                if t.price > b.price { wins += 1 }
                openBuy = nil
            }
        }
        return total > 0 ? Double(wins) / Double(total) : 0
    }
}
