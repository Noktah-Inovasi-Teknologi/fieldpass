import { prisma } from '@shared/database/prisma'
import { redis } from '@shared/database/redis'
import { verifyToken } from '@modules/auth/auth.service'
import type { User } from '@prisma/client'

export interface Context {
  prisma: typeof prisma
  redis: typeof redis
  user: User | null
  req: any
}

export async function createContext({ req }): Promise<Context> {
  let user = null

  // Extract token from header
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (token) {
    try {
      const decoded = await verifyToken(token)
      user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      })
    } catch (error) {
      // Invalid token, user remains null
    }
  }

  return {
    prisma,
    redis,
    user,
    req
  }
}