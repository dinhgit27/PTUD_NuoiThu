"""
Generates 2D Pixel Art Environment Backgrounds for the Shared Garden.
"""

import os
from PIL import Image, ImageDraw

def create_pixel_backgrounds(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    w, h = 640, 360 # Standard 16:9 pixel art canvas
    
    # 1. Khu Vườn Mùa Xuân (Spring Garden)
    img1 = Image.new("RGB", (w, h), (135, 206, 235))
    d1 = ImageDraw.Draw(img1)
    # Sky gradient
    for y in range(180):
        r = int(140 + y * 0.4)
        g = int(210 + y * 0.2)
        b = int(245 - y * 0.2)
        d1.line([(0, y), (w, y)], fill=(r, g, b))
    # Mountains
    d1.polygon([(0, 200), (120, 140), (260, 210), (0, 210)], fill=(120, 160, 150))
    d1.polygon([(200, 210), (380, 130), (520, 210), (200, 210)], fill=(100, 145, 135))
    # Hills & Grass
    d1.rectangle([0, 190, w, h], fill=(88, 170, 95))
    d1.rectangle([0, 240, w, h], fill=(72, 148, 80))
    d1.rectangle([0, 300, w, h], fill=(58, 128, 68))
    # Cobblestone path
    for py in range(210, h, 6):
        pw = int(40 + (py - 210) * 0.8)
        px = w // 2 - pw // 2
        d1.rectangle([px, py, px + pw, py + 4], fill=(180, 175, 160))
    # Cherry Blossom Trees
    for tx in (90, 520):
        d1.rectangle([tx - 8, 160, tx + 8, 250], fill=(95, 60, 40))
        d1.ellipse([tx - 50, 100, tx + 50, 180], fill=(255, 180, 200))
        d1.ellipse([tx - 35, 110, tx + 35, 165], fill=(255, 205, 220))
    # Flower patches
    for fx in range(30, w - 30, 25):
        fy = 260 + (fx % 40)
        d1.rectangle([fx, fy, fx + 4, fy + 4], fill=(255, 110, 130) if fx % 2 == 0 else (255, 225, 80))
    img1.save(os.path.join(out_dir, "garden_spring.png"))
    
    # 2. Quán Cafe Pixel Ban Đêm (Night Cozy Cafe)
    img2 = Image.new("RGB", (w, h), (30, 25, 40))
    d2 = ImageDraw.Draw(img2)
    # Warm interior wall
    d2.rectangle([0, 0, w, 220], fill=(65, 45, 55))
    # Wooden floor
    for fy in range(220, h, 14):
        d2.rectangle([0, fy, w, fy + 12], fill=(120 - (fy//25)*3, 75 - (fy//30)*2, 45))
        d2.line([(0, fy), (w, fy)], fill=(45, 28, 18), width=1)
    # Cozy Window looking at starry night
    d2.rectangle([180, 40, 460, 180], fill=(18, 22, 45), outline=(140, 100, 70), width=4)
    d2.line([(320, 40), (320, 180)], fill=(140, 100, 70), width=2)
    d2.line([(180, 110), (460, 110)], fill=(140, 100, 70), width=2)
    # Stars in window
    for sx, sy in [(210, 60), (250, 90), (300, 70), (370, 80), (410, 60), (430, 100)]:
        d2.point((sx, sy), fill=(255, 255, 200))
    # Warm pendant lights
    for lx in (100, 540):
        d2.line([(lx, 0), (lx, 50)], fill=(80, 70, 70), width=2)
        d2.polygon([(lx - 15, 65), (lx, 48), (lx + 15, 65)], fill=(250, 180, 50))
        d2.ellipse([lx - 30, 55, lx + 30, 110], fill=(255, 230, 150, 60))
    # Bookshelves and counter
    d2.rectangle([20, 90, 140, 220], fill=(85, 55, 40), outline=(45, 30, 20), width=2)
    d2.rectangle([500, 120, 620, 220], fill=(85, 55, 40), outline=(45, 30, 20), width=2)
    img2.save(os.path.join(out_dir, "cafe_cozy.png"))

    # 3. Phòng Làm Việc Cây Xanh (Zen Office Workspace)
    img3 = Image.new("RGB", (w, h), (240, 240, 235))
    d3 = ImageDraw.Draw(img3)
    # Wall panels
    d3.rectangle([0, 0, w, 230], fill=(225, 235, 230))
    # Parquet Floor
    for fy in range(230, h, 12):
        d3.rectangle([0, fy, w, fy + 10], fill=(185, 145, 110))
    # Big Sunlit Glass Window
    d3.rectangle([100, 30, 540, 200], fill=(210, 238, 250), outline=(160, 170, 175), width=3)
    # Clouds outside
    d3.ellipse([160, 60, 240, 90], fill=(255, 255, 255))
    d3.ellipse([340, 75, 430, 105], fill=(255, 255, 255))
    # Green potted plants
    for px in (50, 580):
        d3.rectangle([px - 14, 210, px + 14, 255], fill=(180, 90, 60), outline=(90, 45, 30))
        d3.ellipse([px - 30, 140, px + 30, 220], fill=(65, 145, 75))
        d3.ellipse([px - 20, 150, px + 20, 200], fill=(95, 185, 105))
    img3.save(os.path.join(out_dir, "office_zen.png"))

    # 4. Bãi Biển Hoàng Hôn Pixel (Pixel Sunset Beach)
    img4 = Image.new("RGB", (w, h), (255, 140, 90))
    d4 = ImageDraw.Draw(img4)
    # Sunset sky gradient
    for y in range(200):
        r = int(255 - y * 0.4)
        g = int(120 + y * 0.3)
        b = int(100 + y * 0.5)
        d4.line([(0, y), (w, y)], fill=(r, g, b))
    # Big Pixel Sun
    d4.ellipse([w//2 - 40, 120, w//2 + 40, 200], fill=(255, 240, 130))
    # Ocean water
    for y in range(200, 270):
        d4.line([(0, y), (w, y)], fill=(70 + (y-200)*2, 90 + (y-200)*2, 170 + (y-200)))
    # Sand beach
    for y in range(270, h):
        d4.line([(0, y), (w, y)], fill=(235 - (y-270), 205 - (y-270), 140 - (y-270)))
    # Palm Tree Silhouette
    d4.rectangle([80, 170, 88, 280], fill=(50, 40, 45))
    d4.polygon([(20, 150), (84, 170), (70, 130)], fill=(45, 60, 45))
    d4.polygon([(140, 150), (84, 170), (100, 130)], fill=(45, 60, 45))
    img4.save(os.path.join(out_dir, "beach_sunset.png"))

    print("Successfully generated 4 pixel-art garden backgrounds.")

if __name__ == "__main__":
    create_pixel_backgrounds("public/backgrounds")
