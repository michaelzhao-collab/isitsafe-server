import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
