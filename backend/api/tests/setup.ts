import { beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@/shared/database/prisma'
import { redis } from '@/shared/database/redis'

// Setup test database
beforeAll(async () => {
  // Use test database
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  
  // Clear database
  await prisma.$executeRaw`TRUNCATE TABLE "User", "Venue", "Booking" CASCADE`
})

// Clean up after each test
beforeEach(async () => {
  await redis.flushall()
})

// Cleanup
afterAll(async () => {
  await prisma.$disconnect()
  await redis.quit()
})