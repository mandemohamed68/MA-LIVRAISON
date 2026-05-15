-- Livra EXPRESS MariaDB Schema
-- Base de données pour un déploiement sur Debian 12

CREATE DATABASE IF NOT EXISTS livra_express CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE livra_express;

-- 1. Table des Utilisateurs
CREATE TABLE IF NOT EXISTS users (
    userId VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role ENUM('client', 'driver', 'admin', 'superadmin') NOT NULL DEFAULT 'client',
    status ENUM('online', 'offline', 'busy') DEFAULT 'offline',
    city VARCHAR(100),
    neighborhood VARCHAR(100),
    verificationStatus ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    guarantorName VARCHAR(255),
    guarantorPhone VARCHAR(20),
    identityCardUrl TEXT,
    criminalRecordUrl TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    photoURL TEXT,
    totalWithdrawn DECIMAL(15, 2) DEFAULT 0,
    withdrawalRequested BOOLEAN DEFAULT FALSE,
    withdrawalAmount DECIMAL(15, 2) DEFAULT 0,
    withdrawalMethod VARCHAR(50),
    withdrawalPhone VARCHAR(20),
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Table des Livraisons
CREATE TABLE IF NOT EXISTS deliveries (
    id VARCHAR(128) PRIMARY KEY,
    clientId VARCHAR(128) NOT NULL,
    clientName VARCHAR(255),
    driverId VARCHAR(128),
    driverName VARCHAR(255),
    fromLat DECIMAL(10, 8) NOT NULL,
    fromLng DECIMAL(11, 8) NOT NULL,
    fromAddress TEXT NOT NULL,
    fromPrecision TEXT,
    toLat DECIMAL(10, 8) NOT NULL,
    toLng DECIMAL(11, 8) NOT NULL,
    toAddress TEXT NOT NULL,
    toPrecision TEXT,
    cost DECIMAL(15, 2) NOT NULL,
    clientProposedPrice DECIMAL(15, 2),
    status ENUM('pending', 'accepted', 'picked_up', 'delivered', 'cancelled', 'ready_for_pickup') DEFAULT 'pending',
    paymentStatus ENUM('pending', 'pending_approval', 'confirmed', 'rejected') DEFAULT 'pending',
    paymentMethod VARCHAR(50),
    paymentReference TEXT,
    isPaid BOOLEAN DEFAULT FALSE,
    paidToDriver BOOLEAN DEFAULT FALSE,
    pickupCode VARCHAR(20),
    deliveryCode VARCHAR(20),
    proofImage TEXT,
    distance DECIMAL(10, 2),
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (clientId) REFERENCES users(userId),
    FOREIGN KEY (driverId) REFERENCES users(userId)
) ENGINE=InnoDB;

-- 3. Table des Rejets de Missions (pour éviter de montrer les mêmes missions aux livreurs qui ont refusé)
CREATE TABLE IF NOT EXISTS delivery_rejections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128),
    driverId VARCHAR(128),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (driverId) REFERENCES users(userId),
    UNIQUE KEY (deliveryId, driverId)
) ENGINE=InnoDB;

-- 4. Table des Offres (Bids)
CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128),
    driverId VARCHAR(128),
    driverName VARCHAR(255),
    price DECIMAL(15, 2) NOT NULL,
    timeEstimateMins INT,
    reason TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (driverId) REFERENCES users(userId)
) ENGINE=InnoDB;

-- 5. Table des Messages de Chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128),
    senderId VARCHAR(128),
    senderName VARCHAR(255),
    senderRole ENUM('client', 'driver', 'admin') NOT NULL,
    text TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (senderId) REFERENCES users(userId)
) ENGINE=InnoDB;

-- 6. Table des Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(128),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    link TEXT,
    isRead BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId)
) ENGINE=InnoDB;

-- 7. Table des Secteurs
CREATE TABLE IF NOT EXISTS sectors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    polygons JSON, -- Stocke les coordonnées du secteur (Array de points)
    isActive BOOLEAN DEFAULT TRUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. Table des Annonces
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'success') DEFAULT 'info',
    targetRole ENUM('all', 'client', 'driver', 'admin') DEFAULT 'all',
    activeUntil DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 9. Table des Paramètres (Settings)
CREATE TABLE IF NOT EXISTS settings (
    k VARCHAR(100) PRIMARY KEY,
    v JSON NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Insertion des paramètres par défaut
INSERT INTO settings (k, v) VALUES 
('commissions', '{"platformFeePercent": 15, "driverSharePercent": 85, "minDeliveryCost": 500, "tarifKm": 150, "maxSimultaneousDeliveries": 2}'),
('app_config', '{"isMaintenanceMode": false, "maintenanceMessage": "Mise à jour en cours"}');
