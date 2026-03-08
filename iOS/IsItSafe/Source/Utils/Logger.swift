//
//  Logger.swift
//  IsItSafe
//

import Foundation

public enum Logger {
    public static func debug(_ message: String) {
        #if DEBUG
        print("[IsItSafe] \(message)")
        #endif
    }
    public static func error(_ message: String) {
        print("[IsItSafe Error] \(message)")
    }
}
