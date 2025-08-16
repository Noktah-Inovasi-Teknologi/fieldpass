import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VenueService } from './venue.service'
import { prisma } from '@shared/database/prisma'

vi.mock('@shared/database/prisma', () => ({
  prisma: {
    venue: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}))

describe('VenueService', () => {
  let service: VenueService

  beforeEach(() => {
    service = new VenueService()
    vi.clearAllMocks()
  })

  describe('findAll', () => {
    it('should return all active venues', async () => {
      const mockVenues = [
        { id: '1', name: 'Venue 1', isActive: true },
        { id: '2', name: 'Venue 2', isActive: true }
      ]

      prisma.venue.findMany.mockResolvedValue(mockVenues)

      const result = await service.findAll()

      expect(result).toEqual(mockVenues)
      expect(prisma.venue.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: expect.any(Object),
        orderBy: { rating: 'desc' }
      })
    })

    it('should filter venues by city', async () => {
      await service.findAll({ city: 'Jakarta' })

      expect(prisma.venue.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          city: 'Jakarta'
        },
        include: expect.any(Object),
        orderBy: { rating: 'desc' }
      })
    })
  })

  describe('checkAvailability', () => {
    it('should return true if slot is available', async () => {
      prisma.booking.findFirst.mockResolvedValue(null)

      const result = await service.checkAvailability(
        'venue-1',
        new Date('2024-01-01'),
        '10:00',
        '11:00'
      )

      expect(result).toBe(true)
    })

    it('should return false if slot is booked', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking-1',
        status: 'CONFIRMED'
      })

      const result = await service.checkAvailability(
        'venue-1',
        new Date('2024-01-01'),
        '10:00',
        '11:00'
      )

      expect(result).toBe(false)
    })
  })
})