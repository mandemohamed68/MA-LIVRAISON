-- MariaDB Migration Schema for PANCHO EXPRESS
-- This file creates the necessary tables for MariaDB based on the SQLite schema.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for users
-- ----------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(255) PRIMARY KEY,
  `userId` varchar(255) UNIQUE,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) UNIQUE NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `role` enum('client', 'driver', 'admin', 'superadmin') NOT NULL,
  `status` varchar(50) DEFAULT 'online',
  `accountStatus` varchar(50) DEFAULT 'active',
  `isVerified` tinyint(1) DEFAULT 0,
  `city` varchar(255) DEFAULT NULL,
  `neighborhood` varchar(255) DEFAULT NULL,
  `verificationStatus` varchar(50) DEFAULT 'unverified',
  `termsAcceptedAt` datetime DEFAULT NULL,
  `driverType` varchar(50) DEFAULT 'freelance',
  `identityCardUrl` LONGTEXT DEFAULT NULL,
  `criminalRecordUrl` LONGTEXT DEFAULT NULL,
  `currentLocation` text DEFAULT NULL,
  `balance` double DEFAULT 0,
  `earnings` double DEFAULT 0,
  `totalWithdrawn` double DEFAULT 0,
  `walletBalance` double DEFAULT 0,
  `phone` varchar(50) DEFAULT NULL,
  `withdrawalPhone` varchar(50) DEFAULT NULL,
  `rib` varchar(255) DEFAULT NULL,
  `idCardFront` LONGTEXT DEFAULT NULL,
  `idCardBack` LONGTEXT DEFAULT NULL,
  `guarantorName` varchar(255) DEFAULT NULL,
  `guarantorPhone` varchar(50) DEFAULT NULL,
  `guarantorCniUrl` LONGTEXT DEFAULT NULL,
  `vehicleType` varchar(50) DEFAULT NULL,
  `licensePlate` varchar(50) DEFAULT NULL,
  `photoURL` LONGTEXT DEFAULT NULL,
  `address` text DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for deliveries
-- ----------------------------
CREATE TABLE IF NOT EXISTS `deliveries` (
  `id` varchar(255) PRIMARY KEY,
  `clientId` varchar(255) NOT NULL,
  `clientName` varchar(255) DEFAULT NULL,
  `driverId` varchar(255) DEFAULT NULL,
  `driverName` varchar(255) DEFAULT NULL,
  `origin` text NOT NULL,
  `destination` text NOT NULL,
  `cost` double NOT NULL,
  `status` enum('pending', 'accepted', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending',
  `paymentStatus` varchar(50) DEFAULT 'pending',
  `paymentMethod` varchar(50) DEFAULT NULL,
  `paymentReference` varchar(255) DEFAULT NULL,
  `isPaid` tinyint(1) DEFAULT 0,
  `paidToDriver` tinyint(1) DEFAULT 0,
  `pickupCode` varchar(50) DEFAULT NULL,
  `deliveryCode` varchar(50) DEFAULT NULL,
  `vehicleType` varchar(50) DEFAULT NULL,
  `senderPhone` varchar(50) DEFAULT NULL,
  `recipientPhone` varchar(50) DEFAULT NULL,
  `packageDetails` text DEFAULT NULL,
  `baseCost` double DEFAULT NULL,
  `clientProposedPrice` double DEFAULT NULL,
  `isUrgent` tinyint(1) DEFAULT 0,
  `urgentFee` double DEFAULT 0,
  `boostAmount` double DEFAULT 0,
  `cancelReason` text DEFAULT NULL,
  `lastMessageAt` datetime DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`clientId`) REFERENCES `users` (`userId`),
  FOREIGN KEY (`driverId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for messages
-- ----------------------------
CREATE TABLE IF NOT EXISTS `messages` (
  `id` varchar(255) PRIMARY KEY,
  `deliveryId` varchar(255) NOT NULL,
  `text` text NOT NULL,
  `senderId` varchar(255) NOT NULL,
  `senderName` varchar(255) DEFAULT NULL,
  `senderRole` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`deliveryId`) REFERENCES `deliveries` (`id`),
  FOREIGN KEY (`senderId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for notifications
-- ----------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(255) PRIMARY KEY,
  `userId` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `link` varchar(255) DEFAULT NULL,
  `isRead` tinyint(1) DEFAULT 0,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for withdrawals
-- ----------------------------
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` varchar(255) PRIMARY KEY,
  `driverId` varchar(255) NOT NULL,
  `driverName` varchar(255) DEFAULT NULL,
  `amount` double NOT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `method` varchar(50) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `processedAt` datetime DEFAULT NULL,
  FOREIGN KEY (`driverId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for historique_gains
-- ----------------------------
CREATE TABLE IF NOT EXISTS `historique_gains` (
  `id` varchar(255) PRIMARY KEY,
  `driverId` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `amount` double NOT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`driverId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for promo_codes
-- ----------------------------
CREATE TABLE IF NOT EXISTS `promo_codes` (
  `code` varchar(255) PRIMARY KEY,
  `type` varchar(50) NOT NULL,
  `value` double NOT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `max_uses` int DEFAULT NULL,
  `uses_count` int DEFAULT 0,
  `max_per_user` int DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for promo_usages
-- ----------------------------
CREATE TABLE IF NOT EXISTS `promo_usages` (
  `id` varchar(255) PRIMARY KEY,
  `code` varchar(255) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `deliveryId` varchar(255) DEFAULT NULL,
  `used_at` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`code`) REFERENCES `promo_codes` (`code`),
  FOREIGN KEY (`userId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for bids
-- ----------------------------
CREATE TABLE IF NOT EXISTS `bids` (
  `id` varchar(255) PRIMARY KEY,
  `deliveryId` varchar(255) NOT NULL,
  `driverId` varchar(255) NOT NULL,
  `driverName` varchar(255) DEFAULT NULL,
  `price` double NOT NULL,
  `proposedTime` int DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(50) DEFAULT 'pending',
  `attempts` int DEFAULT 1,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`deliveryId`) REFERENCES `deliveries` (`id`),
  FOREIGN KEY (`driverId`) REFERENCES `users` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for tracking
-- ----------------------------
CREATE TABLE IF NOT EXISTS `tracking` (
  `id` varchar(255) PRIMARY KEY,
  `deliveryId` varchar(255) NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`deliveryId`) REFERENCES `deliveries` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for config
-- ----------------------------
CREATE TABLE IF NOT EXISTS `config` (
  `key` varchar(255) PRIMARY KEY,
  `value` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for sectors
-- ----------------------------
CREATE TABLE IF NOT EXISTS `sectors` (
  `id` varchar(255) PRIMARY KEY,
  `name` varchar(255) NOT NULL,
  `city` varchar(255) NOT NULL,
  `isActive` tinyint(1) DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `image_url` LONGTEXT DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for announcements
-- ----------------------------
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` varchar(255) PRIMARY KEY,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` varchar(50) DEFAULT 'info',
  `targetRole` varchar(50) DEFAULT 'all',
  `activeUntil` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `image_url` LONGTEXT DEFAULT NULL,
  `createdAt` datetime DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
