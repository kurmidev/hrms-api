import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ServiceResponse,
  createSuccessResponse,
} from '@common/interfaces/service-response.interface';

export type ApiResponse<T> = ServiceResponse<T>;

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ServiceResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ServiceResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        const message = (data as any)?.message ?? 'Success';
        const payloadData =
          (data as any)?.message !== undefined ? ((data as any)?.data ?? data) : data;
        const statusCode = context.switchToHttp().getResponse().statusCode;
        return createSuccessResponse<T>(payloadData, message, 'SUCCESS', statusCode);
      }),
    );
  }
}
