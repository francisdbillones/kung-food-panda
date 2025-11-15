USE kungfoodpanda_db;

DELIMITER $$

CREATE TRIGGER orders_update_stock_after_insert
BEFORE INSERT ON Orders
FOR EACH ROW
BEGIN
    UPDATE Inventory SET quantity = quantity - NEW.quantity
    WHERE batch_id = NEW.batch_id
    AND quantity >= NEW.quantity
    AND exp_date >= CURDATE();

    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for the requested order.';
    END IF;
END$$

CREATE TRIGGER orders_update_loyalty_points_after_ship
AFTER UPDATE ON Orders
FOR EACH ROW
BEGIN
    DECLARE points_earned INT UNSIGNED;

    IF NEW.is_shipped = 1 AND old.is_shipped = 0 THEN
        SELECT FLOOR(SUM(i.price * NEW.quantity) / 10)
        INTO points_earned
        FROM Inventory i
        WHERE i.batch_id = NEW.batch_id;

        IF ROW_COUNT() = 0 THEN
            SQL STATE '45000'
            SET MESSAGE_TEXT = 'Could not find inventory used for order fulfillment.';
        END IF;

        UPDATE Client
        SET loyalty_points = loyalty_points + points_earned
        WHERE client_id = NEW.client_id;
    END IF;
END$$

CREATE TRIGGER orders_deduct_loyalty_points_before_insert
BEFORE INSERT ON Orders
FOR EACH ROW
BEGIN
    IF NEW.loyalty_points_used > 0 THEN
        UPDATE Client
        SET loyalty_points = loyalty_points - NEW.loyalty_points_used
        WHERE client_id = NEW.client_id
        AND loyalty_points >= NEW.loyalty_points_used;

        IF ROW_COUNT() = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insufficient loyalty points for this order.';
        END IF;
    END IF;
END$$

DELIMITER ;