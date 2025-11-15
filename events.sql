SET GLOBAL event_scheduler = ON;

DELIMITER $$

CREATE EVENT IF NOT EXISTS create_subscription_orders
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP + INTERVAL 1 MINUTE
DO
BEGIN
    INSERT INTO Orders (
        client_id,
        batch_id,
        location_id,
        order_date,
        quantity,
        is_shipped,
        due_by
    )
    SELECT
        s.client_id,
        ranked_inventory.batch_id,
        s.location_id,
        CURDATE(),
        s.quantity,
        0,
        DATE_ADD(CURDATE(), INTERVAL s.order_interval_days DAY)
    FROM Subscription s
    JOIN (
        SELECT
            batch_id,
            product_id,
            ROW_NUMBER() OVER (
                PARTITION BY product_id
                ORDER BY exp_date ASC, batch_id ASC
            ) AS product_rank
        FROM Inventory
        WHERE quantity > 0
    ) ranked_inventory
        ON ranked_inventory.product_id = s.product_id
       AND ranked_inventory.product_rank = 1
    WHERE DATEDIFF(CURDATE(), s.start_date) >= 0
      AND MOD(
          DATEDIFF(CURDATE(), s.start_date),
          s.order_interval_days
      ) = 0;
END$$

DELIMITER ;
