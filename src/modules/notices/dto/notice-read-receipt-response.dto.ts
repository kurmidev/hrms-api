import { ApiProperty } from '@nestjs/swagger';

class ReadReceiptEmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  empCode: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;
}

export class NoticeReadReceiptResponseDto {
  @ApiProperty()
  employeeId: string;

  @ApiProperty({ type: ReadReceiptEmployeeDto })
  employee: ReadReceiptEmployeeDto;

  @ApiProperty()
  readAt: Date;
}
