import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        status: true,
        message: (data as any)?.message ?? 'Success',
        data: (data as any)?.message !== undefined
          ? ((data as any)?.data ?? data)
          : data,
      }) as unknown as ApiResponse<T>),
    );
  }
}
