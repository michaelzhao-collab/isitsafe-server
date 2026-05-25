//
//  PhotoLibraryPicker.swift
//  IsItSafe
//
//  使用 PHPickerViewController（iOS 14+）从相册选择图片。
//  相比废弃的 UIImagePickerController，不再需要 NSPhotoLibraryUsageDescription，
//  且解决了 fullScreenCover 内白屏的兼容问题。
//

import SwiftUI
import PhotosUI

public struct PhotoLibraryPicker: UIViewControllerRepresentable {
    public var onPick: (Data?) -> Void

    public init(onPick: @escaping (Data?) -> Void) {
        self.onPick = onPick
    }

    public func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 1
        config.filter = .images
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }

    public func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let parent: PhotoLibraryPicker

        init(_ parent: PhotoLibraryPicker) {
            self.parent = parent
        }

        public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            guard let provider = results.first?.itemProvider,
                  provider.canLoadObject(ofClass: UIImage.self) else {
                parent.onPick(nil)
                return
            }
            provider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
                DispatchQueue.main.async {
                    let img = object as? UIImage
                    self?.parent.onPick(img?.jpegData(compressionQuality: 0.7))
                }
            }
        }
    }
}
