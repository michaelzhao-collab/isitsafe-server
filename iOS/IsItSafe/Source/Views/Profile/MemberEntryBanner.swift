//
//  MemberEntryBanner.swift
//  IsItSafe
//
//  会员入口：头像下方单独一块，banner 样式。区分会员/非会员，先做会员样式。
//

import SwiftUI

public struct MemberEntryBanner: View {
    public let isMember: Bool

    public init(isMember: Bool = true) {
        self.isMember = isMember
    }

    public var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "crown.fill")
                .font(.system(size: 28))
                .foregroundColor(.yellow)
            VStack(alignment: .leading, spacing: 4) {
                Text(isMember ? "会员已开通" : "开通会员")
                    .font(.headline)
                    .foregroundColor(.primary)
                Text(isMember ? "尊享更多权益" : "开通会员可以享更多权益")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(AppTheme.secondaryText)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .background(
            LinearGradient(
                colors: [
                    AppTheme.primary.opacity(0.15),
                    AppTheme.primary.opacity(0.06)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
