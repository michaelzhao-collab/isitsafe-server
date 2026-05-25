//
//  PhoneCountry.swift
//  IsItSafe
//
//  国际区号 + 国家选择（用于手机号登录）；默认由 Locale / IP / 服务端 region-hint 推断。
//

import Foundation

public struct PhoneCountry: Identifiable, Hashable {
    public let id: String
    /// 如 "+86"
    public let dialCode: String
    public let nameEn: String
    public let nameZh: String

    public var flagEmoji: String {
        let base: UInt32 = 127397
        var s = ""
        for v in id.uppercased().unicodeScalars {
            guard let scalar = UnicodeScalar(base + v.value) else { continue }
            s.append(String(scalar))
        }
        return s.isEmpty ? "🌐" : s
    }

    public static func find(iso: String) -> PhoneCountry? {
        let u = iso.uppercased()
        return all.first { $0.id == u }
    }

    /// 设备区域（无定位权限）
    public static func defaultForLocale() -> PhoneCountry {
        let region = Locale.current.region?.identifier ?? "US"
        return find(iso: region) ?? find(iso: "US")!
    }

    /// ipapi.co/json（HTTPS，无需定位权限）
    public static func fetchIPCountryCode() async -> String? {
        guard let url = URL(string: "https://ipapi.co/json") else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 5
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return (obj?["country_code"] as? String)?.uppercased()
        } catch {
            return nil
        }
    }

    /// 常用国家列表（含主要区号）；未列出可在同区号国家中选最接近项后手动改号码
    public static let all: [PhoneCountry] = [
        PhoneCountry(id: "CN", dialCode: "+86", nameEn: "China", nameZh: "中国"),
        PhoneCountry(id: "US", dialCode: "+1", nameEn: "United States", nameZh: "美国"),
        PhoneCountry(id: "GB", dialCode: "+44", nameEn: "United Kingdom", nameZh: "英国"),
        PhoneCountry(id: "JP", dialCode: "+81", nameEn: "Japan", nameZh: "日本"),
        PhoneCountry(id: "KR", dialCode: "+82", nameEn: "South Korea", nameZh: "韩国"),
        PhoneCountry(id: "TW", dialCode: "+886", nameEn: "Taiwan", nameZh: "台湾"),
        PhoneCountry(id: "HK", dialCode: "+852", nameEn: "Hong Kong", nameZh: "香港"),
        PhoneCountry(id: "MO", dialCode: "+853", nameEn: "Macau", nameZh: "澳门"),
        PhoneCountry(id: "SG", dialCode: "+65", nameEn: "Singapore", nameZh: "新加坡"),
        PhoneCountry(id: "MY", dialCode: "+60", nameEn: "Malaysia", nameZh: "马来西亚"),
        PhoneCountry(id: "TH", dialCode: "+66", nameEn: "Thailand", nameZh: "泰国"),
        PhoneCountry(id: "VN", dialCode: "+84", nameEn: "Vietnam", nameZh: "越南"),
        PhoneCountry(id: "PH", dialCode: "+63", nameEn: "Philippines", nameZh: "菲律宾"),
        PhoneCountry(id: "ID", dialCode: "+62", nameEn: "Indonesia", nameZh: "印度尼西亚"),
        PhoneCountry(id: "IN", dialCode: "+91", nameEn: "India", nameZh: "印度"),
        PhoneCountry(id: "AU", dialCode: "+61", nameEn: "Australia", nameZh: "澳大利亚"),
        PhoneCountry(id: "NZ", dialCode: "+64", nameEn: "New Zealand", nameZh: "新西兰"),
        PhoneCountry(id: "CA", dialCode: "+1", nameEn: "Canada", nameZh: "加拿大"),
        PhoneCountry(id: "DE", dialCode: "+49", nameEn: "Germany", nameZh: "德国"),
        PhoneCountry(id: "FR", dialCode: "+33", nameEn: "France", nameZh: "法国"),
        PhoneCountry(id: "IT", dialCode: "+39", nameEn: "Italy", nameZh: "意大利"),
        PhoneCountry(id: "ES", dialCode: "+34", nameEn: "Spain", nameZh: "西班牙"),
        PhoneCountry(id: "NL", dialCode: "+31", nameEn: "Netherlands", nameZh: "荷兰"),
        PhoneCountry(id: "BE", dialCode: "+32", nameEn: "Belgium", nameZh: "比利时"),
        PhoneCountry(id: "CH", dialCode: "+41", nameEn: "Switzerland", nameZh: "瑞士"),
        PhoneCountry(id: "AT", dialCode: "+43", nameEn: "Austria", nameZh: "奥地利"),
        PhoneCountry(id: "SE", dialCode: "+46", nameEn: "Sweden", nameZh: "瑞典"),
        PhoneCountry(id: "NO", dialCode: "+47", nameEn: "Norway", nameZh: "挪威"),
        PhoneCountry(id: "DK", dialCode: "+45", nameEn: "Denmark", nameZh: "丹麦"),
        PhoneCountry(id: "FI", dialCode: "+358", nameEn: "Finland", nameZh: "芬兰"),
        PhoneCountry(id: "PL", dialCode: "+48", nameEn: "Poland", nameZh: "波兰"),
        PhoneCountry(id: "RU", dialCode: "+7", nameEn: "Russia", nameZh: "俄罗斯"),
        PhoneCountry(id: "UA", dialCode: "+380", nameEn: "Ukraine", nameZh: "乌克兰"),
        PhoneCountry(id: "TR", dialCode: "+90", nameEn: "Turkey", nameZh: "土耳其"),
        PhoneCountry(id: "AE", dialCode: "+971", nameEn: "United Arab Emirates", nameZh: "阿联酋"),
        PhoneCountry(id: "SA", dialCode: "+966", nameEn: "Saudi Arabia", nameZh: "沙特阿拉伯"),
        PhoneCountry(id: "IL", dialCode: "+972", nameEn: "Israel", nameZh: "以色列"),
        PhoneCountry(id: "EG", dialCode: "+20", nameEn: "Egypt", nameZh: "埃及"),
        PhoneCountry(id: "ZA", dialCode: "+27", nameEn: "South Africa", nameZh: "南非"),
        PhoneCountry(id: "NG", dialCode: "+234", nameEn: "Nigeria", nameZh: "尼日利亚"),
        PhoneCountry(id: "KE", dialCode: "+254", nameEn: "Kenya", nameZh: "肯尼亚"),
        PhoneCountry(id: "BR", dialCode: "+55", nameEn: "Brazil", nameZh: "巴西"),
        PhoneCountry(id: "MX", dialCode: "+52", nameEn: "Mexico", nameZh: "墨西哥"),
        PhoneCountry(id: "AR", dialCode: "+54", nameEn: "Argentina", nameZh: "阿根廷"),
        PhoneCountry(id: "CL", dialCode: "+56", nameEn: "Chile", nameZh: "智利"),
        PhoneCountry(id: "CO", dialCode: "+57", nameEn: "Colombia", nameZh: "哥伦比亚"),
        PhoneCountry(id: "PT", dialCode: "+351", nameEn: "Portugal", nameZh: "葡萄牙"),
        PhoneCountry(id: "GR", dialCode: "+30", nameEn: "Greece", nameZh: "希腊"),
        PhoneCountry(id: "CZ", dialCode: "+420", nameEn: "Czech Republic", nameZh: "捷克"),
        PhoneCountry(id: "RO", dialCode: "+40", nameEn: "Romania", nameZh: "罗马尼亚"),
        PhoneCountry(id: "HU", dialCode: "+36", nameEn: "Hungary", nameZh: "匈牙利"),
        PhoneCountry(id: "IE", dialCode: "+353", nameEn: "Ireland", nameZh: "爱尔兰"),
        PhoneCountry(id: "PK", dialCode: "+92", nameEn: "Pakistan", nameZh: "巴基斯坦"),
        PhoneCountry(id: "BD", dialCode: "+880", nameEn: "Bangladesh", nameZh: "孟加拉国"),
        PhoneCountry(id: "NP", dialCode: "+977", nameEn: "Nepal", nameZh: "尼泊尔"),
        PhoneCountry(id: "LK", dialCode: "+94", nameEn: "Sri Lanka", nameZh: "斯里兰卡"),
        PhoneCountry(id: "KZ", dialCode: "+7", nameEn: "Kazakhstan", nameZh: "哈萨克斯坦"),
    ].sorted { a, b in
        if a.id == "CN" { return true }
        if b.id == "CN" { return false }
        return a.nameEn.localizedCaseInsensitiveCompare(b.nameEn) == .orderedAscending
    }

    /// 搜索用（名称 / 区号 / ISO）
    public static func search(_ query: String) -> [PhoneCountry] {
        let raw = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let q = raw.lowercased()
        if q.isEmpty { return all }
        return all.filter {
            $0.id.lowercased().contains(q)
                || $0.dialCode.contains(q)
                || $0.nameEn.lowercased().contains(q)
                || $0.nameZh.contains(raw)
        }
    }

    /// 按国家进行手机号本地段校验（不含国家码，只校验 national number）。
    /// 优先使用国家规则正则；未覆盖国家回退到 E.164 长度范围 6~15。
    public static func isValidNationalNumber(iso: String, digits: String) -> Bool {
        let d = digits.filter(\.isNumber)
        guard !d.isEmpty else { return false }
        let country = iso.uppercased()
        if let pattern = nationalNumberPatterns[country] {
            return d.range(of: pattern, options: .regularExpression) != nil
        }
        return (6...15).contains(d.count)
    }

    // 常用国家号码段规则（mobile-focused，national number only）
    private static let nationalNumberPatterns: [String: String] = [
        "CN": "^1[3-9]\\d{9}$",
        "US": "^[2-9]\\d{9}$",
        "CA": "^[2-9]\\d{9}$",
        "GB": "^7\\d{9}$",
        "JP": "^(?:70|80|90)\\d{8}$",
        "KR": "^10\\d{8}$",
        "TW": "^9\\d{8}$",
        "HK": "^[569]\\d{7}$",
        "MO": "^6\\d{7}$",
        "SG": "^[89]\\d{7}$",
        "MY": "^1\\d{8,9}$",
        "TH": "^[689]\\d{8}$",
        "VN": "^(?:3|5|7|8|9)\\d{8}$",
        "PH": "^9\\d{9}$",
        "ID": "^8\\d{8,11}$",
        "IN": "^[6-9]\\d{9}$",
        "AU": "^4\\d{8}$",
        "NZ": "^2\\d{7,9}$",
        "DE": "^1[5-7]\\d{8,10}$",
        "FR": "^[67]\\d{8}$",
        "IT": "^3\\d{8,10}$",
        "ES": "^[67]\\d{8}$",
        "NL": "^6\\d{8}$",
        "BE": "^4\\d{8}$",
        "CH": "^7[5-9]\\d{7}$",
        "AT": "^6\\d{9,11}$",
        "SE": "^7\\d{8}$",
        "NO": "^[49]\\d{7}$",
        "DK": "^[2-9]\\d{7}$",
        "FI": "^4\\d{8,9}$",
        "PL": "^[5-8]\\d{8}$",
        "RU": "^9\\d{9}$",
        "UA": "^9\\d{8}$",
        "TR": "^5\\d{9}$",
        "AE": "^5\\d{8}$",
        "SA": "^5\\d{8}$",
        "IL": "^5\\d{8}$",
        "EG": "^1[0125]\\d{8}$",
        "ZA": "^([67]\\d{8})$",
        "NG": "^[789]\\d{9}$",
        "KE": "^7\\d{8}$",
        "BR": "^[1-9][1-9]9\\d{8}$",
        "MX": "^1?[2-9]\\d{9}$",
        "AR": "^9\\d{9,10}$",
        "CL": "^9\\d{8}$",
        "CO": "^3\\d{9}$",
        "PT": "^9\\d{8}$",
        "GR": "^69\\d{8}$",
        "CZ": "^\\d{9}$",
        "RO": "^7\\d{8}$",
        "HU": "^(20|30|70)\\d{7}$",
        "IE": "^8\\d{8}$",
        "PK": "^3\\d{9}$",
        "BD": "^1[3-9]\\d{8}$",
        "NP": "^9[678]\\d{8}$",
        "LK": "^7\\d{8}$",
        "KZ": "^7\\d{9}$",
    ]
}
