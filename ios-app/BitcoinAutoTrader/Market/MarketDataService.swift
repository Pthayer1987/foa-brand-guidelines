import Foundation
import Combine

@MainActor
public final class MarketDataService: ObservableObject {
    @Published public private(set) var latestPrice: Double = 0
    @Published public private(set) var recentCandles: [Candle] = []
    @Published public private(set) var lastError: String?

    private var tickerTask: Task<Void, Never>?
    private var candleTask: Task<Void, Never>?
    private let api = CoinbasePublicAPI.shared
    private let productId: String
    private let granularity: Granularity

    public init(productId: String = "BTC-USD", granularity: Granularity = .oneMinute) {
        self.productId = productId
        self.granularity = granularity
    }

    public func start() {
        stop()
        tickerTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                do {
                    let price = try await self.api.spotPrice(productId: self.productId)
                    await MainActor.run {
                        self.latestPrice = price
                        self.lastError = nil
                    }
                } catch {
                    await MainActor.run { self.lastError = error.localizedDescription }
                }
                try? await Task.sleep(nanoseconds: 5_000_000_000)
            }
        }
        candleTask = Task { [weak self] in
            guard let self else { return }
            await self.refreshCandles()
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                await self.refreshCandles()
            }
        }
    }

    public func stop() {
        tickerTask?.cancel()
        tickerTask = nil
        candleTask?.cancel()
        candleTask = nil
    }

    public func refreshCandles() async {
        let end = Date()
        let start = end.addingTimeInterval(-Double(granularity.rawValue) * 300)
        do {
            let candles = try await api.historicalCandles(
                productId: productId, granularity: granularity, start: start, end: end
            )
            await MainActor.run { self.recentCandles = candles }
        } catch {
            await MainActor.run { self.lastError = error.localizedDescription }
        }
    }

    public func fetchHistory(days: Int, granularity: Granularity) async throws -> [Candle] {
        let end = Date()
        let start = end.addingTimeInterval(-Double(days) * 86400)
        var all: [Candle] = []
        let windowSeconds = Double(granularity.rawValue) * 300
        var cursor = start
        while cursor < end {
            let chunkEnd = min(cursor.addingTimeInterval(windowSeconds), end)
            let chunk = try await api.historicalCandles(
                productId: productId, granularity: granularity, start: cursor, end: chunkEnd
            )
            all.append(contentsOf: chunk)
            cursor = chunkEnd
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        var deduped: [Date: Candle] = [:]
        for c in all { deduped[c.timestamp] = c }
        return deduped.values.sorted { $0.timestamp < $1.timestamp }
    }
}
