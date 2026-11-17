-- CreateTable
CREATE TABLE `PracticeAttempt` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NULL,
    `topic` VARCHAR(200) NOT NULL,
    `score` INTEGER NOT NULL,
    `total` INTEGER NOT NULL,
    `source` VARCHAR(20) NOT NULL,
    `answers` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PracticeAttempt_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PracticeAttempt_institutionId_studentId_idx`(`institutionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
