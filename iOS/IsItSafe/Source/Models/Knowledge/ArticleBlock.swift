//
//  ArticleBlock.swift
//  IsItSafe
//
//  TipTap 文章结构化内容的 Swift 模型，配合 SwiftUI 渲染。
//

import Foundation

/// 任意 JSON 值（用于解码 TipTap 原始 JSON 树后再二次解析）。
/// 后端 contentBlocks 是 JSON 文档对象，前端按 type 字段判断类型解析。
public indirect enum JSONValue: Codable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null; return }
        if let b = try? c.decode(Bool.self) { self = .bool(b); return }
        if let n = try? c.decode(Double.self) { self = .number(n); return }
        if let s = try? c.decode(String.self) { self = .string(s); return }
        if let a = try? c.decode([JSONValue].self) { self = .array(a); return }
        if let o = try? c.decode([String: JSONValue].self) { self = .object(o); return }
        throw DecodingError.dataCorruptedError(in: c, debugDescription: "Unsupported JSON value")
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let b): try c.encode(b)
        case .number(let n): try c.encode(n)
        case .string(let s): try c.encode(s)
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }

    public var string: String? { if case .string(let s) = self { return s } else { return nil } }
    public var number: Double? { if case .number(let n) = self { return n } else { return nil } }
    public var array: [JSONValue]? { if case .array(let a) = self { return a } else { return nil } }
    public var object: [String: JSONValue]? { if case .object(let o) = self { return o } else { return nil } }
}

/// 一段内联文本（含 bold / italic / link 等标记），SwiftUI 渲染时合并为 AttributedString
public struct InlineSpan: Identifiable {
    public let id = UUID()
    public let text: String
    public let bold: Bool
    public let italic: Bool
    public let code: Bool
    public let strike: Bool
    public let link: String?
}

/// 顶层文章块（heading / paragraph / image / list / quote / divider / codeBlock）
public enum ArticleBlock: Identifiable {
    case heading(level: Int, spans: [InlineSpan])
    case paragraph(spans: [InlineSpan])
    case image(src: String, alt: String?, caption: String?)
    case bulletList(items: [[ArticleBlock]])
    case orderedList(items: [[ArticleBlock]])
    case blockquote(blocks: [ArticleBlock])
    case codeBlock(code: String, language: String?)
    case divider

    public var id: String {
        switch self {
        case .heading(let lv, let spans): return "h\(lv)-\(spans.map(\.text).joined())"
        case .paragraph(let spans): return "p-\(spans.map(\.text).joined().prefix(40))"
        case .image(let src, _, _): return "img-\(src)"
        case .bulletList(let items): return "ul-\(items.count)-\(UUID().uuidString.prefix(6))"
        case .orderedList(let items): return "ol-\(items.count)-\(UUID().uuidString.prefix(6))"
        case .blockquote(let blocks): return "bq-\(blocks.count)-\(UUID().uuidString.prefix(6))"
        case .codeBlock(let code, _): return "code-\(code.prefix(40))"
        case .divider: return "hr-\(UUID().uuidString.prefix(6))"
        }
    }
}

/// 将 TipTap doc JSON 解析为 ArticleBlock 数组。
/// 不识别的 type 会被静默跳过（保持向前兼容，未来 admin 加新 block 老客户端也不会崩）。
public enum ArticleBlockParser {
    public static func parse(_ json: JSONValue?) -> [ArticleBlock] {
        guard let root = json?.object else { return [] }
        guard let content = root["content"]?.array else { return [] }
        return parseNodes(content)
    }

    private static func parseNodes(_ nodes: [JSONValue]) -> [ArticleBlock] {
        var result: [ArticleBlock] = []
        for node in nodes {
            guard let obj = node.object, let type = obj["type"]?.string else { continue }
            switch type {
            case "heading":
                let level = Int(obj["attrs"]?.object?["level"]?.number ?? 2)
                let spans = parseInline(obj["content"]?.array ?? [])
                result.append(.heading(level: max(1, min(level, 3)), spans: spans))
            case "paragraph":
                let spans = parseInline(obj["content"]?.array ?? [])
                // 空段落跳过，避免多余间距
                if !spans.allSatisfy({ $0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
                    result.append(.paragraph(spans: spans))
                }
            case "image":
                let attrs = obj["attrs"]?.object ?? [:]
                let src = attrs["src"]?.string ?? ""
                let alt = attrs["alt"]?.string
                let caption = attrs["title"]?.string
                if !src.isEmpty {
                    result.append(.image(src: src, alt: alt, caption: caption))
                }
            case "bulletList":
                let items = parseListItems(obj["content"]?.array ?? [])
                if !items.isEmpty { result.append(.bulletList(items: items)) }
            case "orderedList":
                let items = parseListItems(obj["content"]?.array ?? [])
                if !items.isEmpty { result.append(.orderedList(items: items)) }
            case "blockquote":
                let blocks = parseNodes(obj["content"]?.array ?? [])
                if !blocks.isEmpty { result.append(.blockquote(blocks: blocks)) }
            case "codeBlock":
                let code = parseInline(obj["content"]?.array ?? []).map(\.text).joined()
                let lang = obj["attrs"]?.object?["language"]?.string
                result.append(.codeBlock(code: code, language: lang))
            case "horizontalRule":
                result.append(.divider)
            default:
                continue
            }
        }
        return result
    }

    private static func parseListItems(_ items: [JSONValue]) -> [[ArticleBlock]] {
        items.compactMap { item -> [ArticleBlock]? in
            guard let obj = item.object, obj["type"]?.string == "listItem" else { return nil }
            return parseNodes(obj["content"]?.array ?? [])
        }
    }

    private static func parseInline(_ nodes: [JSONValue]) -> [InlineSpan] {
        nodes.compactMap { node -> InlineSpan? in
            guard let obj = node.object, obj["type"]?.string == "text" else { return nil }
            let text = obj["text"]?.string ?? ""
            var bold = false
            var italic = false
            var code = false
            var strike = false
            var link: String? = nil
            for mark in obj["marks"]?.array ?? [] {
                guard let mObj = mark.object, let mType = mObj["type"]?.string else { continue }
                switch mType {
                case "bold", "strong": bold = true
                case "italic", "em": italic = true
                case "code": code = true
                case "strike", "s": strike = true
                case "link":
                    link = mObj["attrs"]?.object?["href"]?.string
                default: break
                }
            }
            return InlineSpan(text: text, bold: bold, italic: italic, code: code, strike: strike, link: link)
        }
    }
}

