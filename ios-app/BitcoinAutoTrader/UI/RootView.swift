import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Trade", systemImage: "chart.line.uptrend.xyaxis") }
            BacktestView()
                .tabItem { Label("Backtest", systemImage: "clock.arrow.circlepath") }
            TradesView()
                .tabItem { Label("Trades", systemImage: "list.bullet.rectangle") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
