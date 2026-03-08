//
//  PhotoLibraryPicker.swift
//  IsItSafe
//
//  从相册选择一张图片，用于头像等。仅 UI，不涉及接口。
//

import SwiftUI
import UIKit

public struct PhotoLibraryPicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    public var onPick: (Data?) -> Void

    public init(onPick: @escaping (Data?) -> Void) {
        self.onPick = onPick
    }

    public func makeUIViewController(context: Context) -> UIImagePickerController {
        let c = UIImagePickerController()
        c.sourceType = .photoLibrary
        c.delegate = context.coordinator
        c.allowsEditing = true
        c.modalPresentationStyle = .fullScreen
        return c
    }

    public func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: PhotoLibraryPicker

        init(_ parent: PhotoLibraryPicker) {
            self.parent = parent
        }

        public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let img = (info[.editedImage] as? UIImage) ?? info[.originalImage] as? UIImage
            let data = img?.jpegData(compressionQuality: 0.7)
            parent.onPick(data)
            parent.dismiss()
        }

        public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.onPick(nil)
            parent.dismiss()
        }
    }
}
