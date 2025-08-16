import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema'
import { createContext } from './context'
import { errorHandler } from '@shared/middleware/error.middleware'

export async function buildApp(opts = {}) {
  const app = Fastify({
    logger: true,
    ...opts
  })

  // Register plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || true,
    credentials: true
  })

  await app.register(helmet, {
    contentSecurityPolicy: false // For GraphQL Playground
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute'
  })

  // Error handler
  app.setErrorHandler(errorHandler)

  // Health check
  app.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  })

  // GraphQL Yoga
  const yoga = createYoga({
    schema,
    context: createContext,
    logging: app.log,
    maskedErrors: process.env.NODE_ENV === 'production'
  })

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequest(req, {
        req,
        reply
      })
      
      response.headers.forEach((value, key) => {
        reply.header(key, value)
      })
      
      reply.status(response.status)
      reply.send(response.body)
      
      return reply
    }
  })

  // Webhook endpoints
  app.post('/webhooks/xendit', async (req, reply) => {
    // Handle Xendit webhooks
    return { received: true }
  })

  return app
}