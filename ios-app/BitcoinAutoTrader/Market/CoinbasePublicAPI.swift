import Foundation

public enum CoinbaseAPIError: Error, LocalizedError {
    case invalidURL
    case badResponse(Int)
    case decoding(Error)
    case transport(Error)

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .badResponse(let code): return "HTTP \(code)"
        case .decoding(let err): return "Decode error: \(err.localizedDescription)"
        case .transport(let err): return "Network error: \(err.localizedDescription)"
        }
    }
}

public struct CoinbasePublicAPI {
    public static let shared = CoinbasePublicAPI()
    private let base = URL(string: "https://api.exchange.coinbase.com")!
    private let session: URLSession

    public init(session: URLSession = .shared) {
        self.session = session
    }

    public func spotPrice(productId: String = "BTC-USD") async throws -> Double {
        let url = base.appendingPathComponent("products/\(productId)/ticker")
        let data = try await get(url)
        struct Ticker: Decodable { let price: String }
        do {
            let t = try JSONDecoder().decode(Ticker.self, from: data)
            return Double(t.price) ?? 0
        } catch {
            throw CoinbaseAPIError.decoding(error)
        }
    }

    public func historicalCandles(productId: String = "BTC-USD",
                                  granularity: Granularity = .oneHour,
                                  start: Date,
                                  end: Date) async throws -> [Candle] {
        var comps = URLComponents(url: base.appendingPathComponent("products/\(productId)/candles"),
                                  resolvingAgainstBaseURL: false)!
        let fmt = ISO8601DateFormatter()
        comps.queryItems = [
            URLQueryItem(name: "granularity", value: String(granularity.rawValue)),
            URLQueryItem(name: "start", value: fmt.string(from: start)),
            URLQueryItem(name: "end", value: fmt.string(from: end))
        ]
        guard let url = comps.url else { throw CoinbaseAPIError.invalidURL }
        let data = try await get(url)
        do {
            let rows = try JSONDecoder().decode([[Double]].self, from: data)
            let candles: [Candle] = rows.compactMap { row in
                guard row.count >= 6 else { return nil }
                return Candle(
                    timestamp: Date(timeIntervalSince1970: row[0]),
                    open: row[3],
                    high: row[2],
                    low: row[1],
                    close: row[4],
                    volume: row[5]
                )
            }
            return candles.sorted { $0.timestamp < $1.timestamp }
        } catch {
            throw CoinbaseAPIError.decoding(error)
        }
    }

    private func get(_ url: URL) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw CoinbaseAPIError.badResponse(0)
            }
            guard (200..<300).contains(http.statusCode) else {
                throw CoinbaseAPIError.badResponse(http.statusCode)
            }
            return data
        } catch let err as CoinbaseAPIError {
            throw err
        } catch {
            throw CoinbaseAPIError.transport(error)
        }
    }
}
