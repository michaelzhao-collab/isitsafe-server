//
//  ImageCropSheet.swift
//
//  头像裁剪：正方形选择框，支持拖拽图片调整选区，确认后裁剪。
//

import SwiftUI
import UIKit

public struct ImageCropSheet: View {
    let image: UIImage
    let onConfirm: (UIImage) -> Void
    let onCancel: () -> Void

    private let side: CGFloat = min(UIScreen.main.bounds.width, UIScreen.main.bounds.height * 0.55) - 32
    private let imageW: CGFloat
    private let imageH: CGFloat

    @State private var offset: CGSize = .zero
    @State private var dragStart: CGSize = .zero

    public init(image: UIImage, onConfirm: @escaping (UIImage) -> Void, onCancel: @escaping () -> Void) {
        self.image = image
        self.onConfirm = onConfirm
        self.onCancel = onCancel
        self.imageW = image.size.width
        self.imageH = image.size.height
    }

    /// 缩放使图片至少填满正方形选区（便于拖拽选择区域）
    private var fillScale: CGFloat {
        let s = side
        guard imageW > 0, imageH > 0 else { return 1 }
        return max(s / imageW, s / imageH)
    }

    private var scaledW: CGFloat { imageW * fillScale }
    private var scaledH: CGFloat { imageH * fillScale }

    /// 限制 offset 使选区范围内始终有图片
    private func clampOffset(_ o: CGSize) -> CGSize {
        let maxX = max(0, (scaledW - side) / 2)
        let maxY = max(0, (scaledH - side) / 2)
        return CGSize(
            width: min(maxX, max(-maxX, o.width)),
            height: min(maxY, max(-maxY, o.height))
        )
    }

    /// 当前选区在图片坐标系中的 rect（用于裁剪）
    private func cropRectInImage() -> CGRect {
        let s = side
        let sx = s / 2 - scaledW / 2 + offset.width
        let sy = s / 2 - scaledH / 2 + offset.height
        let scale = fillScale
        let left = max(0, -sx / scale)
        let top = max(0, -sy / scale)
        let right = min(imageW, (s - sx) / scale)
        let bottom = min(imageH, (s - sy) / scale)
        let w = max(0, right - left)
        let h = max(0, bottom - top)
        return CGRect(x: left, y: top, width: w, height: h)
    }

    public var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("拖动图片调整裁剪区域")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                ZStack {
                    Color.black.opacity(0.4)
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: scaledW, height: scaledH)
                        .frame(width: side, height: side)
                        .offset(x: offset.width, y: offset.height)
                        .clipped()
                        .contentShape(Rectangle())
                        .gesture(
                            DragGesture()
                                .onChanged { v in
                                    offset = clampOffset(CGSize(width: dragStart.width + v.translation.width, height: dragStart.height + v.translation.height))
                                }
                                .onEnded { _ in
                                    dragStart = offset
                                }
                        )
                        .onAppear {
                            dragStart = .zero
                            offset = .zero
                        }
                    RoundedRectangle(cornerRadius: 0)
                        .stroke(Color.white, lineWidth: 2)
                        .frame(width: side, height: side)
                }
                .frame(width: side, height: side)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                Spacer()
            }
            .padding()
            .navigationTitle("裁剪头像")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { onCancel() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("使用") {
                        let rect = cropRectInImage()
                        let cropped = cropImage(image, to: rect)
                        onConfirm(cropped)
                    }
                }
            }
        }
    }

    private func cropImage(_ img: UIImage, to rect: CGRect) -> UIImage {
        let scale = img.scale
        let scaledRect = CGRect(
            x: rect.origin.x * scale,
            y: rect.origin.y * scale,
            width: rect.width * scale,
            height: rect.height * scale
        )
        guard let cg = img.cgImage?.cropping(to: scaledRect) else { return img }
        return UIImage(cgImage: cg, scale: img.scale, orientation: img.imageOrientation)
    }
}
