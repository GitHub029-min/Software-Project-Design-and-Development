CREATE DATABASE IF NOT EXISTS bloomverse CHARACTER SET utf8mb4;
USE bloomverse;
CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(80) NOT NULL,email VARCHAR(120) UNIQUE NOT NULL,password VARCHAR(255) NOT NULL,role ENUM('admin','user','rider') DEFAULT 'user',on_shift TINYINT DEFAULT 0);
CREATE TABLE products(id INT AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL,category ENUM('Plants','Seeds','Fertilizers','Flowers','Tools') NOT NULL,price DECIMAL(8,2) NOT NULL,stock INT DEFAULT 0,eco TINYINT DEFAULT 0,active TINYINT DEFAULT 1);
CREATE TABLE reviews(id INT AUTO_INCREMENT PRIMARY KEY,product_id INT,user_id INT,rating TINYINT,comment VARCHAR(300),flagged TINYINT DEFAULT 0,FOREIGN KEY(product_id) REFERENCES products(id),FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE orders(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,cust_name VARCHAR(80),phone VARCHAR(20),address VARCHAR(255),area VARCHAR(40),lat DOUBLE,lng DOUBLE,total DECIMAL(9,2),status ENUM('Placed','Out for delivery','Delivered') DEFAULT 'Placed',rider_id INT NULL,created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,delivered_at DATETIME NULL,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE order_items(order_id INT,product_id INT,qty INT,price DECIMAL(8,2),FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(product_id) REFERENCES products(id));
CREATE TABLE swap_posts(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,title VARCHAR(100),type ENUM('Free adoption','Swap'),area VARCHAR(40),photo MEDIUMTEXT,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE swap_interests(post_id INT,user_id INT,PRIMARY KEY(post_id,user_id));
CREATE TABLE health_logs(id INT AUTO_INCREMENT PRIMARY KEY,user_id INT,health_index INT,issue VARCHAR(120),created TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
INSERT INTO products(name,category,price,stock,eco) VALUES
('Spider plant','Plants',450,20,0),('Money plant','Plants',300,30,0),('Bonsai plant','Plants',250,25,0),('Cactus plant','Plants',520,12,0),
('Lemon seeds','Seeds',80,100,1),('Tulsi seeds','Seeds',60,100,1),('Chili seeds','Seeds',70,100,1),('Combo seeds','Seeds',50,100,1),
('Plant booster','Fertilizers',150,50,1),('Organic compost','Fertilizers',220,40,0),('Grass grows','Fertilizers',130,40,1),('Combo','Fertilizers',180,30,1),
('Rose','Flowers',380,15,0),('Plumeria','Flowers',120,40,0),('Sunflower','Flowers',900,8,0),('Lily','Flowers',340,18,0),
('Trowel','Tools',350,15,0),('Fork','Tools',650,10,0),('Watering can','Tools',420,20,0),('Gloves','Tools',250,25,0);
-- test rider account: rider@bloomverse.com / rider123
INSERT INTO users(name,email,password,role) VALUES('Test Rider','rider@bloomverse.com','$2y$10$FO1xDHsNve3gD.GL3OFx..AGTClH1A50yiuy1HqnEXbg1.xFDD2.2','rider');
