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
  const threeDaysAgo = addDays(today, -3);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const inTwoDays = addDays(today, 2);
  const inThreeDays = addDays(today, 3);
  const inFourDays = addDays(today, 4);
  const inFiveDays = addDays(today, 5);
  const inSixDays = addDays(today, 6);
  const inEightDays = addDays(today, 8);
  const inTenDays = addDays(today, 10);

  const demoRooms = await prisma.room.findMany({
    where: { hotelId, number: { in: ["101", "102", "103", "104", "201", "202", "203"] } },
  });
  const roomByNumber = (number: string) => demoRooms.find((room) => room.number === number);
  const room101 = roomByNumber("101");
  const room102 = roomByNumber("102");
  const room103 = roomByNumber("103");
  const room104 = roomByNumber("104");
  const room201 = roomByNumber("201");
  const room202 = roomByNumber("202");
  const room203 = roomByNumber("203");
  if (!room101 || !room102 || !room103 || !room104 || !room201 || !room202 || !room203) return;

  const guestArrival = await upsertGuest(
    "00000000-0000-0000-0000-000000000101",
    hotelId,
    "Martina",
    "Perez",
    "32888777",
    "martina.perez@example.com",
    { phone: "11 4411-2200", nationality: "Argentina", notes: "Titular demo llegada hoy." },
  );
  const guestFuture = await upsertGuest(
    "00000000-0000-0000-0000-000000000102",
    hotelId,
    "Lucas",
    "Rios",
    "30111222",
    "lucas.rios@example.com",
    { phone: "11 5566-7788", nationality: "Argentina" },
  );
  const guestInHouse = await upsertGuest(
    "00000000-0000-0000-0000-000000000103",
    hotelId,
    "Ana",
    "Molina",
    "28777444",
    "ana.molina@example.com",
    { phone: "11 6677-8899", nationality: "Uruguay" },
  );
  const guestPending = await upsertGuest(
    "00000000-0000-0000-0000-000000000104",
    hotelId,
    "Sofia",
    "Benitez",
    "34111888",
    "sofia.benitez@example.com",
    { phone: "11 4000-1100", nationality: "Paraguay", notes: "Reserva pendiente de confirmacion." },
  );
  const guestCompleted = await upsertGuest(
    "00000000-0000-0000-0000-000000000105",
    hotelId,
    "Diego",
    "Alvarez",
    "25999111",
    "diego.alvarez@example.com",
    { phone: "11 4222-3344", nationality: "Chile" },
  );
  const guestNoShow = await upsertGuest(
    "00000000-0000-0000-0000-000000000106",
    hotelId,
    "Valeria",
    "Costa",
    "36777123",
    "valeria.costa@example.com",
    { phone: "11 4333-5522", nationality: "Brasil" },
  );
  const guestCancelled = await upsertGuest(
    "00000000-0000-0000-0000-000000000107",
    hotelId,
    "Bruno",
    "Silva",
    "33333444",
    "bruno.silva@example.com",
    { phone: "11 4888-9900", nationality: "Argentina" },
  );

  const pending = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-PENDING" } },
    update: {
      guestId: guestPending.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room101.id,
      status: "pending",
      source: "phone",
      checkInDate: inFiveDays,
      checkOutDate: inEightDays,
      adults: 1,
      children: 1,
      currency: "ARS",
      totalAmount: 260000,
      depositAmount: 0,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
      notes: "Demo estado pendiente con menor y datos incompletos.",
    },
    create: {
      hotelId,
      guestId: guestPending.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room101.id,
      code: "R-DEMO-PENDING",
      status: "pending",
      source: "phone",
      checkInDate: inFiveDays,
      checkOutDate: inEightDays,
      adults: 1,
      children: 1,
      currency: "ARS",
      totalAmount: 260000,
      depositAmount: 0,
      depositPaid: false,
      notes: "Demo estado pendiente con menor y datos incompletos.",
    },
  });
  await resetDemoReservationOperation(pending.id);
  await replaceDemoOccupants(hotelId, pending.id, [
    {
      firstName: "Sofia",
      lastName: "Benitez",
      documentNumber: "34111888",
      phone: "11 4000-1100",
      nationality: "Paraguay",
      ageCategory: "adult",
      primary: true,
    },
    {
      firstName: "Tomas",
      lastName: "Benitez",
      documentNumber: null,
      phone: null,
      nationality: "Paraguay",
      ageCategory: "child",
    },
  ]);

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
      notes: "Reserva demo para probar check-in.",
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
  await replaceDemoOccupants(hotelId, arrival.id, [
    {
      firstName: "Martina",
      lastName: "Perez",
      documentNumber: "32888777",
      phone: "11 4411-2200",
      nationality: "Argentina",
      ageCategory: "adult",
      primary: true,
    },
    {
      firstName: "Nicolas",
      lastName: "Perez",
      documentNumber: "32999111",
      phone: "11 4411-2201",
      nationality: "Argentina",
      ageCategory: "adult",
    },
  ]);

  const future = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-FUTURE" } },
    update: {
      guestId: guestFuture.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room202.id,
      status: "confirmed",
      source: "online_csv",
      checkInDate: inThreeDays,
      checkOutDate: inSixDays,
      adults: 2,
      children: 1,
      currency: "ARS",
      totalAmount: 450000,
      depositAmount: 100000,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
      notes: "Reserva confirmada demo visible en calendario.",
    },
    create: {
      hotelId,
      guestId: guestFuture.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room202.id,
      code: "R-DEMO-FUTURE",
      status: "confirmed",
      source: "online_csv",
      checkInDate: inThreeDays,
      checkOutDate: inSixDays,
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
  await replaceDemoOccupants(hotelId, future.id, [
    {
      firstName: "Lucas",
      lastName: "Rios",
      documentNumber: "30111222",
      phone: "11 5566-7788",
      nationality: "Argentina",
      ageCategory: "adult",
      primary: true,
    },
    {
      firstName: "Camila",
      lastName: "Rios",
      documentNumber: "31222333",
      phone: "11 5566-7799",
      nationality: "Argentina",
      ageCategory: "adult",
    },
    {
      firstName: "Mateo",
      lastName: "Rios",
      documentNumber: "48999111",
      phone: null,
      nationality: "Argentina",
      ageCategory: "child",
    },
  ]);

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
      notes: "Estadia demo para probar check-out.",
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
  await replaceDemoOccupants(hotelId, inHouse.id, [
    {
      firstName: "Ana",
      lastName: "Molina",
      documentNumber: "28777444",
      phone: "11 6677-8899",
      nationality: "Uruguay",
      ageCategory: "adult",
      primary: true,
    },
  ]);

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

  const completed = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-COMPLETED" } },
    update: {
      guestId: guestCompleted.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room203.id,
      status: "completed",
      source: "direct",
      checkInDate: threeDaysAgo,
      checkOutDate: today,
      adults: 2,
      children: 0,
      currency: "ARS",
      totalAmount: 380000,
      depositAmount: 0,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
      notes: "Demo finalizada: salida hoy y habitacion sucia.",
    },
    create: {
      hotelId,
      guestId: guestCompleted.id,
      roomTypeId: superiorTypeId,
      assignedRoomId: room203.id,
      code: "R-DEMO-COMPLETED",
      status: "completed",
      source: "direct",
      checkInDate: threeDaysAgo,
      checkOutDate: today,
      adults: 2,
      children: 0,
      currency: "ARS",
      totalAmount: 380000,
      depositAmount: 0,
      depositPaid: false,
      notes: "Demo finalizada: salida hoy y habitacion sucia.",
    },
  });
  await replaceDemoOccupants(hotelId, completed.id, [
    {
      firstName: "Diego",
      lastName: "Alvarez",
      documentNumber: "25999111",
      phone: "11 4222-3344",
      nationality: "Chile",
      ageCategory: "adult",
      primary: true,
    },
    {
      firstName: "Paula",
      lastName: "Alvarez",
      documentNumber: "27666111",
      phone: "11 4222-3345",
      nationality: "Chile",
      ageCategory: "adult",
    },
  ]);
  const completedStay = await prisma.stay.upsert({
    where: { reservationId: completed.id },
    update: {
      hotelId,
      roomId: room203.id,
      status: "checked_out",
      checkedInAt: threeDaysAgo,
      checkedOutAt: today,
    },
    create: {
      hotelId,
      reservationId: completed.id,
      roomId: room203.id,
      status: "checked_out",
      checkedInAt: threeDaysAgo,
      checkedOutAt: today,
    },
  });
  const completedFolio = await prisma.folio.upsert({
    where: { reservationId: completed.id },
    update: {
      hotelId,
      stayId: completedStay.id,
      roomId: room203.id,
      status: "closed",
      currency: "ARS",
      closedAt: today,
    },
    create: {
      hotelId,
      reservationId: completed.id,
      stayId: completedStay.id,
      roomId: room203.id,
      status: "closed",
      currency: "ARS",
      closedAt: today,
    },
  });
  await prisma.invoice.deleteMany({ where: { folioId: completedFolio.id } });
  await prisma.payment.deleteMany({ where: { folioId: completedFolio.id } });
  await prisma.charge.deleteMany({ where: { folioId: completedFolio.id } });
  await prisma.charge.create({
    data: {
      hotelId,
      folioId: completedFolio.id,
      kind: "lodging",
      description: "Alojamiento demo finalizado",
      quantity: 1,
      unitAmount: 380000,
      totalAmount: 380000,
    },
  });
  await prisma.payment.create({
    data: {
      hotelId,
      folioId: completedFolio.id,
      method: "transfer",
      currency: "ARS",
      amount: 380000,
      reference: "Pago demo finalizado",
    },
  });
  await prisma.room.update({
    where: { id: room203.id },
    data: { commercialStatus: "available", cleaningStatus: "dirty" },
  });

  const noShow = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-NOSHOW" } },
    update: {
      guestId: guestNoShow.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room103.id,
      status: "no_show",
      source: "online_csv",
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      adults: 1,
      children: 0,
      currency: "ARS",
      totalAmount: 180000,
      depositAmount: 50000,
      depositPaid: true,
      depositMethod: "transfer",
      depositReference: "Sena demo no-show",
      notes: "Demo no-show para revisar estado y datos de huesped.",
    },
    create: {
      hotelId,
      guestId: guestNoShow.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room103.id,
      code: "R-DEMO-NOSHOW",
      status: "no_show",
      source: "online_csv",
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      adults: 1,
      children: 0,
      currency: "ARS",
      totalAmount: 180000,
      depositAmount: 50000,
      depositPaid: true,
      depositMethod: "transfer",
      depositReference: "Sena demo no-show",
      notes: "Demo no-show para revisar estado y datos de huesped.",
    },
  });
  await resetDemoReservationOperation(noShow.id);
  await replaceDemoOccupants(hotelId, noShow.id, [
    {
      firstName: "Valeria",
      lastName: "Costa",
      documentNumber: "36777123",
      phone: "11 4333-5522",
      nationality: "Brasil",
      ageCategory: "adult",
      primary: true,
    },
  ]);

  const cancelled = await prisma.reservation.upsert({
    where: { hotelId_code: { hotelId, code: "R-DEMO-CANCELLED" } },
    update: {
      guestId: guestCancelled.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room104.id,
      status: "cancelled",
      source: "direct",
      checkInDate: inEightDays,
      checkOutDate: inTenDays,
      adults: 2,
      children: 0,
      currency: "ARS",
      totalAmount: 220000,
      depositAmount: 40000,
      depositPaid: false,
      depositMethod: null,
      depositReference: null,
      notes: "Demo cancelada para revisar estado sin bloquear calendario.",
    },
    create: {
      hotelId,
      guestId: guestCancelled.id,
      roomTypeId: standardTypeId,
      assignedRoomId: room104.id,
      code: "R-DEMO-CANCELLED",
      status: "cancelled",
      source: "direct",
      checkInDate: inEightDays,
      checkOutDate: inTenDays,
      adults: 2,
      children: 0,
      currency: "ARS",
      totalAmount: 220000,
      depositAmount: 40000,
      depositPaid: false,
      notes: "Demo cancelada para revisar estado sin bloquear calendario.",
    },
  });
  await resetDemoReservationOperation(cancelled.id);
  await replaceDemoOccupants(hotelId, cancelled.id, [
    {
      firstName: "Bruno",
      lastName: "Silva",
      documentNumber: "33333444",
      phone: "11 4888-9900",
      nationality: "Argentina",
      ageCategory: "adult",
      primary: true,
    },
    {
      firstName: "Marcos",
      lastName: "Silva",
      documentNumber: "34444555",
      phone: "11 4888-9901",
      nationality: "Argentina",
      ageCategory: "adult",
    },
  ]);
}

async function upsertGuest(
  id: string,
  hotelId: string,
  firstName: string,
  lastName: string,
  documentNumber: string,
  email: string,
  extra: { phone?: string; nationality?: string; notes?: string } = {},
) {
  return prisma.guest.upsert({
    where: { id },
    update: {
      hotelId,
      firstName,
      lastName,
      documentType: "DNI",
      documentNumber,
      email,
      phone: extra.phone,
      nationality: extra.nationality,
      notes: extra.notes,
    },
    create: {
      id,
      hotelId,
      firstName,
      lastName,
      documentType: "DNI",
      documentNumber,
      email,
      phone: extra.phone,
      nationality: extra.nationality,
      notes: extra.notes,
    },
  });
}

async function resetDemoReservationOperation(reservationId: string) {
  const folio = await prisma.folio.findUnique({ where: { reservationId } });
  if (folio) {
    await prisma.invoice.deleteMany({ where: { folioId: folio.id } });
    await prisma.payment.deleteMany({ where: { folioId: folio.id } });
    await prisma.charge.deleteMany({ where: { folioId: folio.id } });
    await prisma.folio.delete({ where: { id: folio.id } });
  }
  await prisma.stay.deleteMany({ where: { reservationId } });
}

async function replaceDemoOccupants(
  hotelId: string,
  reservationId: string,
  occupants: {
    firstName: string;
    lastName: string;
    documentNumber: string | null;
    phone: string | null;
    nationality: string | null;
    ageCategory: "adult" | "child";
    primary?: boolean;
  }[],
) {
  await prisma.reservationOccupant.deleteMany({ where: { hotelId, reservationId } });
  await prisma.reservationOccupant.createMany({
    data: occupants.map((occupant, index) => ({
      hotelId,
      reservationId,
      firstName: occupant.firstName,
      lastName: occupant.lastName,
      documentType: occupant.documentNumber ? "DNI" : null,
      documentNumber: occupant.documentNumber,
      phone: occupant.phone,
      nationality: occupant.nationality,
      ageCategory: occupant.ageCategory,
      primary: occupant.primary ?? index === 0,
    })),
  });
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
