const fs = require('fs');
const path = require('path');

function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

const rootDir = path.resolve(__dirname, '..', '..');
const backendDir = path.resolve(__dirname, '..');
const spritesDir = path.join(backendDir, 'public', 'sprites');

const pets = [
  { file: 'cat_default_meta.json', id: 'pet-type-cat-01', name: 'Mèo Pixel Shiro', desc: 'Bé mèo mướp màu cam lanh lợi, thích ngủ gật và gõ phím cùng chủ nhân.', unlockLevel: 1, isShop: 0, price: 0 },
  { file: 'corgi_default_meta.json', id: 'pet-type-corgi-01', name: 'Corgi Pixel Bento', desc: 'Chú cún Corgi chân ngắn vui nhộn, luôn lắc lư theo điệu nhạc Lofi.', unlockLevel: 1, isShop: 0, price: 0 },
  { file: 'rabbit_default_meta.json', id: 'pet-type-rabbit-01', name: 'Thỏ Pixel Mochi', desc: 'Bé thỏ trắng tai dài dịu dàng, luôn chăm chú nhắc bạn uống nước đúng giờ.', unlockLevel: 1, isShop: 0, price: 0 },
  { file: 'chim_canh_cut_meta.json', id: 'pet-type-penguin-01', name: 'Chim Cánh Cụt Pingu', desc: 'Chú chim cánh cụt Chibi ngộ nghĩnh, luôn nhảy nhót và động viên bạn tập trung.', unlockLevel: 1, isShop: 0, price: 0 },
  { file: 'husky_meta.json', id: 'pet-type-husky-01', name: 'Cún Husky Tuyết', desc: 'Chú chó Husky mắt xanh ngáo ngơ nhưng cực kỳ trung thành và tràn đầy năng lượng.', unlockLevel: 1, isShop: 0, price: 0 }
];

let petInserts = '';
pets.forEach(p => {
  const filePath = path.join(spritesDir, p.file);
  let frameConfigStr = '{}';
  let animationsStr = '{}';
  let sheetUrl = '/sprites/' + p.file.replace('_meta.json', '_spritesheet.png');
  let previewUrl = '/sprites/' + p.file.replace('_meta.json', '_preview.png');
  let naturalAspectRatio = 1.0;

  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    frameConfigStr = JSON.stringify(data.frameConfig || {});
    animationsStr = JSON.stringify(data.animations || {});
    sheetUrl = data.sheetUrl || sheetUrl;
    previewUrl = data.previewUrl || previewUrl;
    naturalAspectRatio = data.naturalAspectRatio || 1.0;
  }

  petInserts += `
-- Loài thú: ${p.name}
IF NOT EXISTS (SELECT 1 FROM dbo.pet_types WHERE name = N'${escapeSql(p.name)}')
BEGIN
    INSERT INTO dbo.pet_types (type_id, name, description, unlock_level, is_active, is_shop_enabled, is_purchase_required, exp_price, sprite_sheet_url, preview_url, natural_aspect_ratio, frame_config, animations)
    VALUES ('${p.id}', N'${escapeSql(p.name)}', N'${escapeSql(p.desc)}', ${p.unlockLevel}, 1, ${p.isShop}, 0, ${p.price}, '${sheetUrl}', '${previewUrl}', ${naturalAspectRatio}, N'${escapeSql(frameConfigStr)}', N'${escapeSql(animationsStr)}');
END
GO
`;
});

const sqlContent = `-- ==============================================================================
-- OfficePet 2D Pixel Art - Master Database Initialization & Setup Script
-- Hệ thống Nuôi Thú Cưng Ảo Văn Phòng & Đồng Hành Năng Suất (OfficePet)
-- Microsoft SQL Server 2016 / 2019 / 2022 / SQL Server Express / Azure SQL
-- File này được lưu tại thư mục gốc repository để mọi thành viên trên Git dễ dàng
-- mở bằng SSMS / Azure Data Studio / DBeaver và chạy trực tiếp (F5).
-- ==============================================================================

-- 0. TẠO CƠ SỞ DỮ LIỆU (DATABASE) NẾU CHƯA TỒN TẠI
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'officepet')
BEGIN
    CREATE DATABASE [officepet];
    PRINT N'-> Đã tạo mới cơ sở dữ liệu [officepet] thành công.';
END
ELSE
BEGIN
    PRINT N'-> Cơ sở dữ liệu [officepet] đã sẵn sàng.';
END
GO

USE [officepet];
GO

-- ==============================================================================
-- PHẦN 1: TẠO CẤU TRÚC 26 BẢNG DỮ LIỆU (TABLE DDL - IDEMPOTENT)
-- ==============================================================================

-- 1. Bảng organizations (Công ty / Tổ chức)
IF OBJECT_ID('dbo.organizations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.organizations (
        org_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        domain NVARCHAR(255) NOT NULL UNIQUE,
        package_tier NVARCHAR(50) NOT NULL DEFAULT 'STANDARD',
        status NVARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        expires_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 2. Bảng garden_backgrounds (Bối cảnh khu vườn pixel art)
IF OBJECT_ID('dbo.garden_backgrounds', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.garden_backgrounds (
        background_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL UNIQUE,
        image_url NVARCHAR(1000) NOT NULL,
        animation_frames INT NOT NULL DEFAULT 1,
        animation_fps INT NOT NULL DEFAULT 0,
        animation_columns INT NOT NULL DEFAULT 1,
        animation_rows INT NOT NULL DEFAULT 1,
        thumbnail_url NVARCHAR(1000) NULL,
        description NVARCHAR(1000) NULL,
        exp_price INT NOT NULL DEFAULT 0,
        is_recommended BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 3. Bảng departments (Phòng ban & Khu vườn ảo chung)
IF OBJECT_ID('dbo.departments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.departments (
        dept_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        org_id NVARCHAR(36) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        invite_code NVARCHAR(100) NOT NULL UNIQUE,
        work_hours NVARCHAR(100) NULL,
        garden_level INT NOT NULL DEFAULT 1,
        garden_exp INT NOT NULL DEFAULT 0,
        theme_id NVARCHAR(100) NULL,
        background_id NVARCHAR(36) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_departments_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE CASCADE,
        CONSTRAINT FK_departments_background FOREIGN KEY (background_id) REFERENCES dbo.garden_backgrounds(background_id) ON DELETE SET NULL
    );
END
GO

-- 4. Bảng users (Tài khoản người dùng & quản trị viên)
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        user_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        org_id NVARCHAR(36) NULL,
        dept_id NVARCHAR(36) NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        avatar_url NVARCHAR(1000) NULL,
        role NVARCHAR(50) NOT NULL DEFAULT 'USER',
        status NVARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        two_factor_secret NVARCHAR(255) NULL,
        two_factor_enabled BIT NOT NULL DEFAULT 0,
        last_login DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_users_org FOREIGN KEY (org_id) REFERENCES dbo.organizations(org_id) ON DELETE SET NULL,
        CONSTRAINT FK_users_dept FOREIGN KEY (dept_id) REFERENCES dbo.departments(dept_id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_users_email ON dbo.users(email);
    CREATE INDEX IX_users_deptId ON dbo.users(dept_id);
END
GO

-- 5. Bảng user_preferences (Cài đặt cá nhân, nhạc Lo-fi & chu kỳ nhắc nhở)
IF OBJECT_ID('dbo.user_preferences', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_preferences (
        pref_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL UNIQUE,
        fav_music_genre NVARCHAR(100) NULL DEFAULT N'Lo-fi Hip Hop',
        selected_music_track NVARCHAR(MAX) NULL,
        pet_persona NVARCHAR(100) NULL DEFAULT N'Vui vẻ',
        quiet_mode BIT NOT NULL DEFAULT 0,
        dnd_start_time NVARCHAR(50) NULL,
        dnd_end_time NVARCHAR(50) NULL,
        sound_enabled BIT NOT NULL DEFAULT 1,
        ai_learning_enabled BIT NOT NULL DEFAULT 1,
        hydration_interval INT NOT NULL DEFAULT 45,
        posture_interval INT NOT NULL DEFAULT 90,
        ai_context_memory NVARCHAR(MAX) NULL,
        settings NVARCHAR(MAX) NULL,
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_preferences_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
END
GO

-- 6. Bảng pet_types (Danh mục loài thú cưng & Sprite Sheet 17 trạng thái)
IF OBJECT_ID('dbo.pet_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pet_types (
        type_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL UNIQUE,
        description NVARCHAR(1000) NULL,
        unlock_level INT NOT NULL DEFAULT 1,
        is_active BIT NOT NULL DEFAULT 1,
        is_shop_enabled BIT NOT NULL DEFAULT 0,
        is_purchase_required BIT NOT NULL DEFAULT 0,
        exp_price INT NOT NULL DEFAULT 0,
        sprite_sheet_url NVARCHAR(1000) NOT NULL,
        preview_url NVARCHAR(1000) NULL,
        natural_aspect_ratio FLOAT NOT NULL DEFAULT 1.0,
        frame_config NVARCHAR(MAX) NOT NULL,
        animations NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 7. Bảng user_pets (Thú cưng người dùng đang nuôi)
IF OBJECT_ID('dbo.user_pets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_pets (
        pet_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL UNIQUE,
        type_id NVARCHAR(36) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        level INT NOT NULL DEFAULT 1,
        exp INT NOT NULL DEFAULT 0,
        hunger INT NOT NULL DEFAULT 80,
        happiness INT NOT NULL DEFAULT 100,
        health INT NOT NULL DEFAULT 100,
        currentState NVARCHAR(50) NOT NULL DEFAULT 'IDLE',
        currentMode NVARCHAR(50) NOT NULL DEFAULT 'RELAXED',
        daily_interactions_left INT NOT NULL DEFAULT 3,
        last_interaction_at DATETIME2 NULL,
        position_x FLOAT NULL DEFAULT 85.0,
        position_y FLOAT NULL DEFAULT 80.0,
        scale_size NVARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
        is_hidden BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_pets_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_user_pets_type FOREIGN KEY (type_id) REFERENCES dbo.pet_types(type_id)
    );
END
GO

-- 8. Bảng items (Vật phẩm, thức ăn, phụ kiện trong cửa hàng)
IF OBJECT_ID('dbo.items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.items (
        item_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(1000) NULL,
        item_type NVARCHAR(50) NOT NULL,
        image_url NVARCHAR(1000) NOT NULL,
        rarity NVARCHAR(50) NOT NULL DEFAULT 'COMMON',
        exp_price INT NOT NULL DEFAULT 0,
        equip_slot NVARCHAR(50) NOT NULL DEFAULT 'AUTO',
        effect NVARCHAR(50) NOT NULL DEFAULT 'NONE',
        effect_value INT NOT NULL DEFAULT 0,
        sprite_sheet_url NVARCHAR(1000) NULL,
        frame_config NVARCHAR(MAX) NULL,
        animations NVARCHAR(MAX) NULL,
        pet_type_id NVARCHAR(36) NULL,
        is_available BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

-- 9. Bảng user_items (Túi đồ người dùng & vật phẩm trang bị)
IF OBJECT_ID('dbo.user_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_items (
        user_item_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        item_id NVARCHAR(36) NOT NULL,
        pet_id NVARCHAR(36) NULL,
        quantity INT NOT NULL DEFAULT 1,
        is_equipped BIT NOT NULL DEFAULT 0,
        acquired_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_user_items_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_user_items_item FOREIGN KEY (item_id) REFERENCES dbo.items(item_id) ON DELETE NO ACTION,
        CONSTRAINT FK_user_items_pet FOREIGN KEY (pet_id) REFERENCES dbo.user_pets(pet_id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_user_items_userId ON dbo.user_items(user_id);
END
GO

-- 10. Bảng purchased_pet_types (Các loài thú đã mua trong cửa hàng)
IF OBJECT_ID('dbo.purchased_pet_types', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchased_pet_types (
        purchased_pet_type_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        type_id NVARCHAR(36) NOT NULL,
        acquired_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_purchased_pet_user_type UNIQUE (user_id, type_id),
        CONSTRAINT FK_purchased_pet_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_purchased_pet_type FOREIGN KEY (type_id) REFERENCES dbo.pet_types(type_id) ON DELETE NO ACTION
    );
END
GO

-- 11. Bảng exp_records (Nhật ký tích lũy EXP)
IF OBJECT_ID('dbo.exp_records', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.exp_records (
        exp_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        pet_id NVARCHAR(36) NULL,
        dept_id NVARCHAR(36) NULL,
        amount INT NOT NULL,
        source NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_exp_records_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_exp_records_pet FOREIGN KEY (pet_id) REFERENCES dbo.user_pets(pet_id) ON DELETE NO ACTION,
        CONSTRAINT FK_exp_records_dept FOREIGN KEY (dept_id) REFERENCES dbo.departments(dept_id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_exp_records_userId ON dbo.exp_records(user_id);
    CREATE INDEX IX_exp_records_deptId ON dbo.exp_records(dept_id);
END
GO

-- 12. Bảng work_sessions (Phiên làm việc Pomodoro)
IF OBJECT_ID('dbo.work_sessions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.work_sessions (
        session_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        mode NVARCHAR(50) NOT NULL DEFAULT 'RELAXED',
        start_time DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        end_time DATETIME2 NULL,
        duration_minutes INT NOT NULL DEFAULT 0,
        focus_score INT NOT NULL DEFAULT 100,
        violations_count INT NOT NULL DEFAULT 0,
        is_completed BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_work_sessions_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_work_sessions_userId ON dbo.work_sessions(user_id);
END
GO

-- 13. Bảng daily_goals (Mục tiêu hàng ngày & chuỗi ngày chuyên cần)
IF OBJECT_ID('dbo.daily_goals', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.daily_goals (
        goal_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        target_date DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        target_hours FLOAT NOT NULL DEFAULT 4.0,
        actual_hours FLOAT NOT NULL DEFAULT 0.0,
        streak_count INT NOT NULL DEFAULT 0,
        status NVARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_daily_goals_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_daily_goals_userId ON dbo.daily_goals(user_id);
END
GO

-- 14. Bảng gifts (Tặng quà giữa các đồng nghiệp)
IF OBJECT_ID('dbo.gifts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.gifts (
        gift_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        sender_id NVARCHAR(36) NOT NULL,
        receiver_id NVARCHAR(36) NOT NULL,
        item_id NVARCHAR(36) NOT NULL,
        message NVARCHAR(500) NULL,
        sent_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        is_opened BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_gifts_sender FOREIGN KEY (sender_id) REFERENCES dbo.users(user_id) ON DELETE NO ACTION,
        CONSTRAINT FK_gifts_receiver FOREIGN KEY (receiver_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_gifts_item FOREIGN KEY (item_id) REFERENCES dbo.items(item_id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_gifts_receiverId ON dbo.gifts(receiver_id);
END
GO

-- 15. Bảng events & event_participants (Thử thách & sự kiện phòng ban)
IF OBJECT_ID('dbo.events', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.events (
        event_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        dept_id NVARCHAR(36) NULL,
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(1000) NOT NULL,
        start_time DATETIME2 NOT NULL,
        end_time DATETIME2 NOT NULL,
        target_exp INT NOT NULL DEFAULT 1000,
        current_exp INT NOT NULL DEFAULT 0,
        reward_item_id NVARCHAR(36) NULL,
        reward_exp INT NOT NULL DEFAULT 100,
        status NVARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_events_dept FOREIGN KEY (dept_id) REFERENCES dbo.departments(dept_id) ON DELETE CASCADE,
        CONSTRAINT FK_events_reward FOREIGN KEY (reward_item_id) REFERENCES dbo.items(item_id) ON DELETE SET NULL
    );
END
GO

IF OBJECT_ID('dbo.event_participants', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.event_participants (
        ep_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        event_id NVARCHAR(36) NOT NULL,
        user_id NVARCHAR(36) NOT NULL,
        contributed_exp INT NOT NULL DEFAULT 0,
        is_completed BIT NOT NULL DEFAULT 0,
        joined_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_event_user UNIQUE (event_id, user_id),
        CONSTRAINT FK_ep_event FOREIGN KEY (event_id) REFERENCES dbo.events(event_id) ON DELETE CASCADE,
        CONSTRAINT FK_ep_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE NO ACTION
    );
END
GO

-- 16. Bảng messages & mood_logs (Bong bóng lời thoại & cảm xúc)
IF OBJECT_ID('dbo.messages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.messages (
        msg_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        dept_id NVARCHAR(36) NULL,
        sender_id NVARCHAR(36) NULL,
        title NVARCHAR(255) NULL,
        content NVARCHAR(1000) NOT NULL,
        message_type NVARCHAR(50) NOT NULL DEFAULT 'SPEECH_BUBBLE',
        urgency NVARCHAR(50) NOT NULL DEFAULT 'NORMAL',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_messages_dept FOREIGN KEY (dept_id) REFERENCES dbo.departments(dept_id) ON DELETE CASCADE
    );
END
GO

IF OBJECT_ID('dbo.mood_logs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.mood_logs (
        mood_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        score INT NOT NULL,
        note NVARCHAR(500) NULL,
        ai_recommendation NVARCHAR(1000) NULL,
        logged_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_mood_logs_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_mood_logs_userId ON dbo.mood_logs(user_id);
END
GO

-- 17. Bảng department_backgrounds (Bối cảnh phòng ban đã mua)
IF OBJECT_ID('dbo.department_backgrounds', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.department_backgrounds (
        department_background_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        department_id NVARCHAR(36) NOT NULL,
        background_id NVARCHAR(36) NOT NULL,
        acquired_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_dept_bg UNIQUE (department_id, background_id),
        CONSTRAINT FK_dept_bg_dept FOREIGN KEY (department_id) REFERENCES dbo.departments(dept_id) ON DELETE CASCADE,
        CONSTRAINT FK_dept_bg_bg FOREIGN KEY (background_id) REFERENCES dbo.garden_backgrounds(background_id) ON DELETE NO ACTION
    );
END
GO

-- 18. Bảng audit_logs (Nhật ký bảo mật hệ thống)
IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_logs (
        log_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        admin_id NVARCHAR(36) NULL,
        action NVARCHAR(255) NOT NULL,
        target_entity NVARCHAR(100) NULL,
        target_id NVARCHAR(100) NULL,
        old_value NVARCHAR(MAX) NULL,
        new_value NVARCHAR(MAX) NULL,
        ip_address NVARCHAR(100) NULL,
        performed_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_audit_logs_admin FOREIGN KEY (admin_id) REFERENCES dbo.users(user_id) ON DELETE SET NULL
    );
    CREATE INDEX IX_audit_logs_adminId ON dbo.audit_logs(admin_id);
END
GO

-- 19. Bảng password_reset_tokens
IF OBJECT_ID('dbo.password_reset_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.password_reset_tokens (
        reset_token_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        token_hash NVARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_password_reset_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_pwd_tokens_user ON dbo.password_reset_tokens(user_id, created_at);
END
GO

-- 20. Bảng ai_chat_histories (Bộ nhớ đối thoại AI Companion)
IF OBJECT_ID('dbo.ai_chat_histories', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_chat_histories (
        chat_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        mood_context NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ai_chat_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ai_chat_userId ON dbo.ai_chat_histories(user_id);
END
GO

-- 21. Bảng quests (Nhiệm vụ hàng ngày, tuần, đặc biệt)
IF OBJECT_ID('dbo.quests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.quests (
        quest_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        title NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        category NVARCHAR(50) NOT NULL DEFAULT 'DAILY',
        action_type NVARCHAR(50) NOT NULL,
        target_count INT NOT NULL DEFAULT 1,
        reward_exp INT NOT NULL DEFAULT 50,
        reward_item_id NVARCHAR(36) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_quests_reward_item FOREIGN KEY (reward_item_id) REFERENCES dbo.items(item_id) ON DELETE SET NULL
    );
END
GO

-- 22. Bảng user_quests (Tiến độ & nhận thưởng nhiệm vụ của người dùng)
IF OBJECT_ID('dbo.user_quests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_quests (
        user_quest_id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        quest_id NVARCHAR(36) NOT NULL,
        progress INT NOT NULL DEFAULT 0,
        is_completed BIT NOT NULL DEFAULT 0,
        is_claimed BIT NOT NULL DEFAULT 0,
        claimed_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_user_quest UNIQUE (user_id, quest_id),
        CONSTRAINT FK_user_quests_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE,
        CONSTRAINT FK_user_quests_quest FOREIGN KEY (quest_id) REFERENCES dbo.quests(quest_id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_user_quests_user ON dbo.user_quests(user_id);
    CREATE INDEX IX_user_quests_quest ON dbo.user_quests(quest_id);
END
GO

-- 23. Bảng friendships (Quan hệ bạn bè giữa người dùng)
IF OBJECT_ID('dbo.friendships', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.friendships (
        id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        friend_id NVARCHAR(36) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'ACCEPTED',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_friendship_pair UNIQUE (user_id, friend_id),
        CONSTRAINT FK_friendships_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
END
GO

-- 24. Bảng direct_messages (Tin nhắn trò chuyện riêng 1-1 giữa bạn bè)
IF OBJECT_ID('dbo.direct_messages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.direct_messages (
        id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        sender_id NVARCHAR(36) NOT NULL,
        receiver_id NVARCHAR(36) NOT NULL,
        content NVARCHAR(1000) NOT NULL,
        is_read BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_direct_messages_pair ON dbo.direct_messages(sender_id, receiver_id);
END
GO

-- ==============================================================================
-- PHẦN 2: DỮ LIỆU MẪU BAN ĐẦU (SEED DATA - ĐẦY ĐỦ CHO PHÁT TRIỂN & CHẠY THẬT)
-- ==============================================================================

-- 1. Tổ chức công ty
IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE domain = 'techcorp.com')
BEGIN
    INSERT INTO dbo.organizations (org_id, name, domain, package_tier, status)
    VALUES ('org-default-01', N'TechCorp Solutions', 'techcorp.com', 'ENTERPRISE', 'ACTIVE');
END
GO

-- 2. Bối cảnh khu vườn pixel
IF NOT EXISTS (SELECT 1 FROM dbo.garden_backgrounds WHERE name = N'Khu Vườn Mùa Xuân')
BEGIN
    INSERT INTO dbo.garden_backgrounds (background_id, name, image_url, description, exp_price, is_recommended, is_active, animation_frames, animation_fps, animation_columns, animation_rows)
    VALUES ('bg-spring-01', N'Khu Vườn Mùa Xuân', '/backgrounds/garden_spring.png', N'Đồng cỏ xanh tươi, hoa anh đào nở rộ và những đóa hoa pixel đa sắc.', 0, 1, 1, 1, 0, 1, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.garden_backgrounds WHERE name = N'Quán Cafe Pixel Ban Đêm')
BEGIN
    INSERT INTO dbo.garden_backgrounds (background_id, name, image_url, description, exp_price, is_recommended, is_active, animation_frames, animation_fps, animation_columns, animation_rows)
    VALUES ('bg-cafe-01', N'Quán Cafe Pixel Ban Đêm', '/backgrounds/cafe_cozy.png', N'Không gian ấm cúng với ánh đèn vàng, kệ sách và bầu trời đêm ngập sao.', 80, 1, 1, 1, 0, 1, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.garden_backgrounds WHERE name = N'Phòng Làm Việc Cây Xanh')
BEGIN
    INSERT INTO dbo.garden_backgrounds (background_id, name, image_url, description, exp_price, is_recommended, is_active, animation_frames, animation_fps, animation_columns, animation_rows)
    VALUES ('bg-zen-01', N'Phòng Làm Việc Cây Xanh', '/backgrounds/office_zen.png', N'Góc làm việc hiện đại tràn ngập ánh sáng tự nhiên và cây cảnh lọc không khí.', 100, 0, 1, 1, 0, 1, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.garden_backgrounds WHERE name = N'Bãi Biển Hoàng Hôn Pixel')
BEGIN
    INSERT INTO dbo.garden_backgrounds (background_id, name, image_url, description, exp_price, is_recommended, is_active, animation_frames, animation_fps, animation_columns, animation_rows)
    VALUES ('bg-beach-01', N'Bãi Biển Hoàng Hôn Pixel', '/backgrounds/beach_sunset.png', N'Khung cảnh hoàng hôn rực rỡ bên bờ biển với những hàng dừa đung đưa theo gió.', 120, 0, 1, 1, 0, 1, 1);
END
GO

-- 3. Phòng ban & Khu vườn làm việc chung
IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE invite_code = 'TECH01')
BEGIN
    INSERT INTO dbo.departments (dept_id, org_id, name, invite_code, work_hours, garden_level, garden_exp, background_id)
    VALUES ('dept-tech-01', 'org-default-01', N'Phòng Kỹ Thuật & Phần Mềm', 'TECH01', '08:30 - 17:30', 2, 450, 'bg-spring-01');
END
GO

-- 4. Tài khoản người dùng mẫu
-- Mật khẩu Admin: Admin@123
-- Mật khẩu User:  User@123
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'admin@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-admin-01', 'admin@techcorp.com', '$2b$10$rMhZseAkijg2K9/nhsup.OztQgYALjacbbnF/cNGnLhu4Gprir4fC', N'OfficePet Admin', 'ADMIN', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'hung@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-hung-01', 'hung@techcorp.com', '$2b$10$4O/Ppd/X4/ULAQbu2udgYO/tDuVcAjODtd92TpNk2.CZHR70iB0Qe', N'Phi Hùng', 'USER', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'minh@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-minh-01', 'minh@techcorp.com', '$2b$10$4O/Ppd/X4/ULAQbu2udgYO/tDuVcAjODtd92TpNk2.CZHR70iB0Qe', N'Trần Minh Anh', 'USER', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'ha@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-ha-01', 'ha@techcorp.com', '$2b$10$4O/Ppd/X4/ULAQbu2udgYO/tDuVcAjODtd92TpNk2.CZHR70iB0Qe', N'Lê Thu Hà', 'USER', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

-- 5. Cài đặt người dùng (User Preferences)
IF NOT EXISTS (SELECT 1 FROM dbo.user_preferences WHERE user_id = 'user-hung-01')
BEGIN
    INSERT INTO dbo.user_preferences (pref_id, user_id, fav_music_genre, pet_persona, sound_enabled, ai_learning_enabled, hydration_interval, posture_interval)
    VALUES ('pref-hung-01', 'user-hung-01', N'Lo-fi Hip Hop', N'Vui vẻ', 1, 1, 45, 90);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.user_preferences WHERE user_id = 'user-minh-01')
BEGIN
    INSERT INTO dbo.user_preferences (pref_id, user_id, fav_music_genre, pet_persona, sound_enabled, ai_learning_enabled, hydration_interval, posture_interval)
    VALUES ('pref-minh-01', 'user-minh-01', N'Piano Chill', N'Nghiêm túc', 1, 1, 50, 60);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.user_preferences WHERE user_id = 'user-ha-01')
BEGIN
    INSERT INTO dbo.user_preferences (pref_id, user_id, fav_music_genre, pet_persona, sound_enabled, ai_learning_enabled, hydration_interval, posture_interval)
    VALUES ('pref-ha-01', 'user-ha-01', N'Jazz Lo-fi', N'Ngọt ngào', 1, 1, 40, 90);
END
GO

-- 6. Danh mục loài thú cưng (Pet Types với 17 trạng thái hoạt ảnh)
${petInserts}

-- 7. Thú cưng người dùng nuôi (User Pets)
IF NOT EXISTS (SELECT 1 FROM dbo.user_pets WHERE user_id = 'user-hung-01')
BEGIN
    INSERT INTO dbo.user_pets (pet_id, user_id, type_id, name, level, exp, hunger, happiness, health, currentState, currentMode, scale_size, position_x, position_y, daily_interactions_left)
    VALUES ('pet-hung-01', 'user-hung-01', 'pet-type-cat-01', N'Mochi Neko', 2, 120, 85, 100, 100, 'IDLE', 'RELAXED', 'MEDIUM', 82.0, 75.0, 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.user_pets WHERE user_id = 'user-minh-01')
BEGIN
    INSERT INTO dbo.user_pets (pet_id, user_id, type_id, name, level, exp, hunger, happiness, health, currentState, currentMode, scale_size, position_x, position_y, daily_interactions_left)
    VALUES ('pet-minh-01', 'user-minh-01', 'pet-type-corgi-01', N'Bento Boy', 3, 340, 70, 90, 100, 'TYPING', 'STRICT', 'MEDIUM', 30.0, 72.0, 3);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.user_pets WHERE user_id = 'user-ha-01')
BEGIN
    INSERT INTO dbo.user_pets (pet_id, user_id, type_id, name, level, exp, hunger, happiness, health, currentState, currentMode, scale_size, position_x, position_y, daily_interactions_left)
    VALUES ('pet-ha-01', 'user-ha-01', 'pet-type-rabbit-01', N'Thỏ Bông', 1, 80, 95, 100, 100, 'DANCING', 'RELAXED', 'SMALL', 55.0, 70.0, 3);
END
GO

-- 8. Cửa hàng vật phẩm (Shop Items)
IF NOT EXISTS (SELECT 1 FROM dbo.items WHERE item_id = 'item_fish_01')
BEGIN
    INSERT INTO dbo.items (item_id, name, description, item_type, image_url, rarity, exp_price, effect, effect_value)
    VALUES ('item_fish_01', N'Cá Hồi Pixel Thượng Hạng', N'Thức ăn hồi phục 40 điểm no bụng và 10 điểm sức khỏe cho thú cưng.', 'FOOD', '/sprites/shop_fish.svg', 'COMMON', 50, 'RESTORE_HUNGER', 40);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.items WHERE item_id = 'item_milk_01')
BEGIN
    INSERT INTO dbo.items (item_id, name, description, item_type, image_url, rarity, exp_price, effect, effect_value)
    VALUES ('item_milk_01', N'Sữa Bò Tươi Pixel', N'Thức uống thơm ngon giúp thú cưng vui vẻ và giải khát tức thì.', 'FOOD', '/sprites/shop_milk.svg', 'COMMON', 30, 'RESTORE_HUNGER', 25);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.items WHERE item_id = 'item_hat_01')
BEGIN
    INSERT INTO dbo.items (item_id, name, description, item_type, image_url, rarity, exp_price, equip_slot)
    VALUES ('item_hat_01', N'Mũ Rơm Pixel Nghỉ Dưỡng', N'Phụ kiện mũ nón xinh xắn cho thú cưng khi đi dạo quanh khu vườn văn phòng.', 'HAT', '/sprites/shop_hat.svg', 'RARE', 150, 'HEAD');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.items WHERE item_id = 'item_glasses_01')
BEGIN
    INSERT INTO dbo.items (item_id, name, description, item_type, image_url, rarity, exp_price, equip_slot)
    VALUES ('item_glasses_01', N'Kính Mát Pixel Sành Điệu', N'Cặp kính mát siêu ngầu bảo vệ mắt thú cưng khỏi ánh sáng màn hình máy tính.', 'ACCESSORY', '/sprites/shop_glasses.svg', 'UNCOMMON', 120, 'FACE');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.items WHERE item_id = 'item_potion_01')
BEGIN
    INSERT INTO dbo.items (item_id, name, description, item_type, image_url, rarity, exp_price, effect, effect_value)
    VALUES ('item_potion_01', N'Bình Năng Lượng Pixel Siêu Cấp', N'Nước tăng lực hồi phục 100% chỉ số đói, vui vẻ và sức khỏe.', 'POTION', '/sprites/shop_potion.svg', 'EPIC', 250, 'FULL_RESTORE', 100);
END
GO

-- 9. Danh mục nhiệm vụ mẫu (Quests)
IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-feed-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-feed-01', N'Bữa ăn ấm bụng', N'Cho thú cưng ăn 2 lần trong ngày để giữ năng lượng dồi dào.', 'DAILY', 'FEED', 2, 30, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-water-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-water-01', N'Tiếp nước đầy đủ', N'Uống một ngụm nước và nhắc nhở thú cưng uống cùng bạn.', 'DAILY', 'DRINK', 4, 40, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-pomo-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-pomo-01', N'Chiến thần tập trung', N'Hoàn thành 2 phiên làm việc Pomodoro không gián đoạn.', 'DAILY', 'POMODORO', 2, 60, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-stroke-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-stroke-01', N'Cưng chiều bé cưng', N'Tương tác vuốt ve thú cưng 3 lần để gia tăng chỉ số hạnh phúc.', 'DAILY', 'STROKE', 3, 20, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-chat-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-chat-01', N'Tâm sự giờ giải lao', N'Trò chuyện cùng AI Companion để giải tỏa áp lực công việc.', 'DAILY', 'CHAT', 1, 25, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.quests WHERE quest_id = 'quest-music-01')
BEGIN
    INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active)
    VALUES ('quest-music-01', N'Giai điệu thư giãn', N'Bật nhạc Lo-fi làm việc cùng thú cưng trong ít nhất 15 phút.', 'DAILY', 'MUSIC', 1, 25, 1);
END
GO

-- 10. Tiến độ nhiệm vụ người dùng (User Quests)
IF NOT EXISTS (SELECT 1 FROM dbo.user_quests WHERE user_id = 'user-hung-01' AND quest_id = 'quest-feed-01')
BEGIN
    INSERT INTO dbo.user_quests (user_quest_id, user_id, quest_id, progress, is_completed, is_claimed)
    VALUES ('uq-hung-feed-01', 'user-hung-01', 'quest-feed-01', 1, 0, 0);
END
GO

PRINT N'==============================================================================';
PRINT N'✅ HOÀN TẤT KHỞI TẠO CƠ SỞ DỮ LIỆU SQL SERVER CHO OFFICEPET!';
PRINT N'   - 26 bảng dữ liệu đã được đồng bộ chuẩn xác.';
PRINT N'   - 5 loài thú cưng mặc định (Mèo Shiro, Corgi Bento, Thỏ Mochi, Chim Cánh Cụt, Husky).';
PRINT N'   - Tài khoản Admin: admin@techcorp.com / Admin@123';
PRINT N'   - Tài khoản User:  hung@techcorp.com / User@123';
PRINT N'==============================================================================';
GO
`;

const rootSqlPath = path.join(rootDir, 'database.sql');
const prismaSqlPath = path.join(backendDir, 'prisma', 'sqlserver_init.sql');

fs.writeFileSync(rootSqlPath, sqlContent, 'utf8');
fs.writeFileSync(prismaSqlPath, sqlContent, 'utf8');

console.log('✅ Generated database.sql at:', rootSqlPath);
console.log('✅ Synced sqlserver_init.sql at:', prismaSqlPath);
