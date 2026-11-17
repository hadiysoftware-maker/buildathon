-- CreateTable
CREATE TABLE `LessonLog` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `topic` VARCHAR(200) NOT NULL,
    `summary` VARCHAR(1000) NULL,
    `homework` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LessonLog_divisionId_date_idx`(`divisionId`, `date`),
    INDEX `LessonLog_teacherId_date_idx`(`teacherId`, `date`),
    INDEX `LessonLog_institutionId_idx`(`institutionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
