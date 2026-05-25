//
//  ProfileEditView.swift
//
//  个人资料修改：头像（上传 OSS 后更新）、昵称、性别、生日。与 Server/Admin 字段一致。
//

import SwiftUI

private struct CropItem: Identifiable {
    let id = UUID()
    let image: UIImage
}

public struct ProfileEditView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    @State private var nicknameText: String = ""
    @State private var genderValue: String = "unknown"
    @State private var birthdayText: String = ""
    @State private var birthdayDate: Date = Date()
    @State private var avatarURL: String? = nil
    @State private var pickedImageData: Data? = nil
    @State private var showImagePicker = false
    @State private var cropItem: CropItem?
    @State private var saving = false
    @State private var uploading = false
    @State private var errorMessage: String?

    private var genderOptions: [(label: String, value: String)] {
        let en = languageCode == "en"
        return [
            (en ? "Not set" : "未设置", "unknown"),
            (en ? "Male" : "男", "male"),
            (en ? "Female" : "女", "female"),
        ]
    }

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section(languageCode == "en" ? "Nickname" : "昵称") {
                    TextField(languageCode == "en" ? "Enter nickname" : "请输入昵称", text: $nicknameText)
                }
                Section(languageCode == "en" ? "Gender" : "性别") {
                    Picker(languageCode == "en" ? "Gender" : "性别", selection: $genderValue) {
                        ForEach(genderOptions, id: \.value) { Text($0.label).tag($0.value) }
                    }
                    .pickerStyle(.menu)
                }
                Section(languageCode == "en" ? "Birthday" : "生日") {
                    DatePicker(languageCode == "en" ? "Birthday" : "生日", selection: $birthdayDate, in: ...Date(), displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: languageCode == "en" ? "en_US" : "zh_CN"))
                }
                if let phone = appState.user?.phone, !phone.isEmpty {
                    Section(languageCode == "en" ? "Phone" : "手机号") {
                        Text(Self.maskPhone(phone))
                            .font(.body)
                            .foregroundColor(.primary)
                    }
                }
            }
            .navigationTitle(languageCode == "en" ? "Profile" : "个人资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(languageCode == "en" ? "Cancel" : "取消") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(languageCode == "en" ? "Save" : "保存") {
                        saveProfile()
                    }
                    .disabled(saving)
                }
            }
            .onAppear {
                let u = appState.user
                nicknameText = u?.nickname ?? ""
                genderValue = u?.gender ?? "unknown"
                if !["male", "female", "unknown"].contains(genderValue) { genderValue = "unknown" }
                birthdayText = u?.birthday ?? ""
                if let b = u?.birthday, !b.isEmpty, let d = Self.dateFromBirthday(b) {
                    birthdayDate = d
                } else {
                    birthdayDate = Date()
                }
                avatarURL = u?.avatar
            }
            .alert(languageCode == "en" ? "Error" : "错误", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button(languageCode == "en" ? "OK" : "确定", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var profileAvatar: some View {
        Group {
            if let data = pickedImageData, let ui = UIImage(data: data) {
                Image(uiImage: ui)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 60, height: 60)
                    .clipShape(Circle())
            } else if let urlString = avatarURL, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure, .empty:
                        Image(systemName: "person.circle.fill")
                            .font(.system(size: 60))
                            .foregroundStyle(AppTheme.secondaryText)
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 60, height: 60)
                .clipShape(Circle())
            } else {
                Image(systemName: "person.circle.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(AppTheme.secondaryText)
            }
        }
    }

    private func uploadPickedImage(_ data: Data) async {
        uploading = true
        defer { uploading = false }
        do {
            let url = try await AuthService.shared.uploadAvatar(imageData: data, filename: "avatar.jpg")
            await MainActor.run {
                avatarURL = url
                pickedImageData = nil
            }
        } catch {
            var msg = (error as? APIError)?.userMessage ?? error.localizedDescription
            if msg.contains("OSS not configured") || msg.contains("OSS_REGION") {
                msg = (languageCode == "en" ? "Avatar upload is not configured. Please contact support." : "头像上传功能暂未配置，请联系管理员")
            }
            print("[Avatar] 上传失败: \(msg)")
            if let api = error as? APIError {
                if case .serverError(let code, let bodyMsg) = api {
                    print("[Avatar] HTTP \(code), message: \(bodyMsg ?? "—")")
                }
            }
            await MainActor.run {
                errorMessage = msg
            }
        }
    }

    private func saveProfile() {
        saving = true
        Task {
            do {
                let birthdayStr = Self.birthdayString(from: birthdayDate)
                try await AuthService.shared.updateProfile(
                    avatar: avatarURL,
                    nickname: nicknameText.isEmpty ? nil : nicknameText,
                    gender: genderValue,
                    birthday: birthdayStr.isEmpty ? nil : birthdayStr
                )
                await MainActor.run {
                    saving = false
                    AppStateViewModel.shared.refreshLoginState()
                    AppStateViewModel.shared.showSuccess(languageCode == "en" ? "Saved" : "提交成功")
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    saving = false
                    errorMessage = error.localizedDescription
                }
            }
        }
    }

    private static let birthdayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    private static func dateFromBirthday(_ s: String) -> Date? {
        birthdayFormatter.date(from: s)
    }

    private static func birthdayString(from d: Date) -> String {
        birthdayFormatter.string(from: d)
    }

    /// 手机号中间四位脱敏：13812345678 -> 138****5678
    private static func maskPhone(_ s: String) -> String {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.count >= 11 {
            return String(t.prefix(3)) + "****" + String(t.suffix(4))
        }
        if t.count > 4 {
            return String(t.prefix(2)) + "****" + String(t.suffix(2))
        }
        return t.isEmpty ? "—" : "***"
    }
}
