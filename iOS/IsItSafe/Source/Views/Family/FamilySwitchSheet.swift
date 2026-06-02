//
//  FamilySwitchSheet.swift
//  IsItSafe
//
//  S5-10 多家庭支持：切换家庭组 sheet
//
//  - 列出我加入的所有家庭组（含 owner / member）
//  - 当前选中的家庭打勾
//  - 点击其他家庭 → 切换 + dismiss
//  - 底部"创建新家庭"按钮 → 打开 CreateFamilyGroupSheet
//

import SwiftUI

public struct FamilySwitchSheet: View {
    @ObservedObject var vm: FamilyViewModel
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var showCreateSheet = false

    /// 当前选中的家庭 id（从 vm.state 推导）
    private var currentGroupId: String? {
        if case .loaded(let g) = vm.state { return g.id }
        return nil
    }

    public init(vm: FamilyViewModel) {
        self.vm = vm
    }

    public var body: some View {
        NavigationStack {
            List {
                Section(header: Text(languageCode == "en" ? "My Families" : "我的家庭")) {
                    ForEach(vm.allGroups) { group in
                        Button {
                            vm.switchTo(groupId: group.id)
                            dismiss()
                        } label: {
                            row(for: group)
                        }
                        .buttonStyle(.plain)
                    }
                }
                // 已达 owned 上限（免费 1 / Pro 3）则隐藏创建入口，
                // 跟 FamilyGroupView 右上角 Menu 同步逻辑
                if vm.canCreateMoreGroup(isPremium: appState.subscriptionActive) {
                    Section {
                        Button {
                            showCreateSheet = true
                        } label: {
                            HStack {
                                Image(systemName: "plus.circle.fill")
                                    .foregroundColor(AppTheme.primary)
                                Text(languageCode == "en" ? "Create new family" : "创建新家庭")
                                    .foregroundColor(AppTheme.primary)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(languageCode == "en" ? "Switch Family" : "切换家庭")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Done" : "完成") { dismiss() }
                }
            }
            .sheet(isPresented: $showCreateSheet, onDismiss: { dismiss() }) {
                CreateFamilyGroupSheet(vm: vm)
            }
        }
    }

    private func row(for group: FamilyGroup) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(group.isOwner ? AppTheme.primary.opacity(0.18) : AppTheme.textSecondary.opacity(0.12))
                    .frame(width: 38, height: 38)
                Image(systemName: group.isOwner ? "star.fill" : "person.2.fill")
                    .font(.system(size: 16))
                    .foregroundColor(group.isOwner ? AppTheme.primary : AppTheme.textSecondary)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(group.displayName)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(AppTheme.textPrimary)
                Text(roleText(for: group))
                    .font(.caption)
                    .foregroundColor(AppTheme.textSecondary)
            }
            Spacer()
            if group.id == currentGroupId {
                Image(systemName: "checkmark")
                    .foregroundColor(AppTheme.primary)
                    .font(.system(size: 14, weight: .semibold))
            }
        }
        .padding(.vertical, 4)
    }

    private func roleText(for group: FamilyGroup) -> String {
        if group.isOwner {
            return languageCode == "en"
                ? "Owner · \(group.memberCount)/\(group.maxMembers) members"
                : "群主 · \(group.memberCount)/\(group.maxMembers) 名成员"
        }
        return languageCode == "en"
            ? "Member · \(group.memberCount)/\(group.maxMembers) members"
            : "成员 · \(group.memberCount)/\(group.maxMembers) 名成员"
    }
}
