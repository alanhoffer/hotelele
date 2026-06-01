import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const blockingStatuses = ["confirmed", "assigned", "in_house"] as const;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async get(hotelId: string, rawFrom?: string, rawTo?: string) {
    const from = parseDate(rawFrom, "fecha desde");
    const to = parseDate(rawTo, "fecha hasta");
    if (to <= from) {
      throw new BadRequestException("La fecha hasta debe ser posterior a la fecha desde.");
    }

    const [roomTypes, reservations] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { hotelId, active: true },
        orderBy: { code: "asc" },
        include: {
          rooms: {
            where: {
              hotelId,
              active: true,
              commercialStatus: { notIn: ["blocked", "out_of_service"] },
              maintenanceStatus: { not: "out_of_service" },
            },
            orderBy: [{ floor: "asc" }, { number: "asc" }],
          },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          hotelId,
          status: { in: [...blockingStatuses] },
          checkInDate: { lt: to },
          checkOutDate: { gt: from },
        },
        select: {
          id: true,
          code: true,
          roomTypeId: true,
          assignedRoomId: true,
        },
      }),
    ]);

    const reservationsByType = new Map<string, typeof reservations>();
    const assignedRoomIds = new Set<string>();
    for (const reservation of reservations) {
      const current = reservationsByType.get(reservation.roomTypeId) ?? [];
      current.push(reservation);
      reservationsByType.set(reservation.roomTypeId, current);
      if (reservation.assignedRoomId) assignedRoomIds.add(reservation.assignedRoomId);
    }

    const roomTypeRows = roomTypes.map((roomType) => {
      const typeReservations = reservationsByType.get(roomType.id) ?? [];
      const possibleRooms = roomType.rooms.filter((room) => !assignedRoomIds.has(room.id));
      const available = Math.max(roomType.rooms.length - typeReservations.length, 0);

      return {
        roomType: {
          id: roomType.id,
          code: roomType.code,
          name: roomType.name,
          baseCapacity: roomType.baseCapacity,
          maxCapacity: roomType.maxCapacity,
        },
        totalRooms: roomType.rooms.length,
        reserved: typeReservations.length,
        available,
        availableRooms: possibleRooms.slice(0, available).map((room) => ({
          id: room.id,
          number: room.number,
          floor: room.floor,
          block: room.block,
        })),
      };
    });

    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      totalRooms: roomTypeRows.reduce((sum, row) => sum + row.totalRooms, 0),
      reserved: reservations.length,
      available: roomTypeRows.reduce((sum, row) => sum + row.available, 0),
      roomTypes: roomTypeRows,
    };
  }
}

function parseDate(value: string | undefined, label: string) {
  if (!value) throw new BadRequestException(`Falta ${label}.`);
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Valor invalido para ${label}.`);
  }
  return date;
}
