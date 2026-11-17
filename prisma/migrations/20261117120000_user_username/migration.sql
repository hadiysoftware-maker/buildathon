-- AlterTable
ALTER TABLE `User` ADD COLUMN `username` VARCHAR(40) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_institutionId_username_key` ON `User`(`institutionId`, `username`);
