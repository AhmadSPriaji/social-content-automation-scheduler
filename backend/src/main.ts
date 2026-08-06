import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: true, // Allow all origins for now, should restrict to frontend domain in production
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Social Content Automation Scheduler API')
    .setDescription(
      'The API documentation for Social Content Automation Scheduler',
    )
    .setVersion('1.0')
    .addCookieAuth('Authentication')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip out properties that don't have decorators
      forbidNonWhitelisted: true, // throw errors if non-whitelisted values are provided
    }),
  );
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
