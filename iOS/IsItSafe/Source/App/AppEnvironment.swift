//
//  AppEnvironment.swift
//  IsItSafe
//
//  环境配置：切换 baseURL 即可联调不同环境，禁止在业务中写死 URL。
//

import Foundation

public enum AppEnvironmentType: String, CaseIterable {
    case local
    case lan
    case staging
    case productionCN
    case productionGlobal
}

public struct AppEnvironment {
    public let type: AppEnvironmentType
    public let baseURL: String
    public let timeout: TimeInterval
    public let enableLogging: Bool

    public init(type: AppEnvironmentType, baseURL: String, timeout: TimeInterval = 30, enableLogging: Bool = true) {
        self.type = type
        self.baseURL = baseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.timeout = timeout
        self.enableLogging = enableLogging
    }

    /// 本地模拟器
    public static let local = AppEnvironment(
        type: .local,
        baseURL: "http://localhost:3000",
        timeout: 30,
        enableLogging: true
    )

    /// 真机调试：需替换为你的电脑局域网 IP
    public static let lan = AppEnvironment(
        type: .lan,
        baseURL: "http://192.168.1.100:3000",
        timeout: 30,
        enableLogging: true
    )

    /// 测试环境
    public static let staging = AppEnvironment(
        type: .staging,
        baseURL: "https://staging-api.isitsafe.example.com",
        timeout: 30,
        enableLogging: true
    )

    /// 生产环境（正式域名）
    public static let productionCN = AppEnvironment(
        type: .productionCN,
        baseURL: "https://api.starlensai.com",
        timeout: 30,
        enableLogging: false
    )

    /// 生产环境（海外，同正式域名）
    public static let productionGlobal = AppEnvironment(
        type: .productionGlobal,
        baseURL: "https://api.starlensai.com",
        timeout: 30,
        enableLogging: false
    )

    public static func environment(for type: AppEnvironmentType) -> AppEnvironment {
        switch type {
        case .local: return .local
        case .lan: return .lan
        case .staging: return .staging
        case .productionCN: return .productionCN
        case .productionGlobal: return .productionGlobal
        }
    }
}
