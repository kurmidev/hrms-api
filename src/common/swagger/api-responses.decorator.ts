import { applyDecorators, Type } from '@nestjs/common';
import {
  ApiResponse,
  ApiOperation,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
  ApiOperationOptions,
} from '@nestjs/swagger';

// ─── Standard error schemas ───────────────────────────────────────────────────

export class ErrorResponseDto {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
}

// ─── Success wrapper schema ───────────────────────────────────────────────────

export class SuccessResponseDto<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

// ─── Paginated wrapper schema ─────────────────────────────────────────────────

export class PaginatedResponseDto<T> {
  success: boolean;
  data: {
    data: T[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
  timestamp: string;
}

// ─── Reusable decorator: wraps a DTO in the standard success envelope ─────────

export function ApiSuccessResponse<T extends Type<unknown>>(
  model: T,
  description = 'Success',
  status = 200,
) {
  return applyDecorators(
    ApiExtraModels(SuccessResponseDto, model),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessResponseDto) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
}

// ─── Reusable decorator: paginated list response ──────────────────────────────

export function ApiPaginatedResponse<T extends Type<unknown>>(
  model: T,
  description = 'Paginated list',
) {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiResponse({
      status: 200,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: {
                properties: {
                  data: { type: 'array', items: { $ref: getSchemaPath(model) } },
                  meta: {
                    properties: {
                      total: { type: 'number', example: 100 },
                      page: { type: 'number', example: 1 },
                      limit: { type: 'number', example: 20 },
                      totalPages: { type: 'number', example: 5 },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
}

// ─── Common error responses applied to every secured endpoint ─────────────────

export function ApiCommonErrorResponses() {
  return applyDecorators(
    ApiResponse({
      status: 400,
      description: 'Bad Request — Validation failed or missing required fields',
      schema: {
        example: {
          statusCode: 400,
          timestamp: '2024-01-15T10:30:00.000Z',
          path: '/api/v1/example',
          method: 'POST',
          error: 'Validation failed: email must be a valid email address',
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized — Invalid or expired token',
      schema: {
        example: {
          statusCode: 401,
          timestamp: '2024-01-15T10:30:00.000Z',
          path: '/api/v1/example',
          method: 'GET',
          error: 'Invalid or expired token',
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden — Insufficient permissions',
      schema: {
        example: {
          statusCode: 403,
          timestamp: '2024-01-15T10:30:00.000Z',
          path: '/api/v1/example',
          method: 'GET',
          error: 'Missing required permissions: payroll:run',
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      schema: {
        example: {
          statusCode: 500,
          timestamp: '2024-01-15T10:30:00.000Z',
          path: '/api/v1/example',
          method: 'GET',
          error: 'Internal server error',
        },
      },
    }),
  );
}

// ─── Convenience: @ApiDoc bundles operation + auth + common errors ─────────────

export function ApiDoc(options: ApiOperationOptions & { auth?: boolean }) {
  const { auth = true, ...operationOptions } = options;
  const decorators = [ApiOperation(operationOptions), ApiCommonErrorResponses()];
  if (auth) decorators.push(ApiBearerAuth());
  return applyDecorators(...decorators);
}
