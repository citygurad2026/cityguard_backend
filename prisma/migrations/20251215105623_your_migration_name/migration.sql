/*
  Warnings:

  - You are about to drop the `ads` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `ads` DROP FOREIGN KEY `ads_targetId_fkey`;

-- DropTable
DROP TABLE `ads`;

-- CreateTable
CREATE TABLE `Ad` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `mobileImageUrl` VARCHAR(191) NULL,
    `tabletImageUrl` VARCHAR(191) NULL,
    `ctaText` VARCHAR(191) NULL,
    `ctaUrl` VARCHAR(191) NULL,
    `backgroundColor` VARCHAR(191) NULL,
    `textColor` VARCHAR(191) NULL,
    `targetType` ENUM('BUSINESS', 'LISTING', 'CATEGORY', 'EXTERNAL') NOT NULL,
    `targetId` INTEGER NULL,
    `url` VARCHAR(191) NULL,
    `budget` DOUBLE NULL DEFAULT 0,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAUSED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ad_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `Ad_status_isActive_idx`(`status`, `isActive`),
    INDEX `Ad_startAt_endAt_idx`(`startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Ad` ADD CONSTRAINT `Ad_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `businesses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
