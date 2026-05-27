//
//  ElderSOSView.swift
//  IsItSafe
//
//  V3-J 长辈 SOS 拨号（J-P4）
//  显示家庭成员列表 → 大头像 + 大按钮直接拨打
//  无家庭组时引导加入；多个 guardian 时让用户选
//

import SwiftUI

public struct ElderSOSView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @StateObject private var familyVM = FamilyViewModel()

    public init() {}

    public var body: some View {
        NavigationStack {
            ZStack {
                AppTheme.background.ignoresSafeArea()
                content
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button { dismiss() } label: {
                        HStack {
                            Image(systemName: "chevron.left").font(.system(size: 20, weight: .semibold))
                            Text(languageCode == "en" ? "Back" : "返回").font(.system(size: 18))
                        }.foregroundColor(AppTheme.primary)
                    }
                }
                ToolbarItem(placement: .principal) {
                    Text(languageCode == "en" ? "Call Family" : "给家人打电话")
                        .font(.system(size: 20, weight: .semibold))
                }
            }
            .onAppear { familyVM.refresh() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch familyVM.state {
        case .loading:
            ProgressView().scaleEffect(1.4)
        case .empty, .notLoggedIn:
            noFamilyView
        case .loaded(let group):
            membersList(group: group)
        case .error:
            noFamilyView
        }
    }

    private var noFamilyView: some View {
        ScrollView {
            VStack(spacing: 22) {
                Text("👨‍👩‍👧").font(.system(size: 72))
                Text(languageCode == "en"
                     ? "Family group not set up"
                     : "还没设置家庭组")
                    .font(.system(size: 22, weight: .bold))
                Text(languageCode == "en"
                     ? "Please ask your child to set this up.\nIn emergencies, call 110."
                     : "请让孩子帮您设置家庭组。\n紧急情况请直接拨打 110。")
                    .font(.system(size: 17))
                    .foregroundColor(AppTheme.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

                Button {
                    callPhone("110")
                } label: {
                    Text("📞 拨打 110 报警")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 20)
                        .background(AppTheme.riskHigh)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 32)
                .padding(.top, 12)
            }
            .padding(.top, 60)
        }
    }

    private func membersList(group: FamilyGroup) -> some View {
        // 可拨号成员：非 ward 且有 phone 字段
        let callable = group.members.filter { $0.role != .ward && ($0.phone?.isEmpty == false) }
        return ScrollView {
            VStack(spacing: 16) {
                if callable.isEmpty {
                    VStack(spacing: 8) {
                        Text("👨‍👩‍👧").font(.system(size: 56))
                        Text("家庭成员暂无可拨号码")
                            .font(.system(size: 18))
                            .foregroundColor(AppTheme.textSecondary)
                    }.padding(.top, 32)
                } else {
                    ForEach(callable) { member in
                        memberCard(member)
                    }
                }

                // 紧急情况
                Divider().padding(.vertical, 12)
                emergencyCard
            }
            .padding(.horizontal, 18)
            .padding(.top, 12)
            .padding(.bottom, 24)
        }
    }

    private func memberCard(_ member: FamilyMember) -> some View {
        VStack(spacing: 12) {
            ZStack {
                Circle().fill(LinearGradient(
                    colors: [AppTheme.primary.opacity(0.7), AppTheme.primary],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 80, height: 80)
                Text(String(member.nickname?.prefix(1) ?? "?"))
                    .font(.system(size: 30, weight: .bold))
                    .foregroundColor(.white)
            }
            Text(member.nickname ?? "家人")
                .font(.system(size: 22, weight: .bold))
            Text(roleDisplayName(member.role))
                .font(.system(size: 14))
                .foregroundColor(AppTheme.textSecondary)

            // 显示脱敏号码，避免家人手机号在 UI 文本中明文暴露
            if let display = member.phoneDisplay, !display.isEmpty {
                Text(display)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(AppTheme.textSecondary)
            }

            Button {
                // 真号仅在拨号瞬间用于 tel:// URL，不展示在 UI 文本
                if let phone = phoneFor(member) {
                    callPhone(phone)
                }
            } label: {
                Text("📞 \(languageCode == "en" ? "Call" : "拨打") \(member.nickname ?? "")")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(AppTheme.riskLow)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 2)
    }

    private var emergencyCard: some View {
        VStack(spacing: 10) {
            HStack(spacing: 6) {
                Text("🆘").font(.system(size: 22))
                Text(languageCode == "en" ? "Emergency" : "紧急情况")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppTheme.riskHigh)
            }
            Button {
                callPhone("110")
            } label: {
                Text("📞 拨打 110 报警")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 18)
                    .background(AppTheme.riskHigh)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            Button {
                callPhone("96110")
            } label: {
                Text("📞 拨打 96110 反诈中心")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(AppTheme.riskHigh)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(AppTheme.riskHigh.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(20)
        .background(AppTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(AppTheme.riskHigh, lineWidth: 2)
        )
    }

    private func roleDisplayName(_ role: FamilyMemberRole) -> String {
        switch role {
        case .owner: return languageCode == "en" ? "Owner" : "群主"
        case .guardian: return languageCode == "en" ? "Guardian" : "监护人"
        case .ward: return languageCode == "en" ? "Ward" : "被监护人"
        }
    }

    private func hasPhoneNumber(_ member: FamilyMember) -> Bool {
        return (member.phone?.isEmpty == false)
    }

    private func phoneFor(_ member: FamilyMember) -> String? {
        guard let phone = member.phone, !phone.isEmpty else { return nil }
        return phone
    }

    private func callPhone(_ number: String) {
        guard let url = URL(string: "tel://\(number)") else { return }
        #if canImport(UIKit)
        if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
        #endif
    }
}
