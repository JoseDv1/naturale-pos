import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { prisma } from '../db';

const shifts = new Hono();

class ApiError extends Error {
  constructor(message: string, public status: 400 | 404 | 401 = 400) {
    super(message);
  }
}

// Utility for precise 2-decimal financial rounding
const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------

const openShiftSchema = z.object({
  initialCash: z.union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((num) => !isNaN(num) && num >= 0, {
      message: 'El monto base inicial debe ser mayor o igual a cero',
    }),
  notes: z.string().optional().nullable(),
});

const closeShiftSchema = z.object({
  actualCash: z.union([z.number(), z.string()])
    .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
    .refine((num) => !isNaN(num) && num >= 0, {
      message: 'El efectivo físico contado debe ser mayor o igual a cero',
    }),
  notes: z.string().optional().nullable(),
});

// -----------------------------------------------------------------------------
// Helper: Calculate Shift Totals
// -----------------------------------------------------------------------------

export async function calculateShiftTotals(shiftId: string, initialCash: number, tx: any = prisma) {
  // Query all non-cancelled sales linked to this shift
  const sales = await tx.sale.findMany({
    where: {
      shiftId,
      status: { not: 'CANCELLED' },
    },
    include: {
      payments: true,
    },
  });

  // Query expenses linked to this shift (excluding internal transfer accounting records)
  const expenses = await tx.expense.findMany({
    where: {
      shiftId,
      category: { not: 'INTERNAL_TRANSFER' },
    },
  });

  let totalSales = 0;
  let cashSales = 0;
  let cardSales = 0;
  let transferSales = 0;
  let internalSales = 0;

  for (const sale of sales) {
    totalSales += Number(sale.total);
    for (const pay of sale.payments) {
      const amt = Number(pay.amount);
      if (pay.method === 'CASH') cashSales += amt;
      else if (pay.method === 'CARD') cardSales += amt;
      else if (pay.method === 'TRANSFER') transferSales += amt;
      else if (pay.method === 'INTERNAL') internalSales += amt;
    }
  }

  const totalExpenses = expenses.reduce((sum: number, exp: any) => sum + Number(exp.amount), 0);

  const roundedInitialCash = round2(initialCash);
  const roundedCashSales = round2(cashSales);
  const roundedCardSales = round2(cardSales);
  const roundedTransferSales = round2(transferSales);
  const roundedInternalSales = round2(internalSales);
  const roundedTotalSales = round2(totalSales);
  const roundedTotalExpenses = round2(totalExpenses);

  const expectedCash = round2(roundedInitialCash + roundedCashSales - roundedTotalExpenses);

  return {
    sales,
    expenses,
    initialCash: roundedInitialCash,
    cashSales: roundedCashSales,
    cardSales: roundedCardSales,
    transferSales: roundedTransferSales,
    internalSales: roundedInternalSales,
    totalSales: roundedTotalSales,
    totalExpenses: roundedTotalExpenses,
    expectedCash,
    salesCount: sales.length,
    expensesCount: expenses.length,
  };
}

// -----------------------------------------------------------------------------
// Route Endpoints
// -----------------------------------------------------------------------------

/**
 * GET /shifts/current
 * Returns active shift with live real-time totals, or null if no shift is open.
 */
shifts.get('/current', async (c) => {
  try {
    const shift = await prisma.shift.findFirst({
      where: { status: 'OPEN' },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });

    if (!shift) {
      return c.json({ shift: null, realTimeTotals: null });
    }

    const totals = await calculateShiftTotals(shift.id, Number(shift.initialCash));

    return c.json({
      shift,
      realTimeTotals: {
        initialCash: totals.initialCash,
        cashSales: totals.cashSales,
        cardSales: totals.cardSales,
        transferSales: totals.transferSales,
        internalSales: totals.internalSales,
        expenses: totals.totalExpenses,
        expectedCash: totals.expectedCash,
        salesCount: totals.salesCount,
        expensesCount: totals.expensesCount,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener el turno actual' }, 500);
  }
});

/**
 * POST /shifts/open
 * Validates that no shift is OPEN, validates initialCash >= 0, and creates a shift.
 */
shifts.post('/open', zValidator('json', openShiftSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.id) {
      return c.json({ error: 'No autorizado: Sesión no encontrada' }, 401);
    }

    const { initialCash, notes } = c.req.valid('json');

    const result = await prisma.$transaction(async (tx) => {
      const activeShift = await tx.shift.findFirst({
        where: { status: 'OPEN' },
      });

      if (activeShift) {
        throw new ApiError('Ya existe un turno de caja abierto actualmente', 400);
      }

      const newShift = await tx.shift.create({
        data: {
          userId: user.id,
          status: 'OPEN',
          initialCash,
          notes: notes?.trim() || null,
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      });

      return newShift;
    });

    return c.json({
      message: 'Turno de caja abierto exitosamente',
      shift: result,
    }, 201);
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al abrir el turno de caja' }, 500);
  }
});

/**
 * POST /shifts/close
 * Closes active shift, performs arqueo calculations, records snapshot stats.
 */
shifts.post('/close', zValidator('json', closeShiftSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: result.error.issues[0].message }, 400);
  }
}), async (c) => {
  try {
    const user = c.get('user');
    if (!user || !user.id) {
      return c.json({ error: 'No autorizado: Sesión no encontrada' }, 401);
    }

    const { actualCash, notes } = c.req.valid('json');

    const closureReport = await prisma.$transaction(async (tx) => {
      const activeShift = await tx.shift.findFirst({
        where: { status: 'OPEN' },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      });

      if (!activeShift) {
        throw new ApiError('No hay un turno de caja abierto para cerrar', 400);
      }

      const totals = await calculateShiftTotals(activeShift.id, Number(activeShift.initialCash), tx);
      const roundedActualCash = round2(actualCash);
      const difference = round2(roundedActualCash - totals.expectedCash);

      const mergedNotes = notes?.trim()
        ? (activeShift.notes ? `${activeShift.notes}\n[Cierre]: ${notes.trim()}` : `[Cierre]: ${notes.trim()}`)
        : activeShift.notes;

      const updatedShift = await tx.shift.update({
        where: { id: activeShift.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedByUserId: user.id,
          expectedCash: totals.expectedCash,
          actualCash: roundedActualCash,
          difference,
          totalSales: totals.totalSales,
          totalCard: totals.cardSales,
          totalTransfer: totals.transferSales,
          totalInternal: totals.internalSales,
          totalExpenses: totals.totalExpenses,
          notes: mergedNotes,
        },
        include: {
          user: { select: { id: true, name: true, username: true } },
        },
      });

      return {
        shift: updatedShift,
        initialCash: totals.initialCash,
        expectedCash: totals.expectedCash,
        actualCash: roundedActualCash,
        difference,
        totalSales: totals.totalSales,
        totalExpenses: totals.totalExpenses,
        totals: {
          initialCash: totals.initialCash,
          cashSales: totals.cashSales,
          cardSales: totals.cardSales,
          transferSales: totals.transferSales,
          internalSales: totals.internalSales,
          totalSales: totals.totalSales,
          totalExpenses: totals.totalExpenses,
          salesCount: totals.salesCount,
          expensesCount: totals.expensesCount,
        },
      };
    });

    return c.json({
      message: 'Turno de caja cerrado exitosamente',
      report: closureReport,
    });
  } catch (error: any) {
    if (error instanceof ApiError) {
      return c.json({ error: error.message }, error.status);
    }
    return c.json({ error: error.message || 'Error al cerrar el turno de caja' }, 500);
  }
});

/**
 * GET /shifts
 * Shift history list ordered by openedAt desc.
 */
shifts.get('/', async (c) => {
  try {
    const list = await prisma.shift.findMany({
      include: {
        user: { select: { id: true, name: true, username: true } },
        _count: { select: { sales: true, expenses: true } },
      },
      orderBy: { openedAt: 'desc' },
    });

    return c.json(list);
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al listar turnos de caja' }, 500);
  }
});

/**
 * GET /shifts/:id
 * Single shift detail closure report with itemized sales, payments, and financial breakdown.
 */
shifts.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const shift = await prisma.shift.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, username: true } },
        sales: {
          include: {
            user: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { name: true, sku: true, department: true } },
                variant: { select: { name: true, sku: true } },
              },
            },
            payments: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        expenses: {
          include: {
            user: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { name: true, sku: true } },
              },
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!shift) {
      return c.json({ error: 'Turno de caja no encontrado' }, 404);
    }

    let closedByUser = null;
    if (shift.closedByUserId) {
      closedByUser = await prisma.user.findUnique({
        where: { id: shift.closedByUserId },
        select: { id: true, name: true, username: true },
      });
    }

    const totals = await calculateShiftTotals(shift.id, Number(shift.initialCash));
    const actualCash = shift.actualCash !== null ? Number(shift.actualCash) : null;
    const difference = shift.difference !== null ? Number(shift.difference) : null;

    return c.json({
      shift: {
        ...shift,
        closedByUser,
      },
      summary: {
        initialCash: totals.initialCash,
        cashSales: totals.cashSales,
        cardSales: totals.cardSales,
        transferSales: totals.transferSales,
        internalSales: totals.internalSales,
        totalSales: totals.totalSales,
        totalExpenses: totals.totalExpenses,
        expectedCash: totals.expectedCash,
        actualCash,
        difference,
        salesCount: totals.salesCount,
        expensesCount: totals.expensesCount,
      },
      sales: shift.sales,
      expenses: shift.expenses,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Error al obtener detalle del turno' }, 500);
  }
});

export default shifts;
