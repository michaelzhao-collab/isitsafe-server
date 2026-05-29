//
//  FamilyGroupView.swift
//  IsItSafe
//
//  V3-E 已加入家庭组的主视图（对应 mockup E-P1）
//  当前为 W2.D1 骨架：仅展示组卡片 + 成员列表 + 邀请/退出按钮
//  邀请码 UI、官方消息列表、主动分享等留 W2.D3 实现
//

import SwiftUI

public struct FamilyGroupView: View {
    public let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showInviteSheet = false
    @State private var showLeaveConfirm = false
    @State private var showDissolveConfirm = false
    @State private var showShareSheet = false

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Spacing.md) {
                headerCard
                memberSection
                actionsSection
                if !group.isOwner { leaveButton }
                if group.isOwner { dissolveButton }
            }
            .padding(AppTheme.Spacing.lg)
        }
        .background(AppTheme.background)
        .sheet(isPresented: $showInviteSheet) {
            InviteFamilySheet(group: group, vm: vm)
        }
        .sheet(isPresented: $showShareSheet) {
            ShareToFamilySheet(vm: vm)
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
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(languageCode == "en" ? "My Family Group" : "我的家庭组")
                        .font(.caption).opacity(0.85)
                    Text(group.displayName)
                        .font(.title3.weight(.bold))
                }
                Spacer()
                Text(languageCode == "en" ? "Free" : "免费")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10).padding(.vertical, 4)
                    .background(Color.white.opacity(0.2))
                    .clipShape(Capsule())
            }
            HStack {
                Text(languageCode == "en"
                     ? "\(group.memberCount) / \(group.maxMembers) members"
                     : "\(group.memberCount) / \(group.maxMembers) 名成员")
                    .font(.caption).opacity(0.9)
                Spacer()
                Text(languageCode == "en"
                     ? "Today official alerts 0/1"
                     : "今日官方提醒 0/1 次")
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

    // MARK: - Members

    private var memberSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Members" : "家庭成员")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            VStack(spacing: 0) {
                ForEach(group.members) { member in
                    NavigationLink {
                        // E-P5 独立成员详情页（S4-3）
                        MemberDetailView(
                            vm: vm,
                            member: member,
                            isCurrentUserOwnerOrGuardian: group.isOwner
                        )
                    } label: {
                        memberRow(member: member)
                    }
                    .buttonStyle(.plain)
                    if member.id != group.members.last?.id {
                        Divider().padding(.leading, 60)
                    }
                }
            }
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
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
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
    }

    // MARK: - Actions

    private var actionsSection: some View {
        VStack(spacing: 10) {
            // V3-E 主动分享触发官方广播（所有成员都可点）
            Button { showShareSheet = true } label: {
                HStack {
                    Image(systemName: "megaphone.fill")
                    Text(languageCode == "en" ? "Share to Family" : "分享信息到家庭")
                }
                .font(.body.weight(.semibold))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(AppTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
            }

            if group.isOwner && !group.isFull {
                Button { showInviteSheet = true } label: {
                    HStack {
                        Image(systemName: "person.badge.plus")
                        Text(languageCode == "en" ? "Invite Family" : "邀请家人")
                    }
                    .font(.body.weight(.semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(AppTheme.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
                }
            }
            if group.isFull {
                Text(languageCode == "en"
                     ? "Group is full (5/5)"
                     : "家庭组已满 (5/5)")
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
        }
    }

    private var leaveButton: some View {
        Button { showLeaveConfirm = true } label: {
            Text(languageCode == "en" ? "Leave Group" : "退出家庭组")
                .font(.body)
                .foregroundColor(AppTheme.riskHigh)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .padding(.top, 8)
    }

    private var dissolveButton: some View {
        Button { showDissolveConfirm = true } label: {
            Text(languageCode == "en" ? "Dissolve Group" : "解散家庭组")
                .font(.body)
                .foregroundColor(AppTheme.riskHigh)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(AppTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppTheme.CornerRadius.medium))
        }
        .padding(.top, 8)
    }
}
