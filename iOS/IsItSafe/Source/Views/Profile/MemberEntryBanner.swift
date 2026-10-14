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
                .foregroundColor(isMember ? Color.yellow : AppTheme.gold)
            VStack(alignment: .leading, spacing: 6) {
                Text(titleText)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(.white)
                Text(subtitleText)
                    .font(.caption)
                    .foregroundColor(Color.white.opacity(0.85))
            }
            Spacer(minLength: 0)
            if !isMember {
                // 2026-10-14 配色 V2：非会员入口改为深蓝渐变卡 + 金色「开通」
                Text(languageCode == "en" ? "Upgrade" : "开通")
                    .font(.caption.weight(.bold))
                    .foregroundColor(Color(hex: "5A3A00"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(AppTheme.goldGradient))
            }
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
                    // 光晕用 overlay：放进 ZStack 会把背景撑到 140pt 高，渐变只盖住卡片上半截
                    AppTheme.memberGradient
                        .overlay(alignment: .topTrailing) {
                            Circle()
                                .fill(RadialGradient(colors: [AppTheme.gold.opacity(0.45), .clear], center: .center, startRadius: 0, endRadius: 70))
                                .frame(width: 140, height: 140)
                                .offset(x: 40, y: -50)
                        }
                }
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .shadow(color: (isMember ? Color.purple : AppTheme.primary).opacity(0.25), radius: 10, x: 0, y: 5)
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
