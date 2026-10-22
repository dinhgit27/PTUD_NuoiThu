import os
import sys
import json
import argparse
from PIL import Image, ImageSequence
import numpy as np
from collections import deque

ALL_ACTIONS = [
    ("IDLE", 6, 6, True),
    ("SLEEPING", 4, 4, True),
    ("HUNGRY", 4, 4, True),
    ("EATING", 6, 6, True),
    ("YAWNING", 5, 5, False),
    ("WAKING_UP", 6, 6, False),
    ("TYPING", 4, 8, True),
    ("EXERCISING", 8, 8, True),
    ("DRINKING", 4, 4, True),
    ("PETTING", 5, 5, False),
    ("WAVING", 4, 6, True),
    ("DANCING", 8, 8, True),
    ("THANKING", 4, 6, False),
    ("HAPPY", 4, 8, True),
    ("SAD", 5, 4, False),
    ("CELEBRATING", 6, 8, False),
    ("EVOLVING", 12, 10, False),
]

def remove_solid_border_bg(im, tolerance=25):
    """
    Flood-fills from all image borders to make solid white or grey background transparent.
    Does not touch internal character pixels.
    """
    arr = np.array(im.convert("RGBA"))
    h, w = arr.shape[:2]
    if h < 4 or w < 4:
        return im

    corners = [arr[0, 0], arr[0, w-1], arr[h-1, 0], arr[h-1, w-1]]
    if all(c[3] > 200 for c in corners):
        bg_color = np.median([c[:3] for c in corners], axis=0)
        # Check if background is reasonably light or neutral
        visited = np.zeros((h, w), dtype=bool)
        q = deque()
        for x in range(w):
            q.append((0, x))
            q.append((h - 1, x))
        for y in range(h):
            q.append((y, 0))
            q.append((y, w - 1))

        while q:
            y, x = q.popleft()
            if visited[y, x]:
                continue
            visited[y, x] = True
            diff = np.linalg.norm(arr[y, x, :3].astype(float) - bg_color)
            if diff <= tolerance:
                arr[y, x, 3] = 0
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                        q.append((ny, nx))
        return Image.fromarray(arr)
    return im

def extract_frames_from_file(file_path, slice_config=None, remove_bg=True):
    """
    Extracts frames from an animated GIF, animated WEBP, sprite strip, 2D sprite sheet grid, or static image.
    slice_config can be:
      - dict: {"cols": int, "rows": int, "startFrame": int, "endFrame": int, "frames": int}
      - int: number of horizontal frames (shorthand for cols=N, rows=1)
      - None: automatic detection based on aspect ratio
    Returns list of PIL RGBA Images.
    """
    if not os.path.exists(file_path):
        return []

    im = Image.open(file_path)
    frames = []

    is_animated = getattr(im, "is_animated", False)
    n_frames = getattr(im, "n_frames", 1)

    # If it is an animated GIF or animated WEBP
    if is_animated and n_frames > 1 and not (isinstance(slice_config, dict) and (slice_config.get("cols", 1) > 1 or slice_config.get("rows", 1) > 1)):
        try:
            for frame in ImageSequence.Iterator(im):
                f = frame.convert("RGBA")
                if remove_bg:
                    f = remove_solid_border_bg(f)
                frames.append(f.copy())
            if frames:
                return frames
        except Exception:
            pass

    rgba = im.convert("RGBA")
    if remove_bg:
        rgba = remove_solid_border_bg(rgba)

    w, h = rgba.size

    # Check if specific cell indices are selected
    if isinstance(slice_config, dict) and slice_config.get("selectedCells") and len(slice_config["selectedCells"]) > 0:
        cols = max(1, int(slice_config.get("cols", 1)))
        rows = max(1, int(slice_config.get("rows", 1)))
        tile_w = w / cols
        tile_h = h / rows
        total_cells = cols * rows
        for idx in slice_config["selectedCells"]:
            if 0 <= idx < total_cells:
                r = idx // cols
                c = idx % cols
                x0 = int(round(c * tile_w))
                y0 = int(round(r * tile_h))
                x1 = int(round((c + 1) * tile_w))
                y1 = int(round((r + 1) * tile_h))
                frames.append(rgba.crop((x0, y0, x1, y1)))
        if frames:
            return frames

    # Parse slice_config (Grid or Strip)
    cols = 1
    rows = 1
    start_frame = 1
    end_frame = None

    if isinstance(slice_config, dict):
        cols = max(1, int(slice_config.get("cols", 1)))
        rows = max(1, int(slice_config.get("rows", 1)))
        start_frame = max(1, int(slice_config.get("startFrame", 1)))
        end_val = slice_config.get("endFrame") or slice_config.get("frames")
        if end_val is not None:
            end_frame = max(start_frame, int(end_val))
    elif isinstance(slice_config, (int, str)):
        try:
            val = int(slice_config)
            if val > 1:
                cols = val
                rows = 1
                start_frame = 1
                end_frame = val
            elif val == 1:
                return [rgba]
        except Exception:
            pass
    else:
        # Automatic universal grid detector
        if w >= 1.8 * h:
            ratio = round(w / h)
            if 2 <= ratio <= 16:
                cols = min(12, ratio)
                rows = 1
                start_frame = 1
                end_frame = cols
        else:
            best_layout = None
            best_score = -999.0
            for r in range(1, 9):
                th = h / r
                if th < 28:
                    continue
                for c in range(1, 17):
                    tw = w / c
                    if tw < 28:
                        continue
                    ratio = tw / th
                    if 0.65 <= ratio <= 1.45:
                        score = 10.0 - abs(1.0 - ratio) * 5.0
                        if w % c == 0 and h % r == 0:
                            score += 3.0
                        if score > best_score:
                            best_score = score
                            best_layout = (c, r)
            if best_layout and (best_layout[0] * best_layout[1]) > 1:
                cols, rows = best_layout
                start_frame = 1
                end_frame = cols * rows

    total_cells = cols * rows
    if end_frame is None:
        end_frame = total_cells
    else:
        end_frame = min(total_cells, end_frame)

    if total_cells > 1:
        tile_w = w / cols
        tile_h = h / rows
        for idx in range(start_frame - 1, end_frame):
            r = idx // cols
            c = idx % cols
            x0 = int(round(c * tile_w))
            y0 = int(round(r * tile_h))
            x1 = int(round((c + 1) * tile_w))
            y1 = int(round((r + 1) * tile_h))
            cell = rgba.crop((x0, y0, x1, y1))

            # Auto-skip empty/transparent cell if not single frame
            arr = np.array(cell)
            if arr.shape[2] >= 4 and np.count_nonzero(arr[:, :, 3] > 10) < 30:
                continue
            frames.append(cell)
    else:
        frames.append(rgba)

    if not frames:
        frames.append(rgba)

    return frames

def generate_procedural_motion(base_frame, action_name, target_frames):
    """
    For static single-frame images, generates subtle breathing, typing, or dancing motion
    so the character feels alive and responsive in 2D pixel art.
    """
    w, h = base_frame.size
    frames = []

    if action_name in ["IDLE", "SLEEPING", "HUNGRY"]:
        # Gentle breathing motion (1px vertical bob)
        for i in range(target_frames):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset_y = -1 if (i % 2 == 1) else 0
            frame.paste(base_frame, (0, offset_y), base_frame)
            frames.append(frame)
    elif action_name in ["TYPING", "EXERCISING"]:
        # Quick typing / working bob
        for i in range(target_frames):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset_x = 1 if i % 2 == 1 else -1
            frame.paste(base_frame, (offset_x, 0), base_frame)
            frames.append(frame)
    elif action_name in ["DANCING", "HAPPY", "CELEBRATING"]:
        # Bouncy joyous rhythm
        for i in range(target_frames):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset_y = -2 if i in [1, 2] else 0
            offset_x = 1 if i in [2, 3] else -1
            frame.paste(base_frame, (offset_x, offset_y), base_frame)
            frames.append(frame)
    elif action_name == "EVOLVING":
        # Flashing glow / pulsing
        for i in range(target_frames):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset_y = -1 if (i % 2 == 1) else 0
            frame.paste(base_frame, (0, offset_y), base_frame)
            frames.append(frame)
    else:
        # Default subtle 1px pulse
        for i in range(target_frames):
            frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            offset_y = -1 if (i % 3 == 1) else 0
            frame.paste(base_frame, (0, offset_y), base_frame)
            frames.append(frame)

    return frames

def fit_to_tile(frame, tile_size):
    """
    Centers and fits an image into a (tile_size, tile_size) canvas, preserving pixel crispness.
    """
    w, h = frame.size
    if w == tile_size and h == tile_size:
        return frame

    # Scale proportionally if larger than tile_size
    scale = min(tile_size / max(1, w), tile_size / max(1, h))
    if scale < 1.0 or (w <= tile_size // 2 and h <= tile_size // 2):
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        scaled = frame.resize((new_w, new_h), Image.Resampling.NEAREST)
    else:
        scaled = frame
        new_w, new_h = scaled.size

    tile = Image.new("RGBA", (tile_size, tile_size), (0, 0, 0, 0))
    paste_x = (tile_size - new_w) // 2
    paste_y = tile_size - new_h  # Align to bottom for characters standing on ground
    tile.paste(scaled, (paste_x, paste_y), scaled)
    return tile

def build_action_sprite_sheet(spec):
    name = spec.get("name", "custom_pet")
    output_dir = spec.get("outputDir", os.path.join(os.getcwd(), "public", "sprites"))
    os.makedirs(output_dir, exist_ok=True)

    actions_files = spec.get("actions", {})
    action_frame_counts = spec.get("actionFrameCounts", {})
    action_slice_configs = spec.get("actionSliceConfigs", {})
    remove_bg = spec.get("removeBackground", True)

    def get_slice_cfg(act_name):
        return action_slice_configs.get(act_name) or action_frame_counts.get(act_name)

    # 1. Inspect IDLE action to establish the base frame size
    idle_path = actions_files.get("IDLE")
    if not idle_path or not os.path.exists(idle_path):
        raise ValueError("Hành động IDLE là bắt buộc. Vui lòng tải lên ít nhất ảnh cho trạng thái IDLE.")

    idle_raw_frames = extract_frames_from_file(idle_path, slice_config=get_slice_cfg("IDLE"), remove_bg=remove_bg)
    if not idle_raw_frames:
        raise ValueError("Không thể đọc được ảnh từ file hành động IDLE.")

    base_idle_frame = idle_raw_frames[0]
    raw_w, raw_h = base_idle_frame.size

    # Target tile size: Keep 128 if uploaded is >= 96, else 64
    if max(raw_w, raw_h) >= 96:
        tile_size = 128
    else:
        tile_size = 64

    # Extract all action frames
    action_frames_map = {}
    for action_name, default_frames, fps, loop in ALL_ACTIONS:
        fpath = actions_files.get(action_name)
        cfg = get_slice_cfg(action_name)

        if fpath and os.path.exists(fpath):
            extracted = extract_frames_from_file(fpath, slice_config=cfg, remove_bg=remove_bg)
            if extracted:
                is_explicit_single = (isinstance(cfg, (int, str)) and int(cfg) == 1) or (isinstance(cfg, dict) and cfg.get("frames") == 1)
                if len(extracted) == 1 and default_frames > 1 and not is_explicit_single:
                    # Single static frame -> generate procedural subtle motion
                    extracted = generate_procedural_motion(extracted[0], action_name, default_frames)

                # If extracted has more than 12 frames, downsample evenly so all motions fit in 12 columns
                if len(extracted) > 12:
                    indices = np.linspace(0, len(extracted) - 1, 12).round().astype(int)
                    extracted = [extracted[i] for i in indices]

                action_frames_map[action_name] = [fit_to_tile(f, tile_size) for f in extracted]

    # Fallback for missing actions: use IDLE or related action
    if "IDLE" not in action_frames_map:
        if len(idle_raw_frames) == 1:
            idle_processed = generate_procedural_motion(idle_raw_frames[0], "IDLE", 6)
        elif len(idle_raw_frames) > 12:
            indices = np.linspace(0, len(idle_raw_frames) - 1, 12).round().astype(int)
            idle_processed = [idle_raw_frames[i] for i in indices]
        else:
            idle_processed = idle_raw_frames
        action_frames_map["IDLE"] = [fit_to_tile(f, tile_size) for f in idle_processed]

    base_idle_tiles = action_frames_map["IDLE"]

    for action_name, default_frames, fps, loop in ALL_ACTIONS:
        if action_name not in action_frames_map:
            # Fallback to smart counterpart or IDLE
            if action_name == "WAKING_UP" and "SLEEPING" in action_frames_map:
                source = action_frames_map["SLEEPING"]
            elif action_name == "PETTING" and "HAPPY" in action_frames_map:
                source = action_frames_map["HAPPY"]
            elif action_name == "THANKING" and "HAPPY" in action_frames_map:
                source = action_frames_map["HAPPY"]
            else:
                source = base_idle_tiles

            # Generate motion tailored for that action
            if len(source) == 1:
                borrowed = generate_procedural_motion(source[0], action_name, default_frames)
            else:
                borrowed = [f.copy() for f in source]
                # Repeat or trim to default_frames
                while len(borrowed) < default_frames:
                    borrowed.append(borrowed[len(borrowed) % len(source)].copy())
                borrowed = borrowed[:default_frames]

            action_frames_map[action_name] = [fit_to_tile(f, tile_size) for f in borrowed]

    # Create Master Sprite Sheet
    total_cols = 12
    total_rows = len(ALL_ACTIONS)
    sheet_w = total_cols * tile_size
    sheet_h = total_rows * tile_size
    sheet_img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

    animations_meta = {}
    active_frames_count = 0

    for row_idx, (action_name, def_frames, def_fps, def_loop) in enumerate(ALL_ACTIONS):
        frames_list = action_frames_map[action_name]
        n_frames = min(12, max(1, len(frames_list)))
        state_frame_indices = []

        for col_idx in range(n_frames):
            frame_img = frames_list[col_idx]
            paste_x = col_idx * tile_size
            paste_y = row_idx * tile_size
            sheet_img.paste(frame_img, (paste_x, paste_y), frame_img)
            global_frame_idx = row_idx * total_cols + col_idx
            state_frame_indices.append(global_frame_idx)
            active_frames_count += 1

        animations_meta[action_name] = {
            "row": row_idx,
            "frames": state_frame_indices,
            "fps": def_fps,
            "loop": def_loop
        }

    animations_meta["WALKING"] = {**animations_meta["IDLE"], "fps": 8}

    # Save Sprite Sheet PNG
    sheet_filename = f"{name}_spritesheet.png"
    sheet_path = os.path.join(output_dir, sheet_filename)
    sheet_img.save(sheet_path, "PNG")

    # Save Preview PNG
    preview_filename = f"{name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    preview_tile = action_frames_map["IDLE"][0]
    preview_large = preview_tile.resize((128, 128), Image.Resampling.NEAREST)
    preview_large.save(preview_path, "PNG")

    frame_config = {
        "frameWidth": tile_size,
        "frameHeight": tile_size,
        "totalColumns": total_cols,
        "totalRows": total_rows,
        "totalFrames": total_cols * total_rows,
        "framesPerState": 6,
        "activeFramesCount": active_frames_count,
        "renderScale": {
            "minWidth": 100,
            "maxWidth": 150,
            "minHeight": 100,
            "maxHeight": 150,
            "defaultWidth": 120,
            "defaultHeight": 120
        },
        "naturalAspectRatio": 1.0,
        "palette": "custom",
        "actionUpload": True,
        "tileResolution": tile_size
    }

    meta = {
        "name": name,
        "prompt": spec.get("description", name),
        "animalType": name,
        "sheetUrl": f"/sprites/{sheet_filename}",
        "previewUrl": f"/sprites/{preview_filename}",
        "naturalAspectRatio": 1.0,
        "frameConfig": frame_config,
        "animations": animations_meta
    }

    meta_filename = f"{name}_meta.json"
    meta_path = os.path.join(output_dir, meta_filename)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    # Mirror files to backend/public/sprites or root public/sprites if present
    for alt_dir in [
        os.path.abspath(os.path.join(output_dir, "..", "backend", "public", "sprites")),
        os.path.abspath(os.path.join(output_dir, "..", "..", "backend", "public", "sprites")),
        os.path.abspath(os.path.join(output_dir, "..", "public", "sprites")),
        os.path.abspath(os.path.join(output_dir, "..", "..", "public", "sprites")),
    ]:
        if os.path.exists(alt_dir) and os.path.abspath(alt_dir) != os.path.abspath(output_dir):
            try:
                import shutil
                shutil.copy2(sheet_path, os.path.join(alt_dir, sheet_filename))
                shutil.copy2(preview_path, os.path.join(alt_dir, preview_filename))
                shutil.copy2(meta_path, os.path.join(alt_dir, meta_filename))
            except Exception:
                pass

    return meta

def main():
    parser = argparse.ArgumentParser(description="Build Pet Sprite Sheet from individual action files")
    parser.add_argument("--spec", required=True, help="Path to JSON spec file")
    args = parser.parse_args()

    with open(args.spec, "r", encoding="utf-8") as f:
        spec = json.load(f)

    meta = build_action_sprite_sheet(spec)
    print(json.dumps(meta, ensure_ascii=False))

if __name__ == "__main__":
    main()
