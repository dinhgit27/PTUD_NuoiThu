-- ==============================================================================
-- OfficePet 2D Pixel Art - SQL Server Database Initialization Script
-- Compatible with Microsoft SQL Server 2016, 2019, 2022 & SQL Server Express
-- ==============================================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'officepet')
BEGIN
    CREATE DATABASE [officepet];
    PRINT 'Đã tạo cơ sở dữ liệu officepet thành công.';
END
GO

USE [officepet];
GO

-- 1. Bảng organizations (Quản lý công ty / tổ chức đa người dùng)
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

-- 5. Bảng user_preferences (Cài đặt cá nhân, nhạc Lo-fi & AI memory)
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

-- 7. Bảng user_pets (Thú cưng ảo đang nuôi)
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

-- 8. Bảng items (Cửa hàng vật phẩm, trang phục, thức ăn pixel art)
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

-- 9. Bảng user_items (Kho đồ người dùng & trang bị thú cưng)
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

-- 11. Bảng exp_records (Nhật ký cộng/trừ EXP & đóng góp khu vườn)
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

-- 12. Bảng work_sessions (Phiên làm việc tập trung Pomodoro)
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

-- 13. Bảng daily_goals (Mục tiêu hàng ngày & chuỗi ngày streak)
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

-- 14. Bảng gifts (Tặng quà xã hội trong khu vườn)
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

-- 15. Bảng events & event_participants (Thử thách tập thể phòng ban)
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

-- 16. Bảng messages & mood_logs (Bong bóng lời thoại & nhật ký cảm xúc)
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

-- ==============================================================================
-- Dữ liệu mẫu ban đầu (Seed Data)
-- ==============================================================================

-- Thêm Tổ chức mặc định
IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE domain = 'techcorp.com')
BEGIN
    INSERT INTO dbo.organizations (org_id, name, domain, package_tier, status)
    VALUES ('org-default-01', N'TechCorp Solutions', 'techcorp.com', 'ENTERPRISE', 'ACTIVE');
END
GO

-- Thêm Bối cảnh khu vườn mặc định
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

-- Thêm Phòng ban mặc định
IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE invite_code = 'TECH01')
BEGIN
    INSERT INTO dbo.departments (dept_id, org_id, name, invite_code, work_hours, garden_level, garden_exp, background_id)
    VALUES ('dept-tech-01', 'org-default-01', N'Phòng Kỹ Thuật & Phần Mềm', 'TECH01', '08:30 - 17:30', 2, 450, 'bg-spring-01');
END
GO

-- Thêm Tài khoản Quản trị viên (Mật khẩu: Admin@123)
-- Hash bcrypt tương ứng: $2b$10$oYJiqf/K3mHk6G4vW.J82u1Y0mK/L.P3v0G4Y3W2U1M.0K/L.P3vO
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'admin@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-admin-01', 'admin@techcorp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', N'OfficePet Admin', 'ADMIN', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

-- Thêm Tài khoản người dùng mẫu (Mật khẩu: User@123)
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'hung@techcorp.com')
BEGIN
    INSERT INTO dbo.users (user_id, email, password_hash, full_name, role, status, org_id, dept_id)
    VALUES ('user-hung-01', 'hung@techcorp.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', N'Phi Hùng', 'USER', 'ACTIVE', 'org-default-01', 'dept-tech-01');
END
GO

PRINT N'Hoàn tất khởi tạo cơ sở dữ liệu SQL Server cho OfficePet!';
GO
