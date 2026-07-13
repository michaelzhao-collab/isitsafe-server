//
//  FamilyGroupSettingsView.swift
//  IsItSafe
//
//  V5.1 群设置页（T1-8）：合并线上 ⋯ 菜单全部能力 + IM 新增项。
//  成员(群昵称/移除) · 分享查询结果 · 通知偏好 · 切换/加入 · 解散/退出。
//

import SwiftUI

public struct FamilyGroupSettingsView: View {
    let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @ObservedObject private var chat = FamilyChatCoordinator.shared
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @Environment(\.dismiss) private var dismiss

    @State private var shareQueryResults = true
    @State private var chatMuted = false
    @State private var editingMember: FamilyMember?
    @State private var nicknameDraft = ""
    @State private var showDissolveConfirm = false
    @State private var showLeaveConfirm = false
    @State private var showNotificationSettings = false
    @State private var showRedeemSheet = false

    private var isEN: Bool { languageCode == "en" }
    private var isOwner: Bool { group.isOwner }

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        List {
            membersSection
            preferencesSection
            multiFamilySection
            dangerSection
        }
        .navigationTitle(isEN ? "Group Settings" : "群设置")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { chatMuted = chat.isMuted(group.id) }
        .alert(isEN ? "Set nickname (visible to all)" : "设置群昵称（全员可见）", isPresented: Binding(
            get: { editingMember != nil }, set: { if !$0 { editingMember = nil } })) {
            TextField(isEN ? "Nickname" : "群昵称", text: $nicknameDraft)
            Button(isEN ? "Save" : "保存") { saveNickname() }
            Button(isEN ? "Cancel" : "取消", role: .cancel) { editingMember = nil }
        }
        .confirmationDialog(isEN ? "Dissolve this family?" : "解散家庭？",
                            isPresented: $showDissolveConfirm, titleVisibility: .visible) {
            Button(isEN ? "Dissolve" : "确认解散", role: .destructive) {
                Task { if await vm.dissolveGroup(groupId: group.id) { dismiss() } }
            }
        } message: { Text(isEN ? "All members will be removed. This cannot be undone." : "所有成员将被移出，操作不可撤销。") }
        .confirmationDialog(isEN ? "Leave this family?" : "退出家庭？",
                            isPresented: $showLeaveConfirm, titleVisibility: .visible) {
            Button(isEN ? "Leave" : "确认退出", role: .destructive) {
                Task { if await vm.leaveGroup(groupId: group.id) { dismiss() } }
            }
        }
        .navigationDestination(isPresented: $showNotificationSettings) { NotificationSettingsView() }
        .sheet(isPresented: $showRedeemSheet) { RedeemInviteSheet(vm: vm) }
    }

    // MARK: - 成员

    private var membersSection: some View {
        Section {
            ForEach(group.members) { member in
                HStack(spacing: 12) {
                    avatar(member)
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Text(member.effectiveName).font(.body)
                            if member.userId == group.ownerUserId {
                                tag(isEN ? "Owner" : "群主", color: Color(hex: "B45309"))
                            }
                            if member.elderModeEnabled {
                                tag(isEN ? "Elder" : "长辈", color: AppTheme.primary)
                            }
                        }
                        if member.displayName == nil {
                            Text(isEN ? "No nickname · tap to set" : "未设群昵称 · 点击设置")
                                .font(.caption).foregroundColor(AppTheme.textSecondary)
                        }
                    }
                    Spacer()
                    // 群主可移除他人（不能移除自己）
                    if isOwner && member.userId != group.ownerUserId {
                        Button(role: .destructive) {
                            Task { _ = await vm.removeMember(groupId: group.id, userId: member.userId) }
                        } label: { Text(isEN ? "Remove" : "移除").font(.caption).foregroundColor(AppTheme.riskHigh) }
                            .buttonStyle(.plain)
                    }
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    // 群主可改任意人；本人也可改自己
                    guard isOwner || member.userId == currentUserId else { return }
                    nicknameDraft = member.displayName ?? ""
                    editingMember = member
                }
            }
        } header: {
            Text((isEN ? "Members " : "成员 ") + "\(group.memberCount)/\(group.maxMembers)"
                 + (group.maxMembers <= 5 ? (isEN ? " · Free up to 5" : " · 免费版最多 5 人") : ""))
        } footer: {
            if group.memberCount >= group.maxMembers && group.maxMembers <= 5 {
                Text(isEN ? "Upgrade to Family plan for up to 10 members." : "升级家庭包，最多 10 人，并解锁全家会员权益。")
            }
        }
    }

    // MARK: - 偏好

    private var preferencesSection: some View {
        Section(isEN ? "Preferences" : "偏好") {
            Toggle(isOn: $shareQueryResults) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(isEN ? "Share my risk results" : "分享我的查询结果")
                    Text(isEN ? "High-risk queries auto-broadcast to the group" : "开启后，高风险查询会自动播报到群里")
                        .font(.caption).foregroundColor(AppTheme.textSecondary)
                }
            }
            .onChange(of: shareQueryResults) { _, v in Task { _ = await vm.setShareQueryResults(v) } }

            Toggle(isOn: $chatMuted) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(isEN ? "Mute this group" : "消息免打扰")
                    Text(isEN ? "No banner alerts; unread still counts (strong risk alerts unaffected)"
                             : "不再弹横幅提醒，未读仍计数（高风险强提醒不受影响）")
                        .font(.caption).foregroundColor(AppTheme.textSecondary)
                }
            }
            .onChange(of: chatMuted) { _, v in Task { _ = await chat.setChatMute(groupId: group.id, muted: v) } }

            Button { showNotificationSettings = true } label: {
                settingRow(title: isEN ? "Notification preferences" : "通知偏好设置",
                           sub: isEN ? "Care alerts / risk alerts / daily scam" : "关怀提醒 / 风险提醒 / 每日一骗")
            }
            NavigationLink {
                FamilyProtectionChecklistView(group: group)
            } label: {
                settingRow(title: isEN ? "Protection checklist" : "家庭防护清单",
                           sub: isEN ? "What you can do for the family" : "我能为这个家做什么")
            }
        }
    }

    private var multiFamilySection: some View {
        Section {
            Button { showRedeemSheet = true } label: {
                settingRow(title: isEN ? "Join another family with a code" : "用邀请码加入其他家庭", sub: nil)
            }
        }
    }

    private var dangerSection: some View {
        Section {
            if isOwner {
                Button(role: .destructive) { showDissolveConfirm = true } label: {
                    Text(isEN ? "Dissolve family" : "解散家庭").foregroundColor(AppTheme.riskHigh)
                }
            } else {
                Button(role: .destructive) { showLeaveConfirm = true } label: {
                    Text(isEN ? "Leave family" : "退出家庭").foregroundColor(AppTheme.riskHigh)
                }
            }
        }
    }

    // MARK: - helpers

    private var currentUserId: String? { TokenStore.shared.userId }

    private func saveNickname() {
        guard let m = editingMember else { return }
        let name = nicknameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        editingMember = nil
        Task {
            if isOwner {
                _ = await vm.setMemberDisplayNameByOwner(in: group.id, memberId: m.id, name: name.isEmpty ? nil : name)
            } else {
                _ = await vm.setMyDisplayName(in: group.id, name: name.isEmpty ? nil : name)
            }
        }
    }

    private func avatar(_ m: FamilyMember) -> some View {
        Text(String(m.effectiveName.prefix(1)))
            .font(.system(size: 16, weight: .semibold)).foregroundColor(.white)
            .frame(width: 40, height: 40)
            .background(RoundedRectangle(cornerRadius: 10).fill(AppTheme.primary.opacity(0.7)))
    }

    private func tag(_ text: String, color: Color) -> some View {
        Text(text).font(.caption2.weight(.bold)).foregroundColor(color)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(RoundedRectangle(cornerRadius: 5).fill(color.opacity(0.12)))
    }

    private func settingRow(title: String, sub: String?) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).foregroundColor(AppTheme.textPrimary)
                if let sub { Text(sub).font(.caption).foregroundColor(AppTheme.textSecondary) }
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundColor(AppTheme.textSecondary)
        }
    }
}
