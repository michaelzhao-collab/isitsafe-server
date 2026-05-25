//
//  SplashView.swift
//  IsItSafe
//
//  启动过渡页：与 UILaunchScreen 背景色一致，覆盖在主界面上方，
//  让用户在系统 Launch Screen（仅 Logo）之后看到 Logo + 应用名，
//  之后淡出进入主界面。
//

import SwiftUI

struct SplashView: View {
    var body: some View {
        ZStack {
            Color("LaunchBackground")
                .ignoresSafeArea()
            VStack(spacing: 16) {
                Image("Logo")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 88, height: 88)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                Text("StarLens AI")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(Color(red: 0.173, green: 0.173, blue: 0.180))
            }
        }
    }
}
