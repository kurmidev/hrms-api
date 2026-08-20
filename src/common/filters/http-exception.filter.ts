import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { createFailureResponse } from '@common/interfaces/service-response.interface';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const details =
      typeof message === 'object'
        ? {
            ...(message as Record<string, unknown>),
            statusCode: status,
            path: request.url,
            method: request.method,
          }
        : {
            statusCode: status,
            path: request.url,
            method: request.method,
          };

    // Surface any machine-readable `code` (e.g. MUST_CHANGE_PASSWORD) as the
    // top-level errorType so consumers have one predictable place to branch on,
    // while the full details remain available under `error`.
    const errorType =
      typeof message === 'object' && (message as any)?.code
        ? String((message as any).code)
        : `HTTP_${status}`;

    // `ValidationPipe` (class-validator) throws with `{ message: string[], ... }`
    // (one entry per failed field), NOT a single string — every other
    // HttpException subtype puts a plain string on `.message`. The
    // `ServiceResponse.message` contract (service-response.interface.ts) is
    // typed as `string`, so an array here would silently violate it for every
    // consumer that assumes `response.message` is directly renderable (e.g.
    // `toast.error(response.message)`). Join multi-message validation arrays
    // into one string; the raw array is still available to callers that want
    // per-field detail via `error.message` (see `details` above, which spreads
    // the original exception body).
    const rawMessage = (message as any)?.message ?? (message as any)?.error ?? 'An error occurred';
    const responseMessage =
      typeof message === 'string'
        ? message
        : Array.isArray(rawMessage)
          ? rawMessage.join(' ')
          : String(rawMessage);

    response
      .status(status)
      .json(createFailureResponse(responseMessage, details, errorType, status));
  }
}
