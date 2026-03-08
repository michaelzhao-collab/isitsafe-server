//
//  ConfirmPhotoSheet.swift
//  IsItSafe
//
//  拍摄完让用户确认，确认后回到首页并将照片放在输入框左上角。
//

import SwiftUI

public struct ConfirmPhotoSheet: View {
    @Environment(\.dismiss) private var dismiss
    public let image: UIImage
    public var onConfirm: () -> Void
    public var onEdit: (() -> Void)?

    public init(image: UIImage, onConfirm: @escaping () -> Void, onEdit: (() -> Void)? = nil) {
        self.image = image
        self.onConfirm = onConfirm
        self.onEdit = onEdit
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.black.opacity(0.03))

                HStack(spacing: 16) {
                    if onEdit != nil {
                        Button("编辑") {
                            onEdit?()
                        }
                        .frame(maxWidth: .infinity)
                    }
                    Button("确认") {
                        onConfirm()
                        dismiss()
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                }
                .padding()
                .background(Color(.systemBackground))
            }
            .navigationTitle("确认图片")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}
