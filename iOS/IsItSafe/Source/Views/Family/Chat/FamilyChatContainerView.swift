//
//  FamilyChatContainerView.swift
//  IsItSafe
//
//  V5.1 家庭 Tab 的 .loaded 状态主体：把家庭群聊接进家庭 Tab。
//  = 群聊(FamilyChatView) + 顶部工具栏(切换家庭 / ⋯ 群设置·邀请) + 启动 IM 协调器。
//  取代原 FamilyGroupView 的"官方消息列表"形态（旧视图保留，不再是主路径）。
//

import SwiftUI

public struct FamilyChatContainerView: View {
    let group: FamilyGroup
    @ObservedObject var vm: FamilyViewModel
    @ObservedObject private var chat = FamilyChatCoordinator.shared
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    @State private var showInviteSheet = false
    @State private var showSwitchSheet = false
    @State private var showSettings = false

    public init(group: FamilyGroup, vm: FamilyViewModel) {
        self.group = group
        self.vm = vm
    }

    public var body: some View {
        FamilyChatView(groupId: group.id, groupTitle: group.displayName, members: group.members)
            // 切换家庭时强制重建：否则 SwiftUI 复用同一个视图，onAppear 不再触发，
            // 新群不会 enterGroup（不同步 / 不标已读 / 不拉已读名单）。
            .id(group.id)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if vm.allGroups.count > 1 {
                        Button {
                            showSwitchSheet = true
                        } label: {
                            Label(languageCode == "en" ? "Switch" : "切换", systemImage: "arrow.left.arrow.right")
                                .font(.footnote)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            showSettings = true
                        } label: {
                            Label(languageCode == "en" ? "Group Settings" : "群设置", systemImage: "gearshape")
                        }
                        Button {
                            showInviteSheet = true
                        } label: {
                            Label(languageCode == "en" ? "Invite Family" : "邀请家人", systemImage: "person.badge.plus")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                    }
                }
            }
            .navigationDestination(isPresented: $showSettings) {
                // 底导是盖在页面上的覆盖层：不隐藏会挡住列表底部的「解散家庭」（2026-10-06 真机）
                FamilyGroupSettingsView(group: group, vm: vm)
                    .mainTabBarHidden()
            }
            .sheet(isPresented: $showInviteSheet) {
                InviteFamilySheet(group: group, vm: vm)
            }
            .sheet(isPresented: $showSwitchSheet) {
                FamilySwitchSheet(vm: vm)
            }
            .onAppear {
                // 启动 IM：以我加入的全部群为同步范围，当前群优先
                let ids = vm.allGroups.map { $0.id }
                chat.start(groupIds: ids.isEmpty ? [group.id] : ids)
            }
            .onChange(of: vm.allGroups.map { $0.id }) { _, ids in
                chat.setGroups(ids.isEmpty ? [group.id] : ids)
            }
    }
}
