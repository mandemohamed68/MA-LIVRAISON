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

CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128) NOT NULL,
    senderId VARCHAR(128) NOT NULL,
    text TEXT NOT NULL,
    isAdmin BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id)
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    isRead BOOLEAN DEFAULT FALSE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId)
);

CREATE TABLE IF NOT EXISTS bids (
    id INT AUTO_INCREMENT PRIMARY KEY,
    deliveryId VARCHAR(128) NOT NULL,
    driverId VARCHAR(128) NOT NULL,
    driverName VARCHAR(255) NOT NULL,
    price INT NOT NULL,
    timeEstimateMins INT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deliveryId) REFERENCES deliveries(id),
    FOREIGN KEY (driverId) REFERENCES users(userId)
);
