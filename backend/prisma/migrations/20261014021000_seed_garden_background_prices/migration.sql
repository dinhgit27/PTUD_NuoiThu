UPDATE "garden_backgrounds"
SET "exp_price" = CASE "name"
    WHEN 'Khu Vườn Mùa Xuân' THEN 0
    WHEN 'Quán Cafe Pixel Ban Đêm' THEN 80
    WHEN 'Phòng Làm Việc Cây Xanh' THEN 100
    WHEN 'Bãi Biển Hoàng Hôn Pixel' THEN 120
END
WHERE "name" IN (
    'Khu Vườn Mùa Xuân',
    'Quán Cafe Pixel Ban Đêm',
    'Phòng Làm Việc Cây Xanh',
    'Bãi Biển Hoàng Hôn Pixel'
);
