import Foundation
import CryptoKit

public struct CoinbaseCredentials: Codable {
    public let apiKey: String
    public let apiSecret: String
    public init(apiKey: String, apiSecret: String) {
        self.apiKey = apiKey
        self.apiSecret = apiSecret
    }
}

public enum CoinbaseTradeError: Error, LocalizedError {
    case missingCredentials
    case invalidURL
    case http(Int, String)
    case decoding(Error)
    case transport(Error)

    public var errorDescription: String? {
        switch self {
        case .missingCredentials: return "Missing Coinbase API credentials"
        case .invalidURL: return "Invalid URL"
        case .http(let code, let body): return "HTTP \(code): \(body)"
        case .decoding(let e): return "Decode error: \(e.localizedDescription)"
        case .transport(let e): return "Network error: \(e.localizedDescription)"
        }
    }
}

/// Minimal Coinbase Advanced Trade REST client (HMAC-SHA256 auth).
///
/// NOTE: Treat this as a foundation. Before going live, verify request signing
/// against Coinbase's current docs (endpoints and auth details can change),
/// wire up error handling for partial fills, rate limits, and insufficient balance,
/// and run everything in paper mode first.
public final class CoinbaseAdvancedTradeClient {
    public let credentials: CoinbaseCredentials
    private let base = URL(string: "https://api.coinbase.com")!
    private let session: URLSession

    public init(credentials: CoinbaseCredentials, session: URLSession = .shared) {
        self.credentials = credentials
        self.session = session
    }

    public struct AccountBalance: Decodable {
        public let currency: String
        public let available: Double
    }

    public func accounts() async throws -> [AccountBalance] {
        let data = try await signedGet(path: "/api/v3/brokerage/accounts")
        struct Resp: Decodable {
            struct Acct: Decodable {
                struct Bal: Decodable { let value: String }
                let currency: String
                let available_balance: Bal
            }
            let accounts: [Acct]
        }
        do {
            let r = try JSONDecoder().decode(Resp.self, from: data)
            return r.accounts.map { AccountBalance(currency: $0.currency, available: Double($0.available_balance.value) ?? 0) }
        } catch {
            throw CoinbaseTradeError.decoding(error)
        }
    }

    public struct PlacedOrder: Decodable {
        public let orderId: String
        public let averageFilledPrice: Double
        public let filledSize: Double
        public let totalFees: Double
    }

    public func placeMarketOrder(productId: String, side: TradeSide, baseSize: Double) async throws -> PlacedOrder {
        let clientOrderId = UUID().uuidString
        var marketConfig: [String: Any] = [:]
        switch side {
        case .buy:
            marketConfig["quote_size"] = nil as Any?
            marketConfig["base_size"] = String(format: "%.8f", baseSize)
        case .sell:
            marketConfig["base_size"] = String(format: "%.8f", baseSize)
        }
        let body: [String: Any] = [
            "client_order_id": clientOrderId,
            "product_id": productId,
            "side": side == .buy ? "BUY" : "SELL",
            "order_configuration": [
                "market_market_ioc": marketConfig.compactMapValues { $0 }
            ]
        ]
        let data = try await signedPost(path: "/api/v3/brokerage/orders", body: body)
        struct Resp: Decodable {
            struct Success: Decodable {
                let order_id: String
            }
            struct Error: Decodable {
                let error: String?
                let message: String?
            }
            let success: Bool
            let success_response: Success?
            let error_response: Error?
        }
        do {
            let r = try JSONDecoder().decode(Resp.self, from: data)
            if !r.success {
                let msg = r.error_response?.message ?? r.error_response?.error ?? "unknown"
                throw CoinbaseTradeError.http(400, msg)
            }
            guard let orderId = r.success_response?.order_id else {
                throw CoinbaseTradeError.http(500, "missing order id")
            }
            return try await fetchOrder(orderId: orderId)
        } catch let e as CoinbaseTradeError {
            throw e
        } catch {
            throw CoinbaseTradeError.decoding(error)
        }
    }

    public func fetchOrder(orderId: String) async throws -> PlacedOrder {
        let data = try await signedGet(path: "/api/v3/brokerage/orders/historical/\(orderId)")
        struct Resp: Decodable {
            struct Order: Decodable {
                let order_id: String
                let average_filled_price: String
                let filled_size: String
                let total_fees: String
            }
            let order: Order
        }
        do {
            let r = try JSONDecoder().decode(Resp.self, from: data)
            return PlacedOrder(
                orderId: r.order.order_id,
                averageFilledPrice: Double(r.order.average_filled_price) ?? 0,
                filledSize: Double(r.order.filled_size) ?? 0,
                totalFees: Double(r.order.total_fees) ?? 0
            )
        } catch {
            throw CoinbaseTradeError.decoding(error)
        }
    }

    private func signedGet(path: String) async throws -> Data {
        try await signedRequest(method: "GET", path: path, bodyData: nil)
    }

    private func signedPost(path: String, body: [String: Any]) async throws -> Data {
        let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        return try await signedRequest(method: "POST", path: path, bodyData: data)
    }

    private func signedRequest(method: String, path: String, bodyData: Data?) async throws -> Data {
        guard !credentials.apiKey.isEmpty, !credentials.apiSecret.isEmpty else {
            throw CoinbaseTradeError.missingCredentials
        }
        guard let url = URL(string: path, relativeTo: base) else {
            throw CoinbaseTradeError.invalidURL
        }
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let bodyString = bodyData.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        let message = timestamp + method + path + bodyString
        guard let secretData = credentials.apiSecret.data(using: .utf8),
              let msgData = message.data(using: .utf8) else {
            throw CoinbaseTradeError.missingCredentials
        }
        let key = SymmetricKey(data: secretData)
        let sig = HMAC<SHA256>.authenticationCode(for: msgData, using: key)
        let sigHex = sig.map { String(format: "%02x", $0) }.joined()

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(credentials.apiKey, forHTTPHeaderField: "CB-ACCESS-KEY")
        req.setValue(sigHex, forHTTPHeaderField: "CB-ACCESS-SIGN")
        req.setValue(timestamp, forHTTPHeaderField: "CB-ACCESS-TIMESTAMP")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bodyData = bodyData {
            req.httpBody = bodyData
        }
        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                throw CoinbaseTradeError.http(0, "no response")
            }
            guard (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8) ?? ""
                throw CoinbaseTradeError.http(http.statusCode, body)
            }
            return data
        } catch let e as CoinbaseTradeError {
            throw e
        } catch {
            throw CoinbaseTradeError.transport(error)
        }
    }
}
