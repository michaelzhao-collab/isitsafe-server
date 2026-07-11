//
//  FamilyProtectionChecklistView.swift
//  IsItSafe
//
//  V5.1 家庭防护清单（T2-9）：把"守护"变得可见——子女的"我能为这个家做什么"抓手。
//  条目由当前家庭状态推导（成员数/长辈模式/群昵称完整度/推送授权）。
//

import SwiftUI
import UserNotifications

public struct FamilyProtectionChecklistView: View {
    let group: FamilyGroup
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var pushAuthorized = false

    private var isEN: Bool { languageCode == "en" }

    public init(group: FamilyGroup) { self.group = group }

    private struct Item: Identifiable {
        let id = UUID()
        let done: Bool
        let title: String
        let detail: String
    }

    private var items: [Item] {
        let hasElder = group.members.contains { $0.elderModeEnabled }
        let allNamed = group.members.allSatisfy { $0.displayName != nil }
        let multiMember = group.members.count >= 2
        return [
            Item(done: multiMember,
                 title: isEN ? "Family joined the group" : "全家都已加入家庭群",
                 detail: "\(group.members.count) " + (isEN ? "members" : "位成员")),
            Item(done: hasElder,
                 title: isEN ? "Elders turned on Elder Mode" : "爸妈开启了长辈模式",
                 detail: isEN ? "Large text + voice first" : "大字 + 语音优先"),
            Item(done: pushAuthorized,
                 title: isEN ? "You enabled risk alerts" : "你开启了高风险强提醒",
                 detail: isEN ? "Get notified the moment they hit a risk" : "爸妈遇险第一时间通知你"),
            Item(done: allNamed,
                 title: isEN ? "Set nicknames for members" : "给成员设置群昵称",
                 detail: isEN ? "So cards show who's who" : "卡片里能看清是谁"),
        ]
    }

    public var body: some View {
        let done = items.filter { $0.done }.count
        List {
            Section {
                ForEach(items) { item in
                    HStack(spacing: 12) {
                        Image(systemName: item.done ? "checkmark.circle.fill" : "exclamationmark.circle")
                            .foregroundColor(item.done ? AppTheme.riskLow : Color(hex: "F59E0B"))
                            .font(.system(size: 22))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.body)
                            Text(item.detail).font(.caption).foregroundColor(AppTheme.textSecondary)
                        }
                    }
                }
            } header: {
                Text((isEN ? "Completed " : "完成 ") + "\(done)/\(items.count) · "
                     + (isEN ? "each step keeps the family safer" : "每完成一项，家里更安全一分"))
            }
        }
        .navigationTitle(isEN ? "Protection Checklist" : "家庭防护清单")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            pushAuthorized = settings.authorizationStatus == .authorized
        }
    }
}
