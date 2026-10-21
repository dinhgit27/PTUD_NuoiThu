"""
Smart Background Remover & Defringer for 2D Pixel Art and Sprites.
Uses OpenCV multi-seed floodfilling, tolerance matching, and edge-matting defringe.
"""
import os
import sys
import argparse
import cv2
import numpy as np
from PIL import Image

def smart_remove_background(pil_image, tolerance=28, defringe=True, is_sprite_sheet=False, rows=17, cols=4):
    """
    High-precision background removal for pixel art, sprites, and item icons.
    Preserves character interior colors (like white eyes, white fur) while clearing
    all exterior and inter-frame background areas.
    """
    img = np.array(pil_image.convert('RGBA'))
    h, w = img.shape[:2]
    if h < 2 or w < 2:
        return pil_image
    
    rgb = img[:, :, :3]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    alpha = img[:, :, 3].copy()
    
    # Check if image is already predominantly transparent (e.g., > 50% transparent)
    trans_count = np.count_nonzero(alpha < 10)
    total_pixels = h * w
    if trans_count > total_pixels * 0.4:
        # Image is already mostly transparent. Only clean up stray white border noise if any
        return pil_image

    # Sample corners to determine background color
    corner_samples = [
        bgr[0, 0], bgr[0, w-1], bgr[h-1, 0], bgr[h-1, w-1],
        bgr[min(4, h-1), min(4, w-1)], bgr[min(4, h-1), max(0, w-5)],
        bgr[max(0, h-5), min(4, w-1)], bgr[max(0, h-5), max(0, w-5)]
    ]
    bg_color = np.median(corner_samples, axis=0).astype(np.uint8)
    
    # Background must be relatively light or clear; if corners are pure black/color, still sample
    mask = np.zeros((h + 2, w + 2), np.uint8)
    
    seeds = set()
    # 4 corners
    seeds.add((0, 0))
    seeds.add((w - 1, 0))
    seeds.add((0, h - 1))
    seeds.add((w - 1, h - 1))
    
    # Perimeter seeds
    step_x = max(1, w // 25)
    step_y = max(1, h // 35)
    for x in range(0, w, step_x):
        seeds.add((x, 0))
        seeds.add((x, h - 1))
    for y in range(0, h, step_y):
        seeds.add((0, y))
        seeds.add((w - 1, y))
        
    # If sprite sheet, add seeds along cell grid lines
    if is_sprite_sheet and rows > 1 and cols > 1:
        cell_h = h / rows
        cell_w = w / cols
        for r in range(rows + 1):
            y = min(h - 1, max(0, int(r * cell_h)))
            for c in range(cols + 1):
                x = min(w - 1, max(0, int(c * cell_w)))
                diff = np.max(np.abs(bgr[y, x].astype(np.int32) - bg_color.astype(np.int32)))
                if diff <= tolerance + 12:
                    seeds.add((x, y))

    flags = 4 | (255 << 8) | cv2.FLOODFILL_FIXED_RANGE | cv2.FLOODFILL_MASK_ONLY
    lo_diff = (tolerance, tolerance, tolerance)
    up_diff = (tolerance, tolerance, tolerance)
    
    for sx, sy in seeds:
        if mask[sy + 1, sx + 1] == 0:
            diff = np.max(np.abs(bgr[sy, sx].astype(np.int32) - bg_color.astype(np.int32)))
            if diff <= tolerance + 15:
                cv2.floodFill(bgr, mask, (sx, sy), 0, lo_diff, up_diff, flags)
                
    bg_mask = (mask[1:h+1, 1:w+1] == 255)
    
    # Catch larger enclosed white background gaps that are surrounded by borders
    color_diff = np.max(np.abs(bgr.astype(np.int32) - bg_color.astype(np.int32)), axis=2)
    candidate_bg = (color_diff <= int(tolerance * 0.85))
    
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(candidate_bg.astype(np.uint8))
    for label in range(1, num_labels):
        area = stats[label, cv2.CC_STAT_AREA]
        touches_border = (
            stats[label, cv2.CC_STAT_LEFT] == 0 or
            stats[label, cv2.CC_STAT_TOP] == 0 or
            stats[label, cv2.CC_STAT_LEFT] + stats[label, cv2.CC_STAT_WIDTH] >= w or
            stats[label, cv2.CC_STAT_TOP] + stats[label, cv2.CC_STAT_HEIGHT] >= h
        )
        # Trapped background spaces (between limbs/frames) are typically >= 25 px
        if touches_border or area >= 25:
            bg_mask[labels == label] = True

    # Set background to 0 alpha
    alpha[bg_mask] = 0
    
    # Defringe / Anti-halo: Remove white halos along the outline
    if defringe:
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dilated_bg = cv2.dilate(bg_mask.astype(np.uint8), kernel, iterations=1)
        edge_pixels = (dilated_bg == 1) & (~bg_mask) & (alpha > 0)
        
        if np.any(edge_pixels):
            bg_lum = np.mean(bg_color)
            if bg_lum > 210: # Background is light / white
                edge_lum = np.mean(rgb[edge_pixels], axis=1)
                high_lum_mask = edge_lum > 175
                if np.any(high_lum_mask):
                    edge_indices = np.where(edge_pixels)
                    sel = (edge_indices[0][high_lum_mask], edge_indices[1][high_lum_mask])
                    darken_factor = np.clip(1.0 - (edge_lum[high_lum_mask] - 175.0) / 100.0 * 0.45, 0.55, 1.0)
                    for c in range(3):
                        rgb[sel[0], sel[1], c] = (rgb[sel[0], sel[1], c] * darken_factor).astype(np.uint8)

    img[:, :, :3] = rgb
    img[:, :, 3] = alpha
    return Image.fromarray(img, 'RGBA')

def process_file(input_path, output_path=None, tolerance=28, is_sheet=False, rows=17, cols=4):
    if not output_path:
        output_path = os.path.splitext(input_path)[0] + '.png'
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with Image.open(input_path) as src:
        result = smart_remove_background(src, tolerance=tolerance, defringe=True, is_sprite_sheet=is_sheet, rows=rows, cols=cols)
        result.save(output_path, 'PNG')
    return output_path

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Smart Background Remover for Pixel Art & Sprites')
    parser.add_argument('--input', required=True, help='Path to input image')
    parser.add_argument('--output', help='Path to output PNG')
    parser.add_argument('--tolerance', type=int, default=28, help='Color difference tolerance (default: 28)')
    parser.add_argument('--is-sheet', action='store_true', help='Treat image as a multi-frame sprite sheet')
    parser.add_argument('--rows', type=int, default=17, help='Number of rows if sprite sheet')
    parser.add_argument('--cols', type=int, default=4, help='Number of columns if sprite sheet')
    args = parser.parse_args()

    out = process_file(args.input, args.output, args.tolerance, args.is_sheet, args.rows, args.cols)
    print(f"SUCCESS:{out}")
