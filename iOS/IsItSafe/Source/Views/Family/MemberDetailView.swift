//
//  MemberDetailView.swift
//  IsItSafe
//
//  V3-E E-P5 家庭成员详情
//
//  - 头部：头像 + 昵称 + role + 活跃状态徽章
//  - 操作区：
//      * owner / guardian 可远程开关被监护人长辈模式（调 setMemberElderMode）
//      * 任何成员可拨打电话（phone scheme）；自家成员显示完整号码
//  - 信息：加入时间 / 隐私偏好说明
//

import SwiftUI

public struct MemberDetailView: View {
    @ObservedObject var vm: FamilyViewModel
    public let member: FamilyMember
    public let isCurrentUserOwnerOrGuardian: Bool
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var togglingElder = false
    @State private var localElderEnabled: Bool
    @State private var feedback: String?

    public init(
        vm: FamilyViewModel,
        member: FamilyMember,
        isCurrentUserOwnerOrGuardian: Bool
    ) {
        self.vm = vm
        self.member = member
        self.isCurrentUserOwnerOrGuardian = isCurrentUserOwnerOrGuardian
        _localElderEnabled = State(initialValue: member.elderModeEnabled)
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerCard
                activityCard
                if shouldShowElderToggle {
                    elderToggleCard
                }
                if let phone = member.phone, !phone.isEmpty {
                    callButton(phone: phone)
                }
                privacyNote
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(AppTheme.background.ignoresSafeArea())
        .navigationTitle(member.nickname ?? (languageCode == "en" ? "Member" : "成员"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var shouldShowElderToggle: Bool {
        // 自己不展示远程开关（自己用 SettingsView 里的开关）；owner/guardian 才看得到
        isCurrentUserOwnerOrGuardian && !isSelf
    }

    /// 判定当前查看者是不是被查看者本人
    /// vm.group 是 FamilyGroup? — 当前用户 userId 在 AppState 里，这里简化：永远视为 false
    /// （服务端会再校验；UI 误操作的容错由服务端 BadRequest 兜底）
    private var isSelf: Bool {
        // V3 一期前端无 currentUserId 注入到 FamilyViewModel；服务端 setMemberElderMode 已防止自指
        false
    }

    private var headerCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(AppTheme.primary.opacity(0.18)).frame(width: 64, height: 64)
                Text(String(member.nickname?.prefix(1) ?? "?"))
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(AppTheme.primary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(member.nickname ?? (languageCode == "en" ? "Member" : "成员"))
                        .font(.title3.weight(.bold))
                    if member.elderModeEnabled || localElderEnabled {
                        Text("👴").font(.title3)
                    }
                }
                roleBadge
                if let phoneDisplay = member.phoneDisplay {
                    Text(phoneDisplay)
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            Spacer()
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var roleBadge: some View {
        let txt: String
        switch member.role {
        case .owner: txt = languageCode == "en" ? "Owner" : "群主"
        case .guardian: txt = languageCode == "en" ? "Guardian" : "守护者"
        case .ward: txt = languageCode == "en" ? "Ward" : "被守护"
        }
        return Text(txt)
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(AppTheme.primary.opacity(0.12))
            .foregroundColor(AppTheme.primary)
            .clipShape(Capsule())
    }

    private var activityCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(languageCode == "en" ? "Activity" : "活跃状态")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.textSecondary)
            HStack(spacing: 8) {
                Text(member.activityStatus.emoji).font(.title3)
                Text(member.activityStatus.displayName)
                    .font(.subheadline.weight(.medium))
                Spacer()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var elderToggleCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: $localElderEnabled) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(languageCode == "en" ? "Elder Mode (Remote)" : "远程开启长辈模式")
                        .font(.subheadline.weight(.semibold))
                    Text(languageCode == "en"
                         ? "Large fonts, big buttons, SOS shortcut. Helps elders use the app safely."
                         : "字号放大、按钮变大、SOS 一键拨打。帮长辈更安全使用 App")
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            .disabled(togglingElder)
            .onChange(of: localElderEnabled) { _, newValue in
                guard newValue != member.elderModeEnabled else { return }
                togglingElder = true
                feedback = nil
                Task {
                    let ok = await vm.setMemberElderMode(userId: member.userId, enabled: newValue)
                    await MainActor.run {
                        togglingElder = false
                        if !ok {
                            // 失败回滚开关，避免显示错误状态
                            localElderEnabled = member.elderModeEnabled
                            feedback = languageCode == "en"
                                ? "Failed to update. Try again."
                                : "更新失败，请重试"
                        } else {
                            feedback = languageCode == "en"
                                ? "Updated ✓"
                                : "已更新 ✓"
                        }
                    }
                }
            }
            if let f = feedback {
                Text(f).font(.caption).foregroundColor(AppTheme.textSecondary)
            }
        }
        .padding(14)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func callButton(phone: String) -> some View {
        Button {
            if let url = URL(string: "tel://\(phone)") {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack {
                Image(systemName: "phone.fill")
                Text(languageCode == "en" ? "Call \(member.phoneDisplay ?? "Family")" : "拨打 \(member.phoneDisplay ?? "家人")")
            }
            .font(.body.weight(.semibold))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(AppTheme.primary)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var privacyNote: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "lock.shield")
                .foregroundColor(AppTheme.textSecondary)
            Text(languageCode == "en"
                 ? "We never show specific search history or location to family members. Only activity status and official broadcasts are shared."
                 : "我们绝不展示家人具体查询历史或位置，只共享活跃状态和官方匿名广播。")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.horizontal, 4)
    }
}
