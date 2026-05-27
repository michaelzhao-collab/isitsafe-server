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
    public func getMyGroup() async throws -> FamilyGroup? {
        // 服务端在未加入时返回 null（200 + null body）
        do {
            let result: FamilyGroupOrNull = try await network.request(endpoint: .v3FamilyGetMyGroup)
            return result.value
        } catch {
            // 网络层 nil 解码失败时返回 nil
            throw error
        }
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
