//
//  AboutView.swift
//  IsItSafe
//
//  关于我们：顶部 logo、APP 名、当前版本号、用户协议与隐私协议入口。
//

import SwiftUI

public struct AboutView: View {
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"

    public init() {}

    private var appVersion: String {
        (Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0.0"
    }

    public var body: some View {
        List {
            Section {
                VStack(spacing: 16) {
                    Image("Logo")
                        .resizable()
                        .scaledToFit()
                        .frame(width: 80, height: 80)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    Text(languageCode == "en" ? "StarLens AI" : "星识安全助手")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.textPrimary)
                    if languageCode == "en" {
                        Text("StarLens AI · Version \(appVersion)")
                            .font(.subheadline)
                            .foregroundColor(AppTheme.textSecondary)
                        Text("Detect Risks. Protect Your Safety.")
                            .font(.footnote)
                            .foregroundColor(AppTheme.textSecondary)
                    } else {
                        Text("版本 \(appVersion)")
                            .font(.subheadline)
                            .foregroundColor(AppTheme.textSecondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 24, leading: 0, bottom: 24, trailing: 0))
            }

            Section(languageCode == "en" ? "Legal" : "协议") {
                NavigationLink {
                    InAppWebView(url: AppTheme.termsURL, title: languageCode == "en" ? "User Agreement" : "用户协议")
                } label: {
                    Text(languageCode == "en" ? "User Agreement" : "用户协议")
                }
                NavigationLink {
                    InAppWebView(url: AppTheme.privacyURL, title: languageCode == "en" ? "Privacy Policy" : "隐私协议")
                } label: {
                    Text(languageCode == "en" ? "Privacy Policy" : "隐私协议")
                }
            }
        }
        .listStyle(.insetGrouped)
        .background(AppTheme.background)
        .navigationTitle(languageCode == "en" ? "About" : "关于我们")
        .navigationBarTitleDisplayMode(.inline)
    }
}
