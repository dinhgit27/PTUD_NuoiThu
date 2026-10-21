const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    IF OBJECT_ID('dbo.friendships', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.friendships (
        id NVARCHAR(36) NOT NULL PRIMARY KEY DEFAULT NEWID(),
        user_id NVARCHAR(36) NOT NULL,
        friend_id NVARCHAR(36) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'ACCEPTED',
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_friendship UNIQUE (user_id, friend_id)
      );
      CREATE INDEX IX_friendships_userId ON dbo.friendships(user_id);
      CREATE INDEX IX_friendships_friendId ON dbo.friendships(friend_id);
    END
  `);

  await prisma.$executeRawUnsafe(`
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
      CREATE INDEX IX_dm_sender_receiver ON dbo.direct_messages(sender_id, receiver_id);
      CREATE INDEX IX_dm_receiver ON dbo.direct_messages(receiver_id);
    END
  `);

  await prisma.$executeRawUnsafe(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.messages') AND name = 'sender_name')
    BEGIN
      ALTER TABLE dbo.messages ADD sender_name NVARCHAR(255) NULL;
    END
  `);

  console.log('SQL Server schema updated successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
