//
//  ErrorBannerViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class ErrorBannerViewModel: ObservableObject {
    public static let shared = ErrorBannerViewModel()
    @Published public var message: String?
    @Published public var isPresented = false

    private init() {}

    public func show(_ error: Error) {
        message = (error as? APIError)?.userMessage ?? error.localizedDescription
        isPresented = true
    }

    public func show(_ text: String) {
        message = text
        isPresented = true
    }

    public func dismiss() {
        isPresented = false
        message = nil
    }
}
