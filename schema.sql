-- SCHEMA SQL POUR LIVRA-EXPRESS
-- À executer sur votre base MariaDB/MySQL locale

CREATE TABLE IF NOT EXISTS users (
    userId VARCHAR(128) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('client', 'driver', 'admin', 'superadmin') DEFAULT 'client',
    phone VARCHAR(20),
    avatarUrl TEXT,
    accountStatus ENUM('active', 'pending_approval', 'suspended') DEFAULT 'active',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
    id VARCHAR(128) PRIMARY KEY,
    clientId VARCHAR(128) NOT NULL,
    driverId VARCHAR(128),
    status ENUM('pending', 'accepted', 'ready_for_pickup', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending',
    fromAddress TEXT NOT NULL,
    toAddress TEXT NOT NULL,
    fromLat DOUBLE,
    fromLng DOUBLE,
    toLat DOUBLE,
    toLng DOUBLE,
    cost INT DEFAULT 0,
    packageSize VARCHAR(50),
    description TEXT,
    pickupTime DATETIME,
    contactName VARCHAR(255),
    contactPhone VARCHAR(20),
    paymentStatus ENUM('pending', 'pending_approval', 'confirmed') DEFAULT 'pending',
    pickupCode VARCHAR(10),
    deliveryCode VARCHAR(10),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clientId) REFERENCES users(userId)
);
