//
//  ReportTypePicker.swift
//  IsItSafe
//

import SwiftUI

public struct ReportTypePicker: View {
    @Binding public var selection: ReportType

    public var body: some View {
        Picker(L10n.tr(zh: "举报类型", en: "Report type"), selection: $selection) {
            ForEach(ReportType.allCases, id: \.self) { type in
                Text(type.displayName).tag(type)
            }
        }
        .pickerStyle(.segmented)
    }
}
