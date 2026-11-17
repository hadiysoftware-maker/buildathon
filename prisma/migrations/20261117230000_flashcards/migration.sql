-- CreateTable
CREATE TABLE `Flashcard` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `topic` VARCHAR(120) NOT NULL,
    `front` VARCHAR(400) NOT NULL,
    `back` VARCHAR(600) NOT NULL,
    `box` INTEGER NOT NULL DEFAULT 1,
    `dueAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Flashcard_userId_dueAt_idx`(`userId`, `dueAt`),
    INDEX `Flashcard_institutionId_idx`(`institutionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
