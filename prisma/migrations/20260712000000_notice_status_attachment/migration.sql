-- AlterTable
ALTER TABLE `notices`
  ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  ADD COLUMN `attachmentUrl` VARCHAR(191) NULL,
  ADD COLUMN `attachmentKey` VARCHAR(191) NULL,
  ADD COLUMN `attachmentName` VARCHAR(191) NULL;
