//
//  DataExportHelpers.swift
//  IsItSafe
//
//  S5-4 数据导出辅助：FileDocument 用于 .fileExporter
//
//  历史：之前用 ShareableFile + ActivityViewController，但 ShareableFile.id=UUID()
//        每次 binding 求值都新 UUID 导致 SwiftUI 反复 dismiss + present 死循环。
//        改用 .fileExporter（系统 Files 保存对话框）后无此问题，
//        且更符合"数据备份"的使用场景。
//

import SwiftUI
import UniformTypeIdentifiers

/// 导出数据的 FileDocument 包装
/// 用于 SwiftUI `.fileExporter()` modifier
public struct ExportDataDocument: FileDocument {
    public static var readableContentTypes: [UTType] = [.json]
    public static var writableContentTypes: [UTType] = [.json]

    public let data: Data

    public init(data: Data) {
        self.data = data
    }

    public init(configuration: ReadConfiguration) throws {
        self.data = configuration.file.regularFileContents ?? Data()
    }

    public func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
