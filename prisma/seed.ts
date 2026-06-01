import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { permissions, roleCodes } from "@hotel-pms/shared";

const prisma = new PrismaClient();

async function main() {
  const hotel = await prisma.hotel.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Hotel Demo",
      legalName: "Hotel Demo S.A.",
      taxId: "30715371169",
      timezone: "America/Asuncion",
      currency: "ARS",
    },
  });

  const permissionRows = await Promise.all(
    Object.values(permissions).map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      }),
    ),
  );

  const adminRole = await upsertRole(roleCodes.admin, "Admin", permissionRows.map((p) => p.id));
  const receptionRole = await upsertRole(roleCodes.reception, "Recepcion", [
    permissionRows.find((p) => p.code === permissions.roomView)!.id,
    permissionRows.find((p) => p.code === permissions.roomUpdateStatus)!.id,
    permissionRows.find((p) => p.code === permissions.availabilityView)!.id,
    permissionRows.find((p) => p.code === permissions.reservationView)!.id,
    permissionRows.find((p) => p.code === permissions.reservationCreate)!.id,
    permissionRows.find((p) => p.code === permissions.reservationUpdate)!.id,
    permissionRows.find((p) => p.code === permissions.reservationCheckIn)!.id,
    permissionRows.find((p) => p.code === permissions.reservationCheckOut)!.id,
    permissionRows.find((p) => p.code === permissions.folioView)!.id,
    permissionRows.find((p) => p.code === permissions.folioChargeCreate)!.id,
    permissionRows.find((p) => p.code === permissions.folioPaymentCreate)!.id,
    permissionRows.find((p) => p.code === permissions.folioChargeVoid)!.id,
    permissionRows.find((p) => p.code === permissions.folioPaymentVoid)!.id,
    permissionRows.find((p) => p.code === permissions.housekeepingView)!.id,
    permissionRows.find((p) => p.code === permissions.housekeepingUpdate)!.id,
    permissionRows.find((p) => p.code === permissions.maintenanceView)!.id,
    permissionRows.find((p) => p.code === permissions.maintenanceUpdate)!.id,
    permissionRows.find((p) => p.code === permissions.cashView)!.id,
    permissionRows.find((p) => p.code === permissions.cashManage)!.id,
    permissionRows.find((p) => p.code === permissions.invoiceView)!.id,
    permissionRows.find((p) => p.code === permissions.invoiceCreate)!.id,
    permissionRows.find((p) => p.code === permissions.reservationTransfer)!.id,
    permissionRows.find((p) => p.code === permissions.calendarView)!.id,
  ]);
  const housekeepingRole = await upsertRole(roleCodes.housekeeping, "Housekeeping", [
    permissionRows.find((p) => p.code === permissions.roomView)!.id,
    permissionRows.find((p) => p.code === permissions.roomUpdateStatus)!.id,
    permissionRows.find((p) => p.code === permissions.housekeepingView)!.id,
    permissionRows.find((p) => p.code === permissions.housekeepingUpdate)!.id,
  ]);
  const maintenanceRole = await upsertRole(roleCodes.maintenance, "Mantenimiento", [
    permissionRows.find((p) => p.code === permissions.roomView)!.id,
    permissionRows.find((p) => p.code === permissions.maintenanceView)!.id,
    permissionRows.find((p) => p.code === permissions.maintenanceUpdate)!.id,
  ]);
  const cashRole = await upsertRole(roleCodes.cash, "Caja", [
    permissionRows.find((p) => p.code === permissions.cashView)!.id,
    permissionRows.find((p) => p.code === permissions.cashManage)!.id,
    permissionRows.find((p) => p.code === permissions.folioView)!.id,
    permissionRows.find((p) => p.code === permissions.folioPaymentCreate)!.id,
    permissionRows.find((p) => p.code === permissions.invoiceView)!.id,
    permissionRows.find((p) => p.code === permissions.invoiceCreate)!.id,
  ]);
  const managementRole = await upsertRole(roleCodes.management, "Gerencia", [
    permissionRows.find((p) => p.code === permissions.roomView)!.id,
    permissionRows.find((p) => p.code === permissions.availabilityView)!.id,
    permissionRows.find((p) => p.code === permissions.reservationView)!.id,
    permissionRows.find((p) => p.code === permissions.folioView)!.id,
    permissionRows.find((p) => p.code === permissions.housekeepingView)!.id,
    permissionRows.find((p) => p.code === permissions.maintenanceView)!.id,
    permissionRows.find((p) => p.code === permissions.cashView)!.id,
    permissionRows.find((p) => p.code === permissions.invoiceView)!.id,
    permissionRows.find((p) => p.code === permissions.calendarView)!.id,
    permissionRows.find((p) => p.code === permissions.auditView)!.id,
  ]);

  await upsertUser(hotel.id, adminRole.id, "Admin Hotel", "admin@hotel.local", "admin123");
  await upsertUser(hotel.id, receptionRole.id, "Recepcion Demo", "recepcion@hotel.local", "recepcion123");
  await upsertUser(hotel.id, housekeepingRole.id, "Housekeeping Demo", "housekeeping@hotel.local", "housekeeping123");
  await upsertUser(hotel.id, maintenanceRole.id, "Mantenimiento Demo", "mantenimiento@hotel.local", "mantenimiento123");
  await upsertUser(hotel.id, cashRole.id, "Caja Demo", "caja@hotel.local", "caja123");
  await upsertUser(hotel.id, managementRole.id, "Gerencia Demo", "gerencia@hotel.local", "gerencia123");

  const standard = await upsertRoomType(hotel.id, "STD", "Estandar", 2, 3);
  const superior = await upsertRoomType(hotel.id, "SUP", "Superior", 2, 4);
  const suite = await upsertRoomType(hotel.id, "STE", "Suite", 2, 4);

  await seedRooms(hotel.id, standard.id, 101, 110, "1", "Torre A", 2);
  await seedRooms(hotel.id, superior.id, 201, 206, "2", "Torre A", 3);
  await seedRooms(hotel.id, suite.id, 301, 304, "3", "Torre B", 4);
  await seedReservations(hotel.id, standard.id, superior.id);
  await seedOperationalTasks(hotel.id);

  console.log("Seed demo listo.");
}

async function upsertRole(code: string, name: string, permissionIds: string[]) {
  const role = await prisma.role.upsert({
    where: { code },
    update: { name },
    create: { code, name },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
    skipDuplicates: true,
  });

  return role;
}

async function upsertUser(hotelId: string, roleId: string, name: string, email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { hotelId, roleId, name, passwordHash, status: "active" },
    create: { hotelId, roleId, name, email, passwordHash, status: "active" },
  });
}

async function upsertRoomType(
  hotelId: string,
  code: string,
  name: string,
  baseCapacity: number,
  maxCapacity: number,
) {
  return prisma.roomType.upsert({
    where: { hotelId_code: { hotelId, code } },
    update: { name, baseCapacity, maxCapacity, active: true },
    create: { hotelId, code, name, baseCapacity, maxCapacity, active: true },
  });
}

async function seedRooms(
  hotelId: string,
  roomTypeId: string,
  from: number,
  to: number,
  floor: string,
  block: string,
  capacity: number,
) {
  for (let number = from; number <= to; number += 1) {
    await prisma.room.upsert({
      where: { hotelId_number: { hotelId, number: String(number) } },
      update: {
        roomTypeId,
        floor,
        block,
        capacity,
        active: true,
        commercialStatus: "available",
        cleaningStatus: number % 4 === 0 ? "dirty" : "clean",
        maintenanceStatus: number % 9 === 0 ? "pending" : "ok",
      },
      create: {
        hotelId,
        roomTypeId,
        number: String(number),
        floor,
        block,
        capacity,
        commercialStatus: "available",
        cleaningStatus: number % 4 === 0 ? "dirty" : "clean",
        maintenanceStatus: number % 9 === 0 ? "pending" : "ok",
      },
    });
  }
}

async function seedReservations(hotelId: string, standardTypeId: string, superiorTypeId: string) {
  const today = startOfUtcDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const inTwoDays = addDays(today, 2);
  const inFourDays = addDays(today, 4);

  const room102 = await prisma.room.findUnique({ where: { hotelId_number: { hotelId, number: "102" } } });
  const room201 = await prisma.room.findUnique({ where: { hotelId_number: { hotelId, number: "201" } } });
  if (!room102 || !room201) return;

  const guestArrival = await upsertGuest(
    "00000000-0000-0000-0000-000000000101",
    hotelId,
    "Martina",
    "Perez",
    "32888777",
    "martina.perez@example.com",
  );
  const guestFuture = await upsertGuest(
    "00000000-0000-0000-0000-000000000102",
    hotelId,
    "Lucas",
    "Rios",
    "30111222",
    "lucas.rios@example.com",
  );
  const guestInHouse = await upsertGuest(
    "00000000-0000-0000-0000-000000000103",
    hotelId,
    "Ana",
    "Molina",
    "28777444",
    "ana.molina@example.com",
  );

  const arrival = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-ARRIVAL" } },
    update: {
      guestId: guestArrival.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room102.id,
      status: "assigned",
      checkInDate: today,
      checkOutDate: inTwoDays,
      adults: 2,
      children: 0,
      totalAmount: 240000,
      depositAmount: 60000,
      depositPaid: true,
      depositMethod: "card",
      depositReference: "Sena demo tarjeta",
    },
    create: {
      hotelId,
      guestId: guestArrival.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room102.id,
      code: "R-DEMO-ARRIVAL",
      status: "assigned",
      source: "direct",
      checkInDate: today,
      checkOutDate: inTwoDays,
      adults: 2,
      children: 0,
      currency: "ARS",
      totalAmount: 240000,
      depositAmount: 60000,
      depositPaid: true,
      depositMethod: "card",
      depositReference: "Sena demo tarjeta",
      notes: "Reserva demo para probar check-in.",
    },
  });

  await resetDemoReservationOperation(arrival.id);

  const future = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-FUTURE" } },
    update: {
      guestId: guestFuture.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: null,
      status: "confirmed",
      checkInDate: tomorrow,
      checkOutDate: inFourDays,
      adults: 2,
      children: 1,
      totalAmount: 450000,
      depositAmount: 100000,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
    },
    create: {
      hotelId,
      guestId: guestFuture.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: null,
      code: "R-DEMO-FUTURE",
      status: "confirmed",
      source: "online_csv",
      checkInDate: tomorrow,
      checkOutDate: inFourDays,
      adults: 2,
      children: 1,
      currency: "ARS",
      totalAmount: 450000,
      depositAmount: 100000,
      depositPaid: false,
      notes: "Reserva demo sin habitacion asignada.",
    },
  });
  await resetDemoReservationOperation(future.id);

  const inHouse = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-INHOUSE" } },
    update: {
      guestId: guestInHouse.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room201.id,
      status: "in_house",
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      adults: 1,
      children: 0,
      totalAmount: 320000,
      depositAmount: 0,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
    },
    create: {
      hotelId,
      guestId: guestInHouse.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room201.id,
      code: "R-DEMO-INHOUSE",
      status: "in_house",
      source: "direct",
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      adults: 1,
      children: 0,
      currency: "ARS",
      totalAmount: 320000,
      depositAmount: 0,
      depositPaid: false,
      notes: "Estadia demo para probar check-out.",
    },
  });

  const stay = await prisma.stay.upsert({
    where: { reservationId: inHouse.id },
    update: { hotelId, roomId: room201.id, status: "in_house", checkedOutAt: null },
    create: { hotelId, reservationId: inHouse.id, roomId: room201.id, status: "in_house" },
  });
  const folio = await prisma.folio.upsert({
    where: { reservationId: inHouse.id },
    update: {
      hotelId,
      stayId: stay.id,
      roomId: room201.id,
      status: "open",
      closedAt: null,
      currency: "ARS",
    },
    create: {
      hotelId,
      reservationId: inHouse.id,
      stayId: stay.id,
      roomId: room201.id,
      status: "open",
      currency: "ARS",
    },
  });
  await prisma.invoice.deleteMany({ where: { folioId: folio.id } });
  await prisma.payment.deleteMany({ where: { folioId: folio.id } });
  await prisma.charge.deleteMany({ where: { folioId: folio.id } });
  await prisma.charge.createMany({
    data: [
      {
        hotelId,
        folioId: folio.id,
        kind: "lodging",
        description: "Alojamiento demo",
        quantity: 1,
        unitAmount: 320000,
        totalAmount: 320000,
      },
      {
        hotelId,
        folioId: folio.id,
        kind: "minibar",
        description: "Frigobar demo",
        quantity: 1,
        unitAmount: 8500,
        totalAmount: 8500,
      },
    ],
  });
  await prisma.payment.create({
    data: {
      hotelId,
      folioId: folio.id,
      method: "card",
      currency: "ARS",
      amount: 328500,
      reference: "Pago demo",
    },
  });
  await prisma.room.update({
    where: { id: room201.id },
    data: { commercialStatus: "occupied" },
  });
}

async function upsertGuest(
  id: string,
  hotelId: string,
  firstName: string,
  lastName: string,
  documentNumber: string,
  email: string,
) {
  return prisma.guest.upsert({
    where: { id },
    update: { hotelId, firstName, lastName, documentType: "DNI", documentNumber, email },
    create: { id, hotelId, firstName, lastName, documentType: "DNI", documentNumber, email },
  });
}

async function resetDemoReservationOperation(reservationId: string) {
  const folio = await prisma.folio.findUnique({ where: { reservationId } });
  if (folio) {
    await prisma.payment.deleteMany({ where: { folioId: folio.id } });
    await prisma.charge.deleteMany({ where: { folioId: folio.id } });
    await prisma.folio.delete({ where: { id: folio.id } });
  }
  await prisma.stay.deleteMany({ where: { reservationId } });
}

async function seedOperationalTasks(hotelId: string) {
  const dirtyRooms = await prisma.room.findMany({
    where: { hotelId, cleaningStatus: "dirty", active: true },
    take: 6,
  });

  for (const room of dirtyRooms) {
    const activeTask = await prisma.housekeepingTask.findFirst({
      where: {
        hotelId,
        roomId: room.id,
        status: { in: ["pending", "in_progress", "inspection"] },
      },
    });
    if (!activeTask) {
      await prisma.housekeepingTask.create({
        data: {
          hotelId,
          roomId: room.id,
          source: "seed",
          notes: "Limpieza demo por estado sucio.",
        },
      });
    }
  }

  const room109 = await prisma.room.findUnique({
    where: { hotelId_number: { hotelId, number: "109" } },
  });
  if (room109) {
    const existing = await prisma.maintenanceTicket.findFirst({
      where: {
        hotelId,
        roomId: room109.id,
        title: "Revisar aire acondicionado",
        status: { in: ["pending", "in_progress"] },
      },
    });
    if (!existing) {
      await prisma.maintenanceTicket.create({
        data: {
          hotelId,
          roomId: room109.id,
          title: "Revisar aire acondicionado",
          description: "Ticket demo para flujo de mantenimiento.",
          priority: "medium",
        },
      });
      await prisma.room.update({
        where: { id: room109.id },
        data: { maintenanceStatus: "pending" },
      });
    }
  }
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
