//
//  RecentPhotosView.swift
//  IsItSafe
//
//  相册最新照片横向/纵向列表，点击选中后回调原图（不限比例）。
//

import SwiftUI
import Photos

public struct RecentPhotosView: View {
    public var onSelect: (UIImage) -> Void
    @State private var thumbnails: [(id: String, image: UIImage)] = []
    @State private var authorized = false
    @AppStorage("isitsafe.language") private var languageCode: String = "zh"
    private let columns = [GridItem(.adaptive(minimum: 80), spacing: 8)]
    private let limit = 24

    public init(onSelect: @escaping (UIImage) -> Void) {
        self.onSelect = onSelect
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !authorized {
                Text(languageCode == "en" ? "Allow photo access in Settings to show recent photos" : "请在设置中允许访问相册以显示最近照片")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
            } else if thumbnails.isEmpty {
                Text(languageCode == "en" ? "No recent photos" : "暂无最近照片")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding()
                    .frame(maxWidth: .infinity)
            } else {
                ScrollView(.vertical, showsIndicators: true) {
                    LazyVGrid(columns: columns, spacing: 8) {
                        ForEach(thumbnails, id: \.id) { item in
                            Button {
                                loadFullImage(assetId: item.id) { img in
                                    if let img = img { onSelect(img) }
                                }
                            } label: {
                                Image(uiImage: item.image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 80, height: 80)
                                    .clipped()
                                    .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                }
                .frame(maxHeight: 240)
            }
        }
        .onAppear { loadRecentPhotos() }
    }

    private func loadRecentPhotos() {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        switch status {
        case .authorized, .limited:
            authorized = true
            fetchAssets()
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { s in
                DispatchQueue.main.async {
                    authorized = (s == .authorized || s == .limited)
                    if authorized { fetchAssets() }
                }
            }
        default:
            authorized = false
        }
    }

    private func fetchAssets() {
        let options = PHFetchOptions()
        options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
        options.fetchLimit = limit
        let results = PHAsset.fetchAssets(with: .image, options: options)
        var identifiers: [String] = []
        results.enumerateObjects { asset, _, _ in
            identifiers.append(asset.localIdentifier)
        }
        let manager = PHImageManager.default()
        let scale = UIScreen.main.scale
        let size = CGSize(width: 160 * scale, height: 160 * scale)
        var dict: [String: UIImage] = [:]
        let group = DispatchGroup()
        let leaveQueue = DispatchQueue(label: "com.isitsafe.photoLeave")
        for id in identifiers {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject else { continue }
            group.enter()
            var hasLeft = false
            manager.requestImage(for: asset, targetSize: size, contentMode: .aspectFill, options: nil) { img, _ in
                if let img = img { dict[id] = img }
                leaveQueue.sync {
                    if !hasLeft {
                        hasLeft = true
                        group.leave()
                    }
                }
            }
        }
        group.notify(queue: .main) {
            thumbnails = identifiers.compactMap { id in dict[id].map { (id, $0) } }
        }
    }

    private func loadFullImage(assetId: String, completion: @escaping (UIImage?) -> Void) {
        let results = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
        guard let asset = results.firstObject else { completion(nil); return }
        let options = PHImageRequestOptions()
        options.isSynchronous = false
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        PHImageManager.default().requestImage(for: asset, targetSize: PHImageManagerMaximumSize, contentMode: .aspectFit, options: options) { img, _ in
            DispatchQueue.main.async { completion(img) }
        }
    }
}
