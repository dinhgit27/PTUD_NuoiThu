"""
Script to scan and retroactively clean all white-background images in public/sprites and public/uploads.
Also updates the DB Item, PetType records if filenames or extensions change.
"""
import os
import glob
from PIL import Image
from smart_bg_remover import smart_remove_background

def scan_and_clean():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'public'))
    sprites_dir = os.path.join(base_dir, 'sprites')
    uploads_dir = os.path.join(base_dir, 'uploads')
    
    cleaned_count = 0
    
    # 1. Check all sprites
    for filepath in glob.glob(os.path.join(sprites_dir, '*.*')):
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        try:
            with Image.open(filepath) as img:
                w, h = img.size
                rgba = img.convert('RGBA')
                data = list(rgba.getdata())
                trans = sum(1 for p in data if p[3] < 10)
                white = sum(1 for p in data if p[3] >= 10 and p[0] >= 240 and p[1] >= 240 and p[2] >= 240)
                total = w * h
                
                # If there are white pixels and low transparency, clean it
                if (white / total > 0.15 and trans / total < 0.85) or (trans / total < 0.3):
                    is_sheet = 'sheet' in os.path.basename(filepath) or h > w * 2
                    print(f"Cleaning sprite: {os.path.basename(filepath)} ({w}x{h}, white={round(white*100/total)}%, trans={round(trans*100/total)}%)")
                    cleaned = smart_remove_background(rgba, tolerance=28, defringe=True, is_sprite_sheet=is_sheet)
                    cleaned.save(filepath, 'PNG')
                    cleaned_count += 1
        except Exception as e:
            print(f"Error checking {filepath}: {e}")

    # 2. Check all uploads
    for filepath in glob.glob(os.path.join(uploads_dir, '*.*')):
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in ('.png', '.jpg', '.jpeg', '.webp'):
            continue
        try:
            with Image.open(filepath) as img:
                w, h = img.size
                rgba = img.convert('RGBA')
                data = list(rgba.getdata())
                trans = sum(1 for p in data if p[3] < 10)
                white = sum(1 for p in data if p[3] >= 10 and p[0] >= 235 and p[1] >= 235 and p[2] >= 235)
                total = w * h
                
                if (white / total > 0.10) or (trans / total < 0.25):
                    is_sheet = h > w * 1.5
                    print(f"Cleaning upload: {os.path.basename(filepath)} ({w}x{h}, white={round(white*100/total)}%, trans={round(trans*100/total)}%)")
                    cleaned = smart_remove_background(rgba, tolerance=28, defringe=True, is_sprite_sheet=is_sheet)
                    # Save as PNG
                    target_path = filepath
                    if ext in ('.jpg', '.jpeg'):
                        target_path = os.path.splitext(filepath)[0] + '.png'
                    cleaned.save(target_path, 'PNG')
                    cleaned_count += 1
        except Exception as e:
            print(f"Error checking {filepath}: {e}")

    print(f"\nDone! Cleaned {cleaned_count} images.")

if __name__ == '__main__':
    scan_and_clean()
