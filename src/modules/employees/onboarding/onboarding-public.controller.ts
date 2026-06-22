import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/decorators/public.decorator';
import { OnboardingService } from './onboarding.service';
import { SubmitDetailsDto } from '../dto/submit-details.dto';
import { FilesService } from '../../files/files.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@ApiTags('Onboarding (Candidate)')
@Public()
@Throttle({ default: { limit: 15, ttl: 60000 } })
@Controller('onboarding/public')
export class OnboardingPublicController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly filesService: FilesService,
  ) {}

  @Get(':token')
  @ApiOperation({
    summary: 'Repopulate form',
    description: 'Returns current onboarding state and all previously saved submission data for form repopulation. If status is CHANGES_REQUESTED, auto-transitions to IN_PROGRESS.',
  })
  @ApiParam({ name: 'token', description: '48-char hex onboarding token' })
  getForm(@Param('token') token: string) {
    return this.onboardingService.getPublicLink(token);
  }

  @Put(':token/details')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit personal + bank details (Step 1)',
    description: 'Saves personal info and bank details in a single call. Idempotent — can be called again to correct before documents are submitted. Transitions PENDING → IN_PROGRESS on first call.',
  })
  @ApiParam({ name: 'token', description: '48-char hex onboarding token' })
  submitDetails(
    @Param('token') token: string,
    @Body() dto: SubmitDetailsDto,
  ) {
    return this.onboardingService.submitDetails(token, dto);
  }

  @Post(':token/documents')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload documents + final submit (Step 2)',
    description: 'Accepts one or more document files with their types. Upload files in batches. Set finalSubmit=true in the form field to trigger SUBMITTED transition (all docs must already be uploaded). Blocked if Step 1 not completed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        documentTypes: { type: 'array', items: { type: 'string' }, description: 'Parallel array of document type labels (e.g. AADHAAR, PAN)' },
        finalSubmit: { type: 'string', enum: ['true', 'false'], description: 'Set to true to finalise submission' },
      },
    },
  })
  @ApiParam({ name: 'token', description: '48-char hex onboarding token' })
  async submitDocuments(
    @Param('token') token: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('documentTypes') documentTypes: string | string[],
    @Body('finalSubmit') finalSubmit: string,
  ) {
    const typesArray = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
    const doFinalSubmit = finalSubmit === 'true';

    const uploaded: Array<{ type: string; fileName: string; fileUrl: string }> = [];

    if (files?.length) {
      await Promise.all(
        files.map(async (file, i) => {
          const ext = path.extname(file.originalname);
          const key = `onboarding/${token}/${typesArray[i] ?? 'DOC'}-${uuidv4()}${ext}`;
          const fileUrl = await this.filesService.upload(file.buffer, key, file.mimetype);
          uploaded.push({
            type: typesArray[i] ?? 'OTHER',
            fileName: file.originalname,
            fileUrl,
          });
        }),
      );
    }

    return this.onboardingService.submitDocuments(token, uploaded, doFinalSubmit);
  }
}
