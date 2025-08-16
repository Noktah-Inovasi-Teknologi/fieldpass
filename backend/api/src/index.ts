import { buildApp } from './app'
import { logger } from '@shared/utils/logger'

const start = async () => {
  try {
    const app = await buildApp()
    
    const port = process.env.PORT || 4000
    const host = process.env.HOST || '0.0.0.0'
    
    await app.listen({ port: Number(port), host })
    
    logger.info(`🚀 FieldPass API running at http://${host}:${port}`)
    logger.info(`📊 GraphQL Playground at http://${host}:${port}/graphql`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

start()