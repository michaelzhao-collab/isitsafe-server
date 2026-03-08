//
//  ReportTypePicker.swift
//  IsItSafe
//

import SwiftUI

public struct ReportTypePicker: View {
    @Binding public var selection: ReportType

    public var body: some View {
        Picker("举报类型", selection: $selection) {
            ForEach(ReportType.allCases, id: \.self) { type in
                Text(type.displayName).tag(type)
            }
        }
        .pickerStyle(.segmented)
    }
}
