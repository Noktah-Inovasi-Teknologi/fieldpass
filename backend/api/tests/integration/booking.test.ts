import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '@/app'
import { prisma } from '@/shared/database/prisma'
import { createTestUser, createTestVenue } from '../helpers'

describe('Booking Integration', () => {
  let app: any
  let authToken: string
  let user: any
  let venue: any

  beforeEach(async () => {
    app = await buildApp({ logger: false })
    
    // Create test data
    user = await createTestUser()
    venue = await createTestVenue()
    authToken = generateToken(user.id)
  })

  it('should create a booking successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      payload: {
        query: `
          mutation CreateBooking($input: CreateBookingInput!) {
            createBooking(input: $input) {
              id
              bookingCode
              status
              venue {
                name
              }
            }
          }
        `,
        variables: {
          input: {
            venueId: venue.id,
            date: '2024-02-01',
            startTime: '10:00',
            endTime: '12:00'
          }
        }
      }
    })

    const result = JSON.parse(response.body)
    
    expect(response.statusCode).toBe(200)
    expect(result.data.createBooking).toMatchObject({
      status: 'PENDING',
      venue: { name: venue.name }
    })
    expect(result.data.createBooking.bookingCode).toBeDefined()

    // Verify in database
    const booking = await prisma.booking.findUnique({
      where: { id: result.data.createBooking.id }
    })
    
    expect(booking).toBeDefined()
    expect(booking?.userId).toBe(user.id)
  })

  it('should not allow double booking', async () => {
    // Create first booking
    await prisma.booking.create({
      data: {
        bookingCode: 'BOOK001',
        userId: user.id,
        venueId: venue.id,
        date: new Date('2024-02-01'),
        startTime: '10:00',
        endTime: '12:00',
        duration: 120,
        totalPrice: 200000,
        status: 'CONFIRMED'
      }
    })

    // Try to book same slot
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      payload: {
        query: `
          mutation CreateBooking($input: CreateBookingInput!) {
            createBooking(input: $input) {
              id
            }
          }
        `,
        variables: {
          input: {
            venueId: venue.id,
            date: '2024-02-01',
            startTime: '11:00',
            endTime: '13:00'
          }
        }
      }
    })

    const result = JSON.parse(response.body)
    
    expect(result.errors).toBeDefined()
    expect(result.errors[0].message).toContain('not available')
  })
})