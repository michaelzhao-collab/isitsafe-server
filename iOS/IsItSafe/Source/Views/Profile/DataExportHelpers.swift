//
//  DataExportHelpers.swift
//  IsItSafe
//
//  V3-S5-4 数据导出辅助：临时文件 + UIActivityViewController 桥接
//

import SwiftUI
import UIKit

/// 把 URL 包成 Identifiable 以便 .sheet(item:) 使用
public struct ShareableFile: Identifiable {
    public let id = UUID()
    public let url: URL
    public init(url: URL) { self.url = url }
}

/// UIActivityViewController 桥接为 SwiftUI Sheet
public struct ActivityViewController: UIViewControllerRepresentable {
    public let items: [Any]

    public init(items: [Any]) { self.items = items }

    public func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    public func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
