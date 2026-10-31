/**
 * Functional HTTP interceptor for attaching JWT Bearer tokens and handling 401 responses.
 * @module app/interceptors/auth.interceptor
 */
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BackendConfigService } from '../services/backend-config.service';

/**
 * Attaches the `Authorization: Bearer <token>` header to requests targeting the configured
 * CDD backend services when a token is available, and clears expired sessions on `401 Unauthorized`.
 * @param req The outgoing HTTP request.
 * @param next The next handler in the HTTP interceptor chain.
 * @returns Observable of the HTTP event stream.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const config = inject(BackendConfigService);

  const token = authService.token();
  const backendUrl = config.backendUrl();
  const controlPlaneUrl = config.controlPlaneUrl();
  const storageUrl = config.storageUrl();

  const isBackendRequest = Boolean(
    (backendUrl && req.url.startsWith(backendUrl)) ||
    (controlPlaneUrl && req.url.startsWith(controlPlaneUrl)) ||
    (storageUrl && req.url.startsWith(storageUrl)),
  );

  let outgoingReq = req;
  if (token && isBackendRequest && !req.headers.has('Authorization')) {
    outgoingReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(outgoingReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isBackendRequest &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/register')
      ) {
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
