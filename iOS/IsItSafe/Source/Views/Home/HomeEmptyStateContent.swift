//
//  HomeEmptyStateContent.swift
//  IsItSafe
//
//  首页空状态：主题、副标题、能力表格，纯展示不可点击。
//

import SwiftUI

public struct HomeEmptyStateContent: View {
    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            themeBlock
            subtitleBlock
            capabilityTable
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 主题：加粗醒目，左对齐
    private var themeBlock: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("不确定是真是假？")
                .font(.title2.bold())
                .foregroundColor(AppTheme.textPrimary)
            Text("用防骗助手查一查")
                .font(.title2.bold())
                .foregroundColor(AppTheme.textPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 副标题小字，左对齐
    private var subtitleBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("输入消息、电话、网址或上传截图")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
            Text("AI帮你分析风险")
                .font(.subheadline)
                .foregroundColor(AppTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 能力表格：小字弱化，居中
    private var capabilityTable: some View {
        let rows: [(String, String, String, String)] = [
            ("诈骗电话识别", "检测陌生号码", "网址安全检测", "检查链接风险"),
            ("平台风险查询", "公司靠谱吗？", "转账诈骗识别", "安全账户骗局"),
            ("截图风险识别", "上传截图分析", "投资诈骗识别", "高收益骗局"),
            ("客服电话核验", "是否官方客服", "短信诈骗检测", "中奖贷款短信"),
        ]
        return VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
                HStack(spacing: 0) {
                    tableCell(title: row.0, subtitle: row.1, showTrailingBorder: true)
                    tableCell(title: row.2, subtitle: row.3, showTrailingBorder: false)
                }
                if index < rows.count - 1 {
                    tableDividerH()
                }
            }
        }
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(AppTheme.border.opacity(0.8), lineWidth: 1)
        )
        .padding(.top, 8)
        .frame(maxWidth: .infinity)
    }

    private func tableCell(title: String, subtitle: String, showTrailingBorder: Bool) -> some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundColor(AppTheme.textSecondary)
            Text(subtitle)
                .font(.caption2)
                .foregroundColor(AppTheme.textSecondary.opacity(0.85))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .padding(.horizontal, 8)
        .overlay(
            Group {
                if showTrailingBorder {
                    Rectangle()
                        .frame(width: 1)
                        .foregroundColor(AppTheme.border.opacity(0.8))
                }
            },
            alignment: .trailing
        )
    }

    private func tableDividerH() -> some View {
        Rectangle()
            .fill(AppTheme.border.opacity(0.8))
            .frame(height: 1)
    }
}

#if DEBUG
struct HomeEmptyStateContent_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            HomeEmptyStateContent()
        }
        .background(AppTheme.background)
    }
}
#endif
