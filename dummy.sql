-- Use the target database
USE kungfoodpanda_db;

-- Disable foreign key checks to allow truncating tables in any order
SET FOREIGN_KEY_CHECKS=0;

-- Truncate tables in reverse order of dependency (or any order, since checks are off)
-- This clears all existing data and resets auto-incrementing primary keys
TRUNCATE TABLE Orders;
TRUNCATE TABLE Subscription;
TRUNCATE TABLE Inventory;
TRUNCATE TABLE FarmProduct;
TRUNCATE TABLE Farm;
TRUNCATE TABLE Client;
TRUNCATE TABLE RawProduct;
TRUNCATE TABLE Location;

--
-- 1. Insert data into 'Location' (No dependencies)
--
INSERT INTO Location (location_id, continent, country, state, city, street) VALUES
(101, 'Asia', 'Philippines', 'Metro Manila', 'Quezon City', '123 Aurora Blvd'),
(102, 'Asia', 'Philippines', 'Batangas', 'Lipa', '456 JP Laurel Hwy'),
(103, 'Asia', 'Philippines', 'Cavite', 'Tagaytay', '789 Aguinaldo Hwy'),
(104, 'Asia', 'Philippines', 'Benguet', 'Baguio', '101 Session Road'),
(105, 'Asia', 'Philippines', 'Davao del Sur', 'Davao City', '202 Durian St'),
(106, 'North America', 'USA', 'California', 'San Francisco', '303 Market St'),
(107, 'Europe', 'France', 'Île-de-France', 'Paris', '404 Rue de Rivoli'),
(108, 'Asia', 'Japan', 'Tokyo', 'Shibuya', '505 Hachiko Square'),
(109, 'Asia', 'Philippines', 'Cebu', 'Cebu City', '606 Mango Ave'),
(110, 'Asia', 'Philippines', 'Laguna', 'Calamba', '707 Rizal St');

--
-- 2. Insert data into 'RawProduct' (No dependencies)
--
INSERT INTO RawProduct (product_id, product_name, product_type, grade, start_season, end_season) VALUES
(201, 'Heirloom Tomato', 'Fruit', 'SSR', '2025-03-01', '2025-07-31'),
(202, 'Hass Avocado', 'Fruit', 'SR', '2025-01-01', '2025-12-31'),
(203, 'Organic Spinach', 'Vegetable', 'R', '2025-01-01', '2025-12-31'),
(204, 'Atsuete Seeds', 'Spice', 'C', '2025-06-01', '2025-09-30'),
(205, 'Carabao Mango', 'Fruit', 'SSR', '2025-04-01', '2025-08-31'),
(206, 'Benguet Strawberry', 'Fruit', 'SR', '2025-11-01', '2026-02-28'),
(207, 'Organic Kale', 'Vegetable', 'R', '2025-01-01', '2025-12-31'),
(208, 'Siling Labuyo', 'Spice', 'SR', '2025-01-01', '2025-12-31'),
(209, 'Arabica Coffee Beans', 'Bean', 'SSR', '2025-10-01', '2026-03-31'),
(210, 'Davao Durian', 'Fruit', 'SR', '2025-08-01', '2025-11-30');

--
-- 3. Insert data into 'Client' (Depends on Location)
--
INSERT INTO Client (client_id, company_name, first_name, last_name, honorific, email, location_id, loyalty_points) VALUES
(301, 'The Corner Cafe', 'Maria', 'Dela Cruz', 'Ms.', 'maria@cornercafe.com', 101, 1500),
(302, 'Green Grocers Inc.', 'John', 'Smith', 'Mr.', 'john@greengrocers.com', 106, 500),
(303, 'Parisian Bistro', 'Amélie', 'Martin', 'Mx.', 'amelie@bistro.fr', 107, 2200),
(304, 'Tokyo Fresh Sushi', 'Kenji', 'Watanabe', 'Mr.', 'kenji@sushi.jp', 108, 800),
(305, NULL, 'Alice', 'Johnson', 'Dr.', 'alice.j@research.edu', 106, 0),
(306, 'Manila Hotel', 'Antonio', 'Luna', 'Mr.', 'aluna@manilahotel.com', 101, 10000),
(307, 'Cebu Lechon House', 'Reyna', 'Mercado', 'Mrs.', 'reyna@lechon.com', 109, 350),
(308, 'Baguio Good Shepherd', 'Christina', 'Reyes', 'Ms.', 'creyes@goodshepherd.ph', 104, 120),
(309, 'Healthy Options', 'Mark', 'Lim', 'Mr.', 'mark.lim@healthyoptions.ph', 101, 5000),
(310, 'Davao Agri Exports', 'Rodrigo', 'Bautista', 'Mr.', 'rbautista@davaofruits.com', 105, 450);

--
-- 4. Insert data into 'Farm' (Depends on Location)
--
INSERT INTO Farm (farm_id, name, location_id) VALUES
(401, 'Lipa Fresh Farms', 102),
(402, 'Tagaytay Organics', 103),
(403, 'Baguio Highland Greens', 104),
(404, 'Davao Fruit Kings', 105),
(405, 'Calamba Herbal Farm', 110),
(406, 'Batangas Free Range', 102),
(407, 'Cebu Tropical Fruits', 109),
(408, 'Laguna Fields', 110),
(409, 'Mindanao Cacao', 105),
(410, 'Quezon Coconut Groves', 101);

--
-- 5. Insert data into 'FarmProduct' (Depends on RawProduct, Farm)
-- (This table links which farms grow which products)
--
INSERT INTO FarmProduct (product_id, farm_id, population, population_unit) VALUES
(201, 401, 5000, 'plants'),
(202, 402, 2000, 'trees'),
(203, 403, 10, 'hectares'),
(205, 407, 1500, 'trees'),
(206, 403, 5, 'hectares'),
(207, 402, 8, 'hectares'),
(208, 401, 3000, 'plants'),
(209, 403, 10000, 'plants'),
(210, 404, 500, 'trees'),
(201, 402, 2000, 'plants'); -- Farm 402 also grows Tomatoes

--
-- 6. Insert data into 'Inventory' (Depends on FarmProduct)
-- (Batches of harvested products)
--
INSERT INTO Inventory (batch_id, product_id, farm_id, price, weight, notes, exp_date, quantity) VALUES
(NULL, 201, 401, 150.00, 1.00, 'Batch A, ripe', '2025-11-30', 100),
(NULL, 202, 402, 80.50, 0.50, 'Slightly hard, grade SR', '2025-12-10', 500),
(NULL, 203, 403, 200.00, 1.00, 'Freshly picked, triple-washed', '2025-11-25', 200),
(NULL, 205, 407, 120.00, 1.00, 'Sweet and fragrant', '2025-12-05', 1000),
(NULL, 206, 403, 400.00, 1.00, 'Small but sweet', '2025-11-28', 300),
(NULL, 207, 402, 250.00, 1.00, 'Organic Kale, Grade R', '2025-11-26', 150),
(NULL, 208, 401, 300.00, 1.00, 'Very spicy', '2025-12-15', 50),
(NULL, 209, 403, 800.00, 1.00, 'Kibungan beans, sun-dried', '2026-11-18', 200),
(NULL, 210, 404, 180.00, 1.00, 'Puyat variety', '2025-11-30', 400),
(NULL, 201, 402, 160.00, 1.00, 'Tagaytay tomatoes, greenhouse grown', '2025-12-02', 250);

--
-- 7. Insert data into 'Subscription' (Depends on FarmProduct, Client, Location)
--
INSERT INTO Subscription (program_id, product_id, farm_id, client_id, order_interval_days, start_date, quantity, location_id, price, status) VALUES
(NULL, 201, 401, 301, 7, '2025-12-01', 10, 101, 145.00, 'ACTIVE'),
(NULL, 202, 402, 301, 14, '2025-12-01', 20, 101, 80.00, 'ACTIVE'),
(NULL, 203, 403, 309, 7, '2025-11-20', 50, 101, 190.00, 'QUOTED'),
(NULL, 207, 402, 309, 7, '2025-11-20', 30, 101, NULL, 'AWAITING_QUOTE'),
(NULL, 205, 407, 307, 3, '2025-12-05', 100, 109, 110.00, 'ACTIVE'),
(NULL, 209, 403, 303, 30, '2026-01-01', 50, 107, 750.00, 'QUOTED'),
(NULL, 210, 404, 310, 14, '2025-11-25', 200, 105, 170.00, 'ACTIVE'),
(NULL, 206, 403, 308, 1, '2025-11-20', 50, 104, 380.00, 'ACTIVE'),
(NULL, 201, 401, 302, 30, '2025-12-15', 30, 106, 150.00, 'CANCELLED'),
(NULL, 208, 401, 306, 14, '2025-12-01', 5, 101, NULL, 'AWAITING_QUOTE');

--
-- 8. Insert data into 'Orders' (Depends on Client, Inventory, Location, Subscription)
--
INSERT INTO Orders (order_id, client_id, batch_id, location_id, order_date, quantity, is_shipped, due_by, loyalty_points_used, program_id) VALUES
(NULL, 301, 1, 101, '2025-11-18', 10, 0, '2025-11-20', 100, 1),
(NULL, 309, 3, 101, '2025-11-18', 50, 0, '2025-11-21', 0, 3),
(NULL, 302, 2, 106, '2025-11-17', 200, 1, '2025-11-19', 500, NULL),
(NULL, 307, 4, 109, '2025-11-18', 300, 0, '2025-11-25', 0, NULL),
(NULL, 308, 5, 104, '2025-11-18', 50, 1, '2025-11-18', 0, 8),
(NULL, 310, 9, 105, '2025-11-16', 100, 1, '2025-11-20', 200, 7),
(NULL, 303, 8, 107, '2025-11-15', 20, 1, '2025-11-30', 0, NULL),
(NULL, 306, 7, 101, '2025-11-18', 5, 0, '2025-11-19', 0, NULL),
(NULL, 301, 10, 101, '2025-11-18', 15, 0, '2025-11-21', 0, NULL),
(NULL, 309, 6, 101, '2025-11-17', 40, 1, '2025-11-19', 1000, NULL);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS=1;