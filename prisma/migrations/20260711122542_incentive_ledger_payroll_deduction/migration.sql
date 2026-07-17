-- AlterTable
ALTER TABLE `incentive_ledger` ADD COLUMN `isDeducted` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `payrollEntryId` VARCHAR(191) NULL;

