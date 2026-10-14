//
//  Extensions.swift
//  IsItSafe
//

import Foundation
import SwiftUI

extension String {
    public var isNotEmpty: Bool { !isEmpty }
}

extension Date {
    public func formatRelative() -> String {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        f.locale = Locale(identifier: L10n.current == .en ? "en_US" : "zh_CN")
        return f.localizedString(for: self, relativeTo: Date())
    }
}
