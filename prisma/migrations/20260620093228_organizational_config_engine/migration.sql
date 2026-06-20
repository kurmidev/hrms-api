/*
  Warnings:

  - Added the required column `updatedAt` to the `tax_rules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `departments` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `hierarchyLevel` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `designations` ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `payrollStructureId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `leave_policies` ADD COLUMN `allowedInProbation` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `genderRestriction` VARCHAR(191) NULL,
    ADD COLUMN `maxConsecutiveDays` INTEGER NULL;

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `currency` ENUM('AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GHS', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF', 'IDR', 'ILS', 'INR', 'IQD', 'IRR', 'ISK', 'JMD', 'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND', 'TOP', 'TRY', 'TTD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL') NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE `payroll_structures` ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `tax_rules` ADD COLUMN `applicabilityRules` JSON NULL,
    ADD COLUMN `applicableOn` VARCHAR(191) NOT NULL DEFAULT 'GROSS',
    ADD COLUMN `calculationType` VARCHAR(191) NOT NULL DEFAULT 'PERCENTAGE',
    ADD COLUMN `code` VARCHAR(191) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `isStatutory` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `leave_policy_rules` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leavePolicyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ruleType` VARCHAR(191) NOT NULL,
    `conditionLogic` VARCHAR(191) NOT NULL DEFAULT 'AND',
    `conditions` JSON NOT NULL,
    `action` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_payrollStructureId_fkey` FOREIGN KEY (`payrollStructureId`) REFERENCES `payroll_structures`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_policy_rules` ADD CONSTRAINT `leave_policy_rules_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_policy_rules` ADD CONSTRAINT `leave_policy_rules_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
