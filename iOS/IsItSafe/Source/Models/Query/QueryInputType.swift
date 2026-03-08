//
//  QueryInputType.swift
//  IsItSafe
//

import Foundation

public enum QueryInputType: String, Codable {
    case text
    case phone
    case url
    case company
    case screenshot
}
