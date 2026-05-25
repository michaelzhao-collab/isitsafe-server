//
//  MemberEntryBanner.swift
//  IsItSafe
//
//  会员入口：头像下方单独一块，banner 样式。区分会员/非会员，先做会员样式。
//

import SwiftUI

public struct MemberEntryBanner: View {
    public let isMember: Bool
    public let vipExpireDate: String?

    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init(isMember: Bool = true, vipExpireDate: String? = nil) {
        self.isMember = isMember
        self.vipExpireDate = vipExpireDate
    }

    public var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "crown.fill")
                .font(.system(size: 28))
                .foregroundColor(isMember ? Color.yellow : AppTheme.primary)
            VStack(alignment: .leading, spacing: 6) {
                Text(titleText)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(isMember ? Color.white : .primary)
                Text(subtitleText)
                    .font(.caption)
                    .foregroundColor(isMember ? Color.white.opacity(0.9) : AppTheme.secondaryText)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 14)
        .background(
            Group {
                if isMember {
                    LinearGradient(
                        colors: [
                            Color(red: 0.22, green: 0.08, blue: 0.45),
                            Color(red: 0.42, green: 0.16, blue: 0.70)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                } else {
                    LinearGradient(
                        colors: [
                            AppTheme.primary.opacity(0.15),
                            AppTheme.primary.opacity(0.06)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                }
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private var titleText: String {
        if isMember {
            return languageCode == "en" ? "StarLens VIP" : "星识 VIP"
        }
        return languageCode == "en" ? "Upgrade to Full Protection" : "开通会员"
    }

    private var subtitleText: String {
        if isMember {
            if let date = vipExpireDate, !date.isEmpty {
                return languageCode == "en" ? "Valid until: \(date)" : "有效期：\(date)"
            }
            return languageCode == "en" ? "Enjoy all VIP benefits" : "尊享更多权益"
        }
        return languageCode == "en" ? "Enjoy more protection with VIP" : "开通会员可以享更多权益"
    }
}
