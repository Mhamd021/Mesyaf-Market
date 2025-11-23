import { Injectable } from '@nestjs/common';

@Injectable()
export class ResponseService 
{
  success(message: string, data?: any, meta?: Record<string, any>) {
    return {
      success: true,
      message,
      data,
      ...(meta && meta),
    };
  }

  error(message: string, code = 400) 
  {
    return {
      success: false,
      message,
      statusCode: code,
    };
  }

  created(message: string, data?: any) {
  return {
    success: true,
    message,
    data,
    statusCode: 201,
  };
}

}

