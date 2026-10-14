//
//  ImageUploadPreparer.swift
//  IsItSafe
//
//  上传前统一按像素上限缩放并按 1x 像素编码 JPEG。
//  2026-10-14 真机：UIGraphicsImageRenderer 默认按屏幕倍率（3x）渲染，「长边 1920」实际输出 5760 像素，
//  JPEG 好几 MB，手机网络下家庭发图超时 / 超过服务端 10MB 上限。首页截图分析与意见反馈则完全没缩放，
//  原图直接上传。三处统一走这里。
//

import UIKit

nonisolated enum ImageUploadPreparer {
    /// 总像素上限约 420 万（4032×3024 照片 → 约 2367×1775），长边上限 6000。
    /// 不用「长边 1920」：竖长聊天截图（1170×8000）会被缩成 281 宽、字看不清。
    static let maxPixels: CGFloat = 4_200_000
    static let maxLongSide: CGFloat = 6000

    /// 按像素上限缩放并以 1x 渲染；不需要缩放时原样返回（UIImage(data:) 的 scale 本就是 1）
    static func downscaled(_ image: UIImage) -> UIImage {
        // 以像素计：image.size 是 point，乘 scale 才是像素
        let pxW = image.size.width * image.scale, pxH = image.size.height * image.scale
        guard pxW > 0, pxH > 0 else { return image }
        let ratio = min(1, (maxPixels / (pxW * pxH)).squareRoot(), maxLongSide / max(pxW, pxH))
        guard ratio < 1 || image.scale != 1 else { return image }
        let newSize = CGSize(width: (pxW * ratio).rounded(), height: (pxH * ratio).rounded())
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        format.preferredRange = .standard   // 不走宽色域，内存减半
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { ctx in
            // 透明 PNG 先铺白底，否则 opaque 渲染后透明区变黑
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: newSize))
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    /// 缩放 + JPEG 编码；返回数据与像素宽高
    static func jpeg(_ image: UIImage, quality: CGFloat = 0.8) -> (data: Data, width: Int, height: Int)? {
        let resized = downscaled(image)
        guard let data = resized.jpegData(compressionQuality: quality) else { return nil }
        return (data, Int(resized.size.width * resized.scale), Int(resized.size.height * resized.scale))
    }
}
