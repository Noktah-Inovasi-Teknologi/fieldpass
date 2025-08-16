import { describe, it, expect } from 'vitest'
import { buildApp } from '@/app'

describe('User Journey - Book a Venue', () => {
  let app: any
  
  beforeEach(async () => {
    app = await buildApp({ logger: false })
  })

  it('complete booking flow', async () => {
    // 1. Register user
    const registerRes = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: {
        query: `
          mutation Register($input: RegisterInput!) {
            register(input: $input) {
              token
              user { id, email }
            }
          }
        `,
        variables: {
          input: {
            email: 'player@fieldpass.id',
            username: 'player123',
            password: 'SecurePass123!'
          }
        }
      }
    })

    const { token, user } = JSON.parse(registerRes.body).data.register

    // 2. Search venues
    const searchRes = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'Authorization': `Bearer ${token}` },
      payload: {
        query: `
          query SearchVenues {
            venues(city: "Jakarta", sport: "badminton") {
              id
              name
              pricePerHour
              rating
            }
          }
        `
      }
    })

    const venues = JSON.parse(searchRes.body).data.venues
    expect(venues.length).toBeGreaterThan(0)

    // 3. Check availability
    const venueId = venues[0].id
    const availabilityRes = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'Authorization': `Bearer ${token}` },
      payload: {
        query: `
          query CheckAvailability($venueId: ID!, $date: String!) {
            venueAvailability(venueId: $venueId, date: $date) {
              availableSlots {
                startTime
                endTime
                price
              }
            }
          }
        `,
        variables: {
          venueId,
          date: '2024-02-01'
        }
      }
    })

    const slots = JSON.parse(availabilityRes.body).data.venueAvailability.availableSlots
    expect(slots.length).toBeGreaterThan(0)

    // 4. Create booking
    const bookingRes = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'Authorization': `Bearer ${token}` },
      payload: {
        query: `
          mutation CreateBooking($input: CreateBookingInput!) {
            createBooking(input: $input) {
              id
              bookingCode
              totalPrice
              payment {
                paymentUrl
              }
            }
          }
        `,
        variables: {
          input: {
            venueId,
            date: '2024-02-01',
            startTime: slots[0].startTime,
            endTime: slots[0].endTime
          }
        }
      }
    })

    const booking = JSON.parse(bookingRes.body).data.createBooking
    expect(booking.bookingCode).toBeDefined()
    expect(booking.payment.paymentUrl).toContain('xendit.co')
  })
})