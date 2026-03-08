//
//  ProfileEditView.swift
//
//  个人资料修改：头像（上传 OSS 后更新）、昵称、性别、生日。与 Server/Admin 字段一致。
//

import SwiftUI

public struct ProfileEditView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appState: AppStateViewModel
    @State private var nicknameText: String = ""
    @State private var genderValue: String = "unknown"
    @State private var birthdayText: String = ""
    @State private var avatarURL: String? = nil
    @State private var pickedImageData: Data? = nil
    @State private var showImagePicker = false
    @State private var saving = false
    @State private var uploading = false
    @State private var errorMessage: String?

    private let genderOptions: [(label: String, value: String)] = [
        ("未设置", "unknown"),
        ("男", "male"),
        ("女", "female"),
    ]

    public init() {}

    public var body: some View {
        NavigationStack {
            List {
                Section("头像") {
                    Button {
                        showImagePicker = true
                    } label: {
                        HStack {
                            profileAvatar
                            Text("更换头像")
                                .foregroundColor(AppTheme.primary)
                            if uploading { ProgressView().padding(.leading, 8) }
                        }
                    }
                    .disabled(uploading)
                }
                Section("昵称") {
                    TextField("请输入昵称", text: $nicknameText)
                }
                Section("性别") {
                    Picker("性别", selection: $genderValue) {
                        ForEach(genderOptions, id: \.value) { Text($0.label).tag($0.value) }
                    }
                    .pickerStyle(.menu)
                }
                Section("生日") {
                    TextField("YYYY-MM-DD", text: $birthdayText)
                        .keyboardType(.numbersAndPunctuation)
                }
            }
            .navigationTitle("个人资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("保存") {
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
                avatarURL = u?.avatar
            }
            .sheet(isPresented: $showImagePicker) {
                PhotoLibraryPicker { data in
                    guard let data = data else { return }
                    pickedImageData = data
                    Task { await uploadPickedImage(data) }
                }
            }
            .alert("错误", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("确定", role: .cancel) {}
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
            await MainActor.run {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func saveProfile() {
        saving = true
        Task {
            do {
                try await AuthService.shared.updateProfile(
                    avatar: avatarURL,
                    nickname: nicknameText.isEmpty ? nil : nicknameText,
                    gender: genderValue,
                    birthday: birthdayText.isEmpty ? nil : birthdayText
                )
                await MainActor.run {
                    saving = false
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
}
