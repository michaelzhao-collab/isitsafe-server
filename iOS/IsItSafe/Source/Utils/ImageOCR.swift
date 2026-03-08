//
//  ImageOCR.swift
//  IsItSafe
//
//  使用 Vision 对图片做 OCR，得到文字后供截图分析接口使用。
//

import Foundation
import UIKit
import Vision

public enum ImageOCR {
    public static func recognize(from image: UIImage) async -> String {
        guard let cgImage = image.cgImage else { return "" }
        return await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["zh-Hans", "en-US"]
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
                guard let results = request.results as? [VNRecognizedTextObservation] else { return "" }
                return results.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
            } catch {
                return ""
            }
        }.value
    }
}
