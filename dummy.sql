/*
-- ====================================================================
-- KUNG FOOD PANDA - DUMMY DATA SCRIPT
-- ====================================================================
-- This script populates the tables defined in the 'kungfoodpanda_db'
-- schema with sample data for testing and development.
--
-- It is designed to be re-runnable. It disables foreign key checks,
-- truncates all tables in reverse dependency order, and then
-- inserts new data in the correct dependency order.
-- ====================================================================
*/

-- Select the database to use
USE kungfoodpanda_db;

-- Disable foreign key checks to allow truncation
SET FOREIGN_KEY_CHECKS = 0;

-- Truncate tables in reverse order of dependency to clear old data
TRUNCATE TABLE Subscription;
TRUNCATE TABLE Orders;
TRUNCATE TABLE Inventory;
TRUNCATE TABLE FarmProduct;
TRUNCATE TABLE Farm;
TRUNCATE TABLE Client;
TRUNCATE TABLE RawProduct;
TRUNCATE TABLE Location;

-- ====================================================================
-- 1. INSERT DATA: Location
-- (No dependencies)
-- ====================================================================

INSERT INTO Location (location_id, continent, country, state, city, street)
VALUES
(1, 'North America', 'USA', 'California', 'San Francisco', '123 Market St'),
(2, 'North America', 'USA', 'New York', 'New York', '456 Broadway'),
(3, 'Asia', 'Japan', 'Tokyo', 'Shibuya', '789 Hachi St'),
(4, 'Asia', 'Philippines', 'Metro Manila', 'Makati', '101 Ayala Ave'),
(5, 'Europe', 'France', 'Paris', '7th Arrondissement', '20 Rue Cler'),
(6, 'South America', 'Brazil', 'Rio de Janeiro', 'Copacabana', '300 Atlantica Ave'),
(7, 'Europe', 'Germany', 'Berlin', 'Berlin', '55 Brandenburg Gate'),
(8, 'Asia', 'Philippines', 'Davao', 'Davao City', '22 Durian Ave');

-- ====================================================================
-- 2. INSERT DATA: RawProduct
-- (No dependencies)
-- ====================================================================

INSERT INTO RawProduct (product_id, product_name, product_type, grade, start_season, end_season)
VALUES
(1, 'Golden Apple', 'Fruit', 'SSR', '2025-09-01', '2025-11-30'),
(2, 'Blueberry', 'Fruit', 'SR', '2025-06-01', '2025-08-31'),
(3, 'Wagyu Beef', 'Meat', 'SSR', '2025-01-01', '2025-12-31'),
(4, 'King Salmon', 'Seafood', 'SR', '2025-05-01', '2025-07-31'),
(5, 'Common Potato', 'Vegetable', 'C', '2025-01-01', '2025-12-31'),
(6, 'Black Truffle', 'Fungi', 'SSR', '2025-10-01', '2025-12-31'),
(7, 'Hass Avocado', 'Fruit', 'R', '2025-02-01', '2025-09-30'),
(8, 'Mango', 'Fruit', 'SR', '2025-04-01', '2025-07-31');

-- ====================================================================
-- 3. INSERT DATA: Client
-- (Depends on Location)
-- ====================================================================

INSERT INTO Client (client_id, company_name, first_name, last_name, honorific, email, location_id, loyalty_points)
VALUES
(1, 'Gourmet Inc.', 'Alice', 'Smith', 'Ms.', 'alice@gourmet.com', 1, 150),
(2, 'Fine Foods Ltd.', 'Bob', 'Johnson', 'Mr.', 'bob@ffl.com', 2, 50),
(3, 'Tokyo Eats', 'Kenji', 'Watanabe', 'Mr.', 'kenji@tokyoeats.jp', 3, 1000),
(4, NULL, 'Maria', 'Clara', 'Mx.', 'mclara@email.ph', 4, 0),
(5, 'Le Bistro', 'Chloe', 'Dubois', 'Dr.', 'chloe.dubois@lebistro.fr', 5, 220),
(6, 'Berlin Butcher', 'Hans', 'Muller', 'Mr.', 'hans@berlinbutcher.de', 7, 75);

-- ====================================================================
-- 4. INSERT DATA: Farm
-- (Depends on Location)
-- ====================================================================

INSERT INTO Farm (farm_id, location_id)
VALUES
(1, 1), -- 'Sunrise Acres' in San Francisco
(2, 3), -- 'Fuji Orchards' in Tokyo
(3, 8), -- 'Davao Harvest' in Davao City, PH
(4, 6), -- 'Amazonica Produce' in Brazil
(5, 5); -- 'Parisian Pastures' in Paris

-- ====================================================================
-- 5. INSERT DATA: FarmProduct
-- (Depends on RawProduct, Farm)
-- ====================================================================

INSERT INTO FarmProduct (product_id, farm_id, population)
VALUES
(1, 1, 10000), -- Farm 1 (SF) grows Golden Apples
(2, 1, 50000), -- Farm 1 (SF) grows Blueberries
(7, 1, 20000), -- Farm 1 (SF) grows Hass Avocados
(1, 2, 8000),  -- Farm 2 (Tokyo) grows Golden Apples
(3, 2, 500),   -- Farm 2 (Tokyo) grows Wagyu Beef
(8, 3, 100000), -- Farm 3 (Davao) grows Mangos
(5, 3, 50000), -- Farm 3 (Davao) grows Common Potatoes
(6, 4, 100),   -- Farm 4 (Brazil) grows Black Truffles
(3, 5, 200);   -- Farm 5 (Paris) grows "Wagyu" (for comparison)

-- ====================================================================
-- 6. INSERT DATA: Inventory
-- (Depends on FarmProduct)
-- Note: AUTO_INCREMENT on batch_id is handled by MySQL
-- ====================================================================

INSERT INTO Inventory (product_id, farm_id, price, weight, notes, exp_date, quantity)
VALUES
-- Batch 1
(1, 1, 5.00, 0.2, 'Prime batch, perfectly ripe', '2025-12-15', 500), 
-- Batch 2
(2, 1, 3.50, 0.01, 'Freshly picked this morning', '2025-12-01', 2000),
-- Batch 3
(3, 2, 150.00, 1.0, 'A5 Grade, Certificate #A5-882', '2025-11-30', 50),
-- Batch 4
(8, 3, 2.00, 0.3, 'Sweetest batch of the year', '2025-12-05', 5000),
-- Batch 5
(5, 3, 0.50, 0.1, 'Good for frying', '2026-03-01', 10000),
-- Batch 6
(6, 4, 300.00, 0.05, 'Highly aromatic', '2025-11-25', 40),
-- Batch 7
(1, 1, 4.50, 0.19, 'Slightly bruised, 10% discount', '2025-12-10', 200);

-- ====================================================================
-- 7. INSERT DATA: Orders
-- (Depends on Client, Inventory, Location)
-- Note: AUTO_INCREMENT on order_id is handled by MySQL
-- ====================================================================

INSERT INTO Orders (client_id, batch_id, location_id, order_date, quantity, is_shipped, due_by, loyalty_points_used)
VALUES
-- Order 1: Alice (Client 1) orders Batch 1 (Apples) to Location 1 (SF). Shipped.
(1, 1, 1, '2025-11-10', 50, 1, '2025-11-15', 50),
-- Order 2: Bob (Client 2) orders Batch 3 (Wagyu) to Location 2 (NY). Shipped.
(2, 3, 2, '2025-11-11', 5, 1, '2025-11-20', 0),
-- Order 3: Kenji (Client 3) orders Batch 2 (Blueberries) to Location 3 (Tokyo). Not shipped.
(3, 2, 3, '2025-11-12', 1000, 0, '2025-11-25', 100),
-- Order 4: Maria (Client 4) orders Batch 4 (Mangos) to Location 4 (Makati). Not shipped.
(4, 4, 4, '2025-11-15', 200, 0, '2025-11-30', 0),
-- Order 5: Alice (Client 1) orders Batch 5 (Potatoes) to Location 1 (SF). Not shipped.
(1, 5, 1, '2025-11-16', 500, 0, '2025-12-01', 0),
-- Order 6: Hans (Client 6) orders Batch 3 (Wagyu) to Location 7 (Berlin). Shipped.
(6, 3, 7, '2025-11-16', 10, 1, '2025-11-22', 75);

-- ====================================================================
-- 8. INSERT DATA: Subscription
-- (Depends on FarmProduct, Client, Location)
-- Note: AUTO_INCREMENT on program_id is handled by MySQL
-- ====================================================================

INSERT INTO Subscription (product_id, farm_id, client_id, order_interval_days, start_date, quantity, location_id, price, status)
VALUES
-- Sub 1: Client 1 (Alice) gets 100 Golden Apples (Prod 1, Farm 1) every 30 days to Location 1. ACTIVE.
(1, 1, 1, 30, '2025-10-01', 100, 1, 475.00, 'ACTIVE'),
-- Sub 2: Client 2 (Bob) wants 10 Wagyu (Prod 3, Farm 2) every 14 days to Location 2. QUOTED.
(3, 2, 2, 14, '2025-11-01', 10, 2, 1450.00, 'QUOTED'),
-- Sub 3: Client 4 (Maria) wants 1000 Potatoes (Prod 5, Farm 3) weekly to Location 4. AWAITING_QUOTE.
(5, 3, 4, 7, '2025-11-15', 1000, 4, NULL, 'AWAITING_QUOTE'),
-- Sub 4: Client 3 (Kenji) HAD a sub for Apples (Prod 1, Farm 2). CANCELLED.
(1, 2, 3, 90, '2025-08-01', 20, 3, NULL, 'CANCELLED'),
-- Sub 5: Client 5 (Chloe) gets Avocados (Prod 7, Farm 1) every 15 days to Location 5. ACTIVE.
(7, 1, 5, 15, '2025-09-15', 50, 5, 100.00, 'ACTIVE');

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- SCRIPT COMPLETE
-- ====================================================================