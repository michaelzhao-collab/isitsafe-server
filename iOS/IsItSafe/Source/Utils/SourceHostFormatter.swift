//
//  SourceHostFormatter.swift
//  IsItSafe
//
//  抓取内容的来源 URL 通常很长（Google News 跳转链 / FTC.gov 长路径），
//  详情页底部只显示主域名（去掉 www.）让用户知道来源即可。
//

import Foundation

public enum SourceHostFormatter {
    /// 从 URL 字符串里提取主域名
    /// - "https://news.google.com/rss/articles/CBM..." → "news.google.com"
    /// - "https://www.example.com/foo" → "example.com"
    /// - 解析失败 → 原始字符串截断 30 字
    public static func host(from urlString: String) -> String {
        guard let comp = URLComponents(string: urlString), let h = comp.host, !h.isEmpty else {
            return String(urlString.prefix(30))
        }
        return h.hasPrefix("www.") ? String(h.dropFirst(4)) : h
    }
}
