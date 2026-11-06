CREATE DATABASE IF NOT EXISTS campus_lost_found
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE campus_lost_found;

CREATE TABLE IF NOT EXISTS found_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind VARCHAR(10) NOT NULL DEFAULT 'found',
  title VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  photo_path VARCHAR(255) NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO found_items (kind, title, category, description, latitude, longitude) VALUES
('found', 'Blue umbrella', 'Clothing', 'Left on a bench near the covered walk.', 14.5995123, 120.9842222),
('found', 'Student ID card', 'ID', 'Found by the library entrance. The name is worn off.', 14.5998123, 120.9845122),
('found', 'USB charger', 'Electronics', 'White cable, found in the study area.', 14.5992123, 120.9839122),
('lost', 'Black wallet', 'Other', 'Last seen in the cafeteria after lunch.', 14.5996000, 120.9843000);
