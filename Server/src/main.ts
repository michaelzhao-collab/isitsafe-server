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
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true, // 生产环境应配置具体域名
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
