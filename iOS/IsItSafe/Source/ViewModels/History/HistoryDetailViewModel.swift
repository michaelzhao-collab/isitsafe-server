//
//  HistoryDetailViewModel.swift
//  IsItSafe
//

import Combine
import Foundation
import SwiftUI

public final class HistoryDetailViewModel: ObservableObject {
    @Published public var item: QueryHistoryItem?
    @Published public var viewData: RiskAnalysisViewData?

    public init(item: QueryHistoryItem) {
        self.item = item
        if let r = item.resultJson {
            viewData = RiskAnalysisViewData(from: r)
        }
    }
}
