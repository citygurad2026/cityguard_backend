-- AlterTable
ALTER TABLE `ads` ADD COLUMN `backgroundColor` VARCHAR(191) NULL,
    ADD COLUMN `bannerType` ENUM('MAIN_HERO', 'SIDE_BANNER', 'POPUP') NOT NULL DEFAULT 'MAIN_HERO',
    ADD COLUMN `ctaText` VARCHAR(191) NULL,
    ADD COLUMN `ctaUrl` VARCHAR(191) NULL,
    ADD COLUMN `mobileImageUrl` VARCHAR(191) NULL,
    ADD COLUMN `tabletImageUrl` VARCHAR(191) NULL,
    ADD COLUMN `textColor` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isValid` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `Session_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ads_bannerType_isActive_priority_idx` ON `ads`(`bannerType`, `isActive`, `priority`);

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
