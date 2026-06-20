/*
  Warnings:

  - You are about to drop the column `createdBy` on the `chat_rooms` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `notices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `asset_assignments` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `assets` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `attendance_logs` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `chat_rooms` DROP COLUMN `createdBy`,
    ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `departments` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `designations` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `disciplinary_memos` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employee_insurance` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `exit_records` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `green_thanks` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `green_thanks_config` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `holidays` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `incentive_ledger` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `incentive_rules` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `insurance_policies` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `leave_applications` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `leave_policies` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `loan_applications` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `notices` DROP COLUMN `createdBy`,
    ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `onboarding_links` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payroll_entries` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payroll_runs` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `payroll_structures` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `performance_cycles` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `reminders` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `roles` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `service_request_comments` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `service_requests` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `tax_rules` ADD COLUMN `createdById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `todo_tasks` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;
