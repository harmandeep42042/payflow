import { payflowConfig } from '@payflow/shared-config';
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
    payflowConfig.urls.authService;

  constructor(
    private readonly httpService: HttpService,
  ) {}

  register(body: unknown) {
    return this.post('/auth/register', body);
  }


  async login(
    body: unknown,
    userAgent?: string,
    ipAddress?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.authServiceUrl}/auth/login`,
            body,
            {
              headers: {
                'Content-Type':
                  'application/json',

                ...(userAgent
                  ? {
                      'User-Agent':
                        userAgent,
                    }
                  : {}),

                ...(ipAddress
                  ? {
                      'X-Forwarded-For':
                        ipAddress,
                    }
                  : {}),
              },
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  refresh(body: unknown) {
    return this.post('/auth/refresh', body);
  }
  requestOtp(body: unknown) {
    return this.post(
      '/auth/otp/request',
      body,
    );
  }

  verifyOtp(body: unknown) {
    return this.post(
      '/auth/otp/verify',
      body,
    );
  }

  logout(body: unknown) {
    return this.post('/auth/logout', body);
  }


  forgotPassword(body: unknown) {
    return this.post(
      "/auth/password/forgot",
      body,
    );
  }

  resetPassword(body: unknown) {
    return this.post(
      "/auth/password/reset",
      body,
    );
  }

  async changePassword(
    authorization: string | undefined,
    body: unknown,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.authServiceUrl}/auth/change-password`,
            body,
            {
              headers: {
                'Content-Type':
                  'application/json',

                ...(authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {}),
              },
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  async updateProfile(
    authorization: string | undefined,
    body: unknown,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.authServiceUrl}/auth/profile/update`,
            body,
            {
              headers: {
                'Content-Type':
                  'application/json',

                ...(authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {}),
              },
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }


  async getCurrentSession(
    refreshToken: string,
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.authServiceUrl}/auth/sessions/current`,
            {
              refreshToken,
            },
            {
              headers:
                authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {},
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }
  async getSessions(
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.get(
            `${this.authServiceUrl}/auth/sessions`,
            {
              headers:
                authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {},
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }

  async revokeSession(
    sessionId: string,
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.delete(
            `${this.authServiceUrl}/auth/sessions/${sessionId}`,
            {
              headers:
                authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {},
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }


  async logoutOtherSessions(
    refreshToken: string,
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.post(
            `${this.authServiceUrl}/auth/sessions/logout-others`,
            {
              refreshToken,
            },
            {
              headers:
                authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {},
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
  }
  async logoutAllSessions(
    authorization?: string,
  ) {
    try {
      const response =
        await firstValueFrom(
          this.httpService.delete(
            `${this.authServiceUrl}/auth/sessions`,
            {
              headers:
                authorization
                  ? {
                      Authorization:
                        authorization,
                    }
                  : {},
            },
          ),
        );

      return response.data;
    } catch (error) {
      this.handleHttpError(error);
    }
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

  private async post(path: string, body: unknown) {
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
            message: 'Authentication service request failed',
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
