-- AlterTable: ServiceRequestCategory enum — add POLICY_CLARIFICATION
ALTER TABLE `service_requests`
  MODIFY COLUMN `category` ENUM('HR', 'IT', 'ADMIN', 'COMPLIANCE', 'FINANCE', 'POLICY_CLARIFICATION') NOT NULL;

-- AlterTable: ServiceRequestStatus enum — add ASSIGNED
ALTER TABLE `service_requests`
  MODIFY COLUMN `status` ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN';

-- AlterTable: Organization — add allowAnonymousServiceRequests toggle
ALTER TABLE `organizations`
  ADD COLUMN `allowAnonymousServiceRequests` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: AssetStatus enum — add UNDER_MAINTENANCE, RETIRED
ALTER TABLE `assets`
  MODIFY COLUMN `status` ENUM('AVAILABLE', 'ASSIGNED', 'UNDER_MAINTENANCE', 'RETIRED', 'RETURNED', 'DAMAGED', 'LOST') NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable: AssetAssignment — add exit-recovery hook fields
ALTER TABLE `asset_assignments`
  ADD COLUMN `recoveredAtExit` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `recoveryNotes` VARCHAR(191) NULL;
