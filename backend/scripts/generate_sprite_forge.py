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
    "IDLE",
    "TYPING",
    "SLEEPING",
    "WAKING_UP",
    "HAPPY",
    "SAD",
    "YAWNING",
    "HUNGRY",
    "EATING",
    "PETTING",
    "DANCING",
    "DRINKING",
    "EXERCISING",
    "WAVING",
    "THANKING",
    "CELEBRATING",
    "EVOLVING"
]

DEFAULT_STATE_FPS = {
    "IDLE": 6,
    "TYPING": 8,
    "SLEEPING": 3,
    "WAKING_UP": 6,
    "HAPPY": 8,
    "SAD": 4,
    "YAWNING": 4,
    "HUNGRY": 5,
    "EATING": 7,
    "PETTING": 8,
    "DANCING": 10,
    "DRINKING": 6,
    "EXERCISING": 9,
    "WAVING": 7,
    "THANKING": 6,
    "CELEBRATING": 10,
    "EVOLVING": 10
}

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
    if any(k in p for k in ["cừu", "cuu", "sheep", "lamb", "cừu dương", "cuu duong", "ram"]):
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
        bob = [0, -1, -2, -1][frame_idx % 4]
        by = 38 + bob
        legs_pose = "walking" if frame_idx in (1, 3) else "standing"
        eye_style = "closed" if frame_idx == 2 else "open"
        
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
            by = 42
            body_w = 28
            body_h = 20
            eye_style = "closed"
            arms_pose = "hold_belly"
        elif frame_idx == 2:
            by = 32
            body_w = 22
            body_h = 30
            eye_style = "happy"
            arms_pose = "happy_raise"
        else:
            by = 36
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
        by = 43
        body_w = 28
        body_h = 19
        eye_style = "crying"
        mouth_style = "frown"
        arms_pose = "sad_droop"
        props.append(("crying_stream", 32, 42, frame_idx))
        
    elif state == "YAWNING":
        by = 38
        body_w = 26
        body_h = 24
        eye_style = "closed"
        mouth_style = "yawn"
        props.append(("yawn_bubble", 44, 28, frame_idx))
        
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
        by = 42 if frame_idx in (0, 2) else 36
        body_w = 26
        body_h = 22
        eye_style = "happy"
        mouth_style = "chewing" if frame_idx in (0, 2) else "open_smile"
        arms_pose = "eating"
        props.append(("species_food", 22, 48, 20, 8, frame_idx, species))
        
    elif state == "PETTING":
        by = 39 + [0, 1, 2, 1][frame_idx % 4]
        eye_style = "happy"
        mouth_style = "smile"
        arms_pose = "petting_lean"
        props.append(("petting_hand", 24 + [0, 2, 4, 2][frame_idx % 4], 12, frame_idx))
        props.append(("heart", 46, 18, 0, 0))
        
    elif state == "DANCING":
        if frame_idx == 0:
            bx = 27
            by = 34
            arms_pose = "dance_left"
            legs_pose = "dance_kick"
        elif frame_idx == 1:
            bx = 32
            by = 38
        elif frame_idx == 2:
            bx = 37
            by = 34
            arms_pose = "dance_right"
            legs_pose = "dance_kick"
        else:
            bx = 32
            by = 30
            arms_pose = "happy_raise"
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
        if frame_idx in (1, 2):
            by = 26
            legs_pose = "jump"
            arms_pose = "jumprope_hold"
        else:
            by = 38
            legs_pose = "crouch"
            arms_pose = "jumprope_hold"
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
        by = 32 if frame_idx in (1, 2) else 38
        legs_pose = "jump" if frame_idx in (1, 2) else "standing"
        eye_style = "happy"
        mouth_style = "open_smile"
        arms_pose = "celebrate"
        props.append(("party_hat", bx, by - body_h//2 - 6, 0, 0))
        props.append(("confetti_blizzard", 32, 24, frame_idx))
        
    elif state == "EVOLVING":
        by = 30 + [0, -2, 0, 2][frame_idx % 4]
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

    else:
        # Mammal (Cat / Corgi / Rabbit / Creature)
        body_y = by
        draw_pixel_box(draw, bx - body_w//2 - 1, body_y - body_h//2 - 1, body_w + 2, body_h + 2, fill=col_out)
        draw_pixel_box(draw, bx - body_w//2, body_y - body_h//2, body_w, body_h, fill=col_prim)
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
    if species in ("pigeon", "duck"):
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
    is_lying_flat = False
    props = []
    
    if state == "IDLE":
        bob_y = [0, -1, -2, -1][frame_idx % 4]
        scale_y = [1.0, 1.03, 1.06, 1.03][frame_idx % 4]
    elif state == "TYPING":
        rotation_deg = [-5, -9, -5, -9][frame_idx % 4]
        bob_x = [-1, 1, 0, 1][frame_idx % 4]
        bob_y = [1, 0, 1, 0][frame_idx % 4]
        props.append(("desk_laptop", 18, 46, 28, 12, frame_idx))
    elif state == "SLEEPING":
        is_lying_flat = True
        scale_y = 0.50
        scale_x = 1.25
        bob_y = 4
        props.append(("zzz_sequence", 42, 28 - frame_idx * 4, frame_idx))
    elif state == "WAKING_UP":
        if frame_idx == 0:
            is_lying_flat = True
            scale_y = 0.55
            scale_x = 1.20
            bob_y = 4
        elif frame_idx == 1:
            scale_y = 0.85
            bob_y = 2
        elif frame_idx == 2:
            scale_y = 1.20
            scale_x = 0.88
            bob_y = -3
            props.append(("sparkle", 48, 18, 0, 0))
        else:
            bob_y = 0
            props.append(("sparkle", 32, 14, 0, 0))
    elif state == "HAPPY":
        if frame_idx == 0:
            scale_y = 0.80
            scale_x = 1.15
            bob_y = 3
        elif frame_idx in (1, 2):
            bob_y = -11 if frame_idx == 2 else -9
            scale_y = 1.18
            scale_x = 0.90
            props.append(("sparkle", 12, 16, 0, 0))
            props.append(("sparkle", 52, 14, 0, 0))
        else:
            bob_y = -2
            props.append(("sparkle", 32, 14, 0, 0))
    elif state == "SAD":
        scale_y = 0.80
        scale_x = 1.12
        bob_x = [-1, 0, 1, 0][frame_idx % 4]
        bob_y = [4, 3, 4, 5][frame_idx % 4]
        props.append(("crying_stream", 32, 42, frame_idx))
    elif state == "YAWNING":
        rotation_deg = [5, 8, 5, 8][frame_idx % 4]
        scale_y = 1.08
        bob_y = [0, 1, 0, -1][frame_idx % 4]
        props.append(("yawn_bubble", 44, 28, frame_idx))
    elif state == "HUNGRY":
        bob_x = [-2, 2, -2, 2][frame_idx % 4]
        bob_y = 1
        props.append(("food_bubble", 42, 14, frame_idx, "generic"))
    elif state == "EATING":
        if frame_idx in (0, 2):
            rotation_deg = -10
            bob_y = 3
        else:
            rotation_deg = 0
            bob_y = -1
        props.append(("species_food", 22, 48, 20, 8, frame_idx, "generic"))
    elif state == "PETTING":
        rotation_deg = 8
        bob_y = [0, 1, 2, 1][frame_idx % 4]
        props.append(("petting_hand", 24 + [0, 2, 4, 2][frame_idx % 4], 12, frame_idx))
        props.append(("heart", 46, 18, 0, 0))
    elif state == "DANCING":
        if frame_idx == 0:
            rotation_deg = -14
            bob_x = -4
            bob_y = -3
        elif frame_idx == 1:
            rotation_deg = 0
            bob_y = 2
        elif frame_idx == 2:
            rotation_deg = 14
            bob_x = 4
            bob_y = -3
        else:
            rotation_deg = 0
            bob_y = -6
        props.append(("music_note", 12, 18 + (frame_idx % 2)*4, 0, 0))
        props.append(("music_note", 50, 16 - (frame_idx % 2)*4, 0, 0))
    elif state == "DRINKING":
        rotation_deg = [-5, 0, 5, 0][frame_idx % 4]
        bob_y = [0, -1, 0, 1][frame_idx % 4]
        props.append(("water_mug", 30, 38, 10, 13, frame_idx))
    elif state == "EXERCISING":
        if frame_idx in (1, 2):
            bob_y = -12
            scale_y = 0.95
        else:
            bob_y = 2
            scale_y = 0.85
        props.append(("jumprope_cycle", 32, 36, frame_idx))
    elif state == "WAVING":
        bob_y = 0
        props.append(("wave_swoosh", 46, 22, frame_idx))
        wave_x = 44 + (-2 if frame_idx % 2 == 0 else 2)
        draw_pixel_circle(draw, wave_x, 26, 4, fill=(245, 230, 210), outline=(50, 40, 30))
    elif state == "THANKING":
        if frame_idx in (1, 2):
            scale_y = 0.70
            scale_x = 1.15
            bob_y = 4
            props.append(("heart", 32, 16, 0, 0))
        else:
            scale_y = 0.90
            bob_y = 1
    elif state == "CELEBRATING":
        bob_y = -8 if frame_idx in (1, 2) else 0
        props.append(("party_hat", 32 + bob_x, 20 + bob_y, 0, 0))
        props.append(("confetti_blizzard", 32, 24, frame_idx))
    elif state == "EVOLVING":
        bob_y = -8 + [0, -2, 0, 2][frame_idx % 4]
        scale_x = [1.0, 1.12, 1.0, 0.94][frame_idx % 4]
        scale_y = [1.0, 1.12, 1.0, 0.94][frame_idx % 4]
        props.append(("evolution_aura", 32, 36 + bob_y, frame_idx))

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
    
    if is_lying_flat:
        draw.line([(32 - 6, paste_y + 4), (32 - 2, paste_y + 4)], fill=(30, 25, 20), width=1)
        draw.line([(32 + 2, paste_y + 4), (32 + 6, paste_y + 4)], fill=(30, 25, 20), width=1)
        
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
        elif ptype == "species_food":
            px, py, bw, bh, fidx, spec = prop[1], prop[2], prop[3], prop[4], prop[5], prop[6]
            draw.chord([px, py, px + bw, py + bh * 2], 0, 180, fill=(230, 80, 80), outline=(30, 20, 20))
            draw_pixel_box(draw, px + 3, py + 1, bw - 6, 2, fill=(220, 160, 80))
        elif ptype == "petting_hand":
            px, py, fidx = prop[1], prop[2], prop[3]
            draw_pixel_box(draw, px, py, 12, 5, fill=(255, 225, 200), outline=(50, 40, 30))
        elif ptype == "water_mug":
            px, py, mw, mh, fidx = prop[1], prop[2], prop[3], prop[4], prop[5]
            draw_pixel_box(draw, px, py, mw, mh, fill=(120, 210, 255, 220), outline=(40, 50, 60))
            draw.line([(px + 4, py - 5), (px + 2, py + 4)], fill=(250, 100, 100), width=1)
        elif ptype == "jumprope_cycle":
            px, py, fidx = prop[1], prop[2], prop[3]
            if fidx in (1, 2):
                draw.arc([14, 34, 50, 58], 0, 180, fill=(240, 180, 50), width=1)
            else:
                draw.arc([14, 8, 50, 40], 180, 360, fill=(240, 180, 50), width=1)
        elif ptype == "heart":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 3, py - 2), (px, py + 3), (px + 3, py - 2)], fill=(250, 70, 90))
        elif ptype == "music_note":
            px, py = prop[1], prop[2]
            draw_pixel_box(draw, px, py, 3, 2, fill=(130, 80, 230))
            draw.line([(px + 2, py), (px + 2, py + 6)], fill=(130, 80, 230), width=1)
        elif ptype == "party_hat":
            px, py = prop[1], prop[2]
            draw.polygon([(px - 6, py + 6), (px, py - 8), (px + 6, py + 6)], fill=(255, 190, 40), outline=(40, 30, 10))
        elif ptype == "confetti_blizzard":
            px, py, fidx = prop[1], prop[2], prop[3]
            colors = [(255, 80, 80), (80, 220, 120), (240, 220, 40), (120, 160, 255)]
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

    return frame

def build_sprite_sheet_from_image(image_path, output_dir, name, prompt=""):
    os.makedirs(output_dir, exist_ok=True)
    pixel_master = process_uploaded_image_to_pixel_sprite(image_path, target_max_dim=52)
    
    frame_size = 64
    frames_per_state = 4
    total_states = len(ANIMATION_STATES)
    cols = frames_per_state
    rows = total_states
    
    sheet_w = cols * frame_size
    sheet_h = rows * frame_size
    sheet_img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    animations_meta = {}
    
    for row_idx, state in enumerate(ANIMATION_STATES):
        state_frames = []
        fps = DEFAULT_STATE_FPS.get(state, 6)
        for col_idx in range(frames_per_state):
            frame_idx = row_idx * cols + col_idx
            frame_img = draw_image_based_frame(pixel_master, state, col_idx, frames_per_state, size=frame_size)
            
            paste_x = col_idx * frame_size
            paste_y = row_idx * frame_size
            sheet_img.paste(frame_img, (paste_x, paste_y), frame_img)
            state_frames.append(frame_idx)
            
        animations_meta[state] = {
            "row": row_idx,
            "frames": state_frames,
            "fps": fps,
            "loop": state not in ("WAKING_UP", "EVOLVING", "CELEBRATING", "THANKING")
        }
        
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
        "framesPerState": frames_per_state,
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


def _find_sprite_column_boundaries(sheet, columns=4):
    width, height = sheet.size
    pixels = sheet.load()
    col_ink = []
    for x in range(width):
        ink = 0
        for y in range(height):
            pixel = pixels[x, y]
            if pixel[3] > 10 and min(pixel[:3]) < 235:
                ink += 1
        col_ink.append(ink)

    best_groups = None
    for thresh in range(0, 16):
        active = [ink > thresh for ink in col_ink]
        groups = []
        start = None
        for x, is_act in enumerate(active + [False]):
            if is_act and start is None:
                start = x
            elif not is_act and start is not None:
                if (x - start) >= 8:
                    groups.append((start, x - 1))
                start = None
        if len(groups) == columns:
            best_groups = groups
            break

    if not best_groups or len(best_groups) != columns:
        return [round(index * width / columns) for index in range(columns + 1)]

    boundaries = [0]
    for prev_group, next_group in zip(best_groups, best_groups[1:]):
        boundaries.append((prev_group[1] + next_group[0]) // 2)
    boundaries.append(width)
    return boundaries


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
    columns = 4
    rows = len(ANIMATION_STATES)
    width, height = sheet.size
    row_boundaries, detected_row_count = _find_sprite_row_boundaries(sheet, rows)
    if detected_row_count == rows - 1 and not allow_missing_state_fallback:
        return {
            "error": (
                "Ảnh chỉ có 16 hàng nội dung; sprite sheet trang bị cần đủ 17 hàng trạng thái "
                "để tránh gán nhầm hoạt ảnh."
            )
        }

    source_row_indexes = list(range(rows))
    alignment_warning = None
    if detected_row_count == rows - 1:
        # The imported sheet is missing one visual state row. Reuse the food
        # frame row for HUNGRY rather than splitting a character across rows.
        source_row_indexes = list(range(rows - 1))
        source_row_indexes.insert(8, 7)
        alignment_warning = (
            "Ảnh nguồn chỉ có 16 hàng nội dung; HUNGRY và EATING dùng chung hàng hình thức ăn."
        )

    column_boundaries = _find_sprite_column_boundaries(sheet, columns)
    frame_width = max(
        column_boundaries[index + 1] - column_boundaries[index]
        for index in range(columns)
    )
    frame_height = max(
        row_boundaries[index + 1] - row_boundaries[index]
        for index in range(len(row_boundaries) - 1)
    )
    if frame_width < 16 or frame_width > 512 or frame_height < 16 or frame_height > 512:
        return {"error": f"Kích thước ô cần nằm trong khoảng 16–512 px; ảnh hiện tại tạo ô khoảng {frame_width}x{frame_height}."}

    try:
        from smart_bg_remover import smart_remove_background
    except ImportError:
        try:
            from scripts.smart_bg_remover import smart_remove_background
        except ImportError:
            smart_remove_background = None

    normalized = Image.new("RGBA", (frame_width * columns, frame_height * rows), (0, 0, 0, 0))
    for output_row, source_row in enumerate(source_row_indexes):
        top = row_boundaries[source_row]
        bottom = row_boundaries[source_row + 1]
        for column_index in range(columns):
            left = column_boundaries[column_index]
            right = column_boundaries[column_index + 1]
            frame = sheet.crop((left, top, right, bottom))
            if smart_remove_background:
                frame = smart_remove_background(frame, tolerance=24, defringe=True, is_sprite_sheet=False)
            destination_x = column_index * frame_width + (frame_width - frame.width) // 2
            destination_y = output_row * frame_height + frame_height - frame.height
            normalized.paste(frame, (destination_x, destination_y))

    normalized_path = os.path.join(output_dir, f"{name}_spritesheet.png")
    try:
        normalized.save(normalized_path, "PNG")
    except Exception as error:
        return {"error": f"Không thể lưu sprite sheet đã xử lý nền: {error}"}

    animations = {}
    one_shot_states = ("WAKING_UP", "EVOLVING", "CELEBRATING", "THANKING")
    for row_index, state in enumerate(ANIMATION_STATES):
        animations[state] = {
            "row": row_index,
            "frames": [row_index * columns + col for col in range(columns)],
            "fps": DEFAULT_STATE_FPS.get(state, 6),
            "loop": state not in one_shot_states
        }
    animations["WALKING"] = {**animations["IDLE"], "fps": 8}

    preview_filename = f"{name}_preview.png"
    preview_path = os.path.join(output_dir, preview_filename)
    preview = normalized.crop((0, 0, frame_width, frame_height))
    if smart_remove_background:
        preview = smart_remove_background(preview, tolerance=24, defringe=True, is_sprite_sheet=False)
    preview_width = 128
    preview_height = max(1, round(preview_width * frame_height / frame_width))
    preview.resize((preview_width, preview_height), Image.Resampling.NEAREST).save(preview_path, "PNG")

    frame_config = {
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "totalColumns": columns,
        "totalRows": rows,
        "totalFrames": columns * rows,
        "framesPerState": columns,
        "renderScale": {
            "minWidth": 100,
            "maxWidth": 150,
            "minHeight": 100,
            "maxHeight": 150,
            "defaultWidth": 120,
            "defaultHeight": 120
        },
        "naturalAspectRatio": frame_width / frame_height,
        "palette": "imported_sprite_sheet",
        "sourceRowCount": detected_row_count,
        "alignmentWarning": alignment_warning,
        "backgroundRemoved": background_removed
    }

    return {
        "name": name,
        "sheetUrl": f"/sprites/{name}_spritesheet.png",
        "previewUrl": f"/sprites/{preview_filename}",
        "naturalAspectRatio": frame_width / frame_height,
        "frameConfig": frame_config,
        "animations": animations,
        "statesCount": len(ANIMATION_STATES)
    }

def build_full_sprite_sheet(prompt, output_dir, name):
    os.makedirs(output_dir, exist_ok=True)
    blueprint = analyze_character_blueprint(prompt)
    palette = blueprint["palette"]
    species = blueprint["species"]
    
    frame_size = 64
    frames_per_state = 4
    total_states = len(ANIMATION_STATES)
    
    cols = frames_per_state
    rows = total_states
    
    sheet_w = cols * frame_size
    sheet_h = rows * frame_size
    sheet_img = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))
    animations_meta = {}
    
    for row_idx, state in enumerate(ANIMATION_STATES):
        state_frames = []
        fps = DEFAULT_STATE_FPS.get(state, 6)
        for col_idx in range(frames_per_state):
            frame_idx = row_idx * cols + col_idx
            frame_img = draw_pet_frame(state, col_idx, frames_per_state, palette, species, prompt=prompt, size=frame_size)
            
            paste_x = col_idx * frame_size
            paste_y = row_idx * frame_size
            sheet_img.paste(frame_img, (paste_x, paste_y), frame_img)
            state_frames.append(frame_idx)
            
        animations_meta[state] = {
            "row": row_idx,
            "frames": state_frames,
            "fps": fps,
            "loop": state not in ("WAKING_UP", "EVOLVING", "CELEBRATING", "THANKING")
        }
        
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
        "framesPerState": frames_per_state,
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
        with open(spec_path, "r", encoding="utf-8") as f:
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
            print(json.dumps({"error": "Ảnh đơn không thể thay thế sprite sheet 4x17; hãy nhập sheet đã có frame cho từng trạng thái."}, ensure_ascii=True))
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
        print(json.dumps({"error": "Ảnh đơn không thể thay thế sprite sheet 4x17; hãy nhập sheet đã có frame cho từng trạng thái."}, ensure_ascii=True))
        sys.exit(1)
    else:
        build_full_sprite_sheet(prompt_arg, out_dir_arg, name_arg)
