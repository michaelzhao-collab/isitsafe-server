//
//  AuthSmsModels.swift
//  IsItSafe
//

import Foundation

public struct SendSmsCodeResponse: Codable {
    public let message: String
    public let code: String
}

public struct RegionHintResponse: Codable {
    public let countryCode: String?
}
