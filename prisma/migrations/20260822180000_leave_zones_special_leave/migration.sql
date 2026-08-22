-- Restructure LeavePolicy into a bundle (LeavePolicy) + per-type rows
-- (LeavePolicyType), add Zone/GlobalLeave, and extend ServiceRequest for
-- manager-filed special leave requests. Data-preserving: every existing
-- LeavePolicy row (previously exactly one leaveType) becomes both the bundle
-- AND its single LeavePolicyType, reusing the same id, so leave_balances/
-- leave_applications FK values stay valid across the rename below.

-- CreateTable
CREATE TABLE `leave_policy_types` (
    `id` VARCHAR(191) NOT NULL,
    `leavePolicyId` VARCHAR(191) NOT NULL,
    `leaveType` ENUM('CASUAL', 'SICK', 'EARNED', 'LOSS_OF_PAY', 'MATERNITY', 'PATERNITY', 'COMPENSATORY') NOT NULL,
    `name` VARCHAR(191) NULL,
    `daysPerYear` DOUBLE NOT NULL,
    `carryForwardMax` DOUBLE NOT NULL DEFAULT 0,
    `accrualType` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `isEncashable` BOOLEAN NOT NULL DEFAULT false,
    `isLopEligible` BOOLEAN NOT NULL DEFAULT true,
    `minAdvanceDays` INTEGER NOT NULL DEFAULT 0,
    `maxConsecutiveDays` INTEGER NULL,
    `allowedInProbation` BOOLEAN NOT NULL DEFAULT false,
    `genderRestriction` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_policy_types_leavePolicyId_leaveType_key`(`leavePolicyId`, `leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey (added now so the backfill insert below is constraint-safe)
ALTER TABLE `leave_policy_types` ADD CONSTRAINT `leave_policy_types_leavePolicyId_fkey` FOREIGN KEY (`leavePolicyId`) REFERENCES `leave_policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one LeavePolicyType per existing LeavePolicy, id = old policy id
INSERT INTO `leave_policy_types`
  (`id`, `leavePolicyId`, `leaveType`, `daysPerYear`, `carryForwardMax`, `accrualType`, `isEncashable`, `isLopEligible`, `minAdvanceDays`, `maxConsecutiveDays`, `allowedInProbation`, `genderRestriction`, `createdAt`, `updatedAt`)
  SELECT `id`, `id`, `leaveType`, `daysPerYear`, `carryForwardMax`, `accrualType`, `isEncashable`, `isLopEligible`, `minAdvanceDays`, `maxConsecutiveDays`, `allowedInProbation`, `genderRestriction`, `createdAt`, `updatedAt`
  FROM `leave_policies`;

-- AlterTable: leave_balances gets leavePolicyTypeId, backfilled from the
-- (numerically identical) old leavePolicyId, then the old FK/column drop.
-- NOTE: the new composite unique index is created BEFORE the old one is
-- dropped — the old (employeeId, leavePolicyId, year) index is the only
-- index currently supporting the `leave_balances_employeeId_fkey` FK, and
-- MySQL (error 1553) refuses to drop it while it's the sole supporting
-- index for that FK.
ALTER TABLE `leave_balances` ADD COLUMN `leavePolicyTypeId` VARCHAR(191) NULL;
UPDATE `leave_balances` SET `leavePolicyTypeId` = `leavePolicyId`;
ALTER TABLE `leave_balances` MODIFY COLUMN `leavePolicyTypeId` VARCHAR(191) NOT NULL;
ALTER TABLE `leave_balances` DROP FOREIGN KEY `leave_balances_leavePolicyId_fkey`;
CREATE UNIQUE INDEX `leave_balances_employeeId_leavePolicyTypeId_year_key` ON `leave_balances`(`employeeId`, `leavePolicyTypeId`, `year`);
DROP INDEX `leave_balances_employeeId_leavePolicyId_year_key` ON `leave_balances`;
ALTER TABLE `leave_balances` DROP COLUMN `leavePolicyId`;
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_leavePolicyTypeId_fkey` FOREIGN KEY (`leavePolicyTypeId`) REFERENCES `leave_policy_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: leave_applications, same pattern, plus isSpecial
ALTER TABLE `leave_applications` ADD COLUMN `leavePolicyTypeId` VARCHAR(191) NULL;
UPDATE `leave_applications` SET `leavePolicyTypeId` = `leavePolicyId`;
ALTER TABLE `leave_applications` MODIFY COLUMN `leavePolicyTypeId` VARCHAR(191) NOT NULL;
ALTER TABLE `leave_applications` ADD COLUMN `isSpecial` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `leave_applications` DROP FOREIGN KEY `leave_applications_leavePolicyId_fkey`;
ALTER TABLE `leave_applications` DROP COLUMN `leavePolicyId`;
ALTER TABLE `leave_applications` ADD CONSTRAINT `leave_applications_leavePolicyTypeId_fkey` FOREIGN KEY (`leavePolicyTypeId`) REFERENCES `leave_policy_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: leave_policies drops the now-relocated per-type columns
ALTER TABLE `leave_policies` DROP COLUMN `accrualType`,
    DROP COLUMN `allowedInProbation`,
    DROP COLUMN `carryForwardMax`,
    DROP COLUMN `daysPerYear`,
    DROP COLUMN `genderRestriction`,
    DROP COLUMN `isEncashable`,
    DROP COLUMN `isLopEligible`,
    DROP COLUMN `leaveType`,
    DROP COLUMN `maxConsecutiveDays`,
    DROP COLUMN `minAdvanceDays`;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `zoneId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `service_requests` ADD COLUMN `leaveApplicationId` VARCHAR(191) NULL,
    ADD COLUMN `leaveDays` DOUBLE NULL,
    ADD COLUMN `leaveFromDate` DATETIME(3) NULL,
    ADD COLUMN `leavePolicyTypeId` VARCHAR(191) NULL,
    ADD COLUMN `leaveToDate` DATETIME(3) NULL,
    MODIFY `category` ENUM('HR', 'IT', 'ADMIN', 'COMPLIANCE', 'FINANCE', 'POLICY_CLARIFICATION', 'SPECIAL_LEAVE') NOT NULL;

-- CreateTable
CREATE TABLE `zones` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,

    UNIQUE INDEX `zones_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `global_leaves` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `appliesToAll` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_GlobalLeaveZones` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_GlobalLeaveZones_AB_unique`(`A`, `B`),
    INDEX `_GlobalLeaveZones_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `service_requests_leaveApplicationId_key` ON `service_requests`(`leaveApplicationId`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_zoneId_fkey` FOREIGN KEY (`zoneId`) REFERENCES `zones`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `zones` ADD CONSTRAINT `zones_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `global_leaves` ADD CONSTRAINT `global_leaves_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_leavePolicyTypeId_fkey` FOREIGN KEY (`leavePolicyTypeId`) REFERENCES `leave_policy_types`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_leaveApplicationId_fkey` FOREIGN KEY (`leaveApplicationId`) REFERENCES `leave_applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GlobalLeaveZones` ADD CONSTRAINT `_GlobalLeaveZones_A_fkey` FOREIGN KEY (`A`) REFERENCES `global_leaves`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GlobalLeaveZones` ADD CONSTRAINT `_GlobalLeaveZones_B_fkey` FOREIGN KEY (`B`) REFERENCES `zones`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
