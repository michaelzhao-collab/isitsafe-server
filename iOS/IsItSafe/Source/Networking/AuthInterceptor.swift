//
//  AuthInterceptor.swift
//  IsItSafe
//
//  从 TokenStore 取 token 并加 Authorization 头；无 token 时不报错（可选登录接口）。
//

import Foundation

public final class AuthInterceptor {
    public static func token() -> String? {
        TokenStore.shared.accessToken
    }
}
