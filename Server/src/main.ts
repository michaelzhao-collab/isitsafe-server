// 2026-09-07 复核修复：必须在任何模块被导入前加载 .env。
// 原因：DailyScamService 用 `@Cron(resolveDailyScamCron())`，装饰器参数在
// 模块「导入阶段」求值，早于 AppModule 里 ConfigModule.forRoot() 加载 dotenv，
// 导致写在 .env 里的 DAILY_SCAM_CRON 永远读不到（静默回落默认值）。
// dotenv 默认不覆盖已存在的 process.env，所以 Railway 注入的真实环境变量优先级不变。
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // V5.1 自建 IM：启用原生 ws 适配器，家庭群聊网关挂在 /chat（同一 HTTP server）
  app.useWebSocketAdapter(new WsAdapter(app));
  // 2026-09-27 复核：信任 1 跳代理，让兜底 req.ip 剥离一层内网地址。
  // 真实客户端 IP 主要靠 CfThrottlerGuard 读 CF-Connecting-IP，不依赖此跳数。
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // 全局前缀 /api，排除以下根路径：
  //  - /.well-known/apple-app-site-association (iOS Universal Link 验证)
  //  - /.well-known/assetlinks.json (Android App Links 占位，二期接入)
  app.setGlobalPrefix('api', {
    exclude: [
      '.well-known/apple-app-site-association',
      '.well-known/assetlinks.json',
    ],
  });
  // CORS_ORIGINS 逗号分隔，如 https://admin.example.com,https://web.example.com
  // 不设置则只允许同域请求（Railway 生产环境务必配置此变量）
  const rawOrigins = process.env.CORS_ORIGINS || '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  const base = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`
    : process.env.API_BASE_URL || `http://localhost:${port}/api`;
  console.log(`IsItSafe API running at ${base}`);
}

bootstrap().catch(console.error);
