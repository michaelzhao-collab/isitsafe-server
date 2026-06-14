//
//  MemberDetailView.swift
//  IsItSafe
//
//  V3-E E-P5 家庭成员详情
//
//  - 头部：头像 + 有效名字 + 角色 + 活跃状态
//  - S5-12 修改名字 section：
//      * 自己：改家庭内自我命名（display_name，全员可见）
//      * 别人：改私人备注（alias，仅自己可见）
//  - owner/guardian 可远程开关被监护人长辈模式
//  - 任何成员可拨打电话
//

import SwiftUI

public struct MemberDetailView: View {
    @ObservedObject var vm: FamilyViewModel
    public let member: FamilyMember
    public let groupId: String
    public let isCurrentUserOwnerOrGuardian: Bool
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var togglingElder = false
    @State private var localElderEnabled: Bool
    @State private var feedback: String?
    @State private var showRenameSheet = false

    // V4-P3 关怀提醒静音：true=接收（默认）/ false=已静音
    @State private var carePushOn: Bool = true
    @State private var togglingCarePush = false
    @State private var carePushFeedback: String?
    @State private var carePushLoaded = false

    public init(
        vm: FamilyViewModel,
        member: FamilyMember,
        groupId: String,
        isCurrentUserOwnerOrGuardian: Bool
    ) {
        self.vm = vm
        self.member = member
        self.groupId = groupId
        self.isCurrentUserOwnerOrGuardian = isCurrentUserOwnerOrGuardian
        _localElderEnabled = State(initialValue: member.elderModeEnabled)
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                headerCard
                nameEditCard
                activityCard
                if shouldShowElderToggle {
                    elderToggleCard
                }
                if !isSelf {
                    carePushToggleCard
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
        .navigationTitle(member.effectiveName(language: languageCode))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showRenameSheet) {
            RenameMemberSheet(
                vm: vm,
                member: member,
                groupId: groupId,
                isSelf: isSelf
            )
        }
        .task {
            // 拉一次静音状态：只在第一次出现时拉，避免下拉刷新打架
            guard !carePushLoaded, !isSelf else { return }
            let muted = await vm.listCareMutedTargets(groupId: groupId)
            await MainActor.run {
                carePushOn = !muted.contains(member.userId)
                carePushLoaded = true
            }
        }
    }

    private var shouldShowElderToggle: Bool {
        // 自己不展示远程开关；owner/guardian 才看得到
        isCurrentUserOwnerOrGuardian && !isSelf
    }

    /// 当前查看者是不是被查看者本人
    private var isSelf: Bool {
        guard let myId = UserSessionStore.shared.currentUser?.id else { return false }
        return member.userId == myId
    }

    private var headerCard: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().fill(AppTheme.primary.opacity(0.18)).frame(width: 64, height: 64)
                Text(String(member.effectiveName(language: languageCode).prefix(1)))
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(AppTheme.primary)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(member.effectiveName(language: languageCode))
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

    // MARK: - S5-12 名字修改卡片

    private var nameEditCard: some View {
        Button {
            showRenameSheet = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "person.text.rectangle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(AppTheme.primary)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(nameEditTitle)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(AppTheme.textPrimary)
                    Text(nameEditSubtitle)
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(AppTheme.textSecondary)
            }
            .padding(14)
            .background(AppTheme.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private var nameEditTitle: String {
        if isSelf {
            return languageCode == "en" ? "Edit my name in this family" : "我在该家庭的称呼"
        }
        return languageCode == "en" ? "Set a private nickname" : "给 TA 设私人备注"
    }

    private var nameEditSubtitle: String {
        if isSelf {
            return languageCode == "en"
                ? "Visible to all members of this family. Doesn't change your APP profile."
                : "全家可见。不影响 APP 我的页昵称"
        }
        return languageCode == "en"
            ? "Only you can see this. Useful for renaming Dad / Mom / Sis"
            : "仅自己可见。给爸/妈/老婆/孩子起个备注"
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
                         ? "Large fonts, big buttons, SOS shortcut."
                         : "字号放大、按钮变大、SOS 一键拨打")
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
                            localElderEnabled = member.elderModeEnabled
                            feedback = languageCode == "en" ? "Failed" : "更新失败"
                        } else {
                            feedback = languageCode == "en" ? "Updated ✓" : "已更新 ✓"
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

    /// V4-P3 关怀提醒静音开关
    /// 业主反馈："对方一直不活跃会一直收到 push，要能按人关掉"
    /// 默认 ON = 收到 ta 的不活跃 push；关掉 = 服务端 cron 跳过把我列入接收人
    private var carePushToggleCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Toggle(isOn: $carePushOn) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(languageCode == "en"
                         ? "Inactivity reminders for \(member.effectiveName(language: languageCode))"
                         : "接收 \(member.effectiveName(language: languageCode)) 的不活跃提醒")
                        .font(.subheadline.weight(.semibold))
                    Text(languageCode == "en"
                         ? "Push when this person hasn't opened the app for 2+ days."
                         : "ta 连续 2 天没打开 App 时推送提醒，关掉则不再收到")
                        .font(.caption)
                        .foregroundColor(AppTheme.textSecondary)
                }
            }
            .disabled(togglingCarePush || !carePushLoaded)
            .onChange(of: carePushOn) { _, newValue in
                // 初始化拉数据时也会触发 onChange，用 carePushLoaded 屏蔽
                guard carePushLoaded else { return }
                togglingCarePush = true
                carePushFeedback = nil
                Task {
                    let ok = await vm.setCareMute(
                        groupId: groupId,
                        targetUserId: member.userId,
                        muted: !newValue
                    )
                    await MainActor.run {
                        togglingCarePush = false
                        if !ok {
                            carePushOn = !newValue   // 回滚
                            carePushFeedback = languageCode == "en" ? "Failed" : "更新失败"
                        } else {
                            carePushFeedback = languageCode == "en" ? "Updated ✓" : "已更新 ✓"
                        }
                    }
                }
            }
            if let f = carePushFeedback {
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
                 ? "Members never see each other's specific query history. Only activity status & official broadcasts are shared."
                 : "我们绝不展示家人具体查询历史或位置，只共享活跃状态和官方匿名广播")
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - S5-12 重命名 sheet

private struct RenameMemberSheet: View {
    @ObservedObject var vm: FamilyViewModel
    let member: FamilyMember
    let groupId: String
    let isSelf: Bool
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var inputName: String
    @State private var saving = false
    @State private var error: String?

    init(vm: FamilyViewModel, member: FamilyMember, groupId: String, isSelf: Bool) {
        self.vm = vm
        self.member = member
        self.groupId = groupId
        self.isSelf = isSelf
        // 自己 → 当前 display_name；他人 → 当前 myAlias
        let initial = isSelf ? (member.displayName ?? "") : (member.myAlias ?? "")
        _inputName = State(initialValue: initial)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text(headerText), footer: Text(footerText)) {
                    TextField(placeholder, text: $inputName)
                        .autocorrectionDisabled()
                        .submitLabel(.done)
                        .onSubmit { Task { await save() } }
                }
                Section {
                    Button(role: .destructive) {
                        Task { await save(clear: true) }
                    } label: {
                        Text(languageCode == "en" ? "Reset to default" : "恢复默认")
                    }
                    .disabled(saving)
                }
                if let err = error {
                    Section {
                        Text(err)
                            .font(.caption)
                            .foregroundColor(AppTheme.riskHigh)
                    }
                }
            }
            .navigationTitle(navTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if saving { ProgressView() } else {
                            Text(languageCode == "en" ? "Save" : "保存").bold()
                        }
                    }
                    .disabled(saving || inputName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private var navTitle: String {
        if isSelf {
            return languageCode == "en" ? "My name in family" : "我的家庭称呼"
        }
        return languageCode == "en" ? "Private nickname" : "私人备注"
    }

    private var headerText: String {
        if isSelf {
            return languageCode == "en" ? "Name visible to family" : "家庭内称呼（全员可见）"
        }
        return languageCode == "en" ? "Private note for this member" : "仅自己可见的备注"
    }

    private var footerText: String {
        if isSelf {
            return languageCode == "en"
                ? "Other family members will see this name. Empty → uses your APP nickname."
                : "其他家人会看到这个名字。留空 → 用 APP 昵称"
        }
        return languageCode == "en"
            ? "Only you can see this. Useful for tagging Dad / Mom / Spouse."
            : "仅自己可见。可用于备注爸/妈/老婆"
    }

    private var placeholder: String {
        languageCode == "en" ? "Enter a name" : "输入称呼"
    }

    private func save(clear: Bool = false) async {
        saving = true
        defer { saving = false }
        let name: String? = clear ? nil : inputName.trimmingCharacters(in: .whitespacesAndNewlines)
        error = nil
        let ok: Bool
        if isSelf {
            ok = await vm.setMyDisplayName(in: groupId, name: name)
        } else {
            ok = await vm.setAlias(for: member.id, alias: name)
        }
        if ok {
            dismiss()
        } else {
            error = vm.redeemError ?? (languageCode == "en" ? "Save failed" : "保存失败")
        }
    }
}
