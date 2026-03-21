-- ============================================================
-- 🐥 덕행 대량 더미 데이터 (N+1 차이 극대화용)
-- 유저 50명 / 게시글 5,000건 / 리뷰 2,000건
-- ============================================================

-- 1. 유저 50명
DROP PROCEDURE IF EXISTS insert_users;
DELIMITER //
CREATE PROCEDURE insert_users()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 50 DO
        INSERT INTO user (uuid, nickname, name, profile_image_url, phone_number, address, email, scope)
        VALUES (
            UNHEX(LPAD(HEX(i), 32, '0')),
            CONCAT('덕행유저', LPAD(i, 3, '0')),
            CONCAT('테스터', i),
            'https://via.placeholder.com/150',
            CONCAT('0101234', LPAD(i, 4, '0')),
            ELT(1 + (i % 5), '서울시 강남구', '부산시 해운대구', '대구시 수성구', '인천시 남동구', '경기도 성남시'),
            CONCAT('user', i, '@test.com'),
            0.0
        );
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_users();
DROP PROCEDURE insert_users;

-- 2. SELL 게시글 1000개
DROP PROCEDURE IF EXISTS insert_sell_boards;
DELIMITER //
CREATE PROCEDURE insert_sell_boards()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE board_id BIGINT;
    WHILE i <= 1000 DO
        INSERT INTO board (author_uuid, title, content, image_url, board_type, created_at)
        VALUES (
            UNHEX(LPAD(HEX(1 + (i % 50)), 32, '0')),
            CONCAT(ELT(1 + (i % 10), 'BTS 뷔 포카', 'NCT 마크 앨범', '세븐틴 포토북', 'aespa 카리나 굿즈', 'IVE 장원영 슬로건', 'BLACKPINK 제니 키링', 'TWICE 나연 시즌그리팅', 'ITZY 예지 브로마이드', 'Stray Kids 현진 포스터', 'LE SSERAFIM 카즈하 응원봉'), ' 판매 #', i),
            CONCAT('상태 좋습니다. 직거래/택배 모두 가능. 가격 협의 가능합니다. 문의는 채팅으로! 번호: ', i),
            'https://via.placeholder.com/300',
            'SELL',
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
        );
        SET board_id = LAST_INSERT_ID();
        INSERT INTO sell (board_id, price) VALUES (board_id, 5000 + FLOOR(RAND() * 95000));
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_sell_boards();
DROP PROCEDURE insert_sell_boards;

-- 3. PURCHASE 게시글 800개
DROP PROCEDURE IF EXISTS insert_purchase_boards;
DELIMITER //
CREATE PROCEDURE insert_purchase_boards()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE board_id BIGINT;
    WHILE i <= 800 DO
        INSERT INTO board (author_uuid, title, content, image_url, board_type, created_at)
        VALUES (
            UNHEX(LPAD(HEX(1 + (i % 50)), 32, '0')),
            CONCAT(ELT(1 + (i % 8), 'NCT 해찬 앨범', 'BTS 정국 포카', '세븐틴 디노 포토북', 'aespa 윈터 굿즈', 'IVE 안유진 키링', 'TWICE 사나 슬로건', 'Stray Kids 방찬 포스터', 'ITZY 류진 브로마이드'), ' 구매 원해요 #', i),
            CONCAT('깨끗한 상태 원합니다. 가격 제시해주세요. 번호: ', i),
            'https://via.placeholder.com/300',
            'PURCHASE',
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
        );
        SET board_id = LAST_INSERT_ID();
        INSERT INTO purchase (board_id, price) VALUES (board_id, 3000 + FLOOR(RAND() * 47000));
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_purchase_boards();
DROP PROCEDURE insert_purchase_boards;

-- 4. RENTAL 게시글 700개
DROP PROCEDURE IF EXISTS insert_rental_boards;
DELIMITER //
CREATE PROCEDURE insert_rental_boards()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE board_id BIGINT;
    WHILE i <= 700 DO
        INSERT INTO board (author_uuid, title, content, image_url, board_type, created_at)
        VALUES (
            UNHEX(LPAD(HEX(1 + (i % 50)), 32, '0')),
            CONCAT(ELT(1 + (i % 6), '슬로건', '응원봉', '콘서트 의상', '포토북', '시즌그리팅', '캘린더'), ' 대여 가능 #', i),
            CONCAT('깨끗한 상태로 대여해드립니다. 보증금 필요. 번호: ', i),
            'https://via.placeholder.com/300',
            'RENTAL',
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
        );
        SET board_id = LAST_INSERT_ID();
        INSERT INTO rental (board_id, price, deposit) VALUES (board_id, 5000 + FLOOR(RAND() * 25000), 10000 + FLOOR(RAND() * 40000));
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_rental_boards();
DROP PROCEDURE insert_rental_boards;

-- 5. EXCHANGE 게시글 800개
DROP PROCEDURE IF EXISTS insert_exchange_boards;
DELIMITER //
CREATE PROCEDURE insert_exchange_boards()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 800 DO
        INSERT INTO board (author_uuid, title, content, image_url, board_type, created_at)
        VALUES (
            UNHEX(LPAD(HEX(1 + (i % 50)), 32, '0')),
            CONCAT(ELT(1 + (i % 7), '뷔 포카', '지민 포카', '정국 포카', 'RM 포카', '마크 포카', '해찬 포카', '재민 포카'), ' 교환 원합니다 #', i),
            CONCAT('교환 원하는 멤버 있으시면 연락주세요. 번호: ', i),
            'https://via.placeholder.com/300',
            'EXCHANGE',
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
        );
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_exchange_boards();
DROP PROCEDURE insert_exchange_boards;

-- 6. DELEGATE / HELPER / MATE 게시글 각 약 550개 (총 1700개)
DROP PROCEDURE IF EXISTS insert_other_boards;
DELIMITER //
CREATE PROCEDURE insert_other_boards()
BEGIN
    DECLARE i INT DEFAULT 1;
    WHILE i <= 1700 DO
        INSERT INTO board (author_uuid, title, content, image_url, board_type, created_at)
        VALUES (
            UNHEX(LPAD(HEX(1 + (i % 50)), 32, '0')),
            CONCAT(ELT(1 + (i % 5), '콘서트 대리구매', '팝업스토어 대리', '생일카페 도우미', '총공 도우미', '콘서트 동행'), ' 구합니다 #', i),
            CONCAT('자세한 내용은 채팅으로 문의주세요. 번호: ', i),
            'https://via.placeholder.com/300',
            ELT(1 + (i % 3), 'DELEGATE', 'HELPER', 'MATE'),
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 180) DAY)
        );
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_other_boards();
DROP PROCEDURE insert_other_boards;

-- 7. 리뷰 2000개
DROP PROCEDURE IF EXISTS insert_reviews;
DELIMITER //
CREATE PROCEDURE insert_reviews()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE writer INT;
    DECLARE target INT;
    WHILE i <= 2000 DO
        SET writer = 1 + (i % 50);
        SET target = 1 + ((i + 1) % 50);
        INSERT INTO review (author_id, target_id, scope, content, order_id, created_at)
        VALUES (
            UNHEX(LPAD(HEX(writer), 32, '0')),
            UNHEX(LPAD(HEX(target), 32, '0')),
            ELT(1 + (i % 9), 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5),
            ELT(1 + (i % 10), '친절하고 빠른 거래 감사합니다!', '포장이 꼼꼼해서 좋았어요.', '상태가 설명과 같아서 만족합니다.', '약속 시간 잘 지켜주셔서 감사합니다.', '다음에도 거래하고 싶어요!', '응답이 빨라서 편했어요.', '사진과 실물이 같아서 좋았습니다.', '택배도 빠르게 보내주셨어요.', '가격도 합리적이고 좋았습니다.', '추천합니다! 좋은 거래였어요.'),
            CONCAT('ORDER-', LPAD(i, 6, '0')),
            DATE_SUB(NOW(), INTERVAL FLOOR(RAND() * 90) DAY)
        );
        SET i = i + 1;
    END WHILE;
END //
DELIMITER ;
CALL insert_reviews();
DROP PROCEDURE insert_reviews;

-- 8. 확인
SELECT 'user' AS tbl, COUNT(*) AS cnt FROM user
UNION ALL SELECT 'board', COUNT(*) FROM board
UNION ALL SELECT 'sell', COUNT(*) FROM sell
UNION ALL SELECT 'purchase', COUNT(*) FROM purchase
UNION ALL SELECT 'rental', COUNT(*) FROM rental
UNION ALL SELECT 'review', COUNT(*) FROM review;
