//
//  PaginationRequest.swift
//  IsItSafe
//

import Foundation

public struct PaginationRequest {
    public var page: Int
    public var pageSize: Int

    public init(page: Int = 1, pageSize: Int = 20) {
        self.page = page
        self.pageSize = pageSize
    }
}
