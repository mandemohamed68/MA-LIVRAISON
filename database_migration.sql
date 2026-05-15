-- Script de création de la base de données pour Livra Express
-- Cible: MariaDB / MySQL 8.0+

CREATE DATABASE IF NOT EXISTS livra_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE livra_db;

-- 1. Table des UTILISATEURS
CREATE TABLE IF NOT EXISTS users (
    userId VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role ENUM('client', 'driver', 'admin', 'superadmin') DEFAULT 'client',
    status ENUM('online', 'offline', 'busy') DEFAULT 'offline',
    accountStatus ENUM('active', 'suspended', 'pending_approval') DEFAULT 'active',
    city VARCHAR(100),
    neighborhood VARCHAR(100),
    performanceScore DECIMAL(5,2) DEFAULT 0,
    cancellationRate DECIMAL(5,2) DEFAULT 0,
    totalEarnings DECIMAL(15,2) DEFAULT 0,
    walletBalance DECIMAL(15,2) DEFAULT 0,
    licensePlate VARCHAR(20),
    vehicleType ENUM('moto', 'tricycle', 'camionnette'),
    isVerified BOOLEAN DEFAULT FALSE,
    verificationStatus ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    identityCardUrl TEXT,
    identityCardBackUrl TEXT,
    criminalRecordUrl TEXT,
    guarantorName VARCHAR(255),
    guarantorPhone VARCHAR(20),
    address TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastSeen DATETIME
);

-- 2. Table des SECTEURS
CREATE TABLE IF NOT EXISTS sectors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    isActive BOOLEAN DEFAULT TRUE
);

-- 3. Table des COMMANDES (DELIVERIES)
CREATE TABLE IF NOT EXISTS deliveries (
    id VARCHAR(128) PRIMARY KEY,
    clientId VARCHAR(128) NOT NULL,
    clientName VARCHAR(255),
    driverId VARCHAR(128),
    driverName VARCHAR(255),
    
    -- Pick-up (DE)
    from_address TEXT NOT NULL,
    from_lat DECIMAL(10, 8),
    from_lng DECIMAL(11, 8),
    from_precision TEXT,
    
    -- Drop-off (A)
    to_address TEXT NOT NULL,
    to_lat DECIMAL(10, 8),
    to_lng DECIMAL(11, 8),
    to_precision TEXT,
    
    senderPhone VARCHAR(20),
    recipientPhone VARCHAR(20),
    
    -- Détails colis
    package_size ENUM('small', 'medium', 'large'),
    package_weight VARCHAR(50),
    package_category VARCHAR(100),
    package_isFragile BOOLEAN DEFAULT FALSE,
    package_value DECIMAL(15,2),
    
    -- Finances
    baseCost DECIMAL(15,2),
    clientProposedPrice DECIMAL(15,2),
    cost DECIMAL(15,2),
    paymentMethod VARCHAR(50),
    paymentStatus ENUM('pending', 'confirmed', 'rejected', 'pending_approval') DEFAULT 'pending',
    paymentReference VARCHAR(255),
    isPaid BOOLEAN DEFAULT FALSE,
    paidToDriver BOOLEAN DEFAULT FALSE,
    paidToDriverAt DATETIME,
    
    -- Status
    status ENUM('pending', 'accepted', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending',
    pickupCode VARCHAR(10),
    deliveryCode VARCHAR(10),
    
    -- Évaluation
    rating INT,
    feedback TEXT,
    proofImage TEXT,
    
    -- Options
    isUrgent BOOLEAN DEFAULT FALSE,
    urgentFee DECIMAL(15,2) DEFAULT 0,
    boostAmount DECIMAL(15,2) DEFAULT 0,
    
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (clientId) REFERENCES users(userId),
    FOREIGN KEY (driverId) REFERENCES users(userId)
);

-- 4. Table des NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    link TEXT,
    isRead BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId)
);

-- 5. Table des ANNONCES
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    targetRole ENUM('all', 'client', 'driver') DEFAULT 'all',
    type ENUM('info', 'warning', 'success') DEFAULT 'info',
    activeUntil DATETIME,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Table des RETRAITS (WITHDRAWALS)
CREATE TABLE IF NOT EXISTS withdrawals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driverId VARCHAR(128) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    status ENUM('pending', 'completed', 'rejected') DEFAULT 'pending',
    method VARCHAR(50),
    phone VARCHAR(20),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    processedAt DATETIME,
    FOREIGN KEY (driverId) REFERENCES users(userId)
);

-- 7. Table des MESSAGES CHAT
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128) NOT NULL,
    senderId VARCHAR(128) NOT NULL,
    senderName VARCHAR(255),
    senderRole ENUM('client', 'driver', 'admin'),
    text TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (senderId) REFERENCES users(userId)
);

-- 8. Table des POINTS DE TRACKING
CREATE TABLE IF NOT EXISTS tracking_points (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id)
);

-- 9. Configuration Système (Single Row)
CREATE TABLE IF NOT EXISTS app_config (
    id INT PRIMARY KEY DEFAULT 1,
    mode ENUM('test', 'prod') DEFAULT 'test',
    isMaintenanceMode BOOLEAN DEFAULT FALSE,
    maintenanceMessage TEXT,
    ussdSyntaxOrange TEXT,
    ussdSyntaxMoov TEXT,
    ussdSyntaxTelecel TEXT,
    ussdSyntaxCoris TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CHECK (id = 1) -- Assure une seule ligne
);

-- 10. Paramètres Commissions (Single Row)
CREATE TABLE IF NOT EXISTS commission_settings (
    id INT PRIMARY KEY DEFAULT 1,
    platformFeePercent DECIMAL(5,2) DEFAULT 15.00,
    driverSharePercent DECIMAL(5,2) DEFAULT 85.00,
    minDeliveryCost DECIMAL(15,2) DEFAULT 500,
    insuranceFeePercent DECIMAL(5,2) DEFAULT 0,
    tarifKm DECIMAL(15,2) DEFAULT 100,
    tarifPoids DECIMAL(15,2) DEFAULT 50,
    fraisFixes DECIMAL(15,2) DEFAULT 200,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updatedBy VARCHAR(128),
    CHECK (id = 1)
);

-- Insertion de données de base (Admin par exemple)
-- Note: Le mot de passe devra être géré via le système d'auth choisi (Firebase Auth local ou propre système)
-- INSERT INTO users (userId, name, email, role) VALUES ('admin_id', 'Super Admin', 'test@test.com', 'superadmin');

INSERT INTO app_config (id, mode) VALUES (1, 'test');
INSERT INTO commission_settings (id) VALUES (1);
