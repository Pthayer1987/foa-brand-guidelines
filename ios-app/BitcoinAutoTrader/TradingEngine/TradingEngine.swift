import Foundation
import Combine

@MainActor
public final class TradingEngine: ObservableObject {

    @Published public private(set) var status: EngineStatus = .stopped
    @Published public private(set) var currentMode: TradingMode = .paper
    @Published public private(set) var latestPrice: Double = 0
    @Published public private(set) var account: Account = .defaultPaper
    @Published public private(set) var trades: [Trade] = []
    @Published public private(set) var lastSignal: StrategySignal = .hold
    @Published public private(set) var lastError: String?
    @Published public private(set) var tickCount: Int = 0
    @Published public private(set) var currentStop: Double?
    @Published public private(set) var peakPrice: Double?
    @Published public private(set) var recentCandles: [Candle] = []

    public let learner: OnlineLearner
    public let strategy: EnsembleStrategy
    public let risk: RiskManager
    public let trail: TrailingStopManager
    public let paper: PaperBroker
    public var live: LiveBroker?

    public var productId: String = "BTC-USD"
    public var granularity: Granularity = .oneMinute
    public var tickIntervalSeconds: Double = 2.0
    public var candleRefreshSeconds: Double = 30.0

    private var loopTask: Task<Void, Never>?

    public init() {
        let sources: [SubSignalSource] = [
            MovingAverageCross(fast: 9, slow: 21),
            MovingAverageCross(fast: 21, slow: 55),
            RSIReversion(period: 14),
            MomentumLookback(lookback: 5),
            MomentumLookback(lookback: 20),
            VolatilityBreakout(period: 20)
        ]
        let persisted = Storage.shared.load()
        let learner = OnlineLearner(sources: sources, state: persisted.learner)
        self.learner = learner
        self.strategy = EnsembleStrategy(learner: learner)
        self.risk = RiskManager(config: persisted.riskConfig)
        self.trail = TrailingStopManager(config: persisted.trailingConfig)
        self.paper = PaperBroker(startingCash: persisted.paperCash)
        self.trades = persisted.trades
        self.productId = persisted.productId
        self.granularity = persisted.granularity
        self.tickIntervalSeconds = persisted.tickIntervalSeconds
    }

    public func setMode(_ mode: TradingMode, liveBroker: LiveBroker? = nil) {
        currentMode = mode
        if mode == .live { live = liveBroker }
    }

    public func start() {
        guard status != .running else { return }
        status = .running
        lastError = nil
        Task { [weak self] in
            await self?.refreshCandlesAndAccount()
        }
        loopTask = Task { [weak self] in
            await self?.loop()
        }
    }

    public func stop() {
        loopTask?.cancel()
        loopTask = nil
        status = .stopped
    }

    public func resetPaper(cash: Double) {
        paper.reset(startingCash: cash)
        account = paper.accountSnapshot
        trail.disarm()
        persist()
    }

    private var activeBroker: Broker {
        if currentMode == .live, let live = live { return live }
        return paper
    }

    private func loop() async {
        var lastCandleRefresh = Date.distantPast
        var lastSignalIndex: Int = -1
        while !Task.isCancelled {
            let tickStart = Date()
            do {
                let broker = activeBroker
                let price = try await broker.currentPrice()
                latestPrice = price
                paper.latestMarkPrice = price
                tickCount += 1

                if !account.position.isFlat {
                    let atr = recentCandles.isEmpty ? nil :
                        Indicators.atr(recentCandles, period: 14).last ?? nil
                    if trail.onTick(price: price, atr: atr ?? nil) {
                        await exit(reason: "trailing stop", at: price)
                    }
                    currentStop = trail.currentStop
                    peakPrice = trail.peakPrice
                } else {
                    currentStop = nil
                    peakPrice = nil
                }

                if Date().timeIntervalSince(lastCandleRefresh) > candleRefreshSeconds {
                    await refreshCandlesAndAccount()
                    lastCandleRefresh = Date()
                }

                if !recentCandles.isEmpty {
                    let idx = recentCandles.count - 1
                    if idx != lastSignalIndex {
                        let signal = strategy.signal(
                            candles: recentCandles,
                            index: idx,
                            holdingLong: !account.position.isFlat
                        )
                        lastSignal = signal
                        await actOn(signal: signal, price: price)
                        lastSignalIndex = idx
                        learnFromCompletedBar()
                    }
                }
            } catch {
                lastError = error.localizedDescription
            }
            let elapsed = Date().timeIntervalSince(tickStart)
            let remaining = max(0, tickIntervalSeconds - elapsed)
            try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
        }
    }

    private func actOn(signal: StrategySignal, price: Double) async {
        let equity = account.equity(at: price)
        switch signal.action {
        case .enterLong where account.position.isFlat:
            let (ok, reason) = risk.canTrade(equity: equity, confidence: signal.confidence)
            guard ok else {
                lastError = reason
                return
            }
            let qty = risk.positionSize(cash: account.cash, price: price, confidence: signal.confidence)
            guard qty > 0 else { return }
            await place(side: .buy, qty: qty, reason: signal.reason)
        case .exitLong where !account.position.isFlat:
            let qty = account.position.quantity
            await place(side: .sell, qty: qty, reason: signal.reason)
        default:
            break
        }
    }

    private func place(side: TradeSide, qty: Double, reason: String) async {
        do {
            let fill = try await activeBroker.placeMarketOrder(
                OrderRequest(side: side, quantity: qty, reason: reason)
            )
            let trade = Trade(timestamp: fill.timestamp, side: side, price: fill.price,
                              quantity: fill.quantity, fee: fill.fee, mode: currentMode, reason: reason)
            trades.append(trade)
            if currentMode == .paper {
                account = paper.accountSnapshot
            } else if let live = live {
                account = (try? await live.account()) ?? account
            }
            risk.recordTrade(at: fill.timestamp)
            if side == .buy {
                let atr = recentCandles.isEmpty ? nil :
                    Indicators.atr(recentCandles, period: 14).last ?? nil
                trail.armOnEntry(price: fill.price, atr: atr ?? nil)
            } else {
                trail.disarm()
            }
            persist()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func exit(reason: String, at price: Double) async {
        guard !account.position.isFlat else { return }
        let qty = account.position.quantity
        await place(side: .sell, qty: qty, reason: reason)
    }

    private func refreshCandlesAndAccount() async {
        do {
            let now = Date()
            let start = now.addingTimeInterval(-Double(granularity.rawValue) * 300)
            let candles = try await CoinbasePublicAPI.shared.historicalCandles(
                productId: productId, granularity: granularity, start: start, end: now
            )
            recentCandles = candles
            if currentMode == .paper {
                account = paper.accountSnapshot
            } else if let live = live {
                account = (try? await live.account()) ?? account
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// After a candle closes, feed the realized return back to the learner for continuous improvement.
    private func learnFromCompletedBar() {
        guard recentCandles.count >= strategy.horizon + 2 else { return }
        let tailIndex = recentCandles.count - strategy.horizon - 1
        guard tailIndex >= 0 else { return }
        guard let feats = learner.features(candles: recentCandles, index: tailIndex) else { return }
        let base = recentCandles[tailIndex].close
        let future = recentCandles[recentCandles.count - 1].close
        guard base > 0 else { return }
        let realized = (future / base) - 1 - strategy.costEstimate
        learner.update(features: feats, realizedReturn: realized)
        persist()
    }

    public func applyBacktestResult(_ result: BacktestResult) {
        learner.load(result.trainedState)
        persist()
    }

    public func updateRisk(_ cfg: RiskConfig) { risk.updateConfig(cfg); persist() }
    public func updateTrail(_ cfg: TrailingStopConfig) { trail.updateConfig(cfg); persist() }

    public func persist() {
        var s = Storage.shared.load()
        s.learner = learner.snapshot()
        s.trades = trades
        s.riskConfig = risk.config
        s.trailingConfig = trail.config
        s.paperCash = paper.accountSnapshot.cash
        s.productId = productId
        s.granularity = granularity
        s.tickIntervalSeconds = tickIntervalSeconds
        Storage.shared.save(s)
    }
}
