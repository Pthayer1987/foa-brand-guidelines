import SwiftUI

@main
struct BitcoinAutoTraderApp: App {
    @StateObject private var engine = TradingEngine()
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(engine)
                .environmentObject(appState)
        }
    }
}
