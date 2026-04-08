-- Jack Pine Farm: Production database backup
-- Generated: 2026-04-08T15:28:49.064Z
-- Source: Replit production PostgreSQL
-- Target: Supabase
-- Tables: 34 (session table excluded — sessions invalidated on migration)

-- Disable triggers during import to avoid FK issues
SET session_replication_role = replica;

-- farmops_tenants: 2 row(s)
INSERT INTO farmops_tenants ("id", "slug", "name", "owner_email", "status", "plan", "stripe_customer_id", "stripe_subscription_id", "stripe_subscription_status", "stripe_price_id", "trial_ends_at", "current_period_ends_at", "onboarding_purchased_at", "stripe_onboarding_payment_id", "created_at", "updated_at", "created_by_admin_id") VALUES (1, 'jack-pine-farm', 'Jack Pine Farm', 'hello@jackpinefarms.farm', 'active', 'pro', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-03T15:54:41.348555+00:00', '2026-04-03T15:54:41.348555+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO farmops_tenants ("id", "slug", "name", "owner_email", "status", "plan", "stripe_customer_id", "stripe_subscription_id", "stripe_subscription_status", "stripe_price_id", "trial_ends_at", "current_period_ends_at", "onboarding_purchased_at", "stripe_onboarding_payment_id", "created_at", "updated_at", "created_by_admin_id") VALUES (2, 'test-farm', 'Test Farm', 'stephsdevine@gmail.com', 'trialing', 'starter', NULL, NULL, NULL, NULL, '2026-04-18T15:50:42.816+00:00', NULL, NULL, NULL, '2026-04-04T15:50:42.846397+00:00', '2026-04-04T15:50:42.846397+00:00', NULL) ON CONFLICT DO NOTHING;

-- platform_admins: 1 row(s)
INSERT INTO platform_admins ("id", "email", "name", "password_hash", "is_active", "last_login_at", "created_at", "role", "must_change_password", "password_reset_at") VALUES (1, 'admin@jackpinefarms.farm', 'Jack Pine Admin', '$2b$12$g3kigc2WO7Ttm55VPvQCg.nwICxhBwhY00f.jSQhNol91HY1R5edy', TRUE, '2026-04-08T09:59:39.891+00:00', '2026-04-03T15:54:42.572957+00:00', 'owner', FALSE, NULL) ON CONFLICT DO NOTHING;

-- customers: 1 row(s)
INSERT INTO customers ("id", "email", "password_hash", "name", "phone", "email_verified", "created_at", "updated_at", "reset_token", "reset_token_expires_at", "verification_token", "notes") VALUES (3, NULL, NULL, 'Rhonda Avery', NULL, FALSE, '2026-04-01T11:12:51.46825+00:00', '2026-04-01T11:12:51.46825+00:00', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING;

-- egg_types: 3 row(s)
INSERT INTO egg_types ("id", "name", "flock_id", "active", "tenant_id") VALUES (1, 'Chicken Eggs', NULL, TRUE, 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_types ("id", "name", "flock_id", "active", "tenant_id") VALUES (2, 'Duck Eggs', NULL, TRUE, 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_types ("id", "name", "flock_id", "active", "tenant_id") VALUES (3, 'Red Bronze Turkey', NULL, TRUE, 1) ON CONFLICT DO NOTHING;

-- flocks: 4 row(s)
INSERT INTO flocks ("id", "name", "species", "acquired_date", "status", "notes", "hen_count", "rooster_count", "hatch_date", "age_months", "breed", "tenant_id") VALUES (1, 'Cinnamon Queen', 'chicken', '2026-03-21', 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1) ON CONFLICT DO NOTHING;
INSERT INTO flocks ("id", "name", "species", "acquired_date", "status", "notes", "hen_count", "rooster_count", "hatch_date", "age_months", "breed", "tenant_id") VALUES (3, 'Standard Cochin', 'chicken', '2025-06-26', 'active', NULL, NULL, NULL, NULL, NULL, NULL, 1) ON CONFLICT DO NOTHING;
INSERT INTO flocks ("id", "name", "species", "acquired_date", "status", "notes", "hen_count", "rooster_count", "hatch_date", "age_months", "breed", "tenant_id") VALUES (2, 'American White Bresse', 'chicken', '2025-08-26', 'active', NULL, 10, 2, NULL, 10, NULL, 1) ON CONFLICT DO NOTHING;
INSERT INTO flocks ("id", "name", "species", "acquired_date", "status", "notes", "hen_count", "rooster_count", "hatch_date", "age_months", "breed", "tenant_id") VALUES (4, 'Black Sex Link', 'chicken', '2025-03-15', 'active', NULL, 8, 1, '2025-03-05', NULL, NULL, 1) ON CONFLICT DO NOTHING;

-- site_settings: 8 row(s)
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.hero_bg', '', '2026-03-31T12:16:59.773529+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.logo', '', '2026-03-31T12:16:59.829568+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.how_we_feed', '', '2026-03-31T12:17:00.031477+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.product_fallback', '', '2026-03-31T12:17:00.071802+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.about_farm', '/api/storage/objects/uploads/a8c668ec-d3c4-4800-b2c5-c5d5fa9aeda1', '2026-04-03T11:14:37.695+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.home_promise', '/api/storage/objects/uploads/110c6e63-2c9e-4d5f-abcf-a523c7057634', '2026-04-03T11:16:57.67+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.checkout_hero', '/api/storage/objects/uploads/add08171-9776-45ea-950b-dd5d6a8c409c', '2026-04-03T11:19:20.988+00:00') ON CONFLICT DO NOTHING;
INSERT INTO site_settings ("key", "value", "updated_at") VALUES ('image.how_we_pasture', '/api/storage/objects/uploads/2570791c-7a0a-4753-a2c8-459def35a9c1', '2026-04-03T11:20:05.553+00:00') ON CONFLICT DO NOTHING;

-- cms_pages: 1 row(s)
INSERT INTO cms_pages ("id", "slug", "title", "content_html", "status", "published_at", "created_at", "updated_at") VALUES (1, 'contact', 'Contact US', '', 'draft', '2026-04-03T13:41:11.085+00:00', '2026-04-03T13:41:06.014897+00:00', '2026-04-03T13:47:06.341+00:00') ON CONFLICT DO NOTHING;

-- cms_menus: 2 row(s)
INSERT INTO cms_menus ("id", "name", "created_at", "updated_at") VALUES (2, 'footer', '2026-04-03T12:59:26.533301+00:00', '2026-04-03T12:59:26.533301+00:00') ON CONFLICT DO NOTHING;
INSERT INTO cms_menus ("id", "name", "created_at", "updated_at") VALUES (1, 'header', '2026-04-03T12:59:26.533301+00:00', '2026-04-05T09:45:52.944+00:00') ON CONFLICT DO NOTHING;

-- cms_menu_items: 5 row(s)
INSERT INTO cms_menu_items ("id", "menu_id", "label", "url", "sort_order", "is_hidden", "created_at", "updated_at") VALUES (48, 1, 'Shop', '/shop', 0, FALSE, '2026-04-05T09:45:52.910202+00:00', '2026-04-05T09:45:52.910202+00:00') ON CONFLICT DO NOTHING;
INSERT INTO cms_menu_items ("id", "menu_id", "label", "url", "sort_order", "is_hidden", "created_at", "updated_at") VALUES (49, 1, 'Our Story', '/about', 1, FALSE, '2026-04-05T09:45:52.910202+00:00', '2026-04-05T09:45:52.910202+00:00') ON CONFLICT DO NOTHING;
INSERT INTO cms_menu_items ("id", "menu_id", "label", "url", "sort_order", "is_hidden", "created_at", "updated_at") VALUES (50, 1, 'FAQs', '/faq', 2, FALSE, '2026-04-05T09:45:52.910202+00:00', '2026-04-05T09:45:52.910202+00:00') ON CONFLICT DO NOTHING;
INSERT INTO cms_menu_items ("id", "menu_id", "label", "url", "sort_order", "is_hidden", "created_at", "updated_at") VALUES (51, 1, 'FarmOps', 'https://farmops.jackpinefarms.farm', 3, FALSE, '2026-04-05T09:45:52.910202+00:00', '2026-04-05T09:45:52.910202+00:00') ON CONFLICT DO NOTHING;
INSERT INTO cms_menu_items ("id", "menu_id", "label", "url", "sort_order", "is_hidden", "created_at", "updated_at") VALUES (52, 1, 'Contact', '/contact', 4, FALSE, '2026-04-05T09:45:52.910202+00:00', '2026-04-05T09:45:52.910202+00:00') ON CONFLICT DO NOTHING;

-- cms_page_seo: 0 rows

-- products: 5 row(s)
INSERT INTO products ("id", "name", "description", "product_type", "pricing_type", "price_in_cents", "unit_label", "deposit_description", "availability", "image_url", "display_order", "created_at", "updated_at", "is_on_sale", "sale_price_cents") VALUES (1, 'Premium Pastured Non-GMO Eggs', 'Healthy hens lay the best eggs. Our chickens enjoy 100% access to open, green pastures, providing you with a superior, nutrient-dense breakfast.
Pasture-Raised: Hens roam freely, foraging naturally.
Non-GMO: Supplemented with non-GMO, clean feed.
Nutrient-Dense: Rich in Omega-3s and Vitamin E with vibrant yolks.
Ethical: No antibiotics or synthetic hormones.
Experience the taste of natural, sustainable farming in every bite.', 'eggs_chicken', 'unit', 500, 'Dozen', NULL, 'taking_orders', '/api/storage/objects/uploads/1f7ed455-ddbc-432b-bee0-0fc8b9169d58', 0, '2026-03-25T09:18:28.578144+00:00', '2026-03-28T11:09:41.029+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO products ("id", "name", "description", "product_type", "pricing_type", "price_in_cents", "unit_label", "deposit_description", "availability", "image_url", "display_order", "created_at", "updated_at", "is_on_sale", "sale_price_cents") VALUES (3, 'Pasture-Raised Heritage Turkey Hen (2026 Season)', '<p>Elevate your holiday table with our Michigan-raised pasture-fed heritage turkeys. These birds roam freely on fresh pasture, forging a richer, more complex flavor than conventional birds. Ethically raised without antibiotics or hormones, our heritage turkeys provide a superior, natural, and memorable dining experience. 100% Pasture-Raised: Raised outdoors with room to roam, ensuring happy, healthy birds. Rich, Authentic Flavor: Heritage breeds offer a deeper, more robust flavor profile. Ethical and Sustainable: Raised with regenerative farming practices, non-GMO fed, and free from antibiotics. Locally Processed: Available for the holiday season. Raised on a Michigan family farm. Finished turkeys will weigh from 9 to 14 lbs. Giblets are included.</p>', 'meat_turkey', 'deposit', 2500, 'Deposit', 'A $25 deposit reserves your turkey. This amount will be applied to your final total. A small deposit secures your spot in our schedule. The $25 deposit will be deducted from your final order amount.  Finished turkey price is $9.00/lb for hens.', 'preorder', '/api/storage/objects/uploads/e732bc93-26c1-45f5-8938-15222c134ad4', 0, '2026-03-25T09:36:20.771144+00:00', '2026-03-30T11:49:55.971+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO products ("id", "name", "description", "product_type", "pricing_type", "price_in_cents", "unit_label", "deposit_description", "availability", "image_url", "display_order", "created_at", "updated_at", "is_on_sale", "sale_price_cents") VALUES (4, 'Laying Hen', 'Special Order Only', 'eggs_chicken', 'unit', 1000, 'Hen', NULL, 'disabled', NULL, 0, '2026-03-26T21:27:22.81362+00:00', '2026-03-26T21:27:22.81362+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO products ("id", "name", "description", "product_type", "pricing_type", "price_in_cents", "unit_label", "deposit_description", "availability", "image_url", "display_order", "created_at", "updated_at", "is_on_sale", "sale_price_cents") VALUES (5, 'Pasture-Raised Heritage Turkey Tom (Season 2026)', 'Elevate your holiday table with our Michigan-raised pasture-fed heritage turkeys. These birds roam freely on fresh pasture, forging a richer, more complex flavor than conventional birds. 

Ethically raised without antibiotics or hormones, our heritage turkeys provide a superior, natural, and memorable dining experience. 

100% Pasture-Raised: Raised outdoors with room to roam, ensuring happy, healthy birds.
Rich, Authentic Flavor: Heritage breeds offer a deeper, more robust flavor profile.
Ethical and Sustainable: Raised with regenerative farming practices, non-GMO fed, and free from antibiotics.
Locally Processed: Available for the holiday season. 
Raised on a Michigan family farm.

Finished turkeys will weigh from 9 to 14 lbs.  Giblets are included.', 'meat_turkey', 'deposit', 2500, 'Turkey', 'A $25 deposit reserves your turkey. This amount will be applied to your final total. A small deposit secures your spot in our schedule. The $25 deposit will be deducted from your final order amount.  Finished turkey price is $8.00/lb for toms.', 'taking_orders', '/api/storage/objects/uploads/01f27467-2a6c-4e6d-8e5c-a4b2e4c9d374', 0, '2026-03-28T11:04:07.139987+00:00', '2026-03-28T11:18:45.236+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO products ("id", "name", "description", "product_type", "pricing_type", "price_in_cents", "unit_label", "deposit_description", "availability", "image_url", "display_order", "created_at", "updated_at", "is_on_sale", "sale_price_cents") VALUES (2, 'Pasture-Raised Chicken Deposit (2026 Season)', '<p>Eat with confidence knowing your food was raised ethically and naturally. Our chickens live outdoors 24/7/ and almost 365, enjoying bugs, pastures, and a locally milled non-GMO diet. This results in a cleaner, nutrient-dense protein that is better for you, the animal, and the land. Get on the list now to ensure your freezer is stocked with the healthiest chicken for your family. Deposit: $10/bird deposit to secure your order. Final Cost: $4/lb based on final weight, minus your $10 deposit. Availability: Limited quantities available for our July harvest.</p>', 'meat_chicken', 'deposit', 1000, 'Deposit', 'A small deposit secures your spot in our schedule. Please note that this deposit is non-refundable, as it is used to hold your order.  The $10 deposit will be deducted from your final order amount.', 'preorder', '/api/storage/objects/uploads/808ff801-e7b4-425e-bfb2-7f83a7c3a2dc', 0, '2026-03-25T09:27:20.564986+00:00', '2026-03-30T11:49:38.33+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;

-- product_images: 2 row(s)
INSERT INTO product_images ("id", "product_id", "object_key", "url", "sort_order", "alt_text", "created_at") VALUES (1, 2, '', '/api/storage/objects/uploads/808ff801-e7b4-425e-bfb2-7f83a7c3a2dc', 1, NULL, '2026-03-30T11:49:38.436618+00:00') ON CONFLICT DO NOTHING;
INSERT INTO product_images ("id", "product_id", "object_key", "url", "sort_order", "alt_text", "created_at") VALUES (2, 3, '', '/api/storage/objects/uploads/e732bc93-26c1-45f5-8938-15222c134ad4', 1, NULL, '2026-03-30T11:49:56.077663+00:00') ON CONFLICT DO NOTHING;

-- pickup_events: 4 row(s)
INSERT INTO pickup_events ("id", "name", "scheduled_at", "location_notes", "status", "created_at", "updated_at", "is_public", "capacity") VALUES (1, 'Tustin Pickup Event', '2026-03-31T10:00:00+00:00', 'Meet at the resale shop.', 'scheduled', '2026-03-31T12:52:42.075697+00:00', '2026-03-31T12:52:42.075697+00:00', FALSE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO pickup_events ("id", "name", "scheduled_at", "location_notes", "status", "created_at", "updated_at", "is_public", "capacity") VALUES (2, 'Tustin Egg Delivery Day', '2026-04-04T10:00:00+00:00', 'East Parking lot at Twice as Nice', 'scheduled', '2026-04-02T13:38:05.91494+00:00', '2026-04-02T13:38:05.91494+00:00', TRUE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO pickup_events ("id", "name", "scheduled_at", "location_notes", "status", "created_at", "updated_at", "is_public", "capacity") VALUES (3, 'GR Area Egg Delivery day', '2026-04-08T11:00:00+00:00', '1740 E Paris Ave SE (Dermatology Associates of West Michigan lot)', 'scheduled', '2026-04-02T13:39:39.199267+00:00', '2026-04-02T13:39:39.199267+00:00', TRUE, NULL) ON CONFLICT DO NOTHING;
INSERT INTO pickup_events ("id", "name", "scheduled_at", "location_notes", "status", "created_at", "updated_at", "is_public", "capacity") VALUES (4, 'Farm Pickup', '2026-04-15T17:30:00+00:00', 'Directions will be emailed', 'scheduled', '2026-04-04T15:27:25.488531+00:00', '2026-04-04T15:27:25.488531+00:00', TRUE, 25) ON CONFLICT DO NOTHING;

-- preorder_batches: 1 row(s)
INSERT INTO preorder_batches ("id", "product_id", "name", "status", "capacity_birds", "price_per_lb_cents_whole", "price_per_lb_cents_half", "price_per_lb_cents_quarter", "notes", "created_at", "updated_at") VALUES (1, 2, 'Summer 2026 Meat Chickens', 'open', 80, 499, 549, 599, NULL, '2026-04-03T13:37:07.069677+00:00', '2026-04-03T13:37:07.069677+00:00') ON CONFLICT DO NOTHING;

-- orders: 2 row(s)
INSERT INTO orders ("id", "customer_id", "customer_name", "customer_email", "customer_phone", "status", "payment_method", "stripe_checkout_session_id", "stripe_payment_intent_id", "total_in_cents", "notes", "created_at", "updated_at", "claim_token", "claim_token_expires_at", "batch_id", "pickup_event_id", "refunded_giblets", "stripe_refund_id", "stripe_invoice_id", "final_weight_lbs", "applied_coupon_code", "source", "stripe_checkout_url") VALUES (3, 3, 'Rhonda Avery', '', '', 'fulfilled', 'cash', NULL, NULL, 3500, NULL, '2026-04-03T11:36:03.048328+00:00', '2026-04-03T13:01:04.855+00:00', NULL, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL, 'admin', NULL) ON CONFLICT DO NOTHING;
INSERT INTO orders ("id", "customer_id", "customer_name", "customer_email", "customer_phone", "status", "payment_method", "stripe_checkout_session_id", "stripe_payment_intent_id", "total_in_cents", "notes", "created_at", "updated_at", "claim_token", "claim_token_expires_at", "batch_id", "pickup_event_id", "refunded_giblets", "stripe_refund_id", "stripe_invoice_id", "final_weight_lbs", "applied_coupon_code", "source", "stripe_checkout_url") VALUES (2, 3, 'Rhonda Avery', '', '', 'fulfilled', 'cash', NULL, NULL, 2000, NULL, '2026-04-01T11:13:18.103004+00:00', '2026-04-03T13:01:18.912+00:00', NULL, NULL, NULL, NULL, FALSE, NULL, NULL, NULL, NULL, 'admin', NULL) ON CONFLICT DO NOTHING;

-- order_items: 2 row(s)
INSERT INTO order_items ("id", "order_id", "product_id", "product_name", "quantity", "pricing_type", "unit_price_in_cents", "unit_label", "is_giblets", "line_total_in_cents", "pickup_event_id", "variant_label") VALUES (7, 3, 1, 'Premium Pastured Non-GMO Eggs', 7, 'unit', 500, 'Dozen', FALSE, 3500, NULL, NULL) ON CONFLICT DO NOTHING;
INSERT INTO order_items ("id", "order_id", "product_id", "product_name", "quantity", "pricing_type", "unit_price_in_cents", "unit_label", "is_giblets", "line_total_in_cents", "pickup_event_id", "variant_label") VALUES (8, 2, 1, 'Premium Pastured Non-GMO Eggs', 4, 'unit', 500, 'Dozen', FALSE, 2000, NULL, NULL) ON CONFLICT DO NOTHING;

-- order_events: 5 row(s)
INSERT INTO order_events ("id", "order_id", "event_type", "body", "metadata", "created_at") VALUES (2, 2, 'note', 'Order created by admin (draft — items not yet set)', NULL, '2026-04-01T11:13:18.150647+00:00') ON CONFLICT DO NOTHING;
INSERT INTO order_events ("id", "order_id", "event_type", "body", "metadata", "created_at") VALUES (3, 3, 'note', 'Order created by admin (draft — items not yet set)', NULL, '2026-04-03T11:36:03.092741+00:00') ON CONFLICT DO NOTHING;
INSERT INTO order_events ("id", "order_id", "event_type", "body", "metadata", "created_at") VALUES (4, 3, 'status_change', 'Order finalized by admin — Cash at Pickup', NULL, '2026-04-03T11:36:25.881156+00:00') ON CONFLICT DO NOTHING;
INSERT INTO order_events ("id", "order_id", "event_type", "body", "metadata", "created_at") VALUES (5, 3, 'status_change', 'Status changed from cash_pending to fulfilled. Note: Cash', NULL, '2026-04-03T13:01:04.922534+00:00') ON CONFLICT DO NOTHING;
INSERT INTO order_events ("id", "order_id", "event_type", "body", "metadata", "created_at") VALUES (6, 2, 'status_change', 'Status changed from cash_pending to fulfilled. Note: Cash', NULL, '2026-04-03T13:01:18.976008+00:00') ON CONFLICT DO NOTHING;

-- customer_carts: 0 rows

-- coupons: 2 row(s)
INSERT INTO coupons ("id", "code", "description", "discount_type", "discount_value", "max_redemptions", "redemptions_count", "is_active", "stripe_coupon_id", "created_at", "stripe_promotion_code_id", "starts_at", "ends_at") VALUES (2, 'RAVE10', 'Rhonda Avery', 'percent', 10, NULL, 0, TRUE, NULL, '2026-03-31T12:56:11.979753+00:00', NULL, NULL, '2026-12-31T05:00:00+00:00') ON CONFLICT DO NOTHING;
INSERT INTO coupons ("id", "code", "description", "discount_type", "discount_value", "max_redemptions", "redemptions_count", "is_active", "stripe_coupon_id", "created_at", "stripe_promotion_code_id", "starts_at", "ends_at") VALUES (3, 'JENNY10', NULL, 'percent', 10, NULL, 0, TRUE, NULL, '2026-04-02T13:40:53.317304+00:00', NULL, NULL, '2026-12-31T05:00:00+00:00') ON CONFLICT DO NOTHING;

-- farmops_users: 1 row(s)
INSERT INTO farmops_users ("id", "tenant_id", "email", "password_hash", "name", "role", "email_verified", "verification_token", "reset_token", "reset_token_expires_at", "last_login_at", "created_at", "updated_at") VALUES (2, 2, 'stephsdevine@gmail.com', '$2b$12$mJjUSUNiXU5Xhy4eWbQ7pOwcZr0fjVc72zo5lTPSA17JDcyzuZD0G', 'Test Person', 'owner', FALSE, '97a4d3612a28918e4fa609275dab833ea83ee8c06da73707660be3d8c9944fa3', '2c3b997c95a1b89d3016277d819ed6cbe1d15d6e14b67e9144a98bd85f6373a7', '2026-04-08T10:49:04.872+00:00', '2026-04-04T16:22:53.419+00:00', '2026-04-04T15:50:42.905147+00:00', '2026-04-08T09:49:04.873+00:00') ON CONFLICT DO NOTHING;

-- farmops_invitations: 0 rows

-- farmops_subscription_addons: 1 row(s)
INSERT INTO farmops_subscription_addons ("id", "tenant_id", "addon_type", "quantity", "stripe_subscription_item_id", "created_at", "updated_at") VALUES (1, 2, 'sms_notifications', 1, NULL, '2026-04-07T09:55:20.716765+00:00', '2026-04-07T09:55:20.716765+00:00') ON CONFLICT DO NOTHING;

-- farmops_sms_messages: 0 rows

-- animals: 0 rows

-- daily_egg_collection: 22 row(s)
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (1, 1, NULL, '2026-03-25', 89, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (2, 1, NULL, '2026-03-24', 65, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (3, 1, NULL, '2026-03-23', 67, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (4, 1, NULL, '2026-03-26', 63, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (5, 1, NULL, '2026-03-22', 57, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (6, 1, NULL, '2026-03-21', 58, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (7, 1, NULL, '2026-03-20', 12, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (8, 1, NULL, '2026-03-19', 15, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (9, 1, NULL, '2026-03-18', 9, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (10, 1, NULL, '2026-03-27', 69, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (11, 1, NULL, '2026-03-28', 90, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (12, 1, NULL, '2026-03-29', 86, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (16, 1, NULL, '2026-03-30', 92, 'Only about 4 dirty eggs today. Down from about half the first couple of days they were here. ') ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (17, 1, NULL, '2026-04-01', 84, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (18, 2, NULL, '2026-04-01', 1, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (19, 1, NULL, '2026-04-03', 163, 'April 2/3') ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (20, 2, NULL, '2026-04-03', 1, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (21, 1, NULL, '2026-04-04', 76, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (22, 1, NULL, '2026-04-05', 98, NULL) ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (23, 2, NULL, '2026-04-05', 0, '1 egg not collected. Left for nest. ') ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (24, 3, NULL, '2026-04-05', 26, 'In incubator today. Projected hatch date') ON CONFLICT DO NOTHING;
INSERT INTO daily_egg_collection ("id", "egg_type_id", "flock_id", "collection_date", "count_each", "notes") VALUES (25, 1, NULL, '2026-04-07', 94, NULL) ON CONFLICT DO NOTHING;

-- egg_inventory_lots: 22 row(s)
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (1, 1, 1, '2026-03-25', 89, 89, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (2, 1, 2, '2026-03-24', 65, 65, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (3, 1, 3, '2026-03-23', 67, 67, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (4, 1, 4, '2026-03-26', 63, 63, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (5, 1, 5, '2026-03-22', 57, 57, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (6, 1, 6, '2026-03-21', 58, 58, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (7, 1, 7, '2026-03-20', 12, 12, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (10, 1, 10, '2026-03-27', 69, 69, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (11, 1, 11, '2026-03-28', 90, 90, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (12, 1, 12, '2026-03-29', 86, 86, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (13, 1, 16, '2026-03-30', 92, 92, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (14, 1, 17, '2026-04-01', 84, 84, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (15, 2, 18, '2026-04-01', 1, 1, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (9, 1, 9, '2026-03-18', 9, 0, 'depleted', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (8, 1, 8, '2026-03-19', 15, 13, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (16, 1, 19, '2026-04-03', 163, 163, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (17, 2, 20, '2026-04-03', 1, 1, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (18, 1, 21, '2026-04-04', 76, 76, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (19, 1, 22, '2026-04-05', 98, 98, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (20, 2, 23, '2026-04-05', 0, 0, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (21, 3, 24, '2026-04-05', 26, 26, 'open', 1) ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_lots ("id", "egg_type_id", "source_collection_id", "lot_date", "initial_qty_each", "remaining_qty_each", "status", "tenant_id") VALUES (22, 1, 25, '2026-04-07', 94, 94, 'open', 1) ON CONFLICT DO NOTHING;

-- egg_inventory_adjustments: 9 row(s)
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (1, 1, NULL, -60, 'gave to tree trimmers', '2026-03-26T11:48:22.963769+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (2, 1, NULL, -24, 'Gave to Jen', '2026-03-26T11:48:41.169684+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (3, 1, NULL, -36, 'Pam', '2026-03-28T01:33:08.738755+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (4, 1, NULL, -36, 'Ericksons', '2026-03-28T01:33:25.658942+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (5, 1, NULL, -24, 'Aunt Lorna', '2026-03-28T01:33:43.358003+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (6, 1, NULL, -3, 'Personal use', '2026-03-30T12:19:42.669164+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (7, 1, NULL, 24, 'Pam 2026 previously unaccounted for', '2026-03-30T12:20:21.409351+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (8, 1, NULL, 36, 'Aunt Lorna 2026 previously unaccounted for', '2026-03-30T12:20:40.175357+00:00') ON CONFLICT DO NOTHING;
INSERT INTO egg_inventory_adjustments ("id", "egg_type_id", "lot_id", "qty_each", "reason", "created_at") VALUES (9, 1, NULL, -72, 'Jen 2026 previously unaccounted for', '2026-03-30T12:21:07.780983+00:00') ON CONFLICT DO NOTHING;

-- flock_events: 4 row(s)
INSERT INTO flock_events ("id", "flock_id", "event_type", "count", "event_date", "notes") VALUES (1, 2, 'acquired', 12, '2026-03-26', NULL) ON CONFLICT DO NOTHING;
INSERT INTO flock_events ("id", "flock_id", "event_type", "count", "event_date", "notes") VALUES (2, 2, 'died', 1, '2026-03-19', NULL) ON CONFLICT DO NOTHING;
INSERT INTO flock_events ("id", "flock_id", "event_type", "count", "event_date", "notes") VALUES (3, 4, 'acquired', 8, '2025-03-15', NULL) ON CONFLICT DO NOTHING;
INSERT INTO flock_events ("id", "flock_id", "event_type", "count", "event_date", "notes") VALUES (4, 1, 'acquired', 120, '2026-03-21', NULL) ON CONFLICT DO NOTHING;

-- expenses: 4 row(s)
INSERT INTO expenses ("id", "date", "category", "description", "amount_cents", "vendor", "payment_method", "notes", "created_at", "updated_at", "tenant_id") VALUES (1, '2026-03-26', 'labor', 'Weekend of 3/20 - 3/22/2026', 7000, 'Dakota Boyer', 'other', 'CashApp', '2026-03-28T12:23:27.184455+00:00', '2026-03-28T12:23:27.184455+00:00', 1) ON CONFLICT DO NOTHING;
INSERT INTO expenses ("id", "date", "category", "description", "amount_cents", "vendor", "payment_method", "notes", "created_at", "updated_at", "tenant_id") VALUES (2, '2026-03-21', 'other', '120 Cinnamon Queen laying hens ', 72000, 'Deline’s', 'cash', '10 month old hens, $6/each', '2026-03-30T22:59:23.630318+00:00', '2026-03-30T22:59:23.630318+00:00', 1) ON CONFLICT DO NOTHING;
INSERT INTO expenses ("id", "date", "category", "description", "amount_cents", "vendor", "payment_method", "notes", "created_at", "updated_at", "tenant_id") VALUES (3, '2026-03-26', 'feed', '1/2 ton non gmo layer/grower', 26500, 'Leroy Milling', 'card', NULL, '2026-04-02T19:34:05.043953+00:00', '2026-04-02T19:34:05.043953+00:00', 1) ON CONFLICT DO NOTHING;
INSERT INTO expenses ("id", "date", "category", "description", "amount_cents", "vendor", "payment_method", "notes", "created_at", "updated_at", "tenant_id") VALUES (4, '2026-04-04', 'feed', 'test', 1, NULL, 'other', NULL, '2026-04-04T16:10:55.195932+00:00', '2026-04-04T16:10:55.195932+00:00', 2) ON CONFLICT DO NOTHING;

-- inventory_allocations: 3 row(s)
INSERT INTO inventory_allocations ("id", "order_item_id", "lot_id", "allocated_qty_each", "allocated_at") VALUES (1, 7, 9, 7, '2026-04-03T11:36:41.302007+00:00') ON CONFLICT DO NOTHING;
INSERT INTO inventory_allocations ("id", "order_item_id", "lot_id", "allocated_qty_each", "allocated_at") VALUES (2, 8, 9, 2, '2026-04-03T13:00:35.146907+00:00') ON CONFLICT DO NOTHING;
INSERT INTO inventory_allocations ("id", "order_item_id", "lot_id", "allocated_qty_each", "allocated_at") VALUES (3, 8, 8, 2, '2026-04-03T13:00:35.146907+00:00') ON CONFLICT DO NOTHING;

-- contact_submissions: 0 rows

-- notify_me: 0 rows

-- stripe_pending_checkouts: 0 rows

-- platform_admin_audit_logs: 10 row(s)
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (1, 1, 'admin.logout', 'admin', 1, NULL, '2026-04-05T22:18:09.308093+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (2, 1, 'admin.login', 'admin', 1, NULL, '2026-04-05T22:19:04.642783+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (3, 1, 'admin.login', 'admin', 1, NULL, '2026-04-06T08:25:31.937535+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (4, 1, 'admin.login', 'admin', 1, NULL, '2026-04-06T08:25:50.150536+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (5, 1, 'admin.logout', 'admin', 1, NULL, '2026-04-06T08:28:33.613475+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (6, 1, 'admin.login', 'admin', 1, NULL, '2026-04-06T08:28:36.907145+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (7, 1, 'tenant.addon_add', 'tenant', 2, '{"quantity":1,"addonType":"sms_notifications"}', '2026-04-07T09:55:20.773145+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (8, 1, 'admin.logout', 'admin', 1, NULL, '2026-04-07T09:55:57.462194+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (9, 1, 'admin.login', 'admin', 1, NULL, '2026-04-08T09:14:27.490045+00:00') ON CONFLICT DO NOTHING;
INSERT INTO platform_admin_audit_logs ("id", "admin_id", "action", "target_type", "target_id", "metadata", "created_at") VALUES (10, 1, 'admin.logout', 'admin', 1, NULL, '2026-04-08T09:32:14.106082+00:00') ON CONFLICT DO NOTHING;


-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequences
SELECT setval(pg_get_serial_sequence('farmops_tenants', 'id'), COALESCE((SELECT MAX(id) FROM farmops_tenants), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('platform_admins', 'id'), COALESCE((SELECT MAX(id) FROM platform_admins), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('egg_types', 'id'), COALESCE((SELECT MAX(id) FROM egg_types), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('flocks', 'id'), COALESCE((SELECT MAX(id) FROM flocks), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('site_settings', 'id'), COALESCE((SELECT MAX(id) FROM site_settings), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('cms_pages', 'id'), COALESCE((SELECT MAX(id) FROM cms_pages), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('cms_menus', 'id'), COALESCE((SELECT MAX(id) FROM cms_menus), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('cms_menu_items', 'id'), COALESCE((SELECT MAX(id) FROM cms_menu_items), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('cms_page_seo', 'id'), COALESCE((SELECT MAX(id) FROM cms_page_seo), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('product_images', 'id'), COALESCE((SELECT MAX(id) FROM product_images), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('pickup_events', 'id'), COALESCE((SELECT MAX(id) FROM pickup_events), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('preorder_batches', 'id'), COALESCE((SELECT MAX(id) FROM preorder_batches), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE((SELECT MAX(id) FROM order_items), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('order_events', 'id'), COALESCE((SELECT MAX(id) FROM order_events), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('customer_carts', 'id'), COALESCE((SELECT MAX(id) FROM customer_carts), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('coupons', 'id'), COALESCE((SELECT MAX(id) FROM coupons), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('farmops_users', 'id'), COALESCE((SELECT MAX(id) FROM farmops_users), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('farmops_invitations', 'id'), COALESCE((SELECT MAX(id) FROM farmops_invitations), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('farmops_subscription_addons', 'id'), COALESCE((SELECT MAX(id) FROM farmops_subscription_addons), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('farmops_sms_messages', 'id'), COALESCE((SELECT MAX(id) FROM farmops_sms_messages), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('animals', 'id'), COALESCE((SELECT MAX(id) FROM animals), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('daily_egg_collection', 'id'), COALESCE((SELECT MAX(id) FROM daily_egg_collection), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('egg_inventory_lots', 'id'), COALESCE((SELECT MAX(id) FROM egg_inventory_lots), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('egg_inventory_adjustments', 'id'), COALESCE((SELECT MAX(id) FROM egg_inventory_adjustments), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('flock_events', 'id'), COALESCE((SELECT MAX(id) FROM flock_events), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('expenses', 'id'), COALESCE((SELECT MAX(id) FROM expenses), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('inventory_allocations', 'id'), COALESCE((SELECT MAX(id) FROM inventory_allocations), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('contact_submissions', 'id'), COALESCE((SELECT MAX(id) FROM contact_submissions), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('notify_me', 'id'), COALESCE((SELECT MAX(id) FROM notify_me), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('stripe_pending_checkouts', 'id'), COALESCE((SELECT MAX(id) FROM stripe_pending_checkouts), 0) + 1, false);
SELECT setval(pg_get_serial_sequence('platform_admin_audit_logs', 'id'), COALESCE((SELECT MAX(id) FROM platform_admin_audit_logs), 0) + 1, false);