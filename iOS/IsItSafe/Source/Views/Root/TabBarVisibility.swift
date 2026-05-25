import Foundation
import Combine
import SwiftUI

final class TabBarVisibility: ObservableObject {
    static let shared = TabBarVisibility()

    @Published private(set) var hideCount: Int = 0

    var isHidden: Bool { hideCount > 0 }

    private init() {}

    func pushHidden() {
        hideCount += 1
    }

    func popHidden() {
        hideCount = max(0, hideCount - 1)
    }
}

private struct MainTabBarHiddenModifier: ViewModifier {
    @State private var isApplied = false

    func body(content: Content) -> some View {
        content
            .onAppear {
                guard !isApplied else { return }
                isApplied = true
                TabBarVisibility.shared.pushHidden()
            }
            .onDisappear {
                guard isApplied else { return }
                isApplied = false
                TabBarVisibility.shared.popHidden()
            }
    }
}

extension View {
    func mainTabBarHidden() -> some View {
        modifier(MainTabBarHiddenModifier())
    }
}
