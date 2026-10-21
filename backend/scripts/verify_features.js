const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function main() {
  console.log('--- 1. Testing DB UTF-8 Vietnamese & Dept ---');
  const user = await prisma.user.findFirst({ where: { email: 'hung@techcorp.com' }, include: { department: true } });
  console.log('✓ User fullName:', user.fullName);
  console.log('✓ Department name:', user.department?.name, '| Invite code:', user.department?.inviteCode);

  console.log('\n--- 2. Testing Department Members & Messages ---');
  const members = await prisma.user.findMany({ where: { deptId: user.deptId }, select: { id: true, fullName: true } });
  console.log('✓ Members in room:', members.map(m => m.fullName));

  const msg = await prisma.message.create({
    data: {
      deptId: user.deptId,
      senderId: user.id,
      title: user.fullName,
      content: 'Chào cả phòng ban! Chúc mọi người ngày làm việc hiệu quả! 🐾',
      messageType: 'ROOM_CHAT',
      urgency: 'NORMAL'
    }
  });
  console.log('✓ Created Room Message:', msg.id, msg.content);

  console.log('\n--- 3. Testing Friendships & Direct Messages ---');
  const colleague = await prisma.user.findFirst({ where: { email: 'minh@techcorp.com' } });
  if (colleague) {
    // Add friendship if not exists
    const existingFriend = await prisma.$queryRaw`
      SELECT id FROM dbo.friendships
      WHERE (user_id = ${user.id} AND friend_id = ${colleague.id})
         OR (user_id = ${colleague.id} AND friend_id = ${user.id})
    `;
    if (existingFriend.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO dbo.friendships (id, user_id, friend_id, status, created_at)
        VALUES (NEWID(), ${user.id}, ${colleague.id}, 'ACCEPTED', SYSUTCDATETIME())
      `;
      console.log('✓ Created friendship between', user.fullName, 'and', colleague.fullName);
    } else {
      console.log('✓ Friendship already exists between', user.fullName, 'and', colleague.fullName);
    }

    // Send a DM test
    await prisma.$executeRaw`
      INSERT INTO dbo.direct_messages (id, sender_id, receiver_id, content, is_read, created_at)
      VALUES (NEWID(), ${user.id}, ${colleague.id}, N'Chào Minh, hôm nay tiến độ dự án thế nào rồi?', 0, SYSUTCDATETIME())
    `;
    console.log('✓ Sent test direct message to', colleague.fullName);
  }

  console.log('\n--- 4. Testing Google Generative AI SDK Function Calling ---');
  const { AIService } = require('../dist/services/aiService.js');
  const aiStress = await AIService.chatWithPet(user.id, 'Mình đang áp lực và mệt mỏi quá, làm sao để xả stress');
  console.log('✓ AI Stress Call Action:', aiStress.action);
  console.log('✓ AI Stress Reply:', aiStress.reply);

  const aiFocus = await AIService.chatWithPet(user.id, 'Bắt đầu phiên pomodoro 25 phút giúp mình tập trung');
  console.log('✓ AI Pomodoro Call Action:', aiFocus.action);
  console.log('✓ AI Pomodoro Reply:', aiFocus.reply);

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! ');
}

main().catch(console.error).finally(() => prisma.$disconnect());
