//
//  LocalProfileStore.swift
//  IsItSafe
//
//  仅用于「我的」页与个人资料编辑的本地展示，不涉及服务端接口。
//

import Combine
import Foundation

public final class LocalProfileStore: ObservableObject {
    public static let shared = LocalProfileStore()
    private let nicknameKey = "isitsafe.local.nickname"
    private let genderKey = "isitsafe.local.gender"
    private let avatarDataKey = "isitsafe.local.avatarData"

    private init() {}

    public var nickname: String? {
        get { UserDefaults.standard.string(forKey: nicknameKey) }
        set { UserDefaults.standard.set(newValue, forKey: nicknameKey); objectWillChange.send() }
    }

    public var gender: String? {
        get { UserDefaults.standard.string(forKey: genderKey) }
        set { UserDefaults.standard.set(newValue, forKey: genderKey); objectWillChange.send() }
    }

    public var avatarImageData: Data? {
        get { UserDefaults.standard.data(forKey: avatarDataKey) }
        set { UserDefaults.standard.set(newValue, forKey: avatarDataKey); objectWillChange.send() }
    }
}
