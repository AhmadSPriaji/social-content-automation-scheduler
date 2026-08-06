import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hub-signature-256'];

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    // In a real application, you would use crypto.createHmac and verify the signature
    // against the body using a secret key.
    // For this mock, we just verify it exists and is a specific mock string.
    if (signature !== 'mock-valid-signature') {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
