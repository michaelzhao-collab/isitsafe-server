import { Controller, Get, Header, HttpCode } from '@nestjs/common';

/**
 * Apple Universal Link 和 Android App Links 必需的 well-known 文件。
 * 这两个路由 **不在 /api/ 前缀下**（已在 main.ts 的 setGlobalPrefix exclude 中排除）。
 *
 * iOS：当用户在 Safari/iMessage 点击 https://www.starlensai.com/i/{code} 时，
 *   iOS 系统去 **邀请链接所在域名** 拉取 apple-app-site-association 验证 App 的关联，
 *   只有 appID + bundleID 匹配才会拉起 App 而不是浏览器。
 *
 * 注意：www.starlensai.com 是 Cloudflare Pages 静态站，Apple 实际抓取的是
 *   WEB/.well-known/apple-app-site-association 那份静态文件（随 Pages 部署）。
 *   本控制器只服务 api.starlensai.com 域名下的同路径请求，作为备份/调试入口，
 *   两处内容需保持一致（TeamID.BundleID 见 WEB 静态文件）。
 *
 * 需要在 iOS Xcode：
 *   1. 开启 Associated Domains capability
 *   2. 添加 entitlement: applinks:starlensai.com / applinks:www.starlensai.com
 */
@Controller()
export class WellKnownController {
  /**
   * Apple Universal Link 配置
   * GET /.well-known/apple-app-site-association
   *
   * 重要：
   *  - 必须返回 Content-Type: application/json
   *  - appIDs 格式：<TeamID>.<BundleID>，例如 ABCDEF1234.com.starlens.IsItSafe
   *  - components.paths：匹配 /i/{code} 模式
   *
   * TeamID + BundleID 需要从环境变量读取，未配置时返回空 detail（功能 disabled）
   */
  @Get('.well-known/apple-app-site-association')
  @Header('Content-Type', 'application/json')
  @HttpCode(200)
  appleAppSiteAssociation() {
    const appID = process.env.APPLE_APP_ID; // 例：ABCDEF1234.com.starlens.IsItSafe
    if (!appID) {
      // 未配置时返回空 applinks，避免 Apple 校验失败
      return {
        applinks: {
          apps: [],
          details: [],
        },
      };
    }

    return {
      applinks: {
        apps: [],
        details: [
          {
            appIDs: [appID],
            components: [
              {
                // 匹配 https://www.starlensai.com/i/{code} 路径
                '/': '/i/*',
                comment: 'V3-E family invite code redemption',
              },
            ],
          },
        ],
      },
      // 二期 webcredentials 留位（如需密码自动填充）
      // webcredentials: { apps: [appID] }
    };
  }

  /**
   * Android App Links 占位（二期上线 Android 时启用）
   * GET /.well-known/assetlinks.json
   */
  @Get('.well-known/assetlinks.json')
  @Header('Content-Type', 'application/json')
  @HttpCode(200)
  assetLinks() {
    return [];
  }
}
