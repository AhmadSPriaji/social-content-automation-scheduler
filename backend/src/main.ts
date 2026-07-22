import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: true, // Allow all origins for now, should restrict to frontend domain in production
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // strip out properties that don't have decorators
    forbidNonWhitelisted: true, // throw errors if non-whitelisted values are provided
  }));
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
