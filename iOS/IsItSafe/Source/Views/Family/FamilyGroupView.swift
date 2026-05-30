//
//  FamilyGroupView.swift
//  IsItSafe
//
//  V3-E 已加入家庭组的主视图（E-P1）
//
//  S5-7 布局重新设计（按用户反馈）：
//   - 解散 / 退出 入口太显眼 → 收进右上角 toolbar Menu（⋯）
//   - 分享信息按钮太强 → 柔和样式（浅蓝填充 + 蓝字 + 蓝色 icon）
//   - 邀请家人 → 成员列表末尾加 +邀请家人 占位行（owner 可见）+ 菜单里也有
//
//  顶部 toolbar 由外层 FamilyView 的 NavigationStack 接管
//

import SwiftUI

public struct FamilyGroupView: View {
    public let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showInviteSheet = false
    @State private var showLeaveConfirm = false
    @State private var showDissolveConfirm = false
    @State private var showShareSheet = false
    @State private var showPrivacy = false

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.md) {
                headerCard
                memberSection
                shareAction
            }
            .padding(AppTheme.Spacing.lg)
        }
        .background(AppTheme.background)
        // 右上角 ⋯ Menu：隐藏次级操作（退出/解散/隐私）
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    if group.isOwner && !group.isFull {
                        Button {
                            showInviteSheet = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Invite Family" : "邀请家人",
                                systemImage: "person.badge.plus"
                            )
                        }
                    }
                    Button {
                        showPrivacy = true
                    } label: {
                        Label(
                            languageCode == "en" ? "Privacy Settings" : "隐私设置",
                            systemImage: "lock.shield"
                        )
                    }
                    Divider()
                    if group.isOwner {
                        Button(role: .destructive) {
                            showDissolveConfirm = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Dissolve Group" : "解散家庭组",
                                systemImage: "xmark.circle"
                            )
                        }
                    } else {
                        Button(role: .destructive) {
                            showLeaveConfirm = true
                        } label: {
                            Label(
                                languageCode == "en" ? "Leave Group" : "退出家庭组",
                                systemImage: "rectangle.portrait.and.arrow.right"
                            )
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(AppTheme.textPrimary)
                }
            }
        }
        .sheet(isPresented: $showInviteSheet) {
            InviteFamilySheet(group: group, vm: vm)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareToFamilySheet(vm: vm)
        }
        .sheet(isPresented: $showPrivacy) {
            FamilyPrivacySheet(vm: vm)
        }
        .confirmationDialog(
            languageCode == "en" ? "Leave family group?" : "退出家庭组？",
            isPresented: $showLeaveConfirm
        ) {
            Button(languageCode == "en" ? "Leave" : "确认退出", role: .destructive) {
                Task { await vm.leaveGroup(groupId: group.id) }
            }
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
        }
        .confirmationDialog(
            languageCode == "en" ? "Dissolve this group?" : "解散家庭组？",
            isPresented: $showDissolveConfirm
        ) {
            Button(languageCode == "en" ? "Dissolve" : "确认解散", role: .destructive) {
                Task { await vm.dissolveGroup(groupId: group.id) }
            }
            Button(languageCode == "en" ? "Cancel" : "取消", role: .cancel) {}
        } message: {
            Text(languageCode == "en"
                 ? "All members will leave; cannot be undone."
                 : "所有成员将退出，操作不可撤销")
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(languageCode == "en" ? "My Family Group" : "我的家庭组")
                        .font(.caption).opacity(0.85)
                    Text(group.displayName)
                        .font(.title3.weight(.bold))
                        .lineLimit(1)
                }
                Spacer()
                tierBadge
            }
            HStack {
                Image(systemName: "person.2.fill")
                    .font(.caption2).opacity(0.9)
                Text(memberCountText)
                    .font(.caption).opacity(0.9)
                Spacer()
                Image(systemName: "megaphone.fill")
                    .font(.caption2).opacity(0.9)
                // TODO group 模型加 todayBroadcastUsed / Quota；当前显示与原版一致的占位
                Text(languageCode == "en"
                     ? "Today 0/1"
                     : "今日 0/1 次")
                    .font(.caption).opacity(0.9)
            }
        }
        .foregroundColor(.white)
        .padding(AppTheme.Spacing.lg)
        .background(
            LinearGradient(colors: [AppTheme.primary, AppTheme.premiumHeader],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
    }

    /// 免费 / Pro 徽章
    private var tierBadge: some View {
        let isPro = appState.subscriptionActive
        let text: String = isPro
            ? (languageCode == "en" ? "Pro" : "Pro")
            : (languageCode == "en" ? "Free" : "免费")
        return Text(text)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(Color.white.opacity(isPro ? 0.28 : 0.18))
            .clipShape(Capsule())
    }

    private var memberCountText: String {
        // group.maxMembers 由 server 端按 owner 订阅状态动态下发：免费 3 / Pro 10
        if languageCode == "en" {
            return "\(group.memberCount) / \(group.maxMembers) members"
        }
        return "\(group.memberCount) / \(group.maxMembers) 名成员"
    }

    // MARK: - Members

    private var memberSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Members" : "家庭成员")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            VStack(spacing: 0) {
                ForEach(group.members) { member in
                    NavigationLink {
                        MemberDetailView(
                            vm: vm,
                            member: member,
                            isCurrentUserOwnerOrGuardian: group.isOwner
                        )
                    } label: {
                        memberRow(member: member)
                    }
                    .buttonStyle(.plain)
                    if member.id != group.members.last?.id || canShowInviteRow {
                        Divider().padding(.leading, 60)
                    }
                }
                // owner & 未满 → 列表末尾加邀请家人占位行
                if canShowInviteRow {
                    Button {
                        showInviteSheet = true
                    } label: {
                        inviteRowLabel
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            if group.isFull {
                Text(languageCode == "en"
                     ? "Group full (\(group.maxMembers)/\(group.maxMembers)). Upgrade to expand."
                     : "家庭组已满 (\(group.maxMembers)/\(group.maxMembers))，升级 Pro 可扩容至 10 人")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
                    .padding(.horizontal, 4)
            }
        }
    }

    private var canShowInviteRow: Bool {
        group.isOwner && !group.isFull
    }

    private var inviteRowLabel: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .strokeBorder(AppTheme.primary.opacity(0.4), style: StrokeStyle(lineWidth: 1.2, dash: [3, 2]))
                    .frame(width: 40, height: 40)
                Image(systemName: "plus")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
            }
            Text(languageCode == "en" ? "Invite family" : "邀请家人")
                .font(.subheadline.weight(.medium))
                .foregroundColor(AppTheme.primary)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
    }

    private func memberRow(member: FamilyMember) -> some View {
        HStack(spacing: 12) {
            // 头像占位
            ZStack {
                Circle()
                    .fill(AppTheme.primary.opacity(0.2))
                    .frame(width: 40, height: 40)
                Text(String(member.nickname?.prefix(1) ?? "?"))
                    .font(.headline)
                    .foregroundColor(AppTheme.primary)
            }
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(member.nickname ?? "用户")
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(AppTheme.textPrimary)
                    if member.role == .owner {
                        Text(languageCode == "en" ? "Owner" : "群主")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(AppTheme.primary.opacity(0.12))
                            .foregroundColor(AppTheme.primary)
                            .clipShape(Capsule())
                    }
                    if member.elderModeEnabled {
                        Text("👴").font(.caption)
                    }
                }
                Text("\(member.activityStatus.emoji) \(member.activityStatus.displayName)")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
    }

    // MARK: - 主 action：分享信息（柔和样式）

    private var shareAction: some View {
        Button { showShareSheet = true } label: {
            HStack(spacing: 8) {
                Image(systemName: "megaphone.fill")
                Text(languageCode == "en" ? "Share to Family" : "分享信息到家庭")
            }
            .font(.body.weight(.semibold))
            .foregroundColor(AppTheme.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.primary.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
    }
}

// MARK: - 占位：隐私设置 sheet

/// 暂未独立实现完整隐私设置页（S6 再做），先用一个简易 sheet 占位
/// 内含：shareQueryResults 开关 + 说明文案
private struct FamilyPrivacySheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var shareQueryResults: Bool = true
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section(footer: Text(languageCode == "en"
                                     ? "When OFF, your high-risk queries won't automatically broadcast as 'StarLens Official' to family. Manual share still works."
                                     : "关闭后，你查询的高风险结果不会自动以'StarLens 官方'名义广播给家人。你仍可手动分享信息。")) {
                    Toggle(isOn: $shareQueryResults) {
                        Text(languageCode == "en"
                             ? "Auto-broadcast my high-risk queries"
                             : "我的高风险查询自动广播")
                    }
                    .disabled(saving)
                    .onChange(of: shareQueryResults) { _, newValue in
                        saving = true
                        Task {
                            // TODO 调 vm.updatePreferences(shareQueryResults: newValue)
                            try? await Task.sleep(nanoseconds: 200_000_000)
                            await MainActor.run { saving = false }
                        }
                    }
                }
            }
            .navigationTitle(languageCode == "en" ? "Privacy" : "隐私设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
        }
    }
}
