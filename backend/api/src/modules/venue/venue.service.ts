import { prisma } from '@shared/database/prisma'
import { redis } from '@shared/database/redis'
import { z } from 'zod'
import { AppError } from '@shared/utils/errors'

// Validation schemas
export const CreateVenueSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  address: z.string(),
  city: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  sports: z.array(z.string()).min(1),
  facilities: z.array(z.string()),
  pricePerHour: z.number().positive(),
  openTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  closeTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
})

export type CreateVenueInput = z.infer<typeof CreateVenueSchema>

export class VenueService {
  async findAll(filters?: {
    city?: string
    sport?: string
    minPrice?: number
    maxPrice?: number
  }) {
    // Check cache first
    const cacheKey = `venues:${JSON.stringify(filters)}`
    const cached = await redis.get(cacheKey)
    
    if (cached) {
      return JSON.parse(cached)
    }

    const venues = await prisma.venue.findMany({
      where: {
        isActive: true,
        ...(filters?.city && { city: filters.city }),
        ...(filters?.sport && { sports: { has: filters.sport } }),
        ...(filters?.minPrice && { pricePerHour: { gte: filters.minPrice } }),
        ...(filters?.maxPrice && { pricePerHour: { lte: filters.maxPrice } })
      },
      include: {
        timeSlots: true,
        _count: {
          select: { bookings: true, reviews: true }
        }
      },
      orderBy: { rating: 'desc' }
    })

    // Cache for 5 minutes
    await redis.setex(cacheKey, 300, JSON.stringify(venues))

    return venues
  }

  async findById(id: string) {
    const venue = await prisma.venue.findUnique({
      where: { id },
      include: {
        timeSlots: true,
        reviews: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { username: true, profile: true }
            }
          }
        }
      }
    })

    if (!venue) {
      throw new AppError('Venue not found', 404)
    }

    return venue
  }

  async create(input: CreateVenueInput) {
    const validated = CreateVenueSchema.parse(input)
    
    // Generate slug from name
    const slug = this.generateSlug(validated.name)

    const venue = await prisma.venue.create({
      data: {
        ...validated,
        slug,
        images: [] // Will be updated when images are uploaded
      }
    })

    // Generate default time slots
    await this.generateTimeSlots(venue.id)

    return venue
  }

  async checkAvailability(
    venueId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    // Check if there's any conflicting booking
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        venueId,
        date: {
          equals: new Date(date.toDateString())
        },
        status: {
          in: ['CONFIRMED', 'PENDING']
        },
        OR: [
          {
            // New booking starts during existing booking
            startTime: { lte: startTime },
            endTime: { gt: startTime }
          },
          {
            // New booking ends during existing booking
            startTime: { lt: endTime },
            endTime: { gte: endTime }
          },
          {
            // New booking completely covers existing booking
            startTime: { gte: startTime },
            endTime: { lte: endTime }
          }
        ]
      }
    })

    return !conflictingBooking
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private async generateTimeSlots(venueId: string) {
    const slots = []
    
    // Generate slots for each day of the week
    for (let day = 0; day < 7; day++) {
      // Generate hourly slots from 6 AM to 11 PM
      for (let hour = 6; hour < 23; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`
        
        // Peak hours (6-9 PM on weekdays, 8 AM-8 PM on weekends)
        const isPeakHour = 
          (day >= 1 && day <= 5 && hour >= 18 && hour <= 21) ||
          (day === 0 || day === 6) && hour >= 8 && hour <= 20
        
        slots.push({
          venueId,
          dayOfWeek: day,
          startTime,
          endTime,
          isPeakHour,
          priceMultiplier: isPeakHour ? 1.5 : 1.0
        })
      }
    }

    await prisma.timeSlot.createMany({ data: slots })
  }
}

export const venueService = new VenueService()