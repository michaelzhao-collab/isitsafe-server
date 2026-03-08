//
//  Formatter.swift
//  IsItSafe
//

import Foundation

public enum Formatter {
    public static func isoDate(_ str: String?) -> Date? {
        guard let s = str else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s)
    }
}
