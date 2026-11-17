-- CreateTable
CREATE TABLE `Institution` (
    `id` VARCHAR(30) NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `logoKey` VARCHAR(255) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Institution_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InstitutionSetting` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `value` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InstitutionSetting_institutionId_key_key`(`institutionId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `fullName` VARCHAR(160) NOT NULL,
    `email` VARCHAR(191) NULL,
    `photoKey` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `passwordHash` VARCHAR(255) NULL,
    `failedLogins` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    INDEX `User_institutionId_status_idx`(`institutionId`, `status`),
    UNIQUE INDEX `User_institutionId_email_key`(`institutionId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `key` ENUM('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'GUARDIAN') NOT NULL,
    `name` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `Role_institutionId_key_key`(`institutionId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(30) NOT NULL,
    `key` VARCHAR(80) NOT NULL,
    `description` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(30) NOT NULL,
    `permissionId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(30) NOT NULL,
    `roleId` VARCHAR(30) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentProfile` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `studentCode` VARCHAR(40) NOT NULL,
    `admissionNumber` VARCHAR(40) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `dateOfBirth` DATE NULL,
    `guardianName` VARCHAR(160) NULL,
    `guardianPhone` VARCHAR(32) NULL,
    `guardianRelation` VARCHAR(40) NULL,
    `departmentId` VARCHAR(30) NULL,
    `courseId` VARCHAR(30) NULL,
    `admissionDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentProfile_userId_key`(`userId`),
    UNIQUE INDEX `StudentProfile_institutionId_studentCode_key`(`institutionId`, `studentCode`),
    UNIQUE INDEX `StudentProfile_institutionId_admissionNumber_key`(`institutionId`, `admissionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeacherProfile` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `teacherCode` VARCHAR(40) NOT NULL,
    `employeeId` VARCHAR(40) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `departmentId` VARCHAR(30) NULL,
    `qualification` VARCHAR(160) NULL,
    `designation` VARCHAR(120) NULL,
    `specialization` VARCHAR(160) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeacherProfile_userId_key`(`userId`),
    UNIQUE INDEX `TeacherProfile_institutionId_teacherCode_key`(`institutionId`, `teacherCode`),
    UNIQUE INDEX `TeacherProfile_institutionId_employeeId_key`(`institutionId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuardianProfile` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `phone` VARCHAR(32) NULL,

    UNIQUE INDEX `GuardianProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuardianLink` (
    `guardianId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `relation` VARCHAR(40) NOT NULL,
    `approved` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`guardianId`, `studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmartIdCredential` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `secretHash` CHAR(64) NOT NULL,
    `cardNumber` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'REVOKED', 'REPLACED') NOT NULL DEFAULT 'ACTIVE',
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issuedById` VARCHAR(30) NULL,
    `statusChangedAt` DATETIME(3) NULL,
    `statusChangedById` VARCHAR(30) NULL,
    `statusReason` VARCHAR(255) NULL,
    `replacedById` VARCHAR(30) NULL,
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SmartIdCredential_replacedById_key`(`replacedById`),
    INDEX `SmartIdCredential_userId_status_idx`(`userId`, `status`),
    INDEX `SmartIdCredential_institutionId_status_idx`(`institutionId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthSession` (
    `id` VARCHAR(30) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `kind` ENUM('ADMIN_WEB', 'SMART_ID_WEB', 'KIOSK') NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'STUDENT', 'GUARDIAN') NOT NULL,
    `credentialId` VARCHAR(30) NULL,
    `deviceId` VARCHAR(30) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revokeReason` VARCHAR(120) NULL,

    UNIQUE INDEX `AuthSession_tokenHash_key`(`tokenHash`),
    INDEX `AuthSession_userId_revokedAt_idx`(`userId`, `revokedAt`),
    INDEX `AuthSession_credentialId_idx`(`credentialId`),
    INDEX `AuthSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegisteredDevice` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `assetTag` VARCHAR(60) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `assignedStudentId` VARCHAR(30) NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED') NOT NULL DEFAULT 'PENDING',
    `publicKeyJwk` JSON NULL,
    `enrollmentCodeHash` CHAR(64) NULL,
    `enrollmentExpiresAt` DATETIME(3) NULL,
    `enrolledAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegisteredDevice_assignedStudentId_idx`(`assignedStudentId`),
    UNIQUE INDEX `RegisteredDevice_institutionId_assetTag_key`(`institutionId`, `assetTag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DeviceChallenge` (
    `id` VARCHAR(30) NOT NULL,
    `deviceId` VARCHAR(30) NOT NULL,
    `nonce` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,

    UNIQUE INDEX `DeviceChallenge_nonce_key`(`nonce`),
    INDEX `DeviceChallenge_deviceId_expiresAt_idx`(`deviceId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthenticationLog` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NULL,
    `userId` VARCHAR(30) NULL,
    `credentialId` VARCHAR(30) NULL,
    `deviceId` VARCHAR(30) NULL,
    `method` ENUM('SMART_ID', 'ADMIN_PASSWORD', 'DEVICE_ENROLLMENT') NOT NULL,
    `result` ENUM('SUCCESS', 'INVALID_CREDENTIAL', 'REVOKED', 'SUSPENDED', 'REPLACED', 'ACCOUNT_INACTIVE', 'DEVICE_UNAUTHORIZED', 'WRONG_PORTAL', 'RATE_LIMITED', 'LOCKED') NOT NULL,
    `portal` VARCHAR(20) NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuthenticationLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `AuthenticationLog_credentialId_createdAt_idx`(`credentialId`, `createdAt`),
    INDEX `AuthenticationLog_institutionId_createdAt_idx`(`institutionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateLimitBucket` (
    `key` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,
    `windowStart` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AcademicYear` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AcademicYear_institutionId_status_idx`(`institutionId`, `status`),
    UNIQUE INDEX `AcademicYear_institutionId_name_key`(`institutionId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `headTeacherId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Department_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `departmentId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `durationYears` INTEGER NOT NULL DEFAULT 3,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Course_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseSubject` (
    `courseId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `yearLevel` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`courseId`, `subjectId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Class` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `courseId` VARCHAR(30) NOT NULL,
    `academicYearId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `yearLevel` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    INDEX `Class_institutionId_idx`(`institutionId`),
    UNIQUE INDEX `Class_academicYearId_courseId_yearLevel_name_key`(`academicYearId`, `courseId`, `yearLevel`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Division` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `classId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 60,
    `classTeacherId` VARCHAR(30) NULL,
    `classroomId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Division_classId_name_key`(`classId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Classroom` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `building` VARCHAR(120) NULL,
    `capacity` INTEGER NOT NULL DEFAULT 60,
    `hasSmartBoard` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Classroom_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `departmentId` VARCHAR(30) NULL,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `type` ENUM('THEORY', 'PRACTICAL', 'BOTH') NOT NULL DEFAULT 'THEORY',
    `credits` DECIMAL(4, 1) NOT NULL DEFAULT 0,
    `periodsPerWeek` INTEGER NOT NULL DEFAULT 4,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Subject_institutionId_code_key`(`institutionId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Period` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `startTime` CHAR(5) NOT NULL,
    `endTime` CHAR(5) NOT NULL,
    `kind` ENUM('CLASS', 'BREAK', 'LUNCH') NOT NULL DEFAULT 'CLASS',
    `archivedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Period_institutionId_sequence_key`(`institutionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enrollment` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `academicYearId` VARCHAR(30) NOT NULL,
    `rollNumber` INTEGER NULL,
    `status` ENUM('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'WITHDRAWN') NOT NULL DEFAULT 'ACTIVE',
    `enrolledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    INDEX `Enrollment_divisionId_status_idx`(`divisionId`, `status`),
    UNIQUE INDEX `Enrollment_studentId_academicYearId_divisionId_key`(`studentId`, `academicYearId`, `divisionId`),
    UNIQUE INDEX `Enrollment_divisionId_rollNumber_key`(`divisionId`, `rollNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeacherAssignment` (
    `id` VARCHAR(30) NOT NULL,
    `academicYearId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `periodsPerWeek` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TeacherAssignment_teacherId_idx`(`teacherId`),
    UNIQUE INDEX `TeacherAssignment_divisionId_subjectId_key`(`divisionId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimetableEntry` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `academicYearId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `dayOfWeek` TINYINT NOT NULL,
    `periodId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `classroomId` VARCHAR(30) NULL,
    `status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TimetableEntry_teacherId_dayOfWeek_periodId_idx`(`teacherId`, `dayOfWeek`, `periodId`),
    INDEX `TimetableEntry_classroomId_dayOfWeek_periodId_idx`(`classroomId`, `dayOfWeek`, `periodId`),
    INDEX `TimetableEntry_academicYearId_idx`(`academicYearId`),
    UNIQUE INDEX `TimetableEntry_divisionId_dayOfWeek_periodId_key`(`divisionId`, `dayOfWeek`, `periodId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimetableOverride` (
    `id` VARCHAR(30) NOT NULL,
    `entryId` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('CANCELLED', 'SUBSTITUTED') NOT NULL,
    `substituteTeacherId` VARCHAR(30) NULL,
    `reason` VARCHAR(255) NULL,
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TimetableOverride_entryId_date_key`(`entryId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassroomSession` (
    `id` VARCHAR(30) NOT NULL,
    `timetableEntryId` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `status` ENUM('SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `startedAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `topicsCovered` TEXT NULL,
    `teacherObservations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClassroomSession_teacherId_date_idx`(`teacherId`, `date`),
    UNIQUE INDEX `ClassroomSession_timetableEntryId_date_key`(`timetableEntryId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassroomParticipant` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,

    UNIQUE INDEX `ClassroomParticipant_sessionId_studentId_key`(`sessionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassroomEvent` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `payload` JSON NULL,
    `actorId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ClassroomEvent_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassroomAnnouncement` (
    `id` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attendance` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `timetableEntryId` VARCHAR(30) NOT NULL,
    `date` DATE NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `periodId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `sessionId` VARCHAR(30) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'LEFT_EARLY') NOT NULL,
    `source` ENUM('TEACHER_SCAN', 'TEACHER_MANUAL', 'SESSION_SIGNAL') NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `note` VARCHAR(255) NULL,

    INDEX `Attendance_divisionId_date_idx`(`divisionId`, `date`),
    INDEX `Attendance_teacherId_date_idx`(`teacherId`, `date`),
    UNIQUE INDEX `Attendance_studentId_timetableEntryId_date_key`(`studentId`, `timetableEntryId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileObject` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `bucket` VARCHAR(80) NOT NULL,
    `objectKey` VARCHAR(512) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `sha256` CHAR(64) NULL,
    `uploadedById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `FileObject_bucket_objectKey_key`(`bucket`, `objectKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assignment` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `instructions` TEXT NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `submissionType` ENUM('WRITTEN', 'PDF', 'DOCUMENT', 'IMAGE', 'VIDEO', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'PRACTICAL', 'PROJECT') NOT NULL,
    `maxMarks` DECIMAL(6, 2) NOT NULL,
    `publishAt` DATETIME(3) NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `allowLate` BOOLEAN NOT NULL DEFAULT false,
    `allowResubmission` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Assignment_divisionId_status_idx`(`divisionId`, `status`),
    INDEX `Assignment_teacherId_idx`(`teacherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentTarget` (
    `assignmentId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`assignmentId`, `studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssignmentAttachment` (
    `assignmentId` VARCHAR(30) NOT NULL,
    `fileId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`assignmentId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Submission` (
    `id` VARCHAR(30) NOT NULL,
    `assignmentId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('SUBMITTED', 'LATE', 'GRADED', 'RETURNED', 'RESUBMIT_REQUESTED') NOT NULL DEFAULT 'SUBMITTED',
    `textAnswer` TEXT NULL,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Submission_assignmentId_studentId_attempt_key`(`assignmentId`, `studentId`, `attempt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubmissionFile` (
    `submissionId` VARCHAR(30) NOT NULL,
    `fileId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`submissionId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Grade` (
    `id` VARCHAR(30) NOT NULL,
    `submissionId` VARCHAR(30) NOT NULL,
    `marks` DECIMAL(6, 2) NOT NULL,
    `status` ENUM('DRAFT', 'RELEASED') NOT NULL DEFAULT 'DRAFT',
    `gradedById` VARCHAR(30) NOT NULL,
    `gradedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `releasedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Grade_submissionId_key`(`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` VARCHAR(30) NOT NULL,
    `submissionId` VARCHAR(30) NOT NULL,
    `authorId` VARCHAR(30) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Textbook` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `title` VARCHAR(255) NOT NULL,
    `authors` VARCHAR(255) NULL,
    `isbn` VARCHAR(20) NULL,
    `format` ENUM('PDF', 'EPUB', 'VIDEO', 'DOCUMENT', 'LINK', 'NOTE') NOT NULL DEFAULT 'PDF',
    `fileId` VARCHAR(30) NULL,
    `pageCount` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Chapter` (
    `id` VARCHAR(30) NOT NULL,
    `textbookId` VARCHAR(30) NOT NULL,
    `number` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `startPage` INTEGER NULL,
    `endPage` INTEGER NULL,

    UNIQUE INDEX `Chapter_textbookId_number_key`(`textbookId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningMaterial` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `chapterId` VARCHAR(30) NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('PDF', 'EPUB', 'VIDEO', 'DOCUMENT', 'LINK', 'NOTE') NOT NULL,
    `fileId` VARCHAR(30) NULL,
    `url` VARCHAR(1024) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialAssignment` (
    `id` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `materialId` VARCHAR(30) NULL,
    `chapterId` VARCHAR(30) NULL,
    `assignedById` VARCHAR(30) NOT NULL,
    `availableFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MaterialAssignment_divisionId_idx`(`divisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentBookmark` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `textbookId` VARCHAR(30) NOT NULL,
    `page` INTEGER NOT NULL,
    `label` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentNote` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `textbookId` VARCHAR(30) NULL,
    `materialId` VARCHAR(30) NULL,
    `page` INTEGER NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReadingProgress` (
    `studentId` VARCHAR(30) NOT NULL,
    `textbookId` VARCHAR(30) NOT NULL,
    `lastPage` INTEGER NOT NULL DEFAULT 1,
    `percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`, `textbookId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Question` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `type` ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'DESCRIPTIVE', 'IMAGE_BASED', 'POLL', 'APPLICATION') NOT NULL,
    `prompt` TEXT NOT NULL,
    `imageFileId` VARCHAR(30) NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'ADVANCED') NOT NULL DEFAULT 'MEDIUM',
    `correctAnswer` TEXT NULL,
    `explanation` TEXT NULL,
    `source` ENUM('MANUAL', 'AI_GENERATED') NOT NULL DEFAULT 'MANUAL',
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionOption` (
    `id` VARCHAR(30) NOT NULL,
    `questionId` VARCHAR(30) NOT NULL,
    `label` VARCHAR(500) NOT NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `sequence` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quiz` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `timeLimitSec` INTEGER NULL,
    `randomize` BOOLEAN NOT NULL DEFAULT false,
    `showLeaderboard` BOOLEAN NOT NULL DEFAULT false,
    `scheduledFor` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizQuestion` (
    `quizId` VARCHAR(30) NOT NULL,
    `questionId` VARCHAR(30) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `points` DECIMAL(5, 2) NOT NULL DEFAULT 1,

    PRIMARY KEY (`quizId`, `questionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizSession` (
    `id` VARCHAR(30) NOT NULL,
    `quizId` VARCHAR(30) NOT NULL,
    `classroomSessionId` VARCHAR(30) NULL,
    `status` ENUM('SCHEDULED', 'LIVE', 'CLOSED') NOT NULL DEFAULT 'SCHEDULED',
    `startedAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizResponse` (
    `id` VARCHAR(30) NOT NULL,
    `quizSessionId` VARCHAR(30) NOT NULL,
    `questionId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `answer` TEXT NULL,
    `selectedOptionId` VARCHAR(30) NULL,
    `isCorrect` BOOLEAN NULL,
    `score` DECIMAL(5, 2) NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuizResponse_studentId_idx`(`studentId`),
    UNIQUE INDEX `QuizResponse_quizSessionId_questionId_studentId_key`(`quizSessionId`, `questionId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Assessment` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `type` ENUM('EXAM', 'TEST', 'PRACTICAL', 'INTERNAL') NOT NULL,
    `subjectId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NOT NULL,
    `maxMarks` DECIMAL(6, 2) NOT NULL,
    `heldOn` DATE NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssessmentResult` (
    `id` VARCHAR(30) NOT NULL,
    `assessmentId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `marks` DECIMAL(6, 2) NOT NULL,
    `grade` VARCHAR(8) NULL,
    `remarks` VARCHAR(500) NULL,
    `recordedById` VARCHAR(30) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AssessmentResult_assessmentId_studentId_key`(`assessmentId`, `studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentPortfolio` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `headline` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentPortfolio_studentId_key`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PortfolioEntry` (
    `id` VARCHAR(30) NOT NULL,
    `portfolioId` VARCHAR(30) NOT NULL,
    `type` ENUM('QUIZ', 'ASSIGNMENT', 'PROJECT', 'ACHIEVEMENT', 'CERTIFICATE', 'SKILL', 'MILESTONE', 'EXAM_RESULT') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `summary` TEXT NULL,
    `sourceType` VARCHAR(60) NOT NULL,
    `sourceId` VARCHAR(30) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PortfolioEntry_portfolioId_occurredAt_idx`(`portfolioId`, `occurredAt`),
    UNIQUE INDEX `PortfolioEntry_portfolioId_sourceType_sourceId_key`(`portfolioId`, `sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompetencyFramework` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `departmentId` VARCHAR(30) NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `archivedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Skill` (
    `id` VARCHAR(30) NOT NULL,
    `frameworkId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `criteria` JSON NULL,

    UNIQUE INDEX `Skill_frameworkId_name_key`(`frameworkId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentSkill` (
    `studentId` VARCHAR(30) NOT NULL,
    `skillId` VARCHAR(30) NOT NULL,
    `level` TINYINT NOT NULL,
    `lastAssessedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`studentId`, `skillId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompetencyAssessment` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `skillId` VARCHAR(30) NOT NULL,
    `level` TINYINT NOT NULL,
    `evidence` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `aiSuggested` BOOLEAN NOT NULL DEFAULT false,
    `assessedById` VARCHAR(30) NULL,
    `assessedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CompetencyAssessment_studentId_skillId_idx`(`studentId`, `skillId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentProject` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `links` JSON NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `verifiedById` VARCHAR(30) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectAttachment` (
    `projectId` VARCHAR(30) NOT NULL,
    `fileId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`projectId`, `fileId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectCollaborator` (
    `projectId` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,

    PRIMARY KEY (`projectId`, `studentId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Achievement` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `description` TEXT NULL,
    `awardedOn` DATE NULL,
    `fileId` VARCHAR(30) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AchievementVerification` (
    `id` VARCHAR(30) NOT NULL,
    `achievementId` VARCHAR(30) NOT NULL,
    `verifierId` VARCHAR(30) NOT NULL,
    `decision` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL,
    `note` VARCHAR(500) NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningMilestone` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sourceType` VARCHAR(60) NOT NULL,
    `sourceId` VARCHAR(30) NULL,
    `reachedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LearningRecommendation` (
    `id` VARCHAR(30) NOT NULL,
    `studentId` VARCHAR(30) NOT NULL,
    `subjectId` VARCHAR(30) NULL,
    `kind` VARCHAR(40) NOT NULL,
    `body` TEXT NOT NULL,
    `evidence` JSON NOT NULL,
    `source` ENUM('AI', 'TEACHER') NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `publishedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CopilotSession` (
    `id` VARCHAR(30) NOT NULL,
    `classroomSessionId` VARCHAR(30) NOT NULL,
    `teacherId` VARCHAR(30) NOT NULL,
    `status` ENUM('IDLE', 'CAPTURING', 'PAUSED', 'STOPPED', 'REVIEW', 'PUBLISHED') NOT NULL DEFAULT 'IDLE',
    `sttProvider` VARCHAR(40) NULL,
    `llmProvider` VARCHAR(40) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CaptureConsent` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `grantedById` VARCHAR(30) NOT NULL,
    `scope` VARCHAR(80) NOT NULL,
    `policyVersion` VARCHAR(20) NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TranscriptSegment` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `startMs` INTEGER NULL,
    `endMs` INTEGER NULL,
    `text` TEXT NOT NULL,
    `source` ENUM('MICROPHONE', 'MANUAL', 'UPLOAD') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TranscriptSegment_copilotSessionId_sequence_key`(`copilotSessionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LessonNote` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `contentMd` MEDIUMTEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `approvedById` VARCHAR(30) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KeyConcept` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `term` VARCHAR(200) NOT NULL,
    `definition` TEXT NULL,
    `sourceSegments` JSON NULL,
    `uncertain` BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevisionPackage` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `approvedById` VARCHAR(30) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevisionResource` (
    `id` VARCHAR(30) NOT NULL,
    `packageId` VARCHAR(30) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `content` JSON NOT NULL,
    `sequence` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedQuestion` (
    `id` VARCHAR(30) NOT NULL,
    `copilotSessionId` VARCHAR(30) NOT NULL,
    `type` ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'DESCRIPTIVE', 'IMAGE_BASED', 'POLL', 'APPLICATION') NOT NULL,
    `difficulty` ENUM('EASY', 'MEDIUM', 'ADVANCED') NOT NULL,
    `prompt` TEXT NOT NULL,
    `options` JSON NULL,
    `answer` TEXT NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `questionId` VARCHAR(30) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CopilotPublication` (
    `id` VARCHAR(30) NOT NULL,
    `packageId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NULL,
    `studentId` VARCHAR(30) NULL,
    `publishedById` VARCHAR(30) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIProvider` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `key` VARCHAR(40) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `baseUrl` VARCHAR(255) NOT NULL,
    `apiKeyEnvVar` VARCHAR(80) NOT NULL,
    `capabilities` JSON NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIProvider_institutionId_key_key`(`institutionId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIModelConfiguration` (
    `id` VARCHAR(30) NOT NULL,
    `providerId` VARCHAR(30) NOT NULL,
    `purpose` VARCHAR(40) NOT NULL,
    `modelId` VARCHAR(120) NOT NULL,
    `params` JSON NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `AIModelConfiguration_providerId_purpose_modelId_key`(`providerId`, `purpose`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIConversation` (
    `id` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `contextType` VARCHAR(40) NOT NULL,
    `contextId` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIMessage` (
    `id` VARCHAR(30) NOT NULL,
    `conversationId` VARCHAR(30) NOT NULL,
    `role` ENUM('SYSTEM', 'USER', 'ASSISTANT') NOT NULL,
    `content` MEDIUMTEXT NOT NULL,
    `tokensIn` INTEGER NULL,
    `tokensOut` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIMessage_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIUsageRecord` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NULL,
    `providerId` VARCHAR(30) NULL,
    `model` VARCHAR(120) NOT NULL,
    `purpose` VARCHAR(40) NOT NULL,
    `promptTokens` INTEGER NULL,
    `completionTokens` INTEGER NULL,
    `latencyMs` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AIUsageRecord_institutionId_createdAt_idx`(`institutionId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `userId` VARCHAR(30) NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` VARCHAR(1000) NULL,
    `link` VARCHAR(255) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_readAt_idx`(`userId`, `readAt`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrowserPolicy` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NULL,
    `subjectId` VARCHAR(30) NULL,
    `name` VARCHAR(120) NOT NULL,
    `defaultAllow` BOOLEAN NOT NULL DEFAULT false,
    `activeFrom` DATETIME(3) NULL,
    `activeUntil` DATETIME(3) NULL,
    `createdById` VARCHAR(30) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AllowedURL` (
    `id` VARCHAR(30) NOT NULL,
    `policyId` VARCHAR(30) NOT NULL,
    `pattern` VARCHAR(512) NOT NULL,
    `kind` ENUM('DOMAIN', 'URL_PREFIX') NOT NULL DEFAULT 'DOMAIN',
    `allow` BOOLEAN NOT NULL DEFAULT true,
    `expiresAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DevicePolicy` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `divisionId` VARCHAR(30) NULL,
    `name` VARCHAR(120) NOT NULL,
    `settings` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(30) NOT NULL,
    `institutionId` VARCHAR(30) NOT NULL,
    `actorId` VARCHAR(30) NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(30) NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_institutionId_createdAt_idx`(`institutionId`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InstitutionSetting` ADD CONSTRAINT `InstitutionSetting_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProfile` ADD CONSTRAINT `StudentProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProfile` ADD CONSTRAINT `StudentProfile_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProfile` ADD CONSTRAINT `StudentProfile_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherProfile` ADD CONSTRAINT `TeacherProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherProfile` ADD CONSTRAINT `TeacherProfile_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuardianProfile` ADD CONSTRAINT `GuardianProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuardianLink` ADD CONSTRAINT `GuardianLink_guardianId_fkey` FOREIGN KEY (`guardianId`) REFERENCES `GuardianProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuardianLink` ADD CONSTRAINT `GuardianLink_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmartIdCredential` ADD CONSTRAINT `SmartIdCredential_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmartIdCredential` ADD CONSTRAINT `SmartIdCredential_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SmartIdCredential` ADD CONSTRAINT `SmartIdCredential_replacedById_fkey` FOREIGN KEY (`replacedById`) REFERENCES `SmartIdCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `SmartIdCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthSession` ADD CONSTRAINT `AuthSession_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `RegisteredDevice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegisteredDevice` ADD CONSTRAINT `RegisteredDevice_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegisteredDevice` ADD CONSTRAINT `RegisteredDevice_assignedStudentId_fkey` FOREIGN KEY (`assignedStudentId`) REFERENCES `StudentProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DeviceChallenge` ADD CONSTRAINT `DeviceChallenge_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `RegisteredDevice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthenticationLog` ADD CONSTRAINT `AuthenticationLog_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthenticationLog` ADD CONSTRAINT `AuthenticationLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthenticationLog` ADD CONSTRAINT `AuthenticationLog_credentialId_fkey` FOREIGN KEY (`credentialId`) REFERENCES `SmartIdCredential`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthenticationLog` ADD CONSTRAINT `AuthenticationLog_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `RegisteredDevice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AcademicYear` ADD CONSTRAINT `AcademicYear_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Department` ADD CONSTRAINT `Department_headTeacherId_fkey` FOREIGN KEY (`headTeacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseSubject` ADD CONSTRAINT `CourseSubject_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseSubject` ADD CONSTRAINT `CourseSubject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Class` ADD CONSTRAINT `Class_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_classTeacherId_fkey` FOREIGN KEY (`classTeacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Division` ADD CONSTRAINT `Division_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Classroom` ADD CONSTRAINT `Classroom_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Period` ADD CONSTRAINT `Period_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Enrollment` ADD CONSTRAINT `Enrollment_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_academicYearId_fkey` FOREIGN KEY (`academicYearId`) REFERENCES `AcademicYear`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `Period`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableEntry` ADD CONSTRAINT `TimetableEntry_classroomId_fkey` FOREIGN KEY (`classroomId`) REFERENCES `Classroom`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableOverride` ADD CONSTRAINT `TimetableOverride_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `TimetableEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimetableOverride` ADD CONSTRAINT `TimetableOverride_substituteTeacherId_fkey` FOREIGN KEY (`substituteTeacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomSession` ADD CONSTRAINT `ClassroomSession_timetableEntryId_fkey` FOREIGN KEY (`timetableEntryId`) REFERENCES `TimetableEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomSession` ADD CONSTRAINT `ClassroomSession_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomParticipant` ADD CONSTRAINT `ClassroomParticipant_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomParticipant` ADD CONSTRAINT `ClassroomParticipant_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomEvent` ADD CONSTRAINT `ClassroomEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClassroomAnnouncement` ADD CONSTRAINT `ClassroomAnnouncement_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_timetableEntryId_fkey` FOREIGN KEY (`timetableEntryId`) REFERENCES `TimetableEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `Period`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Attendance` ADD CONSTRAINT `Attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileObject` ADD CONSTRAINT `FileObject_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FileObject` ADD CONSTRAINT `FileObject_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assignment` ADD CONSTRAINT `Assignment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentTarget` ADD CONSTRAINT `AssignmentTarget_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentTarget` ADD CONSTRAINT `AssignmentTarget_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentAttachment` ADD CONSTRAINT `AssignmentAttachment_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssignmentAttachment` ADD CONSTRAINT `AssignmentAttachment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `Assignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionFile` ADD CONSTRAINT `SubmissionFile_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionFile` ADD CONSTRAINT `SubmissionFile_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Grade` ADD CONSTRAINT `Grade_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Textbook` ADD CONSTRAINT `Textbook_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Textbook` ADD CONSTRAINT `Textbook_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Textbook` ADD CONSTRAINT `Textbook_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Chapter` ADD CONSTRAINT `Chapter_textbookId_fkey` FOREIGN KEY (`textbookId`) REFERENCES `Textbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningMaterial` ADD CONSTRAINT `LearningMaterial_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningMaterial` ADD CONSTRAINT `LearningMaterial_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningMaterial` ADD CONSTRAINT `LearningMaterial_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningMaterial` ADD CONSTRAINT `LearningMaterial_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialAssignment` ADD CONSTRAINT `MaterialAssignment_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialAssignment` ADD CONSTRAINT `MaterialAssignment_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `LearningMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialAssignment` ADD CONSTRAINT `MaterialAssignment_chapterId_fkey` FOREIGN KEY (`chapterId`) REFERENCES `Chapter`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentBookmark` ADD CONSTRAINT `StudentBookmark_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentBookmark` ADD CONSTRAINT `StudentBookmark_textbookId_fkey` FOREIGN KEY (`textbookId`) REFERENCES `Textbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentNote` ADD CONSTRAINT `StudentNote_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentNote` ADD CONSTRAINT `StudentNote_textbookId_fkey` FOREIGN KEY (`textbookId`) REFERENCES `Textbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentNote` ADD CONSTRAINT `StudentNote_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `LearningMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReadingProgress` ADD CONSTRAINT `ReadingProgress_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReadingProgress` ADD CONSTRAINT `ReadingProgress_textbookId_fkey` FOREIGN KEY (`textbookId`) REFERENCES `Textbook`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_imageFileId_fkey` FOREIGN KEY (`imageFileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOption` ADD CONSTRAINT `QuestionOption_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quiz` ADD CONSTRAINT `Quiz_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizQuestion` ADD CONSTRAINT `QuizQuestion_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizQuestion` ADD CONSTRAINT `QuizQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizSession` ADD CONSTRAINT `QuizSession_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizSession` ADD CONSTRAINT `QuizSession_classroomSessionId_fkey` FOREIGN KEY (`classroomSessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResponse` ADD CONSTRAINT `QuizResponse_quizSessionId_fkey` FOREIGN KEY (`quizSessionId`) REFERENCES `QuizSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResponse` ADD CONSTRAINT `QuizResponse_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResponse` ADD CONSTRAINT `QuizResponse_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResponse` ADD CONSTRAINT `QuizResponse_selectedOptionId_fkey` FOREIGN KEY (`selectedOptionId`) REFERENCES `QuestionOption`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssessmentResult` ADD CONSTRAINT `AssessmentResult_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssessmentResult` ADD CONSTRAINT `AssessmentResult_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentPortfolio` ADD CONSTRAINT `StudentPortfolio_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PortfolioEntry` ADD CONSTRAINT `PortfolioEntry_portfolioId_fkey` FOREIGN KEY (`portfolioId`) REFERENCES `StudentPortfolio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompetencyFramework` ADD CONSTRAINT `CompetencyFramework_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompetencyFramework` ADD CONSTRAINT `CompetencyFramework_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skill` ADD CONSTRAINT `Skill_frameworkId_fkey` FOREIGN KEY (`frameworkId`) REFERENCES `CompetencyFramework`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Skill` ADD CONSTRAINT `Skill_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentSkill` ADD CONSTRAINT `StudentSkill_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentSkill` ADD CONSTRAINT `StudentSkill_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `Skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompetencyAssessment` ADD CONSTRAINT `CompetencyAssessment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompetencyAssessment` ADD CONSTRAINT `CompetencyAssessment_skillId_fkey` FOREIGN KEY (`skillId`) REFERENCES `Skill`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProject` ADD CONSTRAINT `StudentProject_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProject` ADD CONSTRAINT `StudentProject_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectAttachment` ADD CONSTRAINT `ProjectAttachment_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `StudentProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectAttachment` ADD CONSTRAINT `ProjectAttachment_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectCollaborator` ADD CONSTRAINT `ProjectCollaborator_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `StudentProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProjectCollaborator` ADD CONSTRAINT `ProjectCollaborator_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Achievement` ADD CONSTRAINT `Achievement_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Achievement` ADD CONSTRAINT `Achievement_fileId_fkey` FOREIGN KEY (`fileId`) REFERENCES `FileObject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AchievementVerification` ADD CONSTRAINT `AchievementVerification_achievementId_fkey` FOREIGN KEY (`achievementId`) REFERENCES `Achievement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningMilestone` ADD CONSTRAINT `LearningMilestone_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningRecommendation` ADD CONSTRAINT `LearningRecommendation_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LearningRecommendation` ADD CONSTRAINT `LearningRecommendation_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopilotSession` ADD CONSTRAINT `CopilotSession_classroomSessionId_fkey` FOREIGN KEY (`classroomSessionId`) REFERENCES `ClassroomSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopilotSession` ADD CONSTRAINT `CopilotSession_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `TeacherProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CaptureConsent` ADD CONSTRAINT `CaptureConsent_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TranscriptSegment` ADD CONSTRAINT `TranscriptSegment_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LessonNote` ADD CONSTRAINT `LessonNote_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeyConcept` ADD CONSTRAINT `KeyConcept_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionPackage` ADD CONSTRAINT `RevisionPackage_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionResource` ADD CONSTRAINT `RevisionResource_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `RevisionPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedQuestion` ADD CONSTRAINT `GeneratedQuestion_copilotSessionId_fkey` FOREIGN KEY (`copilotSessionId`) REFERENCES `CopilotSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedQuestion` ADD CONSTRAINT `GeneratedQuestion_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopilotPublication` ADD CONSTRAINT `CopilotPublication_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `RevisionPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopilotPublication` ADD CONSTRAINT `CopilotPublication_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CopilotPublication` ADD CONSTRAINT `CopilotPublication_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `StudentProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIProvider` ADD CONSTRAINT `AIProvider_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIModelConfiguration` ADD CONSTRAINT `AIModelConfiguration_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `AIProvider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIConversation` ADD CONSTRAINT `AIConversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIMessage` ADD CONSTRAINT `AIMessage_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `AIConversation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIUsageRecord` ADD CONSTRAINT `AIUsageRecord_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIUsageRecord` ADD CONSTRAINT `AIUsageRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIUsageRecord` ADD CONSTRAINT `AIUsageRecord_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `AIProvider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowserPolicy` ADD CONSTRAINT `BrowserPolicy_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowserPolicy` ADD CONSTRAINT `BrowserPolicy_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowserPolicy` ADD CONSTRAINT `BrowserPolicy_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AllowedURL` ADD CONSTRAINT `AllowedURL_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `BrowserPolicy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevicePolicy` ADD CONSTRAINT `DevicePolicy_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DevicePolicy` ADD CONSTRAINT `DevicePolicy_divisionId_fkey` FOREIGN KEY (`divisionId`) REFERENCES `Division`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_institutionId_fkey` FOREIGN KEY (`institutionId`) REFERENCES `Institution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

