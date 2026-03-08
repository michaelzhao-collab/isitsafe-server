//
//  SubscriptionVerifyRequest.swift
//  IsItSafe
//

import Foundation

public struct SubscriptionVerifyRequest: Encodable {
    public let productId: String
    public let receipt: String
    public let paymentMethod: String

    public init(productId: String, receipt: String, paymentMethod: String = "Apple") {
        self.productId = productId
        self.receipt = receipt
        self.paymentMethod = paymentMethod
    }
}
