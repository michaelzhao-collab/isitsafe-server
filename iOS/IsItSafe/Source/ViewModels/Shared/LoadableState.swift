//
//  LoadableState.swift
//  IsItSafe
//

import Foundation

public enum LoadableState<T> {
    case idle
    case loading
    case success(T)
    case empty
    case failure(Error)

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
    public var value: T? {
        if case .success(let t) = self { return t }
        return nil
    }
    public var error: Error? {
        if case .failure(let e) = self { return e }
        return nil
    }
}
