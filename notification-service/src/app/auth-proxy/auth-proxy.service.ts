import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthProxyService {
  private readonly authServiceUrl =
    process.env.AUTH_SERVICE_URL ??
    'http://localhost:4002/api';

  constructor(
    private readonly httpService: HttpService,
  ) {}

  register(body: unknown) {
    return this.post('/auth/register', body);
  }

  login(body: unknown) {
    return this.post('/auth/login', body);
  }

  refresh(body: unknown) {
    return this.post('/auth/refresh', body);
  }

  logout(body: unknown) {
    return this.post('/auth/logout', body);
  }

  async profile(authorization?: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.authServiceUrl}/auth/profile`,
          {
            headers: authorization
              ? { Authorization: authorization }
              : {},
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  private async post(
    path: string,
    body: unknown,
  ) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.authServiceUrl}${path}`,
          body,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  private handleHttpError(error: unknown): never {
    if (error instanceof AxiosError) {
      if (error.response) {
        throw new HttpException(
          error.response.data ?? {
            message:
              'Authentication service request failed',
          },
          error.response.status,
        );
      }

      throw new ServiceUnavailableException(
        'Authentication service is unavailable',
      );
    }

    throw new ServiceUnavailableException(
      'Unable to communicate with authentication service',
    );
  }
}