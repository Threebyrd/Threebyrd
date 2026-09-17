ALTER TABLE `order_capacity_reservations` ADD `meal_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `order_capacity_reservations`
SET `meal_count` = (
  SELECT COALESCE(SUM(CAST(json_extract(json_item.value, '$.quantity') AS INTEGER)), 0)
  FROM `orders`, json_each(`orders`.`items`) AS json_item
  WHERE `orders`.`stripe_session_id` = `order_capacity_reservations`.`stripe_session_id`
    AND `orders`.`status` = 'confirmed'
)
WHERE `order_capacity_reservations`.`status` = 'confirmed'
  AND `order_capacity_reservations`.`stripe_session_id` IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM `orders`
    WHERE `orders`.`stripe_session_id` = `order_capacity_reservations`.`stripe_session_id`
      AND `orders`.`status` = 'confirmed'
  );
