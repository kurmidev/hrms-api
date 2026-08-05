-- AlterTable (add new columns first, before dropping the old composite index)
ALTER TABLE `performance_cycles`
    ADD COLUMN `endDate` DATETIME(3) NOT NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `startDate` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'ACTIVE', 'CLOSED') NOT NULL DEFAULT 'DRAFT';

-- CreateIndex (must exist before dropping the old composite index, since the
-- old index also backs the organizationId foreign key)
CREATE UNIQUE INDEX `performance_cycles_organizationId_name_key` ON `performance_cycles`(`organizationId`, `name`);

-- DropIndex
DROP INDEX `performance_cycles_organizationId_month_year_key` ON `performance_cycles`;

-- AlterTable
ALTER TABLE `performance_cycles` DROP COLUMN `month`,
    DROP COLUMN `year`;

-- AlterTable
ALTER TABLE `performance_ratings` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL,
    ADD COLUMN `updatedById` VARCHAR(191) NULL;
