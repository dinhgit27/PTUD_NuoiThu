"""
Agent Sprite Forge - Advanced Parametric Pixel Art Engine
Generates authentic, diverse 2D Pixel Art character sprite sheets supporting all 17 required animation states.
Supports rich species silhouettes (Sheep, Cat, Dog, Bird, Rabbit, Penguin, Panda, Dragon, Fox, etc.),
accurate headwear/accessories (Military Beret/Helmet, Wizard Hat, Crown, Chef Hat, Glasses, Scarf, etc.),
and species-specific animation behaviors.
"""

import sys
import os
import io
import json
import math
import random
import re
from PIL import Image, ImageChops, ImageDraw, ImageOps

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

ANIMATION_STATES = [
    "IDLE",          # 1. Idle / Walking (Default): 6 frames (Loop)
    "SLEEPING",      # 2. Sleeping / Dozing off: 4 frames (Loop)
    "HUNGRY",        # 3. Hungry: 4 frames (Loop)
    "EATING",        # 4. Eating / Chewing: 6 frames (Loop)
    "DRINKING",      # 5. Drinking / Holding a cup: 4 frames (Loop)
    "TYPING",        # 6. Typing / Focusing: 4 frames (Loop)
    "PETTING",       # 7. Reacting to petting: 5 frames (One-shot)
    "HAPPY",         # 8. Happy / Excited: 4 frames (Loop)
    "SAD",           # 9. Sad / Crying / Sighing: 5 frames (One-shot)
    "DANCING",       # 10. Dancing: 8 frames (Loop)
    "WAVING"         # 11. Waving (Attention seeking): 4 frames (Loop)
]

STATE_SPEC = {
    "IDLE": {
        "index": 0,
        "name": "Idle / Walking (Default)",
        "frames": 6,
        "loop": True,
        "fps": 6,
        "group": "Nhóm 1: Trạng thái cơ bản & Sinh hoạt"
    },
    "SLEEPING": {
        "index": 1,
        "name": "Sleeping / Dozing off",
        "frames": 4,
        "loop": True,
        "fps": 4,
        "group": "Nhóm 1: Trạng thái cơ bản & Sinh hoạt"
    },
    "HUNGRY": {
        "index": 2,
        "name": "Hungry",
        "frames": 4,
        "loop": True,
        "fps": 4,
        "group": "Nhóm 1: Trạng thái cơ bản & Sinh hoạt"
    },
    "EATING": {
        "index": 3,
        "name": "Eating / Chewing",
        "frames": 6,
        "loop": True,
        "fps": 6,
        "group": "Nhóm 1: Trạng thái cơ bản & Sinh hoạt"
    },
    "DRINKING": {
        "index": 4,
        "name": "Drinking / Holding a cup",
        "frames": 4,
        "loop": True,
        "fps": 5,
        "group": "Nhóm 1: Trạng thái cơ bản & Sinh hoạt"
    },
    "TYPING": {
        "index": 5,
        "name": "Typing / Focusing",
        "frames": 4,
        "loop": True,
        "fps": 6,
        "group": "Nhóm 2: Đồng hành làm việc"
    },
    "PETTING": {
        "index": 6,
        "name": "Reacting to petting",
        "frames": 5,
        "loop": False,
        "fps": 6,
        "group": "Nhóm 3: Tương tác & Giao tiếp"
    },
    "HAPPY": {
        "index": 7,
        "name": "Happy / Excited",
        "frames": 4,
        "loop": True,
        "fps": 6,
        "group": "Nhóm 4: Cảm xúc & Gamification"
    },
    "SAD": {
        "index": 8,
        "name": "Sad / Crying / Sighing",
        "frames": 5,
        "loop": False,
        "fps": 5,
        "group": "Nhóm 4: Cảm xúc & Gamification"
    },
    "DANCING": {
        "index": 9,
        "name": "Dancing",
        "frames": 8,
        "loop": True,
        "fps": 8,
        "group": "Nhóm 3: Tương tác & Giao tiếp"
    },
    "WAVING": {
        "index": 10,
        "name": "Waving (Attention seeking)",
        "frames": 4,
        "loop": True,
        "fps": 6,
        "group": "Nhóm 3: Tương tác & Giao tiếp"
    }
}

DEFAULT_STATE_FPS = {s: STATE_SPEC[s]["fps"] for s in ANIMATION_STATES}
MAX_COLUMNS = 12
DEFAULT_FRAME_SIZE = 64

PALETTES = {
    "sheep": {
        "primary": (248, 248, 252),     # fluffy white cloud wool
        "secondary": (238, 222, 208),   # peach skin face & ears
        "dark": (185, 170, 160),        # wool shading
        "eyes": (40, 35, 35),           # dark warm eyes
        "nose": (245, 140, 160),        # pink sheep nose
        "outline": (45, 40, 45),        # dark outline
        "horns": (210, 165, 105),       # golden ram horns
        "prop": (75, 95, 55),           # military olive green
        "accent": (245, 215, 60)        # gold army badge/star
    },
    "cat": {
        "primary": (245, 175, 105),     # orange ginger
        "secondary": (255, 235, 210),   # cream belly
        "dark": (195, 120, 60),         # stripes/shadow
        "eyes": (45, 160, 110),         # green
        "nose": (240, 120, 140),        # pink
        "outline": (40, 25, 20),        # dark outline
        "prop": (230, 80, 80),          # collar
        "accent": (255, 215, 0)         # bell
    },
    "corgi": {
        "primary": (218, 145, 75),      # corgi tan
        "secondary": (250, 245, 235),   # white chest
        "dark": (165, 95, 40),          # ears/back
        "eyes": (35, 25, 25),           # dark brown
        "nose": (25, 20, 20),           # black nose
        "outline": (45, 25, 15),
        "prop": (60, 130, 220),         # blue bandana
        "accent": (255, 195, 50)
    },
    "husky": {
        "primary": (70, 80, 95),        # slate husky grey
        "secondary": (250, 252, 255),   # snow white
        "dark": (45, 52, 65),           # dark mask/shading
        "eyes": (56, 189, 248),         # ice blue eyes
        "nose": (20, 22, 28),           # black nose
        "outline": (25, 30, 40),        # dark outline
        "prop": (230, 60, 70),          # red bandana
        "accent": (255, 215, 0)         # badge
    },
    "rabbit": {
        "primary": (242, 242, 248),     # snow white
        "secondary": (255, 210, 225),   # pink inner ears
        "dark": (205, 205, 220),        # soft shade
        "eyes": (220, 60, 90),          # ruby eyes
        "nose": (245, 130, 160),        # pink
        "outline": (45, 40, 50),
        "prop": (240, 120, 40),         # carrot
        "accent": (80, 180, 90)         # carrot leaves
    },
    "penguin": {
        "primary": (38, 45, 62),        # navy dark
        "secondary": (248, 250, 255),   # white belly
        "dark": (22, 28, 42),
        "eyes": (20, 20, 25),
        "nose": (250, 150, 30),         # orange beak
        "outline": (15, 18, 25),
        "prop": (220, 50, 50),          # red scarf
        "accent": (250, 190, 40)
    },
    "pigeon": {
        "primary": (175, 185, 200),     # soft pigeon grey
        "secondary": (232, 238, 245),   # white neck ring / belly
        "dark": (115, 125, 140),        # wing feathers
        "eyes": (235, 110, 45),         # amber orange
        "nose": (250, 185, 70),         # yellow beak
        "outline": (35, 40, 50),
        "prop": (130, 70, 190),         # purple wizard hat
        "accent": (255, 215, 0)         # gold star
    },
    "panda": {
        "primary": (248, 248, 252),     # white fur
        "secondary": (35, 38, 45),      # dark patches
        "dark": (20, 22, 28),
        "eyes": (20, 20, 22),
        "nose": (30, 30, 35),
        "outline": (15, 15, 20),
        "prop": (75, 180, 70),          # bamboo green
        "accent": (140, 220, 90)
    },
    "dragon": {
        "primary": (65, 165, 130),      # emerald green
        "secondary": (245, 215, 120),   # golden belly plates
        "dark": (40, 115, 90),          # dark scales
        "eyes": (255, 200, 40),         # fiery amber
        "nose": (30, 70, 55),
        "outline": (20, 45, 35),
        "prop": (245, 80, 50),          # fire spark
        "accent": (255, 220, 60)
    },
    "fox": {
        "primary": (230, 95, 45),       # red fox orange
        "secondary": (255, 245, 235),   # snow white chest
        "dark": (140, 50, 25),          # ear tips
        "eyes": (245, 175, 45),         # amber eyes
        "nose": (25, 20, 20),           # black nose
        "outline": (45, 25, 20),
        "prop": (230, 80, 80),
        "accent": (255, 215, 0)
    },
    "hamster": {
        "primary": (225, 175, 125),     # warm beige fur
        "secondary": (255, 250, 245),   # white belly
        "dark": (175, 120, 75),         # caramel shade
        "eyes": (25, 25, 30),           # black bead eyes
        "nose": (245, 150, 160),        # tiny pink nose
        "outline": (45, 35, 30),
        "prop": (220, 180, 110),        # sunflower seed
        "accent": (100, 190, 80)
    },
    "duck": {
        "primary": (255, 220, 60),      # sunshine yellow
        "secondary": (255, 245, 170),   # soft yellow
        "dark": (210, 165, 35),
        "eyes": (30, 30, 40),
        "nose": (245, 130, 30),         # bright orange bill
        "outline": (45, 40, 25),
        "prop": (80, 170, 230),         # pond ripple
        "accent": (100, 210, 120)
    },
    "pig": {
        "primary": (255, 185, 200),     # pastel pink
        "secondary": (255, 225, 235),   # rosy belly
        "dark": (225, 140, 160),        # ear shading
        "eyes": (35, 30, 35),
        "nose": (255, 110, 145),        # hot pink snout
        "outline": (50, 30, 35),
        "prop": (240, 160, 80),         # apple
        "accent": (255, 200, 50)
    },
    "default": {
        "primary": (130, 175, 240),     # pastel blue
        "secondary": (235, 242, 255),
        "dark": (85, 130, 200),
        "eyes": (30, 45, 70),
        "nose": (240, 120, 140),
        "outline": (25, 35, 55),
        "prop": (245, 195, 65),
        "accent": (240, 90, 90)
    }
}

def strip_vietnamese_accents(text):
    text = text.lower()
    mapping = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'đ': 'd',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y'
    }
    for k, v in mapping.items():
        text = text.replace(k, v)
    return text

def analyze_character_blueprint(prompt):
    """
    Parses any text prompt to detect species, headwear, accessories and palette.
    """
    raw_p = prompt.lower()
    clean_p = strip_vietnamese_accents(raw_p)
    p = raw_p + " " + clean_p
    
    # 1. Detect species
    if any(k in p for k in ["husky", "ngáo", "ngao"]):
        species = "husky"
    elif any(k in p for k in ["cừu", "cuu", "sheep", "lamb", "cừu dương", "cuu duong", "ram"]):
        species = "sheep"
    elif any(k in p for k in ["penguin", "chim cánh cụt", "cánh cụt", "canh cut"]):
        species = "penguin"
    elif any(k in p for k in ["chim", "bồ câu", "bo cau", "pigeon", "bird", "vẹt", "vet", "dove"]):
        species = "pigeon"
    elif any(k in p for k in ["cat", "mèo", "meo", "miêu", "mieu", "kitten"]):
        species = "cat"
    elif any(k in p for k in ["corgi", "chó", "cho", "dog", "cún", "cun", "shiba", "puppy"]):
        species = "corgi"
    elif any(k in p for k in ["rabbit", "thỏ", "tho", "bunny"]):
        species = "rabbit"
    elif any(k in p for k in ["panda", "gấu trúc", "gau truc", "gấu", "gau", "bear"]):
        species = "panda"
    elif any(k in p for k in ["rồng", "rong", "dragon", "khủng long", "khung long", "dino"]):
        species = "dragon"
    elif any(k in p for k in ["cáo", "cao", "fox", "hồ ly", "ho ly"]):
        species = "fox"
    elif any(k in p for k in ["hamster", "chuột", "chuot", "mouse", "rat"]):
        species = "hamster"
    elif any(k in p for k in ["vịt", "vit", "duck", "gà", "ga", "chicken"]):
        species = "duck"
    elif any(k in p for k in ["heo", "lợn", "lon", "pig"]):
        species = "pig"
    else:
        species = "sheep" if ("cừu" in p or "cuu" in p) else "creature"
        
    # 2. Detect headwear / accessories
    headwear = None
    if any(k in p for k in ["quân sự", "quan su", "quân đội", "quan doi", "lính", "linh", "military", "army", "camo", "chiến thuật", "chien thuat"]):
        headwear = "military_hat"
    elif any(k in p for k in ["phù thủy", "phu thuy", "wizard", "witch", "phép thuật", "phep thuat", "ma thuật"]):
        headwear = "wizard_hat"
    elif any(k in p for k in ["vương miện", "vuong mien", "crown", "vua", "king", "queen", "hoàng gia", "hoang gia"]):
        headwear = "crown"
    elif any(k in p for k in ["đầu bếp", "dau bep", "chef", "nấu ăn", "nau an"]):
        headwear = "chef_hat"
    elif any(k in p for k in ["tiệc", "tiec", "party", "sinh nhật", "sinh nhat", "birthday"]):
        headwear = "party_hat"
    elif any(k in p for k in ["kính", "kinh", "glasses", "sunglasses", "kính râm", "kinh ram"]):
        headwear = "glasses"
    elif any(k in p for k in ["khăn", "khan", "scarf"]):
        headwear = "scarf"
    elif any(k in p for k in ["nơ", "no", "cà vạt", "ca vat", "tie", "bowtie"]):
        headwear = "tie"
    # Fallback: if user typed "mũ" or "nón" without specific qualifier:
    elif any(k in p for k in ["mũ", "mu", "nón", "non", "hat", "cap"]):
        if species == "sheep" or "quân" in p or "quan" in p or "lính" in p or "linh" in p:
            headwear = "military_hat"
        else:
            headwear = "military_hat" if ("quan" in p or "lính" in p) else "party_hat"

    body_shape = "default"
    if any(word in p for word in ["tròn trịa", "mũm mĩm", "bụ bẫm", "bầu bĩnh", "chubby", "round"]):
        body_shape = "round"
    elif any(word in p for word in ["thon", "mảnh mai", "cao gầy", "slim", "slender", "lean", "tall"]):
        body_shape = "slim"
    pattern = "spots" if any(word in p for word in ["đốm", "chấm bi", "spots", "spotted"]) else None

    # 3. Detect palette
    palette = PALETTES.get(species, PALETTES["default"])
    
    # Explicit prompt colors override species defaults without matching substrings.
    prompt_colors = [
        (("đen", "den", "black"), (45, 45, 50), (95, 95, 105), (25, 25, 30)),
        (("trắng", "trang", "white"), (245, 245, 250), (255, 255, 255), (190, 195, 205)),
        (("xám", "xam", "gray", "grey"), (145, 150, 160), (215, 220, 225), (95, 100, 110)),
        (("xanh dương", "xanh biển", "blue", "navy"), (75, 135, 220), (185, 215, 255), (40, 80, 155)),
        (("xanh lá", "xanh lục", "green"), (95, 185, 115), (210, 245, 215), (45, 125, 70)),
        (("tím", "tim", "purple", "violet"), (155, 105, 205), (225, 200, 245), (95, 55, 145)),
        (("đỏ", "do", "red"), (220, 75, 75), (255, 190, 180), (145, 35, 45)),
        (("cam", "orange"), (245, 145, 65), (255, 220, 165), (175, 85, 35)),
        (("vàng", "vang", "yellow", "gold"), (250, 215, 80), (255, 245, 180), (185, 135, 35)),
        (("hồng", "hong", "pink"), (255, 170, 195), (255, 230, 240), (195, 95, 135)),
        (("nâu", "nau", "brown"), (155, 105, 70), (225, 190, 150), (95, 60, 40))
    ]
    for keywords, primary, secondary, dark in prompt_colors:
        if any(re.search(r"(?<!\w)" + re.escape(color) + r"(?!\w)", p) for color in keywords):
            palette = dict(palette, primary=primary, secondary=secondary, dark=dark)
            break

    return {
        "species": species,
        "headwear": headwear,
        "body_shape": body_shape,
        "pattern": pattern,
        "palette": palette
    }

def draw_pixel_box(draw, x, y, w, h, fill, outline=None):
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=fill, outline=outline)

def draw_pixel_circle(draw, cx, cy, r, fill, outline=None):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline)

# ==================== HEADWEAR RENDERERS ====================
def draw_military_beret(draw, bx, by, color=(75, 95, 55), emblem_color=(245, 215, 60)):
    """Renders authentic Military Olive Green Beret with gold star badge"""
    # Headband
    draw_pixel_box(draw, bx - 10, by, 20, 3, fill=(35, 45, 25), outline=(20, 25, 15))
    # Beret crown sloping gently right
    draw.polygon([
        (bx - 10, by),
        (bx - 8, by - 5),
        (bx + 4, by - 6),
        (bx + 12, by - 3),
        (bx + 10, by + 1),
        (bx - 4, by)
    ], fill=color, outline=(20, 25, 15))
    # Gold military star emblem on left
    draw_pixel_box(draw, bx - 6, by - 3, 3, 3, fill=emblem_color)

def draw_wizard_hat(draw, bx, by, hat_color=(110, 60, 180), accent_color=(255, 215, 0)):
    """Renders classic wizard cone hat"""
    draw_pixel_box(draw, bx - 11, by - 1, 22, 3, fill=(40, 25, 70), outline=(20, 15, 35))
    draw_pixel_box(draw, bx - 10, by, 20, 2, fill=hat_color)
    draw_pixel_box(draw, bx - 7, by - 3, 14, 2, fill=accent_color)
    draw.polygon([(bx - 8, by - 3), (bx + 8, by - 3), (bx + 2, by - 16), (bx - 2, by - 16)], fill=hat_color, outline=(20, 15, 35))
    draw.polygon([(bx - 2, by - 16), (bx + 2, by - 16), (bx + 7, by - 19), (bx + 4, by - 19)], fill=hat_color)
    draw_pixel_box(draw, bx + 5, by - 21, 3, 3, fill=accent_color)

def draw_royal_crown(draw, bx, by):
    """Renders gold crown with ruby jewels"""
    draw_pixel_box(draw, bx - 8, by - 1, 16, 2, fill=(245, 195, 40), outline=(50, 40, 10))
    # 3 crown peaks
    draw.polygon([(bx - 8, by - 1), (bx - 8, by - 6), (bx - 4, by - 3), (bx, by - 8), (bx + 4, by - 3), (bx + 8, by - 6), (bx + 8, by - 1)], fill=(255, 215, 50), outline=(50, 40, 10))
    # Rubies
    draw.point((bx, by - 7), fill=(240, 50, 60))
    draw.point((bx - 8, by - 5), fill=(70, 160, 240))
    draw.point((bx + 8, by - 5), fill=(70, 160, 240))

def draw_chef_hat(draw, bx, by):
    """Renders white chef hat"""
    draw_pixel_box(draw, bx - 8, by, 16, 3, fill=(220, 220, 230), outline=(40, 40, 50))
    draw.ellipse([bx - 10, by - 12, bx + 10, by], fill=(250, 250, 255), outline=(40, 40, 50))

def draw_cool_glasses(draw, bx, ey):
    """Renders sunglasses / cool pixel glasses"""
    draw_pixel_box(draw, bx - 8, ey, 6, 4, fill=(30, 30, 35), outline=(10, 10, 15))
    draw_pixel_box(draw, bx + 2, ey, 6, 4, fill=(30, 30, 35), outline=(10, 10, 15))
    draw.line([(bx - 2, ey + 1), (bx + 2, ey + 1)], fill=(10, 10, 15), width=1)
    draw.point((bx - 7, ey + 1), fill=(100, 190, 255))
    draw.point((bx + 3, ey + 1), fill=(100, 190, 255))

# ==================== SPECIES ANATOMY RENDERER ====================
def draw_pet_frame(state, frame_idx, total_frames, palette, animal_type, prompt="", size=64):
    """
    Renders an authentic, highly expressive 2D Pixel Art frame tailored specifically to the creature species.
    """
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    blueprint = analyze_character_blueprint(prompt)
    species = blueprint["species"]
    headwear = blueprint["headwear"]
    palette = blueprint["palette"]
    body_shape = blueprint["body_shape"]
    pattern = blueprint["pattern"]
    
    col_prim = palette["primary"]
    col_sec = palette["secondary"]
    col_dark = palette["dark"]
    col_eye = palette["eyes"]
    col_nose = palette["nose"]
    col_out = palette["outline"]
    col_prop = palette["prop"]
    col_acc = palette["accent"]
    
    bx = 32
    by = 38
    body_w = 26
    body_h = 24
    shadow_w = 24
    shadow_y = 56
    
    eye_style = "open"
    mouth_style = "smile"
    arms_pose = "idle"
    legs_pose = "standing"
    props = []
    
    # ------------------ STATE SPECIFIC GEOMETRY ------------------
    if state == "IDLE":
        bob = [0, -1, -2, -1, 0, 1][frame_idx % 6]
        by = 38 + bob
        legs_pose = "walking" if frame_idx in (1, 4) else "standing"
        eye_style = "closed" if frame_idx == 3 else "open"
        
    elif state == "TYPING":
        by = 40
        body_w = 28
        body_h = 22
        eye_style = "open"
        arms_pose = "typing"
        props.append(("desk_laptop", 18, 46, 28, 12, frame_idx))
        
    elif state == "SLEEPING":
        by = 49
        body_w = 34
        body_h = 14 + (1 if frame_idx in (1, 2) else 0)
        shadow_w = 34
        eye_style = "sleeping"
        mouth_style = "none"
        arms_pose = "sleeping"
        legs_pose = "lying"
        if frame_idx >= 1:
            props.append(("zzz_sequence", 42, 28 - frame_idx * 4, frame_idx))
            
    elif state == "WAKING_UP":
        if frame_idx == 0:
            by = 48
            body_w = 32
            body_h = 16
            eye_style = "sleeping"
            legs_pose = "lying"
        elif frame_idx == 1:
            by = 44
            body_w = 28
            body_h = 18
            eye_style = "closed"
            arms_pose = "hold_belly"
        elif frame_idx in (2, 3):
            by = 36 if frame_idx == 2 else 32
            body_w = 24
            body_h = 28
            eye_style = "closed" if frame_idx == 2 else "open"
            arms_pose = "happy_raise"
        else:
            by = 38
            body_w = 26
            body_h = 24
            eye_style = "wide"
            mouth_style = "open_smile"
            props.append(("sparkle", 48, 18, 0, 0))
            
    elif state == "HAPPY":
        if frame_idx == 0:
            by = 42
            body_h = 18
            legs_pose = "crouch"
            eye_style = "happy"
        elif frame_idx in (1, 2):
            by = 24 if frame_idx == 2 else 26
            body_w = 22
            body_h = 28
            legs_pose = "jump"
            arms_pose = "happy_raise"
            eye_style = "happy"
            mouth_style = "open_smile"
            props.append(("sparkle", 12, 16, 0, 0))
            props.append(("sparkle", 52, 16, 0, 0))
        else:
            by = 36
            body_w = 26
            body_h = 24
            eye_style = "happy"
            mouth_style = "open_smile"
            props.append(("sparkle", 32, 14, 0, 0))
            
    elif state == "SAD":
        by = 42 + [0, 1, 2, 2, 1][frame_idx % 5]
        body_w = 28
        body_h = 19
        eye_style = "crying"
        mouth_style = "frown"
        arms_pose = "sad_droop"
        props.append(("crying_stream", 32, 42, frame_idx))
        
    elif state == "YAWNING":
        by = 38 + [0, 1, 2, 1, 0][frame_idx % 5]
        body_w = 26
        body_h = 24
        eye_style = "closed"
        mouth_style = "yawn" if frame_idx in (1, 2, 3) else "frown"
        if frame_idx in (1, 2, 3):
            props.append(("yawn_bubble", 44, 28 - frame_idx * 2, frame_idx))
        
    elif state == "HUNGRY":
        shake = [-1, 1, -1, 1][frame_idx % 4]
        bx += shake
        by = 40
        body_w = 26
        body_h = 22
        eye_style = "crying"
        mouth_style = "frown"
        arms_pose = "hold_belly"
        props.append(("food_bubble", 42, 14, frame_idx, species))
        
    elif state == "EATING":
        by = 42 if frame_idx in (0, 2, 4) else 36
        body_w = 26
        body_h = 22
        eye_style = "happy"
        mouth_style = "chewing" if frame_idx in (1, 3, 5) else "open_smile"
        arms_pose = "eating"
        props.append(("species_food", 22, 48, 20, 8, frame_idx, species))
        
    elif state == "PETTING":
        by = 39 + [0, 1, 2, 1, 0][frame_idx % 5]
        eye_style = "happy"
        mouth_style = "open_smile" if frame_idx in (1, 2, 3) else "smile"
        arms_pose = "petting_lean"
        props.append(("petting_hand", 24 + [0, 2, 4, 2, 1][frame_idx % 5], 12, frame_idx))
        props.append(("heart", 46, 18 - (frame_idx % 3) * 2, 0, 0))
        
    elif state == "DANCING":
        d_f = frame_idx % 8
        if d_f in (0, 1):
            bx = 27
            by = 34 if d_f == 0 else 37
            arms_pose = "dance_left"
            legs_pose = "dance_kick"
        elif d_f in (2, 3):
            bx = 37
            by = 34 if d_f == 2 else 37
            arms_pose = "dance_right"
            legs_pose = "dance_kick"
        elif d_f in (4, 5):
            bx = 32
            by = 28
            arms_pose = "happy_raise"
            legs_pose = "jump"
        else:
            bx = 32
            by = 36
            arms_pose = "dance_left" if d_f == 6 else "dance_right"
        eye_style = "happy"
        mouth_style = "open_smile"
        props.append(("music_note", 12, 18 + (frame_idx % 2)*4, 0, 0))
        props.append(("music_note", 50, 16 - (frame_idx % 2)*4, 0, 0))
        
    elif state == "DRINKING":
        by = 38
        body_w = 26
        body_h = 24
        eye_style = "open"
        mouth_style = "straw"
        arms_pose = "hold_cup"
        props.append(("water_mug", 30, 38, 10, 13, frame_idx))
        
    elif state == "EXERCISING":
        ex_f = frame_idx % 8
        if ex_f in (1, 3, 5):
            by = 26
            legs_pose = "jump"
            arms_pose = "jumprope_hold"
        elif ex_f in (0, 4):
            by = 40
            legs_pose = "crouch"
            arms_pose = "hold_belly"
        else:
            by = 36
            legs_pose = "standing"
            arms_pose = "happy_raise"
        eye_style = "happy"
        mouth_style = "open_smile"
        if species == "sheep":
            props.append(("sheep_fence", 32, 50, frame_idx))
        elif species == "cat":
            props.append(("laser_dot", 32, 48, frame_idx))
        elif species == "corgi":
            props.append(("frisbee", 32, 28, frame_idx))
        elif species == "hamster":
            props.append(("hamster_wheel", 32, 38, frame_idx))
        else:
            props.append(("jumprope_cycle", 32, 36, frame_idx))
            
    elif state == "WAVING":
        by = 38
        body_w = 26
        body_h = 24
        eye_style = "wink" if frame_idx % 2 == 1 else "open"
        mouth_style = "open_smile"
        arms_pose = "wave_right"
        props.append(("wave_swoosh", 46, 22, frame_idx))
        
    elif state == "THANKING":
        if frame_idx in (1, 2):
            by = 44
            body_w = 28
            body_h = 18
            arms_pose = "bow_clasp"
            eye_style = "happy"
            props.append(("heart", 32, 16, 0, 0))
        else:
            by = 38
            body_w = 26
            body_h = 24
            arms_pose = "bow_clasp"
            eye_style = "open"
            mouth_style = "smile"
            
    elif state == "CELEBRATING":
        if frame_idx in (1, 2, 3):
            by = 28
            legs_pose = "jump"
            arms_pose = "celebrate"
        elif frame_idx == 0:
            by = 42
            legs_pose = "crouch"
            arms_pose = "celebrate"
        else:
            by = 36
            legs_pose = "standing"
            arms_pose = "celebrate"
        eye_style = "happy"
        mouth_style = "open_smile"
        props.append(("party_hat", bx, by - body_h//2 - 6, 0, 0))
        props.append(("confetti_blizzard", 32, 24, frame_idx))
        
    elif state == "EVOLVING":
        by = 30 + [0, -3, -1, 2, -2, 0, -4, 1, -1, 3, -2, 0][frame_idx % 12]
        legs_pose = "jump"
        eye_style = "glow"
        mouth_style = "open_smile"
        arms_pose = "levitate"
        props.append(("evolution_aura", bx, by, frame_idx))

    if body_shape == "round":
        body_w = min(38, body_w + 6)
        body_h = min(34, body_h + 4)
    elif body_shape == "slim":
        body_w = max(18, body_w - 5)
        body_h = min(32, body_h + 4)

    # ==================== 1. DRAW FLOOR SHADOW ====================
    draw.ellipse([32 - shadow_w//2, shadow_y - 2, 32 + shadow_w//2, shadow_y + 3], fill=(0, 0, 0, 45))

    # ==================== 2. DRAW SPECIES-SPECIFIC BODY SILHOUETTES ====================
    if species == "sheep":
        # FLUFFY WOOL BODY (Cloud-like scalloped wool lobes)
        body_y = by
        # Draw soft cloud wool lobes
        wool_r = body_w // 2 + 3
        draw_pixel_box(draw, bx - wool_r - 1, body_y - body_h//2 - 1, wool_r*2 + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - wool_r, body_y - body_h//2, wool_r*2, body_h, fill=col_prim)
        
        # Scalloped wool puffs around boundary
        puffs = [
            (bx - wool_r + 2, body_y - body_h//2 + 2),
            (bx, body_y - body_h//2 - 2),
            (bx + wool_r - 2, body_y - body_h//2 + 2),
            (bx - wool_r, body_y),
            (bx + wool_r, body_y),
            (bx - wool_r + 3, body_y + body_h//2 - 2),
            (bx + wool_r - 3, body_y + body_h//2 - 2),
            (bx, body_y + body_h//2 + 1)
        ]
        for px, py in puffs:
            draw_pixel_circle(draw, px, py, 4, fill=col_prim, outline=col_out)
            draw_pixel_circle(draw, px, py, 3, fill=col_prim)
            
        # Sheep peach face oval in center
        face_w = 14
        face_h = 13
        draw_pixel_box(draw, bx - face_w//2 - 1, body_y - 3, face_w + 2, face_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - face_w//2, body_y - 2, face_w, face_h, fill=col_sec)
        
        # Floppy ears on sides or Curled Ram Horns
        draw_pixel_box(draw, bx - face_w//2 - 4, body_y, 4, 6, fill=col_sec, outline=col_out)
        draw_pixel_box(draw, bx + face_w//2, body_y, 4, 6, fill=col_sec, outline=col_out)
        # Cloven hooves
        draw_pixel_box(draw, bx - 8, body_y + body_h//2 - 1, 5, 4, fill=(50, 45, 50), outline=col_out)
        draw_pixel_box(draw, bx + 3, body_y + body_h//2 - 1, 5, 4, fill=(50, 45, 50), outline=col_out)

    elif species == "pigeon":
        # PEAR-SHAPED BIRD BODY
        body_y = by
        draw_pixel_box(draw, bx - body_w//2 - 1, body_y - body_h//2 - 1, body_w + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - body_w//2, body_y - body_h//2, body_w, body_h, fill=col_prim)
        # Rounded bird chest
        draw_pixel_box(draw, bx - 6, body_y - 1, 12, 10, fill=col_sec)
        # Wing feathers
        draw.polygon([(bx - 14, body_y - 2), (bx - 9, body_y + 8), (bx - 12, body_y + 11)], fill=col_dark, outline=col_out)
        draw.polygon([(bx + 14, body_y - 2), (bx + 9, body_y + 8), (bx + 12, body_y + 11)], fill=col_dark, outline=col_out)
        # Bird feet
        draw_pixel_box(draw, bx - 7, body_y + body_h//2 - 1, 4, 3, fill=col_nose)
        draw_pixel_box(draw, bx + 3, body_y + body_h//2 - 1, 4, 3, fill=col_nose)

    elif species == "penguin":
        # CHUBBY ROUND PENGUIN BODY
        body_y = by
        draw_pixel_box(draw, bx - body_w//2 - 1, body_y - body_h//2 - 1, body_w + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - body_w//2, body_y - body_h//2, body_w, body_h, fill=col_prim)
        draw_pixel_circle(draw, bx, body_y - body_h//2, body_w//2 - 1, fill=col_prim, outline=col_out)
        
        # White oval belly
        belly_w = max(10, body_w - 12)
        belly_h = max(8, body_h - 10)
        draw_pixel_box(draw, bx - belly_w//2, body_y - belly_h//2 + 3, belly_w, belly_h, fill=col_sec)
        draw_pixel_circle(draw, bx, body_y - belly_h//2 + 4, belly_w//2, fill=col_sec)
        
        # Flippers (wings) with animation
        flip_f = frame_idx % 4
        if state == "WAVING":
            wave_y = [-4, -8, -10, -6][flip_f]
            draw.polygon([(bx - body_w//2, body_y - 2), (bx - body_w//2 - 4, body_y + 4), (bx - body_w//2, body_y + 8)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + body_w//2, body_y - 2), (bx + body_w//2 + 6, body_y + wave_y), (bx + body_w//2 + 2, body_y + wave_y + 5)], fill=col_prim, outline=col_out)
        elif state == "DANCING":
            sway_l = [-4, 2, -2, 4][flip_f]
            sway_r = [2, -4, 4, -2][flip_f]
            draw.polygon([(bx - body_w//2, body_y - 2), (bx - body_w//2 - 6, body_y + sway_l), (bx - body_w//2, body_y + sway_l + 7)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + body_w//2, body_y - 2), (bx + body_w//2 + 6, body_y + sway_r), (bx + body_w//2, body_y + sway_r + 7)], fill=col_prim, outline=col_out)
        elif state == "SLEEPING":
            draw_pixel_box(draw, bx - body_w//2 - 1, body_y, 3, 8, fill=col_prim, outline=col_out)
            draw_pixel_box(draw, bx + body_w//2 - 2, body_y, 3, 8, fill=col_prim, outline=col_out)
        else:
            flap = [-1, 0, 1, 0][flip_f]
            draw.polygon([(bx - body_w//2, body_y - 2), (bx - body_w//2 - 4, body_y + flap + 4), (bx - body_w//2, body_y + flap + 8)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + body_w//2, body_y - 2), (bx + body_w//2 + 4, body_y + flap + 4), (bx + body_w//2, body_y + flap + 8)], fill=col_prim, outline=col_out)
            
        # Cute orange webbed feet (step when walking/dancing)
        feet_y = body_y + body_h//2 - 1
        foot_l_y = feet_y - (1 if state in ("IDLE", "DANCING") and flip_f in (1, 2) else 0)
        foot_r_y = feet_y - (1 if state in ("IDLE", "DANCING") and flip_f in (0, 3) else 0)
        draw_pixel_box(draw, bx - 8, foot_l_y, 6, 4, fill=col_nose, outline=col_out)
        draw_pixel_box(draw, bx + 2, foot_r_y, 6, 4, fill=col_nose, outline=col_out)

    elif species == "panda":
        # PANDA CHUBBY SILHOUETTE
        body_y = by
        draw_pixel_box(draw, bx - body_w//2 - 1, body_y - body_h//2 - 1, body_w + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - body_w//2, body_y - body_h//2, body_w, body_h, fill=col_prim)
        # Black panda vest / arms
        draw_pixel_box(draw, bx - body_w//2, body_y - 2, 6, body_h//2 + 2, fill=col_sec)
        draw_pixel_box(draw, bx + body_w//2 - 6, body_y - 2, 6, body_h//2 + 2, fill=col_sec)
        # Round black ears
        draw_pixel_circle(draw, bx - 9, body_y - body_h//2 - 2, 4, fill=col_sec, outline=col_out)
        draw_pixel_circle(draw, bx + 9, body_y - body_h//2 - 2, 4, fill=col_sec, outline=col_out)
        # Feet
        draw_pixel_box(draw, bx - 8, body_y + body_h//2 - 1, 6, 4, fill=col_sec, outline=col_out)
        draw_pixel_box(draw, bx + 2, body_y + body_h//2 - 1, 6, 4, fill=col_sec, outline=col_out)

    elif species == "dragon":
        # DRAGON SCALED BODY WITH BACK SPIKES
        body_y = by
        draw_pixel_box(draw, bx - body_w//2 - 1, body_y - body_h//2 - 1, body_w + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - body_w//2, body_y - body_h//2, body_w, body_h, fill=col_prim)
        # Yellow belly plates
        draw_pixel_box(draw, bx - 5, body_y - 2, 10, body_h//2 + 2, fill=col_sec)
        # Dragon horns
        draw.polygon([(bx - 9, body_y - body_h//2), (bx - 7, body_y - body_h//2 - 8), (bx - 4, body_y - body_h//2)], fill=col_acc, outline=col_out)
        draw.polygon([(bx + 4, body_y - body_h//2), (bx + 7, body_y - body_h//2 - 8), (bx + 9, body_y - body_h//2)], fill=col_acc, outline=col_out)
        # Feet
        draw_pixel_box(draw, bx - 8, body_y + body_h//2 - 1, 6, 4, fill=col_dark, outline=col_out)
        draw_pixel_box(draw, bx + 2, body_y + body_h//2 - 1, 6, 4, fill=col_dark, outline=col_out)

    elif species == "husky":
        # CHIBI HUSKY PUPPY (High-definition pixel art puppy)
        body_y = by
        # 1. Torso below head
        draw_pixel_circle(draw, bx, body_y + 4, 9, fill=col_prim, outline=col_out)
        # White chest
        draw_pixel_box(draw, bx - 6, body_y + 1, 12, 8, fill=col_sec)
        
        # 2. Curled fluffy tail with white tip
        tail_wag = [-3, 0, 3, 0][frame_idx % 4]
        draw.polygon([(bx + 7, body_y + 6), (bx + 14 + tail_wag, body_y - 2), (bx + 12 + tail_wag, body_y + 4)], fill=col_prim, outline=col_out)
        draw.point((bx + 13 + tail_wag, body_y - 1), fill=col_sec)
        
        # 3. Pointy Husky Ears
        ear_drop = 4 if state in ("SLEEPING", "SAD") else 0
        draw.polygon([(bx - 11, body_y - 8 + ear_drop), (bx - 9, body_y - 19 + ear_drop), (bx - 3, body_y - 10 + ear_drop)], fill=col_prim, outline=col_out)
        draw.polygon([(bx - 9, body_y - 9 + ear_drop), (bx - 8, body_y - 16 + ear_drop), (bx - 5, body_y - 10 + ear_drop)], fill=(255, 180, 195))
        draw.polygon([(bx + 3, body_y - 10 + ear_drop), (bx + 9, body_y - 19 + ear_drop), (bx + 11, body_y - 8 + ear_drop)], fill=col_prim, outline=col_out)
        draw.polygon([(bx + 5, body_y - 10 + ear_drop), (bx + 8, body_y - 16 + ear_drop), (bx + 9, body_y - 9 + ear_drop)], fill=(255, 180, 195))
        
        # 4. Fluffy Chibi Head (Rounded oval with cheek tufts)
        head_y = body_y - 8
        draw_pixel_circle(draw, bx, head_y, 11, fill=col_prim, outline=col_out)
        # Fluffy cheek tufts
        draw.polygon([(bx - 11, head_y), (bx - 15, head_y + 2), (bx - 10, head_y + 5)], fill=col_sec, outline=col_out)
        draw.polygon([(bx + 11, head_y), (bx + 15, head_y + 2), (bx + 10, head_y + 5)], fill=col_sec, outline=col_out)
        
        # 5. Husky Mask (White lower face, white blaze on brow, dark brow markings)
        draw_pixel_circle(draw, bx, head_y + 3, 8, fill=col_sec)
        draw_pixel_box(draw, bx - 2, head_y - 8, 4, 9, fill=col_sec)
        draw_pixel_box(draw, bx - 6, head_y - 6, 3, 2, fill=col_dark)
        draw_pixel_box(draw, bx + 3, head_y - 6, 3, 2, fill=col_dark)
        
        # 6. Sparkly Ice Blue Eyes (or sleep / cry / happy eyes)
        if eye_style == "open":
            draw_pixel_box(draw, bx - 7, head_y - 3, 3, 4, fill=(56, 189, 248), outline=col_out)
            draw_pixel_box(draw, bx + 4, head_y - 3, 3, 4, fill=(56, 189, 248), outline=col_out)
            draw.point((bx - 7, head_y - 3), fill=(255, 255, 255))
            draw.point((bx + 4, head_y - 3), fill=(255, 255, 255))
        elif eye_style == "happy":
            draw.line([(bx - 7, head_y - 1), (bx - 5, head_y - 3), (bx - 3, head_y - 1)], fill=col_out, width=1)
            draw.line([(bx + 3, head_y - 1), (bx + 5, head_y - 3), (bx + 7, head_y - 1)], fill=col_out, width=1)
        elif eye_style in ("sleeping", "closed"):
            draw.line([(bx - 7, head_y - 1), (bx - 3, head_y - 1)], fill=col_out, width=1)
            draw.line([(bx + 3, head_y - 1), (bx + 7, head_y - 1)], fill=col_out, width=1)
        elif eye_style == "crying":
            draw.line([(bx - 7, head_y - 3), (bx - 3, head_y - 1)], fill=col_out, width=1)
            draw.line([(bx + 3, head_y - 1), (bx + 7, head_y - 3)], fill=col_out, width=1)
        elif eye_style == "glow":
            draw_pixel_box(draw, bx - 7, head_y - 3, 4, 4, fill=(120, 240, 255), outline=col_out)
            draw_pixel_box(draw, bx + 3, head_y - 3, 4, 4, fill=(120, 240, 255), outline=col_out)
            
        # 7. Muzzle & Black Nose & Tongue
        draw_pixel_box(draw, bx - 2, head_y + 2, 4, 3, fill=col_nose)
        if mouth_style in ("open_smile", "chewing") or state in ("HAPPY", "CELEBRATING"):
            draw.point((bx, head_y + 5), fill=(245, 110, 130))
            draw.point((bx - 1, head_y + 5), fill=col_out)
            draw.point((bx + 1, head_y + 5), fill=col_out)
        else:
            draw.line([(bx - 2, head_y + 5), (bx, head_y + 6), (bx + 2, head_y + 5)], fill=col_out, width=1)
            
        # 8. Paws (Stepping when walking / dancing)
        paw_step = (1 if frame_idx % 2 == 0 else -1) if state in ("IDLE", "DANCING") else 0
        draw_pixel_box(draw, bx - 6, body_y + 10 + paw_step, 4, 4, fill=col_sec, outline=col_out)
        draw_pixel_box(draw, bx + 2, body_y + 10 - paw_step, 4, 4, fill=col_sec, outline=col_out)

    else:
        # Mammal (Cat / Corgi / Rabbit / Creature)
        body_y = by
        # Rounded chibi head and body contours
        draw_pixel_circle(draw, bx, body_y + 3, max(7, body_w//2 - 3), fill=col_prim, outline=col_out)
        draw_pixel_circle(draw, bx, body_y - 4, max(9, body_w//2 - 1), fill=col_prim, outline=col_out)
        belly_w = max(8, body_w - 14)
        belly_h = max(6, body_h - 10)
        draw_pixel_box(draw, bx - belly_w//2, body_y - belly_h//2 + 2, belly_w, belly_h, fill=col_sec)
        
        # Ears & Tail
        if species == "cat":
            ear_tip_y = body_y - body_h//2 - 7
            draw.polygon([(bx - 10, body_y - body_h//2 + 1), (bx - 5, ear_tip_y), (bx - 1, body_y - body_h//2 + 1)], fill=col_prim, outline=col_out)
            draw.polygon([(bx - 8, body_y - body_h//2 + 1), (bx - 5, ear_tip_y + 2), (bx - 2, body_y - body_h//2 + 1)], fill=col_sec)
            draw.polygon([(bx + 1, body_y - body_h//2 + 1), (bx + 5, ear_tip_y), (bx + 10, body_y - body_h//2 + 1)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + 2, body_y - body_h//2 + 1), (bx + 5, ear_tip_y + 2), (bx + 8, body_y - body_h//2 + 1)], fill=col_sec)
            tail_sway = [-2, 0, 2, 0][frame_idx % 4]
            draw.line([(bx + body_w//2, body_y + 4), (bx + body_w//2 + 8, body_y - 2 + tail_sway), (bx + body_w//2 + 6, body_y - 8 + tail_sway)], fill=col_prim, width=2)
        elif species == "fox":
            ear_tip_y = body_y - body_h//2 - 9
            draw.polygon([(bx - 11, body_y - body_h//2 + 2), (bx - 6, ear_tip_y), (bx - 1, body_y - body_h//2 + 2)], fill=col_prim, outline=col_out)
            draw.polygon([(bx - 8, ear_tip_y + 1), (bx - 6, ear_tip_y), (bx - 4, ear_tip_y + 2)], fill=col_dark)
            draw.polygon([(bx + 1, body_y - body_h//2 + 2), (bx + 6, ear_tip_y), (bx + 11, body_y - body_h//2 + 2)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + 4, ear_tip_y + 2), (bx + 6, ear_tip_y), (bx + 8, ear_tip_y + 1)], fill=col_dark)
            tail_sway = [-2, 0, 2, 0][frame_idx % 4]
            draw.polygon([(bx + body_w//2 - 2, body_y + 2), (bx + body_w//2 + 10 + tail_sway, body_y - 6), (bx + body_w//2 + 12 + tail_sway, body_y + 4), (bx + body_w//2, body_y + 6)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + body_w//2 + 7 + tail_sway, body_y - 4), (bx + body_w//2 + 10 + tail_sway, body_y - 6), (bx + body_w//2 + 11 + tail_sway, body_y)], fill=col_sec)
        elif species == "hamster":
            draw_pixel_circle(draw, bx - 8, body_y - body_h//2 - 2, 3, fill=col_prim, outline=col_out)
            draw_pixel_circle(draw, bx + 8, body_y - body_h//2 - 2, 3, fill=col_prim, outline=col_out)
            draw_pixel_circle(draw, bx - body_w//2, body_y + 2, 3, fill=col_sec, outline=col_out)
            draw_pixel_circle(draw, bx + body_w//2, body_y + 2, 3, fill=col_sec, outline=col_out)
        elif species == "duck":
            wing_sway = [0, -2, -1, 1][frame_idx % 4]
            draw.polygon([(bx - body_w//2, body_y - 2), (bx - body_w//2 - 4, body_y + wing_sway + 3), (bx - body_w//2 + 2, body_y + 6)], fill=col_dark, outline=col_out)
            draw.polygon([(bx + body_w//2, body_y - 2), (bx + body_w//2 + 4, body_y - wing_sway + 3), (bx + body_w//2 - 2, body_y + 6)], fill=col_dark, outline=col_out)
        elif species == "pig":
            draw.polygon([(bx - 10, body_y - body_h//2), (bx - 12, body_y - body_h//2 + 5), (bx - 6, body_y - body_h//2 + 2)], fill=col_prim, outline=col_out)
            draw.polygon([(bx + 10, body_y - body_h//2), (bx + 12, body_y - body_h//2 + 5), (bx + 6, body_y - body_h//2 + 2)], fill=col_prim, outline=col_out)
        elif species == "rabbit":
            ear_h = 16 if state != "SLEEPING" else 8
            draw_pixel_box(draw, bx - 9, body_y - body_h//2 - ear_h, 5, ear_h + 1, fill=col_prim, outline=col_out)
            draw_pixel_box(draw, bx - 8, body_y - body_h//2 - ear_h + 2, 3, ear_h - 3, fill=col_sec)
            draw_pixel_box(draw, bx + 4, body_y - body_h//2 - ear_h, 5, ear_h + 1, fill=col_prim, outline=col_out)
            draw_pixel_box(draw, bx + 5, body_y - body_h//2 - ear_h + 2, 3, ear_h - 3, fill=col_sec)
        elif species == "corgi":
            draw.polygon([(bx - 12, body_y - body_h//2 + 2), (bx - 7, body_y - body_h//2 - 10), (bx - 2, body_y - body_h//2 + 2)], fill=col_dark, outline=col_out)
            draw.polygon([(bx + 2, body_y - body_h//2 + 2), (bx + 7, body_y - body_h//2 - 10), (bx + 12, body_y - body_h//2 + 2)], fill=col_dark, outline=col_out)
            tail_wag = [-3, 0, 3, 0][frame_idx % 4]
            draw_pixel_box(draw, bx + body_w//2 + tail_wag, body_y + 4, 4, 4, fill=col_dark, outline=col_out)
        else:
            draw_pixel_circle(draw, bx - 8, body_y - body_h//2 - 2, 4, fill=col_prim, outline=col_out)
            draw_pixel_circle(draw, bx + 8, body_y - body_h//2 - 2, 4, fill=col_prim, outline=col_out)
            
        # Feet
        draw_pixel_box(draw, bx - 9, body_y + body_h//2 - 2, 6, 5, fill=col_dark, outline=col_out)
        draw_pixel_box(draw, bx + 3, body_y + body_h//2 - 2, 6, 5, fill=col_dark, outline=col_out)

    if pattern == "spots":
        for px, py in ((bx - 8, by - 3), (bx + 9, by + 2), (bx - 3, by + 7)):
            draw_pixel_circle(draw, px, py, 2, fill=col_dark)

    # ==================== 3. DRAW ACCURATE HEADWEAR / ACCESSORIES ====================
    head_top_y = by - body_h//2 - 1
    if state not in ("SLEEPING", "CELEBRATING"):
        if headwear == "military_hat":
            draw_military_beret(draw, bx, head_top_y)
        elif headwear == "wizard_hat":
            draw_wizard_hat(draw, bx, head_top_y)
        elif headwear == "crown":
            draw_royal_crown(draw, bx, head_top_y)
        elif headwear == "chef_hat":
            draw_chef_hat(draw, bx, head_top_y)
        elif headwear == "party_hat":
            draw.polygon(
                [(bx - 8, head_top_y + 4), (bx, head_top_y - 13), (bx + 8, head_top_y + 4)],
                fill=col_prop,
                outline=col_out
            )
            draw_pixel_box(draw, bx - 8, head_top_y + 3, 17, 2, fill=col_acc, outline=col_out)
        elif headwear == "scarf":
            draw_pixel_box(draw, bx - 10, by + 7, 20, 4, fill=col_prop, outline=col_out)
            draw_pixel_box(draw, bx + 5, by + 10, 4, 7, fill=col_prop, outline=col_out)
        elif headwear == "tie":
            draw.polygon(
                [(bx - 3, by + 6), (bx + 3, by + 6), (bx + 2, by + 13), (bx, by + 16), (bx - 2, by + 13)],
                fill=col_prop,
                outline=col_out
            )

    # ==================== 4. DRAW FACIAL EXPRESSIONS ====================
    if species != "husky":
        ey = by - (2 if species == "sheep" else 4)
        if eye_style == "open":
            draw_pixel_box(draw, bx - 6, ey, 3, 4, fill=col_eye)
            draw_pixel_box(draw, bx + 3, ey, 3, 4, fill=col_eye)
            draw.point((bx - 6, ey), fill=(255, 255, 255))
            draw.point((bx + 3, ey), fill=(255, 255, 255))
        elif eye_style == "happy":
            draw.line([(bx - 6, ey + 2), (bx - 4, ey), (bx - 2, ey + 2)], fill=col_out, width=1)
            draw.line([(bx + 2, ey + 2), (bx + 4, ey), (bx + 6, ey + 2)], fill=col_out, width=1)
        elif eye_style == "sleeping":
            draw.line([(bx - 6, ey + 2), (bx - 2, ey + 2)], fill=col_out, width=1)
            draw.line([(bx + 2, ey + 2), (bx + 6, ey + 2)], fill=col_out, width=1)
        elif eye_style == "closed":
            draw.line([(bx - 6, ey + 2), (bx - 3, ey + 2)], fill=col_out, width=1)
            draw.line([(bx + 3, ey + 2), (bx + 6, ey + 2)], fill=col_out, width=1)
        elif eye_style == "crying":
            draw.line([(bx - 6, ey), (bx - 3, ey + 2)], fill=col_out, width=1)
            draw.line([(bx + 3, ey + 2), (bx + 6, ey)], fill=col_out, width=1)
        elif eye_style == "wide":
            draw_pixel_box(draw, bx - 7, ey - 1, 4, 5, fill=col_eye)
            draw_pixel_box(draw, bx + 3, ey - 1, 4, 5, fill=col_eye)
            draw.point((bx - 7, ey - 1), fill=(255, 255, 255))
            draw.point((bx + 3, ey - 1), fill=(255, 255, 255))
        elif eye_style == "glow":
            draw_pixel_box(draw, bx - 7, ey - 2, 5, 5, fill=(255, 255, 120), outline=col_out)
            draw_pixel_box(draw, bx + 2, ey - 2, 5, 5, fill=(255, 255, 120), outline=col_out)
        elif eye_style == "wink":
            draw.line([(bx - 6, ey + 2), (bx - 3, ey + 2)], fill=col_out, width=1)
            draw_pixel_box(draw, bx + 3, ey, 3, 4, fill=col_eye)
            draw.point((bx + 3, ey), fill=(255, 255, 255))

        # Sunglasses accessory
        if headwear == "glasses" and state != "SLEEPING":
            draw_cool_glasses(draw, bx, ey)

        # Nose / Beak / Snout
        if species in ("pigeon", "duck", "penguin"):
            draw.polygon([(bx - 3, ey + 3), (bx + 3, ey + 3), (bx, ey + 6)], fill=col_nose, outline=col_out)
        elif species == "pig":
            draw_pixel_box(draw, bx - 4, ey + 2, 8, 5, fill=col_nose, outline=col_out)
            draw.point((bx - 2, ey + 4), fill=(70, 30, 40))
            draw.point((bx + 1, ey + 4), fill=(70, 30, 40))
        else:
            draw_pixel_box(draw, bx - 1, ey + 3, 2, 2, fill=col_nose)

        # Cheeks
        draw_pixel_box(draw, bx - 8, ey + 3, 2, 2, fill=(255, 150, 160, 200))
        draw_pixel_box(draw, bx + 6, ey + 3, 2, 2, fill=(255, 150, 160, 200))

        # Mouth
        my = ey + 5
        if mouth_style == "smile":
            draw.line([(bx - 2, my), (bx, my + 1), (bx + 2, my)], fill=col_out, width=1)
        elif mouth_style == "open_smile":
            draw_pixel_box(draw, bx - 3, my, 6, 3, fill=(220, 70, 80), outline=col_out)
        elif mouth_style == "frown":
            draw.line([(bx - 2, my + 1), (bx, my), (bx + 2, my + 1)], fill=col_out, width=1)
        elif mouth_style == "yawn":
            draw_pixel_box(draw, bx - 4, my - 1, 8, 6, fill=(180, 40, 50), outline=col_out)
            draw_pixel_box(draw, bx - 2, my + 2, 4, 2, fill=(255, 130, 140))
        elif mouth_style == "chewing":
            draw_pixel_box(draw, bx - 3, my - 1, 6, 3, fill=col_out)

    # ==================== 5. DRAW ARMS & LIMBS ====================
    if species not in ("pigeon", "sheep"):
        if arms_pose == "typing":
            paw_l_y = by + 2 + (-2 if frame_idx % 2 == 0 else 2)
            paw_r_y = by + 2 + (2 if frame_idx % 2 == 0 else -2)
            draw_pixel_box(draw, bx - 8, paw_l_y, 4, 5, fill=col_prim, outline=col_out)
            draw_pixel_box(draw, bx + 4, paw_r_y, 4, 5, fill=col_prim, outline=col_out)
        elif arms_pose == "happy_raise":
            draw_pixel_box(draw, bx - body_w//2 - 3, by - 6, 4, 8, fill=col_prim, outline=col_out)
            draw_pixel_box(draw, bx + body_w//2 - 1, by - 6, 4, 8, fill=col_prim, outline=col_out)
        elif arms_pose == "wave_right":
            draw_pixel_box(draw, bx - body_w//2 - 2, by + 2, 4, 6, fill=col_prim, outline=col_out)
            wave_x = bx + body_w//2 + (-2 if frame_idx % 2 == 0 else 2)
            draw_pixel_box(draw, wave_x, by - 8, 5, 7, fill=col_prim, outline=col_out)

    # ==================== 6. RENDER PROPS & SPECIES-SPECIFIC BEHAVIORS ====================
    for prop in props:
        ptype = prop[0]
        if ptype == "desk_laptop":
            px, py, kw, kh, fidx = prop[1], prop[2], prop[3], prop[4], prop[5]
            draw_pixel_box(draw, px, py + 4, kw, kh, fill=(110, 75, 45), outline=(50, 30, 15))
            draw_pixel_box(draw, px + 4, py + 2, kw - 8, 4, fill=(80, 85, 100), outline=(30, 35, 45))
            draw_pixel_box(draw, px + 6, py - 8, kw - 12, 10, fill=(30, 35, 45), outline=(15, 20, 25))
            draw_pixel_box(draw, px + 8, py - 6, kw - 16, 7, fill=(70, 180, 240))
        elif ptype == "zzz_sequence":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw.text((px, py), "Z", fill=(100, 160, 250))
        elif ptype == "sparkle":
            px, py = prop[1], prop[2]
            draw.line([(px, py - 4), (px, py + 4)], fill=(255, 220, 60), width=1)
            draw.line([(px - 4, py), (px + 4, py)], fill=(255, 220, 60), width=1)
        elif ptype == "crying_stream":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw_pixel_box(draw, px - 6, py + fidx * 2, 2, 3, fill=(100, 190, 255))
            draw_pixel_box(draw, px + 5, py + fidx * 2, 2, 3, fill=(100, 190, 255))
            draw.ellipse([px - 8, 54, px + 8, 58], fill=(100, 190, 255, 180))
        elif ptype == "food_bubble":
            px, py, fidx, spec = prop[1], prop[2], prop[3], prop[4]
            draw_pixel_circle(draw, px, py, 7, fill=(255, 255, 255, 230), outline=(40, 40, 50))
            if spec == "sheep":
                draw_pixel_box(draw, px - 3, py - 2, 6, 4, fill=(70, 180, 60))
            elif spec in ("cat", "penguin"):
                draw_pixel_box(draw, px - 3, py - 1, 6, 3, fill=(80, 150, 230))
            elif spec == "panda":
                draw_pixel_box(draw, px - 2, py - 3, 4, 6, fill=(75, 180, 70))
            elif spec == "hamster":
                draw_pixel_box(draw, px - 2, py - 2, 5, 4, fill=(220, 180, 100))
            elif spec == "rabbit":
                draw_pixel_box(draw, px - 2, py - 3, 4, 6, fill=(240, 120, 40))
            elif spec == "pig":
                draw_pixel_circle(draw, px, py, 3, fill=(230, 60, 60))
            elif spec == "fox":
                draw_pixel_circle(draw, px, py, 3, fill=(180, 50, 110))
            else:
                draw_pixel_box(draw, px - 3, py - 2, 6, 4, fill=(220, 120, 60))
        elif ptype == "species_food":
            px, py, bw, bh, fidx, spec = prop[1], prop[2], prop[3], prop[4], prop[5], prop[6]
            if spec == "sheep":
                draw_pixel_box(draw, px + 2, py + 2, 16, 5, fill=(75, 185, 60), outline=(30, 80, 25))
                draw.line([(px + 4, py), (px + 6, py + 3)], fill=(95, 215, 80), width=1)
                draw.line([(px + 12, py - 1), (px + 10, py + 3)], fill=(95, 215, 80), width=1)
            elif spec == "panda":
                draw_pixel_box(draw, px + 4, py - 2, 4, 14, fill=(75, 180, 70), outline=(30, 80, 30))
                draw.line([(px + 8, py + 2), (px + 12, py)], fill=(95, 215, 80), width=1)
            elif spec == "hamster":
                draw_pixel_box(draw, px + 6, py + 2, 6, 5, fill=(220, 180, 100), outline=(80, 60, 30))
            elif spec == "rabbit":
                draw.polygon([(px + 4, py + 6), (px + 14, py + 1), (px + 12, py + 7)], fill=(240, 120, 40), outline=(90, 40, 15))
                draw.line([(px + 14, py + 1), (px + 18, py - 2)], fill=(80, 190, 80), width=1)
            elif spec in ("cat", "penguin"):
                draw_pixel_box(draw, px + 2, py + 4, 16, 3, fill=(240, 240, 245), outline=(60, 60, 70))
                draw_pixel_box(draw, px + 5, py + 2, 8, 3, fill=(70, 150, 230), outline=(30, 60, 100))
            elif spec == "pig":
                draw_pixel_circle(draw, px + 8, py + 3, 5, fill=(220, 50, 60), outline=(50, 20, 20))
                draw.line([(px + 8, py - 2), (px + 10, py - 4)], fill=(80, 180, 80), width=1)
            else:
                draw.chord([px, py, px + bw, py + bh * 2], 0, 180, fill=(230, 80, 80), outline=col_out)
                draw_pixel_box(draw, px + 3, py + 1, bw - 6, 2, fill=(220, 160, 80))
        elif ptype == "laser_dot":
            px, py, fidx = prop[1], prop[2], prop[3]
            lx = [16, 48, 20, 44][fidx % 4]
            ly = [52, 48, 54, 50][fidx % 4]
            draw_pixel_circle(draw, lx, ly, 2, fill=(255, 40, 50))
            draw.point((lx, ly), fill=(255, 230, 230))
        elif ptype == "frisbee":
            px, py, fidx = prop[1], prop[2], prop[3]
            fx = [14, 28, 42, 50][fidx % 4]
            fy = [22, 18, 20, 26][fidx % 4]
            draw.ellipse([fx - 5, fy - 2, fx + 5, fy + 2], fill=(250, 200, 40), outline=(120, 80, 10))
        elif ptype == "hamster_wheel":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw.arc([10, 14, 54, 58], 0, 360, fill=(180, 200, 220), width=2)
            angle = (fidx * 45) % 180
            rad = math.radians(angle)
            draw.line([(32 - int(20*math.cos(rad)), 36 - int(20*math.sin(rad))), (32 + int(20*math.cos(rad)), 36 + int(20*math.sin(rad)))], fill=(150, 170, 190), width=1)
        elif ptype == "petting_hand":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw_pixel_box(draw, px, py, 12, 5, fill=(255, 225, 200), outline=(50, 40, 30))
        elif ptype == "water_mug":
            px, py, mw, mh, fidx = prop[1], prop[2], prop[3], prop[4], prop[5]
            draw_pixel_box(draw, px, py, mw, mh, fill=(120, 210, 255, 220), outline=(40, 50, 60))
            draw.line([(px + 4, py - 5), (px + 2, py + 4)], fill=(250, 100, 100), width=1)
        elif ptype == "sheep_fence":
            px, py, fidx = prop[1], prop[2], prop[3]
            # Wooden hurdle fence for sheep jumping!
            draw_pixel_box(draw, px - 12, py, 24, 6, fill=(160, 110, 70), outline=(60, 40, 20))
            draw_pixel_box(draw, px - 10, py - 4, 3, 10, fill=(140, 95, 60), outline=(60, 40, 20))
            draw_pixel_box(draw, px + 7, py - 4, 3, 10, fill=(140, 95, 60), outline=(60, 40, 20))
        elif ptype == "jumprope_cycle":
            px, py, fidx = prop[1], prop[2], prop[3]
            if fidx == 0:
                draw.arc([14, 8, 50, 40], 180, 360, fill=(240, 180, 50), width=1)
            elif fidx == 1:
                draw.line([(18, 28), (46, 28)], fill=(240, 180, 50), width=1)
            elif fidx == 2:
                draw.arc([14, 34, 50, 58], 0, 180, fill=(240, 180, 50), width=1)
            else:
                draw.arc([14, 18, 50, 54], 180, 360, fill=(240, 180, 50), width=1)
        elif ptype == "heart":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 3, py - 2), (px, py + 3), (px + 3, py - 2)], fill=(250, 70, 90))
            draw.point((px - 2, py - 3), fill=(250, 70, 90))
            draw.point((px + 2, py - 3), fill=(250, 70, 90))
        elif ptype == "music_note":
            px, py = prop[1], prop[2]
            draw_pixel_box(draw, px, py, 3, 2, fill=(130, 80, 230))
            draw.line([(px + 2, py), (px + 2, py + 6)], fill=(130, 80, 230), width=1)
        elif ptype == "party_hat":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 6, py + 6), (px, py - 8), (px + 6, py + 6)], fill=(255, 190, 40), outline=(40, 30, 10))
            draw.point((px, py - 9), fill=(255, 60, 60))
        elif ptype == "confetti_blizzard":
            px, py, fidx = prop[1], prop[2], prop[3]
            colors = [(255, 80, 80), (80, 220, 120), (240, 220, 40), (120, 160, 255), (250, 140, 220)]
            for i in range(8):
                cx = (px - 20 + (i * 7 + fidx * 5) % 44)
                cy = (py - 12 + (i * 9 + fidx * 8) % 36)
                draw.point((cx, cy), fill=colors[i % len(colors)])
        elif ptype == "evolution_aura":
            px, py, fidx = prop[1], prop[2], prop[3]
            for i in range(8):
                deg = (i * 45 + fidx * 25) % 360
                rad = math.radians(deg)
                ax = int(px + math.cos(rad) * 22)
                ay = int(py + math.sin(rad) * 18)
                if 0 <= ax < size and 0 <= ay < size:
                    draw_pixel_box(draw, ax - 1, ay - 1, 2, 2, fill=(255, 240, 100, 230))

    return img

def process_uploaded_image_to_pixel_sprite(image_path, target_max_dim=52):
    raw_img = ImageOps.exif_transpose(Image.open(image_path)).convert("RGBA")
    
    # High-precision background removal using OpenCV multi-seed floodfill and defringe
    bg_cleaned = False
    try:
        try:
            from smart_bg_remover import smart_remove_background
        except ImportError:
            from scripts.smart_bg_remover import smart_remove_background
        raw_img = smart_remove_background(raw_img, tolerance=26, defringe=True)
        bg_cleaned = True
    except Exception as bg_err:
        sys.stderr.write(f"smart_remove_background notice: {bg_err}\n")

    if not bg_cleaned:
        w, h = raw_img.size
        corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
        corner_colors = [raw_img.getpixel(pt) for pt in corners]
        is_solid_bg = all(c[3] > 240 for c in corner_colors)
        if is_solid_bg:
            avg_r = sum(c[0] for c in corner_colors) / 4.0
            avg_g = sum(c[1] for c in corner_colors) / 4.0
            avg_b = sum(c[2] for c in corner_colors) / 4.0
            new_pixels = []
            for p in raw_img.getdata():
                dist_squared = (p[0] - avg_r)**2 + (p[1] - avg_g)**2 + (p[2] - avg_b)**2
                if dist_squared < 32**2 or (avg_r > 235 and avg_g > 235 and avg_b > 235 and p[0] > 230 and p[1] > 230 and p[2] > 230):
                    new_pixels.append((p[0], p[1], p[2], 0))
                else:
                    new_pixels.append(p)
            raw_img.putdata(new_pixels)
        
    bbox = raw_img.getchannel("A").getbbox()
    if bbox:
        raw_img = raw_img.crop(bbox)
        
    cw, ch = raw_img.size
    scale = target_max_dim / float(max(cw, ch, 1))
    target_w = max(12, int(round(cw * scale)))
    target_h = max(12, int(round(ch * scale)))
    
    pixel_img = raw_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    try:
        try:
            from smart_bg_remover import clean_and_quantize_pixel_art
        except ImportError:
            from scripts.smart_bg_remover import clean_and_quantize_pixel_art
        return clean_and_quantize_pixel_art(pixel_img, max_colors=32, alpha_threshold=70)
    except Exception:
        alpha_channel = pixel_img.split()[3]
        rgb_version = pixel_img.convert("RGB")
        quantized = rgb_version.quantize(colors=24, method=Image.Quantize.MEDIANCUT).convert("RGBA")
        quantized.putalpha(alpha_channel)
        return quantized

def draw_image_based_frame(base_sprite, state, frame_idx, total_frames, size=64):
    frame = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    
    sw, sh = base_sprite.size
    
    bob_x = 0
    bob_y = 0
    scale_x = 1.0
    scale_y = 1.0
    rotation_deg = 0
    props = []
    
    # 1. IDLE / WALKING (Default): 6 frames (Loop)
    if state == "IDLE":
        bob_y = [0, -1, -2, -2, -1, 0][frame_idx % 6]
        scale_y = [1.0, 1.02, 1.03, 1.03, 1.02, 1.0][frame_idx % 6]
        scale_x = [1.0, 0.99, 0.98, 0.98, 0.99, 1.0][frame_idx % 6]
        
    # 2. SLEEPING / DOZING OFF: 4 frames (Loop)
    elif state == "SLEEPING":
        bob_y = [1, 2, 2, 1][frame_idx % 4]
        scale_y = [0.98, 0.97, 0.97, 0.98][frame_idx % 4]
        scale_x = [1.01, 1.02, 1.02, 1.01][frame_idx % 4]
        rotation_deg = [-1, -2, -2, -1][frame_idx % 4]
        props.append(("zzz_sequence", 42, 28, frame_idx % 4))
        
    # 3. HUNGRY: 4 frames (Loop)
    elif state == "HUNGRY":
        bob_x = [-1, 1, -1, 1][frame_idx % 4]
        bob_y = [1, 2, 1, 2][frame_idx % 4]
        scale_y = [0.98, 0.97, 0.98, 0.97][frame_idx % 4]
        props.append(("food_bubble", 44, 16, frame_idx % 4, "generic"))
        
    # 4. EATING / CHEWING: 6 frames (Loop)
    elif state == "EATING":
        bobs_y = [1, 2, 0, 1, -1, 0]
        rots = [-2, -3, 0, -2, 0, 0]
        s_y = [0.99, 0.97, 1.02, 0.98, 1.02, 1.0]
        s_x = [1.01, 1.02, 0.99, 1.01, 0.99, 1.0]
        f = frame_idx % 6
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        scale_x = s_x[f]
        props.append(("species_food", 22, 48, 20, 8, f, "generic"))
        if f in (2, 4):
            props.append(("sparkle", 48, 22, 0, 0))
            
    # 5. YAWNING / TIRED: 5 frames (One-shot)
    elif state == "YAWNING":
        bobs_y = [0, -1, -2, 0, 1]
        rots = [1, 3, 4, 2, 0]
        s_y = [1.0, 1.03, 1.05, 1.02, 0.99]
        f = frame_idx % 5
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        props.append(("yawn_bubble", 44, 26, f))
        
    # 6. WAKING UP: 6 frames (One-shot)
    elif state == "WAKING_UP":
        bobs_y = [2, 1, -2, -4, -1, 0]
        s_y = [0.97, 0.99, 1.04, 1.06, 1.01, 1.0]
        s_x = [1.02, 1.0, 0.98, 0.96, 1.0, 1.0]
        f = frame_idx % 6
        bob_y = bobs_y[f]
        scale_y = s_y[f]
        scale_x = s_x[f]
        if f >= 3:
            props.append(("sparkle", 48, 16, 0, 0))
        if f >= 4:
            props.append(("sparkle", 16, 18, 0, 0))
            
    # 7. TYPING / FOCUSING: 4 frames (Loop)
    elif state == "TYPING":
        bob_y = [1, 0, 1, 0][frame_idx % 4]
        bob_x = [-1, 0, 1, 0][frame_idx % 4]
        rotation_deg = [-2, -1, 1, 0][frame_idx % 4]
        props.append(("desk_laptop", 18, 46, 28, 12, frame_idx % 4))
        
    # 8. EXERCISING / STRETCHING: 8 frames (Loop)
    elif state == "EXERCISING":
        bobs_x = [-2, -3, 0, 0, 2, 3, 0, 0]
        bobs_y = [1, -2, 1, -6, 1, -2, 1, -1]
        rots = [-3, -4, 0, 0, 3, 4, 0, 0]
        s_y = [0.99, 1.02, 0.98, 1.04, 0.99, 1.02, 0.98, 1.01]
        f = frame_idx % 8
        bob_x = bobs_x[f]
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        if f in (1, 3, 5):
            props.append(("sweat_drop", 48, 20, f))
            
    # 9. DRINKING / HOLDING A CUP: 4 frames (Loop)
    elif state == "DRINKING":
        bob_y = [0, -1, -2, 0][frame_idx % 4]
        rotation_deg = [0, 2, 3, 0][frame_idx % 4]
        props.append(("water_mug", 30, 38, 10, 13, frame_idx % 4))
        if frame_idx % 4 == 3:
            props.append(("sparkle", 48, 22, 0, 0))
            
    # 10. REACTING TO PETTING: 5 frames (One-shot / phản hồi)
    elif state == "PETTING":
        bobs_y = [0, 2, 3, 1, -1]
        rots = [0, -2, -3, 2, 0]
        s_y = [1.0, 0.98, 0.97, 1.01, 1.03]
        f = frame_idx % 5
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        props.append(("petting_hand", 24 + [0, 2, 4, 2, 1][f], 14, f))
        if f >= 1:
            props.append(("heart", 46, 18 - (f % 3) * 2, 0, 0))
        if f == 4:
            props.append(("heart", 18, 20, 0, 0))
            
    # 11. WAVING (ATTENTION SEEKING): 4 frames (Loop)
    elif state == "WAVING":
        bob_x = [-1, 0, 1, 0][frame_idx % 4]
        bob_y = [0, -1, 0, -1][frame_idx % 4]
        rotation_deg = [-2, 0, 2, 0][frame_idx % 4]
        props.append(("wave_swoosh", 46, 22, frame_idx % 4))
        wave_x = 44 + (-2 if frame_idx % 2 == 0 else 2)
        draw_pixel_circle(draw, wave_x, 26, 4, fill=(245, 230, 210), outline=(50, 40, 30))
        
    # 12. DANCING: 8 frames (Loop)
    elif state == "DANCING":
        bobs_x = [-3, -2, 0, 0, 3, 2, 0, 0]
        bobs_y = [-1, -4, -2, -6, -1, -4, -2, -5]
        rots = [-4, -3, 0, 0, 4, 3, 0, 0]
        s_y = [1.0, 1.02, 0.99, 1.04, 1.0, 1.02, 0.99, 1.04]
        f = frame_idx % 8
        bob_x = bobs_x[f]
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        props.append(("music_note", 12, 18 + (f % 2) * 4, 0, 0))
        props.append(("music_note", 50, 16 - (f % 2) * 4, 0, 0))
        
    # 13. EXPRESSING GRATITUDE: 4 frames (One-shot)
    elif state == "THANKING":
        bobs_y = [0, 2, 3, 1]
        rots = [0, -3, -5, -1]
        s_y = [1.0, 0.98, 0.96, 1.0]
        f = frame_idx % 4
        bob_y = bobs_y[f]
        rotation_deg = rots[f]
        scale_y = s_y[f]
        if f in (1, 2, 3):
            props.append(("heart", 32, 16 - f * 2, 0, 0))
            
    # 14. HAPPY / EXCITED: 4 frames (Loop)
    elif state == "HAPPY":
        bobs_y = [2, -6, -8, -1]
        s_y = [0.97, 1.04, 1.03, 0.99]
        s_x = [1.03, 0.98, 0.99, 1.01]
        f = frame_idx % 4
        bob_y = bobs_y[f]
        scale_y = s_y[f]
        scale_x = s_x[f]
        if f in (1, 2):
            props.append(("sparkle", 12, 16, 0, 0))
            props.append(("sparkle", 52, 14, 0, 0))
        else:
            props.append(("sparkle", 32, 14, 0, 0))
            
    # 15. SAD / CRYING / SIGHING: 5 frames (One-shot)
    elif state == "SAD":
        bobs_y = [1, 2, 3, 2, 2]
        bobs_x = [0, 0, 0, 1, -1]
        s_y = [0.99, 0.98, 0.97, 0.97, 0.98]
        f = frame_idx % 5
        bob_y = bobs_y[f]
        bob_x = bobs_x[f]
        scale_y = s_y[f]
        props.append(("crying_stream", 32, 42, f))
        
    # 16. CELEBRATING: 6 frames (One-shot)
    elif state == "CELEBRATING":
        bobs_y = [2, -5, -8, -6, 0, -2]
        s_y = [0.97, 1.04, 1.04, 1.02, 0.98, 1.02]
        f = frame_idx % 6
        bob_y = bobs_y[f]
        scale_y = s_y[f]
        props.append(("party_hat", 32 + bob_x, 18 + bob_y, 0, 0))
        props.append(("confetti_blizzard", 32, 24, f))
        
    # 17. EVOLVING / LEVELING UP: 12 frames (One-shot)
    elif state == "EVOLVING":
        levitate = [0, -2, -4, -6, -8, -9, -9, -8, -6, -4, -2, 0]
        pulse = [1.0, 1.01, 1.02, 1.03, 1.04, 1.05, 1.05, 1.04, 1.03, 1.02, 1.01, 1.0]
        f = frame_idx % 12
        bob_y = levitate[f]
        scale_x = pulse[f]
        scale_y = pulse[f]
        props.append(("evolution_aura", 32, 36 + bob_y, f))
        if f in (4, 5, 6, 7):
            props.append(("sparkle", 16, 20 + bob_y, 0, 0))
            props.append(("sparkle", 48, 20 + bob_y, 0, 0))

    shadow_w = int(28 * (0.7 if bob_y < -6 else 1.0))
    draw.ellipse([32 - shadow_w//2, 54, 32 + shadow_w//2, 59], fill=(0, 0, 0, 45))
    
    curr_w = max(10, int(round(sw * scale_x)))
    curr_h = max(8, int(round(sh * scale_y)))
    
    transformed_sprite = base_sprite.resize((curr_w, curr_h), Image.Resampling.NEAREST)
    if rotation_deg != 0:
        transformed_sprite = transformed_sprite.rotate(rotation_deg, resample=Image.Resampling.NEAREST, expand=True)
        
    tw, th = transformed_sprite.size
    paste_x = 32 - tw // 2 + bob_x
    paste_y = 54 - th + bob_y
    frame.paste(transformed_sprite, (paste_x, paste_y), transformed_sprite)
        
    for prop in props:
        ptype = prop[0]
        if ptype == "desk_laptop":
            px, py, kw, kh, fidx = prop[1], prop[2], prop[3], prop[4], prop[5]
            draw_pixel_box(draw, px, py + 4, kw, kh, fill=(110, 75, 45), outline=(50, 30, 15))
            draw_pixel_box(draw, px + 4, py + 2, kw - 8, 4, fill=(80, 85, 100), outline=(30, 35, 45))
            draw_pixel_box(draw, px + 6, py - 8, kw - 12, 10, fill=(30, 35, 45), outline=(15, 20, 25))
            screen_glow = (70, 180, 240) if fidx % 2 == 0 else (100, 210, 255)
            draw_pixel_box(draw, px + 8, py - 6, kw - 16, 7, fill=screen_glow)
        elif ptype == "zzz_sequence":
            px, py, fidx = prop[1], prop[2], prop[3]
            offsets = [(0, 0), (2, -5), (5, -11), (8, -17)]
            ox, oy = offsets[min(fidx, len(offsets) - 1)]
            draw.text((px + ox, py + oy), "Z", fill=(100, 160, 250))
            if fidx >= 2:
                draw.text((px + ox - 5, py + oy + 4), "z", fill=(140, 190, 255))
        elif ptype == "sparkle":
            px, py = prop[1], prop[2]
            draw.line([(px, py - 4), (px, py + 4)], fill=(255, 220, 60), width=1)
            draw.line([(px - 4, py), (px + 4, py)], fill=(255, 220, 60), width=1)
            draw.point((px, py), fill=(255, 255, 255))
        elif ptype == "crying_stream":
            px, py, fidx = prop[1], prop[2], prop[3]
            drop_y = py + fidx * 2
            draw_pixel_box(draw, px - 6, drop_y, 2, 3, fill=(100, 190, 255))
            draw_pixel_box(draw, px + 5, drop_y, 2, 3, fill=(100, 190, 255))
            puddle_w = 6 + fidx * 2
            draw.ellipse([px - puddle_w, 54, px + puddle_w, 58], fill=(100, 190, 255, 180))
        elif ptype == "food_bubble":
            px, py, fidx, spec = prop[1], prop[2], prop[3], prop[4]
            draw_pixel_circle(draw, px, py, 7, fill=(255, 255, 255, 230), outline=(40, 40, 50))
            draw_pixel_circle(draw, px - 6, py + 7, 2, fill=(255, 255, 255, 230), outline=(40, 40, 50))
            draw_pixel_box(draw, px - 3, py - 2, 6, 4, fill=(230, 110, 50))
            draw.point((px - 1, py - 3), fill=(255, 200, 120))
        elif ptype == "species_food":
            px, py, bw, bh, fidx, spec = prop[1], prop[2], prop[3], prop[4], prop[5], prop[6]
            draw.chord([px, py, px + bw, py + bh * 2], 0, 180, fill=(230, 80, 80), outline=(30, 20, 20))
            food_color = (220, 160, 80) if fidx < 4 else (200, 140, 70)
            draw_pixel_box(draw, px + 3, py + 1, bw - 6, 2, fill=food_color)
        elif ptype == "yawn_bubble":
            px, py, fidx = prop[1], prop[2], prop[3]
            r = 3 + min(fidx, 2) * 2
            draw_pixel_circle(draw, px, py, r, fill=(200, 230, 255, 160), outline=(100, 150, 230))
        elif ptype == "wave_swoosh":
            px, py, fidx = prop[1], prop[2], prop[3]
            wx = px + (fidx % 2) * 3
            draw.arc([wx - 4, py - 4, wx + 4, py + 4], 270, 90, fill=(180, 200, 230), width=1)
        elif ptype == "sweat_drop":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw_pixel_box(draw, px, py, 2, 3, fill=(100, 200, 255), outline=(40, 100, 180))
        elif ptype == "petting_hand":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw_pixel_box(draw, px, py, 12, 5, fill=(255, 225, 200), outline=(50, 40, 30))
            draw_pixel_box(draw, px + 2, py + 3, 8, 3, fill=(245, 210, 185))
        elif ptype == "water_mug":
            px, py, mw, mh, fidx = prop[1], prop[2], prop[3], prop[4], prop[5]
            draw_pixel_box(draw, px, py, mw, mh, fill=(120, 210, 255, 220), outline=(40, 50, 60))
            draw.line([(px + 4, py - 5), (px + 2, py + 4)], fill=(250, 100, 100), width=1)
        elif ptype == "heart":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 3, py - 2), (px, py + 3), (px + 3, py - 2)], fill=(250, 70, 90))
            draw.point((px - 2, py - 3), fill=(250, 70, 90))
            draw.point((px + 2, py - 3), fill=(250, 70, 90))
        elif ptype == "music_note":
            px, py = prop[1], prop[2]
            draw_pixel_box(draw, px, py, 3, 2, fill=(130, 80, 230))
            draw.line([(px + 2, py), (px + 2, py + 6)], fill=(130, 80, 230), width=1)
        elif ptype == "party_hat":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 6, py + 6), (px, py - 8), (px + 6, py + 6)], fill=(255, 190, 40), outline=(40, 30, 10))
            draw.point((px, py - 9), fill=(255, 60, 60))
        elif ptype == "confetti_blizzard":
            px, py, fidx = prop[1], prop[2], prop[3]
            colors = [(255, 80, 80), (80, 220, 120), (240, 220, 40), (120, 160, 255), (250, 140, 220)]
            for i in range(10):
                cx = (px - 22 + (i * 7 + fidx * 5) % 44)
                cy = (py - 14 + (i * 9 + fidx * 7) % 36)
                draw.point((cx, cy), fill=colors[i % len(colors)])
        elif ptype == "evolution_aura":
            px, py, fidx = prop[1], prop[2], prop[3]
            for i in range(12):
                deg = (i * 30 + fidx * 20) % 360
                rad = math.radians(deg)
                ax = int(px + math.cos(rad) * 22)
                ay = int(py + math.sin(rad) * 18)
                if 0 <= ax < size and 0 <= ay < size:
                    col = (255, 240, 100, 230) if i % 2 == 0 else (120, 230, 255, 230)
                    draw_pixel_box(draw, ax - 1, ay - 1, 2, 2, fill=col)

    return frame

def build_sprite_sheet_from_image(image_path, output_dir, name, prompt=""):
    os.makedirs(output_dir, exist_ok=True)
    pixel_master = process_uploaded_image_to_pixel_sprite(image_path, target_max_dim=52)
    
    frame_size = DEFAULT_FRAME_SIZE
    cols = MAX_COLUMNS
    rows = len(ANIMATION_STATES)
    
    sheet_w = cols * frame_size
    sheet_h = rows * frame_size
    sheet_img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    animations_meta = {}
    
    for row_idx, state in enumerate(ANIMATION_STATES):
        spec = STATE_SPEC[state]
        num_frames = spec["frames"]
        fps = spec["fps"]
        loop = spec["loop"]
        state_frames = []
        for col_idx in range(num_frames):
            frame_idx = row_idx * cols + col_idx
            frame_img = draw_image_based_frame(pixel_master, state, col_idx, num_frames, size=frame_size)
            
            paste_x = col_idx * frame_size
            paste_y = row_idx * frame_size
            sheet_img.paste(frame_img, (paste_x, paste_y), frame_img)
            state_frames.append(frame_idx)
            
        animations_meta[state] = {
            "row": row_idx,
            "frames": state_frames,
            "fps": fps,
            "loop": loop
        }
    animations_meta["WALKING"] = {**animations_meta["IDLE"], "fps": 8}
        
    sheet_filename = f"{name}_spritesheet.png"
    sheet_path = os.path.join(output_dir, sheet_filename)
    sheet_img.save(sheet_path, "PNG")
    
    preview_filename = f"{name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    preview_frame = sheet_img.crop((0, 0, frame_size, frame_size))
    preview_large = preview_frame.resize((128, 128), Image.NEAREST)
    preview_large.save(preview_path, "PNG")
    
    frame_config = {
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "totalColumns": cols,
        "totalRows": rows,
        "totalFrames": cols * rows,
        "framesPerState": 6,
        "activeFramesCount": sum(STATE_SPEC[s]["frames"] for s in ANIMATION_STATES),
        "renderScale": {
            "minWidth": 100,
            "maxWidth": 150,
            "minHeight": 100,
            "maxHeight": 150,
            "defaultWidth": 120,
            "defaultHeight": 120
        },
        "naturalAspectRatio": 1.0,
        "palette": "custom_image"
    }
    
    result = {
        "name": name,
        "prompt": prompt or f"Sinh từ hình ảnh tải lên: {os.path.basename(image_path)}",
        "animalType": "custom_image",
        "sheetUrl": f"/sprites/{sheet_filename}",
        "previewUrl": f"/sprites/{preview_filename}",
        "naturalAspectRatio": 1.0,
        "frameConfig": frame_config,
        "animations": animations_meta,
        "statesCount": len(ANIMATION_STATES)
    }
    
    meta_json_path = os.path.join(output_dir, f"{name}_meta.json")
    with open(meta_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(json.dumps(result, ensure_ascii=True))
    return result

def _find_sprite_row_boundaries(sheet, rows):
    width, height = sheet.size
    pixels = sheet.load()
    row_ink = []
    for y in range(height):
        ink = 0
        for x in range(width):
            pixel = pixels[x, y]
            if pixel[3] > 10 and min(pixel[:3]) < 235:
                ink += 1
        row_ink.append(ink)

    best_groups = None
    for thresh in range(0, 16):
        active = [ink > thresh for ink in row_ink]
        groups = []
        start = None
        for y, is_act in enumerate(active + [False]):
            if is_act and start is None:
                start = y
            elif not is_act and start is not None:
                if (y - start) >= 6:
                    groups.append((start, y - 1))
                start = None
        if len(groups) == rows:
            best_groups = groups
            break
        elif len(groups) == rows - 1 and best_groups is None:
            best_groups = groups

    # If rows - 1 detected, inspect if the tallest group is two merged rows and split it
    if best_groups and len(best_groups) == rows - 1:
        import numpy as np
        heights = [g[1] - g[0] + 1 for g in best_groups]
        med_h = np.median(heights)
        tallest_idx = int(np.argmax(heights))
        if heights[tallest_idx] > 1.35 * med_h:
            s, e = best_groups[tallest_idx]
            margin = max(4, int((e - s + 1) * 0.2))
            if e - margin > s + margin:
                min_y = min(range(s + margin, e - margin + 1), key=lambda y: row_ink[y])
                best_groups = best_groups[:tallest_idx] + [(s, min_y - 1), (min_y, e)] + best_groups[tallest_idx + 1:]

    if not best_groups:
        return [round(index * height / rows) for index in range(rows + 1)], None

    boundaries = [0]
    for previous_group, next_group in zip(best_groups, best_groups[1:]):
        boundaries.append((previous_group[1] + next_group[0]) // 2)
    boundaries.append(height)
    return boundaries, len(best_groups)


def _extract_row_frames(sheet, row_top, row_bottom, expected_frames, target_size=64):
    """
    Extracts exactly `expected_frames` from a row region of the sheet.
    Handles:
    - Standard 64x64 grid (cells at c * 64)
    - Ink-cluster detection for arbitrarily spaced frames
    - Fallback uniform column division
    Guarantees returning `expected_frames` frames sized target_size x target_size.
    """
    width = sheet.width
    row_height = row_bottom - row_top
    row_img = sheet.crop((0, row_top, width, row_bottom))
    
    is_exact_grid = (
        abs(row_height - target_size) <= 4 and
        width >= expected_frames * target_size and
        (width % target_size == 0 or abs(width - 12 * target_size) <= 4 or abs(width - expected_frames * target_size) <= 4)
    )
    
    pixels = row_img.load()
    col_ink = []
    for x in range(width):
        ink = 0
        for y in range(row_img.height):
            p = pixels[x, y]
            if p[3] > 10 and min(p[:3]) < 240:
                ink += 1
        col_ink.append(ink)
        
    frames = []
    if is_exact_grid:
        for c in range(expected_frames):
            left = c * target_size
            right = min(left + target_size, width)
            cell = row_img.crop((left, 0, right, min(row_img.height, target_size)))
            if cell.size != (target_size, target_size):
                framed = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
                framed.paste(cell, (0, target_size - cell.height))
                cell = framed
            frames.append(cell)
        return frames

    # Ink cluster detection on the row:
    best_clusters = None
    for thresh in range(0, 16):
        active = [ink > thresh for ink in col_ink]
        clusters = []
        start = None
        for x, act in enumerate(active + [False]):
            if act and start is None:
                start = x
            elif not act and start is not None:
                if (x - start) >= 4:
                    clusters.append((start, x - 1))
                start = None
        if len(clusters) == expected_frames:
            best_clusters = clusters
            break

    if best_clusters and len(best_clusters) == expected_frames:
        for start_x, end_x in best_clusters:
            margin = 2
            c_left = max(0, start_x - margin)
            c_right = min(width, end_x + 1 + margin)
            raw_frame = row_img.crop((c_left, 0, c_right, row_img.height))
            bbox = raw_frame.getchannel("A").getbbox()
            if bbox:
                raw_frame = raw_frame.crop(bbox)
            
            cw, ch = raw_frame.size
            scale = min(float(target_size) / max(cw, 1), float(target_size) / max(ch, 1), 1.0)
            if scale < 1.0 or (cw < target_size // 2 and ch < target_size // 2):
                scale = min(56.0 / max(cw, 1), 56.0 / max(ch, 1))
                tw = max(1, int(round(cw * scale)))
                th = max(1, int(round(ch * scale)))
                resized = raw_frame.resize((tw, th), Image.Resampling.NEAREST)
            else:
                resized = raw_frame
                tw, th = resized.size
                
            framed = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
            paste_x = (target_size - tw) // 2
            paste_y = target_size - th
            framed.paste(resized, (paste_x, paste_y))
            frames.append(framed)
        return frames

    cell_step = 64 if width >= expected_frames * 64 else (width / float(expected_frames))
    for c in range(expected_frames):
        left = int(round(c * cell_step))
        right = int(round((c + 1) * cell_step))
        right = min(right, width)
        raw_frame = row_img.crop((left, 0, right, row_img.height))
        
        bbox = raw_frame.getchannel("A").getbbox()
        if bbox and (bbox[2] - bbox[0] > 2) and (bbox[3] - bbox[1] > 2):
            cropped_content = raw_frame.crop(bbox)
            cw, ch = cropped_content.size
            if cw > target_size or ch > target_size:
                scale = min(float(target_size) / cw, float(target_size) / ch)
                tw = max(1, int(round(cw * scale)))
                th = max(1, int(round(ch * scale)))
                cropped_content = cropped_content.resize((tw, th), Image.Resampling.NEAREST)
            framed = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
            paste_x = (target_size - cropped_content.width) // 2
            paste_y = target_size - cropped_content.height
            framed.paste(cropped_content, (paste_x, paste_y))
            frames.append(framed)
        else:
            if raw_frame.size != (target_size, target_size):
                scaled = raw_frame.resize((target_size, target_size), Image.Resampling.NEAREST)
                frames.append(scaled)
            else:
                frames.append(raw_frame)

    return frames


def _remove_edge_connected_white_background(sheet, threshold=240):
    try:
        from smart_bg_remover import smart_remove_background
    except ImportError:
        try:
            from scripts.smart_bg_remover import smart_remove_background
        except ImportError:
            # Fallback if module cannot be imported
            red, green, blue, alpha = sheet.split()
            white_candidates = ImageChops.darker(
                ImageChops.darker(red, green),
                blue
            ).point(lambda value: 255 if value >= threshold else 0)
            opaque_pixels = alpha.point(lambda value: 255 if value > 0 else 0)
            white_candidates = ImageChops.darker(white_candidates, opaque_pixels)
            width, height = sheet.size
            for x in range(width):
                for y in (0, height - 1):
                    if white_candidates.getpixel((x, y)) == 255:
                        ImageDraw.floodfill(white_candidates, (x, y), 128, thresh=0)
            for y in range(1, height - 1):
                for x in (0, width - 1):
                    if white_candidates.getpixel((x, y)) == 255:
                        ImageDraw.floodfill(white_candidates, (x, y), 128, thresh=0)
            removed_background = white_candidates.point(lambda value: 255 if value == 128 else 0)
            if removed_background.getbbox():
                sheet.putalpha(ImageChops.subtract(alpha, removed_background))
                return sheet, True
            return sheet, False

    result = smart_remove_background(sheet, tolerance=28, defringe=True, is_sprite_sheet=True)
    return result, True


def inspect_imported_sprite_sheet(image_path, output_dir, name, sheet_url, allow_missing_state_fallback=False):
    os.makedirs(output_dir, exist_ok=True)
    try:
        with Image.open(image_path) as source:
            sheet = source.convert("RGBA")
    except Exception as error:
        return {"error": f"Không thể đọc ảnh sprite sheet: {error}"}

    sheet, background_removed = _remove_edge_connected_white_background(sheet)
    rows = len(ANIMATION_STATES)
    target_frame_size = DEFAULT_FRAME_SIZE
    max_columns = MAX_COLUMNS

    # Check row boundaries
    # If the sheet height is exactly rows * 64 (1088), grid is direct
    if abs(sheet.height - rows * target_frame_size) <= 4:
        row_boundaries = [r * target_frame_size for r in range(rows + 1)]
        detected_row_count = rows
    else:
        row_boundaries, detected_row_count = _find_sprite_row_boundaries(sheet, rows)

    if detected_row_count == rows - 1 and not allow_missing_state_fallback:
        return {
            "error": (
                "Ảnh chỉ có 16 hàng nội dung; sprite sheet cần đủ 17 hàng trạng thái theo danh sách "
                "để gán frame chuẩn xác."
            )
        }

    source_row_indexes = list(range(rows))
    alignment_warning = None
    if detected_row_count == rows - 1:
        source_row_indexes = list(range(rows - 1))
        # Reuse food row for hungry/eating if missing 1 row
        source_row_indexes.insert(3, 2)
        alignment_warning = (
            "Ảnh nguồn chỉ có 16 hàng nội dung; HUNGRY và EATING dùng chung hàng thức ăn."
        )

    try:
        from smart_bg_remover import smart_remove_background
    except ImportError:
        try:
            from scripts.smart_bg_remover import smart_remove_background
        except ImportError:
            smart_remove_background = None

    normalized = Image.new("RGBA", (target_frame_size * max_columns, target_frame_size * rows), (0, 0, 0, 0))
    animations = {}

    for output_row, source_row in enumerate(source_row_indexes):
        state = ANIMATION_STATES[output_row]
        spec = STATE_SPEC[state]
        num_frames = spec["frames"]
        top = row_boundaries[source_row]
        bottom = row_boundaries[source_row + 1]

        row_frames = _extract_row_frames(sheet, top, bottom, num_frames, target_size=target_frame_size)

        state_frame_indices = []
        for col_idx, frame in enumerate(row_frames):
            if smart_remove_background:
                frame = smart_remove_background(frame, tolerance=24, defringe=True, is_sprite_sheet=False)
            dest_x = col_idx * target_frame_size
            dest_y = output_row * target_frame_size
            normalized.paste(frame, (dest_x, dest_y))
            state_frame_indices.append(output_row * max_columns + col_idx)

        animations[state] = {
            "row": output_row,
            "frames": state_frame_indices,
            "fps": spec["fps"],
            "loop": spec["loop"]
        }
    animations["WALKING"] = {**animations["IDLE"], "fps": 8}

    normalized_path = os.path.join(output_dir, f"{name}_spritesheet.png")
    try:
        normalized.save(normalized_path, "PNG")
    except Exception as error:
        return {"error": f"Không thể lưu sprite sheet đã xử lý nền: {error}"}

    preview_filename = f"{name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    preview = normalized.crop((0, 0, target_frame_size, target_frame_size))
    if smart_remove_background:
        preview = smart_remove_background(preview, tolerance=24, defringe=True, is_sprite_sheet=False)
    preview.resize((128, 128), Image.Resampling.NEAREST).save(preview_path, "PNG")

    frame_config = {
        "frameWidth": target_frame_size,
        "frameHeight": target_frame_size,
        "totalColumns": max_columns,
        "totalRows": rows,
        "totalFrames": max_columns * rows,
        "framesPerState": 6,
        "activeFramesCount": sum(STATE_SPEC[s]["frames"] for s in ANIMATION_STATES),
        "renderScale": {
            "minWidth": 100,
            "maxWidth": 150,
            "minHeight": 100,
            "maxHeight": 150,
            "defaultWidth": 120,
            "defaultHeight": 120
        },
        "naturalAspectRatio": 1.0,
        "palette": "imported_sprite_sheet",
        "sourceRowCount": detected_row_count,
        "alignmentWarning": alignment_warning,
        "backgroundRemoved": background_removed
    }

    return {
        "name": name,
        "sheetUrl": f"/sprites/{name}_spritesheet.png",
        "previewUrl": f"/sprites/{preview_filename}",
        "naturalAspectRatio": 1.0,
        "frameConfig": frame_config,
        "animations": animations,
        "statesCount": len(ANIMATION_STATES)
    }

def translate_prompt_keywords(text):
    mapping = {
        'hiệp sĩ': 'knight warrior',
        'hiep si': 'knight warrior',
        'kiếm': 'sword',
        'kiem': 'sword',
        'mèo': 'cat',
        'meo': 'cat',
        'chó': 'dog puppy',
        'cho': 'dog puppy',
        'thỏ': 'rabbit bunny',
        'tho': 'rabbit bunny',
        'cáo': 'fox',
        'cao': 'fox',
        'rồng': 'dragon',
        'rong': 'dragon',
        'quái vật': 'monster creature',
        'quai vat': 'monster creature',
        'giáp': 'armor',
        'giap': 'armor',
        'vương miện': 'crown',
        'vuong mien': 'crown',
        'nón': 'hat',
        'non': 'hat',
        'đen': 'black',
        'den': 'black',
        'trắng': 'white',
        'trang': 'white',
        'vàng': 'golden blonde',
        'vang': 'golden blonde',
        'xanh dương': 'blue',
        'xanh duong': 'blue',
        'xanh lá': 'green',
        'xanh la': 'green',
        'đỏ': 'red',
        'do': 'red',
        'hồng': 'pink',
        'hong': 'pink'
    }
    lower = text.lower()
    extras = [v for k, v in mapping.items() if k in lower]
    return text + (', ' + ', '.join(extras) if extras else '')

def fetch_pollinations_ai_image(prompt, output_path, timeout=30):
    """
    Fetches a high-definition 2D pixel art master character from Pollinations.ai (FLUX model).
    """
    try:
        import urllib.request
        import urllib.parse
        import random
        
        enriched = translate_prompt_keywords(prompt.strip())
        enhanced_prompt = f"{enriched}, full body game character, 2d pixel art sprite, solid clean white background, retro game asset, high detail"
        encoded = urllib.parse.quote(enhanced_prompt)
        seed = random.randint(10000, 999999)
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=512&height=512&model=flux&nologo=true&seed={seed}"
        
        sys.stderr.write(f"Connecting to Pollinations.ai (FLUX) with prompt: {enhanced_prompt[:80]}...\n")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            if len(data) > 1000:
                with open(output_path, "wb") as f:
                    f.write(data)
                sys.stderr.write(f"Successfully generated AI master image: {len(data)} bytes\n")
                return True
    except Exception as e:
        sys.stderr.write(f"Pollinations AI fetch notice: {e}\n")
    return False

def build_full_sprite_sheet(prompt, output_dir, name, force_ai_image=False):
    os.makedirs(output_dir, exist_ok=True)
    
    blueprint = analyze_character_blueprint(prompt)
    species = blueprint["species"]
    
    # High-quality Parametric Pixel Art Engine is the primary engine for pets
    # Known pet species are always drawn with authentic frame-by-frame anatomical animation
    KNOWN_PET_SPECIES = {"sheep", "penguin", "pigeon", "cat", "corgi", "husky", "rabbit", "panda", "dragon", "fox", "hamster", "duck", "pig"}
    
    if force_ai_image or (species not in KNOWN_PET_SPECIES and any(w in prompt.lower() for w in ["ai master", "flux", "chibi anime"])):
        ai_master_path = os.path.join(output_dir, f"{name}_ai_master.jpg")
        if fetch_pollinations_ai_image(prompt, ai_master_path):
            try:
                return build_sprite_sheet_from_image(ai_master_path, output_dir, name, prompt=prompt)
            except Exception as err:
                sys.stderr.write(f"Failed to build sprite sheet from AI image, falling back to procedural: {err}\n")

    # Procedural Parametric Pixel Art Engine (Real frame-by-frame pixel art animation)
    palette = blueprint["palette"]
    
    frame_size = DEFAULT_FRAME_SIZE
    cols = MAX_COLUMNS
    rows = len(ANIMATION_STATES)
    
    sheet_w = cols * frame_size
    sheet_h = rows * frame_size
    sheet_img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    animations_meta = {}
    
    for row_idx, state in enumerate(ANIMATION_STATES):
        spec = STATE_SPEC[state]
        num_frames = spec["frames"]
        fps = spec["fps"]
        loop = spec["loop"]
        state_frames = []
        for col_idx in range(num_frames):
            frame_idx = row_idx * cols + col_idx
            frame_img = draw_pet_frame(state, col_idx, num_frames, palette, species, prompt=prompt, size=frame_size)
            
            paste_x = col_idx * frame_size
            paste_y = row_idx * frame_size
            sheet_img.paste(frame_img, (paste_x, paste_y), frame_img)
            state_frames.append(frame_idx)
            
        animations_meta[state] = {
            "row": row_idx,
            "frames": state_frames,
            "fps": fps,
            "loop": loop
        }
    animations_meta["WALKING"] = {**animations_meta["IDLE"], "fps": 8}
        
    sheet_filename = f"{name}_spritesheet.png"
    sheet_path = os.path.join(output_dir, sheet_filename)
    sheet_img.save(sheet_path, "PNG")
    
    preview_filename = f"{name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    preview_frame = sheet_img.crop((0, 0, frame_size, frame_size))
    preview_large = preview_frame.resize((128, 128), Image.NEAREST)
    preview_large.save(preview_path, "PNG")
    
    frame_config = {
        "frameWidth": frame_size,
        "frameHeight": frame_size,
        "totalColumns": cols,
        "totalRows": rows,
        "totalFrames": cols * rows,
        "framesPerState": 6,
        "activeFramesCount": sum(STATE_SPEC[s]["frames"] for s in ANIMATION_STATES),
        "renderScale": {
            "minWidth": 100,
            "maxWidth": 150,
            "minHeight": 100,
            "maxHeight": 150,
            "defaultWidth": 120,
            "defaultHeight": 120
        },
        "naturalAspectRatio": 1.0,
        "palette": species
    }
    
    result = {
        "name": name,
        "prompt": prompt,
        "animalType": species,
        "sheetUrl": f"/sprites/{sheet_filename}",
        "previewUrl": f"/sprites/{preview_filename}",
        "naturalAspectRatio": 1.0,
        "frameConfig": frame_config,
        "animations": animations_meta,
        "statesCount": len(ANIMATION_STATES)
    }
    
    meta_json_path = os.path.join(output_dir, f"{name}_meta.json")
    with open(meta_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
        
    print(json.dumps(result, ensure_ascii=True))
    return result

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--spec":
        spec_path = sys.argv[2]
        with open(spec_path, "r", encoding="utf-8-sig") as f:
            spec = json.load(f)
        output_dir = spec.get("outputDir", "./sprites")
        name = spec.get("name", "custom_pet")
        prompt = spec.get("prompt", "")
        image_path = spec.get("imagePath")

        if spec.get("action") == "inspect_sprite_sheet":
            if not image_path or not os.path.exists(image_path):
                print(json.dumps({"error": "Không tìm thấy file sprite sheet cần kiểm tra."}, ensure_ascii=True))
                sys.exit(1)
            result = inspect_imported_sprite_sheet(
                image_path,
                output_dir,
                name,
                spec.get("sheetUrl", ""),
                spec.get("allowMissingStateFallback", False)
            )
            if result.get("error"):
                print(json.dumps(result, ensure_ascii=True))
                sys.exit(0)
            print(json.dumps(result, ensure_ascii=True))
        elif image_path:
            print(json.dumps({"error": "Ảnh đơn không thể thay thế sprite sheet; hãy nhập sheet 17 hàng trạng thái theo danh sách (mỗi ô 64x64 px)."}, ensure_ascii=True))
            sys.exit(1)
        else:
            build_full_sprite_sheet(prompt, output_dir, name)
        sys.exit(0)
        
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: generate_sprite_forge.py <prompt> <name> <output_dir> [image_path]"}, ensure_ascii=True))
        sys.exit(1)
        
    prompt_arg = sys.argv[1]
    name_arg = sys.argv[2]
    out_dir_arg = sys.argv[3]
    image_arg = sys.argv[4] if len(sys.argv) > 4 else None
    
    if image_arg:
        print(json.dumps({"error": "Ảnh đơn không thể thay thế sprite sheet; hãy nhập sheet 17 hàng trạng thái theo danh sách (mỗi ô 64x64 px)."}, ensure_ascii=True))
        sys.exit(1)
    else:
        build_full_sprite_sheet(prompt_arg, out_dir_arg, name_arg)
