/**
 * dummy.sql
 *
 * Script to populate the 'kungfoodpanda_db' schema with dummy data.
 * The data is designed to satisfy all NOT NULL constraints, foreign key
 * constraints, and CHECK constraints.
 */

USE kungfoodpanda_db;

-- -----------------------------------------------------------------------------
-- 1. Location Table
-- -----------------------------------------------------------------------------
-- 10 Rows
INSERT INTO Location (location_id, continent, country, state, city, street) VALUES
(1001, 'Asia', 'China', 'Sichuan', 'Chengdu', 'Qingcheng Mountain Road 1'),
(1002, 'North America', 'USA', 'California', 'San Francisco', 'Market Street 123'),
(1003, 'Europe', 'France', 'Île-de-France', 'Paris', 'Champs-Élysées 40'),
(1004, 'Asia', 'Japan', 'Tokyo', 'Shibuya', 'Dogenzaka 2-24-1'),
(1005, 'North America', 'Canada', 'Ontario', 'Toronto', 'Yonge Street 100'),
(1006, 'South America', 'Brazil', 'São Paulo', 'São Paulo', 'Avenida Paulista 200'),
(1007, 'Europe', 'Germany', 'Bavaria', 'Munich', 'Marienplatz 1'),
(1008, 'Asia', 'South Korea', 'Seoul', 'Gangnam', 'Teheran-ro 521'),
(1009, 'Oceania', 'Australia', 'New South Wales', 'Sydney', 'George Street 50'),
(1010, 'Asia', 'India', 'Maharashtra', 'Mumbai', 'Bandra Kurla Complex');

-- -----------------------------------------------------------------------------
-- 2. RawProduct Table
-- -----------------------------------------------------------------------------
-- 10 Rows
INSERT INTO RawProduct (product_id, product_name, product_type, grade, start_season, end_season) VALUES
(2001, 'Premium Oolong Tea Leaves', 'Tea', 'SSR', '2025-03-01', '2025-10-31'),
(2002, 'Organic Quinoa Seeds', 'Grain', 'SR', '2025-04-15', '2025-11-30'),
(2003, 'Aged Balsamic Vinegar', 'Condiment', 'R', '2024-01-01', '2030-12-31'),
(2004, 'Fresh Fuji Apple', 'Fruit', 'UC', '2025-09-01', '2026-03-01'),
(2005, 'Wild Caught Salmon Fillet', 'Fish', 'SSR', '2025-05-20', '2025-12-31'),
(2006, 'Heirloom Tomato', 'Vegetable', 'SR', '2025-06-01', '2025-10-15'),
(2007, 'Grass-fed Beef Loin', 'Meat', 'R', '2025-01-01', '2025-12-31'),
(2008, 'Black Truffle Oil', 'Oil', 'SSR', '2025-02-01', '2026-01-31'),
(2009, 'Peruvian Cocoa Beans', 'Bean', 'UC', '2025-03-01', '2025-08-30'),
(2010, 'Japanese Matcha Powder', 'Tea', 'SR', '2025-04-01', '2026-03-31');

-- -----------------------------------------------------------------------------
-- 3. Client Table
-- -----------------------------------------------------------------------------
-- 10 Rows
INSERT INTO Client (client_id, company_name, first_name, last_name, honorific, email, location_id, loyalty_points) VALUES
(3001, 'Zen Culinary', 'Jia', 'Li', 'Ms.', 'jia.li@zenculinary.com', 1001, 500),
(3002, 'Bay Area Bistro', 'David', 'Chen', 'Mr.', 'david.chen@baybistro.com', 1002, 1200),
(3003, 'The Gourmet Palace', 'Marie', 'Dubois', 'Mrs.', 'marie.dubois@gourmetpalace.fr', 1003, 300),
(3004, NULL, 'Kenji', 'Sato', 'Mr.', 'kenji.sato@personal.jp', 1004, 0),
(3005, 'Maple Leaf Food Co.', 'Sarah', 'Miller', 'Dr.', 'sarah.miller@maplefoodco.ca', 1005, 850),
(3006, 'Taste of Rio', 'Carlos', 'Silva', 'Mx.', 'carlos.silva@tasteofrio.br', 1006, 150),
(3007, 'Alpine Delights', 'Klaus', 'Weber', 'Mr.', 'klaus.weber@alpinedelights.de', 1007, 2000),
(3008, 'K-Food Hub', 'Mina', 'Park', 'Ms.', 'mina.park@kfoodhub.kr', 1008, 400),
(3009, 'Outback Kitchen', 'Liam', 'O’Connell', 'Mr.', 'liam.o@outbackkitchen.au', 1009, 600),
(3010, 'Spice Route Imports', 'Priya', 'Patel', 'Mrs.', 'priya.patel@spiceroute.in', 1010, 100);

-- -----------------------------------------------------------------------------
-- 4. Farm Table
-- -----------------------------------------------------------------------------
-- 10 Rows
INSERT INTO Farm (farm_id, name, location_id) VALUES
(4001, 'Bamboo Valley Tea Farm', 1001),
(4002, 'Golden Coast Grains', 1002),
(4003, 'Aged Barrel Estate', 1007), -- German location for a change
(4004, 'Mount Fuji Orchards', 1004),
(4005, 'Alaskan Fisheries', 1005),
(4006, 'Southern Sun Organics', 1006),
(4007, 'Bavarian Cattle Ranch', 1007),
(4008, 'The Black Gold Reserve', 1003), -- French location
(4009, 'Andean Cacao Farm', 1006), -- Brazil location for beans
(4010, 'Kyoto Matcha Gardens', 1004);

-- -----------------------------------------------------------------------------
-- 5. FarmProduct Table
-- -----------------------------------------------------------------------------
-- 10 Rows - Linking RawProducts to Farms
INSERT INTO FarmProduct (product_id, farm_id, population, population_unit) VALUES
(2001, 4001, 15000, 'Tea bushes'), -- Oolong from Bamboo Valley
(2002, 4002, 50, 'Acres'), -- Quinoa from Golden Coast
(2003, 4003, 2000, 'Barrels'), -- Vinegar from Aged Barrel
(2004, 4004, 5000, 'Trees'), -- Fuji Apple from Mt Fuji Orchards
(2005, 4005, 0, 'Fish'), -- Salmon from Alaskan Fisheries - population might not apply well to wild catch
(2006, 4006, 30000, 'Plants'), -- Tomato from Southern Sun
(2007, 4007, 500, 'Cattle'), -- Beef from Bavarian Ranch
(2008, 4008, 0, 'Truffle-producing trees'), -- Truffle Oil from Black Gold
(2009, 4009, 1000, 'Cacao Trees'), -- Cocoa from Andean Cacao
(2010, 4010, 10000, 'Matcha plants'); -- Matcha from Kyoto Gardens

-- -----------------------------------------------------------------------------
-- 6. Inventory Table
-- -----------------------------------------------------------------------------
-- 10 Rows - Creating batches of FarmProducts
INSERT INTO Inventory (product_id, farm_id, price, weight, notes, exp_date, quantity) VALUES
(2001, 4001, 55.99, 0.5, 'First flush harvest, spring 2025', '2026-03-31', 100),
(2002, 4002, 12.50, 1.0, 'Organic certified, recent batch', '2026-11-01', 500),
(2003, 4003, 89.00, 0.25, '10 year aged, limited stock', '2035-12-31', 50),
(2004, 4004, 1.99, 0.2, 'Large size, crisp texture', '2025-12-15', 5000),
(2005, 4005, 35.00, 0.3, 'Frozen, individually vacuum-sealed', '2026-06-30', 200),
(2006, 4006, 3.50, 0.15, 'Peak season ripeness', '2025-10-05', 1000),
(2007, 4007, 95.99, 1.0, 'Premium cut, chiller storage', '2025-11-25', 80),
(2008, 4008, 120.00, 0.1, 'Small batch infusion', '2026-04-01', 30),
(2009, 4009, 8.75, 0.5, 'Raw, unprocessed beans', '2026-05-01', 400),
(2010, 4010, 45.00, 0.1, 'Ceremonial grade, fresh ground', '2026-01-31', 150);

-- -----------------------------------------------------------------------------
-- 7. Subscription Table
-- -----------------------------------------------------------------------------
-- 10 Rows - Client subscribing to a FarmProduct
INSERT INTO Subscription (product_id, farm_id, client_id, order_interval_days, start_date, quantity, location_id, price, status) VALUES
(2001, 4001, 3001, 30, '2025-11-01', 5, 1001, 50.00, 'ACTIVE'), -- Jia Li subscribes to Oolong Tea
(2002, 4002, 3002, 14, '2025-10-15', 20, 1002, 11.50, 'ACTIVE'), -- David Chen subscribes to Quinoa
(2003, 4003, 3003, 60, '2025-09-01', 1, 1003, 85.00, 'ACTIVE'), -- Marie Dubois subscribes to Vinegar
(2004, 4004, 3004, 7, '2025-11-10', 50, 1004, NULL, 'AWAITING_QUOTE'), -- Kenji Sato wants Apples
(2005, 4005, 3005, 30, '2025-10-01', 10, 1005, 33.00, 'ACTIVE'), -- Sarah Miller subscribes to Salmon
(2006, 4006, 3006, 7, '2025-11-15', 30, 1006, NULL, 'AWAITING_QUOTE'), -- Carlos Silva wants Tomatoes
(2007, 4007, 3007, 90, '2025-08-01', 5, 1007, 90.00, 'QUOTED'), -- Klaus Weber quoted for Beef
(2008, 4008, 3008, 30, '2025-09-01', 2, 1008, 115.00, 'ACTIVE'), -- Mina Park subscribes to Truffle Oil
(2009, 4009, 3009, 45, '2025-11-19', 15, 1009, 8.00, 'QUOTED'), -- Liam O'Connell quoted for Cocoa Beans
(2010, 4010, 3010, 60, '2025-07-01', 5, 1010, 43.00, 'ACTIVE'), -- Priya Patel subscribes to Matcha
(2001, 4001, 3002, 90, '2025-10-15', 10, 1002, 50.00, 'ACTIVE'); -- David Chen also wants Tea, different interval/location

-- -----------------------------------------------------------------------------
-- 8. Orders Table
-- -----------------------------------------------------------------------------
-- 10 Rows - Client placing an order from an Inventory batch
INSERT INTO Orders (client_id, batch_id, location_id, order_date, quantity, shipped_date, due_by, loyalty_points_used) VALUES
(3001, 1, 1001, '2025-11-10', 5, '2025-11-12', '2025-11-20', 0), -- Oolong Tea for Jia Li
(3002, 2, 1002, '2025-11-05', 20, '2025-11-07', '2025-11-15', 100), -- Quinoa for David Chen
(3003, 3, 1003, '2025-10-20', 1, '2025-10-25', '2025-11-01', 0), -- Vinegar for Marie Dubois
(3004, 4, 1004, '2025-11-18', 50, NULL, '2025-11-28', 0), -- Apples for Kenji Sato (unshipped)
(3005, 5, 1005, '2025-10-30', 10, '2025-11-01', '2025-11-10', 0), -- Salmon for Sarah Miller
(3007, 7, 1007, '2025-11-19', 5, NULL, '2025-12-05', 500), -- Beef for Klaus Weber (unshipped)
(3008, 8, 1008, '2025-11-01', 2, '2025-11-03', '2025-11-08', 0), -- Truffle Oil for Mina Park
(3009, 9, 1009, '2025-10-10', 15, '2025-10-12', '2025-10-20', 0), -- Cocoa Beans for Liam O'Connell
(3010, 10, 1010, '2025-11-04', 5, '2025-11-05', '2025-11-14', 0), -- Matcha for Priya Patel
(3001, 6, 1001, '2025-11-09', 10, '2025-11-10', '2025-11-19', 0); -- Tomatoes for Jia Li (additional order)