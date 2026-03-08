//
//  MainTabViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class MainTabViewModel: ObservableObject {
    @Published public var selectedTab = 0

    public init() {}
}
