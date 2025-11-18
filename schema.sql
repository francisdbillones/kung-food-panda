CREATE SCHEMA IF NOT EXISTS kungfoodpanda_db;
USE kungfoodpanda_db;

DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS Subscription; 
DROP TABLE IF EXISTS Inventory;      
DROP TABLE IF EXISTS FarmProduct;    
DROP TABLE IF EXISTS Farm;
DROP TABLE IF EXISTS Client;
DROP TABLE IF EXISTS RawProduct;
DROP TABLE IF EXISTS Location;

CREATE TABLE Location (
    location_id INT UNSIGNED NOT NULL PRIMARY KEY,
    continent VARCHAR(20),
    country VARCHAR(50) NOT NULL,
    state VARCHAR(50),
    city VARCHAR(50) NOT NULL,
    street VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE RawProduct (
	product_id INT UNSIGNED NOT NULL PRIMARY KEY,
    product_name VARCHAR (100) NOT NULL,
    product_type VARCHAR (100) NOT NULL,
    grade ENUM('SSR', 'SR', 'R', 'UC', 'C') NOT NULL,
    start_season DATE NOT NULL,
    end_season DATE NOT NULL,

    UNIQUE(product_name, grade),

    CHECK (end_season > start_season)
) ENGINE=InnoDB;

CREATE TABLE Client (
	client_id INT UNSIGNED NOT NULL PRIMARY KEY,
    company_name VARCHAR (100),
    first_name VARCHAR (100) NOT NULL,
    last_name VARCHAR (100) NOT NULL,
    honorific ENUM ('Mx.', 'Mr.', 'Mrs.', 'Ms.', 'Dr.') NOT NULL DEFAULT 'Mx.',
    email VARCHAR (100) NOT NULL UNIQUE,
    location_id INT UNSIGNED,
    loyalty_points INT UNSIGNED NOT NULL DEFAULT 0,

    FOREIGN KEY (location_id) REFERENCES Location(location_id)
) ENGINE=InnoDB;

CREATE TABLE Farm ( 
	farm_id INT UNSIGNED NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location_id INT UNSIGNED NOT NULL,
    FOREIGN KEY (location_id) REFERENCES Location(location_id)
) ENGINE=InnoDB;

CREATE TABLE FarmProduct (
    product_id INT UNSIGNED NOT NULL,
    farm_id INT UNSIGNED NOT NULL,
    population INT UNSIGNED NOT NULL DEFAULT 0,
    population_unit VARCHAR(100) NOT NULL,
    PRIMARY KEY (product_id, farm_id),
    FOREIGN KEY (product_id) REFERENCES RawProduct(product_id),
    FOREIGN KEY (farm_id) REFERENCES Farm(farm_id)
) ENGINE=InnoDB;

CREATE TABLE Inventory ( 
	batch_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    farm_id INT UNSIGNED NOT NULL,
    price DECIMAL(8,2) NOT NULL,
    weight DECIMAL(8,2) NOT NULL,
    notes VARCHAR(1000),
    exp_date DATE NOT NULL,
    quantity INT UNSIGNED NOT NULL,

    CHECK (price >= 0),
    CHECK (weight > 0),

    FOREIGN KEY (product_id, farm_id) REFERENCES FarmProduct(product_id, farm_id)
) ENGINE=InnoDB;

CREATE TABLE Subscription (
	program_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    farm_id INT UNSIGNED NOT NULL,
    client_id INT UNSIGNED NOT NULL,
    order_interval_days INT UNSIGNED NOT NULL,
    start_date DATE NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    location_id INT UNSIGNED NOT NULL,
    price DECIMAL(8, 2),
    status ENUM('AWAITING_QUOTE', 'QUOTED', 'ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'AWAITING_QUOTE',
    
    UNIQUE (product_id, farm_id, client_id, location_id, order_interval_days),

    CHECK (quantity > 0),
    CHECK (order_interval_days > 0),
    CHECK (
        (status IN ('AWAITING_QUOTE', 'CANCELLED') AND (price IS NULL OR price >= 0)) OR
        (status IN ('QUOTED', 'ACTIVE') AND price >= 0)
    ),

    FOREIGN KEY (product_id, farm_id) REFERENCES FarmProduct(product_id, farm_id),
    FOREIGN KEY (client_id) REFERENCES Client(client_id),
    FOREIGN KEY (location_id) REFERENCES Location(location_id)
) ENGINE=InnoDB;

CREATE TABLE Orders (
	order_id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    client_id INT UNSIGNED NOT NULL,
    batch_id INT UNSIGNED NOT NULL,
    location_id INT UNSIGNED NOT NULL,
    order_date DATE NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    is_shipped TINYINT(1) NOT NULL DEFAULT 0, 
    due_by DATE NOT NULL,
    loyalty_points_used INT UNSIGNED DEFAULT 0,
    program_id INT UNSIGNED DEFAULT NULL,

    CHECK (is_shipped IN (0,1)),
    CHECK (quantity > 0),
    CHECK (due_by >= order_date),

    FOREIGN KEY (client_id) REFERENCES Client(client_id),
    FOREIGN KEY (batch_id) REFERENCES Inventory(batch_id),
    FOREIGN KEY (location_id) REFERENCES Location(location_id),
    FOREIGN KEY (program_id) REFERENCES Subscription(program_id)
) ENGINE=InnoDB;