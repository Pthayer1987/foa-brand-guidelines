import Foundation
import Security

public struct KeychainHelper {
    public static let shared = KeychainHelper()
    private let service = "com.example.BitcoinAutoTrader"

    public func save(_ data: Data, for key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var attrs = query
        attrs[kSecValueData as String] = data
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(attrs as CFDictionary, nil)
    }

    public func read(_ key: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess else { return nil }
        return out as? Data
    }

    public func delete(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    public func saveCredentials(_ creds: CoinbaseCredentials) {
        if let data = try? JSONEncoder().encode(creds) {
            save(data, for: "coinbase.credentials")
        }
    }

    public func loadCredentials() -> CoinbaseCredentials? {
        guard let data = read("coinbase.credentials") else { return nil }
        return try? JSONDecoder().decode(CoinbaseCredentials.self, from: data)
    }

    public func deleteCredentials() { delete("coinbase.credentials") }
}
