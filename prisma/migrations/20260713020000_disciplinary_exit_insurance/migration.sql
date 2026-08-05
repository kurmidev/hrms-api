-- AlterTable: Employee — add termination-review flag (5-memo threshold trigger target)
ALTER TABLE `employees`
  ADD COLUMN `flaggedForTerminationReview` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `terminationReviewFlaggedAt` DATETIME(3) NULL;

-- ─── DISCIPLINARY ───────────────────────────────────────────────────────────

-- AlterTable: DisciplinaryMemo — tenant-scope fix + SRS fields (all tables empty, safe to convert type -> enum)
ALTER TABLE `disciplinary_memos`
  ADD COLUMN `organizationId` VARCHAR(191) NOT NULL,
  ADD COLUMN `title` VARCHAR(191) NOT NULL,
  ADD COLUMN `issuingAuthority` VARCHAR(191) NULL,
  ADD COLUMN `approvalReference` VARCHAR(191) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
  ADD COLUMN `updatedById` VARCHAR(191) NULL,
  MODIFY COLUMN `type` ENUM('VERBAL_WARNING', 'WRITTEN_WARNING', 'DEMOTION', 'SUSPENSION') NOT NULL,
  MODIFY COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active';

CREATE INDEX `disciplinary_memos_organizationId_fkey` ON `disciplinary_memos`(`organizationId`);

ALTER TABLE `disciplinary_memos`
  ADD CONSTRAINT `disciplinary_memos_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── EXIT MANAGEMENT ────────────────────────────────────────────────────────

-- AlterTable: ExitRecord — tenant-scope fix + notice-period / initiator / target-settlement fields
ALTER TABLE `exit_records`
  ADD COLUMN `organizationId` VARCHAR(191) NOT NULL,
  ADD COLUMN `initiatedBy` ENUM('SELF', 'MANAGEMENT') NOT NULL,
  ADD COLUMN `noticeStartDate` DATETIME(3) NULL,
  ADD COLUMN `lastWorkingDate` DATETIME(3) NULL,
  ADD COLUMN `targetSettlementDate` DATETIME(3) NULL,
  ADD COLUMN `knowledgeTransferComplete` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
  ADD COLUMN `updatedById` VARCHAR(191) NULL;

CREATE INDEX `exit_records_organizationId_fkey` ON `exit_records`(`organizationId`);

ALTER TABLE `exit_records`
  ADD CONSTRAINT `exit_records_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── INSURANCE & STATUTORY ──────────────────────────────────────────────────

-- AlterTable: InsurancePolicy — name / validity fields + type -> enum
ALTER TABLE `insurance_policies`
  ADD COLUMN `name` VARCHAR(191) NOT NULL,
  ADD COLUMN `validFrom` DATETIME(3) NULL,
  ADD COLUMN `validTo` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
  ADD COLUMN `updatedById` VARCHAR(191) NULL,
  MODIFY COLUMN `type` ENUM('HEALTH', 'ACCIDENTAL') NOT NULL;

-- AlterTable: EmployeeInsurance — approval workflow fields
ALTER TABLE `employee_insurance`
  ADD COLUMN `approvalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `approvedBy` VARCHAR(191) NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
  ADD COLUMN `updatedById` VARCHAR(191) NULL;
