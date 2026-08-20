export interface ServiceResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: any;
  errorType: string;
  httpCode: number;
}

export const createSuccessResponse = <T>(
  data: T,
  message = 'Success',
  errorType = 'SUCCESS',
  httpCode = 200,
): ServiceResponse<T> => ({
  success: true,
  message,
  data,
  errorType,
  httpCode,
});

export const createFailureResponse = <T = undefined>(
  message: string,
  error?: any,
  errorType = 'PROCESSING_FAILED',
  httpCode = 400,
): ServiceResponse<T> => ({
  success: false,
  message,
  error,
  errorType,
  httpCode,
});
