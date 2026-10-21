const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Creating quests table if not exists...');
  await prisma.$executeRawUnsafe(`
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
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_quests_category ON dbo.quests(category);
      CREATE INDEX IX_quests_action_type ON dbo.quests(action_type);
    END
  `);

  console.log('Creating user_quests table if not exists...');
  await prisma.$executeRawUnsafe(`
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
        CONSTRAINT UQ_user_quest UNIQUE (user_id, quest_id)
      );
      CREATE INDEX IX_user_quests_userId ON dbo.user_quests(user_id);
      CREATE INDEX IX_user_quests_questId ON dbo.user_quests(quest_id);
    END
  `);

  // Check if quests table has any default quests
  const countResult = await prisma.$queryRaw`SELECT COUNT(*) AS total FROM dbo.quests`;
  const count = Number(countResult[0]?.total || 0);

  if (count === 0) {
    console.log('Seeding initial quests...');
    const defaultQuests = [
      {
        title: 'Bữa ăn thịnh soạn',
        description: 'Cho bé cưng ăn một bữa thơm ngon để nạp năng lượng.',
        category: 'DAILY',
        action_type: 'FEED',
        target_count: 1,
        reward_exp: 60
      },
      {
        title: 'Uống đủ nước mỗi ngày',
        description: 'Bấm uống nước cùng bé để bảo vệ sức khỏe và chống mỏi mệt.',
        category: 'DAILY',
        action_type: 'DRINK',
        target_count: 1,
        reward_exp: 50
      },
      {
        title: 'Âu yếm thú cưng',
        description: 'Vuốt ve bé cưng 2 lần để tăng chỉ số hạnh phúc.',
        category: 'DAILY',
        action_type: 'STROKE',
        target_count: 2,
        reward_exp: 50
      },
      {
        title: 'Chinh phục Pomodoro',
        description: 'Hoàn thành 1 phiên làm việc tập trung Pomodoro.',
        category: 'DAILY',
        action_type: 'POMODORO',
        target_count: 1,
        reward_exp: 100
      },
      {
        title: 'Tâm sự cùng AI',
        description: 'Trò chuyện chia sẻ với bé cưng AI 2 lần.',
        category: 'DAILY',
        action_type: 'CHAT',
        target_count: 2,
        reward_exp: 70
      },
      {
        title: 'Giai điệu thư giãn',
        description: 'Bật một bài nhạc Lo-fi hoặc âm thanh thiên nhiên cùng bé.',
        category: 'DAILY',
        action_type: 'MUSIC',
        target_count: 1,
        reward_exp: 50
      },
      {
        title: 'Chiến binh chăm chỉ',
        description: 'Hoàn thành 5 phiên tập trung Pomodoro trong tuần.',
        category: 'WEEKLY',
        action_type: 'POMODORO',
        target_count: 5,
        reward_exp: 300
      }
    ];

    for (const q of defaultQuests) {
      await prisma.$executeRaw`
        INSERT INTO dbo.quests (quest_id, title, description, category, action_type, target_count, reward_exp, is_active, created_at, updated_at)
        VALUES (NEWID(), ${q.title}, ${q.description}, ${q.category}, ${q.action_type}, ${q.target_count}, ${q.reward_exp}, 1, SYSUTCDATETIME(), SYSUTCDATETIME())
      `;
    }
    console.log(`Seeded ${defaultQuests.length} default quests successfully!`);
  } else {
    console.log(`Quests table already has ${count} quests.`);
  }

  console.log('Quests database setup complete!');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
