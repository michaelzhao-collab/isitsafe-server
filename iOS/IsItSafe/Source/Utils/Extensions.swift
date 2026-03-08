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
        f.locale = Locale(identifier: "zh_CN")
        return f.localizedString(for: self, relativeTo: Date())
    }
}
