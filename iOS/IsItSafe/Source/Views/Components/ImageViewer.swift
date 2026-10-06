//
//  ImageViewer.swift
//  IsItSafe
//
//  2026-10-06：首页与家庭群的图片原来点了没反应、无法放大。统一的全屏看图：
//  双指缩放、双击放大/还原、放大后可拖动、点关闭或下滑关闭。
//

import SwiftUI
import UIKit

/// 点击可全屏查看的图片修饰符：图片还没加载出来（nil）时不响应点击
struct TapToViewImage: ViewModifier {
    let image: UIImage?
    @State private var showing = false

    func body(content: Content) -> some View {
        if let image {
            content
                .contentShape(Rectangle())
                .onTapGesture { showing = true }
                .fullScreenCover(isPresented: $showing) { ImageViewer(image: image) }
        } else {
            // 没有图（未加载完 / 调用方关闭了看图）：不挂点击手势，不拦截外层的点击（如列表行跳转）
            content
        }
    }
}

extension View {
    func tapToViewImage(_ image: UIImage?) -> some View {
        modifier(TapToViewImage(image: image))
    }
}

struct ImageViewer: View {
    let image: UIImage
    @Environment(\.dismiss) private var dismiss

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    private let maxScale: CGFloat = 4

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.black.ignoresSafeArea()

            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .scaleEffect(scale)
                .offset(offset)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .gesture(magnify.simultaneously(with: drag))
                .onTapGesture(count: 2) {
                    withAnimation(.easeOut(duration: 0.2)) {
                        if scale > 1 { reset() } else { scale = 2.5; lastScale = 2.5 }
                    }
                }
                .accessibilityLabel(Text(AppSettingsStore.shared.languageCode == "en" ? "Image" : "图片"))

            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 40, height: 40)
                    .background(Circle().fill(Color.white.opacity(0.18)))
            }
            .padding(.trailing, 16)
            .padding(.top, 8)
            .accessibilityLabel(Text(AppSettingsStore.shared.languageCode == "en" ? "Close" : "关闭"))
        }
        .statusBarHidden()
    }

    private var magnify: some Gesture {
        MagnificationGesture()
            .onChanged { value in
                scale = min(max(lastScale * value, 1), maxScale)
            }
            .onEnded { _ in
                lastScale = scale
                if scale <= 1 { withAnimation(.easeOut(duration: 0.2)) { reset() } }
            }
    }

    /// 放大时拖动平移；未放大时下滑超过 120pt 关闭
    private var drag: some Gesture {
        DragGesture()
            .onChanged { value in
                offset = CGSize(width: lastOffset.width + value.translation.width,
                                height: lastOffset.height + value.translation.height)
            }
            .onEnded { value in
                if scale <= 1 {
                    if value.translation.height > 120 {
                        dismiss()
                    } else {
                        withAnimation(.easeOut(duration: 0.2)) { reset() }
                    }
                } else {
                    lastOffset = offset
                }
            }
    }

    private func reset() {
        scale = 1; lastScale = 1
        offset = .zero; lastOffset = .zero
    }
}
