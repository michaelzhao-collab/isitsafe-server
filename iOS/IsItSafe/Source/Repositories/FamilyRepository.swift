//
//  FamilyRepository.swift
//  IsItSafe
//
//  V3-E 家庭守护：纯网络层，封装所有 V3 family 接口
//

import Foundation

public final class FamilyRepository {
    public static let shared = FamilyRepository()
    private let network = NetworkManager.shared

    private init() {}

    // MARK: - 家庭组 CRUD

    /// 创建家庭组（免费）
    public func createGroup(name: String?) async throws -> CreateFamilyGroupResponse {
        try await network.request(
            endpoint: .v3FamilyCreateGroup,
            body: CreateFamilyGroupRequest(name: name)
        )
    }

    /// 获取我的家庭组（null 表示未加入）
    ///
    /// 兼容性容错：
    /// 1) 服务端可能返回 `null`、空 body、或 `{...}`；NetworkManager 对 top-level null 应正常返回 nil
    /// 2) 极少数情况服务端字段类型与 iOS 模型不一致，模型已做容错（缺失字段降级默认值）
    /// 3) 即便仍失败，本地按"未加入"处理，让用户能进入引导流程而不是卡在加载失败
    public func getMyGroup() async throws -> FamilyGroup? {
        do {
            let result: FamilyGroupOrNull = try await network.request(endpoint: .v3FamilyGetMyGroup)
            return result.value
        } catch let err {
            // 如果是 decoding 错误，且实际响应体是 null / 空对象 / 缺关键字段
            // → 视为"未加入家庭组"，返回 nil 而不是抛错
            if isProbablyEmptyOrInvalidGroup(err) {
                #if DEBUG
                print("[FamilyRepo] getMyGroup decode fallback → treat as not-joined; underlying: \(err)")
                #endif
                return nil
            }
            throw err
        }
    }

    /// 判定是否应把 decode 错误降级为"未加入"
    private func isProbablyEmptyOrInvalidGroup(_ error: Error) -> Bool {
        guard let api = error as? APIError else { return false }
        if case .decodingError = api { return true }
        return false
    }

    /// 退出家庭组
    public func leaveGroup(groupId: String) async throws {
        try await network.requestVoid(endpoint: .v3FamilyLeaveGroup(groupId: groupId))
    }

    /// 解散家庭组（owner）
    public func dissolveGroup(groupId: String) async throws {
        try await network.requestVoid(endpoint: .v3FamilyDissolveGroup(groupId: groupId))
    }

    /// 移除成员（owner）
    public func removeMember(groupId: String, userId: String) async throws {
        try await network.requestVoid(
            endpoint: .v3FamilyRemoveMember(groupId: groupId, userId: userId)
        )
    }

    // MARK: - 邀请码

    /// 生成邀请码（owner）
    public func generateInvite(groupId: String) async throws -> GenerateInviteResponse {
        try await network.request(endpoint: .v3FamilyGenerateInvite(groupId: groupId))
    }

    /// 兑换邀请码
    public func redeemInvite(code: String) async throws -> RedeemInviteResponse {
        try await network.request(
            endpoint: .v3FamilyRedeemInvite,
            body: RedeemInviteRequest(inviteCode: code)
        )
    }

    // MARK: - 隐私偏好

    public func updatePreferences(shareQueryResults: Bool?) async throws {
        try await network.requestVoid(
            endpoint: .v3FamilyUpdatePreferences,
            body: UpdateFamilyPreferencesRequest(shareQueryResults: shareQueryResults)
        )
    }

    // MARK: - 官方广播

    /// 拉取家庭官方消息列表
    public func getBroadcasts(limit: Int = 50) async throws -> [FamilyBroadcast] {
        try await network.request(endpoint: .v3FamilyGetBroadcasts(limit: limit))
    }

    /// 主动分享一条信息触发官方广播
    public func createBroadcast(contentType: String, content: String) async throws -> BroadcastResponse {
        try await network.request(
            endpoint: .v3FamilyCreateBroadcast,
            body: BroadcastRequest(contentType: contentType, content: content)
        )
    }
}

/// 包装 nullable FamilyGroup（服务端 GET /groups/me 在未加入时返回 null）
private struct FamilyGroupOrNull: Decodable {
    let value: FamilyGroup?
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = nil
        } else {
            self.value = try container.decode(FamilyGroup.self)
        }
    }
}
